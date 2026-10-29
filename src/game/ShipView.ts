import * as THREE from 'three'
import type { City } from './City'
import { edgeTiles } from './communityRules'
import type { Docks, Shipment } from './Docks'
import { GRID_SIZE, tileToWorld } from './grid'
import { isWater } from './terrain'

// Boats on the sea. Sailboats and fishing boats wander between random points
// offshore, turning gently and bobbing on the swell; they're just for looks.
// Cargo ships show the docks' shipments: each sails in from the horizon so
// that it reaches its dock exactly when the shipment arrives, waits to be
// unloaded, then sails away.

const HALF = GRID_SIZE / 2
const SPEED = 0.8 // world units per second
const TURN = 0.8 // radians per second
const CARGO_START = 40 // how far out to sea cargo ships appear
const CARGO_LEAVE_SPEED = 2.5

interface Boat {
  object: THREE.Group
  target: THREE.Vector2
  heading: number
  phase: number
}

// ---- Models: a few boxes and cones each, with shared geometries and materials.

const materials = new Map<string, THREE.MeshStandardMaterial>()
function material(color: string) {
  let m = materials.get(color)
  if (!m) materials.set(color, (m = new THREE.MeshStandardMaterial({ color, flatShading: true })))
  return m
}

function part(group: THREE.Group, geometry: THREE.BufferGeometry, color: string, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(geometry, material(color))
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  group.add(mesh)
  return mesh
}

// Boats point along +z; the hull's bow is a cone squashed flat.
export function createSailboat(): THREE.Group {
  const g = new THREE.Group()
  part(g, new THREE.BoxGeometry(0.3, 0.12, 0.6), '#f4f1ea', 0, 0.06, 0)
  part(g, new THREE.ConeGeometry(0.15, 0.25, 4).rotateX(Math.PI / 2).rotateZ(Math.PI / 4).scale(1, 0.55, 1), '#f4f1ea', 0, 0.06, 0.42)
  part(g, new THREE.CylinderGeometry(0.015, 0.015, 0.7, 4), '#8a6a4a', 0, 0.45, 0.05)
  // A triangular sail: a thin cone with three sides, flattened.
  part(g, new THREE.ConeGeometry(0.22, 0.6, 3).scale(0.08, 1, 1), '#ffffff', 0, 0.45, -0.08)
  return g
}

export function createFishingBoat(): THREE.Group {
  const g = new THREE.Group()
  part(g, new THREE.BoxGeometry(0.34, 0.14, 0.7), '#c8463a', 0, 0.07, 0)
  part(g, new THREE.ConeGeometry(0.17, 0.26, 4).rotateX(Math.PI / 2).rotateZ(Math.PI / 4).scale(1, 0.6, 1), '#c8463a', 0, 0.07, 0.48)
  part(g, new THREE.BoxGeometry(0.24, 0.18, 0.24), '#f2f2f2', 0, 0.23, -0.1)
  part(g, new THREE.CylinderGeometry(0.01, 0.01, 0.4, 4), '#444444', 0, 0.35, 0.2)
  return g
}

export function createCargoShip(): THREE.Group {
  const g = new THREE.Group()
  part(g, new THREE.BoxGeometry(0.8, 0.22, 2.4), '#9b2f2a', 0, 0.11, 0)
  part(g, new THREE.BoxGeometry(0.8, 0.14, 2.4), '#2c3e66', 0, 0.29, 0)
  part(g, new THREE.ConeGeometry(0.4, 0.5, 4).rotateX(Math.PI / 2).rotateZ(Math.PI / 4).scale(1, 0.5, 1), '#2c3e66', 0, 0.22, 1.42)
  part(g, new THREE.BoxGeometry(0.6, 0.4, 0.4), '#f2f2f2', 0, 0.56, -0.9) // the bridge
  const colors = ['#e0553f', '#3f7fe0', '#e8b33a', '#4fa36b', '#e67e9f', '#2bb3b1']
  let i = 0
  for (const z of [-0.4, 0.05, 0.5, 0.95]) {
    for (const x of [-0.18, 0.18]) part(g, new THREE.BoxGeometry(0.32, 0.22, 0.4), colors[i++ % colors.length], x, 0.47, z)
  }
  return g
}

// A random point on the water, offshore and roughly in front of the world.
function randomSeaPoint(): THREE.Vector2 {
  for (let tries = 0; tries < 20; tries++) {
    const x = Math.random() * (GRID_SIZE + 20) - 10
    const z = 50 + Math.random() * 25
    if (isWater({ x: Math.floor(x), z: Math.floor(z) - 3 })) return new THREE.Vector2(x - HALF, z - HALF)
  }
  return new THREE.Vector2(0, 30)
}

interface Cargo {
  object: THREE.Group
}

export class ShipView {
  private boats: Boat[] = []
  private cargo = new Map<number, Cargo>() // by dock id
  private scene: THREE.Scene
  private city: City
  private docks: Docks

  constructor(scene: THREE.Scene, city: City, docks: Docks) {
    this.scene = scene
    this.city = city
    this.docks = docks
    const makers = [createSailboat, createSailboat, createSailboat, createSailboat, createFishingBoat, createFishingBoat]
    for (const make of makers) {
      const object = make()
      const start = randomSeaPoint()
      object.position.set(start.x, 0, start.y)
      const boat = { object, target: randomSeaPoint(), heading: Math.random() * Math.PI * 2, phase: Math.random() * 10 }
      this.boats.push(boat)
      scene.add(object)
    }
  }

  // Called every frame with the seconds since the last one, the time so far
  // (for the swell) and the clock time (for the shipments).
  update(dt: number, seconds: number, now: number) {
    this.updateCargo(dt, seconds, now)
    for (const boat of this.boats) {
      const pos = boat.object.position
      const to = new THREE.Vector2(boat.target.x - pos.x, boat.target.y - pos.z)
      if (to.length() < 1) boat.target = randomSeaPoint()

      // Turn toward the target a little at a time, then sail forward.
      const want = Math.atan2(to.x, to.y)
      let turn = want - boat.heading
      turn = Math.atan2(Math.sin(turn), Math.cos(turn)) // the short way round
      boat.heading += THREE.MathUtils.clamp(turn, -TURN * dt, TURN * dt)
      pos.x += Math.sin(boat.heading) * SPEED * dt
      pos.z += Math.cos(boat.heading) * SPEED * dt

      // Ride the same swell as the sea (LandView.update), sitting a little low in the water, with a roll.
      pos.y = 0.02 + 0.03 * Math.sin(seconds * 1.2 + pos.x * 0.6 + pos.z * 0.4)
      boat.object.rotation.set(0, boat.heading, 0.06 * Math.sin(seconds * 1.7 + boat.phase))
    }
  }

  private updateCargo(dt: number, seconds: number, now: number) {
    const active = new Set<number>()
    for (const shipment of this.docks.all()) {
      const berth = this.berthFor(shipment)
      if (!berth) continue
      active.add(shipment.dockId)
      let ship = this.cargo.get(shipment.dockId)
      if (!ship) {
        ship = { object: createCargoShip() }
        this.cargo.set(shipment.dockId, ship)
        this.scene.add(ship.object)
      }
      // Where it is depends only on the time: it left CARGO_START tiles out
      // when ordered and reaches the berth when the shipment arrives, slowing
      // down as it comes in.
      const total = shipment.arrivesAt - shipment.orderedAt
      const p = THREE.MathUtils.clamp((now - shipment.orderedAt) / total, 0, 1)
      const eased = 1 - (1 - p) * (1 - p)
      const pos = ship.object.position
      pos.set(berth.x, 0, berth.z + CARGO_START * (1 - eased))
      pos.y = 0.02 + 0.03 * Math.sin(seconds * 1.2 + pos.x * 0.6 + pos.z * 0.4)
      ship.object.rotation.set(0, Math.PI, 0.03 * Math.sin(seconds * 1.3)) // bow toward the shore
    }
    // Ships whose shipment is done (unloaded, or the dock was demolished) sail away.
    for (const [dockId, ship] of this.cargo) {
      if (active.has(dockId)) continue
      ship.object.rotation.y = 0 // turn back out to sea
      ship.object.position.z += CARGO_LEAVE_SPEED * dt
      if (ship.object.position.z > HALF + CARGO_START) {
        ship.object.removeFromParent()
        this.cargo.delete(dockId)
      }
    }
  }

  // Where a dock's ship ties up: just off the dock's seaward side.
  private berthFor(shipment: Shipment): THREE.Vector3 | null {
    const dock = this.city.get(shipment.dockId)
    if (!dock) return null
    const water = edgeTiles(dock).filter(isWater)
    if (water.length === 0) return null
    const middle = water[Math.floor(water.length / 2)]
    // The ship is 2.4 long and points at the shore, so its middle sits 2 tiles out.
    return tileToWorld(middle).add(new THREE.Vector3(0, 0, 2))
  }
}
