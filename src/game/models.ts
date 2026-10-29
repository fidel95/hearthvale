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

function loadModel(url: string): Promise<THREE.Object3D> {
  let model = modelCache.get(url)
  if (!model) {
    model = loader.loadAsync(url).then((gltf) => gltf.scene)
    modelCache.set(url, model)
  }
  return model
}

// Builds the 3D object for a building. Its origin is the center of the
// footprint at ground level. Models load in the background, so this returns
// an empty group right away and fills it in once the model is ready.
// overrideMaterial replaces every material, used for the see-through placement ghost.
export function createBuildingObject(type: BuildingType, overrideMaterial?: THREE.Material): THREE.Group {
  const group = new THREE.Group()

  const fill = (content: THREE.Object3D) => {
    content.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      obj.castShadow = !overrideMaterial
      obj.receiveShadow = !overrideMaterial
      if (overrideMaterial) obj.material = overrideMaterial
    })
    group.add(content)
  }

  if (type.model) {
    loadModel(type.model)
      .then((model) => fill(fitToFootprint(model.clone(), type)))
      .catch((err) => {
        console.warn(`Couldn't load ${type.model}, using placeholder`, err)
        fill(createPlaceholder(type))
      })
  } else {
    fill(createPlaceholder(type))
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
  const maxHeight = Math.max(type.size.x, type.size.z) * MAX_HEIGHT_PER_TILE
  const scale = Math.min((type.size.x / size.x) * 0.9, (type.size.z / size.z) * 0.9, maxHeight / size.y)

  const wrapper = new THREE.Group()
  wrapper.add(model)
  wrapper.scale.setScalar(scale)
  return wrapper
}

// Simple shapes so the game is playable before any art exists.
// (Their geometries aren't freed on demolish; they're tiny, and real models replace them.)
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
      // A wooden deck on posts, crates, and a yellow crane for unloading ships.
      add(new THREE.BoxGeometry(w * 0.95, 0.1, d * 0.95), color, 0, 0.1, 0)
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(new THREE.BoxGeometry(0.1, 0.12, 0.1), '#5a4632', x * w * 0.43, 0, z * d * 0.43)
      add(new THREE.BoxGeometry(0.3, 0.25, 0.3), '#b88a5a', -w * 0.3, 0.2, -d * 0.2)
      add(new THREE.BoxGeometry(0.3, 0.25, 0.3), '#3f7fe0', -w * 0.3 + 0.35, 0.2, -d * 0.2)
      add(new THREE.BoxGeometry(0.12, height * 1.6, 0.12), accent, w * 0.3, 0.2, 0)
      add(new THREE.BoxGeometry(0.08, 0.08, d * 0.9), accent, w * 0.3, 0.2 + height * 1.6, d * 0.25)
      break
    }
    case 'tree': {
      add(new THREE.CylinderGeometry(0.07, 0.09, height * 0.4, 6), color, 0, 0, 0)
      add(new THREE.IcosahedronGeometry(0.38, 0), accent, 0, height * 0.35, 0)
      break
    }
  }
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
export function disposeCropObject(obj: THREE.Object3D) {
  obj.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose()
  })
}
