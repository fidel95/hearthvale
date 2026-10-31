import * as THREE from 'three'
import { BULLDOZER_TURN, construction, DUMP_TRUCK_TURN, modelFitted } from './models'

// The Coal Mine and the Landfill: earthworks with machines at work. Built in
// the building's own coordinates (its center at the origin, front toward +z)
// by createPlaceholder in models.ts, which merges the still parts into a few
// meshes. The moving parts are groups with userData.animate(seconds), which
// CityView calls every frame. The machines are the construction models (a
// dump truck and a bulldozer) and Kenney's Car Kit garbage truck; they're
// marked liveOnly, so the see-through placement ghost leaves them out.

type Add = (geometry: THREE.BufferGeometry, color: string, x: number, y: number, z: number) => THREE.Mesh
type Animate = (seconds: number) => void

const BANK = '#72b956' // grass, near the town's own

const carKit = (name: string) => `${import.meta.env.BASE_URL}models/cars/${name}.glb`
const KIT_SCALE = 0.15

// A shape of its own (its bottom at y), for the moving parts.
function part(geometry: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0): THREE.Mesh {
  geometry.computeBoundingBox()
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, flatShading: true }))
  mesh.position.set(x, y - geometry.boundingBox!.min.y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

// One of the construction machines, facing +z.
function machine(name: 'bulldozer' | 'dump-truck', length: number): THREE.Group {
  const g = modelFitted(construction(name), length, { turn: name === 'bulldozer' ? BULLDOZER_TURN : DUMP_TRUCK_TURN }, () => part(new THREE.BoxGeometry(0.16, 0.12, length), '#e0a030'))
  g.userData.liveOnly = true
  return g
}

// A Car Kit vehicle facing +z with its wheels on the ground, or a box if it can't load.
function kitVehicle(name: string, lift: number, modelCopy: ModelCopy): THREE.Group {
  const g = new THREE.Group()
  const model = modelCopy(carKit(name), KIT_SCALE, () => part(new THREE.BoxGeometry(0.16, 0.12, 0.3), '#e0a030'))
  model.position.y = lift * KIT_SCALE
  g.add(model)
  g.userData.liveOnly = true
  return g
}
export type ModelCopy = (url: string, scale: number, fallback: () => THREE.Object3D) => THREE.Group

const smooth = (t: number) => t * t * (3 - 2 * t)

// Values at a point in a looping cycle, eased between keyframes.
function keyframes<K extends string>(keys: ({ at: number } & Record<K, number>)[], p: number): Record<K, number> {
  let i = 0
  while (i < keys.length - 2 && p >= keys[i + 1].at) i++
  const a = keys[i]
  const b = keys[i + 1]
  const t = smooth(Math.min(1, Math.max(0, (p - a.at) / (b.at - a.at))))
  const out = {} as Record<K, number>
  for (const k of Object.keys(a) as (K | 'at')[]) if (k !== 'at') out[k] = a[k] + (b[k] - a[k]) * t
  return out
}

// ---- The excavator: tracks, a cab that slews round, and a boom, arm and
// bucket that dig, lift, swing over the truck and tip.

const EXCAVATOR_CYCLE = 7 // seconds
const DIG = { at: 0, yaw: 0, boom: 0, arm: 0, bucket: 0 }
type Pose = typeof DIG

function excavator(digYaw: number, truckYaw: number): THREE.Group {
  const root = new THREE.Group()
  for (const side of [-1, 1]) root.add(part(new THREE.BoxGeometry(0.08, 0.07, 0.36), '#37383c', side * 0.1, 0, 0))
  const slew = new THREE.Group()
  slew.position.y = 0.07
  slew.add(part(new THREE.BoxGeometry(0.26, 0.11, 0.26), '#f2b632'))
  slew.add(part(new THREE.BoxGeometry(0.24, 0.09, 0.08), '#5b5d63', 0, 0.01, -0.15)) // counterweight
  slew.add(part(new THREE.BoxGeometry(0.1, 0.13, 0.11), '#f2b632', -0.07, 0.11, 0.04))
  slew.add(part(new THREE.BoxGeometry(0.09, 0.08, 0.01), '#9fd3f0', -0.07, 0.14, 0.1)) // windscreen
  const boom = new THREE.Group()
  boom.position.set(0.06, 0.13, 0.1)
  boom.add(part(new THREE.BoxGeometry(0.05, 0.05, 0.36).translate(0, 0, 0.18), '#e8a92a'))
  const arm = new THREE.Group()
  arm.position.z = 0.36
  arm.add(part(new THREE.BoxGeometry(0.04, 0.04, 0.28).translate(0, 0, 0.14), '#e8a92a'))
  const bucket = new THREE.Group()
  bucket.position.z = 0.28
  bucket.add(part(new THREE.BoxGeometry(0.1, 0.07, 0.07).translate(0, 0, 0.03), '#4a4b50'))
  const load = part(new THREE.IcosahedronGeometry(0.035, 0), '#232120', 0, 0.03, 0.03)
  bucket.add(load)
  arm.add(bucket)
  boom.add(arm)
  slew.add(boom)
  root.add(slew)

  // Dig into the face, curl the bucket full, lift and swing over the truck,
  // tip it out, and swing back.
  const keys: Pose[] = [
    { at: 0, yaw: digYaw, boom: -0.55, arm: 1.1, bucket: -0.4 },
    { at: 0.18, yaw: digYaw, boom: 0.15, arm: 1.9, bucket: 0.2 },
    { at: 0.3, yaw: digYaw, boom: 0.0, arm: 1.6, bucket: 1.1 },
    { at: 0.48, yaw: truckYaw, boom: -0.75, arm: 1.3, bucket: 1.1 },
    { at: 0.6, yaw: truckYaw, boom: -0.75, arm: 1.3, bucket: -0.7 },
    { at: 0.68, yaw: truckYaw, boom: -0.7, arm: 1.2, bucket: -0.7 },
    { at: 1, yaw: digYaw, boom: -0.55, arm: 1.1, bucket: -0.4 },
  ]
  root.userData.animate = ((seconds) => {
    const p = (seconds % EXCAVATOR_CYCLE) / EXCAVATOR_CYCLE
    const pose = keyframes(keys, p)
    slew.rotation.y = pose.yaw
    boom.rotation.x = pose.boom - 0.35
    arm.rotation.x = pose.arm
    bucket.rotation.x = pose.bucket
    load.visible = p > 0.25 && p < 0.58 // a full bucket from the dig until it's tipped
  }) satisfies Animate
  return root
}

// Something driving out along a path and backing in along it again, with a
// wait at each end: { wait at the start, drive, wait at the end, back }.
function shuttle(vehicle: THREE.Object3D, curve: THREE.CatmullRomCurve3, times: [number, number, number, number], offset = 0): Animate {
  const total = times.reduce((a, b) => a + b, 0)
  return (seconds) => {
    let t = (seconds + offset) % total
    let u = 0
    if ((t -= times[0]) < 0) u = 0
    else if ((t -= times[1]) < 0) u = smooth(1 + t / times[1])
    else if ((t -= times[2]) < 0) u = 1
    else u = 1 - smooth(Math.min(1, (t + 0) / times[3]))
    const p = curve.getPointAt(u)
    const tangent = curve.getTangentAt(u)
    vehicle.position.set(p.x, p.y, p.z)
    vehicle.rotation.y = Math.atan2(tangent.x, tangent.z)
  }
}

// To and fro along x between two points, turning round at each end (like
// the bulldozer on a construction site).
function toAndFro(vehicle: THREE.Object3D, from: number, to: number, speed: number): Animate {
  return (seconds) => {
    const s = Math.sin(seconds * speed)
    vehicle.position.x = (from + to) / 2 + ((to - from) / 2) * s
    vehicle.rotation.y = (Math.PI / 2) * Math.max(-1, Math.min(1, Math.cos(seconds * speed) * 4)) // swinging round at each end
  }
}

// ---- The Coal Mine: an open pit stepping down in terraces at the back, its
// floor black with coal, where an excavator digs and loads a haul truck. The
// truck drives up to the stockpile in the yard at the front and backs down
// again, while a loader pushes the pile up.

export function buildCoalMine(group: THREE.Group, add: Add, w: number, d: number) {
  const hw = w / 2 - 0.05
  const hd = d / 2 - 0.05
  const front = d * 0.14 // where the pit opens onto the yard
  const berm = Math.min(w, d) * 0.08
  const step = Math.min(w, d) * 0.06
  const heights = [0.34, 0.26, 0.18, 0.1]
  const earth = ['#a4825c', '#94744f', '#a4825c', '#8a6b48']
  const rim = heights[0]
  // Grassy banks slope up from the edge of the lot to the rim, so the
  // terraces read as stepping down into a hole rather than up a mound.
  const slope = Math.hypot(berm, rim)
  const tilt = Math.atan2(rim, berm)
  for (const side of [-1, 1]) {
    add(new THREE.BoxGeometry(slope, 0.03, front + hd).rotateZ(side * -tilt), BANK, side * (hw - berm / 2), 0, (front - hd) / 2)
  }
  add(new THREE.BoxGeometry(w - 0.1 - 2 * berm, 0.03, slope).rotateX(-tilt), BANK, 0, 0, -hd + berm / 2)
  heights.forEach((h, k) => {
    const outer = hw - berm - k * step
    const inner = outer - step
    const back = hd - berm - k * step
    const depth = front + back
    for (const side of [-1, 1]) add(new THREE.BoxGeometry(step, h, depth), earth[k], side * (outer - step / 2), 0, (front - back) / 2)
    add(new THREE.BoxGeometry(inner * 2, h, step), earth[k], 0, 0, -back + step / 2)
    // A seam of coal along each terrace's face.
    for (const side of [-1, 1]) add(new THREE.BoxGeometry(0.012, 0.035, depth - step), '#2a2624', side * inner, h * 0.45, (front - back) / 2 + step / 2)
  })
  const floorW = (hw - berm - 4 * step) * 2
  const floorBack = hd - berm - 4 * step
  add(new THREE.BoxGeometry(floorW, 0.02, floorBack + front), '#4a3d33', 0, 0, (front - floorBack) / 2)
  for (let i = 0; i < 9; i++) {
    const x = [0.1, 0.8, 0.35, 0.65, 0.2, 0.9, 0.5, 0.05, 0.75][i] - 0.5
    const z = [0.7, 0.2, 0.95, 0.55, 0.1, 0.85, 0.35, 0.4, 0.0][i] - 0.5
    add(new THREE.IcosahedronGeometry(0.03 + (i % 3) * 0.012, 0), '#232120', x * floorW * 0.8, 0.02, -floorBack * 0.4 + z * floorBack * 0.6)
  }
  // The yard: gravel, the coal stockpile, the site office and floodlights.
  add(new THREE.BoxGeometry(w - 0.1, 0.015, hd - front), '#a39278', 0, 0, (front + hd) / 2)
  const pile = { x: -w * 0.28, z: d * 0.34 }
  add(new THREE.ConeGeometry(w * 0.13, 0.42, 7), '#262322', pile.x, 0.015, pile.z)
  add(new THREE.ConeGeometry(w * 0.08, 0.2, 6), '#2e2a28', pile.x - w * 0.1, 0.015, pile.z - d * 0.07)
  add(new THREE.BoxGeometry(w * 0.14, 0.24, d * 0.09), '#f1ece2', w * 0.33, 0.015, d * 0.37)
  add(new THREE.BoxGeometry(w * 0.16, 0.04, d * 0.11), '#3f6fa8', w * 0.33, 0.255, d * 0.37)
  add(new THREE.BoxGeometry(0.06, 0.08, 0.01), '#9fd3f0', w * 0.33, 0.1, d * 0.37 + d * 0.045)
  for (const [x, z] of [[-hw + 0.08, hd - 0.08], [hw - 0.08, front + 0.1]]) {
    add(new THREE.CylinderGeometry(0.015, 0.02, 0.7, 5), '#4b4e55', x, 0, z)
    add(new THREE.BoxGeometry(0.1, 0.05, 0.05), '#fff4c8', x, 0.68, z)
  }

  // The excavator on the pit floor, digging at the back and loading to its right.
  const digger = excavator(Math.PI + 0.5, Math.PI / 2 + 0.2)
  digger.position.set(-floorW * 0.18, 0.02, -floorBack * 0.25)
  digger.rotation.y = 0
  group.add(digger)

  // The haul truck: loaded beside the excavator, then up to the stockpile.
  const truck = machine('dump-truck', 0.42)
  const route = new THREE.CatmullRomCurve3([
    new THREE.Vector3(floorW * 0.22, 0.02, -floorBack * 0.2),
    new THREE.Vector3(floorW * 0.25, 0.02, front),
    new THREE.Vector3(0, 0.02, d * 0.3),
    new THREE.Vector3(pile.x + w * 0.17, 0.02, pile.z + d * 0.05),
  ])
  truck.userData.animate = shuttle(truck, route, [9, 4, 2.5, 4.5])
  group.add(truck)

  // The loader working the stockpile.
  const loader = machine('bulldozer', 0.4)
  loader.position.set(pile.x, 0.015, pile.z - d * 0.18)
  loader.userData.animate = toAndFro(loader, pile.x - w * 0.12, pile.x + w * 0.1, 0.7)
  group.add(loader)
}

// ---- The Landfill: grassy banks round mounds of rubbish, a bulldozer
// spreading it on top, a garbage truck that backs in to tip its load, and
// gulls circling overhead.

export function buildLandfill(group: THREE.Group, add: Add, w: number, d: number, modelCopy: ModelCopy) {
  const hw = w / 2 - 0.05
  const hd = d / 2 - 0.05
  add(new THREE.BoxGeometry(w - 0.1, 0.015, d - 0.1), '#7d6a52', 0, 0, 0)
  // Banks round the back and sides.
  for (const side of [-1, 1]) add(new THREE.BoxGeometry(0.16, 0.16, d - 0.1), '#7da35a', side * (hw - 0.08), 0, 0)
  add(new THREE.BoxGeometry(w - 0.42, 0.16, 0.16), '#7da35a', 0, 0, -hd + 0.08)
  // The tip: mounds of rubbish with bags and boxes poking out.
  // (At the back: the front is kept clear for the bulldozer's terrace and the truck.)
  const mounds: [number, number, number, string][] = [
    [-0.4, -0.55, 0.38, '#8d8a83'],
    [0.2, -0.6, 0.36, '#7a6450'],
    [0.62, -0.3, 0.26, '#8f8577'],
    [-0.1, -0.2, 0.22, '#857c70'],
  ]
  for (const [x, z, r, color] of mounds) {
    const mound = new THREE.IcosahedronGeometry(r * w * 0.42, 1).scale(1, 0.4, 1)
    add(mound, color, x * w * 0.6, 0, z * d * 0.6)
  }
  const litter = ['#3b6fb6', '#d9d4c7', '#4c8a3f', '#c94f3c', '#2b2b2b', '#e8c547']
  for (let i = 0; i < 22; i++) {
    const x = (((i * 37) % 20) / 20 - 0.5) * w * 0.62
    const z = (((i * 59) % 20) / 20 - 0.85) * d * 0.5
    const size = 0.045 + (i % 3) * 0.015
    const shape = i % 2 ? new THREE.BoxGeometry(size, size, size * 1.3).rotateY(i) : new THREE.IcosahedronGeometry(size * 0.7, 0)
    add(shape, litter[i % litter.length], x, 0.1 + ((i * 7) % 5) * 0.025, z)
  }
  // A fence along the front, with a gap for the gate.
  const gate = w * 0.3
  for (const [from, to] of [[-hw, gate - 0.3], [gate + 0.3, hw]]) {
    add(new THREE.BoxGeometry(to - from, 0.02, 0.015), '#9aa0a8', (from + to) / 2, 0.16, hd - 0.02)
    for (let x = from; x <= to + 0.01; x += (to - from) / Math.max(1, Math.round((to - from) / 0.3))) add(new THREE.BoxGeometry(0.02, 0.2, 0.02), '#6c7078', x, 0, hd - 0.02)
  }

  // The bulldozer spreading rubbish across a flattened terrace.
  const terrace = 0.1
  add(new THREE.BoxGeometry(w * 0.55, terrace, d * 0.22), '#857a6c', -w * 0.12, 0, d * 0.1)
  const dozer = machine('bulldozer', 0.42)
  dozer.position.set(0, terrace, d * 0.1)
  dozer.userData.animate = toAndFro(dozer, -w * 0.3, w * 0.06, 0.5)
  group.add(dozer)

  // The garbage truck comes in through the gate, tips, and backs out.
  const truck = kitVehicle('garbage-truck', 0.3, modelCopy)
  const route = new THREE.CatmullRomCurve3([
    new THREE.Vector3(gate, 0.015, hd + 0.4),
    new THREE.Vector3(gate, 0.015, hd - 0.4),
    new THREE.Vector3(gate, 0.015, -d * 0.02),
  ])
  truck.userData.animate = shuttle(truck, route, [5, 4, 3, 4], 2)
  group.add(truck)

  // Gulls wheeling overhead, flapping now and then.
  for (let i = 0; i < 3; i++) {
    const gull = new THREE.Group()
    const wings = [-1, 1].map((side) => {
      const wing = new THREE.Group()
      wing.add(part(new THREE.BoxGeometry(0.09, 0.008, 0.035).translate((side * 0.09) / 2, 0, 0), '#f4f4f0'))
      gull.add(wing)
      return { wing, side }
    })
    gull.add(part(new THREE.BoxGeometry(0.03, 0.025, 0.07), '#ffffff'))
    const radius = 0.35 + i * 0.18
    const height = 0.85 + i * 0.12
    gull.userData.animate = ((seconds) => {
      const a = seconds * (0.6 - i * 0.1) + i * 2.1
      gull.position.set(Math.cos(a) * radius, height + Math.sin(seconds * 0.8 + i) * 0.05, Math.sin(a) * radius - d * 0.05)
      gull.rotation.y = -a // flying round, nose along the circle
      const flap = Math.sin(seconds * 9 + i) * 0.5 * Math.max(0, Math.sin(seconds * 0.9 + i))
      for (const { wing, side } of wings) wing.rotation.z = side * flap
    }) satisfies Animate
    group.add(gull)
  }
}
