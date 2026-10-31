import * as THREE from 'three'
import { sizeOf, type City, type PlacedBuilding } from './City'
import { footprintCenter } from './grid'
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'
import { modelCopy } from './models'
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js'

// Farm animals in their pens, for looks: chickens peck about, pigs root
// around, sheep and cows graze, a horse keeps the cows company and a dog
// minds the sheep. Each wanders to a spot in the yard, stops to eat for a
// bit, and wanders on. Worked out again when pens change.
//
// Pigs, sheep, cows, the horse and the dog are Quaternius's Farm Animals
// (CC0), with their idle and walk animations; chickens (which the pack
// doesn't have) and anyone still loading are simple shapes.

type Kind = 'chicken' | 'pig' | 'sheep' | 'cow' | 'horse' | 'dog'

// The pack's animal for each kind, and how long it is from nose to tail.
const PACK: Partial<Record<Kind, { file: string; length: number }>> = {
  pig: { file: 'Pig', length: 0.45 },
  sheep: { file: 'Sheep', length: 0.42 },
  cow: { file: 'Cow', length: 0.68 },
  horse: { file: 'Horse', length: 0.7 },
  dog: { file: 'Pug', length: 0.26 },
}
// Companions: one per pen of these kinds.
const COMPANION: Partial<Record<string, Kind>> = { 'cow-pasture': 'horse', 'sheep-meadow': 'dog' }
const animalFile = (name: string) => `${import.meta.env.BASE_URL}models/animals/${name}.fbx`
// Chickens are a separate model (Chicken by jeremy, CC-BY), facing -x.
const CHICKEN_URL = `${import.meta.env.BASE_URL}models/farm/chicken.glb`
const CHICKEN_SCALE = 0.2 / 190 // about 0.2 tall
const loaded = new Map<Kind, { model: THREE.Group; clips: THREE.AnimationClip[]; scale: number }>()

const materials = new Map<string, THREE.MeshLambertMaterial>()
const material = (color: string) => {
  let m = materials.get(color)
  if (!m) materials.set(color, (m = new THREE.MeshLambertMaterial({ color })))
  return m
}

// Each animal is built along +x (its head end), standing on y = 0. `head` is
// the part that dips down to eat. One model per kind is built once, and each
// animal is a copy sharing its shapes (so rebuilding the herds when the town
// changes doesn't keep making new shapes on the graphics card).
const templates = new Map<Kind, THREE.Group>()
function makeAnimal(kind: Kind): { root: THREE.Group; head: THREE.Group; mixer: THREE.AnimationMixer | null; clips: THREE.AnimationClip[]; peck: number } {
  if (kind === 'chicken') {
    // The whole chicken tips forward to peck (from its feet).
    const root = new THREE.Group()
    const tilt = new THREE.Group()
    const chicken = modelCopy(CHICKEN_URL, CHICKEN_SCALE, () => {
      const simple = buildAnimal('chicken')
      simple.rotation.y = Math.PI // undone below
      return simple
    })
    chicken.rotation.y = Math.PI
    tilt.add(chicken)
    root.add(tilt)
    return { root, head: tilt, mixer: null, clips: [], peck: 0.45 }
  }
  const pack = loaded.get(kind)
  if (pack) {
    // The pack's animals face +z; turned to face +x, like the rest here.
    const root = new THREE.Group()
    const model = cloneSkinned(pack.model)
    model.scale.setScalar(pack.scale)
    model.rotation.y = Math.PI / 2
    model.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true
    })
    root.add(model)
    return { root, head: new THREE.Group(), mixer: new THREE.AnimationMixer(model), clips: pack.clips, peck: 0 }
  }
  let template = templates.get(kind)
  if (!template) templates.set(kind, (template = buildAnimal(kind)))
  const root = template.clone(true)
  return { root, head: root.getObjectByName('head') as THREE.Group, mixer: null, clips: [], peck: 1 }
}

function buildAnimal(kind: Kind): THREE.Group {
  const root = new THREE.Group()
  const head = new THREE.Group()
  const part = (g: THREE.BufferGeometry, color: string, parent: THREE.Object3D = root) => {
    const m = new THREE.Mesh(g, material(color))
    m.castShadow = true
    parent.add(m)
  }
  const legs = (color: string, x: number, z: number, h: number, w = 0.03) => {
    for (const lx of [-x, x]) for (const lz of [-z, z]) part(new THREE.BoxGeometry(w, h, w).translate(lx, h / 2, lz), color)
  }
  switch (kind) {
    case 'chicken':
      part(new THREE.SphereGeometry(0.06, 8, 6).scale(1.2, 1, 0.9).translate(0, 0.08, 0), '#fafafa')
      part(new THREE.BoxGeometry(0.03, 0.05, 0.05).translate(-0.07, 0.11, 0), '#f0f0f0')
      head.position.set(0.06, 0.13, 0)
      part(new THREE.SphereGeometry(0.035, 8, 6), '#fafafa', head)
      part(new THREE.BoxGeometry(0.02, 0.025, 0.012).translate(0, 0.035, 0), '#e0453a', head)
      part(new THREE.ConeGeometry(0.012, 0.03, 4).rotateZ(-Math.PI / 2).translate(0.04, 0, 0), '#f2b33a', head)
      legs('#f2b33a', 0.015, 0.02, 0.04, 0.01)
      break
    case 'pig':
      part(new THREE.BoxGeometry(0.26, 0.14, 0.15).translate(0, 0.13, 0), '#f4a9b8')
      head.position.set(0.15, 0.14, 0)
      part(new THREE.BoxGeometry(0.1, 0.1, 0.12), '#f4a9b8', head)
      part(new THREE.BoxGeometry(0.03, 0.05, 0.06).translate(0.06, -0.01, 0), '#e88aa0', head)
      legs('#e88aa0', 0.09, 0.05, 0.07, 0.035)
      break
    case 'sheep':
      part(new THREE.IcosahedronGeometry(0.11, 1).scale(1.3, 0.95, 1).translate(0, 0.17, 0), '#f7f5ef')
      head.position.set(0.15, 0.2, 0)
      part(new THREE.BoxGeometry(0.08, 0.08, 0.07), '#2b2d33', head)
      legs('#2b2d33', 0.07, 0.05, 0.09, 0.025)
      break
    case 'cow':
      part(new THREE.BoxGeometry(0.4, 0.18, 0.2).translate(0, 0.24, 0), '#fafafa')
      part(new THREE.BoxGeometry(0.15, 0.185, 0.205).translate(-0.06, 0.24, 0.0), '#2b2d33')
      part(new THREE.BoxGeometry(0.08, 0.06, 0.08).translate(-0.03, 0.15, 0), '#f4a9b8')
      head.position.set(0.23, 0.28, 0)
      part(new THREE.BoxGeometry(0.12, 0.11, 0.11), '#fafafa', head)
      part(new THREE.BoxGeometry(0.04, 0.06, 0.1).translate(0.07, -0.02, 0), '#f4c4b0', head)
      for (const z of [-0.07, 0.07]) part(new THREE.ConeGeometry(0.012, 0.05, 4).translate(-0.02, 0.07, z), '#e8dcc0', head)
      legs('#fafafa', 0.14, 0.07, 0.15, 0.04)
      break
  }
  head.name = 'head'
  root.add(head)
  root.scale.setScalar(1.3)
  return root
}

const SPEED: Record<Kind, number> = { chicken: 0.5, pig: 0.3, sheep: 0.25, cow: 0.2, horse: 0.3, dog: 0.5 }

interface Animal {
  kind: Kind
  root: THREE.Group
  head: THREE.Group
  pen: PlacedBuilding
  at: THREE.Vector2 // position in the pen's own coordinates
  to: THREE.Vector2
  pause: number
  phase: number
  mixer: THREE.AnimationMixer | null
  clips: THREE.AnimationClip[]
  clip: string | null // the animation playing
  peck: number // how far the head (or a model chicken) dips to eat
}

export class AnimalView {
  private scene: THREE.Scene
  private city: City
  private animals: Animal[] = []
  private dirty = true
  private visible = true
  private time = 0

  constructor(scene: THREE.Scene, city: City) {
    this.scene = scene
    this.city = city
    city.onChange((e) => {
      if (['added', 'removed', 'moved', 'finished', 'stored', 'restored'].includes(e.kind)) this.dirty = true
    })
    // Load the pack once; then the herds are worked out again with it.
    const loader = new FBXLoader()
    for (const kind of Object.keys(PACK) as Kind[]) {
      const { file, length } = PACK[kind]!
      loader
        .loadAsync(animalFile(file))
        .then((model) => {
          const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3())
          loaded.set(kind, { model, clips: model.animations, scale: length / Math.max(0.001, size.z) })
          this.dirty = true
        })
        .catch((err) => console.warn(`Couldn't load the ${kind}; a simple one stands in`, err))
    }
  }

  setVisible(visible: boolean) {
    this.visible = visible
    this.dirty = true
    if (!visible) this.clear()
  }

  update(dt: number) {
    if (!this.visible) return
    if (this.dirty) this.replan()
    this.time += dt
    for (const a of this.animals) this.move(a, dt)
  }

  private clear() {
    for (const a of this.animals) {
      this.scene.remove(a.root)
      a.mixer?.stopAllAction()
    }
    this.animals = []
  }

  private replan() {
    this.dirty = false
    this.clear()
    for (const pen of this.city.all()) {
      const herd = pen.type.animals
      if (!herd || !this.city.isBuilt(pen)) continue
      const companion = COMPANION[pen.type.id]
      const kinds: Kind[] = Array.from({ length: herd.count }, () => herd.kind)
      if (companion && loaded.has(companion)) kinds.push(companion)
      for (const kind of kinds) {
        const { root, head, mixer, clips, peck } = makeAnimal(kind)
        const at = this.spot(pen)
        this.scene.add(root)
        this.animals.push({ kind, root, head, pen, at, to: this.spot(pen), pause: Math.random() * 3, phase: Math.random() * 10, mixer, clips, clip: null, peck })
      }
    }
  }

  // Somewhere in the yard: inside the fence, and not in the shed at the back.
  private spot(pen: PlacedBuilding): THREE.Vector2 {
    const { x: w, z: d } = pen.type.size
    for (;;) {
      const p = new THREE.Vector2((Math.random() - 0.5) * (w - 0.6), (Math.random() - 0.5) * (d - 0.6))
      const inShed = p.x < -w / 2 + 0.85 && p.y < -d / 2 + 0.75
      if (!inShed) return p
    }
  }

  private move(a: Animal, dt: number) {
    a.phase += dt
    const toward = a.to.clone().sub(a.at)
    const distance = toward.length()
    let eating = false
    if (a.pause > 0) {
      a.pause -= dt
      eating = true
    } else if (distance < 0.03) {
      // Arrived: stop and eat, then pick somewhere new.
      a.pause = 2 + Math.random() * 5
      a.to = this.spot(a.pen)
    } else {
      a.at.addScaledVector(toward.normalize(), Math.min(distance, SPEED[a.kind] * dt))
    }
    this.animate(a, eating, dt)
    // Head down to eat (chickens peck quickly, the others graze slowly).
    const peck = a.kind === 'chicken' ? Math.max(0, Math.sin(a.phase * 9)) * 0.9 : 0.5 + Math.sin(a.phase * 1.5) * 0.1
    a.head.rotation.z = eating ? -peck * a.peck : 0
    const turn = (-a.pen.rotation * Math.PI) / 2
    const local = new THREE.Vector3(a.at.x, 0, a.at.y).applyAxisAngle(new THREE.Vector3(0, 1, 0), turn)
    a.root.position.copy(footprintCenter(a.pen.tile, sizeOf(a.pen)).add(local)).setY(eating ? 0.03 : 0.03 + Math.abs(Math.sin(a.phase * 10)) * 0.01)
    if (!eating && distance > 0.03) a.root.rotation.y = Math.atan2(-toward.y, toward.x) + turn
  }

  // The pack's animals: walking when they move (those that have a walk),
  // otherwise their idle, which has them look about and graze.
  private animate(a: Animal, eating: boolean, dt: number) {
    if (!a.mixer) return
    const want = !eating && a.clips.some((c) => c.name.endsWith('|WalkSlow')) ? 'WalkSlow' : 'Idle'
    if (a.clip !== want) {
      const clip = a.clips.find((c) => c.name.endsWith(`|${want}`))
      if (clip) {
        const action = a.mixer.clipAction(clip)
        action.reset().play()
        if (a.clip) {
          const before = a.clips.find((c) => c.name.endsWith(`|${a.clip}`))
          if (before) a.mixer.clipAction(before).crossFadeTo(action, 0.3, false)
        } else action.time = Math.random() * clip.duration
        a.clip = want
      }
    }
    a.mixer.update(dt)
  }
}
