import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { BuildingType } from './buildings'

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
      add(new THREE.BoxGeometry(w * 0.95, 0.06, d * 0.95), color, 0, 0, 0)
      const rows = w * 3
      for (let i = 0; i < rows; i++) {
        const x = -w * 0.95 / 2 + (i + 0.5) * (w * 0.95 / rows)
        add(new THREE.BoxGeometry(0.12, height, d * 0.85), accent, x, 0.06, 0)
      }
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
