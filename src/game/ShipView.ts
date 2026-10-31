import * as THREE from 'three'
import { GRID_SIZE } from './grid'
import { modelCopy } from './models'
import { isWater } from './terrain'

// Boats on the sea. Sailboats and fishing boats wander between random points
// offshore, turning gently and bobbing on the swell; they're just for looks.
// A submarine cruises among them, diving now and then (just its periscope
// showing, cutting a little wake) and surfacing again in a burst of bubbles.
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

// A submarine, pointing along +z: a long rounded hull, a conning tower with
// its fins, a periscope and a propeller at the stern.
export function createSubmarine(): { root: THREE.Group; propeller: THREE.Object3D } {
  const g = new THREE.Group()
  part(g, new THREE.CapsuleGeometry(0.15, 0.85, 6, 12).rotateX(Math.PI / 2), '#f2c230', 0, 0.02, 0)
  part(g, new THREE.BoxGeometry(0.12, 0.17, 0.26), '#e0a92a', 0, 0.2, 0.1)
  part(g, new THREE.BoxGeometry(0.34, 0.015, 0.07), '#e0a92a', 0, 0.22, 0.12)
  part(g, new THREE.CylinderGeometry(0.012, 0.012, 0.2, 5), '#3b3f46', 0, 0.37, 0.16)
  part(g, new THREE.BoxGeometry(0.02, 0.025, 0.05), '#3b3f46', 0, 0.47, 0.18)
  for (const z of [0.12, 0.3]) part(g, new THREE.CylinderGeometry(0.035, 0.035, 0.01, 10).rotateZ(Math.PI / 2), '#8fd3f0', 0.15, 0.04, z) // portholes
  part(g, new THREE.BoxGeometry(0.02, 0.18, 0.08), '#e0a92a', 0, 0.02, -0.52) // tail fin
  part(g, new THREE.BoxGeometry(0.22, 0.02, 0.08), '#e0a92a', 0, 0.02, -0.52)
  const propeller = new THREE.Group()
  propeller.position.set(0, 0.02, -0.6)
  for (let i = 0; i < 3; i++) part(propeller, new THREE.BoxGeometry(0.03, 0.12, 0.01).translate(0, 0.06, 0).rotateZ((i * Math.PI * 2) / 3), '#9aa2ab', 0, 0, 0)
  g.add(propeller)
  return { root: g, propeller }
}

// The submarine's round: on the surface, diving, under the water, surfacing (seconds each).
const SUB_PHASES = [25, 4, 30, 4]
const SUB_DEPTH = 0.42 // how far down it goes (the periscope still shows)

interface Sub extends Boat {
  propeller: THREE.Object3D
  t: number
  bubbles: THREE.Mesh[]
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
  private sub: Sub

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
    const { root, propeller } = createSubmarine()
    const start = randomSeaPoint()
    root.position.set(start.x, 0, start.y)
    scene.add(root)
    const bubble = new THREE.SphereGeometry(0.04, 6, 4)
    const foam = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 })
    const bubbles = Array.from({ length: 14 }, () => {
      const b = new THREE.Mesh(bubble, foam)
      b.visible = false
      scene.add(b)
      return b
    })
    this.sub = { object: root, target: randomSeaPoint(), heading: Math.random() * Math.PI * 2, phase: 0, propeller, t: Math.random() * 20, bubbles }
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
    this.runSub(dt, seconds)
  }

  private runSub(dt: number, seconds: number) {
    const sub = this.sub
    const pos = sub.object.position
    const to = new THREE.Vector2(sub.target.x - pos.x, sub.target.y - pos.z)
    if (to.length() < 1) sub.target = randomSeaPoint()
    let turn = Math.atan2(to.x, to.y) - sub.heading
    turn = Math.atan2(Math.sin(turn), Math.cos(turn))
    sub.heading += THREE.MathUtils.clamp(turn, -TURN * 0.6 * dt, TURN * 0.6 * dt)
    pos.x += Math.sin(sub.heading) * SPEED * 0.7 * dt
    pos.z += Math.cos(sub.heading) * SPEED * 0.7 * dt
    sub.propeller.rotation.z += dt * 12

    // Where in its round it is: 0 on the surface, 1 fully under.
    const round = SUB_PHASES.reduce((a, b) => a + b)
    sub.t = (sub.t + dt) % round
    const [up, dive, down] = SUB_PHASES
    const t = sub.t
    const under = t < up ? 0 : t < up + dive ? (t - up) / dive : t < up + dive + down ? 1 : 1 - (t - up - dive - down) / SUB_PHASES[3]
    const eased = under * under * (3 - 2 * under)
    const swell = 0.03 * Math.sin(seconds * 1.2 + pos.x * 0.6 + pos.z * 0.4)
    pos.y = -0.02 + swell - eased * SUB_DEPTH
    // Nose down going under, nose up coming back.
    const diving = t >= up && t < up + dive
    const surfacing = t >= up + dive + down
    sub.object.rotation.set(diving ? 0.12 : surfacing ? -0.12 : 0, sub.heading, 0.03 * Math.sin(seconds * 1.3) * (1 - eased))

    // Bubbles while diving and surfacing: up from the hull, popping at the surface.
    for (const [i, b] of sub.bubbles.entries()) {
      if (!(diving || surfacing)) {
        b.visible = false
        continue
      }
      const life = ((t * 1.3 + i / sub.bubbles.length) % 1)
      const seed = i * 2.39
      b.visible = true
      b.position.set(pos.x + Math.cos(seed) * 0.25, 0.02 + life * 0.15, pos.z + Math.sin(seed) * 0.4)
      b.scale.setScalar(0.6 + life)
    }
  }
}
