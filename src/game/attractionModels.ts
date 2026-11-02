import * as THREE from 'three'

// Theme-park and leisure attractions inspired by CityVille's Attractions:
// Go Karts, Pirate Ship Ride, Driving Range, Ferris Wheel, Reverse Bungee,
// Wave Pool, Sky Ride, Roller Coaster, and Magic Castle. Each is built in the
// building's own coordinates (center at origin, front toward +z) and registers
// userData.animate(seconds) on its moving parts so CityView drives them every frame.

type Add = (geometry: THREE.BufferGeometry, color: string, x: number, y: number, z: number) => THREE.Mesh
type Animate = (seconds: number) => void

function part(geometry: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0, material?: THREE.Material): THREE.Mesh {
  geometry.computeBoundingBox()
  const mesh = new THREE.Mesh(geometry, material ?? new THREE.MeshStandardMaterial({ color, flatShading: true }))
  mesh.position.set(x, y - geometry.boundingBox!.min.y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

// 1. Go Karts (3×2): oval asphalt track with red/white curbs, start/finish
// gantry, grandstand bleachers, and three karts racing around the loop.
export function buildGoKarts(group: THREE.Group, add: Add, w: number, d: number) {
  // Turf base and oval asphalt track
  add(new THREE.BoxGeometry(w * 0.96, 0.04, d * 0.96), '#5eb84d', 0, 0, 0)
  add(new THREE.CylinderGeometry(0.82, 0.82, 0.025, 28).scale(1.55, 1, 0.98), '#434850', 0, 0.04, 0.08)
  add(new THREE.CylinderGeometry(0.46, 0.46, 0.03, 24).scale(1.55, 1, 0.92), '#68c256', 0, 0.045, 0.08)

  // Red-and-white rumble strips around the inner oval
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    const c = i % 2 === 0 ? '#e04238' : '#f5f5f2'
    add(new THREE.BoxGeometry(0.14, 0.02, 0.08), c, Math.cos(a) * 0.72, 0.06, 0.08 + Math.sin(a) * 0.43)
  }

  // Start / finish line & gantry arch
  add(new THREE.BoxGeometry(0.12, 0.008, 0.34), '#ffffff', 0, 0.065, 0.72)
  for (const sz of [-0.16, 0.16]) {
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.52, 8), '#cfd6de', 0, 0.06, 0.72 + sz)
  }
  add(new THREE.BoxGeometry(0.08, 0.1, 0.38), '#e04238', 0, 0.52, 0.72)
  add(new THREE.BoxGeometry(0.09, 0.04, 0.34), '#ffd23f', 0, 0.55, 0.72)

  // Grandstand bleachers & pit booth along the back (-z)
  add(new THREE.BoxGeometry(1.3, 0.12, 0.24), '#c9d1d9', -0.35, 0.04, -0.74)
  add(new THREE.BoxGeometry(1.3, 0.12, 0.16), '#3a7bd5', -0.35, 0.16, -0.78)
  add(new THREE.BoxGeometry(0.55, 0.34, 0.32), '#f2ead8', 0.88, 0.04, -0.72)
  add(new THREE.BoxGeometry(0.62, 0.08, 0.38), '#e04238', 0.88, 0.38, -0.72)

  // Tire stacks at the corners
  for (const [tx, tz] of [[-1.28, -0.45], [1.28, -0.45], [-1.28, 0.65], [1.28, 0.65]]) {
    add(new THREE.CylinderGeometry(0.09, 0.09, 0.1, 10), '#2b2e33', tx, 0.04, tz)
    add(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 10), '#e04238', tx, 0.14, tz)
  }

  // Three animated Go Karts racing around the oval
  const kartColors = ['#e63946', '#2f7fe0', '#ffb703']
  const helmetColors = ['#ffffff', '#ffd23f', '#2ec4b6']
  const karts: THREE.Group[] = []
  for (let i = 0; i < 3; i++) {
    const kart = new THREE.Group()
    kart.add(
      part(new THREE.BoxGeometry(0.24, 0.05, 0.15), kartColors[i], 0, 0.02, 0),
      part(new THREE.BoxGeometry(0.08, 0.06, 0.16), kartColors[i], -0.09, 0.07, 0),
      part(new THREE.BoxGeometry(0.06, 0.04, 0.13), '#2b2e33', -0.02, 0.07, 0),
      part(new THREE.SphereGeometry(0.045, 8, 6), helmetColors[i], -0.01, 0.11, 0),
    )
    for (const [wx, wz] of [[-0.08, -0.08], [0.08, -0.08], [-0.08, 0.08], [0.08, 0.08]]) {
      kart.add(part(new THREE.CylinderGeometry(0.032, 0.032, 0.03, 8).rotateX(Math.PI / 2), '#1f2226', wx, 0, wz))
    }
    karts.push(kart)
    group.add(kart)
  }

  const runner = new THREE.Group()
  runner.userData.animate = ((seconds: number) => {
    for (let i = 0; i < karts.length; i++) {
      const lane = i === 1 ? 1.07 : 0.95
      const speed = 1.9 + i * 0.12
      const a = seconds * speed + i * 2.1
      const rx = 0.98 * lane
      const rz = 0.58 * lane
      const x = Math.cos(a) * rx
      const z = 0.08 + Math.sin(a) * rz
      const dx = -Math.sin(a) * rx
      const dz = Math.cos(a) * rz
      karts[i].position.set(x, 0.065, z)
      karts[i].rotation.y = Math.atan2(dx, dz) - Math.PI / 2
    }
  }) satisfies Animate
  group.add(runner)
}

// 2. Pirate Ship Ride (3×2): heavy steel A-frame supports over a wooden pier
// deck, swinging a wooden galleon hull with masts and sails like a pendulum.
export function buildPirateShipRide(group: THREE.Group, add: Add, w: number, d: number) {
  add(new THREE.BoxGeometry(w * 0.92, 0.08, d * 0.88), '#8a6240', 0, 0, 0)
  add(new THREE.BoxGeometry(w * 0.84, 0.06, d * 0.76), '#a47850', 0, 0.08, 0)

  // Queue railings & ticket kiosk at front-left
  add(new THREE.BoxGeometry(0.42, 0.42, 0.38), '#d9483b', -1.05, 0.14, 0.48)
  add(new THREE.ConeGeometry(0.32, 0.22, 4).rotateY(Math.PI / 4), '#ffd23f', -1.05, 0.56, 0.48)

  // Steel A-frame legs straddling the ship along z
  const apexY = 2.05
  for (const sz of [-0.56, 0.56]) {
    for (const sx of [-0.68, 0.68]) {
      const leg = new THREE.CylinderGeometry(0.055, 0.07, 2.05, 8)
      leg.rotateZ(sx * 0.32)
      add(leg, '#2f5aa8', sx * 0.5, 0.14, sz)
    }
  }
  // Top pivot axle beam
  add(new THREE.CylinderGeometry(0.08, 0.08, 1.28, 10).rotateX(Math.PI / 2), '#ffd23f', 0, apexY - 0.08, 0)

  // Swinging pendulum group pivoted at the top axle
  const swing = new THREE.Group()
  swing.position.set(0, apexY, 0)

  // Hanger arms down to the ship hull
  for (const sz of [-0.24, 0.24]) {
    swing.add(part(new THREE.BoxGeometry(0.05, 1.38, 0.05), '#ffd23f', 0, -1.38, sz))
  }
  // Wooden galleon hull
  swing.add(
    part(new THREE.BoxGeometry(1.35, 0.24, 0.52), '#7a4928', 0, -1.58, 0),
    part(new THREE.BoxGeometry(1.58, 0.16, 0.56), '#9b6037', 0, -1.36, 0),
    part(new THREE.BoxGeometry(1.64, 0.06, 0.58), '#e8b630', 0, -1.21, 0),
    // Raised bow and stern castles
    part(new THREE.BoxGeometry(0.34, 0.22, 0.54), '#7a4928', -0.72, -1.22, 0),
    part(new THREE.BoxGeometry(0.34, 0.22, 0.54), '#7a4928', 0.72, -1.22, 0),
    part(new THREE.ConeGeometry(0.18, 0.35, 4).rotateZ(Math.PI / 2), '#e8b630', 0.96, -1.28, 0),
    // Center mast, crow's nest, and billowing sail
    part(new THREE.CylinderGeometry(0.035, 0.045, 0.95, 8), '#5c381e', 0, -1.2, 0),
    part(new THREE.BoxGeometry(0.08, 0.42, 0.52), '#f8f4e8', 0.05, -0.82, 0),
    part(new THREE.BoxGeometry(0.09, 0.12, 0.54), '#d93829', 0.05, -0.64, 0),
  )

  swing.userData.animate = ((seconds: number) => {
    swing.rotation.z = Math.sin(seconds * 1.85) * 0.92
  }) satisfies Animate
  group.add(swing)
}

// 3. Driving Range (3×3): two-tier covered tee pavilion with golfers hitting
// parabolic golf balls out onto a green fairway with yardage targets.
export function buildDrivingRange(group: THREE.Group, add: Add, w: number, d: number) {
  // Fairway turf and side safety net poles
  add(new THREE.BoxGeometry(w * 0.96, 0.04, d * 0.96), '#52b848', 0, 0, 0)
  for (const sx of [-1.35, 1.35]) {
    for (const z of [-1.1, -0.3, 0.5, 1.25]) {
      add(new THREE.CylinderGeometry(0.025, 0.03, 1.35, 6), '#6c7682', sx, 0.04, z)
    }
    add(new THREE.BoxGeometry(0.02, 0.03, d * 0.85), '#8c96a2', sx, 1.36, 0.08)
  }

  // Two-tier tee-box pavilion along the back (-z)
  add(new THREE.BoxGeometry(2.5, 0.48, 0.68), '#f0ebe1', 0, 0.04, -1.02)
  add(new THREE.BoxGeometry(2.54, 0.07, 0.76), '#2f7a4f', 0, 0.52, -1.0)
  add(new THREE.BoxGeometry(2.5, 0.44, 0.62), '#f0ebe1', 0, 0.59, -1.05)
  add(new THREE.BoxGeometry(2.6, 0.09, 0.82), '#24633f', 0, 1.03, -0.98)

  // Tee mats & dividers
  for (const x of [-0.9, -0.3, 0.3, 0.9]) {
    add(new THREE.BoxGeometry(0.36, 0.02, 0.34), '#2e8540', x, 0.05, -0.62)
    add(new THREE.SphereGeometry(0.08, 8, 6), '#f5d0a9', x - 0.08, 0.22, -0.64)
  }

  // Target greens & flagsticks out on the range
  const targets: [number, number, string][] = [
    [-0.65, 0.15, '#ffd23f'],
    [0.55, 0.35, '#e63946'],
    [-0.15, 0.98, '#2f7fe0'],
  ]
  for (const [tx, tz, flagColor] of targets) {
    add(new THREE.CylinderGeometry(0.34, 0.36, 0.025, 16), '#7be068', tx, 0.04, tz)
    add(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 12), '#f4e3a4', tx + 0.22, 0.04, tz + 0.12)
    add(new THREE.CylinderGeometry(0.015, 0.015, 0.38, 6), '#ffffff', tx, 0.06, tz)
    add(new THREE.BoxGeometry(0.14, 0.08, 0.02), flagColor, tx + 0.07, 0.36, tz)
  }

  // Animated golf balls arcing from the tee bays to the target greens
  const balls: THREE.Mesh[] = []
  for (let i = 0; i < 3; i++) {
    const ball = part(new THREE.SphereGeometry(0.05, 8, 6), '#ffffff', 0, 0.1, 0)
    ball.userData.flies = true
    ball.userData.liveOnly = true
    balls.push(ball)
    group.add(ball)
  }

  const flight = new THREE.Group()
  flight.userData.animate = ((seconds: number) => {
    const starts = [-0.85, 0.0, 0.85]
    for (let i = 0; i < 3; i++) {
      const cycle = ((seconds * 0.75 + i * 0.37) % 1 + 1) % 1
      const [tx, tz] = targets[i]
      const sx = starts[i]
      const sz = -0.62
      const x = sx + (tx - sx) * cycle
      const z = sz + (tz - sz) * cycle
      const arc = Math.sin(cycle * Math.PI) * (0.95 + i * 0.2)
      balls[i].position.set(x, 0.08 + arc, z)
    }
  }) satisfies Animate
  group.add(flight)
}

// 4. Ferris Wheel (3×3): carnival plaza, twin A-frame support legs, giant
// spoked wheel rotating continuously with 8 upright passenger gondolas.
export function buildFerrisWheel(group: THREE.Group, add: Add, w: number, d: number) {
  add(new THREE.BoxGeometry(w * 0.9, 0.08, d * 0.9), '#d8cfc0', 0, 0, 0)
  add(new THREE.BoxGeometry(1.6, 0.12, 0.9), '#b8432f', 0, 0.08, 0)

  // Ticket booth at front right
  add(new THREE.BoxGeometry(0.48, 0.44, 0.48), '#2f7fe0', 0.95, 0.08, 0.85)
  add(new THREE.ConeGeometry(0.38, 0.25, 6), '#ffd23f', 0.95, 0.52, 0.85)

  const hubY = 1.95
  const radius = 1.32
  // Twin A-frame support towers at front and back of the wheel
  for (const sz of [-0.36, 0.36]) {
    for (const sx of [-0.55, 0.55]) {
      const strut = new THREE.CylinderGeometry(0.045, 0.06, 1.92, 8)
      strut.rotateZ(sx * 0.28)
      add(strut, '#e8eef5', sx * 0.48, 0.16, sz)
    }
  }
  add(new THREE.CylinderGeometry(0.11, 0.11, 0.88, 12).rotateX(Math.PI / 2), '#ffd23f', 0, hubY - 0.1, 0)

  const wheel = new THREE.Group()
  wheel.position.set(0, hubY, 0)

  // Twin outer rims & spokes
  for (const sz of [-0.22, 0.22]) {
    wheel.add(part(new THREE.TorusGeometry(radius, 0.04, 8, 28), '#ff5c8a', 0, -radius, sz))
    wheel.add(part(new THREE.TorusGeometry(radius * 0.62, 0.025, 6, 24), '#ffd23f', 0, -radius * 0.62, sz))
  }
  // Glowing star hub
  wheel.add(part(new THREE.CylinderGeometry(0.22, 0.22, 0.52, 12).rotateX(Math.PI / 2), '#ffd23f', 0, -0.22, 0))

  const gondolaColors = ['#ff5c8a', '#2f7fe0', '#ffd23f', '#3fae6b', '#ff7043', '#b46cf0', '#2bb3b1', '#e63946']
  const gondolas: THREE.Group[] = []
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2
    const gx = Math.cos(angle) * radius
    const gy = Math.sin(angle) * radius

    // Spoke from center to rim
    const spoke = new THREE.CylinderGeometry(0.018, 0.018, radius, 6)
    spoke.translate(0, radius / 2, 0)
    spoke.rotateZ(angle - Math.PI / 2)
    for (const sz of [-0.22, 0.22]) {
      const sMesh = new THREE.Mesh(spoke, new THREE.MeshStandardMaterial({ color: '#f4f7fa', flatShading: true }))
      sMesh.position.z = sz
      wheel.add(sMesh)
    }

    const cabin = new THREE.Group()
    cabin.position.set(gx, gy, 0)
    cabin.add(
      part(new THREE.CylinderGeometry(0.02, 0.02, 0.46, 6).rotateX(Math.PI / 2), '#cfd6de', 0, -0.02, 0),
      part(new THREE.BoxGeometry(0.24, 0.18, 0.28), gondolaColors[i], 0, -0.26, 0),
      part(new THREE.BoxGeometry(0.26, 0.05, 0.3), '#ffffff', 0, -0.08, 0),
    )
    gondolas.push(cabin)
    wheel.add(cabin)
  }

  wheel.userData.animate = ((seconds: number) => {
    const rot = seconds * 0.48
    wheel.rotation.z = rot
    for (const cabin of gondolas) cabin.rotation.z = -rot
  }) satisfies Animate
  group.add(wheel)
}

// 5. Reverse Bungee (2×2): twin lattice towers catapulting a spherical
// passenger cage up and down on elastic bungee cables.
export function buildReverseBungee(group: THREE.Group, add: Add, w: number, d: number) {
  add(new THREE.BoxGeometry(w * 0.92, 0.08, d * 0.92), '#4e5661', 0, 0, 0)
  add(new THREE.CylinderGeometry(0.56, 0.62, 0.08, 20), '#ffd23f', 0, 0.08, 0)
  add(new THREE.CylinderGeometry(0.44, 0.44, 0.09, 20), '#2f353d', 0, 0.09, 0)

  const towerH = 2.65
  for (const sx of [-0.68, 0.68]) {
    add(new THREE.BoxGeometry(0.22, towerH, 0.22), '#e04238', sx, 0.08, 0)
    for (let y = 0.35; y < towerH; y += 0.38) {
      add(new THREE.BoxGeometry(0.26, 0.05, 0.26), '#ffd23f', sx, y, 0)
    }
    add(new THREE.SphereGeometry(0.14, 10, 8), '#ffd23f', sx, towerH + 0.04, 0)
  }

  const pod = new THREE.Group()
  pod.position.set(0, 0.42, 0)
  pod.add(
    part(new THREE.IcosahedronGeometry(0.24, 1), '#2f7fe0', 0, -0.24, 0),
    part(new THREE.TorusGeometry(0.25, 0.035, 8, 18), '#ffd23f', 0, -0.25, 0),
    part(new THREE.TorusGeometry(0.25, 0.035, 8, 18).rotateY(Math.PI / 2), '#ffffff', 0, -0.25, 0),
  )
  group.add(pod)

  // Left and right bungee cords that stretch from the tower tops to the pod
  const cords: THREE.Mesh[] = []
  for (const sx of [-0.68, 0.68]) {
    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 1, 6),
      new THREE.MeshStandardMaterial({ color: '#e8eef5', flatShading: true }),
    )
    cord.position.set(sx / 2, 1.5, 0)
    cords.push(cord)
    group.add(cord)
  }

  const rig = new THREE.Group()
  rig.userData.animate = ((seconds: number) => {
    const cycle = (seconds % 6) / 6
    let y = 0.42
    if (cycle > 0.18) {
      const t = (cycle - 0.18) / 0.82
      y = 0.42 + Math.abs(Math.sin(t * Math.PI * 3.5)) * Math.exp(-t * 1.6) * 2.15 + Math.sin(t * Math.PI) * 0.45
    }
    pod.position.y = y
    pod.rotation.x = seconds * 2.4
    pod.rotation.z = Math.sin(seconds * 3.1) * 0.4

    const topY = towerH + 0.12
    for (let i = 0; i < 2; i++) {
      const sx = i === 0 ? -0.68 : 0.68
      const dx = -sx
      const dy = y - topY
      const len = Math.hypot(dx, dy)
      cords[i].scale.set(1, len, 1)
      cords[i].position.set(sx / 2, (topY + y) / 2, 0)
      cords[i].rotation.z = Math.atan2(dx, -dy)
    }
  }) satisfies Animate
  group.add(rig)
}

// 6. Wave Pool (4×3): sandy beach entry, turquoise lagoon with rolling animated
// wave crests, deep-end wave machine building, palm trees, and bobbing tubes.
export function buildWavePool(group: THREE.Group, add: Add, w: number, d: number) {
  // Sun-deck surround & sandy beach at the front (+z)
  add(new THREE.BoxGeometry(w * 0.96, 0.06, d * 0.96), '#f3e3b2', 0, 0, 0)
  // Turquoise water basin
  add(new THREE.BoxGeometry(w * 0.82, 0.05, d * 0.72), '#26b6d4', 0, 0.04, -0.05)
  add(new THREE.BoxGeometry(w * 0.82, 0.03, 0.42), '#f6e3a4', 0, 0.065, 0.92)

  // Deep-end wave generator building along -z
  add(new THREE.BoxGeometry(w * 0.78, 0.52, 0.42), '#f4f7fa', 0, 0.06, -1.12)
  add(new THREE.BoxGeometry(w * 0.82, 0.1, 0.48), '#ff6b4a', 0, 0.58, -1.12)
  for (const x of [-1.0, -0.35, 0.35, 1.0]) {
    add(new THREE.BoxGeometry(0.38, 0.26, 0.08), '#1d4e6b', x, 0.08, -0.9)
  }

  // Lifeguard stand & colorful beach umbrellas
  add(new THREE.BoxGeometry(0.24, 0.38, 0.24), '#ffffff', -1.62, 0.06, 0.2)
  add(new THREE.ConeGeometry(0.22, 0.16, 4).rotateY(Math.PI / 4), '#e63946', -1.62, 0.44, 0.2)
  for (const [ux, uz, uc] of [[1.62, 0.45, '#ff5c8a'], [-1.58, 0.95, '#ffd23f'], [1.58, -0.35, '#2f7fe0']] as const) {
    add(new THREE.CylinderGeometry(0.025, 0.025, 0.36, 6), '#e8eef5', ux, 0.06, uz)
    add(new THREE.ConeGeometry(0.28, 0.16, 10), uc, ux, 0.38, uz)
  }

  // Rolling wave crests and bobbing inner-tube swimmers
  const waves: THREE.Mesh[] = []
  for (let i = 0; i < 3; i++) {
    const wave = part(
      new THREE.CylinderGeometry(0.06, 0.09, w * 0.76, 10).rotateZ(Math.PI / 2),
      '#99ecff',
      0,
      0.08,
      0,
    )
    waves.push(wave)
    group.add(wave)
  }

  const tubeColors = ['#ff5c8a', '#ffd23f', '#3fae6b', '#ff7043']
  const tubes: { mesh: THREE.Group; x: number; z: number; phase: number }[] = []
  const tubeCoords: [number, number][] = [[-0.85, -0.25], [0.15, 0.15], [0.9, -0.35], [-0.25, 0.48]]
  for (let i = 0; i < 4; i++) {
    const tGroup = new THREE.Group()
    tGroup.add(
      part(new THREE.TorusGeometry(0.11, 0.045, 8, 14).rotateX(Math.PI / 2), tubeColors[i], 0, 0, 0),
      part(new THREE.SphereGeometry(0.06, 8, 6), '#f1c9a5', 0, 0.05, 0),
    )
    const [tx, tz] = tubeCoords[i]
    tGroup.position.set(tx, 0.1, tz)
    tubes.push({ mesh: tGroup, x: tx, z: tz, phase: i * 1.5 })
    group.add(tGroup)
  }

  const surf = new THREE.Group()
  surf.userData.animate = ((seconds: number) => {
    for (let i = 0; i < waves.length; i++) {
      const p = ((seconds * 0.48 + i / waves.length) % 1 + 1) % 1
      waves[i].position.z = -0.82 + p * 1.58
      waves[i].position.y = 0.07 + Math.sin(p * Math.PI) * 0.05
      waves[i].scale.set(1, 0.6 + Math.sin(p * Math.PI) * 0.7, 1)
    }
    for (const t of tubes) {
      const swell = Math.sin(seconds * 2.8 - t.z * 2.5 + t.phase)
      t.mesh.position.y = 0.1 + swell * 0.035
      t.mesh.rotation.x = swell * 0.18
    }
  }) satisfies Animate
  group.add(surf)
}

// 7. Sky Ride (4×2): two terminal stations with spinning bullwheels, a central
// support tower, overhead haul cables, and colorful aerial gondolas.
export function buildSkyRide(group: THREE.Group, add: Add, w: number, d: number) {
  add(new THREE.BoxGeometry(w * 0.94, 0.05, d * 0.88), '#6bc258', 0, 0, 0)
  add(new THREE.BoxGeometry(w * 0.88, 0.02, 0.52), '#d8cfc0', 0, 0.05, 0)

  const cableY = 1.68
  // Left & right terminal stations
  const wheels: THREE.Mesh[] = []
  for (const sx of [-1.45, 1.45]) {
    add(new THREE.BoxGeometry(0.76, 0.48, 1.1), '#f2ead8', sx, 0.05, 0)
    add(new THREE.BoxGeometry(0.84, 0.12, 1.18), '#2f7fe0', sx, 0.53, 0)
    add(new THREE.CylinderGeometry(0.08, 0.1, cableY - 0.5, 8), '#cfd6de', sx, 0.65, 0)
    const wheel = part(new THREE.CylinderGeometry(0.36, 0.36, 0.06, 16), '#ffd23f', sx, cableY, 0)
    wheels.push(wheel)
    group.add(wheel)
  }

  // Center support pylon
  add(new THREE.CylinderGeometry(0.07, 0.11, cableY, 8), '#cfd6de', 0, 0.05, 0)
  add(new THREE.BoxGeometry(0.14, 0.08, 0.86), '#e04238', 0, cableY - 0.04, 0)

  // Overhead haul cables (front and back lines)
  for (const sz of [-0.32, 0.32]) {
    add(new THREE.CylinderGeometry(0.015, 0.015, 2.9, 6).rotateZ(Math.PI / 2), '#3b424c', 0, cableY + 0.04, sz)
  }

  // Four animated aerial cabins riding along the loop
  const cabinColors = ['#e63946', '#ffd23f', '#2f7fe0', '#3fae6b']
  const cabins: THREE.Group[] = []
  for (let i = 0; i < 4; i++) {
    const cabin = new THREE.Group()
    cabin.add(
      part(new THREE.BoxGeometry(0.03, 0.28, 0.03), '#3b424c', 0, -0.28, 0),
      part(new THREE.BoxGeometry(0.28, 0.24, 0.22), cabinColors[i], 0, -0.52, 0),
      part(new THREE.BoxGeometry(0.29, 0.08, 0.23), '#d8f0ff', 0, -0.4, 0),
    )
    cabins.push(cabin)
    group.add(cabin)
  }

  const mover = new THREE.Group()
  mover.userData.animate = ((seconds: number) => {
    for (const wMesh of wheels) wMesh.rotation.y = seconds * 1.4
    for (let i = 0; i < cabins.length; i++) {
      const p = ((seconds * 0.22 + i * 0.25) % 1 + 1) % 1
      const goingRight = p < 0.5
      const leg = goingRight ? p * 2 : (p - 0.5) * 2
      const x = goingRight ? -1.42 + leg * 2.84 : 1.42 - leg * 2.84
      const z = goingRight ? 0.32 : -0.32
      cabins[i].position.set(x, cableY + 0.04, z)
      cabins[i].rotation.z = Math.sin(seconds * 2.6 + i) * 0.08
    }
  }) satisfies Animate
  group.add(mover)
}

// 8. Roller Coaster (4×4): timber-and-steel coaster circuit with a boarding
// station, lift hill, vertical loop, camelback hill, and racing 3-car train.
export function buildRollerCoaster(group: THREE.Group, add: Add, w: number, d: number) {
  add(new THREE.BoxGeometry(w * 0.94, 0.06, d * 0.94), '#69bc54', 0, 0, 0)

  // Boarding station at front-left
  add(new THREE.BoxGeometry(1.25, 0.42, 0.68), '#f2ead8', -0.95, 0.06, 1.18)
  add(new THREE.BoxGeometry(1.35, 0.12, 0.76), '#e63946', -0.95, 0.48, 1.18)

  // Central vertical loop in the middle of the coaster
  const loopGroup = new THREE.Group()
  loopGroup.position.set(0.15, 1.18, -0.1)
  loopGroup.add(
    part(new THREE.TorusGeometry(0.88, 0.055, 10, 28), '#e63946', 0, -0.88, 0),
    part(new THREE.TorusGeometry(0.78, 0.03, 8, 24), '#ffd23f', 0, -0.78, 0),
  )
  group.add(loopGroup)
  for (const sx of [-0.55, 0.85]) {
    add(new THREE.CylinderGeometry(0.05, 0.065, 1.25, 8), '#cfd6de', sx, 0.06, -0.1)
  }

  // Parametric coaster track curve around the 4×4 plot with lift hill & camelback
  const trackPoint = (t: number, out = new THREE.Vector3()): THREE.Vector3 => {
    const a = t * Math.PI * 2
    const rx = 1.48
    const rz = 1.38
    const x = Math.cos(a) * rx
    const z = Math.sin(a) * rz
    // Lift hill peaks near a = 3.8 rad (back-left), camelback near a = 5.4 rad (back-right)
    const hill1 = Math.exp(-Math.pow(((a - 3.6 + Math.PI * 3) % (Math.PI * 2)) - Math.PI, 2) * 1.4) * 1.75
    const hill2 = Math.exp(-Math.pow(((a - 5.2 + Math.PI * 3) % (Math.PI * 2)) - Math.PI, 2) * 2.2) * 1.05
    const y = 0.28 + hill1 + hill2
    return out.set(x, y, z)
  }

  // Build track segments and support columns along the circuit
  const steps = 40
  const p0 = new THREE.Vector3()
  const p1 = new THREE.Vector3()
  for (let i = 0; i < steps; i++) {
    trackPoint(i / steps, p0)
    trackPoint((i + 1) / steps, p1)
    const mid = p0.clone().add(p1).multiplyScalar(0.5)
    const len = p0.distanceTo(p1) * 1.08
    const seg = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.06, len),
      new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? '#e63946' : '#ff6b4a', flatShading: true }),
    )
    seg.position.copy(mid)
    seg.lookAt(p1)
    seg.castShadow = true
    group.add(seg)

    if (i % 2 === 0) {
      add(new THREE.CylinderGeometry(0.035, 0.045, mid.y, 6), '#d9c79a', mid.x, 0.06, mid.z)
    }
  }

  // 3-car coaster train racing along the track
  const carColors = ['#ffd23f', '#2f7fe0', '#ff5c8a']
  const cars: THREE.Group[] = []
  for (let i = 0; i < 3; i++) {
    const car = new THREE.Group()
    car.add(
      part(new THREE.BoxGeometry(0.24, 0.12, 0.32), carColors[i], 0, 0.03, 0),
      part(new THREE.SphereGeometry(0.065, 8, 6), '#f5d0a9', 0, 0.14, 0),
    )
    cars.push(car)
    group.add(car)
  }

  const pos = new THREE.Vector3()
  const ahead = new THREE.Vector3()
  const runner = new THREE.Group()
  runner.userData.animate = ((seconds: number) => {
    for (let i = 0; i < cars.length; i++) {
      const t = ((seconds * 0.24 - i * 0.035) % 1 + 1) % 1
      const tNext = (t + 0.015) % 1
      trackPoint(t, pos)
      trackPoint(tNext, ahead)
      cars[i].position.copy(pos)
      cars[i].lookAt(ahead)
    }
  }) satisfies Animate
  group.add(runner)
}

// 9. Magic Castle (4×4): storybook theme-park castle with a moat, drawbridge,
// four corner turrets, soaring blue-and-gold spires, and bursting fireworks!
export function buildMagicCastle(group: THREE.Group, add: Add, w: number, d: number) {
  // Moat water and stone courtyard island
  add(new THREE.BoxGeometry(w * 0.96, 0.05, d * 0.96), '#3ca6e0', 0, 0, 0)
  add(new THREE.BoxGeometry(w * 0.78, 0.12, d * 0.78), '#e8e0d0', 0, 0.04, 0)
  // Drawbridge over the front moat
  add(new THREE.BoxGeometry(0.68, 0.08, 0.55), '#9b6a3f', 0, 0.06, 1.52)

  // Curtain walls & four corner towers
  add(new THREE.BoxGeometry(2.35, 0.78, 2.35), '#f5efe2', 0, 0.16, 0)
  for (const [sx, sz] of [[-1.12, -1.12], [1.12, -1.12], [-1.12, 1.12], [1.12, 1.12]]) {
    add(new THREE.CylinderGeometry(0.32, 0.36, 1.28, 12), '#f8f4ea', sx, 0.16, sz)
    add(new THREE.CylinderGeometry(0.36, 0.36, 0.12, 12), '#e0d6c3', sx, 1.44, sz)
    add(new THREE.ConeGeometry(0.4, 0.72, 12), '#2f5fc4', sx, 1.56, sz)
    add(new THREE.SphereGeometry(0.06, 8, 6), '#ffd23f', sx, 2.28, sz)
  }

  // Front gatehouse arch & golden trim
  add(new THREE.BoxGeometry(0.82, 0.98, 0.42), '#efe7d6', 0, 0.16, 1.15)
  add(new THREE.BoxGeometry(0.42, 0.54, 0.46), '#4a3520', 0, 0.16, 1.16)
  add(new THREE.ConeGeometry(0.54, 0.55, 4).rotateY(Math.PI / 4), '#2f5fc4', 0, 1.14, 1.15)

  // Central royal keep & soaring spires
  add(new THREE.BoxGeometry(1.28, 1.55, 1.28), '#fbf8f1', 0, 0.16, -0.08)
  add(new THREE.BoxGeometry(1.36, 0.12, 1.36), '#ffd23f', 0, 1.71, -0.08)
  add(new THREE.CylinderGeometry(0.46, 0.52, 1.05, 12), '#fbf8f1', 0, 1.83, -0.08)
  add(new THREE.ConeGeometry(0.56, 1.15, 12), '#2f5fc4', 0, 2.88, -0.08)
  add(new THREE.SphereGeometry(0.09, 8, 8), '#ffd23f', 0, 4.02, -0.08)

  // Side flanking spires on the keep
  for (const sx of [-0.58, 0.58]) {
    add(new THREE.CylinderGeometry(0.2, 0.22, 0.85, 10), '#f8f4ea', sx, 1.83, -0.08)
    add(new THREE.ConeGeometry(0.25, 0.62, 10), '#e8579a', sx, 2.68, -0.08)
  }

  // Waving royal banner atop the main spire + bursting fireworks above the castle!
  const banner = part(new THREE.BoxGeometry(0.32, 0.12, 0.03), '#ff5c8a', 0.16, 3.98, -0.08)
  group.add(banner)

  const burstColors = ['#ffd23f', '#ff5c8a', '#5aa9ff', '#65e892']
  const bursts: { group: THREE.Group; sparks: { mesh: THREE.Mesh; dir: THREE.Vector3 }[] }[] = []
  const burstCenters: [number, number, number][] = [
    [-0.75, 3.65, -0.35],
    [0.78, 3.85, -0.25],
    [0, 4.35, -0.45],
  ]
  for (let b = 0; b < burstCenters.length; b++) {
    const bGroup = new THREE.Group()
    const [bx, by, bz] = burstCenters[b]
    bGroup.position.set(bx, by, bz)
    bGroup.userData.flies = true
    bGroup.userData.liveOnly = true
    const sparks: { mesh: THREE.Mesh; dir: THREE.Vector3 }[] = []
    const mat = new THREE.MeshBasicMaterial({ color: burstColors[b % burstColors.length] })
    for (let s = 0; s < 10; s++) {
      const phi = (s / 10) * Math.PI * 2
      const elev = ((s % 3) - 1) * 0.55
      const dir = new THREE.Vector3(Math.cos(phi) * Math.cos(elev), Math.sin(elev), Math.sin(phi) * Math.cos(elev))
      const spark = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), mat)
      bGroup.add(spark)
      sparks.push({ mesh: spark, dir })
    }
    bursts.push({ group: bGroup, sparks })
    group.add(bGroup)
  }

  const magic = new THREE.Group()
  magic.userData.animate = ((seconds: number) => {
    banner.rotation.y = Math.sin(seconds * 4.2) * 0.35
    for (let b = 0; b < bursts.length; b++) {
      const phase = ((seconds * 0.55 + b * 0.33) % 1 + 1) % 1
      const active = phase < 0.72
      bursts[b].group.visible = active
      if (active) {
        const p = phase / 0.72
        const radius = Math.sin(p * Math.PI * 0.65) * 0.62
        const scale = Math.max(0.05, 1 - p * 0.85)
        for (const s of bursts[b].sparks) {
          s.mesh.position.copy(s.dir).multiplyScalar(radius)
          s.mesh.position.y -= p * p * 0.18
          s.mesh.scale.setScalar(scale)
        }
      }
    }
  }) satisfies Animate
  group.add(magic)
}
