import * as THREE from 'three'
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js'
import { loadCharacter } from './models'

// Everyone in town is one of Kenney's Mini Characters (CC0): twelve people
// sharing one skeleton (root, torso, head, two arms, two legs) and the same
// set of animations (walk, idle, sit, crouch, wheelchair moves and more).
// A character is a group that fills in once its model has loaded, with
// simple shapes standing in if it can't load.

export const CHARACTERS = ['female-a', 'female-b', 'female-c', 'female-d', 'female-e', 'female-f', 'male-a', 'male-b', 'male-c', 'male-d', 'male-e', 'male-f']
const people = (name: string) => `${import.meta.env.BASE_URL}models/people/${name}.glb`
const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)]

// The six bones that move, by name.
export type Bone = 'leg-left' | 'leg-right' | 'arm-left' | 'arm-right' | 'torso' | 'head'

interface Character {
  model: THREE.Object3D
  bones: Record<Bone, THREE.Object3D>
  mixer: THREE.AnimationMixer | null
  clips: THREE.AnimationClip[]
  actions: Map<string, THREE.AnimationAction>
  clip: string | null
}

export interface CharacterOptions {
  height: number // how tall, in the units of whatever it's added to
  clip?: string // the animation to start with (none: it stands still for its bones to be posed)
  wheelchair?: boolean
  tint?: string // recolors the clothes (the army's olive), leaving face and hair alone
  fallback: () => THREE.Object3D
}

const tinted = new Map<string, THREE.Material>()
function tint(original: THREE.Material, color: string): THREE.Material {
  const key = `${original.uuid}:${color}`
  let m = tinted.get(key)
  if (!m) {
    const copy = (original as THREE.MeshStandardMaterial).clone()
    copy.color = new THREE.Color(color)
    tinted.set(key, (m = copy))
  }
  return m
}

export function createCharacter(options: CharacterOptions): THREE.Group {
  const group = new THREE.Group()
  Promise.all([loadCharacter(people(`character-${pick(CHARACTERS)}`)), options.wheelchair ? loadCharacter(people('wheelchair')) : null])
    .then(([source, chair]) => {
      if (group.userData.gone) return
      const model = cloneSkinned(source.scene)
      model.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return
        o.castShadow = true
        if (options.tint && o.name === 'body-mesh') o.material = tint(o.material as THREE.Material, options.tint)
      })
      const holder = new THREE.Group()
      holder.add(model)
      if (chair) holder.add(chair.scene.clone())
      const size = new THREE.Box3().setFromObject(source.scene).getSize(new THREE.Vector3())
      holder.scale.setScalar(options.height / Math.max(0.01, size.y))
      group.add(holder)
      const bones = {} as Record<Bone, THREE.Object3D>
      for (const name of ['leg-left', 'leg-right', 'arm-left', 'arm-right', 'torso', 'head'] as Bone[]) bones[name] = model.getObjectByName(name)!
      const character: Character = { model, bones, mixer: null, clips: source.animations, actions: new Map(), clip: null }
      group.userData.character = character
      if (options.clip) playClip(group, options.clip, Math.random()) // not everyone in step
    })
    .catch((err) => {
      console.warn("Couldn't load a townsperson; simple shapes stand in", err)
      if (!group.userData.gone) group.add(options.fallback())
    })
  return group
}

// Play an animation (blending from the last one) and move it on by dt seconds.
export function playClip(group: THREE.Object3D, clip: string, dt: number) {
  const c = group.userData.character as Character | undefined
  if (!c) return
  if (c.clip !== clip) {
    c.mixer ??= new THREE.AnimationMixer(c.model)
    let action = c.actions.get(clip)
    if (!action) {
      const found = THREE.AnimationClip.findByName(c.clips, clip)
      if (!found) return
      action = c.mixer.clipAction(found)
      c.actions.set(clip, action)
    }
    action.reset().play()
    const before = c.clip ? c.actions.get(c.clip) : undefined
    if (before) before.crossFadeTo(action, 0.25, false)
    c.clip = clip
  }
  c.mixer!.update(dt)
}

// The character's bones once loaded (for posing them by hand, as the army's drills do).
export function bonesOf(group: THREE.Object3D): Record<Bone, THREE.Object3D> | null {
  return (group.userData.character as Character | undefined)?.bones ?? null
}

export function hasCharacter(group: THREE.Object3D): boolean {
  return group.userData.character !== undefined
}

// Done with it: stop its animations, and don't fill it in if it's still loading.
export function releaseCharacter(group: THREE.Object3D) {
  group.userData.gone = true
  ;(group.userData.character as Character | undefined)?.mixer?.stopAllAction()
}
