import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { BuildingType } from './buildings'
import type { CropState, CropType } from './crops'

// Tallest a model may be, in world units per tile of its footprint's longer side.
const MAX_HEIGHT_PER_TILE = 1.2

const loader = new GLTFLoader()
// One load per file, however many buildings use it. We store the promise
// (not the result) so two buildings asking at once share a single download.
const modelCache = new Map<string, Promise<THREE.Object3D>>()

// Geometry belonging to a cached model. Every building made from that model
// shares it (clone() copies objects, not geometry), so it must never be
// disposed while the game runs.
const sharedGeometries = new WeakSet<THREE.BufferGeometry>()

export function isSharedGeometry(geometry: THREE.BufferGeometry): boolean {
  return sharedGeometries.has(geometry)
}

function loadModel(url: string): Promise<THREE.Object3D> {
  let model = modelCache.get(url)
  if (!model) {
    model = loader.loadAsync(url).then((gltf) => {
      gltf.scene.traverse((o) => {
        if (o instanceof THREE.Mesh) sharedGeometries.add(o.geometry)
      })
      return gltf.scene
    })
    modelCache.set(url, model)
  }
  return model
}

// ---- Colorful homes
//
// The model pack paints every house the same way: pale gray walls and a green
// roof, two swatches of its shared palette texture (colormap.png: a grid of
// color swatches, 16 across and 4 down; each surface of a model samples one).
// To give every home its own colors, we make copies of the texture with those
// two swatches repainted, one per scheme, and pick a scheme from the
// building's id, so a house keeps its colors for good. Each copy keeps the
// swatch's light-to-dark shading, only the color changes.

// Found by measuring how much of each model's surface samples each swatch
// (walls and roofs are big faces with few vertices, so area, not vertex count).
const ROOF_SWATCH = { column: 1, row: 1 }
const WALL_SWATCH = { column: 7, row: 2 }

export const HOME_SCHEMES: { roof: string; walls: string }[] = [
  { roof: '#e0533f', walls: '#ffe9b0' }, // red roof, butter walls
  { roof: '#3b7fe0', walls: '#fffaf0' }, // blue, white
  { roof: '#8a56d6', walls: '#ffd9a8' }, // purple, apricot
  { roof: '#2fae8f', walls: '#ffcfc0' }, // teal, coral
  { roof: '#f08a24', walls: '#c9e4ff' }, // orange, sky blue
  { roof: '#d84f8f', walls: '#e6dcff' }, // pink, lavender
  { roof: '#4fae4a', walls: '#fff09a' }, // green, lemon
  { roof: '#7a4b34', walls: '#c8f0d4' }, // brown, mint
]

const schemeMaterials = new Map<string, THREE.Material>()

// The material for a home's colors: a copy of the model's material using a
// repainted texture. One per scheme (and original material), shared by every home using it.
function schemeMaterial(original: THREE.MeshStandardMaterial, scheme: number): THREE.Material {
  const key = `${original.uuid}:${scheme}`
  let material = schemeMaterials.get(key)
  if (!material) {
    const copy = original.clone()
    copy.map = repaintTexture(original.map!, HOME_SCHEMES[scheme])
    schemeMaterials.set(key, copy)
    material = copy
  }
  return material
}

function repaintTexture(base: THREE.Texture, colors: { roof: string; walls: string }): THREE.Texture {
  const image = base.image as CanvasImageSource & { width: number; height: number }
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(image, 0, 0)
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
  // The top quarter of the palette is black. Some browsers hand the loader
  // the picture upside down; if the top isn't black, rows count from the bottom.
  const flipped = pixels.data[(4 * canvas.width + 4) * 4] > 16
  // Roofs keep the swatch's shading; walls get one flat color, since they
  // sample its gradient in steps that read as speckle up close.
  repaintSwatch(pixels, ROOF_SWATCH, new THREE.Color(colors.roof), flipped, true)
  repaintSwatch(pixels, WALL_SWATCH, new THREE.Color(colors.walls), flipped, false)
  ctx.putImageData(pixels, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.flipY = base.flipY
  texture.colorSpace = base.colorSpace
  texture.magFilter = base.magFilter
  texture.minFilter = base.minFilter
  texture.wrapS = base.wrapS
  texture.wrapT = base.wrapT
  return texture
}

// Recolor one swatch. Keeping its shading, each pixel gets the new color
// scaled by how light that pixel was compared with the swatch's average.
function repaintSwatch(pixels: ImageData, swatch: { column: number; row: number }, color: THREE.Color, flipped: boolean, shading: boolean) {
  const w = pixels.width / 16
  const h = pixels.height / 4
  const x0 = swatch.column * w
  const y0 = flipped ? pixels.height - (swatch.row + 1) * h : swatch.row * h
  const target = color.clone().convertLinearToSRGB() // THREE.Color holds linear values; pixels are sRGB
  const lightness = (i: number) => (pixels.data[i] + pixels.data[i + 1] + pixels.data[i + 2]) / 3
  let total = 0
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) total += lightness((y * pixels.width + x) * 4)
  const average = total / (w * h) || 1
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const i = (y * pixels.width + x) * 4
      const shade = shading ? lightness(i) / average : 1
      pixels.data[i] = Math.min(255, target.r * 255 * shade)
      pixels.data[i + 1] = Math.min(255, target.g * 255 * shade)
      pixels.data[i + 2] = Math.min(255, target.b * 255 * shade)
    }
  }
}

// A model's single mesh, ready to be drawn many times at once (instancing):
// its shape moved so it stands centered on the origin and scaled to a given
// height, and its material. For the countryside's trees and rocks (scenery.ts).
export async function loadInstanceable(url: string, height: number): Promise<{ geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial }> {
  const model = await loadModel(url)
  model.updateMatrixWorld(true)
  let found: THREE.Mesh | null = null
  model.traverse((o) => {
    if (!found && o instanceof THREE.Mesh) found = o
  })
  const mesh = found as unknown as THREE.Mesh
  const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld)
  geometry.computeBoundingBox()
  const box = geometry.boundingBox!
  const center = box.getCenter(new THREE.Vector3())
  geometry.translate(-center.x, -box.min.y, -center.z)
  const scale = height / (box.max.y - box.min.y)
  geometry.scale(scale, scale, scale)
  return { geometry, material: (mesh.material as THREE.MeshStandardMaterial).clone() }
}

// Builds the 3D object for a building. Its origin is the center of the
// footprint at ground level. Models load in the background, so this returns
// an empty group right away and fills it in once the model is ready.
// overrideMaterial replaces every material, used for the see-through placement ghost.
// colorKey picks a home's color scheme (the building's id), so homes differ.
export function createBuildingObject(type: BuildingType, overrideMaterial?: THREE.Material, colorKey = 0): THREE.Group {
  const group = new THREE.Group()
  const scheme = type.category === 'home' ? colorKey % HOME_SCHEMES.length : null

  const fill = (content: THREE.Object3D) => {
    content.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      obj.castShadow = !overrideMaterial
      obj.receiveShadow = !overrideMaterial
      if (overrideMaterial) obj.material = overrideMaterial
      else if (scheme !== null && obj.material instanceof THREE.MeshStandardMaterial && obj.material.map) {
        obj.material = schemeMaterial(obj.material, scheme)
      }
    })
    group.add(content)
  }

  // userData.ready resolves once the content is in, for code that needs the
  // finished object (the build menu's thumbnails).
  if (type.model) {
    group.userData.ready = loadModel(type.model)
      .then((model) => fill(fitToFootprint(model.clone(), type)))
      .catch((err) => {
        console.warn(`Couldn't load ${type.model}, using placeholder`, err)
        fill(createPlaceholder(type))
      })
  } else {
    fill(createPlaceholder(type))
    group.userData.ready = Promise.resolve()
  }
  return group
}

// Models come in all sizes. Scale this one so it fits the footprint and
// move it so its base sits centered on the origin.
function fitToFootprint(model: THREE.Object3D, type: BuildingType): THREE.Object3D {
  const box = new THREE.Box3().setFromObject(model)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  model.position.sub(new THREE.Vector3(center.x, box.min.y, center.z))

  // Fill 90% of the footprint, but don't let tall, thin models (trees) tower
  // over everything: cap the height relative to the footprint too.
  const maxHeight = Math.max(type.size.x, type.size.z) * (type.heightLimit ?? MAX_HEIGHT_PER_TILE)
  const scale = Math.min((type.size.x / size.x) * 0.9, (type.size.z / size.z) * 0.9, maxHeight / size.y)

  const wrapper = new THREE.Group()
  wrapper.add(model)
  wrapper.scale.setScalar(scale)
  return wrapper
}

// Where things are on the Army Base, in its own coordinates (center at the
// origin, before it's turned), shared by the model and ArmyView's soldiers,
// flag, sentry and helicopter. The parade ground runs between the barracks.
export const ARMY_BASE = {
  flag: { x: 0.9, z: 0, top: 1.3, bottom: 0.35 },
  pad: { x: 1.0, z: 0.85 },
  tower: { x: 1.15, z: -1.15, floor: 1.12 },
  ground: { x0: -1.0, x1: 0.62, z0: -0.3, z1: 0.3 },
}

// The Ski Resort's mountain, in the building's own coordinates (its center
// at the origin): a cone with its peak over (cx, cz). Skiers ride on it and
// the lift climbs it (LeisureView), so they share these numbers with the model.
export const SKI_SLOPE = { cx: -0.45, cz: -0.45, height: 2.2, radius: 1.75 }
export const SKI_LIFT = { from: { x: 1.0, z: 0.55 }, to: { x: -0.2, z: -0.45 } }

// Height of the mountain's surface at (x, z), from the ground of the site.
export function slopeHeight(x: number, z: number): number {
  const { cx, cz, height, radius } = SKI_SLOPE
  return 0.03 + Math.max(0, height * (1 - Math.hypot(x - cx, z - cz) / radius))
}

// Simple shapes so the game is playable before any art exists. Each
// building's shapes and materials are its own (ownsResources), so
// disposeBuildingObject frees them when it's demolished.
function createPlaceholder(type: BuildingType): THREE.Group {
  const { shape, color, accent, height } = type.placeholder
  const w = type.size.x
  const d = type.size.z
  const group = new THREE.Group()

  // Adds a mesh whose bottom (not center) sits at y.
  const add = (geometry: THREE.BufferGeometry, c: string, x: number, y: number, z: number) => {
    geometry.computeBoundingBox()
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: c, flatShading: true }))
    mesh.position.set(x, y - geometry.boundingBox!.min.y, z)
    group.add(mesh)
    return mesh
  }

  switch (shape) {
    case 'house': {
      add(new THREE.BoxGeometry(w * 0.8, height, d * 0.8), color, 0, 0, 0)
      // A cone with 4 sides is a pyramid. Turned 45°, its edges line up with the walls.
      const roof = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4)
      roof.scale(w * 0.9, height * 0.6, d * 0.9)
      add(roof, accent, 0, height, 0)
      break
    }
    case 'shop': {
      add(new THREE.BoxGeometry(w * 0.85, height, d * 0.8), color, 0, 0, 0)
      // Awning over the front (+z faces the camera) and a sign on the roof.
      add(new THREE.BoxGeometry(w * 0.85, 0.08, 0.35), accent, 0, height * 0.55, d * 0.4 + 0.17)
      add(new THREE.BoxGeometry(w * 0.5, 0.3, 0.1), accent, 0, height, d * 0.3)
      break
    }
    case 'field': {
      // Plowed soil with darker furrows. Crops are drawn on top separately (createCropObject).
      add(new THREE.BoxGeometry(w * 0.95, height, d * 0.95), color, 0, 0, 0)
      const rows = w * 4
      for (let i = 0; i < rows; i++) {
        const x = -w * 0.95 / 2 + (i + 0.5) * (w * 0.95 / rows)
        add(new THREE.BoxGeometry(0.08, 0.015, d * 0.9), accent, x, height, 0)
      }
      break
    }
    case 'tower': {
      // A water tower: four legs holding up a round tank with a pointed roof.
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        add(new THREE.CylinderGeometry(0.05, 0.05, height * 0.55, 6), accent, x * w * 0.22, 0, z * d * 0.22)
      }
      add(new THREE.CylinderGeometry(w * 0.32, w * 0.32, height * 0.35, 12), color, 0, height * 0.55, 0)
      add(new THREE.ConeGeometry(w * 0.34, height * 0.15, 12), accent, 0, height * 0.9, 0)
      break
    }
    case 'plant': {
      // A power plant: a long hall with two smokestacks.
      add(new THREE.BoxGeometry(w * 0.85, height * 0.6, d * 0.7), color, 0, 0, 0.1)
      add(new THREE.CylinderGeometry(0.18, 0.24, height * 1.4, 8), accent, -w * 0.25, 0, -d * 0.25)
      add(new THREE.CylinderGeometry(0.18, 0.24, height * 1.4, 8), accent, w * 0.05, 0, -d * 0.25)
      break
    }
    case 'recycling': {
      // A recycling center: a shed and a row of colored bins out front.
      add(new THREE.BoxGeometry(w * 0.8, height, d * 0.55), color, 0, 0, -d * 0.15)
      const bins = ['#2f6f8f', '#e0b23a', '#3f8f3a']
      bins.forEach((c, i) => add(new THREE.BoxGeometry(0.28, 0.3, 0.28), c, (i - 1) * 0.4, 0, d * 0.3))
      break
    }
    case 'solar': {
      // A solar farm: rows of tilted dark panels on short posts.
      for (let row = 0; row < d; row++) {
        const z = -d / 2 + 0.5 + row
        add(new THREE.BoxGeometry(0.06, height * 0.4, 0.06), accent, 0, 0, z)
        const panel = add(new THREE.BoxGeometry(w * 0.85, 0.05, 0.7), color, 0, height * 0.4, z)
        panel.rotation.x = -0.45 // tilted toward the sun
      }
      break
    }
    case 'road': {
      // Just the asphalt; RoadView draws placed roads with their markings.
      add(new THREE.BoxGeometry(w, height, d), color, 0, 0, 0)
      break
    }
    case 'park': {
      // Grass, a path, a fountain and two trees.
      add(new THREE.BoxGeometry(w * 0.95, 0.04, d * 0.95), color, 0, 0, 0)
      add(new THREE.BoxGeometry(w * 0.95, 0.045, 0.3), accent, 0, 0, 0)
      add(new THREE.CylinderGeometry(0.3, 0.34, 0.12, 12), '#c9c6bd', 0, 0.04, 0)
      add(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 12), '#6fb7e0', 0, 0.12, 0)
      for (const [x, z] of [[-0.55, -0.55], [0.55, 0.55]]) {
        add(new THREE.CylinderGeometry(0.05, 0.06, 0.25, 6), '#7a5233', x, 0.04, z)
        add(new THREE.IcosahedronGeometry(0.28, 0), '#3f8f3a', x, 0.24, z)
      }
      break
    }
    case 'school': {
      // A long brick building with a bell tower and a flag.
      add(new THREE.BoxGeometry(w * 0.85, height * 0.6, d * 0.65), color, 0, 0, 0)
      add(new THREE.BoxGeometry(w * 0.9, 0.08, d * 0.7), accent, 0, height * 0.6, 0)
      add(new THREE.BoxGeometry(0.45, height * 0.45, 0.45), color, 0, height * 0.6, 0)
      add(new THREE.ConeGeometry(0.36, 0.35, 4).rotateY(Math.PI / 4), accent, 0, height * 1.05, 0)
      add(new THREE.CylinderGeometry(0.02, 0.02, height * 0.9, 4), '#dddddd', w * 0.35, 0, d * 0.42)
      add(new THREE.BoxGeometry(0.3, 0.18, 0.02), '#3f6fd0', w * 0.35 + 0.15, height * 0.7, d * 0.42)
      break
    }
    case 'firestation': {
      // A red station with two big garage doors facing the street.
      add(new THREE.BoxGeometry(w * 0.85, height * 0.8, d * 0.75), color, 0, 0, 0)
      add(new THREE.BoxGeometry(w * 0.9, 0.08, d * 0.8), accent, 0, height * 0.8, 0)
      for (const x of [-0.4, 0.4]) add(new THREE.BoxGeometry(0.6, height * 0.55, 0.02), accent, x, 0, d * 0.375 + 0.01)
      add(new THREE.BoxGeometry(0.25, height * 0.5, 0.25), color, -w * 0.32, height * 0.8, -d * 0.2)
      break
    }
    case 'busstop': {
      // A bus shelter: a back wall, a roof, a bench, and a sign on a pole.
      add(new THREE.BoxGeometry(0.7, 0.04, 0.4), '#c9c6bd', 0, 0, 0)
      add(new THREE.BoxGeometry(0.62, height * 0.75, 0.04), color, 0, 0.04, -0.16)
      add(new THREE.BoxGeometry(0.7, 0.05, 0.42), color, 0, height * 0.8, -0.02)
      add(new THREE.BoxGeometry(0.45, 0.06, 0.12), '#8a5a36', 0, 0.16, -0.08)
      add(new THREE.CylinderGeometry(0.02, 0.02, height, 6), '#dddddd', 0.38, 0, 0.16)
      add(new THREE.BoxGeometry(0.16, 0.16, 0.03), accent, 0.38, height * 0.85, 0.16)
      break
    }
    case 'armybase': {
      // Two barracks, a parade ground, a flagpole with a flag, a watchtower and a low wall.
      add(new THREE.BoxGeometry(w * 0.92, 0.04, d * 0.92), accent, 0, 0, 0)
      for (const z of [-0.85, 0.85]) {
        add(new THREE.BoxGeometry(w * 0.55, height * 0.5, 0.6), color, -0.35, 0.04, z)
        // A half cylinder lying along the barracks: a curved roof.
        const roof = new THREE.CylinderGeometry(0.3, 0.3, w * 0.55, 8, 1, false, 0, Math.PI).rotateZ(Math.PI / 2)
        add(roof, '#55613b', -0.35, 0.04 + height * 0.5, z)
      }
      // The flagpole (ArmyView flies the flag, so it can wave and be raised)
      // and a helipad with an H, where ArmyView's helicopter lands.
      add(new THREE.CylinderGeometry(0.025, 0.025, height * 1.6, 6), '#dddddd', ARMY_BASE.flag.x, 0.04, ARMY_BASE.flag.z)
      add(new THREE.CylinderGeometry(0.38, 0.38, 0.012, 24), '#5b6570', ARMY_BASE.pad.x, 0.04, ARMY_BASE.pad.z)
      for (const dz of [-0.1, 0.1]) add(new THREE.BoxGeometry(0.22, 0.005, 0.04), '#ffffff', ARMY_BASE.pad.x, 0.052, ARMY_BASE.pad.z + dz)
      add(new THREE.BoxGeometry(0.04, 0.005, 0.2), '#ffffff', ARMY_BASE.pad.x, 0.052, ARMY_BASE.pad.z)
      for (const [x, z] of [[1.15, -1.15]]) {
        for (const [lx, lz] of [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]]) {
          add(new THREE.BoxGeometry(0.04, height * 1.2, 0.04), '#6b4a2f', x + lx, 0.04, z + lz)
        }
        add(new THREE.BoxGeometry(0.36, 0.2, 0.36), color, x, 0.04 + height * 1.2, z)
        add(new THREE.ConeGeometry(0.28, 0.2, 4).rotateY(Math.PI / 4), '#55613b', x, 0.24 + height * 1.2, z)
      }
      for (const [x, z, sw, sd] of [[0, -d * 0.47, w * 0.94, 0.06], [-w * 0.47, 0, 0.06, d * 0.94]] as const) {
        add(new THREE.BoxGeometry(sw, 0.16, sd), '#9a9a8a', x, 0.04, z)
      }
      break
    }
    case 'rail': {
      // A short piece of track, for the build menu's picture (RailView draws the real network).
      add(new THREE.BoxGeometry(0.9, 0.04, 0.5), color, 0, 0, 0)
      for (const x of [-0.3, 0, 0.3]) add(new THREE.BoxGeometry(0.1, 0.03, 0.46), '#6b4a2f', x, 0.04, 0)
      for (const z of [-0.12, 0.12]) add(new THREE.BoxGeometry(0.9, 0.04, 0.035), accent, 0, 0.07, z)
      break
    }
    case 'station': {
      // A station hall with a clock, and a long platform canopy on posts beside the track.
      add(new THREE.BoxGeometry(w * 0.6, height * 0.8, d * 0.5), color, -w * 0.15, 0, -d * 0.2)
      const roof = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4)
      roof.scale(w * 0.66, height * 0.35, d * 0.56)
      add(roof, accent, -w * 0.15, height * 0.8, -d * 0.2)
      add(new THREE.CylinderGeometry(0.14, 0.14, 0.03, 16).rotateX(Math.PI / 2), '#ffffff', -w * 0.15, height * 0.55, d * 0.05 + 0.02)
      add(new THREE.BoxGeometry(w * 0.95, 0.08, d * 0.3), '#c9c6bd', 0, 0, d * 0.32)
      for (const x of [-1.2, -0.4, 0.4, 1.2]) add(new THREE.BoxGeometry(0.05, height * 0.6, 0.05), '#dddddd', x, 0.08, d * 0.38)
      add(new THREE.BoxGeometry(w * 0.95, 0.05, d * 0.32), accent, 0, 0.08 + height * 0.6, d * 0.32)
      break
    }
    case 'airport': {
      // A runway along the south side (dashed center line, striped ends), and
      // to the north a terminal, a control tower and a hangar. The runway's
      // middle is at z = d * 0.23; FlightView flies planes from it.
      const runwayZ = d * 0.23
      add(new THREE.BoxGeometry(w * 0.98, 0.04, d * 0.98), '#9fb59a', 0, 0, 0)
      add(new THREE.BoxGeometry(w * 0.97, 0.03, d * 0.42), color, 0, 0.04, runwayZ)
      for (let x = -w / 2 + 1; x < w / 2 - 0.9; x += 0.5) add(new THREE.BoxGeometry(0.25, 0.005, 0.04), '#ffffff', x, 0.07, runwayZ)
      for (const end of [-1, 1]) {
        for (const z of [-0.36, -0.2, 0.2, 0.36]) add(new THREE.BoxGeometry(0.3, 0.005, 0.07), '#ffffff', end * (w / 2 - 0.35), 0.07, runwayZ + z)
      }
      add(new THREE.BoxGeometry(w * 0.3, height * 0.6, d * 0.28), accent, -w * 0.18, 0.04, -d * 0.3)
      add(new THREE.BoxGeometry(w * 0.3, 0.06, d * 0.32), '#2f7fe0', -w * 0.18, 0.04 + height * 0.6, -d * 0.3)
      add(new THREE.CylinderGeometry(0.12, 0.16, height * 1.6, 8), accent, w * 0.08, 0.04, -d * 0.32)
      add(new THREE.CylinderGeometry(0.26, 0.2, 0.22, 8), '#6fb7e0', w * 0.08, 0.04 + height * 1.6, -d * 0.32)
      add(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 8), '#4a4f57', w * 0.08, 0.26 + height * 1.6, -d * 0.32)
      // A half cylinder, open end toward the runway.
      const hangar = new THREE.CylinderGeometry(0.5, 0.5, 1.1, 10, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2)
      add(hangar, '#b8bfc7', w * 0.33, 0.04, -d * 0.28)
      break
    }
    case 'playground': {
      // Soft ground, a slide, a swing frame, a sandbox and a seesaw.
      add(new THREE.BoxGeometry(w * 0.95, 0.03, d * 0.95), '#e8c9a0', 0, 0, 0)
      add(new THREE.BoxGeometry(0.16, 0.42, 0.16), accent, -0.45, 0.03, -0.45)
      add(new THREE.BoxGeometry(0.16, 0.04, 0.6).rotateX(0.6), '#ffd23f', -0.45, 0.12, -0.12)
      for (const x of [0.15, 0.75]) add(new THREE.BoxGeometry(0.04, 0.5, 0.04), '#2f7fe0', x, 0.03, -0.5)
      add(new THREE.BoxGeometry(0.66, 0.04, 0.04), '#2f7fe0', 0.45, 0.53, -0.5)
      for (const x of [0.32, 0.58]) add(new THREE.BoxGeometry(0.1, 0.02, 0.06), '#e0453a', x, 0.18, -0.5)
      add(new THREE.BoxGeometry(0.55, 0.06, 0.55), '#f6e3a4', -0.4, 0.03, 0.4)
      add(new THREE.BoxGeometry(0.7, 0.03, 0.08).rotateZ(0.15), '#3fae6b', 0.45, 0.12, 0.45)
      add(new THREE.BoxGeometry(0.08, 0.1, 0.08), '#8a5a36', 0.45, 0.03, 0.45)
      break
    }
    case 'sportsfield': {
      // A pitch with white lines and a goal at each end, and a little stand.
      add(new THREE.BoxGeometry(w * 0.95, 0.03, d * 0.75), color, 0, 0, 0.1)
      for (const x of [-w * 0.45, 0, w * 0.45]) add(new THREE.BoxGeometry(0.03, 0.005, d * 0.72), accent, x, 0.03, 0.1)
      for (const z of [-d * 0.26, d * 0.46]) add(new THREE.BoxGeometry(w * 0.9, 0.005, 0.03), accent, 0, 0.03, z)
      add(new THREE.TorusGeometry(0.3, 0.012, 4, 24).rotateX(Math.PI / 2), accent, 0, 0.035, 0.1)
      for (const end of [-1, 1]) {
        add(new THREE.BoxGeometry(0.04, 0.22, 0.5), accent, end * w * 0.47, 0.03, 0.1)
      }
      add(new THREE.BoxGeometry(w * 0.6, 0.16, 0.3), '#c8463a', 0, 0, -d * 0.4)
      add(new THREE.BoxGeometry(w * 0.6, 0.12, 0.16), '#2f7fe0', 0, 0.16, -d * 0.45)
      break
    }
    case 'beach': {
      // Sand, two umbrellas over towels, and a lifeguard's chair.
      add(new THREE.BoxGeometry(w * 0.98, 0.03, d * 0.98), color, 0, 0, 0)
      for (const [x, c] of [[-0.8, accent], [0.35, '#2f7fe0']] as const) {
        add(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 6), '#ffffff', x, 0.03, -0.1)
        add(new THREE.ConeGeometry(0.32, 0.14, 8), c, x, 0.42, -0.1)
        add(new THREE.BoxGeometry(0.16, 0.01, 0.34), c === accent ? '#ffd23f' : '#ff7043', x + 0.2, 0.035, 0.05)
      }
      for (const [lx, lz] of [[-0.1, -0.1], [0.1, -0.1], [-0.1, 0.1], [0.1, 0.1]]) {
        add(new THREE.BoxGeometry(0.03, 0.5, 0.03), '#ffffff', w * 0.38 + lx, 0.03, lz)
      }
      add(new THREE.BoxGeometry(0.28, 0.04, 0.28), '#e0453a', w * 0.38, 0.53, 0)
      break
    }
    case 'bigpark': {
      // Lawns crossed by paths, a pond, a fountain in the middle, trees and flower beds.
      add(new THREE.BoxGeometry(w * 0.97, 0.03, d * 0.97), color, 0, 0, 0)
      add(new THREE.BoxGeometry(w * 0.95, 0.035, 0.32), accent, 0, 0, 0)
      add(new THREE.BoxGeometry(0.32, 0.035, d * 0.95), accent, 0, 0, 0)
      add(new THREE.CylinderGeometry(0.42, 0.45, 0.1, 16), '#c9c6bd', 0, 0.03, 0)
      add(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 16), '#6fb7e0', 0, 0.1, 0)
      add(new THREE.CylinderGeometry(0.05, 0.08, 0.3, 8), '#c9c6bd', 0, 0.1, 0)
      add(new THREE.CylinderGeometry(0.75, 0.75, 0.04, 20).scale(1.2, 1, 0.8), '#5aa8e0', 1.0, 0.03, 1.05)
      for (const [x, z, c] of [[-1.2, -1.2, '#3f8f3a'], [-1.3, -0.5, '#66bb4a'], [1.2, -1.2, '#f28cb1'], [-1.2, 1.2, '#3f8f3a'], [0.6, -1.3, '#66bb4a'], [-0.6, 1.3, '#f5a742']] as const) {
        add(new THREE.CylinderGeometry(0.05, 0.07, 0.35, 6), '#7a5233', x, 0.03, z)
        add(new THREE.IcosahedronGeometry(0.3, 0), c, x, 0.3, z)
      }
      for (const [x, z, c] of [[1.2, -0.5, '#ff5c8a'], [-0.5, -0.6, '#ffd23f'], [0.55, 0.55, '#b46cf0']] as const) {
        add(new THREE.CylinderGeometry(0.22, 0.24, 0.07, 10), c, x, 0.03, z)
      }
      break
    }
    case 'skiresort': {
      // A snowy peak (see SKI_SLOPE, which the skiers ride on), pine trees on
      // its lower slopes, a chairlift up one side and a red lodge at the foot.
      const { cx, cz, height: h, radius: r } = SKI_SLOPE
      add(new THREE.BoxGeometry(w * 0.97, 0.03, d * 0.97), '#e9f1f6', 0, 0, 0)
      add(new THREE.ConeGeometry(r, h, 9), color, cx, 0.03, cz)
      add(new THREE.ConeGeometry(r * 0.42, h * 0.42, 9), '#ffffff', cx, 0.03 + h * 0.58, cz)
      for (const [x, z] of [[1.3, -1.4], [-1.5, 1.3], [1.6, -0.6], [-0.7, 1.6], [0.5, -1.7]]) {
        add(new THREE.ConeGeometry(0.16, 0.45, 6), '#2e6b45', x, 0.03, z)
      }
      // Lift towers from the lodge up toward the peak.
      for (let i = 0; i <= 4; i++) {
        const t = i / 4
        const x = SKI_LIFT.from.x + (SKI_LIFT.to.x - SKI_LIFT.from.x) * t
        const z = SKI_LIFT.from.z + (SKI_LIFT.to.z - SKI_LIFT.from.z) * t
        add(new THREE.CylinderGeometry(0.02, 0.025, 0.45, 6), '#5b6570', x, slopeHeight(x, z), z)
      }
      add(new THREE.BoxGeometry(0.75, 0.38, 0.5), accent, 1.35, 0.03, 1.35)
      const roof = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4)
      roof.scale(0.85, 0.3, 0.6)
      add(roof, '#7a3a2a', 1.35, 0.41, 1.35)
      break
    }
    case 'pen': {
      // A fenced yard with a little shed at the back, a water trough and hay.
      // AnimalView keeps the animals in front of the shed (PEN_YARD).
      add(new THREE.BoxGeometry(w * 0.97, 0.03, d * 0.97), '#9cc46a', 0, 0, 0)
      for (const z of [-d * 0.46, d * 0.46]) add(new THREE.BoxGeometry(w * 0.94, 0.03, 0.03), accent, 0, 0.14, z)
      for (const x of [-w * 0.46, w * 0.46]) add(new THREE.BoxGeometry(0.03, 0.03, d * 0.94), accent, x, 0.14, 0)
      for (let x = -w * 0.46; x <= w * 0.46 + 0.01; x += w * 0.92 / Math.round(w * 2)) {
        for (const z of [-d * 0.46, d * 0.46]) add(new THREE.BoxGeometry(0.04, 0.2, 0.04), accent, x, 0.03, z)
      }
      for (let z = -d * 0.46; z <= d * 0.46 + 0.01; z += d * 0.92 / Math.round(d * 2)) {
        for (const x of [-w * 0.46, w * 0.46]) add(new THREE.BoxGeometry(0.04, 0.2, 0.04), accent, x, 0.03, z)
      }
      add(new THREE.BoxGeometry(0.62, height, 0.5), color, -w * 0.5 + 0.42, 0.03, -d * 0.5 + 0.36)
      const roof = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4)
      roof.scale(0.72, 0.28, 0.6)
      add(roof, '#7a3a2a', -w * 0.5 + 0.42, 0.03 + height, -d * 0.5 + 0.36)
      add(new THREE.BoxGeometry(0.4, 0.08, 0.12), '#8a8f96', w * 0.5 - 0.35, 0.03, -d * 0.5 + 0.2)
      add(new THREE.CylinderGeometry(0.13, 0.13, 0.16, 10).rotateZ(Math.PI / 2), '#e8c55a', w * 0.5 - 0.3, 0.03, d * 0.5 - 0.25)
      break
    }
    case 'barn': {
      // A red barn: walls, a steep two-sided roof (a 4-sided cone stretched long) and white trim.
      add(new THREE.BoxGeometry(w * 0.8, height * 0.6, d * 0.85), color, 0, 0, 0)
      const roof = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4)
      roof.scale(w * 0.9, height * 0.5, d * 0.95)
      add(roof, '#7a3a2a', 0, height * 0.6, 0)
      add(new THREE.BoxGeometry(0.5, height * 0.4, 0.02), accent, 0, 0, d * 0.425 + 0.01)
      break
    }
    case 'warehouse': {
      // A long grey shed with roller doors.
      add(new THREE.BoxGeometry(w * 0.9, height * 0.75, d * 0.8), color, 0, 0, 0)
      add(new THREE.BoxGeometry(w * 0.95, 0.06, d * 0.85), accent, 0, height * 0.75, 0)
      for (const x of [-0.8, 0, 0.8]) add(new THREE.BoxGeometry(0.55, height * 0.5, 0.02), accent, x, 0, d * 0.4 + 0.01)
      break
    }
    case 'dock': {
      // A concrete quay on a timber-edged base, with mooring bollards and
      // tyre fenders round its edges. The crane, containers and harbor office
      // are PortView's: they face whichever side the sea is on.
      add(new THREE.BoxGeometry(w, 0.08, d), '#6b4f36', 0, 0.04, 0)
      add(new THREE.BoxGeometry(w * 0.97, 0.08, d * 0.97), color, 0, 0.12, 0)
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(new THREE.BoxGeometry(0.12, 0.12, 0.12), '#5a4632', x * (w / 2 - 0.06), -0.04, z * (d / 2 - 0.06))
      const bollard = () => new THREE.CylinderGeometry(0.035, 0.045, 0.08, 8)
      const fender = () => new THREE.CylinderGeometry(0.05, 0.05, 0.05, 8).rotateZ(Math.PI / 2)
      for (const side of [-1, 1]) {
        for (let i = 0; i < w; i++) {
          const x = -w / 2 + 0.5 + i
          add(bollard(), '#2b2d33', x, 0.2, side * (d / 2 - 0.08))
          add(fender().rotateY(Math.PI / 2), '#1d1d1f', x + 0.25, 0.07, side * (d / 2 + 0.02))
        }
        for (let i = 0; i < d; i++) {
          const z = -d / 2 + 0.5 + i
          add(bollard(), '#2b2d33', side * (w / 2 - 0.08), 0.2, z)
          add(fender(), '#1d1d1f', side * (w / 2 + 0.02), 0.07, z + 0.25)
        }
      }
      // Painted safety lines inset from the edge.
      add(new THREE.BoxGeometry(w * 0.9, 0.005, 0.03), accent, 0, 0.2, d * 0.38)
      add(new THREE.BoxGeometry(w * 0.9, 0.005, 0.03), accent, 0, 0.2, -d * 0.38)
      break
    }
    case 'flowers': {
      // A soil bed with a cluster of blooms.
      add(new THREE.BoxGeometry(w * 0.8, 0.08, d * 0.8), color, 0, 0, 0)
      const blooms = ['#e8579a', '#f2d23c', '#ffffff', '#9b59b6', '#e0553f']
      blooms.forEach((c, i) => {
        const a = (i / blooms.length) * Math.PI * 2
        add(new THREE.IcosahedronGeometry(0.09, 0), c, Math.cos(a) * 0.2, 0.08, Math.sin(a) * 0.2)
      })
      add(new THREE.IcosahedronGeometry(0.11, 0), '#3f8f3a', 0, 0.08, 0)
      break
    }
    case 'bench': {
      // A slatted seat with a back (also stands in for a fence if its model fails).
      add(new THREE.BoxGeometry(w * 0.8, 0.05, d * 0.3), color, 0, height * 0.6, 0)
      add(new THREE.BoxGeometry(w * 0.8, height * 0.6, 0.04), color, 0, height * 0.6, -d * 0.15)
      for (const x of [-0.3, 0.3]) add(new THREE.BoxGeometry(0.05, height * 0.6, d * 0.3), accent, x * w, 0, 0)
      break
    }
    case 'fountain': {
      // A round stone basin, water, and a tiered spout.
      add(new THREE.CylinderGeometry(w * 0.42, w * 0.46, 0.18, 16), color, 0, 0, 0)
      add(new THREE.CylinderGeometry(w * 0.37, w * 0.37, 0.04, 16), accent, 0, 0.16, 0)
      add(new THREE.CylinderGeometry(0.08, 0.12, height * 0.6, 8), color, 0, 0.16, 0)
      add(new THREE.CylinderGeometry(0.22, 0.18, 0.06, 12), color, 0, 0.16 + height * 0.6, 0)
      add(new THREE.IcosahedronGeometry(0.1, 1), accent, 0, 0.22 + height * 0.6, 0)
      break
    }
    case 'statue': {
      // A plinth with a figure on top.
      add(new THREE.BoxGeometry(0.5, height * 0.35, 0.5), color, 0, 0, 0)
      add(new THREE.CylinderGeometry(0.1, 0.14, height * 0.4, 8), accent, 0, height * 0.35, 0)
      add(new THREE.IcosahedronGeometry(0.1, 1), accent, 0, height * 0.75, 0)
      break
    }
    case 'library': {
      // A classical front: steps, columns and a pediment.
      add(new THREE.BoxGeometry(w * 0.85, height * 0.7, d * 0.6), color, 0, 0, -d * 0.1)
      add(new THREE.BoxGeometry(w * 0.9, 0.08, d * 0.3), color, 0, 0, d * 0.32)
      for (const x of [-0.6, -0.2, 0.2, 0.6]) add(new THREE.CylinderGeometry(0.06, 0.06, height * 0.62, 8), '#f2ede2', x, 0.08, d * 0.32)
      const roof = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4)
      roof.scale(w * 0.95, height * 0.3, d * 0.95)
      add(roof, accent, 0, height * 0.7, 0)
      break
    }
    case 'townhall': {
      // A wide hall with a clock tower.
      add(new THREE.BoxGeometry(w * 0.85, height * 0.55, d * 0.7), color, 0, 0, 0)
      add(new THREE.BoxGeometry(w * 0.9, 0.08, d * 0.75), accent, 0, height * 0.55, 0)
      add(new THREE.BoxGeometry(0.6, height * 0.6, 0.6), color, 0, height * 0.55, 0)
      add(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 16).rotateX(Math.PI / 2), '#ffffff', 0, height * 0.9, 0.31)
      add(new THREE.ConeGeometry(0.45, 0.4, 4).rotateY(Math.PI / 4), accent, 0, height * 1.15, 0)
      break
    }
    case 'clocktower': {
      // A tall square tower with a clock face on each visible side and a spire.
      add(new THREE.BoxGeometry(w * 0.6, height * 0.75, d * 0.6), color, 0, 0, 0)
      for (const [x, z, ry] of [[0, d * 0.3 + 0.01, 0], [w * 0.3 + 0.01, 0, Math.PI / 2]] as const) {
        const face = new THREE.CylinderGeometry(0.28, 0.28, 0.03, 20).rotateX(Math.PI / 2).rotateY(ry)
        add(face, '#ffffff', x, height * 0.55, z)
      }
      add(new THREE.BoxGeometry(w * 0.66, 0.1, d * 0.66), accent, 0, height * 0.75, 0)
      add(new THREE.ConeGeometry(w * 0.42, height * 0.35, 4).rotateY(Math.PI / 4), accent, 0, height * 0.75 + 0.1, 0)
      break
    }
    case 'lighthouse': {
      // A striped tapering tower with a lamp room on top.
      for (let i = 0; i < 4; i++) {
        const r0 = 0.5 - i * 0.07
        add(new THREE.CylinderGeometry(r0 - 0.07, r0, height * 0.18, 16), i % 2 ? accent : color, 0, i * height * 0.18, 0)
      }
      add(new THREE.CylinderGeometry(0.26, 0.26, height * 0.12, 16), '#ffe9a3', 0, height * 0.72, 0)
      add(new THREE.ConeGeometry(0.32, height * 0.14, 16), accent, 0, height * 0.84, 0)
      break
    }
    case 'garden': {
      // Lawns and paths around a glasshouse.
      add(new THREE.BoxGeometry(w * 0.95, 0.05, d * 0.95), color, 0, 0, 0)
      add(new THREE.BoxGeometry(w * 0.95, 0.055, 0.35), '#d9c79a', 0, 0, 0)
      add(new THREE.BoxGeometry(0.35, 0.055, d * 0.95), '#d9c79a', 0, 0, 0)
      add(new THREE.BoxGeometry(w * 0.5, height * 0.5, d * 0.4), accent, 0, 0.05, -d * 0.2)
      add(new THREE.CylinderGeometry(w * 0.25, w * 0.25, d * 0.4, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), accent, 0, 0.05 + height * 0.5, -d * 0.2)
      for (const [x, z] of [[-1, 1], [1, 1]]) add(new THREE.IcosahedronGeometry(0.35, 0), '#3f8f3a', x * w * 0.3, 0.05, z * d * 0.3)
      break
    }
    case 'apartment': {
      // A tall block: floors of windows, a parapet, a door and rooftop units.
      add(new THREE.BoxGeometry(w * 0.82, height, d * 0.82), color, 0, 0, 0)
      const floors = Math.max(3, Math.round(height / 0.36))
      for (let f = 0; f < floors; f++) {
        const y = 0.12 + (f * (height - 0.2)) / floors
        for (const x of [-0.45, -0.15, 0.15, 0.45]) {
          add(new THREE.BoxGeometry(0.16, 0.16, 0.02), '#9cc8e8', x * w * 0.9, y, d * 0.41 + 0.005)
          add(new THREE.BoxGeometry(0.02, 0.16, 0.16), '#9cc8e8', w * 0.41 + 0.005, y, x * d * 0.9)
        }
        add(new THREE.BoxGeometry(w * 0.84, 0.03, d * 0.84), accent, 0, y - 0.05, 0)
      }
      add(new THREE.BoxGeometry(0.24, 0.3, 0.03), accent, 0, 0, d * 0.41 + 0.01)
      add(new THREE.BoxGeometry(w * 0.86, 0.08, d * 0.86), accent, 0, height, 0)
      add(new THREE.BoxGeometry(0.3, 0.16, 0.24), '#9aa0a8', -0.25, height + 0.08, -0.2)
      break
    }
    case 'hospital': {
      // A white main wing with a taller center block, a red cross and a canopy.
      add(new THREE.BoxGeometry(w * 0.9, height * 0.5, d * 0.7), color, 0, 0, -d * 0.05)
      add(new THREE.BoxGeometry(w * 0.4, height, d * 0.5), color, 0, 0, -d * 0.1)
      for (const [x, y, z, sx, sy] of [[0, height * 0.72, d * 0.15 + 0.01, 0.36, 0.1], [0, height * 0.72, d * 0.15 + 0.01, 0.1, 0.36]] as const) {
        add(new THREE.BoxGeometry(sx, sy, 0.03), accent, x, y - sy / 2, z)
      }
      add(new THREE.BoxGeometry(w * 0.3, 0.05, d * 0.25), '#dddddd', 0, height * 0.28, d * 0.4)
      for (const x of [-0.18, 0.18]) add(new THREE.CylinderGeometry(0.025, 0.025, height * 0.28, 6), '#dddddd', x * w, 0, d * 0.5)
      for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(0.14, 0.12, 0.02), '#9cc8e8', (-0.4 + i * 0.16) * w, height * 0.25, d * 0.3 + 0.01)
      break
    }
    case 'police': {
      // A blue-trimmed station with a flag and a light bar over the door.
      add(new THREE.BoxGeometry(w * 0.85, height * 0.7, d * 0.75), color, 0, 0, 0)
      add(new THREE.BoxGeometry(w * 0.9, 0.12, d * 0.8), accent, 0, height * 0.7, 0)
      add(new THREE.BoxGeometry(w * 0.85 + 0.02, 0.1, d * 0.75 + 0.02), accent, 0, height * 0.3, 0)
      add(new THREE.BoxGeometry(0.3, 0.38, 0.03), '#2a3a5a', 0, 0, d * 0.375 + 0.01)
      add(new THREE.BoxGeometry(0.1, 0.05, 0.05), '#e0383e', -0.06, 0.42, d * 0.4)
      add(new THREE.BoxGeometry(0.1, 0.05, 0.05), '#2f7fe0', 0.06, 0.42, d * 0.4)
      add(new THREE.CylinderGeometry(0.015, 0.015, height * 0.9, 6), '#cccccc', w * 0.35, height * 0.82, d * 0.2)
      add(new THREE.BoxGeometry(0.22, 0.13, 0.01), accent, w * 0.35 + 0.11, height * 1.55, d * 0.2)
      break
    }
    case 'mall': {
      // A long low hall with a glass front, an entrance tower and a sign.
      add(new THREE.BoxGeometry(w * 0.92, height * 0.6, d * 0.8), color, 0, 0, 0)
      add(new THREE.BoxGeometry(w * 0.8, height * 0.4, 0.02), '#9cc8e8', 0, 0.05, d * 0.4 + 0.01)
      add(new THREE.BoxGeometry(w * 0.25, height, d * 0.3), accent, 0, 0, d * 0.28)
      add(new THREE.BoxGeometry(w * 0.3, 0.16, 0.04), '#ffffff', 0, height * 0.75, d * 0.44)
      add(new THREE.BoxGeometry(w * 0.94, 0.06, d * 0.82), '#d9cbb0', 0, height * 0.6, 0)
      break
    }
    case 'lamp': {
      // A street lamp with a glowing head.
      add(new THREE.CylinderGeometry(0.05, 0.07, 0.06, 8), color, 0, 0, 0)
      add(new THREE.CylinderGeometry(0.025, 0.03, height, 8), color, 0, 0.06, 0)
      const glass = add(new THREE.IcosahedronGeometry(0.08, 1), accent, 0, height + 0.02, 0)
      ;(glass.material as THREE.MeshStandardMaterial).emissive.set(accent)
      add(new THREE.ConeGeometry(0.1, 0.06, 8), color, 0, height + 0.15, 0)
      break
    }
    case 'hedge': {
      // A clipped box hedge.
      add(new THREE.BoxGeometry(0.85, height, 0.5), color, 0, 0, 0)
      add(new THREE.BoxGeometry(0.8, 0.04, 0.45), accent, 0, height, 0)
      break
    }
    case 'gazebo': {
      // An octagonal floor, posts, and a peaked roof.
      add(new THREE.CylinderGeometry(w * 0.4, w * 0.42, 0.08, 8), '#d9c79a', 0, 0, 0)
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        add(new THREE.CylinderGeometry(0.03, 0.03, height * 0.6, 6), color, Math.cos(a) * w * 0.36, 0.08, Math.sin(a) * w * 0.36)
      }
      add(new THREE.ConeGeometry(w * 0.5, height * 0.4, 8), accent, 0, 0.08 + height * 0.6, 0)
      break
    }
    case 'pond': {
      // Water in a ring of stones, with reeds and a duck.
      add(new THREE.CylinderGeometry(w * 0.44, w * 0.46, 0.06, 16), accent, 0, 0, 0)
      add(new THREE.CylinderGeometry(w * 0.38, w * 0.38, 0.03, 16), color, 0, 0.05, 0)
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2
        add(new THREE.IcosahedronGeometry(0.07, 0), '#a7a7a0', Math.cos(a) * w * 0.43, 0.02, Math.sin(a) * w * 0.43)
      }
      for (const [x, z] of [[-0.5, -0.3], [-0.45, -0.4], [0.5, 0.35]]) add(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 4), '#5d8a3a', x, 0.05, z)
      add(new THREE.SphereGeometry(0.07, 8, 6).scale(1.3, 0.8, 1), '#ffffff', 0.15, 0.08, 0.1)
      add(new THREE.SphereGeometry(0.04, 8, 6), '#3f8f3a', 0.24, 0.15, 0.1)
      add(new THREE.ConeGeometry(0.02, 0.05, 6).rotateZ(-Math.PI / 2), '#f2a33a', 0.3, 0.15, 0.1)
      break
    }
    case 'factory': {
      // A brick hall with a sawtooth roof, a chimney, and loading doors.
      add(new THREE.BoxGeometry(w * 0.88, height * 0.6, d * 0.8), color, 0, 0, 0)
      const teeth = Math.max(2, Math.round(w * 1.2))
      for (let i = 0; i < teeth; i++) {
        const x = -w * 0.44 + (i + 0.5) * ((w * 0.88) / teeth)
        const tooth = new THREE.CylinderGeometry(0.01, (w * 0.88) / teeth / Math.SQRT2, d * 0.8, 3, 1).rotateX(Math.PI / 2).rotateZ(Math.PI / 6)
        add(tooth, accent, x, height * 0.6, 0)
      }
      add(new THREE.CylinderGeometry(0.12, 0.16, height * 0.9, 10), '#8a4a3a', w * 0.3, height * 0.6, -d * 0.25)
      add(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 10), '#5a3a30', w * 0.3, height * 1.5, -d * 0.25)
      for (const x of [-0.35, 0.35]) add(new THREE.BoxGeometry(0.4, height * 0.4, 0.04), '#6b6f78', x * w * 0.6, 0, d * 0.4)
      break
    }
    case 'arch': {
      // Two white posts and a curved arch, covered in blossom.
      for (const x of [-0.7, 0.7]) add(new THREE.BoxGeometry(0.12, height * 0.7, 0.12), color, x, 0, 0)
      const arc = new THREE.TorusGeometry(0.7, 0.06, 6, 16, Math.PI)
      add(arc, color, 0, height * 0.7 - 0.06, 0)
      for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * Math.PI
        add(new THREE.IcosahedronGeometry(0.11, 0), i % 2 ? accent : '#ffd6e5', Math.cos(a) * 0.7, height * 0.7 + Math.sin(a) * 0.7 - 0.06, 0)
      }
      for (const x of [-0.7, 0.7]) add(new THREE.IcosahedronGeometry(0.16, 0), '#3f8f3a', x, 0, 0.12)
      break
    }
    case 'cart': {
      // A little cart: wheels, a counter, an umbrella and a cone on top.
      for (const x of [-0.22, 0.22]) add(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 12).rotateX(Math.PI / 2), '#444444', x, 0, 0.2)
      add(new THREE.BoxGeometry(0.6, height * 0.4, 0.4), color, 0, 0.08, 0)
      add(new THREE.CylinderGeometry(0.015, 0.015, height * 0.55, 6), '#dddddd', 0, 0.08 + height * 0.4, 0)
      add(new THREE.ConeGeometry(0.42, 0.18, 10), accent, 0, 0.08 + height * 0.95, 0)
      add(new THREE.ConeGeometry(0.06, 0.14, 8).rotateX(Math.PI), '#e8b86a', 0.15, 0.08 + height * 0.4, 0)
      add(new THREE.IcosahedronGeometry(0.06, 1), '#fff5e6', 0.15, 0.22 + height * 0.4, 0)
      break
    }
    case 'pumpkins': {
      // A soil patch of round pumpkins, and a scarecrow keeping watch.
      add(new THREE.BoxGeometry(w * 0.9, 0.06, d * 0.8), color, 0, 0, 0)
      for (const [x, z, r] of [[-0.6, -0.15, 0.17], [-0.25, 0.18, 0.13], [0.1, -0.12, 0.19], [0.55, 0.15, 0.14], [0.35, -0.2, 0.11]]) {
        add(new THREE.SphereGeometry(r, 10, 6).scale(1, 0.75, 1), accent, x, 0.06, z)
        add(new THREE.CylinderGeometry(0.02, 0.025, 0.06, 5), '#3f8f3a', x, 0.06 + r * 1.45, z)
      }
      add(new THREE.CylinderGeometry(0.025, 0.025, height, 5), '#8a5a36', -0.05, 0.06, 0.25)
      add(new THREE.BoxGeometry(0.42, 0.04, 0.04), '#8a5a36', -0.05, 0.06 + height * 0.7, 0.25)
      add(new THREE.BoxGeometry(0.18, 0.22, 0.1), '#c94d3f', -0.05, 0.06 + height * 0.55, 0.25)
      add(new THREE.IcosahedronGeometry(0.08, 0), '#e8c98a', -0.05, 0.06 + height * 0.82, 0.25)
      add(new THREE.ConeGeometry(0.12, 0.1, 8), '#d9b44a', -0.05, 0.06 + height * 0.93, 0.25)
      break
    }
    case 'fir': {
      // A fir in three tiers, hung with lights, a star on top.
      add(new THREE.CylinderGeometry(0.06, 0.08, height * 0.15, 6), '#8a5a36', 0, 0, 0)
      for (let i = 0; i < 3; i++) add(new THREE.ConeGeometry(0.42 - i * 0.1, height * 0.35, 8), color, 0, height * (0.12 + i * 0.22), 0)
      const lights = ['#ff5c5c', '#ffd23f', '#4fc3f7', '#ffffff', '#b46cf0']
      for (let i = 0; i < 14; i++) {
        const y = 0.15 + (i / 14) * 0.65
        const r = 0.4 * (1 - (i / 14) * 0.8)
        const a = i * 2.3
        const bulb = add(new THREE.IcosahedronGeometry(0.035, 0), lights[i % lights.length], Math.cos(a) * r, height * y, Math.sin(a) * r)
        ;(bulb.material as THREE.MeshStandardMaterial).emissive.set(lights[i % lights.length])
      }
      const star = add(new THREE.OctahedronGeometry(0.09, 0), accent, 0, height * 0.88, 0)
      ;(star.material as THREE.MeshStandardMaterial).emissive.set(accent)
      break
    }
    case 'tree': {
      add(new THREE.CylinderGeometry(0.07, 0.09, height * 0.4, 6), color, 0, 0, 0)
      add(new THREE.IcosahedronGeometry(0.38, 0), accent, 0, height * 0.35, 0)
      break
    }
  }
  group.userData.ownsResources = true
  return mergeByLook(group)
}

// Merge a placeholder's parts into one mesh per look (color and glow): a
// building then costs a few draw calls instead of dozens, which matters on
// phones. Each part's position is baked into its shape first. Anything that
// can't be merged (a nested group, mismatched shapes) is left as it was.
function mergeByLook(group: THREE.Group): THREE.Group {
  const byLook = new Map<string, { material: THREE.MeshStandardMaterial; parts: THREE.Mesh[] }>()
  for (const child of group.children) {
    if (!(child instanceof THREE.Mesh) || !(child.material instanceof THREE.MeshStandardMaterial)) continue
    const m = child.material
    const key = `${m.color.getHexString()}/${m.emissive.getHexString()}`
    const entry = byLook.get(key) ?? { material: m, parts: [] }
    entry.parts.push(child)
    byLook.set(key, entry)
  }
  for (const { material, parts } of byLook.values()) {
    if (parts.length < 2) continue
    const shapes = parts.map((part) => {
      part.updateMatrix()
      const shape = (part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone()).applyMatrix4(part.matrix)
      for (const name of Object.keys(shape.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') shape.deleteAttribute(name)
      return shape
    })
    const merged = mergeGeometries(shapes)
    for (const shape of shapes) shape.dispose()
    if (!merged) continue
    for (const part of parts) {
      group.remove(part)
      part.geometry.dispose()
      if (part.material !== material) (part.material as THREE.Material).dispose()
    }
    group.add(new THREE.Mesh(merged, material))
  }
  return group
}

// ---- Construction sites ----

// What a building looks like while it's being built: a dirt pad, a half-built
// grey shell inside a timber frame, and a couple of traffic cones.
export function createConstructionSite(type: BuildingType): THREE.Group {
  const w = type.size.x
  const d = type.size.z
  const group = new THREE.Group()
  group.userData.ownsResources = true
  const add = (geometry: THREE.BufferGeometry, color: string, x: number, y: number, z: number) => {
    geometry.computeBoundingBox()
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, flatShading: true }))
    mesh.position.set(x, y - geometry.boundingBox!.min.y, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
  }
  add(new THREE.BoxGeometry(w * 0.95, 0.04, d * 0.95), '#9b7a52', 0, 0, 0)
  add(new THREE.BoxGeometry(w * 0.6, 0.35, d * 0.6), '#b8b2a7', 0, 0.04, 0)
  const h = 0.9
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    add(new THREE.BoxGeometry(0.06, h, 0.06), '#d9a85e', (x * w * 0.38), 0.04, (z * d * 0.38))
  }
  add(new THREE.BoxGeometry(w * 0.8, 0.05, 0.06), '#d9a85e', 0, h, -d * 0.38)
  add(new THREE.BoxGeometry(w * 0.8, 0.05, 0.06), '#d9a85e', 0, h, d * 0.38)
  add(new THREE.ConeGeometry(0.07, 0.18, 8), '#f07a2a', w * 0.42, 0.04, d * 0.45)
  add(new THREE.ConeGeometry(0.07, 0.18, 8), '#f07a2a', -w * 0.42, 0.04, d * 0.45)
  // A tower crane at the back corner. Its jib (named, so CityView can turn
  // it) swings slowly round with a load hanging from it.
  const mast = Math.max(w, d) * 0.55 + 0.6
  add(new THREE.BoxGeometry(0.08, mast, 0.08), '#f2c230', -w * 0.4, 0.04, -d * 0.4)
  const jib = new THREE.Group()
  jib.name = 'crane-jib'
  jib.position.set(-w * 0.4, 0.04 + mast, -d * 0.4)
  for (const [geometry, color, x, y] of [
    [new THREE.BoxGeometry(Math.max(w, d) * 0.9, 0.06, 0.06), '#f2c230', Math.max(w, d) * 0.3, 0.03],
    [new THREE.BoxGeometry(0.2, 0.12, 0.12), '#5d6168', -0.15, 0.06],
    [new THREE.BoxGeometry(0.012, 0.4, 0.012), '#2b2d33', Math.max(w, d) * 0.6, -0.2],
    [new THREE.BoxGeometry(0.12, 0.08, 0.12), '#b5432f', Math.max(w, d) * 0.6, -0.44],
  ] as const) {
    const m = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, flatShading: true }))
    m.position.set(x, y, 0)
    m.castShadow = true
    jib.add(m)
  }
  group.add(jib)
  return group
}

// ---- Crops ----
//
// A plot of crops is dozens of little plants, each made of a few shapes. As
// separate meshes that would be hundreds of draw calls per field. Instead we
// build every shape in place, then merge all shapes of the same color into one
// geometry: a whole plot becomes 2–4 meshes, however many plants it has.

// The height of a plot's soil, where crops are planted.
export const SOIL_HEIGHT = 0.06

// How a crop looks right now. Growing crops pass through three looks.
export type CropLook = 'sprout' | 'young' | 'grown' | 'ripe' | 'withered'

export function cropLookFor(state: Exclude<CropState, { stage: 'empty' }>): CropLook {
  if (state.stage !== 'growing') return state.stage
  return state.progress < 0.3 ? 'sprout' : state.progress < 0.7 ? 'young' : 'grown'
}

// Unit shapes every crop is built from: each sits on y = 0, 1 unit wide and tall.
const SHAPES = {
  cone: new THREE.ConeGeometry(0.5, 1, 5).translate(0, 0.5, 0).toNonIndexed(),
  ball: new THREE.IcosahedronGeometry(0.5, 0).translate(0, 0.5, 0),
  stem: new THREE.CylinderGeometry(0.5, 0.5, 1, 5).translate(0, 0.5, 0).toNonIndexed(),
}

const WITHERED = { leaf: '#8b7a4e', fruit: '#6e5a3a' }
const SUNFLOWER_CENTER = '#5a3a1a'

// Shared by every crop, one per color, so there are only ever a handful.
const cropMaterials = new Map<string, THREE.MeshStandardMaterial>()
function cropMaterial(color: string) {
  let material = cropMaterials.get(color)
  if (!material) {
    material = new THREE.MeshStandardMaterial({ color, flatShading: true })
    cropMaterials.set(color, material)
  }
  return material
}

export function createCropObject(crop: CropType, look: CropLook, size: { x: number; z: number }): THREE.Group {
  const { shape, height: h, perTile } = crop.look
  const leaf = look === 'withered' ? WITHERED.leaf : crop.look.leaf
  const fruit = look === 'withered' ? WITHERED.fruit : crop.look.fruit
  const ripe = look === 'ripe'
  const k = { sprout: 0, young: 0.55, grown: 0.85, ripe: 1, withered: 0.8 }[look]

  // Shapes waiting to be merged, grouped by color.
  const byColor = new Map<string, THREE.BufferGeometry[]>()
  const plant = new THREE.Matrix4() // where the current plant stands
  const local = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const euler = new THREE.Euler()

  // Put a unit shape at (x, y, z) relative to the current plant, scaled and optionally tilted.
  const part = (kind: keyof typeof SHAPES, color: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, tiltX = 0, tiltZ = 0) => {
    q.setFromEuler(euler.set(tiltX, 0, tiltZ))
    local.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz))
    const geometry = SHAPES[kind].clone().applyMatrix4(local.premultiply(plant))
    let list = byColor.get(color)
    if (!list) byColor.set(color, (list = []))
    list.push(geometry)
  }

  const nx = size.x * perTile
  const nz = size.z * perTile
  let i = 0
  for (let ix = 0; ix < nx; ix++) {
    for (let iz = 0; iz < nz; iz++, i++) {
      const x = -size.x * 0.45 + (ix + 0.5) * ((size.x * 0.9) / nx)
      const z = -size.z * 0.45 + (iz + 0.5) * ((size.z * 0.9) / nz)
      // Turn each plant a different amount (the golden angle) so the rows don't look stamped out.
      const turn = i * 2.4
      // Withered plants droop sideways.
      const droop = look === 'withered' ? 0.45 : 0
      plant.compose(new THREE.Vector3(x, SOIL_HEIGHT, z), q.setFromEuler(euler.set(0, turn, droop)), new THREE.Vector3(1, 1, 1))

      if (look === 'sprout') {
        // Every crop starts as the same two little leaves.
        part('cone', crop.look.leaf, -0.02, 0, 0, 0.05, 0.09, 0.05, 0, 0.4)
        part('cone', crop.look.leaf, 0.02, 0, 0, 0.05, 0.09, 0.05, 0, -0.4)
        continue
      }

      switch (shape) {
        case 'bush':
          part('ball', leaf, 0, 0, 0, 0.26 * k, h * k, 0.26 * k)
          if (ripe) {
            // Fruit poking out around the leaves (strawberries), or lying on the soil (potatoes).
            for (let f = 0; f < 3; f++) {
              const a = f * 2.1
              part('ball', fruit, Math.cos(a) * 0.14, h * 0.1, Math.sin(a) * 0.14, 0.09, 0.08, 0.09)
            }
          }
          break
        case 'stalk':
          // Green while growing, golden when ripe (wheat).
          for (const [dx, dz] of [[-0.05, 0], [0.05, 0.03], [0, -0.05]]) {
            part('cone', ripe ? fruit : leaf, dx, 0, dz, 0.06, h * k, 0.06)
          }
          break
        case 'cob':
          // Stays green; cobs appear on the stalks when ripe (corn).
          for (const [dx, dz] of [[-0.05, 0], [0.05, 0.03], [0, -0.05]]) {
            part('cone', leaf, dx, 0, dz, 0.07, h * k, 0.07)
            if (ripe) part('ball', fruit, dx + 0.03, h * 0.4, dz, 0.05, 0.13, 0.05)
          }
          break
        case 'vine':
          // Broad low leaves around a big fruit (pumpkins).
          for (let f = 0; f < 3; f++) {
            const a = f * 2.1 + 0.5
            part('ball', leaf, Math.cos(a) * 0.16, 0, Math.sin(a) * 0.16, 0.24 * k, 0.07, 0.24 * k)
          }
          if (ripe) part('ball', fruit, 0, 0, 0, 0.3, h, 0.3)
          break
        case 'flower':
          // A stem, two leaves and, when ripe, a big head facing the camera (sunflowers).
          part('stem', leaf, 0, 0, 0, 0.035, h * k, 0.035)
          part('ball', leaf, 0.06, h * k * 0.4, 0, 0.12 * k, 0.03, 0.06 * k)
          part('ball', leaf, -0.06, h * k * 0.55, 0, 0.12 * k, 0.03, 0.06 * k)
          if (ripe) {
            part('ball', fruit, 0, h, 0.02, 0.2, 0.05, 0.2, 0.9)
            part('ball', SUNFLOWER_CENTER, 0, h + 0.005, 0.045, 0.1, 0.04, 0.1, 0.9)
          } else if (look !== 'withered') {
            part('ball', leaf, 0, h * k, 0, 0.07, 0.07, 0.07) // a closed bud
          }
          break
      }
    }
  }

  const group = new THREE.Group()
  for (const [color, geometries] of byColor) {
    const mesh = new THREE.Mesh(mergeGeometries(geometries), cropMaterial(color))
    mesh.castShadow = true
    group.add(mesh)
    for (const g of geometries) g.dispose()
  }
  return group
}

// Crop geometries are unique to each plot, so free them when the crop changes.
// (The materials are shared and stay.)
// Free what a building's object owns: a simple-shape building's or a
// construction site's shapes and materials. A model's are shared by every
// copy, so they're kept.
export function disposeBuildingObject(obj: THREE.Object3D) {
  obj.traverse((o) => {
    if (!o.userData.ownsResources) return
    o.traverse((part) => {
      if (!(part instanceof THREE.Mesh)) return
      part.geometry.dispose()
      for (const m of Array.isArray(part.material) ? part.material : [part.material]) m.dispose()
    })
  })
}

export function disposeCropObject(obj: THREE.Object3D) {
  obj.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose()
  })
}
