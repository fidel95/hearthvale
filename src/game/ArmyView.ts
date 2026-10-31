import * as THREE from 'three'
import type { Army } from './Army'
import { sizeOf, type City, type PlacedBuilding } from './City'
import { edgeTiles } from './communityRules'
import { footprintCenter, tileToWorld } from './grid'
import { ARMY_BASE } from './models'
import { pathToFarthest, Polyline } from './routes'

// Life on the Army Base, for looks: a squad of six with arms and legs that
// move, running through a daily drill on the parade ground; a flag that waves
// and is raised; a sentry scanning the horizon from the watchtower; and a
// helicopter that spins up, circles the town and lands. When the town holds a
// parade (Army.ts), the squad marches out along the roads behind a flag
// bearer and a drummer, and comes home when it's over.
//
// Everything is laid out in the base's own coordinates (ARMY_BASE, shared
// with the model) and turned and moved to where the base stands.

const OLIVE = '#5f6b3a'
const DARK_OLIVE = '#3b4226'
const SKIN = ['#f1c9a5', '#d9a47c', '#a86f4c', '#6b4430']
const up = new THREE.Vector3(0, 1, 0)

// The daily drill, in order, with how long each part lasts (seconds).
const DRILL: { phase: Phase; seconds: number }[] = [
  { phase: 'march', seconds: 18 },
  { phase: 'formup', seconds: 3 },
  { phase: 'salute', seconds: 8 },
  { phase: 'jacks', seconds: 9 },
  { phase: 'pushups', seconds: 8 },
  { phase: 'run', seconds: 10 },
  { phase: 'atease', seconds: 6 },
]
type Phase = 'march' | 'formup' | 'salute' | 'jacks' | 'pushups' | 'run' | 'atease' | 'parade'

// ---- Shapes

const materials = new Map<string, THREE.MeshLambertMaterial>()
const material = (color: string) => {
  let m = materials.get(color)
  if (!m) materials.set(color, (m = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide })))
  return m
}
const GEO = {
  leg: new THREE.BoxGeometry(0.036, 0.13, 0.036).translate(0, -0.065, 0),
  arm: new THREE.BoxGeometry(0.03, 0.12, 0.03).translate(0, -0.06, 0),
  torso: new THREE.CylinderGeometry(0.06, 0.07, 0.15, 6).translate(0, 0.205, 0),
  head: new THREE.IcosahedronGeometry(0.055, 0).translate(0, 0.33, 0),
  helmet: new THREE.SphereGeometry(0.066, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.345, 0),
  drum: new THREE.CylinderGeometry(0.05, 0.05, 0.05, 10).rotateX(Math.PI / 2).translate(0.07, 0.17, 0),
  pole: new THREE.CylinderGeometry(0.006, 0.006, 0.4, 4).translate(0.05, 0.3, 0.09),
  pennant: new THREE.PlaneGeometry(0.14, 0.09).translate(0.12, 0.44, 0.09),
}

interface Soldier {
  root: THREE.Group
  legs: [THREE.Object3D, THREE.Object3D]
  arms: [THREE.Object3D, THREE.Object3D] // left, right
  props: THREE.Object3D[] // the parade flag or drum, shown only on parade
  from: { pos: THREE.Vector3; yaw: number } // where they were when the current part began
}

function pivot(geometry: THREE.BufferGeometry, color: string, x: number, y: number, z: number) {
  const p = new THREE.Group()
  p.position.set(x, y, z)
  const mesh = new THREE.Mesh(geometry, material(color))
  mesh.castShadow = true
  p.add(mesh)
  return p
}

function makeSoldier(role: 'flag' | 'drum' | null): Soldier {
  const root = new THREE.Group()
  root.rotation.order = 'YZX' // face a way, then lean (for push-ups)
  const body = new THREE.Group()
  root.add(body)
  for (const [g, c] of [[GEO.torso, OLIVE], [GEO.head, SKIN[Math.floor(Math.random() * SKIN.length)]], [GEO.helmet, DARK_OLIVE]] as const) {
    const m = new THREE.Mesh(g, material(c))
    m.castShadow = true
    body.add(m)
  }
  const legs: [THREE.Object3D, THREE.Object3D] = [pivot(GEO.leg, DARK_OLIVE, 0, 0.13, -0.025), pivot(GEO.leg, DARK_OLIVE, 0, 0.13, 0.025)]
  const arms: [THREE.Object3D, THREE.Object3D] = [pivot(GEO.arm, OLIVE, 0, 0.27, -0.078), pivot(GEO.arm, OLIVE, 0, 0.27, 0.078)]
  body.add(...legs, ...arms)
  const props: THREE.Object3D[] = []
  if (role === 'drum') props.push(new THREE.Mesh(GEO.drum, material('#c8463a')))
  if (role === 'flag') props.push(new THREE.Mesh(GEO.pole, material('#dddddd')), new THREE.Mesh(GEO.pennant, material('#2f7fe0')))
  for (const p of props) {
    p.visible = false
    body.add(p)
  }
  root.scale.setScalar(1.4)
  return { root, legs, arms, props, from: { pos: new THREE.Vector3(), yaw: 0 } }
}

function makeHelicopter() {
  const heli = new THREE.Group()
  const add = (g: THREE.BufferGeometry, c: string, parent: THREE.Object3D = heli) => {
    const m = new THREE.Mesh(g, material(c))
    m.castShadow = true
    parent.add(m)
    return m
  }
  add(new THREE.SphereGeometry(0.2, 12, 8).scale(1.4, 0.8, 0.85).translate(0.05, 0.2, 0), OLIVE)
  add(new THREE.SphereGeometry(0.12, 10, 6).scale(1, 0.7, 0.9).translate(0.2, 0.24, 0), '#2b3a4a')
  add(new THREE.BoxGeometry(0.5, 0.05, 0.05).translate(-0.4, 0.24, 0), OLIVE)
  add(new THREE.BoxGeometry(0.08, 0.14, 0.015).translate(-0.63, 0.3, 0), OLIVE)
  for (const z of [-0.12, 0.12]) {
    add(new THREE.BoxGeometry(0.5, 0.015, 0.02).translate(0.05, 0.01, z), DARK_OLIVE)
    for (const x of [-0.1, 0.18]) add(new THREE.BoxGeometry(0.015, 0.08, 0.015).translate(x, 0.05, z * 0.8), DARK_OLIVE)
  }
  add(new THREE.CylinderGeometry(0.015, 0.015, 0.08, 6).translate(0.05, 0.36, 0), DARK_OLIVE)
  const rotor = new THREE.Group()
  rotor.position.set(0.05, 0.4, 0)
  add(new THREE.BoxGeometry(1.1, 0.008, 0.05), '#2b2d33', rotor)
  add(new THREE.BoxGeometry(0.05, 0.008, 1.1), '#2b2d33', rotor)
  heli.add(rotor)
  const tail = new THREE.Group()
  tail.position.set(-0.64, 0.3, 0.02)
  add(new THREE.BoxGeometry(0.2, 0.025, 0.006), '#2b2d33', tail)
  heli.add(tail)
  heli.rotation.order = 'YZX'
  return { heli, rotor, tail }
}

// A flag on a pole, waving: a strip of cloth whose vertices ripple.
function makeFlag() {
  const geometry = new THREE.PlaneGeometry(0.34, 0.2, 10, 1).translate(0.17, 0, 0)
  const flag = new THREE.Mesh(geometry, material('#2f7fe0'))
  flag.castShadow = true
  return flag
}

const smooth = (t: number) => t * t * (3 - 2 * t)

// ---- One base and everything on it

class BaseLife {
  readonly base: PlacedBuilding
  soldiers: Soldier[]
  flag: THREE.Mesh
  sentry: Soldier
  heli: ReturnType<typeof makeHelicopter>
  group = new THREE.Group()
  drill = 0 // which part of the drill
  phaseTime = 0
  phase: Phase = 'march'
  s = 0 // distance round the parade ground (or along the parade route)
  step = 0 // the marching rhythm
  parade: { lines: Polyline[]; line: number; ending: boolean } | null = null
  heliTime = Math.random() * 20
  rotorSpeed = 0
  loop: Polyline

  constructor(base: PlacedBuilding) {
    this.base = base
    const { x0, x1, z0, z1 } = ARMY_BASE.ground
    this.loop = new Polyline([[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0]].map(([x, z]) => this.toWorld(x, 0, z)).map((v) => ({ x: v.x, z: v.z })))
    this.soldiers = Array.from({ length: 6 }, (_, i) => makeSoldier(i === 0 ? 'flag' : i === 1 ? 'drum' : null))
    this.sentry = makeSoldier(null)
    this.sentry.root.scale.setScalar(1.2)
    this.sentry.root.position.copy(this.toWorld(ARMY_BASE.tower.x, ARMY_BASE.tower.floor, ARMY_BASE.tower.z))
    this.flag = makeFlag()
    this.heli = makeHelicopter()
    this.group.add(...this.soldiers.map((s) => s.root), this.sentry.root, this.flag, this.heli.heli)
  }

  // A point in the base's own coordinates, in the world.
  toWorld(x: number, y: number, z: number): THREE.Vector3 {
    return new THREE.Vector3(x, y, z).applyAxisAngle(up, this.turn).add(footprintCenter(this.base.tile, sizeOf(this.base)))
  }
  get turn() {
    return (-this.base.rotation * Math.PI) / 2
  }
}

export class ArmyView {
  private scene: THREE.Scene
  private city: City
  private army: Army
  private bases: BaseLife[] = []
  private dirty = true
  private visible = true
  private time = 0

  constructor(scene: THREE.Scene, city: City, army: Army) {
    this.scene = scene
    this.city = city
    this.army = army
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
    const parading = this.army.paradeUntil(Date.now()) !== null
    for (const life of this.bases) {
      this.runSquad(life, dt, parading)
      this.waveFlag(life)
      this.watch(life)
      this.fly(life, dt)
    }
  }

  private clear() {
    for (const life of this.bases) this.scene.remove(life.group)
    this.bases = []
  }

  private replan() {
    this.dirty = false
    // Keep bases that are still there (so the drill doesn't restart), add new ones.
    const built = [...this.city.all()].filter((b) => b.type.id === 'army-base' && this.city.isBuilt(b))
    for (const life of [...this.bases]) {
      const still = built.find((b) => b.id === life.base.id && b.tile.x === life.base.tile.x && b.tile.z === life.base.tile.z && b.rotation === life.base.rotation)
      if (!still) {
        this.scene.remove(life.group)
        this.bases.splice(this.bases.indexOf(life), 1)
      }
    }
    for (const b of built) {
      if (this.bases.some((l) => l.base.id === b.id)) continue
      const life = new BaseLife(b)
      // Start in step on the parade ground (not sliding in from somewhere else).
      life.soldiers.forEach((s, i) => {
        const L = life.loop.length
        const p = life.loop.at((((-Math.floor(i / 2) * 0.32) % L) + L) % L, i % 2 === 0 ? -0.1 : 0.1)
        s.root.position.set(p.x, 0, p.z)
        s.root.rotation.y = p.angle
        s.from = { pos: s.root.position.clone(), yaw: p.angle }
      })
      this.scene.add(life.group)
      this.bases.push(life)
    }
  }

  // ---- The squad

  private setPhase(life: BaseLife, phase: Phase) {
    life.phase = phase
    life.phaseTime = 0
    for (const s of life.soldiers) s.from = { pos: s.root.position.clone(), yaw: s.root.rotation.y }
  }

  private runSquad(life: BaseLife, dt: number, parading: boolean) {
    life.phaseTime += dt
    // A parade starts: off they go, whatever the drill was doing.
    if (parading && !life.parade) {
      const start = edgeTiles(life.base).find(this.city.isRoad)
      const path = start && pathToFarthest(start, this.city.isRoad)
      if (path && path.length >= 3) {
        const points = path.map((t) => {
          const c = tileToWorld(t)
          return { x: c.x, z: c.z }
        })
        life.parade = { lines: [new Polyline(points), new Polyline([...points].reverse())], line: 0, ending: false }
        life.s = 0
        this.setPhase(life, 'parade')
      }
    }
    if (life.parade && !parading) life.parade.ending = true

    if (life.phase !== 'parade') {
      const current = DRILL[life.drill]
      if (life.phaseTime >= current.seconds) {
        life.drill = (life.drill + 1) % DRILL.length
        if (DRILL[life.drill].phase === 'march') life.s = 0
        this.setPhase(life, DRILL[life.drill].phase)
      }
    }

    const phase = life.phase
    const marching = phase === 'march' || phase === 'run' || phase === 'parade' || (phase === 'formup' && life.phaseTime < 2.5)
    life.step += dt * (phase === 'run' ? 15 : 9)
    if (phase === 'march' || phase === 'parade') life.s += dt * 0.55
    if (phase === 'run') life.s += dt * 1.1

    life.soldiers.forEach((soldier, i) => {
      for (const p of soldier.props) p.visible = phase === 'parade'
      const row = Math.floor(i / 2)
      const side = i % 2 === 0 ? -0.1 : 0.1
      let target: { x: number; z: number; angle: number }
      if (phase === 'parade' && life.parade) {
        target = this.paradePose(life, row, side)
      } else if (phase === 'march' || phase === 'run') {
        const L = life.loop.length
        target = life.loop.at((((life.s - row * 0.32) % L) + L) % L, side)
      } else {
        // In ranks facing the flag: two rows of three, far enough apart that
        // the front rank's push-ups don't land on the back rank.
        const p = life.toWorld([0.22, -0.36][Math.floor(i / 3)], 0, [-0.26, 0, 0.26][i % 3])
        target = { x: p.x, z: p.z, angle: life.turn }
      }
      // Ease from wherever they were into each new part of the drill.
      const blend = smooth(Math.min(1, life.phaseTime / 1.2))
      const pos = soldier.from.pos.clone().lerp(new THREE.Vector3(target.x, 0, target.z), blend)
      let turn = target.angle - soldier.from.yaw
      turn = Math.atan2(Math.sin(turn), Math.cos(turn))
      soldier.root.position.set(pos.x, 0, pos.z)
      soldier.root.rotation.set(0, soldier.from.yaw + turn * blend, 0)
      this.pose(soldier, phase, marching, life.step, life.phaseTime)
    })

    // The parade's over and the squad is back where it started: back to drill.
    const back = life.parade && life.parade.line === 1 && life.s >= life.parade.lines[1].length
    if (life.parade && back && life.parade.ending) {
      life.parade = null
      life.drill = DRILL.length - 1 // stand at ease, then start the day again
      this.setPhase(life, 'atease')
    } else if (life.parade && life.s >= life.parade.lines[life.parade.line].length) {
      life.parade.line = (life.parade.line + 1) % 2
      life.s = 0
    }
  }

  private paradePose(life: BaseLife, row: number, side: number) {
    const parade = life.parade!
    const line = parade.lines[parade.line]
    return line.at(Math.max(0, life.s - row * 0.4), side)
  }

  // Arms and legs for each part of the drill.
  private pose(s: Soldier, phase: Phase, marching: boolean, step: number, t: number) {
    const [leftLeg, rightLeg] = s.legs
    const [leftArm, rightArm] = s.arms
    for (const limb of [leftLeg, rightLeg, leftArm, rightArm]) limb.rotation.set(0, 0, 0)
    s.root.position.y = 0
    s.root.rotation.z = 0
    if (marching) {
      const swing = Math.sin(step) * (phase === 'run' ? 0.9 : 0.6)
      leftLeg.rotation.z = swing
      rightLeg.rotation.z = -swing
      leftArm.rotation.z = -swing * 0.8
      rightArm.rotation.z = swing * 0.8
      if (phase === 'parade') {
        // The flag bearer holds the flag up; the drummer beats the drum.
        if (s.props.length === 2) rightArm.rotation.z = 1.2
        if (s.props.length === 1) leftArm.rotation.z = rightArm.rotation.z = 1.0 + Math.abs(Math.sin(step * 2)) * 0.4
      }
      s.root.position.y = Math.abs(Math.sin(step)) * 0.02
      return
    }
    switch (phase) {
      case 'salute':
        // Right hand to the brow while the flag goes up.
        rightArm.rotation.set(-0.5, 0, 2.5)
        break
      case 'jacks': {
        const open = (1 - Math.cos(t * 7)) / 2
        leftArm.rotation.x = open * 2.8
        rightArm.rotation.x = -open * 2.8
        leftLeg.rotation.x = open * 0.35
        rightLeg.rotation.x = -open * 0.35
        s.root.position.y = Math.sin(open * Math.PI) * 0.03
        break
      }
      case 'pushups': {
        // Face down, arms straight to the ground, pushing up and down.
        const push = (1 - Math.cos(t * 4)) / 2
        s.root.rotation.z = -Math.PI / 2 + 0.25 + push * 0.12
        s.root.position.y = 0.08 + push * 0.05
        leftArm.rotation.z = rightArm.rotation.z = Math.PI / 2 - 0.2
        break
      }
    }
  }

  // ---- The flag

  private waveFlag(life: BaseLife) {
    const { flag: spot } = ARMY_BASE
    // Lowered while the squad forms up; raised during the salute; flying otherwise.
    const { phase, phaseTime } = life
    const height =
      phase === 'formup'
        ? spot.top - (spot.top - spot.bottom) * smooth(Math.min(1, phaseTime / 2.5))
        : phase === 'salute'
          ? spot.bottom + (spot.top - spot.bottom) * smooth(Math.min(1, phaseTime / 6))
          : spot.top
    life.flag.position.copy(life.toWorld(spot.x + 0.025, height, spot.z))
    life.flag.rotation.y = life.turn
    const pos = life.flag.geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      pos.setZ(i, Math.sin(x * 18 - this.time * 6) * 0.03 * (x / 0.34))
    }
    pos.needsUpdate = true
  }

  // ---- The sentry in the watchtower: looking slowly round, now and then through binoculars.

  private watch(life: BaseLife) {
    const s = life.sentry
    s.root.rotation.y = life.turn + Math.sin(this.time * 0.35) * 1.6
    const looking = Math.sin(this.time * 0.35) > 0.6 || Math.sin(this.time * 0.35) < -0.6
    s.arms[0].rotation.z = s.arms[1].rotation.z = looking ? 2.3 : 0
    s.arms[0].rotation.x = looking ? -0.4 : 0
    s.arms[1].rotation.x = looking ? 0.4 : 0
  }

  // ---- The helicopter: parked, spin up, lift off, a lap of the town, land, spin down.

  private fly(life: BaseLife, dt: number) {
    const PARKED = 25
    const SPIN = 4
    const LIFT = 4
    const CIRCUIT = 24
    const total = PARKED + SPIN + LIFT + CIRCUIT + LIFT + SPIN
    life.heliTime = (life.heliTime + dt) % total
    const t = life.heliTime
    const radius = 7
    const cruise = 2.6
    let height = 0
    let angle = 0 // round the circuit
    let bank = 0
    let rotorTarget = 0
    if (t < PARKED) rotorTarget = 0
    else if (t < PARKED + SPIN) rotorTarget = 30
    else if (t < PARKED + SPIN + LIFT) {
      rotorTarget = 30
      height = cruise * smooth((t - PARKED - SPIN) / LIFT)
    } else if (t < PARKED + SPIN + LIFT + CIRCUIT) {
      rotorTarget = 30
      const u = (t - PARKED - SPIN - LIFT) / CIRCUIT
      angle = u * Math.PI * 2
      height = cruise + Math.sin(u * Math.PI) * 1.4
      bank = 0.35 * Math.sin(Math.min(1, u * 8) * Math.PI / 2) * Math.sin(Math.min(1, (1 - u) * 8) * Math.PI / 2)
    } else if (t < PARKED + SPIN + LIFT + CIRCUIT + LIFT) {
      rotorTarget = 30
      height = cruise * (1 - smooth((t - PARKED - SPIN - LIFT - CIRCUIT) / LIFT))
    } else rotorTarget = 0
    life.rotorSpeed += (rotorTarget - life.rotorSpeed) * Math.min(1, dt * 0.8)
    life.heli.rotor.rotation.y += life.rotorSpeed * dt
    life.heli.tail.rotation.z += life.rotorSpeed * dt * 1.5
    // The circuit: a circle that starts and ends over the pad, heading away from the base.
    const local = new THREE.Vector3(ARMY_BASE.pad.x + radius * (1 - Math.cos(angle)), 0.05 + height, ARMY_BASE.pad.z - radius * Math.sin(angle))
    const heading = new THREE.Vector3(Math.sin(angle), 0, -Math.cos(angle))
    this.placeHeli(life, local, heading, bank)
  }

  private placeHeli(life: BaseLife, local: THREE.Vector3, heading: THREE.Vector3, bank: number) {
    const world = life.toWorld(local.x, local.y, local.z)
    const h = heading.clone().applyAxisAngle(up, life.turn)
    life.heli.heli.position.copy(world)
    life.heli.heli.rotation.set(-bank, Math.atan2(-h.z, h.x), local.y > 0.3 ? -0.08 : 0)
  }
}
