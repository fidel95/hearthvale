import * as THREE from 'three'
import { GRID_SIZE } from './grid'
import { modelCopy } from './models'
import { isWater } from './terrain'

// Boats on the sea. Sailboats and fishing boats wander between random points
// offshore, turning gently and bobbing on the swell; they're just for looks.
// The docks' cargo ships are PortView's.

const HALF = GRID_SIZE / 2
const SPEED = 0.8 // world units per second
const TURN = 0.8 // radians per second

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

// A random point on the water, offshore and roughly in front of the world.
function randomSeaPoint(): THREE.Vector2 {
  for (let tries = 0; tries < 20; tries++) {
    const x = Math.random() * (GRID_SIZE + 20) - 10
    const z = 50 + Math.random() * 25
    if (isWater({ x: Math.floor(x), z: Math.floor(z) - 3 })) return new THREE.Vector2(x - HALF, z - HALF)
  }
  return new THREE.Vector2(0, 30)
}

export class ShipView {
  private boats: Boat[] = []

  constructor(scene: THREE.Scene) {
    // Kenney's Watercraft Kit (CC0) boats, or simple shapes if they can't load.
    const boat = (name: string, fallback: () => THREE.Group) => () => modelCopy(`${import.meta.env.BASE_URL}models/watercraft/${name}.glb`, 0.2, fallback)
    const makers = [
      boat('boat-sail-a', createSailboat),
      boat('boat-sail-b', createSailboat),
      boat('boat-sail-a', createSailboat),
      boat('boat-fishing-small', createFishingBoat),
      boat('boat-tug-b', createFishingBoat),
      boat('boat-speed-a', createFishingBoat),
    ]
    for (const make of makers) {
      const object = make()
      const start = randomSeaPoint()
      object.position.set(start.x, 0, start.y)
      const boat = { object, target: randomSeaPoint(), heading: Math.random() * Math.PI * 2, phase: Math.random() * 10 }
      this.boats.push(boat)
      scene.add(object)
    }
  }

  // Called every frame with the seconds since the last one and the time so far (for the swell).
  update(dt: number, seconds: number) {
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
      pos.y = -0.03 + 0.03 * Math.sin(seconds * 1.2 + pos.x * 0.6 + pos.z * 0.4)
      boat.object.rotation.set(0, boat.heading, 0.06 * Math.sin(seconds * 1.7 + boat.phase))
    }
  }
}
