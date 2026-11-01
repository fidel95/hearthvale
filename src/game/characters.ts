import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js'

// The town's people: Kenney's Mini Characters (CC0), six women and six men,
// each rigged with its own walk, idle and sit animations. They load in the
// background; until they have (or if they can't), callers fall back to their
// own simple figures.
//
// A character is a copy of one model (bones and all, so each moves on its
// own) with an AnimationMixer, scaled to HEIGHT and facing +z.

export const HEIGHT = 0.24 // world units (a tile is 1): about a doorway tall, and narrow enough for the sidewalk (0.16 wide)
const NAMES = ['a', 'b', 'c', 'd', 'e', 'f'].flatMap((l) => [`character-female-${l}`, `character-male-${l}`])
const url = (name: string) => `${import.meta.env.BASE_URL}models/people/${name}.glb`

interface Model {
  scene: THREE.Object3D
  clips: THREE.AnimationClip[]
  scale: number
}

export interface Character {
  root: THREE.Group // add accessories (an umbrella, a hat) here, in the character's own units: HEIGHT tall, facing +z
  mixer: THREE.AnimationMixer
  play(name: 'walk' | 'idle' | 'sit', fade?: number): void
}

let models: Model[] = []
let loading: Promise<void> | null = null

// Start loading (once); resolves when every model is in.
export function loadCharacters(): Promise<void> {
  loading ??= Promise.all(
    NAMES.map(async (name) => {
      const gltf = await new GLTFLoader().loadAsync(url(name))
      // Measured standing (idle, skinned), not by the raw shapes, which are bigger.
      const pose = new THREE.AnimationMixer(gltf.scene)
      const idle = THREE.AnimationClip.findByName(gltf.animations, 'idle')
      if (idle) pose.clipAction(idle).play()
      pose.update(0)
      gltf.scene.updateMatrixWorld(true)
      gltf.scene.traverse((o) => o instanceof THREE.SkinnedMesh && o.skeleton.update())
      const box = new THREE.Box3().setFromObject(gltf.scene, true)
      pose.stopAllAction()
      pose.uncacheRoot(gltf.scene)
      const scale = HEIGHT / Math.max(0.01, box.max.y - box.min.y)
      gltf.scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = true
          o.receiveShadow = false
          // Skinned meshes move away from where they were modelled, so the
          // camera mustn't skip them for being "out of view".
          o.frustumCulled = false
        }
      })
      return { scene: gltf.scene, clips: gltf.animations, scale }
    }),
  ).then((loaded) => {
    models = loaded
  })
  return loading
}

export function charactersReady(): boolean {
  return models.length > 0
}

// A new character, a random one of the twelve (null until they've loaded).
export function makeCharacter(): Character | null {
  if (models.length === 0) return null
  const model = models[Math.floor(Math.random() * models.length)]
  const body = cloneSkinned(model.scene)
  body.scale.setScalar(model.scale)
  const root = new THREE.Group()
  root.add(body)
  const mixer = new THREE.AnimationMixer(body)
  const actions = new Map<string, THREE.AnimationAction>()
  let current: THREE.AnimationAction | null = null
  return {
    root,
    mixer,
    play(name, fade = 0.2) {
      let action = actions.get(name)
      if (!action) {
        const clip = THREE.AnimationClip.findByName(model.clips, name)
        if (!clip) return
        action = mixer.clipAction(clip)
        actions.set(name, action)
      }
      if (action === current) return
      action.reset().play()
      if (current) action.crossFadeFrom(current, fade, false)
      current = action
    },
  }
}
