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

// ---- The Offshore Oil Refinery: a steel platform on legs out in the ocean,
// with storage tanks, distillation columns, a blazing flare stack with rising
// smoke, a pumping derrick and nodding pumpjack, a slewing offshore crane, a
// radar dish, a helicopter flying rounds from the helipad, and an oil tanker
// that sails in to moor alongside.

export function buildOilRefinery(group: THREE.Group, add: Add, w: number, d: number) {
  const deckY = 0.28
  const hw = w / 2 - 0.18
  const hd = d / 2 - 0.18

  // Steel jacket legs plunging into the sea, with yellow splash-zone collars
  // at the waterline and submerged pontoons along each side.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const lx = sx * (hw - 0.14)
      const lz = sz * (hd - 0.14)
      add(new THREE.CylinderGeometry(0.14, 0.17, deckY + 0.24, 10), '#3a3f47', lx, -0.22, lz)
      add(new THREE.CylinderGeometry(0.18, 0.18, 0.1, 10), '#f2b632', lx, 0.02, lz)
    }
    add(new THREE.CylinderGeometry(0.1, 0.12, deckY + 0.22, 8), '#3a3f47', sx * (hw - 0.14), -0.2, 0)
    add(new THREE.CylinderGeometry(0.1, 0.12, deckY + 0.22, 8), '#3a3f47', 0, -0.2, sx * (hd - 0.14))
    // Submerged red buoyancy pontoons and diagonal cross-braces under the deck.
    add(new THREE.CylinderGeometry(0.11, 0.11, d - 0.5, 8).rotateX(Math.PI / 2), '#c8463a', sx * (hw - 0.14), -0.04, 0)
    add(new THREE.BoxGeometry(w - 0.6, 0.04, 0.04).rotateZ(0.12 * sx), '#4a5058', 0, 0.12, sx * (hd - 0.14))
    add(new THREE.BoxGeometry(0.04, 0.04, d - 0.6).rotateX(0.12 * sx), '#4a5058', sx * (hw - 0.14), 0.12, 0)
  }

  // Main steel platform deck with a yellow hazard border and perimeter railings.
  add(new THREE.BoxGeometry(w - 0.32, 0.05, d - 0.32), '#f2b632', 0, deckY, 0)
  add(new THREE.BoxGeometry(w - 0.42, 0.04, d - 0.42), '#5b626b', 0, deckY + 0.03, 0)
  const topY = deckY + 0.07
  for (const side of [-1, 1]) {
    add(new THREE.BoxGeometry(w - 0.38, 0.02, 0.02), '#9aa2ab', 0, topY + 0.08, side * (hd - 0.03))
    add(new THREE.BoxGeometry(0.02, 0.02, d - 0.38), '#9aa2ab', side * (hw - 0.03), topY + 0.08, 0)
  }
  // Raised process deck on the left side for tanks and distillation columns.
  const procY = topY + 0.05
  add(new THREE.BoxGeometry(w * 0.44, 0.05, d * 0.78), '#6c747e', -w * 0.22, topY, -d * 0.04)

  // Cylindrical crude & product storage tanks (front-left) with red hazard bands.
  for (const [tx, tz, r, h] of [
    [-1.15, 0.85, 0.38, 0.52],
    [-1.15, 0.0, 0.34, 0.46],
    [-0.48, 0.78, 0.26, 0.42],
  ] as const) {
    add(new THREE.CylinderGeometry(r, r, h, 14), '#eef1f5', tx, procY, tz)
    add(new THREE.CylinderGeometry(r + 0.008, r + 0.008, 0.07, 14), '#e0533f', tx, procY + h * 0.62, tz)
    add(new THREE.ConeGeometry(r + 0.02, 0.1, 14), '#cfd6de', tx, procY + h, tz)
  }

  // Two spherical Horton pressure tanks on steel legs.
  for (const sz of [0.1, 0.58]) {
    add(new THREE.SphereGeometry(0.2, 12, 8), '#f4f6f8', -0.48, procY + 0.08, sz)
    add(new THREE.TorusGeometry(0.2, 0.015, 6, 16).rotateX(Math.PI / 2), '#e0533f', -0.48, procY + 0.26, sz)
    for (const [lx, lz] of [[-0.1, -0.1], [0.1, -0.1], [-0.1, 0.1], [0.1, 0.1]]) {
      add(new THREE.CylinderGeometry(0.015, 0.015, 0.18, 5), '#4a5058', -0.48 + lx, procY, sz + lz)
    }
  }

  // Two tall fractionating / distillation columns (back-left) with ring walkways and overhead piping.
  for (const [cx, cz, r, h] of [
    [-1.12, -0.82, 0.19, 1.45],
    [-0.55, -0.82, 0.16, 1.22],
  ] as const) {
    add(new THREE.CylinderGeometry(r * 0.92, r, h, 12), '#c8d0d8', cx, procY, cz)
    add(new THREE.SphereGeometry(r * 0.92, 12, 8), '#c8d0d8', cx, procY + h - r * 0.6, cz)
    for (let ring = 0.28; ring < h - 0.15; ring += 0.34) {
      add(new THREE.CylinderGeometry(r + 0.045, r + 0.045, 0.025, 12), '#4a5058', cx, procY + ring, cz)
    }
  }
  // Overhead steel pipe rack connecting the columns, tanks and drill bay.
  for (const [py, color] of [[procY + 0.32, '#e0a030'], [procY + 0.4, '#c8463a'], [procY + 0.48, '#9aa2ab']] as const) {
    add(new THREE.CylinderGeometry(0.025, 0.025, 1.65, 8).rotateX(Math.PI / 2), color, -0.82, py, 0.0)
    add(new THREE.CylinderGeometry(0.025, 0.025, 1.35, 8).rotateZ(Math.PI / 2), color, -0.2, py, -0.82)
  }

  // Crew quarters & control block (mid-right) with bridge windows and a rotating radar dish.
  const qx = 1.05
  const qz = -0.25
  add(new THREE.BoxGeometry(0.88, 0.34, 0.78), '#eef0f2', qx, topY, qz)
  add(new THREE.BoxGeometry(0.9, 0.05, 0.8), '#e0663a', qx, topY + 0.34, qz)
  add(new THREE.BoxGeometry(0.72, 0.26, 0.62), '#eef0f2', qx, topY + 0.39, qz)
  add(new THREE.BoxGeometry(0.76, 0.05, 0.66), '#3a6fb0', qx, topY + 0.65, qz)
  add(new THREE.BoxGeometry(0.56, 0.1, 0.02), '#9fd3f0', qx, topY + 0.48, qz + 0.31)
  add(new THREE.BoxGeometry(0.02, 0.1, 0.46), '#9fd3f0', qx + 0.36, topY + 0.48, qz)
  add(new THREE.CylinderGeometry(0.025, 0.025, 0.22, 6), '#9aa1a8', qx, topY + 0.7, qz)
  const radar = new THREE.Group()
  radar.position.set(qx, topY + 0.92, qz)
  radar.add(part(new THREE.BoxGeometry(0.28, 0.05, 0.04), '#f4f6f8', 0, 0, 0))
  radar.userData.animate = ((seconds) => {
    radar.rotation.y = seconds * 1.4
  }) satisfies Animate
  group.add(radar)

  // Cantilevered helipad at the front-right corner (+x, +z) with an H and perimeter lights.
  const hx = 1.18
  const hz = 1.12
  const heliY = topY + 0.24
  add(new THREE.BoxGeometry(0.12, 0.24, 0.12), '#3a3f47', hx - 0.18, topY, hz - 0.18)
  add(new THREE.CylinderGeometry(0.56, 0.56, 0.04, 8), '#454b54', hx, heliY, hz)
  add(new THREE.TorusGeometry(0.4, 0.018, 4, 16).rotateX(Math.PI / 2), '#f2b632', hx, heliY + 0.03, hz)
  for (const dx of [-0.12, 0.12]) add(new THREE.BoxGeometry(0.05, 0.008, 0.26), '#ffffff', hx + dx, heliY + 0.04, hz)
  add(new THREE.BoxGeometry(0.24, 0.008, 0.05), '#ffffff', hx, heliY + 0.04, hz)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8
    const lamp = add(new THREE.SphereGeometry(0.022, 6, 4), '#4ade80', hx + Math.cos(a) * 0.5, heliY + 0.035, hz + Math.sin(a) * 0.5)
    ;(lamp.material as THREE.MeshStandardMaterial).emissive.set('#4ade80')
  }

  // ---- 1. Blazing Flare Stack (back-left corner) with flickering fire and smoke puffs.
  const fx = -1.42
  const fz = -1.42
  const flareH = 1.95
  add(new THREE.CylinderGeometry(0.045, 0.09, flareH, 8), '#4a5058', fx, procY, fz)
  add(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 8), '#c8463a', fx, procY + flareH - 0.16, fz)
  add(new THREE.CylinderGeometry(0.05, 0.06, 0.08, 8), '#2b2d33', fx, procY + flareH, fz)
  const flareTop = procY + flareH + 0.08
  const flame = new THREE.Group()
  flame.position.set(fx, flareTop, fz)
  flame.userData.flies = true
  const addFireCone = (color: string, r: number, h: number) => {
    const m = new THREE.Mesh(
      new THREE.ConeGeometry(r, h, 8).translate(0, h / 2, 0),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92 }),
    )
    flame.add(m)
    return m
  }
  const outerFlame = addFireCone('#ff6a1f', 0.11, 0.42)
  const innerFlame = addFireCone('#ffd23f', 0.065, 0.26)
  const smokeGroup = new THREE.Group()
  smokeGroup.userData.flies = true
  smokeGroup.userData.liveOnly = true
  const smokePuffs = Array.from({ length: 7 }, () => {
    const m = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.11, 0),
      new THREE.MeshStandardMaterial({ color: '#45484f', transparent: true, opacity: 0, flatShading: true, depthWrite: false }),
    )
    smokeGroup.add(m)
    return m
  })
  group.add(flame, smokeGroup)
  flame.userData.animate = ((seconds) => {
    const pulse = 1 + Math.sin(seconds * 23) * 0.18 + Math.cos(seconds * 37) * 0.1
    outerFlame.scale.set(1 + Math.sin(seconds * 19) * 0.12, pulse, 1 + Math.cos(seconds * 29) * 0.12)
    innerFlame.scale.set(1, 0.9 + Math.sin(seconds * 31) * 0.2, 1)
    flame.rotation.z = 0.12 + Math.sin(seconds * 11) * 0.08
    flame.rotation.x = 0.06 + Math.cos(seconds * 13) * 0.06
    smokePuffs.forEach((puff, i) => {
      const u = (seconds * 0.45 + i / smokePuffs.length) % 1
      puff.position.set(fx + u * 0.55 + Math.sin(seconds * 2 + i) * 0.05, flareTop + 0.28 + u * 1.15, fz + u * 0.25)
      puff.scale.setScalar(0.55 + u * 1.55)
      ;(puff.material as THREE.MeshStandardMaterial).opacity = u < 0.15 ? u * 4 : 0.6 * (1 - (u - 0.15) / 0.85)
    })
  }) satisfies Animate

  // ---- 2. Drilling Derrick (back-center) with a heaving travelling block and spinning drill string.
  const dx = 0.22
  const dz = -1.05
  const derrickH = 1.55
  add(new THREE.BoxGeometry(0.72, 0.06, 0.72), '#3a3f47', dx, topY, dz)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = add(new THREE.CylinderGeometry(0.022, 0.032, derrickH, 6), '#d9483b', dx + sx * 0.22, topY + 0.06, dz + sz * 0.22)
      leg.rotation.z = sx * 0.09
      leg.rotation.x = -sz * 0.09
    }
  }
  for (const [y, wSpan] of [[0.45, 0.44], [0.9, 0.34], [1.35, 0.24]] as const) {
    for (const side of [-1, 1]) {
      add(new THREE.BoxGeometry(wSpan, 0.025, 0.025), '#f4f6f8', dx, topY + y, dz + side * (wSpan / 2))
      add(new THREE.BoxGeometry(0.025, 0.025, wSpan), '#f4f6f8', dx + side * (wSpan / 2), topY + y, dz)
    }
  }
  add(new THREE.BoxGeometry(0.28, 0.08, 0.28), '#f2b632', dx, topY + derrickH, dz) // crown block
  const drillPipe = part(new THREE.CylinderGeometry(0.035, 0.035, derrickH - 0.1, 8), '#2b2d33', dx, topY + 0.06, dz)
  const rotaryTable = part(new THREE.CylinderGeometry(0.16, 0.18, 0.06, 8), '#f2b632', dx, topY + 0.06, dz)
  const hoist = new THREE.Group()
  hoist.position.set(dx, topY + 0.8, dz)
  hoist.add(part(new THREE.BoxGeometry(0.16, 0.18, 0.14), '#f2b632', 0, 0, 0))
  hoist.add(part(new THREE.BoxGeometry(0.18, 0.04, 0.16), '#2b2d33', 0, 0.07, 0))
  group.add(drillPipe, rotaryTable, hoist)
  hoist.userData.animate = ((seconds) => {
    hoist.position.y = topY + 0.35 + (Math.sin(seconds * 1.8) * 0.5 + 0.5) * 0.78
    rotaryTable.rotation.y = seconds * 3.5
    drillPipe.rotation.y = seconds * 3.5
  }) satisfies Animate

  // ---- 3. Nodding Horsehead Pumpjack (center of the deck).
  const px = 0.22
  const pz = -0.05
  add(new THREE.BoxGeometry(0.32, 0.04, 0.72), '#3a3f47', px, topY, pz)
  // Samson post (A-frame) and wellhead at the front (+z).
  add(new THREE.BoxGeometry(0.1, 0.42, 0.08), '#2b2d33', px, topY + 0.04, pz)
  add(new THREE.CylinderGeometry(0.045, 0.055, 0.14, 8), '#c8463a', px, topY + 0.04, pz + 0.26)
  const walkingBeam = new THREE.Group()
  walkingBeam.position.set(px, topY + 0.45, pz)
  walkingBeam.add(part(new THREE.BoxGeometry(0.07, 0.07, 0.56), '#f2b632', 0, -0.035, 0))
  // The curved horsehead at the front (+z) of the walking beam.
  walkingBeam.add(part(new THREE.BoxGeometry(0.09, 0.22, 0.1), '#e0533f', 0, -0.11, 0.27))
  walkingBeam.add(part(new THREE.BoxGeometry(0.14, 0.1, 0.12), '#2b2d33', 0, -0.05, -0.26)) // counterweight
  const polishRod = part(new THREE.CylinderGeometry(0.012, 0.012, 0.36, 6), '#cfd6de', px, topY + 0.1, pz + 0.27)
  group.add(walkingBeam, polishRod)
  walkingBeam.userData.animate = ((seconds) => {
    const tilt = Math.sin(seconds * 2.6) * 0.28
    walkingBeam.rotation.x = tilt
    polishRod.position.y = topY + 0.1 - Math.sin(seconds * 2.6) * 0.07
  }) satisfies Animate

  // ---- 4. Slewing Offshore Pedestal Crane (front-center edge, facing the sea at +z).
  const crX = -0.18
  const crZ = 1.38
  add(new THREE.CylinderGeometry(0.12, 0.15, 0.32, 10), '#f2b632', crX, topY, crZ)
  const craneCab = new THREE.Group()
  craneCab.position.set(crX, topY + 0.32, crZ)
  craneCab.add(part(new THREE.BoxGeometry(0.24, 0.16, 0.26), '#f2b632', 0, 0, 0))
  craneCab.add(part(new THREE.BoxGeometry(0.1, 0.1, 0.02), '#9fd3f0', -0.06, 0.04, 0.13))
  // Crane boom reaching out at 40° above horizontal.
  const boomLen = 1.05
  const boomAngle = 0.65
  const craneBoom = new THREE.Group()
  craneBoom.position.set(0, 0.1, 0.08)
  craneBoom.rotation.x = -boomAngle
  craneBoom.add(part(new THREE.BoxGeometry(0.06, 0.06, boomLen).translate(0, 0, boomLen / 2), '#e8a92a', 0, 0, 0))
  craneCab.add(craneBoom)
  const tipZ = 0.08 + Math.cos(boomAngle) * boomLen
  const tipY = 0.1 + Math.sin(boomAngle) * boomLen
  const craneCable = part(new THREE.CylinderGeometry(0.008, 0.008, 0.45, 4), '#2b2d33', 0, tipY - 0.45, tipZ)
  const craneLoad = new THREE.Group()
  craneLoad.position.set(0, tipY - 0.45, tipZ)
  craneLoad.add(part(new THREE.BoxGeometry(0.18, 0.03, 0.18), '#8a5a36', 0, 0, 0))
  for (const [bx, bz] of [[-0.04, -0.04], [0.04, -0.04], [0, 0.04]]) {
    craneLoad.add(part(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 8), '#c8463a', bx, 0.03, bz))
  }
  craneCab.add(craneCable, craneLoad)
  group.add(craneCab)
  craneCab.userData.animate = ((seconds) => {
    craneCab.rotation.y = Math.sin(seconds * 0.55) * 0.85
    const drop = 0.35 + (Math.cos(seconds * 1.1) * 0.5 + 0.5) * 0.25
    craneCable.scale.y = drop / 0.45
    craneCable.position.y = tipY - drop
    craneLoad.position.y = tipY - drop - 0.05
  }) satisfies Animate

  // ---- 5. Offshore Helicopter: lands on the helipad, spins up, lifts off,
  // circles out over the waves, and comes back in to land.
  const chopper = new THREE.Group()
  chopper.userData.liveOnly = true
  chopper.userData.flies = true
  for (const side of [-1, 1]) {
    chopper.add(part(new THREE.BoxGeometry(0.02, 0.015, 0.32), '#3a3f47', side * 0.09, 0, 0))
    chopper.add(part(new THREE.BoxGeometry(0.015, 0.05, 0.015), '#3a3f47', side * 0.09, 0.015, 0.07))
    chopper.add(part(new THREE.BoxGeometry(0.015, 0.05, 0.015), '#3a3f47', side * 0.09, 0.015, -0.07))
  }
  chopper.add(part(new THREE.BoxGeometry(0.2, 0.15, 0.3), '#f2b632', 0, 0.06, 0.02))
  chopper.add(part(new THREE.BoxGeometry(0.205, 0.04, 0.305), '#c8463a', 0, 0.09, 0.02))
  chopper.add(part(new THREE.BoxGeometry(0.17, 0.09, 0.08), '#9fd3f0', 0, 0.1, 0.15))
  chopper.add(part(new THREE.BoxGeometry(0.05, 0.05, 0.28), '#f2b632', 0, 0.12, -0.26))
  chopper.add(part(new THREE.BoxGeometry(0.02, 0.11, 0.06), '#c8463a', 0, 0.13, -0.39))
  const mainRotor = new THREE.Group()
  mainRotor.position.set(0, 0.23, 0.02)
  mainRotor.add(part(new THREE.BoxGeometry(0.62, 0.01, 0.04), '#2b2d33', 0, 0, 0))
  mainRotor.add(part(new THREE.BoxGeometry(0.04, 0.01, 0.62), '#2b2d33', 0, 0, 0))
  chopper.add(mainRotor)
  const tailRotor = new THREE.Group()
  tailRotor.position.set(0.025, 0.17, -0.39)
  tailRotor.add(part(new THREE.BoxGeometry(0.01, 0.14, 0.025), '#2b2d33', 0, 0, 0))
  chopper.add(tailRotor)
  group.add(chopper)

  const HELI_CYCLE = 26
  const padRestY = heliY + 0.04
  chopper.userData.animate = ((seconds) => {
    mainRotor.rotation.y = seconds * 22
    tailRotor.rotation.x = seconds * 26
    const p = (seconds % HELI_CYCLE) / HELI_CYCLE
    if (p < 0.22) {
      // Parked on the helipad, rotors turning.
      chopper.position.set(hx, padRestY, hz)
      chopper.rotation.set(0, -0.4, 0)
    } else if (p < 0.34) {
      // Vertical lift-off and nose-down transition into forward flight.
      const u = smooth((p - 0.22) / 0.12)
      chopper.position.set(hx + u * 0.25, padRestY + u * 1.15, hz + u * 0.25)
      chopper.rotation.set(u * 0.14, -0.4 + u * 0.4, 0)
    } else if (p < 0.82) {
      // Circling wide around the offshore platform over the sea.
      const u = (p - 0.34) / 0.48
      const a = u * Math.PI * 2 - Math.PI / 4
      const r = 2.05
      chopper.position.set(Math.cos(a) * r, padRestY + 1.15 + Math.sin(u * Math.PI * 2) * 0.18, Math.sin(a) * r)
      chopper.rotation.set(0.14, Math.atan2(-Math.sin(a), Math.cos(a)), -0.18)
    } else {
      // Approach and gentle touchdown back onto the H pad.
      const u = smooth((p - 0.82) / 0.18)
      const startX = Math.cos(-Math.PI / 4) * 2.05
      const startZ = Math.sin(-Math.PI / 4) * 2.05
      chopper.position.set(startX + (hx - startX) * u, padRestY + 1.15 * (1 - u), startZ + (hz - startZ) * u)
      chopper.rotation.set((1 - u) * -0.1, -0.4, 0)
    }
  }) satisfies Animate

  // ---- 6. Shuttle Oil Tanker: sails in from the sea, moors along the south
  // (+z) face of the platform while oil is pumped aboard, and sails out again.
  const tanker = new THREE.Group()
  tanker.userData.liveOnly = true
  tanker.userData.flies = true
  tanker.add(part(new THREE.BoxGeometry(0.44, 0.14, 1.35), '#b83b2f', 0, 0, 0))
  tanker.add(part(new THREE.ConeGeometry(0.22, 0.36, 4).rotateX(Math.PI / 2).rotateZ(Math.PI / 4).scale(1, 0.55, 1), '#b83b2f', 0, 0.07, 0.84))
  tanker.add(part(new THREE.BoxGeometry(0.4, 0.04, 1.28), '#3a3f47', 0, 0.14, 0))
  // Cylindrical oil cargo domes and central deck pipeline along the tanker.
  for (const tz of [-0.15, 0.18, 0.5]) {
    tanker.add(part(new THREE.CylinderGeometry(0.13, 0.13, 0.07, 10), '#e0a030', 0, 0.18, tz))
  }
  tanker.add(part(new THREE.CylinderGeometry(0.018, 0.018, 0.95, 6).rotateX(Math.PI / 2), '#cfd6de', 0, 0.21, 0.18))
  // White bridge superstructure at the stern (-z) with a funnel.
  tanker.add(part(new THREE.BoxGeometry(0.34, 0.24, 0.32), '#f4f6f8', 0, 0.18, -0.46))
  tanker.add(part(new THREE.BoxGeometry(0.35, 0.05, 0.02), '#2b3a4a', 0, 0.32, -0.29))
  tanker.add(part(new THREE.CylinderGeometry(0.05, 0.06, 0.16, 8), '#f2b632', 0, 0.42, -0.52))
  const tankerRoute = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.35, 0.01, hd + 0.48),
    new THREE.Vector3(0.4, 0.01, hd + 0.58),
    new THREE.Vector3(1.5, 0.01, hd + 1.25),
    new THREE.Vector3(2.6, 0.01, hd + 2.4),
  ])
  const moveTanker = shuttle(tanker, tankerRoute, [10, 6, 4, 6])
  tanker.userData.animate = ((seconds) => {
    moveTanker(seconds)
    // Bob and roll gently on the ocean swell.
    tanker.position.y = 0.01 + 0.025 * Math.sin(seconds * 1.4)
    tanker.rotation.z = 0.035 * Math.sin(seconds * 1.7)
  }) satisfies Animate
  group.add(tanker)

  // ---- 7. Two seagulls wheeling overhead around the offshore rig.
  for (let i = 0; i < 2; i++) {
    const gull = new THREE.Group()
    gull.userData.liveOnly = true
    gull.userData.flies = true
    const wings = [-1, 1].map((side) => {
      const wing = new THREE.Group()
      wing.add(part(new THREE.BoxGeometry(0.09, 0.008, 0.035).translate((side * 0.09) / 2, 0, 0), '#f4f4f0'))
      gull.add(wing)
      return { wing, side }
    })
    gull.add(part(new THREE.BoxGeometry(0.03, 0.025, 0.07), '#ffffff'))
    const radius = 0.85 + i * 0.35
    const height = 1.9 + i * 0.22
    gull.userData.animate = ((seconds) => {
      const a = seconds * (0.55 - i * 0.1) + i * 2.7
      gull.position.set(Math.cos(a) * radius, height + Math.sin(seconds * 0.9 + i) * 0.06, Math.sin(a) * radius)
      gull.rotation.y = -a
      const flap = Math.sin(seconds * 9 + i) * 0.5 * Math.max(0, Math.sin(seconds * 0.9 + i))
      for (const { wing, side } of wings) wing.rotation.z = side * flap
    }) satisfies Animate
    group.add(gull)
  }
}
