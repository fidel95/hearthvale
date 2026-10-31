import * as THREE from 'three'
import { mountainHeight, type Peak } from './terrain'

// The Highlands buildings and the Spaceport: a Mountain Lodge, a Cable Car up
// the mountainside, the Tunnel Works (a tunnel boring machine drilling into
// the mountain) and a Spaceport whose rocket lifts off now and then. Built in
// the building's own coordinates (its center at the origin, front toward +z)
// by createPlaceholder in models.ts, like quarryModels.ts.
//
// Highland buildings face their mountain: the part that does (the cable, the
// drill) sits in a group named AIM, which CityView turns so its +x points at
// the nearest peak, calling its userData.aim(distance, peak) with how far
// away its middle is. Moving parts have userData.animate(seconds), called every frame.

type Add = (geometry: THREE.BufferGeometry, color: string, x: number, y: number, z: number) => THREE.Mesh
type Animate = (seconds: number) => void
export const AIM = 'aim-mountain'
// What aim is told: how far the peak's middle is from the building's middle
// (in tiles), and the peak.
export type Aim = (distance: number, peak: Peak) => void

// Where a peak's rock begins, from its middle (MountainView draws it a little
// wider than its rock tiles).
const footOf = (peak: Peak) => peak.radius + 0.4

const smooth = (t: number) => t * t * (3 - 2 * t)
const clamp01 = (t: number) => Math.max(0, Math.min(1, t))

// A shape of its own (its bottom at y), for the moving parts.
function part(geometry: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0, material?: THREE.Material): THREE.Mesh {
  geometry.computeBoundingBox()
  const mesh = new THREE.Mesh(geometry, material ?? new THREE.MeshStandardMaterial({ color, flatShading: true }))
  mesh.position.set(x, y - geometry.boundingBox!.min.y, z)
  mesh.castShadow = true
  return mesh
}

// ---- The Mountain Lodge: a timber chalet with a steep roof and a balcony.

export function buildLodge(add: Add, w: number, d: number) {
  add(new THREE.BoxGeometry(w * 0.9, 0.04, d * 0.9), '#9a8f7c', 0, 0, 0) // stone terrace
  add(new THREE.BoxGeometry(1.2, 0.18, 1.0), '#8f948c', 0, 0.04, -0.1) // stone base
  add(new THREE.BoxGeometry(1.1, 0.55, 0.92), '#9b6a3f', 0, 0.22, -0.1)
  // Two roof slopes, steep and deep, meeting at a ridge along x.
  for (const side of [-1, 1]) {
    const slope = add(new THREE.BoxGeometry(1.36, 0.06, 0.66), '#c8463a', 0, 0, -0.1 + side * 0.24)
    slope.position.y = 0.94
    slope.rotation.x = side * 0.75
  }
  add(new THREE.BoxGeometry(1.12, 0.04, 0.2), '#7a5233', 0, 0.42, 0.42) // balcony
  for (const x of [-0.5, -0.25, 0, 0.25, 0.5]) add(new THREE.BoxGeometry(0.03, 0.14, 0.03), '#7a5233', x, 0.46, 0.51)
  add(new THREE.BoxGeometry(1.12, 0.03, 0.03), '#7a5233', 0, 0.6, 0.51)
  for (const x of [-0.3, 0.3]) add(new THREE.BoxGeometry(0.22, 0.2, 0.02), '#9fd3f0', x, 0.55, 0.37) // windows
  add(new THREE.BoxGeometry(0.2, 0.3, 0.02), '#5a3a22', 0, 0.22, 0.37) // door
  add(new THREE.BoxGeometry(0.14, 0.5, 0.14), '#8f948c', 0.38, 0.6, -0.3) // chimney
  for (const [x, z] of [[-0.7, 0.65], [0.72, 0.6]]) {
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 5), '#6b4a2b', x, 0, z)
    add(new THREE.ConeGeometry(0.18, 0.5, 7), '#3f7a45', x, 0.1, z)
  }
}

// ---- The Cable Car: a valley station, a cable up the mountainside to a top
// station, and two cabins that pass each other halfway.

export function buildCableCar(group: THREE.Group, add: Add) {
  add(new THREE.BoxGeometry(1.7, 0.04, 1.7), '#b9b2a2', 0, 0, 0)
  add(new THREE.BoxGeometry(1.0, 0.5, 0.9), '#e8e2d4', -0.2, 0.04, 0.2) // station hall
  add(new THREE.BoxGeometry(1.1, 0.06, 1.0), '#c8463a', -0.2, 0.54, 0.2)
  add(new THREE.BoxGeometry(0.5, 0.3, 0.02), '#9fd3f0', -0.2, 0.15, 0.66)
  add(new THREE.BoxGeometry(0.5, 0.06, 0.6), '#3a3d42', 0.45, 0.6, -0.1) // the bullwheel housing
  for (const z of [-0.35, 0.15]) add(new THREE.BoxGeometry(0.08, 0.62, 0.08), '#3a3d42', 0.55, 0, z)

  const aim = new THREE.Group()
  aim.name = AIM
  aim.position.set(0.45, 0, -0.1)
  group.add(aim)
  const line = new THREE.MeshStandardMaterial({ color: '#2b2d33' })
  const cabinColors = ['#c8463a', '#e0a030']
  const cabins = cabinColors.map((c) => {
    const cabin = new THREE.Group()
    cabin.add(part(new THREE.BoxGeometry(0.02, 0.14, 0.02), '#2b2d33', 0, -0.14, 0))
    cabin.add(part(new THREE.BoxGeometry(0.2, 0.16, 0.16), c, 0, -0.3, 0))
    cabin.add(part(new THREE.BoxGeometry(0.21, 0.07, 0.17), '#bfe3f5', 0, -0.22, 0))
    aim.add(cabin)
    return cabin
  })
  let from = new THREE.Vector3()
  let to = new THREE.Vector3()
  const cables: THREE.Mesh[] = []
  const top = new THREE.Group()
  top.add(
    part(new THREE.BoxGeometry(0.4, 0.8, 0.4), '#8f948c', 0, -0.8, 0), // footings down the slope
    part(new THREE.BoxGeometry(0.5, 0.35, 0.5), '#e8e2d4', 0, 0, 0),
    part(new THREE.BoxGeometry(0.56, 0.05, 0.56), '#c8463a', 0, 0.35, 0),
  )
  aim.add(top)
  aim.userData.aim = ((distance, peak) => {
    // The top station sits up the flank, just below the steep summit.
    const up = footOf(peak) * 0.55
    const reach = Math.max(1.2, distance - up - 0.45)
    const height = mountainHeight(peak, distance - 0.45 - reach)
    top.position.set(reach, height - 0.05, 0)
    from = new THREE.Vector3(0, 0.62, 0)
    to = new THREE.Vector3(reach, height + 0.3, 0)
    for (const c of cables) {
      c.geometry.dispose()
      c.removeFromParent()
    }
    cables.length = 0
    for (const z of [-0.12, 0.12]) {
      const length = from.distanceTo(to)
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, length, 4), line)
      cable.position.copy(from).lerp(to, 0.5).setZ(z)
      cable.rotation.z = -Math.atan2(to.x - from.x, to.y - from.y)
      aim.add(cable)
      cables.push(cable)
    }
  }) satisfies Aim
  aim.userData.animate = ((seconds) => {
    // Each cabin rides up one cable and down the other, waiting at each end.
    const trip = 14
    const t = (seconds % (trip * 2)) / trip
    const u = t < 1 ? smooth(clamp01((t - 0.1) / 0.8)) : 1 - smooth(clamp01((t - 1.1) / 0.8))
    cabins.forEach((cabin, i) => {
      const k = i === 0 ? u : 1 - u
      cabin.position.copy(from).lerp(to, k).setZ(i === 0 ? -0.12 : 0.12)
      cabin.rotation.x = Math.sin(seconds * 2 + i) * 0.04 // a gentle sway
    })
  }) satisfies Animate
}

// ---- The Tunnel Works: a tunnel boring machine half into the mountain, its
// cutter head turning, with a conveyor carrying the rock out to a spoil heap,
// stacks of tunnel lining rings, and a site office.

export function buildTunnelWorks(group: THREE.Group, add: Add, w: number, d: number) {
  add(new THREE.BoxGeometry(w * 0.96, 0.04, d * 0.96), '#a4825c', 0, 0, 0) // the dirt yard
  add(new THREE.BoxGeometry(0.7, 0.32, 0.45), '#e8e2d4', -0.95, 0.04, 1.05) // site office
  add(new THREE.BoxGeometry(0.72, 0.04, 0.47), '#3a6fb0', -0.95, 0.36, 1.05)
  // Lining rings, stacked.
  for (const [x, z] of [[-1.1, 0.2], [-1.1, -0.25]]) {
    for (let i = 0; i < 3; i++) add(new THREE.TorusGeometry(0.17, 0.05, 5, 10).rotateX(Math.PI / 2), '#b0b4b8', x, 0.04 + i * 0.1, z)
  }
  add(new THREE.ConeGeometry(0.45, 0.4, 7), '#7d6b5a', 0.9, 0.04, 1.0) // spoil heap

  const aim = new THREE.Group()
  aim.name = AIM
  group.add(aim)
  // The tunnel mouth: a concrete portal set into the mountainside.
  const portal = new THREE.Group()
  portal.add(part(new THREE.BoxGeometry(0.2, 1.0, 1.1), '#a9adb1', 0, 0, 0))
  portal.add(part(new THREE.CylinderGeometry(0.4, 0.4, 0.22, 14).rotateZ(Math.PI / 2), '#1d1e22', -0.01, 0.06, 0))
  aim.add(portal)
  // The machine: a long yellow shield, a backup gantry behind it, and the cutter head.
  const machine = new THREE.Group()
  machine.add(part(new THREE.CylinderGeometry(0.34, 0.34, 1.2, 14).rotateZ(Math.PI / 2), '#e0a030', 0, 0.06, 0))
  machine.add(part(new THREE.BoxGeometry(0.9, 0.36, 0.5), '#3a3d42', -0.95, 0.06, 0))
  machine.add(part(new THREE.BoxGeometry(0.9, 0.06, 0.56), '#e0a030', -0.95, 0.42, 0))
  const cutter = new THREE.Group()
  cutter.position.set(0.62, 0.4, 0)
  cutter.add(part(new THREE.CylinderGeometry(0.38, 0.38, 0.06, 14).rotateZ(Math.PI / 2), '#3a3d42', 0, -0.38, 0))
  for (let i = 0; i < 6; i++) {
    const tooth = part(new THREE.BoxGeometry(0.05, 0.8, 0.07), '#c8463a', 0.04, -0.4, 0)
    const arm = new THREE.Group()
    arm.rotation.x = (i * Math.PI) / 6
    arm.add(tooth)
    cutter.add(arm)
  }
  machine.add(cutter)
  aim.add(machine)
  // The conveyor out to the spoil heap, with rocks riding along it.
  const belt = new THREE.Group()
  const rocks: THREE.Mesh[] = []
  for (let i = 0; i < 6; i++) {
    const rock = part(new THREE.DodecahedronGeometry(0.05), '#6e5d4c')
    belt.add(rock)
    rocks.push(rock)
  }
  group.add(belt)
  const beltFrom = new THREE.Vector3()
  const beltTo = new THREE.Vector3(0.9, 0.42, 1.0)
  let beam: THREE.Mesh | null = null
  aim.userData.aim = ((distance, peak) => {
    // Up against the mountain: the portal where the rock begins, and the
    // machine's cutter biting into it.
    const face = Math.max(0.5, distance - footOf(peak) * 0.92)
    portal.position.set(face, 0, 0)
    machine.position.set(face - 0.62, 0, 0)
    // The conveyor starts behind the machine, wherever it ended up.
    const start = new THREE.Vector3(face - 1.5, 0.48, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), aim.rotation.y)
    beltFrom.copy(start)
    if (beam) {
      beam.geometry.dispose()
      beam.removeFromParent()
    }
    const length = beltFrom.distanceTo(beltTo)
    beam = new THREE.Mesh(new THREE.BoxGeometry(length, 0.04, 0.12), new THREE.MeshStandardMaterial({ color: '#3a3d42' }))
    beam.position.copy(beltFrom).lerp(beltTo, 0.5).setY(0.4)
    beam.rotation.y = -Math.atan2(beltTo.z - beltFrom.z, beltTo.x - beltFrom.x)
    belt.add(beam)
  }) satisfies Aim
  aim.userData.animate = ((seconds) => {
    cutter.rotation.x = seconds * 1.2
    rocks.forEach((rock, i) => {
      const k = (seconds * 0.25 + i / rocks.length) % 1
      rock.position.copy(beltFrom).lerp(beltTo, k).setY(0.44 + Math.sin(k * Math.PI) * 0.02)
    })
  }) satisfies Animate
}

// ---- The Spaceport: a launch pad with a rocket and its tower, a control
// building with a dish, and fuel tanks. Every few minutes the rocket lifts
// off in fire and smoke, and a new one is rolled out.

export const LAUNCH_CYCLE = 100 // seconds (game time)

export function buildSpaceport(group: THREE.Group, add: Add) {
  add(new THREE.BoxGeometry(3.85, 0.05, 3.85), '#b9bec4', 0, 0, 0) // apron
  const pad = { x: 0.55, z: -0.55 }
  add(new THREE.CylinderGeometry(0.95, 1.05, 0.22, 8), '#8f969d', pad.x, 0.05, pad.z)
  add(new THREE.BoxGeometry(0.5, 0.02, 1.2), '#2b2d33', pad.x, 0.27, pad.z + 0.6) // flame trench
  // The tower beside the rocket, with arms reaching across.
  add(new THREE.BoxGeometry(0.3, 3.3, 0.3), '#c8463a', pad.x + 0.68, 0.27, pad.z - 0.2)
  for (const y of [1.0, 1.9, 2.7]) add(new THREE.BoxGeometry(0.5, 0.06, 0.1), '#3a3d42', pad.x + 0.38, 0.27 + y, pad.z - 0.1)
  // Control building and dish.
  add(new THREE.BoxGeometry(1.3, 0.55, 0.9), '#eef0f2', -1.0, 0.05, 1.05)
  add(new THREE.BoxGeometry(1.32, 0.14, 0.02), '#3a6fb0', -1.0, 0.38, 1.51)
  add(new THREE.BoxGeometry(0.06, 0.5, 0.06), '#9aa1a8', -1.25, 0.6, 0.85)
  const dish = new THREE.Group()
  dish.position.set(-1.25, 1.15, 0.85)
  const bowl = part(new THREE.SphereGeometry(0.3, 12, 6, 0, Math.PI * 2, 0, Math.PI / 3), '#f4f6f8')
  bowl.position.set(0, -0.3, 0)
  bowl.rotation.x = -0.9
  dish.add(bowl)
  dish.userData.animate = ((seconds) => (dish.rotation.y = seconds * 0.25)) satisfies Animate
  group.add(dish)
  // Fuel tanks.
  for (const z of [-1.3, -0.6]) {
    add(new THREE.SphereGeometry(0.28, 12, 8), '#f4f6f8', -1.3, 0.25, z)
    for (const dx of [-0.15, 0.15]) add(new THREE.BoxGeometry(0.04, 0.3, 0.04), '#9aa1a8', -1.3 + dx, 0.05, z)
  }
  // Bleachers for the crowd.
  for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(1.0, 0.08, 0.16), '#3a6fb0', 1.1, 0.05 + i * 0.08, 1.1 + i * 0.16)

  // The rocket (its base at the pad's top).
  const rocket = new THREE.Group()
  rocket.userData.flies = true // CityView leaves it out when it measures the building
  const body = new THREE.Group()
  body.add(part(new THREE.CylinderGeometry(0.2, 0.2, 2.0, 14), '#f7f8fa', 0, 0.12, 0))
  body.add(part(new THREE.ConeGeometry(0.2, 0.55, 14), '#c8463a', 0, 2.12, 0))
  body.add(part(new THREE.CylinderGeometry(0.205, 0.205, 0.12, 14), '#2b2d33', 0, 1.5, 0))
  body.add(part(new THREE.CylinderGeometry(0.13, 0.18, 0.14, 12), '#3a3d42', 0, 0, 0))
  for (let i = 0; i < 4; i++) {
    const fin = part(new THREE.BoxGeometry(0.02, 0.4, 0.2), '#c8463a', 0, 0.12, 0.24)
    const holder = new THREE.Group()
    holder.rotation.y = (i * Math.PI) / 2
    holder.add(fin)
    body.add(holder)
  }
  rocket.add(body)
  const flame = new THREE.Group()
  const fire = (color: string, r: number, h: number) => {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 10).rotateX(Math.PI).translate(0, -h / 2, 0), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }))
    flame.add(m)
  }
  fire('#ff8a2a', 0.17, 0.9)
  fire('#ffe27a', 0.1, 0.55)
  rocket.add(flame)
  rocket.position.set(pad.x, 0.27, pad.z)
  group.add(rocket)

  // Smoke puffs that billow out at lift-off.
  const smoke: { mesh: THREE.Mesh; dir: THREE.Vector3 }[] = []
  const puffs = new THREE.Group()
  puffs.userData.flies = true
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), new THREE.MeshStandardMaterial({ color: '#f1f1ee', transparent: true, opacity: 0, flatShading: true, depthWrite: false }))
    mesh.position.set(pad.x, 0.35, pad.z)
    puffs.add(mesh)
    smoke.push({ mesh, dir: new THREE.Vector3(Math.cos(a), 0.15 + (i % 3) * 0.1, Math.sin(a)) })
  }
  group.add(puffs)

  const IGNITE = 70
  const LIFT = 74
  const GONE = 92
  rocket.userData.animate = ((seconds) => {
    const t = seconds % LAUNCH_CYCLE
    const firing = t >= IGNITE && t < GONE
    flame.visible = firing
    if (firing) {
      const grow = clamp01((t - IGNITE) / 2)
      flame.scale.set(1 + Math.sin(seconds * 40) * 0.08, grow * (1 + Math.sin(seconds * 31) * 0.15), 1 + Math.cos(seconds * 37) * 0.08)
    }
    const flying = Math.max(0, t - LIFT)
    rocket.position.y = 0.27 + 0.35 * flying * flying
    rocket.position.x = pad.x + 0.004 * flying * flying * flying // a gentle arc downrange
    rocket.rotation.z = -Math.min(0.5, flying * 0.03)
    rocket.visible = t < GONE
    // Rolled out on the pad again: grows in over the first second and a half.
    const back = clamp01(t / 1.5)
    rocket.scale.setScalar(t < 1.5 ? smooth(back) : 1)
    for (const { mesh, dir } of smoke) {
      const k = clamp01((t - IGNITE - 1) / 16)
      const material = mesh.material as THREE.MeshStandardMaterial
      material.opacity = k > 0 && k < 1 ? 0.85 * (1 - k) : 0
      mesh.visible = material.opacity > 0
      mesh.position.set(pad.x + dir.x * k * 1.6, 0.35 + dir.y * k * 1.6, pad.z + dir.z * k * 1.6)
      mesh.scale.setScalar(0.6 + k * 2)
    }
  }) satisfies Animate
}
