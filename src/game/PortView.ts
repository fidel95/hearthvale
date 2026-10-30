import * as THREE from 'three'
import type { City, PlacedBuilding } from './City'
import { footprint } from './buildings'
import { shown } from './CityView'
import { edgeTiles } from './communityRules'
import { SHIPMENT_OPTIONS, type Docks } from './Docks'
import { footprintCenter, GRID_SIZE, tileToWorld, type Tile } from './grid'
import { findPath } from './pathfinding'
import { isSharedGeometry, modelCopy } from './models'
import { pathToFarthest, Polyline } from './routes'
import { makeKitCar } from './TrafficView'
import { isWater } from './terrain'

// Life at the docks, worked out from each dock's shipment. Purely for looks:
// nothing here changes the game or is saved.
//
// Each dock has its own cargo ship, a gantry crane on the quay, and stacks of
// containers. The ship waits at its berth, alongside the quay. When you order
// a shipment, the crane loads the waiting export containers aboard, the ship
// casts off and sails out to sea, and it comes back full just as the shipment
// arrives. Unloading it, the crane lifts the containers onto the quay, and
// trucks drive them into town, to a shop or warehouse, and come back with
// more containers to export.
//
// The ship's voyage depends only on the shipment's times, so it's in the right
// place even after the game was closed; the crane and the trucks play out
// from when you watch them.
//
// Everything at a dock is drawn in the dock's own frame: x points out to sea
// from the middle of the quay's seaward edge, z runs along that edge.

const DECK = 0.2 // the quay's top (the dock model's deck)
const BERTH = 0.6 // the moored ship's middle, out from the quay edge
const FAR = 36 // how far out to sea the ship goes before it's out of sight
const LIFT = 2.6 // seconds the crane takes to move one container
const HOOK_TOP = 1.25 // how high the crane lifts containers, above the water
const TRUCK_SPEED = 1.5 // tiles per second
const LANE = 0.17
const WATERLINE = -0.05 // how low the ship sits in the water

// The models are Kenney's Watercraft Kit (CC0), drawn at a quarter size.
const watercraft = (name: string) => `${import.meta.env.BASE_URL}models/watercraft/${name}.glb`
const SCALE = 0.25
// Containers come in three colors; each is 0.69 long, 0.345 wide and this tall.
const KINDS = ['a', 'b', 'c']
const FALLBACK_COLORS: Record<string, string> = { a: '#f26b4a', b: '#5b8de0', c: '#4fc98a' }
const HIGH = 0.275
const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)]

// Container spots. On the ship (its own coordinates) they sit crosswise in a
// row of three, two high. On the quay (the dock's frame) they lie the same
// way, so the crane never has to turn them: imports in two rows of four, two
// high, and exports behind them.
const SHIP_DECK = 1.1 * SCALE
const SHIP_SLOTS = [0, 1].flatMap((level) => [0.02, -0.45, -0.92].map((z) => ({ x: 0, z, y: SHIP_DECK + level * HIGH })))
const IMPORT_SLOTS = [0, 1].flatMap((level) => [-0.6, -0.2, 0.2, 0.6].map((s) => ({ r: -1.0, s, y: DECK + level * HIGH })))
const EXPORT_SLOTS = [
  { r: -1.72, s: -0.4, y: DECK },
  { r: -1.72, s: 0.02, y: DECK },
  { r: -1.72, s: -0.4, y: DECK + HIGH },
]

// ---- Shapes: shared by every dock

const materials = new Map<string, THREE.MeshStandardMaterial>()
function material(color: string) {
  let m = materials.get(color)
  if (!m) materials.set(color, (m = new THREE.MeshStandardMaterial({ color, flatShading: true })))
  return m
}
// A box whose bottom sits at y.
const box = (w: number, h: number, d: number, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z)

function part(parent: THREE.Object3D, geometry: THREE.BufferGeometry, color: string, shadow = true) {
  const mesh = new THREE.Mesh(geometry, material(color))
  mesh.castShadow = shadow
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

// A container of one of the three kinds, lying crosswise (its length along
// x), its bottom at the origin. setKind swaps it for another color.
function container(kind: string, scale = SCALE): THREE.Group {
  const holder = new THREE.Group()
  holder.userData.scale = scale
  setKind(holder, kind)
  return holder
}

function setKind(holder: THREE.Object3D, kind: string) {
  if (holder.userData.kind === kind) return
  holder.userData.kind = kind
  for (const child of [...holder.children]) {
    holder.remove(child)
    dispose(child)
  }
  const scale: number = holder.userData.scale
  const copy = modelCopy(watercraft(`cargo-container-${kind}`), scale, () => {
    const mesh = new THREE.Mesh(box(1.38 * scale, 1.1 * scale, 2.76 * scale), material(FALLBACK_COLORS[kind]))
    mesh.castShadow = true
    return mesh
  })
  copy.rotation.y = Math.PI / 2
  holder.add(copy)
}

function containerAt(parent: THREE.Object3D, kind: string, at: { x: number; y: number; z: number }) {
  const holder = container(kind)
  holder.position.set(at.x, at.y, at.z)
  holder.visible = false
  parent.add(holder)
  return holder
}

// The cargo ship (an empty hull), pointing along +z, with room for six containers.
function createShip(): { object: THREE.Group; slots: THREE.Object3D[] } {
  const g = new THREE.Group()
  g.add(modelCopy(watercraft('ship-cargo-c'), SCALE, () => {
    const hull = new THREE.Group()
    part(hull, box(0.9, 0.2, 2.6), '#e0553f')
    part(hull, box(0.5, 0.35, 0.4, 0, 0.2, 0.9), '#f2f2f2')
    return hull
  }))
  const slots = SHIP_SLOTS.map((slot) => containerAt(g, 'a', slot))
  return { object: g, slots }
}

// The gantry crane, a ship-to-shore container crane: a portal frame on four
// legs that rolls along the quay (z) on rails, a boom reaching out over the
// ship and back over the quay (x), held by stays from an A-frame on top, and
// a trolley with the driver's cab running along under the boom, lowering the
// spreader on its cables.
const BOOM_Y = 1.38 // the boom's underside, above the deck
function createCrane() {
  const gantry = new THREE.Group()
  const yellow = '#e8b33a'
  const steel = '#3a3d42'
  // A beam between two points, of a given thickness.
  const beam = (a: [number, number, number], b: [number, number, number], thick: number, color: string) => {
    const from = new THREE.Vector3(...a)
    const to = new THREE.Vector3(...b)
    const geometry = new THREE.BoxGeometry(thick, thick, from.distanceTo(to))
    const mesh = part(gantry, geometry, color)
    mesh.position.copy(from).lerp(to, 0.5)
    mesh.lookAt(to) // the gantry is still at the origin while it is built
    return mesh
  }
  const legs = [-0.55, -0.05]
  const side = 0.25
  for (const x of legs) {
    for (const z of [-side, side]) beam([x, 0.06, z], [x, BOOM_Y, z], 0.07, yellow)
    beam([x, BOOM_Y - 0.04, -side], [x, BOOM_Y - 0.04, side], 0.07, yellow) // portal beam
    beam([x, 0.42, -side], [x, 0.42, side], 0.05, yellow) // a lower brace
    part(gantry, box(0.12, 0.06, 0.66, x, 0, 0), steel) // wheel bogies on the rail
  }
  for (const z of [-side, side]) beam([legs[0], 0.08, z], [legs[1], 0.08, z], 0.05, yellow) // sill beams
  // The boom: two girders with cross ties, from the back of the quay to over the ship.
  const back = -1.95
  const tip = 1.25
  for (const z of [-0.2, 0.2]) part(gantry, box(tip - back, 0.08, 0.05, (tip + back) / 2, BOOM_Y, z), yellow)
  for (let x = back + 0.1; x < tip; x += 0.42) part(gantry, box(0.04, 0.04, 0.4, x, BOOM_Y + 0.04, 0), yellow)
  // The A-frame and its stays.
  const apex: [number, number, number] = [-0.3, 2.05, 0]
  for (const z of [-0.2, 0.2]) {
    beam([-0.3, BOOM_Y + 0.08, z], [apex[0], apex[1], z * 0.4], 0.06, yellow)
    beam([apex[0], apex[1] - 0.02, z * 0.4], [tip - 0.05, BOOM_Y + 0.08, z], 0.03, steel) // forestay
    beam([apex[0], apex[1] - 0.02, z * 0.4], [back + 0.15, BOOM_Y + 0.08, z], 0.03, steel) // backstay
  }
  beam([apex[0], apex[1], -0.1], [apex[0], apex[1], 0.1], 0.07, yellow)
  // The machinery house on the back of the boom.
  part(gantry, box(0.42, 0.22, 0.46, -1.6, BOOM_Y + 0.08, 0), '#f2f2f2')
  part(gantry, box(0.44, 0.04, 0.48, -1.6, BOOM_Y + 0.3, 0), '#2f6fbf')

  const trolley = new THREE.Group()
  trolley.position.y = BOOM_Y
  gantry.add(trolley)
  part(trolley, box(0.24, 0.07, 0.44, 0, -0.03, 0), steel)
  part(trolley, box(0.16, 0.13, 0.15, 0.02, -0.17, 0.12), '#f2f2f2') // the driver's cab
  part(trolley, box(0.165, 0.05, 0.155, 0.02, -0.12, 0.12), '#2b3a4a', false) // its windows
  // Each cable hangs from the trolley, 1 long, stretched to the hook's depth.
  const cables = [-0.12, 0.12].map((z) => part(trolley, box(0.015, 1, 0.015, 0, -1, z), '#2b2d33', false))
  const spreader = part(trolley, box(0.7, 0.05, 0.36), yellow)
  return { gantry, trolley, cables, spreader }
}

// A flatbed truck from the Car Kit, facing +x, with a container on its bed.
function createTruck() {
  const g = makeKitCar('delivery-flat')
  const load = container('a', 0.12)
  load.rotation.y = Math.PI / 2
  load.position.set(-0.08, 0.1, 0)
  g.add(load)
  return { object: g, load }
}

// ---- Paths at sea, in the dock's frame (x out to sea, z along the quay)

interface SeaPose {
  x: number
  z: number
  heading: number
}

// A path through points, with where something is after a share (0–1) of it.
class SeaPath {
  private points: { x: number; z: number }[]
  private cumulative = [0]
  constructor(points: { x: number; z: number }[]) {
    this.points = points
    for (let i = 1; i < points.length; i++) {
      this.cumulative.push(this.cumulative[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z))
    }
  }
  at(share: number): SeaPose {
    const p = this.points
    const total = this.cumulative[p.length - 1]
    const d = THREE.MathUtils.clamp(share, 0, 1) * total
    let i = 1
    while (i < p.length - 1 && this.cumulative[i] < d) i++
    const a = p[i - 1]
    const b = p[i]
    const t = (d - this.cumulative[i - 1]) / (this.cumulative[i] - this.cumulative[i - 1] || 1)
    // The ship points along its +z, so this heading turns +z toward (dx, dz).
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, heading: Math.atan2(b.x - a.x, b.z - a.z) }
  }
}

// A quarter-circle-ish turn (a quadratic curve), then straight on.
function curve(from: { x: number; z: number }, via: { x: number; z: number }, to: { x: number; z: number }) {
  const points = []
  for (let i = 0; i <= 12; i++) {
    const t = i / 12
    const u = 1 - t
    points.push({ x: u * u * from.x + 2 * u * t * via.x + t * t * to.x, z: u * u * from.z + 2 * u * t * via.z + t * t * to.z })
  }
  return points
}

// Leaving: forward along the quay, a turn out to sea, then straight out.
const DEPART = new SeaPath([...curve({ x: BERTH, z: 0 }, { x: BERTH, z: 3 }, { x: BERTH + 3, z: 3 }), { x: BERTH + 3 + FAR, z: 3 }])
// Coming back: in from the sea, a turn alongside, gliding into the berth.
const ARRIVE = new SeaPath([{ x: BERTH + 3 + FAR, z: -3 }, ...curve({ x: BERTH + 3, z: -3 }, { x: BERTH, z: -3 }, { x: BERTH, z: 0 })])

// ---- The crane's work: a list of lifts, each from one spot to another.

interface Spot {
  x: number
  z: number
  y: number // where the container's bottom sits
}

interface Lift {
  from: Spot
  to: Spot
  color: string
}

interface CraneJob {
  lifts: Lift[]
  start: number
  lift: number // seconds per lift
  meshes: THREE.Object3D[]
  done: () => void
}

const REST: Spot = { x: 0.2, z: 0, y: HOOK_TOP }

// Where the hook is, and which container it holds, at a moment of a job.
function hookAt(job: CraneJob, seconds: number): { spot: Spot; carrying: number; phase: number[] } {
  const u = Math.max(0, (seconds - job.start) / job.lift)
  const i = Math.min(job.lifts.length - 1, Math.floor(u))
  const f = Math.min(1, u - i)
  const lift = job.lifts[i]
  const before = i === 0 ? REST : job.lifts[i - 1].to
  const top = (s: Spot) => ({ ...s, y: HOOK_TOP })
  const lerp = (a: Spot, b: Spot, t: number): Spot => {
    const k = THREE.MathUtils.smoothstep(t, 0, 1)
    return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, y: a.y + (b.y - a.y) * k }
  }
  const above = (s: Spot) => ({ ...s, y: s.y + HIGH }) // the hook on top of a container
  // Per container: 0 still waiting, 1 on the hook, 2 set down.
  const phase = job.lifts.map((_, j) => (j < i ? 2 : j > i ? 0 : f < 0.4 ? 0 : f < 0.92 ? 1 : 2))
  let spot: Spot
  if (f < 0.25) spot = lerp(top(before), top(lift.from), f / 0.25)
  else if (f < 0.4) spot = lerp(top(lift.from), above(lift.from), (f - 0.25) / 0.15)
  else if (f < 0.55) spot = lerp(above(lift.from), top(lift.from), (f - 0.4) / 0.15)
  else if (f < 0.8) spot = lerp(top(lift.from), top(lift.to), (f - 0.55) / 0.25)
  else if (f < 0.92) spot = lerp(top(lift.to), above(lift.to), (f - 0.8) / 0.12)
  else spot = lerp(above(lift.to), top(lift.to), (f - 0.92) / 0.08)
  return { spot, carrying: phase.indexOf(1), phase }
}

// ---- Trucks

interface Truck {
  object: THREE.Group
  out: Polyline
  back: Polyline
  load: THREE.Object3D
  leg: 'out' | 'unloading' | 'back'
  distance: number
  wait: number
  bringsExport: boolean
}

interface Port {
  dock: PlacedBuilding
  frame: THREE.Group
  quay: THREE.Group // things standing on the quay (rails, office, lamps)
  ship: THREE.Group
  shipSlots: THREE.Object3D[]
  crane: ReturnType<typeof createCrane>
  exports: THREE.Object3D[]
  imports: THREE.Object3D[]
  exportCount: number
  importCount: number
  aboard: (string | null)[] // each ship slot's container, if any
  job: CraneJob | null
  order: number | null // the shipment being shown (its order time)
  loadEnd: number // when the ship's loaded and casts off
  arrived: boolean // back with its cargo (and the containers shown aboard)
  importColors: string[]
  trucks: Truck[]
  truckWait: number
  routeOut: Polyline | null
  routeBack: Polyline | null
}

export class PortView {
  private scene: THREE.Scene
  private city: City
  private docks: Docks
  private ports = new Map<number, Port>()
  private dirty = true

  constructor(scene: THREE.Scene, city: City, docks: Docks) {
    this.scene = scene
    this.city = city
    this.docks = docks
    city.onChange((e) => {
      if (['added', 'removed', 'moved', 'finished', 'stored', 'restored'].includes(e.kind)) this.dirty = true
    })
  }

  // Called every frame with the seconds since the last one, the time so far
  // (for the swell and the crane) and the clock time (for the shipments).
  update(dt: number, seconds: number, now: number) {
    if (this.dirty) this.refresh()
    for (const port of this.ports.values()) {
      this.updateShip(port, seconds, now)
      this.updateCrane(port, seconds)
      this.updateTrucks(port, dt)
    }
  }

  // The dock whose ship, crane or containers a ray hits first (they stand
  // over the water and above the land behind, so a tap on them wouldn't
  // otherwise find the dock).
  hit(ray: THREE.Raycaster): { id: number; distance: number } | null {
    let best: { id: number; distance: number } | null = null
    for (const [id, port] of this.ports) {
      const first = ray.intersectObject(port.frame, true).find((h) => shown(h.object))
      if (first && (!best || first.distance < best.distance)) best = { id, distance: first.distance }
    }
    return best
  }

  // Docks built, moved or gone: set up, move or remove their ports.
  private refresh() {
    this.dirty = false
    const docks = [...this.city.all()].filter((b) => b.type.category === 'port' && this.city.isBuilt(b))
    for (const [id, port] of this.ports) {
      if (!docks.includes(port.dock)) this.removePort(id)
    }
    for (const dock of docks) {
      const port = this.ports.get(dock.id) ?? this.createPort(dock)
      this.placePort(port)
    }
  }

  private createPort(dock: PlacedBuilding): Port {
    const frame = new THREE.Group()
    const quay = new THREE.Group()
    frame.add(quay)
    const { object: ship, slots } = createShip()
    frame.add(ship)
    const crane = createCrane()
    crane.gantry.position.y = DECK
    frame.add(crane.gantry)
    const exports = EXPORT_SLOTS.map((s) => containerAt(frame, pick(KINDS), { x: s.r, y: s.y, z: s.s }))
    const imports = IMPORT_SLOTS.map((s) => containerAt(frame, 'a', { x: s.r, y: s.y, z: s.s }))
    this.scene.add(frame)
    const port: Port = {
      dock,
      frame,
      quay,
      ship,
      shipSlots: slots,
      crane,
      exports,
      imports,
      exportCount: EXPORT_SLOTS.length,
      importCount: 0,
      aboard: SHIP_SLOTS.map(() => null),
      job: null,
      order: null,
      loadEnd: 0,
      arrived: false,
      importColors: [],
      trucks: [],
      truckWait: 0,
      routeOut: null,
      routeBack: null,
    }
    this.ports.set(dock.id, port)
    return port
  }

  // Line the frame up with the dock's seaward edge (the side with the most
  // water), lay the quay out along it, and work out the trucks' route.
  private placePort(port: Port) {
    const dock = port.dock
    const size = footprint(dock.type, dock.rotation)
    const { x, z } = dock.tile
    const sides = [
      { nx: 1, nz: 0, tiles: edgeTiles(dock).filter((t) => t.x === x + size.x) },
      { nx: -1, nz: 0, tiles: edgeTiles(dock).filter((t) => t.x === x - 1) },
      { nx: 0, nz: 1, tiles: edgeTiles(dock).filter((t) => t.z === z + size.z) },
      { nx: 0, nz: -1, tiles: edgeTiles(dock).filter((t) => t.z === z - 1) },
    ]
    const sea = sides.reduce((best, side) => (side.tiles.filter(isWater).length > best.tiles.filter(isWater).length ? side : best))
    const depth = sea.nx !== 0 ? size.x : size.z // from the seaward edge to the back of the quay
    const length = sea.nx !== 0 ? size.z : size.x // along the quay
    const center = footprintCenter(dock.tile, size)
    port.frame.position.set(center.x + (sea.nx * depth) / 2, 0, center.z + (sea.nz * depth) / 2)
    // Turns the frame's +x to point out to sea.
    port.frame.rotation.y = Math.atan2(-sea.nz, sea.nx)
    port.frame.updateMatrixWorld()

    dispose(port.quay)
    port.quay.clear()
    for (const r of [-0.55, -0.05]) part(port.quay, box(0.05, 0.015, length * 0.98, r, DECK), '#55585e', false) // crane rails
    // The harbor office at the back corner, and lamps along the edge.
    part(port.quay, box(0.5, 0.4, 0.6, -depth + 0.4, DECK, length / 2 - 0.45), '#eef0f2')
    part(port.quay, box(0.56, 0.05, 0.66, -depth + 0.4, DECK + 0.4, length / 2 - 0.45), '#2f6fbf')
    part(port.quay, box(0.02, 0.15, 0.3, -depth + 0.66, DECK + 0.08, length / 2 - 0.45), '#2b3a4a', false) // its window
    for (const zz of [-length / 2 + 0.15, length / 2 - 0.15]) {
      part(port.quay, box(0.03, 0.7, 0.03, -0.12, DECK, zz), '#3a3d42')
      const light = new THREE.Mesh(box(0.1, 0.05, 0.08, -0.12, DECK + 0.7, zz), new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffd27a', emissiveIntensity: 0.6 }))
      port.quay.add(light)
    }

    this.planRoute(port)
  }

  private removePort(id: number) {
    const port = this.ports.get(id)!
    for (const truck of [...port.trucks]) this.removeTruck(port, truck)
    this.scene.remove(port.frame)
    dispose(port.frame)
    this.ports.delete(id)
  }

  private removeTruck(port: Port, truck: Truck) {
    this.scene.remove(truck.object)
    dispose(truck.load) // the truck itself is the Car Kit's (or traffic's simple car), shared
    port.trucks.splice(port.trucks.indexOf(truck), 1)
  }

  // ---- The ship

  private updateShip(port: Port, seconds: number, now: number) {
    const state = this.docks.state(port.dock, now)
    const shipment = state.stage === 'idle' ? null : state.shipment
    const full = shipment ? (SHIPMENT_OPTIONS.find((o) => o.id === shipment.optionId)?.units ?? shipment.units) : 1

    if (shipment && shipment.orderedAt !== port.order) {
      // A new order. If it was just placed, the crane loads the exports first.
      this.finishJob(port)
      port.order = shipment.orderedAt
      port.arrived = false
      port.importColors = SHIP_SLOTS.map(() => pick(KINDS))
      const fresh = now - shipment.orderedAt < 1500
      const loading = fresh ? port.exportCount : 0
      const voyage = Math.max(1, shipment.arrivesAt - shipment.orderedAt)
      const lift = Math.min(LIFT, (voyage * 0.2) / 1000 / Math.max(1, loading))
      port.loadEnd = shipment.orderedAt + loading * lift * 1000
      if (loading > 0) {
        // Top of the stack first.
        const lifts = Array.from({ length: loading }, (_, j) => {
          const i = port.exportCount - 1 - j
          const s = EXPORT_SLOTS[i]
          return { from: { x: s.r, z: s.s, y: s.y }, to: this.shipSpot(j), color: port.exports[i].userData.kind as string }
        })
        port.exportCount -= loading
        this.startJob(port, lifts, lift, seconds, () => lifts.forEach((l, i) => (port.aboard[i] = l.color)))
      } else {
        port.aboard = SHIP_SLOTS.map(() => null)
      }
    }

    // Containers aboard once it's back: as many as the goods still to unload.
    const back = shipment !== null && now >= shipment.arrivesAt
    const ship = port.ship
    if (!shipment || back || now < port.loadEnd) {
      // At the berth.
      ship.visible = true
      ship.position.set(BERTH, WATERLINE + 0.01 * Math.sin(seconds * 1.2), 0)
      ship.rotation.set(0, 0, 0.012 * Math.sin(seconds * 1.3))
      if (back) {
        const left = Math.ceil((SHIP_SLOTS.length * shipment.units) / full)
        const aboard = port.aboard.filter((c) => c !== null).length
        if (!port.arrived) {
          // Just in (or seen for the first time since, after a reload).
          port.arrived = true
          port.aboard = port.importColors.map((c, i) => (i < left ? c : null))
        } else if (port.job === null && left < aboard) this.unload(port, aboard - left, seconds)
      } else if (!shipment && port.order !== null) {
        // Unloaded completely.
        port.order = null
        const aboard = port.aboard.filter((c) => c !== null).length
        if (aboard > 0 && port.job === null) this.unload(port, aboard, seconds)
      }
    } else {
      // At sea: out, out of sight, then back.
      const away = shipment.arrivesAt - port.loadEnd
      const out = Math.min(25_000, away * 0.4)
      const home = Math.min(30_000, away * 0.45)
      let pose: SeaPose | null = null
      if (now < port.loadEnd + out) {
        const t = (now - port.loadEnd) / out
        pose = DEPART.at(t * t) // gathering speed
      } else if (now > shipment.arrivesAt - home) {
        const t = (now - (shipment.arrivesAt - home)) / home
        pose = ARRIVE.at(1 - (1 - t) * (1 - t)) // slowing down
        port.aboard = [...port.importColors]
      }
      ship.visible = pose !== null
      if (pose) {
        ship.position.set(pose.x, WATERLINE + 0.03 * Math.sin(seconds * 1.2 + pose.x * 0.6 + pose.z * 0.4), pose.z)
        ship.rotation.set(0, pose.heading, 0.03 * Math.sin(seconds * 1.3))
      }
    }
    port.shipSlots.forEach((mesh, i) => {
      const color = port.aboard[i]
      mesh.visible = color !== null
      if (color) setKind(mesh, color)
    })
  }

  // Where a ship slot is, in the dock's frame, with the ship at its berth.
  private shipSpot(i: number): Spot {
    return { x: BERTH + SHIP_SLOTS[i].x, z: SHIP_SLOTS[i].z, y: WATERLINE + SHIP_SLOTS[i].y }
  }

  // Lift `count` containers off the ship onto the quay (as many as fit there;
  // the rest go straight onto waiting trucks, out of sight).
  private unload(port: Port, count: number, seconds: number) {
    const taken: number[] = []
    for (let i = port.aboard.length - 1; i >= 0 && taken.length < count; i--) if (port.aboard[i]) taken.push(i)
    const room = IMPORT_SLOTS.length - port.importCount
    const lifts = taken.slice(0, room).map((slot, j) => {
      const to = IMPORT_SLOTS[port.importCount + j]
      return { from: this.shipSpot(slot), to: { x: to.r, z: to.s, y: to.y }, color: port.aboard[slot]! }
    })
    for (const slot of taken) port.aboard[slot] = null
    const first = port.importCount
    this.startJob(port, lifts, LIFT, seconds, () => {
      lifts.forEach((l, j) => setKind(port.imports[first + j], l.color))
      port.importCount += lifts.length
      port.truckWait = Math.min(port.truckWait, 0.5)
    })
  }

  // ---- The crane

  private startJob(port: Port, lifts: Lift[], lift: number, seconds: number, done: () => void) {
    const meshes = lifts.map((l) => {
      const holder = container(l.color)
      port.frame.add(holder)
      return holder
    })
    port.job = { lifts, start: seconds, lift, meshes, done }
  }

  private finishJob(port: Port) {
    const job = port.job
    if (!job) return
    for (const holder of job.meshes) {
      port.frame.remove(holder)
      dispose(holder)
    }
    port.job = null
    job.done()
  }

  private updateCrane(port: Port, seconds: number) {
    const { gantry, trolley, cables, spreader } = port.crane
    let hook = REST
    const job = port.job
    if (job) {
      if (seconds >= job.start + job.lifts.length * job.lift) this.finishJob(port)
      else {
        const at = hookAt(job, seconds)
        hook = at.spot
        job.meshes.forEach((mesh, j) => {
          const lift = job.lifts[j]
          const s = at.phase[j] === 0 ? lift.from : at.phase[j] === 2 ? lift.to : { ...hook, y: hook.y - HIGH }
          mesh.position.set(s.x, s.y, s.z)
        })
      }
    }
    for (let i = 0; i < port.exports.length; i++) port.exports[i].visible = i < port.exportCount
    for (let i = 0; i < port.imports.length; i++) port.imports[i].visible = i < port.importCount
    gantry.position.z = hook.z
    trolley.position.x = hook.x
    // The trolley runs under the boom; the spreader sits on top of a container at the hook.
    const drop = DECK + BOOM_Y - hook.y
    spreader.position.y = -drop
    for (const cable of cables) cable.scale.y = Math.max(0.01, drop)
  }

  // ---- Trucks: from the quay to a shop or warehouse in town, and back

  private planRoute(port: Port) {
    port.routeOut = port.routeBack = null
    const isRoad = this.city.isRoad
    const starts = edgeTiles(port.dock).filter(isRoad)
    if (starts.length === 0) return
    const start = starts[0]
    // The nearest shop, factory or warehouse the roads reach; else the far end of the road.
    const goals = [...this.city.all()]
      .filter((b) => b !== port.dock && this.city.isBuilt(b) && (b.type.category === 'business' || b.type.category === 'industry' || (b.type.storage ?? 0) > 0))
      .sort((a, b) => dist(a.tile, start) - dist(b.tile, start))
      .slice(0, 6)
    let path: Tile[] | null = null
    for (const goal of goals) {
      const road = edgeTiles(goal).find(isRoad)
      if (road && (path = findPath(start, road, isRoad, { maxVisited: 3000 }))) break
    }
    if (!path || path.length < 3) path = pathToFarthest(start, isRoad)
    if (path.length < 3) return
    const quay = new THREE.Vector3(IMPORT_SLOTS[0].r, 0, 0).applyMatrix4(port.frame.matrixWorld)
    const points = [{ x: quay.x, z: quay.z }, ...path.map((t) => tileToWorld(t))]
    port.routeOut = new Polyline(points)
    port.routeBack = new Polyline([...points].reverse())
  }

  private updateTrucks(port: Port, dt: number) {
    port.truckWait -= dt
    if (port.importCount > 0 && port.truckWait <= 0 && port.trucks.length < 2) {
      port.truckWait = 3
      const color = port.imports[port.importCount - 1].userData.kind as string
      port.importCount--
      if (port.routeOut) {
        const { object, load } = createTruck()
        setKind(load, color)
        this.scene.add(object)
        port.trucks.push({ object, load, out: port.routeOut, back: port.routeBack!, leg: 'out', distance: 0, wait: 0, bringsExport: false })
      }
    }
    for (const truck of [...port.trucks]) {
      if (truck.leg === 'unloading') {
        truck.wait -= dt
        if (truck.wait <= 0) {
          // Back to the docks, with a container to export if the quay has room.
          const coming = port.trucks.filter((t) => t.leg === 'back' && t.bringsExport).length
          truck.bringsExport = port.exportCount + coming < EXPORT_SLOTS.length
          truck.load.visible = truck.bringsExport
          if (truck.bringsExport) setKind(truck.load, pick(KINDS))
          truck.leg = 'back'
          truck.distance = 0
        }
        continue
      }
      const route = truck.leg === 'back' ? truck.back : truck.out
      truck.distance += TRUCK_SPEED * dt
      const pose = route.at(truck.distance, LANE)
      // On the quay it drives on the deck.
      const { x, z } = port.dock.tile
      const size = footprint(port.dock.type, port.dock.rotation)
      const tile = { x: Math.floor(pose.x + GRID_SIZE / 2), z: Math.floor(pose.z + GRID_SIZE / 2) }
      const onQuay = tile.x >= x && tile.x < x + size.x && tile.z >= z && tile.z < z + size.z
      truck.object.position.set(pose.x, onQuay ? DECK : 0, pose.z)
      truck.object.rotation.y = pose.angle
      if (truck.distance >= route.length) {
        if (truck.leg === 'out') {
          truck.leg = 'unloading'
          truck.wait = 1.5
          truck.load.visible = false
        } else {
          if (truck.bringsExport && port.exportCount < EXPORT_SLOTS.length) {
            setKind(port.exports[port.exportCount], truck.load.userData.kind)
            port.exportCount++
          }
          this.removeTruck(port, truck)
        }
      }
    }
  }
}

const dist = (a: Tile, b: Tile) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z)

// Free the shapes (and any material of its own) of everything in a group,
// except the shared ones: models', and the colors every dock uses.
function dispose(root: THREE.Object3D) {
  const shared = new Set<THREE.Material>(materials.values())
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return
    if (isSharedGeometry(o.geometry)) return // a model's: shared with every copy
    o.geometry.dispose()
    if (!shared.has(o.material)) (o.material as THREE.Material).dispose()
  })
}
