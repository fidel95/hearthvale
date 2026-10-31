import * as THREE from 'three'
import { sizeOf, type City, type PlacedBuilding } from './City'
import { footprintCenter } from './grid'
import { modelCopy } from './models'

// Planes at the airport, for looks only (like TrafficView). One plane flies
// a full circuit, over and over: it lines up at one end of the runway, rolls
// and lifts off, climbs out and banks round the town, lands from the far end,
// slows to a stop, turns round, and next time goes the other way. A second
// plane waits at the terminal.
//
// Everything is worked out in the airport's own coordinates (x along the
// runway, y up) and then turned and moved to where the airport stands.

const RUNWAY_Z = 0.69 // the runway's center line (3-tile airport: d * 0.23)
const GROUND = 0.1 // wheels on the runway
const CRUISE = 5 // world units per second in the air
const TIMES = { wait: 4, roll: 3.5, landing: 3, turn: 2 } // seconds

// The flight, going +x: from lift-off round to touchdown. Mirrored for -x.
const FLIGHT = [
  [2.2, 0.15, 0],
  [6, 1.4, 0],
  [11, 3.8, -2.5],
  [9, 5.5, -10],
  [-7, 5.5, -10],
  [-12.5, 3.8, -3],
  [-8, 1.4, 0],
  [-3.1, 0.15, 0],
]
const ROLL_FROM = -3
const ROLL_TO = 2.2 // lift-off
const LAND_AT = -3.1 // touchdown
const STOP_AT = 2.9

// ---- The plane: a business jet (Jet by Poly by Google, CC-BY) along +x,
// wheels at y = 0, with simple shapes standing in if it can't load.

const JET_URL = `${import.meta.env.BASE_URL}models/aircraft/jet.glb`
const JET_SCALE = 0.13 // about 1.1 long
function makePlane(stripe: string): THREE.Group {
  const plane = new THREE.Group()
  const jet = modelCopy(JET_URL, JET_SCALE, () => {
    const simple = makeSimplePlane(stripe)
    simple.rotation.y = -Math.PI / 2 // undone below
    return simple
  })
  jet.rotation.y = Math.PI / 2 // the model's nose points along +z
  jet.position.y = 0.07 * JET_SCALE
  plane.add(jet)
  plane.rotation.order = 'YZX' // turn (yaw), then nose up/down (pitch), then bank (roll)
  return plane
}

const material = (color: string) => new THREE.MeshLambertMaterial({ color })
function makeSimplePlane(stripe: string): THREE.Group {
  const white = material('#f4f6f8')
  const parts: [THREE.BufferGeometry, THREE.Material][] = [
    [new THREE.CylinderGeometry(0.075, 0.06, 1, 10).rotateZ(Math.PI / 2).translate(0, 0.14, 0), white],
    [new THREE.SphereGeometry(0.075, 10, 6).scale(1.4, 1, 1).translate(0.5, 0.14, 0), white],
    [new THREE.BoxGeometry(0.98, 0.02, 0.152).translate(0, 0.12, 0), material(stripe)],
    [new THREE.BoxGeometry(0.26, 0.02, 0.95).translate(0.02, 0.12, 0), white],
    [new THREE.BoxGeometry(0.14, 0.02, 0.36).translate(-0.42, 0.16, 0), white],
    [new THREE.BoxGeometry(0.16, 0.2, 0.02).translate(-0.43, 0.25, 0), material(stripe)],
    [new THREE.CylinderGeometry(0.035, 0.035, 0.12, 8).rotateZ(Math.PI / 2).translate(0.06, 0.09, -0.22), material('#8a929c')],
    [new THREE.CylinderGeometry(0.035, 0.035, 0.12, 8).rotateZ(Math.PI / 2).translate(0.06, 0.09, 0.22), material('#8a929c')],
    [new THREE.BoxGeometry(0.03, 0.07, 0.2).translate(0, 0.035, 0), material('#2b2d33')],
  ]
  const plane = new THREE.Group()
  for (const [geometry, mat] of parts) {
    const mesh = new THREE.Mesh(geometry, mat)
    mesh.castShadow = true
    plane.add(mesh)
  }
  plane.rotation.order = 'YZX' // turn (yaw), then nose up/down (pitch), then bank (roll)
  return plane
}

type Phase = 'wait' | 'roll' | 'fly' | 'landing' | 'turn'

export class FlightView {
  private scene: THREE.Scene
  private city: City
  private dirty = true
  private visible = true
  private airport: PlacedBuilding | null = null
  private planes: THREE.Group[] = []
  private curves: THREE.CatmullRomCurve3[] = [] // the flight going +x, and going -x
  private phase: Phase = 'wait'
  private time = 0
  private direction: 1 | -1 = 1
  private lastYaw = 0

  constructor(scene: THREE.Scene, city: City) {
    this.scene = scene
    this.city = city
    city.onChange((e) => {
      if (['added', 'removed', 'moved', 'finished', 'stored', 'restored'].includes(e.kind)) this.dirty = true
    })
    this.curves = ([1, -1] as const).map((d) => new THREE.CatmullRomCurve3(FLIGHT.map(([x, y, z]) => new THREE.Vector3(x * d, y, z))))
  }

  setVisible(visible: boolean) {
    this.visible = visible
    this.dirty = true
    if (!visible) this.clear()
  }

  update(dt: number) {
    if (!this.visible) return
    if (this.dirty) this.replan()
    if (!this.airport) return
    this.time += dt
    const d = this.direction
    let x = ROLL_FROM * d
    let y = GROUND
    let z = 0
    let heading = new THREE.Vector3(d, 0, 0)
    switch (this.phase) {
      case 'wait':
        if (this.time >= TIMES.wait) this.next('roll')
        break
      case 'roll': {
        // Speeding up from a standstill to flying speed.
        const t = Math.min(1, this.time / TIMES.roll)
        x = (ROLL_FROM + (ROLL_TO - ROLL_FROM) * t * t) * d
        if (t >= 1) this.next('fly')
        break
      }
      case 'fly': {
        const curve = this.curves[d === 1 ? 0 : 1]
        const u = Math.min(1, (this.time * CRUISE) / curve.getLength())
        const p = curve.getPointAt(u)
        heading = curve.getTangentAt(u)
        ;[x, y, z] = [p.x, p.y, p.z]
        if (u >= 1) this.next('landing')
        break
      }
      case 'landing': {
        // Slowing from touchdown to a stop.
        const t = Math.min(1, this.time / TIMES.landing)
        x = (LAND_AT + (STOP_AT - LAND_AT) * (1 - (1 - t) * (1 - t))) * d
        if (t >= 1) this.next('turn')
        break
      }
      case 'turn': {
        // Turning round on the spot to face back down the runway.
        const t = Math.min(1, this.time / TIMES.turn)
        x = STOP_AT * d
        const angle = Math.PI * t
        heading = new THREE.Vector3(d * Math.cos(angle), 0, Math.sin(angle))
        if (t >= 1) {
          this.direction = d === 1 ? -1 : 1
          // Stopped at the far end, it now waits there to go the other way.
          this.next('wait')
        }
        break
      }
    }
    this.pose(this.planes[0], new THREE.Vector3(x, y, z), heading, dt)
  }

  private next(phase: Phase) {
    this.phase = phase
    this.time = 0
  }

  // Place a plane in airport coordinates, nose along heading, banking into turns.
  private pose(plane: THREE.Group, local: THREE.Vector3, heading: THREE.Vector3, dt: number) {
    const a = this.airport!
    const turn = (-a.rotation * Math.PI) / 2
    const up = new THREE.Vector3(0, 1, 0)
    const world = local.clone().add(new THREE.Vector3(0, 0, RUNWAY_Z)).applyAxisAngle(up, turn).add(footprintCenter(a.tile, sizeOf(a)))
    const h = heading.clone().applyAxisAngle(up, turn)
    const yaw = Math.atan2(-h.z, h.x)
    const pitch = Math.atan2(h.y, Math.hypot(h.x, h.z))
    // Bank by how fast the heading is turning (only in the air). The change
    // is wrapped to ±180°, so crossing from +179° to −179° is a small turn.
    let change = yaw - this.lastYaw
    if (change > Math.PI) change -= 2 * Math.PI
    if (change < -Math.PI) change += 2 * Math.PI
    const yawRate = change / Math.max(dt, 1e-3)
    this.lastYaw = yaw
    const bank = local.y > 0.5 ? THREE.MathUtils.clamp(-yawRate * 0.5, -0.6, 0.6) : 0
    plane.position.copy(world)
    plane.rotation.set(bank, yaw, pitch)
  }

  private replan() {
    this.dirty = false
    const airport = [...this.city.all()].find((b) => b.type.id === 'airport' && this.city.isBuilt(b)) ?? null
    if (airport === this.airport && this.planes.length > 0 && airport && this.samePlace(airport)) return
    this.clear()
    this.airport = airport
    if (!airport) return
    this.placed = `${airport.tile.x},${airport.tile.z},${airport.rotation}`
    this.planes = [makePlane('#2f7fe0'), makePlane('#e0453a')]
    for (const p of this.planes) this.scene.add(p)
    // The second plane, a little smaller, waits on the apron beside the
    // hangar, nose toward the runway. (Coordinates are from the runway's
    // center line: 1.24 back is in front of the hangar.)
    this.planes[1].scale.setScalar(0.8)
    this.pose(this.planes[1], new THREE.Vector3(1.3, 0.04, -1.24), new THREE.Vector3(0, 0, 1), 1)
    this.phase = 'wait'
    this.time = 0
    this.direction = 1
  }

  private placed = ''
  private samePlace(a: PlacedBuilding) {
    return this.placed === `${a.tile.x},${a.tile.z},${a.rotation}`
  }

  private clear() {
    for (const p of this.planes) this.scene.remove(p)
    this.planes = []
    this.airport = null
  }
}
