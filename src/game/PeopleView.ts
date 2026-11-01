import * as THREE from 'three'
import { sizeOf, type City, type PlacedBuilding } from './City'
import { inBounds, tileToWorld, type Tile } from './grid'
import { levelFactor } from './construction'
import { findPath } from './pathfinding'
import { isTrack } from './buildings'
import { turnToward } from './motion'
import { SIDEWALK } from './RoadView'

// Residents walking around town. Purely for looks: nothing here changes the
// game, and nothing is saved. Each home sends out about one walker per two
// residents. A walker leaves home, walks to a shop, a neighbor or a random
// spot (with A* pathfinding around buildings), pauses, and carries on or goes
// home, where it disappears and is replaced a little later.

const MAX_WALKERS = 40
const SPEED = 1.1 // tiles per second
const SPAWN_EVERY = 0.8 // seconds between new walkers, so they trickle out
const SHIRTS = ['#e0553f', '#3f7fe0', '#e8b33a', '#4fa36b', '#9b59b6', '#e67e9f', '#2bb3b1', '#f2f2f2']
const SKIN = ['#f1c9a5', '#d9a47c', '#a86f4c', '#6b4430']
const PANTS = ['#34405a', '#4a3b2f', '#2d2d2d', '#5a6b7a']

interface Walker {
  homeId: number
  object: THREE.Group
  path: Tile[]
  step: number // index of the tile being walked away from
  t: number // progress toward the next tile, 0 to 1
  offset: THREE.Vector2 // a small sideways shift so walkers don't overlap exactly
  side: 1 | -1 // which sidewalk they keep to along a road
  // The buildings at either end of the path: there, they stand on the
  // sidewalk on that building's side of the road.
  fromId: number | null
  toId: number | null
  pause: number // seconds left standing still
  goingHome: boolean
  lingerSeconds: number | null // how long to stay at the destination, if it's somewhere people linger
  tourist: boolean // a visitor: from a station, stop or airport to an attraction and back
  phase: number // for the walking bob
}

// One set of shapes shared by every walker; only the materials differ.
const SHAPES = {
  legs: new THREE.BoxGeometry(0.08, 0.12, 0.06).translate(0, 0.06, 0),
  body: new THREE.CylinderGeometry(0.06, 0.07, 0.15, 6).translate(0, 0.195, 0),
  head: new THREE.IcosahedronGeometry(0.055, 0).translate(0, 0.32, 0),
}
const UMBRELLA = {
  pole: new THREE.CylinderGeometry(0.008, 0.008, 0.22, 4).translate(0.05, 0.36, 0),
  canopy: new THREE.ConeGeometry(0.17, 0.08, 8).translate(0.05, 0.49, 0),
}
const UMBRELLA_COLORS = ['#e0453a', '#2f7fe0', '#ffd23f', '#2b2d33', '#ff5c8a', '#3fae6b']
const materials = new Map<string, THREE.MeshLambertMaterial>()
function material(color: string) {
  let m = materials.get(color)
  if (!m) materials.set(color, (m = new THREE.MeshLambertMaterial({ color })))
  return m
}

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)]

// Visitors stand out: a sun hat and a backpack.
const TOURIST = {
  brim: new THREE.CylinderGeometry(0.1, 0.1, 0.012, 10).translate(0, 0.37, 0),
  crown: new THREE.CylinderGeometry(0.045, 0.05, 0.05, 8).translate(0, 0.4, 0),
  pack: new THREE.BoxGeometry(0.06, 0.1, 0.09).translate(-0.07, 0.2, 0),
}

function createTourist(): THREE.Group {
  const person = createPerson()
  for (const [shape, color] of [
    [TOURIST.brim, '#f3e2b0'],
    [TOURIST.crown, '#f3e2b0'],
    [TOURIST.pack, pick(['#e0453a', '#2f7fe0', '#ffd23f', '#3fae6b'])],
  ] as const) {
    const mesh = new THREE.Mesh(shape, material(color))
    mesh.castShadow = true
    person.add(mesh)
  }
  return person
}

function createPerson(): THREE.Group {
  const person = new THREE.Group()
  for (const [shape, color] of [
    [SHAPES.legs, pick(PANTS)],
    [SHAPES.body, pick(SHIRTS)],
    [SHAPES.head, pick(SKIN)],
  ] as const) {
    const mesh = new THREE.Mesh(shape, material(color))
    mesh.castShadow = true
    person.add(mesh)
  }
  // An umbrella, shown only while it rains.
  const umbrella = new THREE.Group()
  umbrella.add(new THREE.Mesh(UMBRELLA.pole, material('#444444')), new THREE.Mesh(UMBRELLA.canopy, material(pick(UMBRELLA_COLORS))))
  umbrella.visible = false
  umbrella.name = 'umbrella'
  person.add(umbrella)
  person.scale.setScalar(1.4) // a little larger than true scale, so they read at a glance
  return person
}

export class PeopleView {
  private scene: THREE.Scene
  private city: City
  private walkers: Walker[] = []
  private spawnTimer = 0
  private visible = true

  constructor(scene: THREE.Scene, city: City) {
    this.scene = scene
    this.city = city
  }

  // How many visitors are in town this month (Tourism.ts); Game sets it.
  visitors: () => number = () => 0
  private touristTimer = 0

  // Out comes every umbrella when it rains.
  private raining = false
  setRaining(raining: boolean) {
    this.raining = raining
    for (const w of this.walkers) w.object.getObjectByName('umbrella')!.visible = raining
  }

  // Turned off in Settings: everyone goes home at once.
  setVisible(visible: boolean) {
    this.visible = visible
    if (!visible) for (const w of [...this.walkers]) this.remove(w)
  }

  // Called every frame with the seconds since the last one.
  update(dt: number) {
    if (!this.visible) return
    this.spawnTimer -= dt
    if (this.spawnTimer <= 0) {
      this.spawnTimer = SPAWN_EVERY
      this.spawnOne()
    }
    this.touristTimer -= dt
    if (this.touristTimer <= 0) {
      this.touristTimer = 1.5
      this.spawnTourist()
    }
    for (const walker of [...this.walkers]) this.move(walker, dt)
  }

  // People walk only on the sidewalks, which run along both sides of every
  // road, and on stone garden paths: never across grass, and never down the
  // middle of the road.
  private passable = (tile: Tile) => inBounds(tile) && (this.city.isRoad(tile) || this.city.buildingAt(tile)?.type.id === 'stone-path')

  // The road tiles right next to a building: where its people step out onto
  // the sidewalk (a building with no road beside it has nobody walking to it).
  private doorsteps(b: PlacedBuilding): Tile[] {
    const { x, z } = b.tile
    const { x: w, z: d } = sizeOf(b)
    const ring: Tile[] = []
    for (let i = 0; i < w; i++) ring.push({ x: x + i, z: z - 1 }, { x: x + i, z: z + d })
    for (let i = 0; i < d; i++) ring.push({ x: x - 1, z: z + i }, { x: x + w, z: z + i })
    return ring.filter(this.passable)
  }

  // Add a walker for a home that has fewer out than its share.
  private spawnOne() {
    if (this.walkers.length >= MAX_WALKERS) return
    const out = new Map<number, number>()
    for (const w of this.walkers) out.set(w.homeId, (out.get(w.homeId) ?? 0) + 1)
    const homes = [...this.city.all()].filter(
      (b) => b.type.residents && this.city.isBuilt(b) && (out.get(b.id) ?? 0) < Math.ceil((b.type.residents * levelFactor(b.level)) / 2),
    )
    if (homes.length === 0) return
    const home = pick(homes)
    const start = pick(this.doorsteps(home))
    if (!start) return

    const walker: Walker = {
      homeId: home.id,
      object: createPerson(),
      path: [start],
      step: 0,
      t: 0,
      offset: new THREE.Vector2((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5),
      side: Math.random() < 0.5 ? 1 : -1,
      fromId: null,
      toId: null,
      pause: 0,
      goingHome: false,
      lingerSeconds: null,
      tourist: false,
      phase: Math.random() * Math.PI * 2,
    }
    walker.fromId = home.id
    if (!this.chooseDestination(walker)) return
    walker.object.getObjectByName('umbrella')!.visible = this.raining
    this.walkers.push(walker)
    this.scene.add(walker.object)
    this.place(walker)
  }

  // A visitor arrives at a stop, the station, the dock or the airport, and
  // heads for an attraction: about one walking about for every eight visitors.
  private spawnTourist() {
    const out = this.walkers.filter((w) => w.tourist).length
    if (out >= Math.min(12, Math.ceil(this.visitors() / 8)) || this.walkers.length >= MAX_WALKERS) return
    const hubs = [...this.city.all()].filter((b) => b.type.arrivals && this.city.isOperating(b))
    const hub = hubs.length ? pick(hubs) : null
    const start = hub && pick(this.doorsteps(hub))
    if (!hub || !start) return
    const walker: Walker = {
      homeId: hub.id,
      object: createTourist(),
      path: [start],
      step: 0,
      t: 0,
      offset: new THREE.Vector2((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5),
      side: Math.random() < 0.5 ? 1 : -1,
      fromId: null,
      toId: null,
      pause: 0,
      goingHome: false,
      lingerSeconds: null,
      tourist: true,
      phase: Math.random() * Math.PI * 2,
    }
    walker.fromId = hub.id
    if (!this.chooseDestination(walker)) return
    walker.object.getObjectByName('umbrella')!.visible = this.raining
    this.walkers.push(walker)
    this.scene.add(walker.object)
    this.place(walker)
  }

  // Pick somewhere to go and find a path there, along the roads. Returns
  // false if there's nowhere reachable.
  private chooseDestination(walker: Walker): boolean {
    const from = walker.path[walker.step]
    let target: PlacedBuilding | undefined
    walker.lingerSeconds = null
    if (walker.goingHome) {
      target = this.city.get(walker.homeId)
    } else if (walker.tourist) {
      // Visitors go to attractions (and linger there a good while).
      const attractions = [...this.city.all()].filter((b) => b.type.visitors && this.city.isOperating(b))
      target = attractions.length ? pick(attractions) : undefined
      if (target) walker.lingerSeconds = 8 + Math.random() * 8
    } else {
      // Mostly visit another building (shops and parks are popular), sometimes just stroll.
      const others = [...this.city.all()].filter((b) => b.id !== walker.homeId && b.type.category !== 'decoration' && b.type.category !== 'road' && !isTrack(b.type))
      const favorites = others.filter((b) => b.type.category === 'business' || b.type.attractsVisitors)
      target = favorites.length > 0 && Math.random() < 0.5 ? pick(favorites) : others.length > 0 && Math.random() < 0.85 ? pick(others) : undefined
      walker.lingerSeconds = target?.type.attractsVisitors?.lingerSeconds ?? null
    }
    const goal = target ? pick(this.doorsteps(target)) : this.roadNear(from)
    const path = goal && findPath(from, goal, this.passable)
    if (!path || path.length < 2) return false
    // Leaving a building: start on the sidewalk on its side of the road.
    const home = walker.fromId !== null ? this.towardBuilding(path[0], walker.fromId) : null
    if (home) {
      const right = { x: -(path[1].z - path[0].z), z: path[1].x - path[0].x }
      const dot = right.x * home.x + right.z * home.z
      if (dot !== 0) walker.side = dot > 0 ? 1 : -1
    }
    walker.toId = target?.id ?? null
    walker.path = path
    walker.step = 0
    walker.t = 0
    return true
  }

  // A road tile a short stroll away.
  private roadNear(from: Tile): Tile | undefined {
    const near = [...this.city.all()].filter((b) => b.type.category === 'road' && Math.abs(b.tile.x - from.x) <= 6 && Math.abs(b.tile.z - from.z) <= 6)
    return near.length ? pick(near).tile : undefined
  }

  // Which way from a road tile the given building lies (a unit step), if it's right beside it.
  private towardBuilding(tile: Tile, id: number): { x: number; z: number } | null {
    for (const d of [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }]) {
      if (this.city.buildingAt({ x: tile.x + d.x, z: tile.z + d.z })?.id === id) return d
    }
    return null
  }

  private move(walker: Walker, dt: number) {
    if (walker.pause > 0) {
      walker.pause -= dt
      if (walker.pause > 0) return
      // Done pausing: head home if it's time (or the home is gone), otherwise go somewhere else.
      if (walker.goingHome || !this.city.get(walker.homeId)) return this.remove(walker)
      walker.goingHome = Math.random() < 0.35
      walker.fromId = walker.toId
      if (!this.chooseDestination(walker)) walker.pause = 1 + Math.random() * 2
      return
    }

    walker.t += SPEED * dt
    walker.phase += dt * 12
    while (walker.t >= 1) {
      walker.t -= 1
      walker.step++
      if (walker.step >= walker.path.length - 1) {
        // Arrived.
        walker.step = walker.path.length - 1
        walker.t = 0
        // People linger in places that attract visitors, like parks.
        const linger = walker.lingerSeconds
        walker.pause = walker.goingHome ? 0.3 : linger ? linger * (0.6 + Math.random() * 0.8) : 1 + Math.random() * 3
        break
      }
      // Something was built in the way since the path was planned: plan again.
      if (!this.passable(walker.path[walker.step + 1])) {
        walker.path = walker.path.slice(0, walker.step + 1)
        walker.fromId = null
        if (!this.chooseDestination(walker)) walker.pause = 1
        break
      }
    }
    this.place(walker, dt)
  }

  // Where a walker stands on the i-th tile of their path. On grass, near the
  // middle (with their own small offset). On a road, on the sidewalk: to one
  // side of the way they're going, and at a turn, the corner of the sidewalk,
  // so they walk round the edge and never down the middle of the road.
  private spot(walker: Walker, i: number): THREE.Vector3 {
    const path = walker.path
    const tile = path[i]
    const c = tileToWorld(tile)
    if (!this.city.isRoad(tile)) return c.add(new THREE.Vector3(walker.offset.x, 0, walker.offset.y))
    // At either end, the sidewalk on the building's side, by its door.
    const endId = i === 0 ? walker.fromId : i === path.length - 1 ? walker.toId : null
    const toward = endId !== null ? this.towardBuilding(tile, endId) : null
    if (toward) {
      const edge = 0.5 - SIDEWALK / 2
      const along = walker.offset.x * 0.6
      return c.add(new THREE.Vector3(toward.x * edge + toward.z * along, 0, toward.z * edge + toward.x * along))
    }
    const step = (a: Tile, b: Tile) => ({ x: b.x - a.x, z: b.z - a.z })
    const into = i > 0 ? step(path[i - 1], tile) : i + 1 < path.length ? step(tile, path[i + 1]) : { x: 1, z: 0 }
    const out = i + 1 < path.length ? step(tile, path[i + 1]) : into
    // To the right of a heading (x, z) is (−z, x); add both headings' sides.
    let nx = -into.z - out.z
    let nz = into.x + out.x
    if (nx === 0 && nz === 0) [nx, nz] = [-into.z, into.x] // turning right round
    const scale = (0.5 - SIDEWALK / 2) / Math.max(Math.abs(nx), Math.abs(nz))
    return c.add(new THREE.Vector3(nx * scale * walker.side, 0, nz * scale * walker.side))
  }

  // Put the walker's model where it is along its path, facing where it's
  // going (turning toward it over dt seconds; at once without dt).
  private place(walker: Walker, dt = 0) {
    const a = this.spot(walker, walker.step)
    const next = walker.path[walker.step + 1]
    const walking = next !== undefined && walker.pause <= 0
    const pos = walking ? a.clone().lerp(this.spot(walker, walker.step + 1), walker.t) : a
    walker.object.position.set(pos.x, walking ? Math.abs(Math.sin(walker.phase)) * 0.03 : 0, pos.z)
    if (walking) {
      const b = this.spot(walker, walker.step + 1)
      const heading = Math.atan2(b.x - a.x, b.z - a.z)
      walker.object.rotation.y = dt > 0 ? turnToward(walker.object.rotation.y, heading, 9, dt) : heading
    }
  }

  private remove(walker: Walker) {
    walker.object.removeFromParent()
    this.walkers.splice(this.walkers.indexOf(walker), 1)
  }
}
