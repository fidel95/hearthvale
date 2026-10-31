import * as THREE from 'three'
import { sizeOf, type City, type PlacedBuilding } from './City'
import { edgeTiles } from './communityRules'
import { footprintCenter, tileToWorld } from './grid'
import { SKI_LIFT, SKI_SLOPE, slopeHeight } from './models'
import { isWater } from './terrain'
import { createCharacter, playClip, releaseCharacter } from './characters'

// People enjoying themselves, for looks only: sunbathers on the towels (one
// sitting up, one lying back) and swimmers bobbing just off each Public Beach
// (everyone goes home when it rains), and skiers at the Ski Resort, crouched
// as they zigzag down the slope and sitting on the chairlift back up. Worked
// out again whenever buildings change. Everyone is one of the townspeople
// (characters.ts), with simple shapes standing in until they load.

const SKIN = ['#f1c9a5', '#d9a47c', '#a86f4c', '#6b4430']
const BRIGHT = ['#ff5c8a', '#2f7fe0', '#ffd23f', '#3fae6b', '#ff7043', '#b46cf0', '#2bb3b1']
const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)]
const materials = new Map<string, THREE.MeshLambertMaterial>()
const material = (color: string) => {
  let m = materials.get(color)
  if (!m) materials.set(color, (m = new THREE.MeshLambertMaterial({ color })))
  return m
}
const SHAPES = {
  legs: new THREE.BoxGeometry(0.08, 0.12, 0.06).translate(0, 0.06, 0),
  body: new THREE.CylinderGeometry(0.06, 0.07, 0.15, 6).translate(0, 0.195, 0),
  head: new THREE.IcosahedronGeometry(0.055, 0).translate(0, 0.32, 0),
  cap: new THREE.SphereGeometry(0.06, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.33, 0),
  shoulders: new THREE.CylinderGeometry(0.07, 0.07, 0.06, 8).translate(0, 0.24, 0),
  skis: new THREE.BoxGeometry(0.3, 0.01, 0.1).translate(0.03, 0.005, 0),
}

function figure(parts: [THREE.BufferGeometry, string][]): THREE.Group {
  const g = new THREE.Group()
  for (const [shape, color] of parts) {
    const mesh = new THREE.Mesh(shape, material(color))
    mesh.castShadow = true
    g.add(mesh)
  }
  g.scale.setScalar(1.4)
  return g
}

const up = new THREE.Vector3(0, 1, 0)
const HEIGHT = 0.36 // the same size as the people walking about town

// Every animated person here, so their animations can be moved on each frame.
interface Animated {
  object: THREE.Object3D
  clip: string
}

interface Swimmer {
  object: THREE.Group
  base: THREE.Vector3
  along: THREE.Vector3
  phase: number
}

interface Skier {
  object: THREE.Group
  resort: PlacedBuilding
  t: number // seconds into this skier's run: down the slope, then up the lift
  start: number // which way down the mountain this skier takes
}

const DOWN_SECONDS = 7
const LIFT_SECONDS = 9

export class LeisureView {
  private scene: THREE.Scene
  private city: City
  private dirty = true
  private visible = true
  private beachGroup = new THREE.Group() // sunbathers and swimmers, hidden in the rain
  private swimmers: Swimmer[] = []
  private skiers: Skier[] = []
  private extras: THREE.Object3D[] = [] // lift cables
  private animated: Animated[] = []
  private time = 0
  raining = false

  constructor(scene: THREE.Scene, city: City) {
    this.scene = scene
    this.city = city
    scene.add(this.beachGroup)
    city.onChange((e) => {
      if (['added', 'removed', 'moved', 'finished', 'stored', 'restored'].includes(e.kind)) this.dirty = true
    })
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
    this.beachGroup.visible = !this.raining
    for (const s of this.swimmers) {
      // Bobbing in the waves and drifting slowly along the shore.
      const drift = Math.sin(this.time * 0.3 + s.phase) * 0.35
      s.object.position.copy(s.base).addScaledVector(s.along, drift)
      s.object.position.y = 0.0 + Math.sin(this.time * 2 + s.phase) * 0.025
    }
    for (const s of this.skiers) this.moveSkier(s, dt)
    for (const a of this.animated) playClip(a.object, a.clip, dt)
  }

  private clear() {
    for (const a of this.animated) releaseCharacter(a.object)
    this.animated = []
    this.beachGroup.clear()
    this.swimmers = []
    for (const s of this.skiers) this.scene.remove(s.object)
    this.skiers = []
    for (const e of this.extras) this.scene.remove(e)
    this.extras = []
  }

  private replan() {
    this.dirty = false
    this.clear()
    for (const b of this.city.all()) {
      if (!this.city.isBuilt(b)) continue
      if (b.type.id === 'public-beach') this.planBeach(b)
      if (b.type.id === 'ski-resort') this.planResort(b)
    }
  }

  // A townsperson playing an animation (or the simple figure, if they can't load).
  private character(clip: string, fallback: () => THREE.Object3D): THREE.Group {
    const person = createCharacter({ height: HEIGHT, clip, fallback })
    this.animated.push({ object: person, clip })
    return person
  }

  // A point in a building's own coordinates (center at the origin), in the world.
  private toWorld(b: PlacedBuilding, x: number, y: number, z: number): THREE.Vector3 {
    return new THREE.Vector3(x, y, z).applyAxisAngle(up, (-b.rotation * Math.PI) / 2).add(footprintCenter(b.tile, sizeOf(b)))
  }

  // ---- The beach

  private planBeach(b: PlacedBuilding) {
    // Sunbathers on the two towels (where the model draws them): one sits up
    // looking out to sea, the other lies back.
    ;[[-0.6, 0.05], [0.55, 0.05]].forEach(([x, z], i) => {
      const holder = new THREE.Group()
      holder.rotation.y = (-b.rotation * Math.PI) / 2
      const lying = i === 1
      const person = this.character(lying ? 'static' : 'sit', () => figure([[SHAPES.legs, pick(BRIGHT)], [SHAPES.body, pick(BRIGHT)], [SHAPES.head, pick(SKIN)]]))
      if (lying) {
        person.rotation.x = -Math.PI / 2 // on their back, head up the towel
        person.position.set(0, 0.04, 0.2)
      }
      holder.add(person)
      holder.position.copy(this.toWorld(b, x, 0.07, z + (lying ? 0 : 0.1)))
      this.beachGroup.add(holder)
    })
    // Swimmers out in the water, off whichever side of the beach faces the sea.
    const center = footprintCenter(b.tile, sizeOf(b))
    const water = edgeTiles(b).filter(isWater).map(tileToWorld)
    const out = water.length > 0 ? water.reduce((sum, w) => sum.add(w), new THREE.Vector3()).divideScalar(water.length).sub(center).setY(0) : new THREE.Vector3(0, 0, 1)
    const reach = out.length()
    out.normalize()
    const along = new THREE.Vector3(-out.z, 0, out.x)
    for (let i = 0; i < 4; i++) {
      // Up to their shoulders in the water, facing the beach.
      const swimmer = new THREE.Group()
      const person = this.character('idle', () => figure([[SHAPES.shoulders, pick(SKIN)], [SHAPES.head, pick(SKIN)], [SHAPES.cap, pick(BRIGHT)]]))
      person.position.y = -HEIGHT * 0.42
      swimmer.add(person)
      swimmer.rotation.y = Math.atan2(-out.x, -out.z)
      const base = center.clone().addScaledVector(out, reach + 0.4 + Math.random() * 1.6).addScaledVector(along, (Math.random() - 0.5) * 2.4)
      swimmer.position.copy(base)
      this.beachGroup.add(swimmer)
      this.swimmers.push({ object: swimmer, base, along, phase: Math.random() * Math.PI * 2 })
    }
  }

  // ---- The ski resort

  private planResort(b: PlacedBuilding) {
    // The lift cable, from the bottom tower to the top one.
    const from = this.toWorld(b, SKI_LIFT.from.x, slopeHeight(SKI_LIFT.from.x, SKI_LIFT.from.z) + 0.45, SKI_LIFT.from.z)
    const to = this.toWorld(b, SKI_LIFT.to.x, slopeHeight(SKI_LIFT.to.x, SKI_LIFT.to.z) + 0.45, SKI_LIFT.to.z)
    const cable = new THREE.Line(new THREE.BufferGeometry().setFromPoints([from, to]), new THREE.LineBasicMaterial({ color: '#2b2d33' }))
    this.scene.add(cable)
    this.extras.push(cable)
    for (let i = 0; i < 5; i++) {
      // Skis under a person turned to face along them (+x).
      const skier = new THREE.Group()
      const skis = new THREE.Mesh(SHAPES.skis, material('#2b2d33'))
      skis.scale.setScalar(1.4)
      const person = this.character('crouch', () => figure([[SHAPES.legs, '#2b3a4a'], [SHAPES.body, pick(BRIGHT)], [SHAPES.head, pick(SKIN)], [SHAPES.cap, pick(BRIGHT)]]))
      person.rotation.y = Math.PI / 2
      person.name = 'person'
      skier.add(skis, person)
      this.scene.add(skier)
      this.skiers.push({ object: skier, resort: b, t: (i * (DOWN_SECONDS + LIFT_SECONDS)) / 5, start: (i % 3) - 1 })
    }
  }

  private moveSkier(s: Skier, dt: number) {
    s.t = (s.t + dt) % (DOWN_SECONDS + LIFT_SECONDS)
    const { cx, cz, radius } = SKI_SLOPE
    let x: number
    let z: number
    let lift = 0
    let heading: THREE.Vector3
    if (s.t < DOWN_SECONDS) {
      // Down the slope toward the front, swinging from side to side.
      const u = s.t / DOWN_SECONDS
      const r = 0.2 + u * (radius - 0.25)
      const angle = Math.PI / 4 + s.start * 0.45 + Math.sin(u * Math.PI * 5) * 0.4
      const ahead = Math.min(1, u + 0.02)
      const ra = 0.2 + ahead * (radius - 0.25)
      const aa = Math.PI / 4 + s.start * 0.45 + Math.sin(ahead * Math.PI * 5) * 0.4
      x = cx + Math.cos(angle) * r
      z = cz + Math.sin(angle) * r
      heading = new THREE.Vector3(cx + Math.cos(aa) * ra - x, 0, cz + Math.sin(aa) * ra - z)
    } else {
      // Up the chairlift, sitting still above the snow.
      const u = (s.t - DOWN_SECONDS) / LIFT_SECONDS
      x = SKI_LIFT.from.x + (SKI_LIFT.to.x - SKI_LIFT.from.x) * u
      z = SKI_LIFT.from.z + (SKI_LIFT.to.z - SKI_LIFT.from.z) * u
      lift = 0.22
      heading = new THREE.Vector3(SKI_LIFT.to.x - SKI_LIFT.from.x, 0, SKI_LIFT.to.z - SKI_LIFT.from.z)
    }
    const b = s.resort
    const person = s.object.getObjectByName('person')!
    const riding = this.animated.find((a) => a.object === person)
    if (riding) riding.clip = lift > 0 ? 'sit' : 'crouch'
    s.object.position.copy(this.toWorld(b, x, slopeHeight(x, z) + lift, z))
    const h = heading.applyAxisAngle(up, (-b.rotation * Math.PI) / 2)
    s.object.rotation.y = Math.atan2(-h.z, h.x)
  }
}
