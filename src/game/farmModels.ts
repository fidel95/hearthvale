import * as THREE from 'three'

// The farm's newer buildings: orchards, the Bakehouse, Dairy and Winery, the
// Farmers' Market and the Tractor Shed, plus the tractor itself (TractorView
// drives it). Built in the building's own coordinates (its center at the
// origin, front toward +z) by createPlaceholder in models.ts, like
// frontierModels.ts.

type Add = (geometry: THREE.BufferGeometry, color: string, x: number, y: number, z: number) => THREE.Mesh

// A two-sided roof along x: two slabs meeting at a ridge.
function gableRoof(add: Add, width: number, depth: number, y: number, z: number, color: string, pitch = 0.6) {
  const slope = depth / 2 / Math.cos(pitch)
  for (const side of [-1, 1]) {
    const slab = add(new THREE.BoxGeometry(width, 0.05, slope + 0.08), color, 0, 0, z + (side * depth) / 4)
    slab.position.y = y + (Math.tan(pitch) * depth) / 4
    slab.rotation.x = side * pitch
  }
}

// ---- Orchards: four fruit trees on grass, a basket of picked fruit.

export function buildOrchard(add: Add, w: number, d: number, leaf: string, fruit: string) {
  add(new THREE.BoxGeometry(w * 0.97, 0.03, d * 0.97), '#9cc46a', 0, 0, 0)
  const spots: [number, number][] = [
    [-0.48, -0.5],
    [0.5, -0.45],
    [-0.5, 0.45],
    [0.46, 0.52],
  ]
  for (const [i, [x, z]] of spots.entries()) {
    add(new THREE.CylinderGeometry(0.05, 0.07, 0.32, 6), '#7a5233', x, 0.03, z)
    const r = 0.3 + (i % 2) * 0.04
    add(new THREE.IcosahedronGeometry(r, 1), leaf, x, 0.25, z)
    // Fruit dotted over the crown, on the sides you can see.
    for (let k = 0; k < 7; k++) {
      const a = k * 2.4 + i
      const up = 0.15 + ((k * 37) % 10) / 22
      add(new THREE.SphereGeometry(0.045, 6, 4), fruit, x + Math.cos(a) * r * 0.9, 0.25 + r * up + 0.12, z + Math.abs(Math.sin(a)) * r * 0.9)
    }
  }
  add(new THREE.CylinderGeometry(0.12, 0.09, 0.1, 10), '#c79a5b', 0, 0.03, 0.05)
  for (const [x, z] of [[-0.04, 0.03], [0.04, 0.08], [0, 0.01]]) add(new THREE.SphereGeometry(0.045, 6, 4), fruit, x, 0.12, z)
}

// ---- The Bakehouse: a cottage with a striped awning and a brick oven chimney.

export function buildBakery(add: Add, w: number, d: number, walls: string, accent: string) {
  add(new THREE.BoxGeometry(w * 0.95, 0.03, d * 0.95), '#c9b79a', 0, 0, 0)
  add(new THREE.BoxGeometry(1.4, 0.6, 1.0), walls, 0, 0.03, -0.2)
  gableRoof(add, 1.55, 1.1, 0.63, -0.2, '#8a4a3a')
  add(new THREE.BoxGeometry(0.22, 0.6, 0.22), '#b5603f', 0.45, 0.6, -0.45) // oven chimney
  // Striped awning over the window.
  for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(0.2, 0.04, 0.32), i % 2 ? '#f4f1ea' : accent, -0.5 + i * 0.2, 0.42, 0.42)
  add(new THREE.BoxGeometry(0.7, 0.26, 0.02), '#9fd3f0', -0.2, 0.12, 0.31) // shop window
  add(new THREE.BoxGeometry(0.22, 0.38, 0.02), '#6b4a2b', 0.45, 0.03, 0.31) // door
  // A sign with a loaf on it, and a bench of bread out front.
  add(new THREE.BoxGeometry(0.5, 0.16, 0.04), '#6b4a2b', 0, 0.68, 0.32)
  add(new THREE.CapsuleGeometry(0.05, 0.14, 3, 6).rotateZ(Math.PI / 2), '#d9a05b', 0, 0.71, 0.36)
  add(new THREE.BoxGeometry(0.5, 0.14, 0.22), '#8a5a36', -0.3, 0.03, 0.7)
  for (const x of [-0.45, -0.3, -0.15]) add(new THREE.CapsuleGeometry(0.04, 0.08, 3, 6).rotateZ(Math.PI / 2), '#d9a05b', x, 0.17, 0.7)
}

// ---- The Dairy: a white creamery with a steel milk tank and churns.

export function buildDairy(add: Add, w: number, d: number, walls: string, accent: string) {
  add(new THREE.BoxGeometry(w * 0.95, 0.03, d * 0.95), '#c9cfd4', 0, 0, 0)
  add(new THREE.BoxGeometry(1.2, 0.55, 1.0), walls, -0.25, 0.03, -0.15)
  gableRoof(add, 1.35, 1.1, 0.58, -0.15, accent)
  add(new THREE.BoxGeometry(0.4, 0.34, 0.02), '#9fd3f0', -0.45, 0.15, 0.36)
  add(new THREE.BoxGeometry(0.26, 0.4, 0.02), '#5a6f8a', 0.08, 0.03, 0.36)
  // The milk tank: a steel drum on legs.
  for (const [x, z] of [[0.6, -0.5], [0.75, -0.5], [0.6, -0.2], [0.75, -0.2]]) add(new THREE.BoxGeometry(0.04, 0.2, 0.04), '#8a8f96', x, 0.03, z)
  add(new THREE.CylinderGeometry(0.2, 0.2, 0.7, 14).rotateX(Math.PI / 2), '#d8dde2', 0.68, 0.2, -0.35)
  // Churns by the door.
  for (const x of [0.4, 0.58]) {
    add(new THREE.CylinderGeometry(0.07, 0.08, 0.18, 10), '#c9ccd2', x, 0.03, 0.55)
    add(new THREE.CylinderGeometry(0.04, 0.06, 0.06, 10), '#c9ccd2', x, 0.21, 0.55)
  }
  add(new THREE.BoxGeometry(0.44, 0.14, 0.04), accent, -0.25, 0.62, 0.38)
}

// ---- The Winery: a stone cellar house, barrels, and a row of vines.

export function buildWinery(add: Add, w: number, d: number, walls: string, accent: string) {
  add(new THREE.BoxGeometry(w * 0.97, 0.03, d * 0.95), '#c9b79a', 0, 0, 0)
  add(new THREE.BoxGeometry(1.6, 0.65, 0.9), walls, -0.45, 0.03, -0.35)
  gableRoof(add, 1.75, 1.0, 0.68, -0.35, '#b5603f')
  add(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 14, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2), '#5a3a22', -0.45, 0.03, 0.11) // arched door
  add(new THREE.BoxGeometry(0.44, 0.22, 0.02), '#5a3a22', -0.45, 0.03, 0.11)
  // Barrels on their sides, stacked.
  for (const [x, y] of [[0.0, 0.03], [0.32, 0.03], [0.16, 0.29]]) {
    add(new THREE.CylinderGeometry(0.13, 0.13, 0.3, 12).rotateX(Math.PI / 2), '#8a5a36', x + 0.35, y, 0.35)
    add(new THREE.TorusGeometry(0.13, 0.012, 4, 14), '#3a3d42', x + 0.35, y, 0.43)
  }
  // A short row of vines heavy with grapes.
  for (let i = 0; i < 4; i++) {
    const x = 0.35 + i * 0.28
    add(new THREE.BoxGeometry(0.03, 0.4, 0.03), '#7a5233', x, 0.03, -0.45)
    add(new THREE.IcosahedronGeometry(0.13, 0), '#4a8a3a', x, 0.28, -0.45)
    add(new THREE.SphereGeometry(0.05, 6, 4), accent, x + 0.04, 0.24, -0.36)
  }
  add(new THREE.BoxGeometry(1.2, 0.02, 0.02), '#7a5233', 0.77, 0.4, -0.45)
}

// ---- The Farmers' Market: three stalls with striped awnings and crates of produce.

const PRODUCE = ['#e0383e', '#f39a1e', '#f2d23c', '#7b3fa0', '#6cc04a', '#f4f1ea', '#c79a5b']

export function buildMarket(add: Add, w: number, d: number, cloth: string, accent: string) {
  add(new THREE.BoxGeometry(w * 0.97, 0.03, d * 0.95), '#d9cdb6', 0, 0, 0)
  for (let s = 0; s < 3; s++) {
    const x = -0.95 + s * 0.95
    const stripe = s === 1 ? '#e0663a' : accent
    // Posts, a counter and crates of produce.
    for (const px of [-0.38, 0.38]) for (const pz of [-0.3, 0.3]) add(new THREE.BoxGeometry(0.04, 0.62, 0.04), '#7a5233', x + px, 0.03, pz)
    add(new THREE.BoxGeometry(0.8, 0.22, 0.4), '#8a5a36', x, 0.03, 0.05)
    for (let c = 0; c < 3; c++) {
      const cx = x - 0.26 + c * 0.26
      add(new THREE.BoxGeometry(0.22, 0.06, 0.26), '#c79a5b', cx, 0.25, 0.05)
      const color = PRODUCE[(s * 3 + c) % PRODUCE.length]
      for (const [ox, oz] of [[-0.05, -0.05], [0.05, -0.04], [0, 0.06], [-0.05, 0.07], [0.06, 0.07]]) add(new THREE.SphereGeometry(0.04, 6, 4), color, cx + ox, 0.29, 0.05 + oz)
    }
    // A striped awning, sloping down to the front.
    for (let i = 0; i < 4; i++) {
      const stripePart = add(new THREE.BoxGeometry(0.22, 0.03, 0.78), i % 2 ? cloth : stripe, x - 0.33 + i * 0.22, 0, 0)
      stripePart.position.y = 0.66
      stripePart.rotation.x = 0.22
    }
  }
  // A sign on a post.
  add(new THREE.BoxGeometry(0.05, 0.6, 0.05), '#7a5233', 1.35, 0.03, 0.75)
  add(new THREE.BoxGeometry(0.4, 0.2, 0.04), '#3f8f3a', 1.35, 0.5, 0.78)
}

// ---- The Tractor Shed: an open-fronted red shed, hay bales and a fuel drum.

export function buildTractorShed(add: Add, w: number, d: number, walls: string, accent: string) {
  add(new THREE.BoxGeometry(w * 0.97, 0.03, d * 0.97), '#b9a98a', 0, 0, 0)
  add(new THREE.BoxGeometry(1.5, 0.75, 0.06), walls, -0.1, 0.03, -0.7) // back wall
  for (const x of [-0.84, 0.64]) add(new THREE.BoxGeometry(0.06, 0.75, 1.0), walls, x, 0.03, -0.22)
  gableRoof(add, 1.62, 1.18, 0.78, -0.22, '#7a3a2a')
  add(new THREE.BoxGeometry(1.5, 0.05, 0.05), accent, -0.1, 0.74, 0.27) // white trim
  // Hay bales and a fuel drum beside it.
  for (const [x, z] of [[0.82, -0.5], [0.82, -0.1]]) add(new THREE.CylinderGeometry(0.15, 0.15, 0.22, 12).rotateZ(Math.PI / 2), '#e8c55a', x, 0.03, z)
  add(new THREE.CylinderGeometry(0.15, 0.15, 0.22, 12).rotateZ(Math.PI / 2), '#e8c55a', 0.82, 0.31, -0.3)
  add(new THREE.CylinderGeometry(0.09, 0.09, 0.26, 10), '#c8463a', 0.8, 0.03, 0.4)
}

// ---- The tractor: a green body, a cab, big back wheels and small front
// ones, pointing along +x (its front). Its wheels are named so they can turn.

export function makeTractor(): THREE.Group {
  const root = new THREE.Group()
  const mat = (color: string) => new THREE.MeshStandardMaterial({ color, flatShading: true })
  const box = (w: number, h: number, d: number, color: string, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color))
    m.position.set(x, y, z)
    m.castShadow = true
    root.add(m)
    return m
  }
  box(0.42, 0.14, 0.2, '#3f8f3a', 0.05, 0.17, 0) // body
  box(0.18, 0.1, 0.18, '#3f8f3a', 0.2, 0.28, 0) // hood
  box(0.04, 0.06, 0.16, '#dfe3e8', 0.29, 0.2, 0) // grille
  // The cab: four posts and a roof.
  for (const x of [-0.17, -0.02]) for (const z of [-0.09, 0.09]) box(0.02, 0.2, 0.02, '#2b2d33', x, 0.34, z)
  box(0.2, 0.025, 0.22, '#f2d23c', -0.095, 0.45, 0)
  box(0.08, 0.06, 0.1, '#3a3d42', -0.1, 0.27, 0) // seat
  box(0.025, 0.14, 0.025, '#3a3d42', 0.22, 0.4, 0.05) // exhaust
  const wheel = (r: number, width: number, x: number, z: number, name: string) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, width, 12).rotateX(Math.PI / 2), mat('#2b2d33'))
    w.add(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, width + 0.01, 8).rotateX(Math.PI / 2), mat('#f2d23c')))
    w.position.set(x, r, z)
    w.name = name
    w.castShadow = true
    root.add(w)
  }
  for (const z of [-0.14, 0.14]) wheel(0.13, 0.08, -0.1, z, 'wheel-back')
  for (const z of [-0.12, 0.12]) wheel(0.07, 0.05, 0.22, z, 'wheel-front')
  root.scale.setScalar(1.3)
  return root
}
