import * as THREE from 'three'
import type { City, PlacedBuilding } from './City'
import { inBounds, tileToWorld, type Tile } from './grid'
import { findPath } from './pathfinding'
import { isWater } from './terrain'

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
  pause: number // seconds left standing still
  goingHome: boolean
  visiting: string | null // the type of building headed to, e.g. 'park'
  phase: number // for the walking bob
}

// One set of shapes shared by every walker; only the materials differ.
const SHAPES = {
  legs: new THREE.BoxGeometry(0.08, 0.12, 0.06).translate(0, 0.06, 0),
  body: new THREE.CylinderGeometry(0.06, 0.07, 0.15, 6).translate(0, 0.195, 0),
  head: new THREE.IcosahedronGeometry(0.055, 0).translate(0, 0.32, 0),
}
const materials = new Map<string, THREE.MeshLambertMaterial>()
function material(color: string) {
  let m = materials.get(color)
  if (!m) materials.set(color, (m = new THREE.MeshLambertMaterial({ color })))
  return m
}

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)]

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
  person.scale.setScalar(1.4) // a little larger than true scale, so they read at a glance
  return person
}

export class PeopleView {
  private scene: THREE.Scene
  private city: City
  private walkers: Walker[] = []
  private spawnTimer = 0

  constructor(scene: THREE.Scene, city: City) {
    this.scene = scene
    this.city = city
  }

  // Called every frame with the seconds since the last one.
  update(dt: number) {
    this.spawnTimer -= dt
    if (this.spawnTimer <= 0) {
      this.spawnTimer = SPAWN_EVERY
      this.spawnOne()
    }
    for (const walker of [...this.walkers]) this.move(walker, dt)
  }

  // A walker can stand on owned land that's empty or a road.
  private passable = (tile: Tile) => {
    if (!inBounds(tile) || !this.city.ownsTile(tile) || isWater(tile)) return false
    const here = this.city.buildingAt(tile)
    return !here || here.type.category === 'road'
  }

  // Walking on grass "costs" more than on a road, so paths stick to roads when they can.
  private cost = (tile: Tile) => (this.city.isRoad(tile) ? 1 : 2.5)

  // Free tiles right next to a building: where someone would come and go.
  private doorsteps(b: PlacedBuilding): Tile[] {
    const { x, z } = b.tile
    const { x: w, z: d } = b.type.size
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
      (b) => b.type.residents && (out.get(b.id) ?? 0) < Math.ceil(b.type.residents / 2),
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
      pause: 0,
      goingHome: false,
      visiting: null,
      phase: Math.random() * Math.PI * 2,
    }
    if (!this.chooseDestination(walker)) return
    this.walkers.push(walker)
    this.scene.add(walker.object)
    this.place(walker)
  }

  // Pick somewhere to go and find a path there. Returns false if there's nowhere reachable.
  private chooseDestination(walker: Walker): boolean {
    const from = walker.path[walker.step]
    let goal: Tile | undefined
    if (walker.goingHome) {
      const home = this.city.get(walker.homeId)
      goal = home && pick(this.doorsteps(home))
    } else {
      // Mostly visit another building (shops and parks are popular), sometimes just wander.
      const others = [...this.city.all()].filter(
        (b) => b.id !== walker.homeId && b.type.category !== 'decoration' && b.type.category !== 'road',
      )
      const favorites = others.filter((b) => b.type.category === 'business' || b.type.id === 'park')
      const target = favorites.length > 0 && Math.random() < 0.5 ? pick(favorites) : others.length > 0 ? pick(others) : null
      walker.visiting = target?.type.id ?? null
      goal = target ? pick(this.doorsteps(target)) : this.randomSpotNear(from)
    }
    const path = goal && findPath(from, goal, this.passable, { cost: this.cost })
    if (!path || path.length < 2) return false
    walker.path = path
    walker.step = 0
    walker.t = 0
    return true
  }

  private randomSpotNear(from: Tile): Tile | undefined {
    for (let tries = 0; tries < 10; tries++) {
      const tile = { x: from.x + Math.round((Math.random() - 0.5) * 12), z: from.z + Math.round((Math.random() - 0.5) * 12) }
      if (this.passable(tile)) return tile
    }
    return undefined
  }

  private move(walker: Walker, dt: number) {
    if (walker.pause > 0) {
      walker.pause -= dt
      if (walker.pause > 0) return
      // Done pausing: head home if it's time (or the home is gone), otherwise go somewhere else.
      if (walker.goingHome || !this.city.get(walker.homeId)) return this.remove(walker)
      walker.goingHome = Math.random() < 0.35
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
        // People linger in parks.
        walker.pause = walker.goingHome ? 0.3 : walker.visiting === 'park' ? 5 + Math.random() * 6 : 1 + Math.random() * 3
        break
      }
      // Something was built in the way since the path was planned: plan again.
      if (!this.passable(walker.path[walker.step + 1])) {
        walker.path = walker.path.slice(0, walker.step + 1)
        if (!this.chooseDestination(walker)) walker.pause = 1
        break
      }
    }
    this.place(walker)
  }

  // Put the walker's model where it is along its path, facing where it's going.
  private place(walker: Walker) {
    const a = tileToWorld(walker.path[walker.step])
    const next = walker.path[walker.step + 1]
    const walking = next !== undefined && walker.pause <= 0
    const pos = walking ? a.clone().lerp(tileToWorld(next), walker.t) : a
    walker.object.position.set(pos.x + walker.offset.x, walking ? Math.abs(Math.sin(walker.phase)) * 0.03 : 0, pos.z + walker.offset.y)
    if (walking) walker.object.rotation.y = Math.atan2(next.x - walker.path[walker.step].x, next.z - walker.path[walker.step].z)
  }

  private remove(walker: Walker) {
    walker.object.removeFromParent()
    this.walkers.splice(this.walkers.indexOf(walker), 1)
  }
}
