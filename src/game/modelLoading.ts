import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

// Loading .glb model files, shared by every module that draws them (models.ts
// and the builders for buildings with moving parts), so none of them has to
// import another just for this.

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

export function loadModel(url: string): Promise<THREE.Object3D> {
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

// Our own models, made in Blender (assets-src/blender, npm run models).
export const ownModel = (name: string) => `${import.meta.env.BASE_URL}models/hearthvale/${name}.glb`

// A copy of a model at a given scale, standing where it was modelled (for
// boats and containers, whose packs model them centered at the waterline or
// ground). Returns a group right away and fills it in once the model has
// loaded, with `fallback` instead if it can't load. The copy shares the
// model's shapes and materials, so they must not be freed (isSharedGeometry).
// userData.ready resolves once it's filled in (createBuildingObject waits for it).
export function modelCopy(url: string, scale: number, fallback: () => THREE.Object3D): THREE.Group {
  const group = new THREE.Group()
  const fill = (content: THREE.Object3D) => {
    content.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true
    })
    group.add(content)
  }
  group.userData.ready = loadModel(url)
    .then((model) => {
      const copy = model.clone()
      copy.scale.setScalar(scale)
      fill(copy)
    })
    .catch((err) => {
      console.warn(`Couldn't load ${url}, using a simple shape`, err)
      fill(fallback())
    })
  return group
}

// A moving part of one of our buildings: its Blender model, modelled around
// the point the code moves it about, or the simple shapes in `fallback`.
export function ownPart(name: string, fallback: () => THREE.Object3D): THREE.Group {
  return modelCopy(ownModel(name), 1, fallback)
}

// Geometry made from a cached model's (loadMeshParts), shared the same way.
export function markShared(geometry: THREE.BufferGeometry) {
  sharedGeometries.add(geometry)
}
