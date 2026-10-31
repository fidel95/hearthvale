import * as THREE from 'three'
import type { City, PlacedBuilding } from './City'
import { edgeTiles } from './communityRules'
import { tileToWorld, type Tile } from './grid'
import { findPath } from './pathfinding'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { modelCopy } from './models'
import { nextTile, pathToFarthest, Polyline } from './routes'

// Everything that moves along roads and track: cars, buses, trains, and the
// army's marching squad and patrol jeep. Purely for looks, like PeopleView:
// nothing here changes the game or is saved, and the whole fleet is worked
// out again from the town whenever roads, track or stops change.
//
// - Cars: about one for every five residents. They wander the roads, keeping
//   to the right, and only turn back at a dead end.
// - Buses: one per bus stop (up to two), looping from stop to stop and
//   pausing at each; with a single stop, out to the far end and back.
// - Trains: from the station to the far end of the line and back, pausing at
//   each end; the locomotive pulls going out and pushes coming back.
// - Army: a jeep patrols the roads (the base's own life is ArmyView).

const MAX_CARS = 16
const LANE = 0.17 // how far right of the middle of the road vehicles drive
const SPEED = { car: 1.8, bus: 1.3, train: 2.2 } // tiles per second
const PAUSE = { bus: 2.5, train: 3 } // seconds stopped at each stop or end
const CAR_COLORS = ['#e0453a', '#2f7fe0', '#f2c230', '#f5f5f5', '#3fae6b', '#8a56d6', '#f08a24', '#2b2d33', '#e85d9b']
const OLIVE = '#5f6b3a'

// ---- Shapes: one set of geometries shared by every vehicle; built along +x.

const box = (w: number, h: number, d: number, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z)
const GEOMETRY = {
  wheel: new THREE.CylinderGeometry(0.04, 0.04, 0.03, 8).rotateX(Math.PI / 2),
  carBody: box(0.38, 0.1, 0.2, 0, 0.03),
  carCabin: box(0.2, 0.09, 0.18, -0.03, 0.13),
  busBody: box(0.8, 0.11, 0.24, 0, 0.035),
  busStripe: box(0.8, 0.012, 0.243, 0, 0.1),
  busWindows: box(0.74, 0.085, 0.236, 0.01, 0.145),
  busPillars: (() => {
    // Thin pillars between the side windows, both sides at once.
    const parts: THREE.BufferGeometry[] = []
    for (let x = -0.33; x <= 0.3; x += 0.11) parts.push(box(0.014, 0.085, 0.244, x, 0.145))
    return mergeGeometries(parts)!
  })(),
  busRoof: box(0.8, 0.03, 0.24, 0, 0.23),
  busRoofUnit: box(0.24, 0.03, 0.14, -0.12, 0.26),
  busWindshield: box(0.012, 0.11, 0.22, 0.396, 0.115),
  busSign: box(0.014, 0.026, 0.16, 0.398, 0.2),
  busBumpers: box(0.83, 0.03, 0.245, 0, 0.025),
  busLights: (() => {
    const parts = [-0.08, 0.08].map((z) => box(0.012, 0.022, 0.035, 0.405, 0.06, z))
    return mergeGeometries(parts)!
  })(),
  busDoor: box(0.09, 0.14, 0.006, 0.26, 0.04, 0.122), // on the right, the kerb side
  jeepBody: box(0.36, 0.1, 0.2, 0, 0.03),
  jeepBar: box(0.03, 0.1, 0.2, -0.05, 0.13),
  locoBody: box(0.72, 0.18, 0.22, 0, 0.06),
  locoCab: box(0.24, 0.12, 0.22, -0.22, 0.24),
  locoChimney: new THREE.CylinderGeometry(0.04, 0.05, 0.12, 8).translate(0.24, 0.3, 0),
  carriage: box(0.72, 0.2, 0.22, 0, 0.06),
  carriageWindows: box(0.6, 0.06, 0.226, 0, 0.16),
}
const materials = new Map<string, THREE.MeshLambertMaterial>()
function material(color: string) {
  let m = materials.get(color)
  if (!m) materials.set(color, (m = new THREE.MeshLambertMaterial({ color })))
  return m
}
const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)]

function build(parts: [THREE.BufferGeometry, string][], wheelsAt: number[] = []): THREE.Group {
  const g = new THREE.Group()
  for (const [geometry, color] of parts) {
    const mesh = new THREE.Mesh(geometry, material(color))
    mesh.castShadow = true
    g.add(mesh)
  }
  for (const x of wheelsAt) {
    for (const z of [-0.1, 0.1]) {
      const wheel = new THREE.Mesh(GEOMETRY.wheel, material('#222222'))
      wheel.position.set(x, 0.04, z)
      g.add(wheel)
    }
  }
  return g
}

const makeCar = (color: string) => build([[GEOMETRY.carBody, color], [GEOMETRY.carCabin, color]], [-0.12, 0.12])

// Cars from Kenney's Car Kit (CC0), with the simple car above if one can't load.
// The kit's cars point along +z with their wheels' middles at the origin.
const carKit = (name: string) => `${import.meta.env.BASE_URL}models/cars/${name}.glb`
const CAR_SCALE = 0.15
export function makeKitCar(name: string): THREE.Group {
  const g = new THREE.Group()
  const model = modelCopy(carKit(name), CAR_SCALE, () => {
    const fallback = makeCar(pick(CAR_COLORS))
    fallback.rotation.y = -Math.PI / 2 // undone below
    return fallback
  })
  model.rotation.y = Math.PI / 2 // face +x, like every vehicle here
  model.position.y = 0.3 * CAR_SCALE
  g.add(model)
  return g
}
const CAR_MODELS = ['sedan', 'suv', 'hatchback-sports', 'van', 'taxi', 'suv-luxury', 'sedan-sports', 'truck', 'sedan', 'suv']
// Service vehicles join the traffic once the town has where they work from.
const SERVICE_VEHICLES: [(id: string, category: string) => boolean, string][] = [
  [(id) => id === 'police-station', 'police'],
  [(id) => id === 'hospital', 'ambulance'],
  [(id) => id === 'fire-station', 'firetruck'],
  [(id) => id === 'recycling-center', 'garbage-truck'],
  [(id, category) => category === 'industry' || id === 'warehouse' || id === 'supermarket', 'delivery'],
]
const makeJeep = () => build([[GEOMETRY.jeepBody, OLIVE], [GEOMETRY.jeepBar, '#3b4226']], [-0.12, 0.12])
const makeBus = () =>
  build(
    [
      [GEOMETRY.busBody, '#f2c230'],
      [GEOMETRY.busStripe, '#ffffff'],
      [GEOMETRY.busWindows, '#2b3a4a'],
      [GEOMETRY.busPillars, '#f2c230'],
      [GEOMETRY.busRoof, '#f7f2e6'],
      [GEOMETRY.busRoofUnit, '#c9ccd2'],
      [GEOMETRY.busWindshield, '#2b3a4a'],
      [GEOMETRY.busSign, '#ffb238'],
      [GEOMETRY.busBumpers, '#3a3d42'],
      [GEOMETRY.busLights, '#fff6d6'],
      [GEOMETRY.busDoor, '#3a4a5a'],
    ],
    [-0.26, 0.24],
  )
const makeLoco = () => build([[GEOMETRY.locoBody, '#d23c32'], [GEOMETRY.locoCab, '#8f2a24'], [GEOMETRY.locoChimney, '#2b2d33']], [-0.22, 0.22])
const makeCarriage = (color: string) => build([[GEOMETRY.carriage, color], [GEOMETRY.carriageWindows, '#fff4d6']], [-0.22, 0.22])

const center = (t: Tile) => {
  const c = tileToWorld(t)
  return { x: c.x, z: c.z }
}
const place = (obj: THREE.Object3D, pose: { x: number; z: number; angle: number }, y = 0) => {
  obj.position.set(pose.x, y, pose.z)
  obj.rotation.y = pose.angle
}

// ---- The movers

interface Wanderer {
  object: THREE.Group
  from: Tile | null
  at: Tile
  to: Tile
  t: number
  speed: number
}

// Something going round a fixed route (bus, train, squad): distance along
// the line, and where along it to stop and wait.
interface Shuttle {
  objects: THREE.Group[]
  lines: Polyline[] // a bus: one loop; a train or squad: out, then back
  line: number
  s: number
  stops: number[][] // per line, the distances at which to pause
  nextStop: number
  pause: number
  pauseFor: number
  speed: number
  spacing: number // distance between the train's carriages, or the squad's rows
  kind: 'bus' | 'train'
  phase: number
}

export class TrafficView {
  private scene: THREE.Scene
  private city: City
  private cars: Wanderer[] = []
  private shuttles: Shuttle[] = []
  private dirty = true
  private visible = true
  private spawnTimer = 0
  private wantCars = 0
  private wantJeep = false
  private carModels = CAR_MODELS

  constructor(scene: THREE.Scene, city: City) {
    this.scene = scene
    this.city = city
    city.onChange((e) => {
      if (['added', 'removed', 'moved', 'finished', 'stored', 'restored'].includes(e.kind)) this.dirty = true
    })
  }

  // Turned off in Settings: every vehicle leaves at once.
  setVisible(visible: boolean) {
    this.visible = visible
    this.dirty = true
    if (!visible) this.clearAll()
  }

  update(dt: number) {
    if (!this.visible) return
    if (this.dirty) this.replan()
    this.spawnTimer -= dt
    if (this.spawnTimer <= 0 && (this.cars.length < this.wantCars + (this.wantJeep ? 1 : 0))) {
      this.spawnTimer = 0.7
      this.spawnCar(this.wantJeep && !this.cars.some((c) => c.object.userData.jeep))
    }
    for (const car of [...this.cars]) this.driveCar(car, dt)
    for (const s of this.shuttles) this.runShuttle(s, dt)
  }

  // Work out the fleet from the town as it is now.
  private replan() {
    this.dirty = false
    const all = [...this.city.all()]
    const roads = all.filter((b) => b.type.category === 'road').length
    const residents = all.reduce((sum, b) => sum + (this.city.isBuilt(b) ? (b.type.residents ?? 0) : 0), 0)
    const base = all.find((b) => b.type.id === 'army-base' && this.city.isBuilt(b))
    this.wantCars = roads >= 3 ? Math.min(MAX_CARS, Math.floor(residents / 5)) : 0
    this.wantJeep = base !== undefined && this.city.isOperating(base) // the jeep needs a road out
    const built = all.filter((b) => this.city.isBuilt(b))
    this.carModels = [...CAR_MODELS, ...SERVICE_VEHICLES.filter(([has]) => built.some((b) => has(b.type.id, b.type.category))).map(([, name]) => name)]
    // Cars that lost their road leave; too many cars, the extras leave.
    for (const car of [...this.cars]) if (!this.city.isRoad(car.at) || !this.city.isRoad(car.to)) this.removeCar(car)
    while (this.cars.length > this.wantCars + (this.wantJeep ? 1 : 0)) this.removeCar(this.cars[this.cars.length - 1])
    if (!this.wantJeep) for (const car of [...this.cars]) if (car.object.userData.jeep) this.removeCar(car)

    // Buses, trains and the squad follow routes, so they start over on new ones.
    for (const s of this.shuttles) for (const o of s.objects) this.scene.remove(o)
    this.shuttles = []
    this.planBuses(all)
    this.planTrain(all)
  }

  private clearAll() {
    for (const car of [...this.cars]) this.removeCar(car)
    for (const s of this.shuttles) for (const o of s.objects) this.scene.remove(o)
    this.shuttles = []
  }

  // ---- Cars (and the jeep)

  private spawnCar(jeep: boolean) {
    const roads = [...this.city.all()].filter((b) => b.type.category === 'road')
    if (roads.length === 0) return
    const at = pick(roads).tile
    const to = nextTile(null, at, this.city.isRoad)
    if (!to) return
    const object = jeep ? makeJeep() : makeKitCar(pick(this.carModels))
    object.userData.jeep = jeep
    this.scene.add(object)
    this.cars.push({ object, from: null, at, to, t: 0, speed: SPEED.car * (0.85 + Math.random() * 0.3) })
  }

  private removeCar(car: Wanderer) {
    this.scene.remove(car.object)
    this.cars.splice(this.cars.indexOf(car), 1)
  }

  private driveCar(car: Wanderer, dt: number) {
    car.t += car.speed * dt
    while (car.t >= 1) {
      car.t -= 1
      const next = nextTile(car.at, car.to, this.city.isRoad)
      if (!next) return this.removeCar(car)
      car.from = car.at
      car.at = car.to
      car.to = next
    }
    // Between two tile centers, in the right-hand lane (no new objects each frame).
    const a = center(car.at)
    const b = center(car.to)
    const dx = b.x - a.x
    const dz = b.z - a.z
    car.object.position.set(a.x + dx * car.t - dz * LANE, 0, a.z + dz * car.t + dx * LANE)
    car.object.rotation.y = Math.atan2(-dz, dx)
  }

  // ---- Buses

  private planBuses(all: PlacedBuilding[]) {
    const stops = all
      .filter((b) => b.type.id === 'bus-stop' && this.city.isOperating(b))
      .map((b) => edgeTiles(b).find(this.city.isRoad))
      .filter((t): t is Tile => t !== undefined)
    if (stops.length === 0) return
    // Visit the stops nearest-first, then back to the first: one loop.
    const order = [stops[0]]
    const left = stops.slice(1)
    while (left.length > 0) {
      const last = order[order.length - 1]
      left.sort((a, b) => Math.hypot(a.x - last.x, a.z - last.z) - Math.hypot(b.x - last.x, b.z - last.z))
      order.push(left.shift()!)
    }
    // With one stop, the bus goes out to the far end of the road and back.
    if (order.length === 1) order.push(pathToFarthest(order[0], this.city.isRoad).at(-1)!)
    const tiles: Tile[] = [order[0]]
    const stopIndexes = [0]
    for (let i = 0; i < order.length; i++) {
      const leg = findPath(order[i], order[(i + 1) % order.length], this.city.isRoad)
      if (!leg) return // not all on one road network: no bus
      tiles.push(...leg.slice(1))
      stopIndexes.push(tiles.length - 1)
    }
    if (tiles.length < 3) return
    const line = new Polyline(tiles.map(center))
    // Where each stop is along the loop. The loop ends back at the first stop,
    // so its start isn't counted again (or the bus would wait there twice).
    const stopDistances = stopIndexes.slice(1).map((i) => new Polyline(tiles.slice(0, i + 1).map(center)).length)
    const buses = Math.min(2, stops.length)
    for (let i = 0; i < buses; i++) {
      const object = makeBus()
      this.scene.add(object)
      const s = (line.length * i) / buses
      this.shuttles.push({
        kind: 'bus', objects: [object], lines: [line], line: 0, s,
        stops: [stopDistances], nextStop: stopDistances.findIndex((d) => d >= s), pause: 0, pauseFor: PAUSE.bus,
        speed: SPEED.bus, spacing: 0, phase: 0,
      })
    }
  }

  // ---- Trains

  private planTrain(all: PlacedBuilding[]) {
    const station = all.find((b) => b.type.id === 'train-station' && this.city.isOperating(b))
    const start = station && edgeTiles(station).find(this.city.isRail)
    if (!start) return
    const path = pathToFarthest(start, this.city.isRail)
    if (path.length < 3) return
    const out = new Polyline(path.map(center))
    const back = new Polyline([...path].reverse().map(center))
    const spacing = 0.8
    const carriages = Math.max(1, Math.min(3, Math.floor(out.length / spacing) - 1))
    const objects = [makeLoco(), ...Array.from({ length: carriages }, (_, i) => makeCarriage(['#3f8f5c', '#2f6fbf', '#3f8f5c'][i]))]
    for (const o of objects) this.scene.add(o)
    const length = spacing * (objects.length - 1)
    this.shuttles.push({
      kind: 'train', objects, lines: [out, back], line: 0, s: length,
      stops: [[out.length], [back.length]], nextStop: 0, pause: PAUSE.train, pauseFor: PAUSE.train,
      speed: SPEED.train, spacing, phase: 0,
    })
  }

  // ---- The army

  // ---- Moving along a route

  private runShuttle(s: Shuttle, dt: number) {
    if (s.pause > 0) {
      s.pause -= dt
    } else {
      s.s += s.speed * dt
      s.phase += dt * 9
      const stops = s.stops[s.line]
      const stopAt = stops[s.nextStop]
      if (stopAt !== undefined && s.s >= stopAt) {
        s.s = stopAt
        s.pause = s.pauseFor
        s.nextStop++
      }
      const line = s.lines[s.line]
      if (s.s >= line.length && s.pause <= 0) {
        // End of the line: a loop starts over; out-and-back turns around.
        s.line = (s.line + 1) % s.lines.length
        s.s = s.kind === 'train' ? s.spacing * (s.objects.length - 1) : 0
        s.nextStop = 0
      }
    }
    const line = s.lines[s.line]
    if (s.kind === 'bus') return place(s.objects[0], line.at(s.s, LANE))
    if (s.kind === 'train') {
      // Out, the locomotive leads; back, it pushes from the rear.
      const n = s.objects.length
      for (let i = 0; i < n; i++) {
        const object = s.line === 0 ? s.objects[i] : s.objects[n - 1 - i]
        place(object, line.at(s.s - i * s.spacing))
      }
    }
  }
}
