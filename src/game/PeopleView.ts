import * as THREE from 'three'
import { sizeOf, type City, type PlacedBuilding } from './City'
import { inBounds, tileToWorld, type Tile } from './grid'
import { levelFactor } from './construction'
import { findPath } from './pathfinding'
import { isTrack } from './buildings'
import { easeShare, turnToward } from './motion'
import { SIDEWALK } from './RoadView'
import { HEIGHT, charactersReady, loadCharacters, makeCharacter, type Character } from './characters'

// Residents walking around town. Purely for looks: nothing here changes the
// game, and nothing is saved. Each home sends out about one walker per two
// residents. A walker leaves home, walks to a shop, a neighbor or a random
// spot (with A* pathfinding around buildings), pauses, and carries on or goes
// home, where it disappears and is replaced a little later.
//
// They're Kenney's animated Mini Characters (characters.ts), walking and
// standing about; until those load, simple figures. People never walk
// through each other: someone close ahead going the same way, they slow down
// behind; anyone else in the way (coming toward them, crossing, standing
// still), they step aside to pass. People standing about keep a little apart.

const MAX_WALKERS = 40
const SPEED = 0.75 // tiles per second
const SPAWN_EVERY = 0.8 // seconds between new walkers, so they trickle out
// Sizes below are for a person HEIGHT tall; S scales the shapes that were
// made for one 0.4 tall (hat, backpack, umbrella).
const S = HEIGHT / 0.4
const ROOM = HEIGHT * 0.42 // how close two people come (between their middles)
const LOOK_AHEAD = HEIGHT * 0.85 // how far ahead a walker watches for someone in the way
const STEP_ASIDE = HEIGHT * 0.32 // how far a walker steps aside to pass someone
const QUEUE_FOR = 1.2 // seconds a walker stays behind a slower one before stepping out to pass
const WALK_ANIMATION = (1.6 * (SPEED / 1.1)) / S // the walk animation's speed, so feet keep pace with the ground
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
  phase: number // for the walking bob (the simple figures)
  character: Character | null // the animated model, once they've loaded
  shift: THREE.Vector2 // how far it's stepped aside from its line (world units), eased
  aside: number // which way it wants to step aside now (−1 left, 1 right, 0 not)
  push: THREE.Vector2 // away from anyone standing too close
  behind: number // seconds spent slowed behind someone (then it steps out to pass)
  slowed: boolean // someone close ahead, going the same way
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

function createTourist(): { object: THREE.Group; character: Character | null } {
  const made = createPerson()
  const person = made.object
  // On a character the hat sits higher (it's taller, with a bigger head).
  const hat = made.character ? new THREE.Group() : person
  if (made.character) {
    hat.scale.setScalar(1.6 * S)
    hat.position.set(0, HEIGHT * 0.94 - 0.37 * 1.6 * S, 0)
    person.add(hat)
  }
  for (const [shape, color] of [
    [TOURIST.brim, '#f3e2b0'],
    [TOURIST.crown, '#f3e2b0'],
  ] as const) {
    const mesh = new THREE.Mesh(shape, material(color))
    mesh.castShadow = true
    hat.add(mesh)
  }
  const pack = new THREE.Mesh(TOURIST.pack, material(pick(['#e0453a', '#2f7fe0', '#ffd23f', '#3fae6b'])))
  pack.castShadow = true
  // On its back (the characters face +z).
  if (made.character) {
    pack.scale.setScalar(S)
    pack.position.set(0.07 * S, HEIGHT * 0.5 - 0.2 * S, -0.09 * S)
  }
  person.add(pack)
  return made
}

// A person: an animated character if they've loaded, else a simple figure.
// Either way with an umbrella, shown only while it rains.
function createPerson(): { object: THREE.Group; character: Character | null } {
  const character = makeCharacter()
  const umbrella = new THREE.Group()
  umbrella.add(new THREE.Mesh(UMBRELLA.pole, material('#444444')), new THREE.Mesh(UMBRELLA.canopy, material(pick(UMBRELLA_COLORS))))
  umbrella.visible = false
  umbrella.name = 'umbrella'
  if (character) {
    // Held up in one hand, just over the (big) head.
    umbrella.scale.setScalar(1.2 * S)
    umbrella.position.set(0.02 * S, HEIGHT * 1.22 - 0.49 * 1.2 * S, 0)
    character.root.add(umbrella)
    character.play('walk', 0)
    return { object: character.root, character }
  }
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
  person.add(umbrella)
  person.scale.setScalar(HEIGHT / 0.36) // the figure is 0.36 tall as made
  return { object: person, character: null }
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
    loadCharacters().catch((err) => console.warn("Couldn't load the people models; walkers stay simple figures", err))
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
    // Anyone who set out before the characters loaded becomes one now.
    if (charactersReady()) for (const w of this.walkers) if (!w.character) this.dress(w)
    this.makeRoom(dt)
    for (const walker of [...this.walkers]) this.move(walker, dt)
  }

  // Who's in whose way: a walker with someone close ahead going the same way
  // slows behind them (for a while, then steps out to pass); with anyone else
  // in the way it steps aside, away from them. People standing, or anyone at
  // all who's too close, are nudged apart.
  private makeRoom(dt: number) {
    const forward = (w: Walker) => ({ x: Math.sin(w.object.rotation.y), z: Math.cos(w.object.rotation.y) })
    for (const w of this.walkers) {
      w.aside = 0
      w.slowed = false
      w.push.set(0, 0)
      const moving = w.pause <= 0
      const f = forward(w)
      const p = w.object.position
      for (const o of this.walkers) {
        if (o === w) continue
        const dx = o.object.position.x - p.x
        const dz = o.object.position.z - p.z
        if (Math.abs(dx) > LOOK_AHEAD || Math.abs(dz) > LOOK_AHEAD) continue
        const d = Math.hypot(dx, dz)
        if (d < ROOM && d > 1e-4) w.push.x -= (dx / d) * (ROOM - d), (w.push.y -= (dz / d) * (ROOM - d))
        if (!moving) continue
        const ahead = dx * f.x + dz * f.z
        const side = dx * f.z - dz * f.x // how far off to one side of its line they are
        if (ahead <= 0 || ahead > LOOK_AHEAD || Math.abs(side) > ROOM) continue
        const of = forward(o)
        const sameWay = o.pause <= 0 && of.x * f.x + of.z * f.z > 0.6
        if (sameWay && w.behind < QUEUE_FOR && ahead < ROOM * 1.6) w.slowed = true
        else w.aside = side > 0.01 ? -1 : 1 // step to the other side (and to the same side, met head on)
      }
      w.behind = w.slowed ? w.behind + dt : Math.max(0, w.behind - dt)
    }
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
      ...createPerson(),
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
      shift: new THREE.Vector2(),
      aside: 0,
      push: new THREE.Vector2(),
      behind: 0,
      slowed: false,
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
      ...createTourist(),
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
      shift: new THREE.Vector2(),
      aside: 0,
      push: new THREE.Vector2(),
      behind: 0,
      slowed: false,
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
      if (walker.pause > 0) return this.place(walker, dt)
      // Done pausing: head home if it's time (or the home is gone), otherwise go somewhere else.
      if (walker.goingHome || !this.city.get(walker.homeId)) return this.remove(walker)
      walker.goingHome = Math.random() < 0.35
      walker.fromId = walker.toId
      if (!this.chooseDestination(walker)) walker.pause = 1 + Math.random() * 2
      return
    }

    // Slowed behind someone, it keeps to their pace (a little slower, so the gap holds).
    walker.t += SPEED * dt * (walker.slowed ? 0.35 : 1)
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
    if (walking) {
      const b = this.spot(walker, walker.step + 1)
      const heading = Math.atan2(b.x - a.x, b.z - a.z)
      walker.object.rotation.y = dt > 0 ? turnToward(walker.object.rotation.y, heading, 9, dt) : heading
    }
    // Stepped aside (across its heading) to pass someone, and nudged away
    // from anyone too close, easing in and out.
    const r = walker.object.rotation.y
    const want = new THREE.Vector2(Math.cos(r), -Math.sin(r)).multiplyScalar(walker.aside * STEP_ASIDE).add(walker.push)
    walker.shift.lerp(want, easeShare(6, dt))
    const bob = walking && !walker.character ? Math.abs(Math.sin(walker.phase)) * 0.03 * S : 0
    walker.object.position.set(pos.x + walker.shift.x, bob, pos.z + walker.shift.y)
    const c = walker.character
    if (c) {
      c.play(walking ? 'walk' : 'idle')
      c.mixer.timeScale = walking ? WALK_ANIMATION * (walker.slowed ? 0.45 : 1) : 1
      c.mixer.update(dt)
    }
  }

  // Swap a simple figure for an animated character, where it stands.
  private dress(walker: Walker) {
    const made = walker.tourist ? createTourist() : createPerson()
    if (!made.character) return
    made.object.position.copy(walker.object.position)
    made.object.rotation.y = walker.object.rotation.y
    made.object.getObjectByName('umbrella')!.visible = this.raining
    walker.object.removeFromParent()
    walker.object = made.object
    walker.character = made.character
    this.scene.add(made.object)
  }

  private remove(walker: Walker) {
    walker.object.removeFromParent()
    this.walkers.splice(this.walkers.indexOf(walker), 1)
  }
}
