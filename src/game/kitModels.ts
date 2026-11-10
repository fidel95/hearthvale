import type { Kit, Paint } from './kit'
import { ARMY_BASE, SKI_LIFT, SKI_SLOPE, slopeHeight } from './models'

// The buildings made with the code modelling kit (kit.ts): each builder makes
// one model at its true size, its footprint's center at the origin and its
// front toward +z. A building uses one with model: kitModel('name').
//
// Where a view puts things on a building (animals in a pen's yard, the army
// base's flag and helipad, skiers on the slope, planes on the runway), the
// model leaves those spots where the view expects them; see each builder.

type Builder = (k: Kit) => void

// ---- Farm

function barn(k: Kit) {
  k.ground(1.9, 1.9, 'lawn', 0.03)
  k.box(0.9, 0.012, 0.75, 0.1, 0.03, 0.62, 'path', { bevel: 0 }) // a worn dirt yard out front
  const w = 1.1 // across x
  const d = 1.25 // along z, the gable facing front
  const z0 = -0.05
  const wallH = 0.55
  // The gambrel outline: steep lower roof, shallow upper.
  const lower: [number, number] = [w / 2 + 0.02, wallH]
  const knee: [number, number] = [w * 0.33, wallH + 0.34]
  const top: [number, number] = [0, wallH + 0.5]
  const outline: [number, number][] = [[-w / 2, 0], [w / 2, 0], lower, knee, top, [-knee[0], knee[1]], [-lower[0], lower[1]]]
  k.box(w + 0.05, 0.06, d + 0.05, 0, 0.03, z0, 'stonedark', { bevel: 0.01 })
  k.prism(outline, d, 0, 0.03, z0, 'barnred', 'z')
  // Roof: four slabs along the barn, overhanging the gables.
  const L = d + 0.12
  const y = 0.03
  k.slope([-lower[0] - 0.04, lower[1] - 0.03], [-knee[0], knee[1]], L, 0, y, z0, 'roofgray', 'z', { overhang: 0.02 })
  k.slope([-knee[0], knee[1]], top, L, 0, y, z0, 'roofgray', 'z', { overhang: 0.02 })
  k.slope(top, knee, L, 0, y, z0, 'roofgray', 'z', { overhang: 0.02 })
  k.slope(knee, [lower[0] + 0.04, lower[1] - 0.03], L, 0, y, z0, 'roofgray', 'z', { overhang: 0.02 })
  k.rod(0.03, L + 0.01, 0, y + top[1] + 0.04, z0, 'roofgray', 'z', { seg: 8 })
  // White trim: corner posts and the gable's edge.
  const front = z0 + d / 2
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.05, wallH, 0.05, sx * (w / 2), 0.03, z0 + sz * (d / 2), 'white', { bevel: 0.008 })
  for (const [a, b] of [[[-lower[0], lower[1]], [-knee[0], knee[1]]], [[-knee[0], knee[1]], top], [top, knee], [knee, lower]] as [number, number][][]) {
    k.strut([a[0], a[1] + 0.03, front + 0.015], [b[0], b[1] + 0.03, front + 0.015], 0.018, 'white')
  }
  k.box(w, 0.04, 0.03, 0, wallH - 0.02, front + 0.01, 'white', { bevel: 0 })
  // The big doors: white frames with an X brace, slid half open.
  for (const side of [-1, 1]) {
    const dx = side * 0.15
    k.onFace('+z', front, dx, 0.03, 0.29, 0.44, 0.03, 'white')
    k.onFace('+z', front + 0.015, dx, 0.055, 0.24, 0.39, 0.02, 'brickdark', { bevel: 0 })
    const zf = front + 0.04
    k.strut([dx - 0.11, 0.07, zf], [dx + 0.11, 0.43, zf], 0.011, 'white')
    k.strut([dx + 0.11, 0.07, zf], [dx - 0.11, 0.43, zf], 0.011, 'white')
  }
  k.box(0.6, 0.03, 0.04, 0, 0.5, front + 0.03, 'charcoal', { bevel: 0 }) // the door rail
  // Hayloft door with hay poking out, and the hoist beam over it.
  k.onFace('+z', front, 0, 0.66, 0.24, 0.2, 0.03, 'white')
  k.onFace('+z', front + 0.012, 0, 0.68, 0.18, 0.16, 0.02, 'wooddark', { bevel: 0 })
  k.box(0.14, 0.05, 0.06, 0, 0.68, front + 0.03, 'hay', { bevel: 0.01 })
  k.box(0.05, 0.05, 0.22, 0, top[1] - 0.06, front + 0.09, 'wood', { bevel: 0.006 })
  k.strut([0, top[1] - 0.06, front + 0.18], [0, top[1] - 0.2, front + 0.18], 0.006, 'charcoal')
  // Side windows with white crossbars.
  for (const u of [z0 - 0.3, z0 + 0.25]) k.window('+x', w / 2, u, 0.25, { w: 0.18, h: 0.18, frame: 'white', glass: 'glassdark', sill: false })
  // A cupola with a weathervane on the ridge.
  const cy = y + top[1] + 0.02
  k.box(0.18, 0.14, 0.18, 0, cy, z0, 'white', { bevel: 0.01 })
  k.onFace('+z', 0.09, 0, cy + 0.03, 0.1, 0.08, 0.02, 'wooddark', { bevel: 0 })
  k.onFace('+x', 0.09, z0, cy + 0.03, 0.1, 0.08, 0.02, 'wooddark', { bevel: 0 })
  k.cyl(0.15, 0.1, 0, cy + 0.14, z0, 'roofgray', { seg: 4, rTop: 0, ry: Math.PI / 4 })
  k.cyl(0.008, 0.14, 0, cy + 0.22, z0, 'charcoal', { seg: 5 })
  k.box(0.12, 0.04, 0.008, 0.02, cy + 0.31, z0, 'charcoal', { bevel: 0 })
  // A silo at the back, hay bales and a cart wheel out front.
  const sx = -0.72
  const sz = -0.55
  k.cyl(0.22, 0.04, sx, 0.03, sz, 'stonedark', { seg: 18 })
  k.cyl(0.19, 1.15, sx, 0.07, sz, 'snow', { seg: 18, gradient: true })
  for (const yy of [0.3, 0.6, 0.9]) k.cyl(0.196, 0.025, sx, yy, sz, 'steel', { seg: 18 })
  k.ball(0.19, sx, 1.22, sz, 'roofgray', { sy: 0.7, seg: 18 })
  k.box(0.04, 1.0, 0.03, sx + 0.19, 0.07, sz, 'charcoal', { bevel: 0 })
  for (const [x, z, ry] of [[0.62, 0.58, 0.2], [0.45, 0.75, -0.3], [0.68, 0.28, 0.5]]) {
    k.box(0.2, 0.12, 0.13, x, 0.03, z, 'hay', { bevel: 0.025, ry, gradient: true })
    k.box(0.205, 0.124, 0.012, x, 0.03, z, 'wood', { bevel: 0, ry })
  }
  k.box(0.2, 0.12, 0.13, 0.55, 0.15, 0.6, 'hay', { bevel: 0.025, ry: -0.1, gradient: true })
  k.ring(0.1, 0.014, -0.62, 0.11, 0.62, 'wooddark', 'z')
  k.bush(-0.75, 0.15, 0.1, 'hedge', 'sunny')
  k.bush(0.75, -0.5, 0.1, 'hedge')
}

// A pen: a rail fence round a yard, a shelter in the back-left corner (the
// animals keep out of it: AnimalView), a trough and feed. The rest of the
// yard stays clear for the animals.
function pen(w: number, d: number, animal: 'chicken' | 'pig' | 'sheep' | 'cow'): Builder {
  return (k) => {
    k.ground(w * 0.98, d * 0.98, 'lawn', 0.03)
    if (animal === 'pig') {
      k.disc(0.42, 0.012, 0.15, 0.03, 0.2, 'soil', { sx: 1.3, sz: 0.9 })
      k.disc(0.24, 0.016, 0.2, 0.03, 0.25, '#7a5a42', { sx: 1.2, sz: 0.8, finish: 'shiny' })
    }
    if (animal === 'chicken') k.disc(0.5, 0.01, 0.2, 0.03, 0.2, 'path', { sx: 1.1, sz: 0.9 })
    // Tufts and wildflowers round the edges.
    for (const [x, z] of [[w * 0.38, -d * 0.4], [-w * 0.4, d * 0.3], [w * 0.4, d * 0.05]]) {
      k.ball(0.04, x, 0.03, z, 'foliage', { lumpy: true })
      k.ball(0.018, x + 0.02, 0.07, z + 0.02, 'sunny')
    }
    // The fence, with a gate in the front.
    const X = w / 2 - 0.05
    const Z = d / 2 - 0.05
    k.rails(-X, -Z, X, -Z)
    k.rails(-X, -Z, -X, Z)
    k.rails(X, -Z, X, Z)
    k.rails(-X, Z, -0.22, Z)
    k.rails(0.22, Z, X, Z)
    k.box(0.4, 0.03, 0.02, 0, 0.06, Z, 'white', { bevel: 0 })
    k.box(0.4, 0.03, 0.02, 0, 0.14, Z, 'white', { bevel: 0 })
    k.strut([-0.2, 0.06, Z], [0.2, 0.17, Z], 0.01, 'white')
    for (const x of [-0.21, 0.21]) k.box(0.05, 0.22, 0.05, x, 0, Z, 'white', { bevel: 0.006 })

    // The shelter, back left.
    const sx = -w / 2 + 0.43
    const sz = -d / 2 + 0.36
    if (animal === 'chicken') {
      // A coop on legs with a ramp, nest boxes on its side.
      for (const [dx, dz] of [[-0.2, -0.13], [0.2, -0.13], [-0.2, 0.13], [0.2, 0.13]]) k.box(0.04, 0.14, 0.04, sx + dx, 0.03, sz + dz, 'wooddark', { bevel: 0 })
      k.box(0.5, 0.26, 0.34, sx, 0.17, sz, 'barnred', { bevel: 0.015 })
      k.gableRoof(0.5, 0.34, 0.16, sx, 0.43, sz, 'roofgray', 'barnred', { overhang: 0.05, thick: 0.03 })
      k.onFace('+z', sz + 0.17, sx + 0.12, 0.2, 0.09, 0.12, 0.02, 'ink', { bevel: 0 })
      k.window('+z', sz + 0.17, sx - 0.1, 0.27, { w: 0.1, h: 0.1, glass: 'glassdark', sill: false, panes: false })
      k.box(0.09, 0.18, 0.13, sx + 0.29, 0.21, sz, 'lightwood', { bevel: 0.01 })
      k.gableRoof(0.09, 0.13, 0.04, sx + 0.29, 0.39, sz, 'roofgray', 'lightwood', { overhang: 0.02, thick: 0.02, ridge: 'z' })
      // The ramp down from the pop hole.
      const ramp = 0.28
      k.strut([sx + 0.12, 0.17, sz + 0.2], [sx + 0.12, 0.03, sz + 0.2 + ramp], 0.035, 'lightwood', { seg: 4 })
      // Feed and a water fount.
      k.cyl(0.07, 0.02, w * 0.25, 0.03, -d * 0.25, 'steel', { seg: 14 })
      k.cyl(0.035, 0.1, w * 0.25, 0.05, -d * 0.25, 'pipe', { seg: 12, rTop: 0.02 })
    } else if (animal === 'pig') {
      // A lean-to shed: three walls and a sloping roof, open at the front.
      const sw = 0.7
      const sd = 0.55
      k.box(sw, 0.36, 0.05, sx, 0.03, sz - sd / 2 + 0.025, 'wood', { bevel: 0.01 })
      for (const s of [-1, 1]) k.prism([[-sd / 2, 0], [sd / 2, 0], [sd / 2, 0.3], [-sd / 2, 0.38]], 0.05, sx + s * (sw / 2 - 0.025), 0.03, sz, 'wood', 'x')
      k.slope([-sd / 2 - 0.06, 0.45], [sd / 2 + 0.08, 0.35], sw + 0.1, sx, 0.03, sz, 'roofred', 'x', { thick: 0.035 })
      k.box(sw - 0.1, 0.06, sd - 0.12, sx, 0.03, sz, 'hay', { bevel: 0.02 }) // straw bedding
    } else {
      // A little gabled barn with a wide doorway onto the yard.
      const sw = 0.78
      const sd = 0.55
      const wall: Paint = animal === 'cow' ? 'barnred' : 'lightwood'
      const sbx = sx + 0.03
      const sbz = sz + 0.02
      k.box(sw + 0.04, 0.04, sd + 0.04, sbx, 0.03, sbz, 'stonedark', { bevel: 0.008 })
      k.box(sw, 0.36, sd, sbx, 0.05, sbz, wall, { bevel: 0.015 })
      for (const sxx of [-1, 1]) k.box(0.04, 0.36, 0.04, sbx + sxx * sw / 2, 0.05, sbz + sd / 2, 'white', { bevel: 0.006 })
      k.gableRoof(sw, sd, 0.24, sbx, 0.41, sbz, 'roofgray', wall, { overhang: 0.06, thick: 0.035, ridge: 'z' })
      k.onFace('+z', sbz + sd / 2, sbx, 0.05, 0.36, 0.3, 0.03, 'white')
      k.onFace('+z', sbz + sd / 2 + 0.012, sbx, 0.05, 0.3, 0.27, 0.02, 'wooddark', { bevel: 0 })
      k.box(0.24, 0.05, 0.02, sbx, 0.05, sbz + sd / 2 + 0.03, 'hay', { bevel: 0.01 })
      k.window('+x', sbx + sw / 2, sbz, 0.2, { w: 0.13, h: 0.13, glass: 'glassdark' })
      k.onFace('+z', sbz + sd / 2, sbx, 0.5, 0.1, 0.1, 0.02, 'white')
    }
    // A water trough on the right, and a hay rack or feed.
    const tx = w / 2 - 0.3
    const tz = -d / 2 + 0.22
    k.box(0.4, 0.1, 0.13, tx, 0.03, tz, animal === 'pig' ? 'wooddark' : 'steel', { bevel: 0.012 })
    k.box(0.34, 0.012, 0.08, tx, 0.115, tz, 'water', { bevel: 0, finish: 'shiny' })
    if (animal === 'sheep' || animal === 'cow') {
      const hx = w / 2 - 0.22
      const hz = d / 2 - 0.35
      k.box(0.2, 0.14, 0.14, hx, 0.03, hz, 'hay', { bevel: 0.03, gradient: true })
      k.box(0.2, 0.14, 0.14, hx - 0.05, 0.17, hz + 0.02, 'hay', { bevel: 0.03, ry: 0.4, gradient: true })
    }
    if (animal === 'pig') {
      k.box(0.3, 0.07, 0.1, w / 2 - 0.3, 0.03, d / 2 - 0.25, 'wooddark', { bevel: 0.01 })
      for (const x of [-0.08, 0, 0.08]) k.ball(0.025, w / 2 - 0.3 + x, 0.1, d / 2 - 0.25, x ? 'orange' : 'lime')
    }
    if (animal === 'cow') {
      // A milk churn and a stool by the shed.
      k.cyl(0.05, 0.13, sx + 0.42, 0.03, sz + 0.25, 'pipe', { seg: 10 })
      k.cyl(0.03, 0.04, sx + 0.42, 0.16, sz + 0.25, 'pipe', { seg: 10 })
    }
  }
}

// ---- Landmarks

function clockTower(k: Kit) {
  k.ground(1.85, 1.85, 'stone', 0.04)
  k.box(1.4, 0.03, 1.4, 0, 0.04, 0, 'stonedark', { bevel: 0.01 })
  for (const [x, z] of [[-0.68, 0.68], [0.68, 0.68], [0.68, -0.68]]) k.flowerBed(0.36, 0.36, x, z)
  k.lamp(-0.75, -0.2, 0.5)
  k.lamp(0.3, 0.8, 0.5)
  const s = 0.76
  // Steps and a stone base.
  k.box(s + 0.36, 0.06, s + 0.36, 0, 0.07, 0, 'stone', { bevel: 0.012 })
  k.box(s + 0.2, 0.3, s + 0.2, 0, 0.13, 0, 'stonedark', { bevel: 0.02, gradient: true })
  k.trim(s + 0.2, s + 0.2, 0.41, 'stone', { h: 0.05 })
  // The shaft: cream walls with brick corners and string courses.
  const y0 = 0.46
  const H = 1.75
  k.box(s, H, s, 0, y0, 0, 'butter', { bevel: 0.02 })
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.1, H, 0.1, sx * (s / 2 - 0.03), y0, sz * (s / 2 - 0.03), 'brick', { bevel: 0.01 })
  for (const yy of [y0 + 0.6, y0 + 1.15]) k.trim(s, s, yy, 'white', { h: 0.04, out: 0.02 })
  k.door('+z', s / 2, 0, { w: 0.22, h: 0.36, color: 'navy', y: y0 })
  k.onFace('+z', s / 2, 0, y0 + 0.36, 0.3, 0.06, 0.04, 'white')
  for (const face of ['+z', '+x', '-x', '-z'] as const) {
    k.window(face, s / 2, 0, y0 + 0.75, { w: 0.14, h: 0.3, frame: 'white', glass: 'glassdark' })
  }
  // Clock faces on every side.
  const cy = y0 + H - 0.3
  for (const [face, ax] of [['+z', 'z'], ['+x', 'x'], ['-z', 'z'], ['-x', 'x']] as const) {
    const out = face[0] === '+' ? 1 : -1
    const n = out * (s / 2 + 0.02)
    const [x, z] = ax === 'z' ? [0, n] : [n, 0]
    k.rod(0.25, 0.04, x, cy, z, 'gold', ax, { seg: 24 })
    k.rod(0.21, 0.05, x, cy, z, 'white', ax, { seg: 24 })
    const f = out * (s / 2 + 0.05)
    const [hx, hz] = ax === 'z' ? [0, f] : [f, 0]
    k.strut([hx, cy, hz], ax === 'z' ? [0.1, cy + 0.07, hz] : [hx, cy + 0.07, -0.1 * out], 0.012, 'navy')
    k.strut([hx, cy, hz], ax === 'z' ? [-0.02, cy + 0.15, hz] : [hx, cy + 0.15, 0.02 * out], 0.009, 'navy')
    k.ball(0.02, hx, cy, hz, 'gold')
  }
  k.trim(s, s, y0 + H, 'white', { h: 0.08, out: 0.04 })
  // The belfry: open arches on four posts, with the bell inside.
  const by = y0 + H + 0.08
  const bs = s - 0.08
  k.box(bs, 0.04, bs, 0, by, 0, 'stone', { bevel: 0 })
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.12, 0.4, 0.12, sx * (bs / 2 - 0.06), by, sz * (bs / 2 - 0.06), 'butter', { bevel: 0.012 })
  for (const face of ['+z', '+x', '-z', '-x'] as const) {
    const out = face[0] === '+' ? 1 : -1
    const ax = face[1]
    k.ring(bs / 2 - 0.12, 0.03, ax === 'x' ? out * (bs / 2 - 0.06) : 0, by + 0.28, ax === 'z' ? out * (bs / 2 - 0.06) : 0, 'white', ax === 'z' ? 'z' : 'x', { arc: Math.PI, seg: 12 })
  }
  k.cyl(0.13, 0.18, 0, by + 0.14, 0, 'gold', { rTop: 0.06, seg: 14, gradient: true })
  k.ball(0.03, 0, by + 0.12, 0, 'gold')
  k.box(bs + 0.1, 0.08, bs + 0.1, 0, by + 0.4, 0, 'white', { bevel: 0.015 })
  // A tall spire with a gold finial.
  k.cyl((bs + 0.14) / Math.SQRT2, 0.85, 0, by + 0.48, 0, 'roofblue', { seg: 4, rTop: 0, ry: Math.PI / 4, gradient: true })
  k.ball(0.05, 0, by + 1.33, 0, 'gold')
  k.cyl(0.012, 0.22, 0, by + 1.35, 0, 'gold', { seg: 6, rTop: 0.004 })
}

function lighthouse(k: Kit) {
  // A grassy rock, a keeper's cottage, and the striped tower.
  k.ground(1.9, 1.9, 'lawn', 0.03)
  for (const [x, z, r] of [[0.75, 0.7, 0.14], [0.55, 0.85, 0.1], [-0.82, 0.55, 0.12], [0.85, -0.35, 0.11], [-0.2, 0.85, 0.09]]) k.rock(x, z, r, 'stonedark', 0.03)
  k.box(0.5, 0.012, 0.32, 0.25, 0.03, 0.62, 'path', { bevel: 0 })
  // The cottage, back left.
  const cx = -0.45
  const cz = -0.45
  k.box(0.68, 0.36, 0.5, cx, 0.03, cz, 'white', { bevel: 0.015 })
  k.gableRoof(0.68, 0.5, 0.22, cx, 0.39, cz, 'roofred', 'white', { overhang: 0.06 })
  k.door('+z', cz + 0.25, cx + 0.15, { w: 0.13, h: 0.24, color: 'navy', y: 0.03 })
  k.window('+z', cz + 0.25, cx - 0.15, 0.17, { w: 0.13, h: 0.13, shutters: 'navy' })
  k.window('+x', cx + 0.34, cz, 0.17, { w: 0.13, h: 0.13, shutters: 'navy' })
  k.box(0.08, 0.2, 0.08, cx - 0.2, 0.55, cz - 0.1, 'brick', { bevel: 0.01 })
  // The tower: a stone plinth, then red and white bands narrowing upward.
  const tx = 0.25
  const tz = 0.1
  k.cyl(0.42, 0.14, tx, 0.03, tz, 'stonedark', { seg: 20, rTop: 0.4, gradient: true })
  const bands = 5
  const H = 2.15
  const r0 = 0.34
  const r1 = 0.22
  for (let i = 0; i < bands; i++) {
    const a = r0 + (r1 - r0) * (i / bands)
    const b = r0 + (r1 - r0) * ((i + 1) / bands)
    k.cyl(a, H / bands, tx, 0.17 + (i * H) / bands, tz, i % 2 ? 'white' : 'red', { rTop: b, seg: 20 })
  }
  k.door('+z', tz + r0 - 0.02, tx, { w: 0.14, h: 0.26, color: 'navy', y: 0.17 })
  for (const [i, y] of [0.75, 1.3, 1.85].entries()) {
    const r = r0 + (r1 - r0) * ((y - 0.17) / H)
    const a = i % 2 ? 0.6 : -0.3
    const nx = Math.sin(a)
    const nz = Math.cos(a)
    k.box(0.07, 0.11, 0.04, tx + nx * r, y, tz + nz * r, 'charcoal', { bevel: 0, ry: a })
  }
  // Gallery: a deck with railings round the lamp room.
  const gy = 0.17 + H
  k.cyl(0.36, 0.05, tx, gy, tz, 'charcoal', { seg: 20 })
  k.ring(0.34, 0.012, tx, gy + 0.15, tz, 'white', 'y', { seg: 24 })
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    k.cyl(0.008, 0.15, tx + Math.cos(a) * 0.34, gy + 0.03, tz + Math.sin(a) * 0.34, 'white', { seg: 4 })
  }
  // Lamp room: glowing glass between posts, a red dome and a vane.
  k.cyl(0.2, 0.06, tx, gy + 0.05, tz, 'red', { seg: 16 })
  k.cyl(0.17, 0.26, tx, gy + 0.11, tz, 'light', { seg: 12, finish: 'glow' })
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    k.box(0.025, 0.26, 0.025, tx + Math.cos(a) * 0.175, gy + 0.11, tz + Math.sin(a) * 0.175, 'charcoal', { bevel: 0 })
  }
  k.cyl(0.22, 0.04, tx, gy + 0.37, tz, 'charcoal', { seg: 16 })
  k.ball(0.19, tx, gy + 0.4, tz, 'red', { sy: 0.8, seg: 16 })
  k.ball(0.04, tx, gy + 0.58, tz, 'charcoal')
  k.cyl(0.008, 0.16, tx, gy + 0.6, tz, 'charcoal', { seg: 5 })
  // A lifebuoy and a bench by the door.
  k.ring(0.06, 0.02, tx + 0.36, 0.3, tz + 0.2, 'red', 'x', { seg: 14 })
  k.bench(-0.35, 0.25, 0, 'lightwood', 1.2)
}

// ---- Decorations

function gazebo(k: Kit) {
  k.ground(1.9, 1.9, 'lawn', 0.03)
  // A flagstone path in, and flowers round the edge.
  k.box(0.3, 0.012, 0.5, 0, 0.03, 0.72, 'path', { bevel: 0 })
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * 0.6 + (i / 6) * Math.PI * 1.8
    k.bush(Math.cos(a) * 0.8, Math.sin(a) * 0.8, 0.09, 'hedge', (['rose', 'sunny', 'white', 'violet'] as Paint[])[i % 4], 0.03)
  }
  const R = 0.66
  k.cyl(R + 0.05, 0.08, 0, 0.03, 0, 'stone', { seg: 8, ry: Math.PI / 8 })
  k.cyl(R, 0.06, 0, 0.11, 0, 'lightwood', { seg: 8, ry: Math.PI / 8 })
  k.box(0.3, 0.06, 0.12, 0, 0.03, R + 0.06, 'stone', { bevel: 0.01 })
  const y0 = 0.17
  const postH = 0.55
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8
    const x = Math.cos(a) * (R - 0.05)
    const z = Math.sin(a) * (R - 0.05)
    k.cyl(0.026, postH, x, y0, z, 'white', { seg: 8 })
    k.box(0.06, 0.03, 0.06, x, y0, z, 'white', { bevel: 0 })
    // Railings between posts, except the doorway at the front.
    const b = a + Math.PI / 4
    const x2 = Math.cos(b) * (R - 0.05)
    const z2 = Math.sin(b) * (R - 0.05)
    const mid = (a + b) / 2
    if (Math.abs(Math.sin(mid) - 1) > 0.05) {
      k.strut([x, y0 + 0.2, z], [x2, y0 + 0.2, z2], 0.012, 'white')
      k.strut([x, y0 + 0.06, z], [x2, y0 + 0.06, z2], 0.008, 'white')
      for (let j = 1; j < 4; j++) {
        const t = j / 4
        k.box(0.012, 0.14, 0.012, x + (x2 - x) * t, y0 + 0.06, z + (z2 - z) * t, 'white', { bevel: 0 })
      }
    }
    // Fretwork brackets under the eaves.
    k.strut([x, y0 + postH - 0.12, z], [Math.cos(mid) * (R - 0.05), y0 + postH, Math.sin(mid) * (R - 0.05)], 0.008, 'white')
  }
  // Roof: a band, an eight-sided cone and a finial.
  const ry = y0 + postH
  k.cyl(R + 0.04, 0.06, 0, ry, 0, 'white', { seg: 8, ry: Math.PI / 8 })
  k.cyl(R + 0.14, 0.4, 0, ry + 0.06, 0, 'roofred', { seg: 8, rTop: 0.04, ry: Math.PI / 8, gradient: true })
  k.cyl(0.05, 0.08, 0, ry + 0.45, 0, 'white', { seg: 8 })
  k.ball(0.04, 0, ry + 0.56, 0, 'gold')
  k.bench(0, -0.3, 0, 'lightwood', 1.3)
}

function pond(k: Kit) {
  k.ground(1.9, 1.9, 'lawn', 0.03)
  // The water: a rounded, uneven outline in a ring of stones.
  const pts: [number, number][] = []
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2
    const r = 0.66 + 0.08 * Math.sin(a * 3 + 0.5) + 0.04 * Math.cos(a * 5)
    pts.push([Math.cos(a) * r * 1.1, Math.sin(a) * r * 0.95])
  }
  k.slab(pts, 0.03, 0.02, 'soil')
  k.slab(pts.map(([x, z]) => [x * 0.93, z * 0.93]), 0.035, 0.02, 'water', { finish: 'shiny' })
  for (const [i, [x, z]] of pts.entries()) k.rock(x, z, 0.06 + (i % 3) * 0.015, i % 2 ? 'stone' : 'stonedark', 0.03)
  // Lily pads with a flower or two.
  for (const [x, z, f] of [[-0.3, 0.15, 'rose'], [0.25, -0.25, null], [0.4, 0.2, 'white'], [-0.15, -0.35, null]] as const) {
    k.cyl(0.07, 0.008, x, 0.056, z, 'leaf', { seg: 10, arc: Math.PI * 1.8 })
    if (f) k.ball(0.025, x + 0.01, 0.07, z, f, { lumpy: true })
  }
  // Reeds and cattails at the edge.
  for (const [x, z] of [[-0.72, -0.2], [-0.68, -0.3], [-0.6, -0.36], [0.7, 0.35], [0.62, 0.45]]) {
    k.cyl(0.008, 0.28, x, 0.03, z, 'foliage', { seg: 4 })
    k.cyl(0.016, 0.07, x, 0.24, z, 'wooddark', { seg: 6 })
  }
  // A little jetty, a duck and her duckling.
  k.box(0.18, 0.025, 0.42, 0.55, 0.07, -0.55, 'lightwood', { bevel: 0.005, ry: 0.7 })
  for (const [x, z] of [[0.45, -0.42], [0.62, -0.62]]) k.cyl(0.02, 0.09, x, 0.0, z, 'wooddark', { seg: 6 })
  const duck = (x: number, z: number, s: number, body: Paint) => {
    k.ball(0.07 * s, x, 0.07, z, body, { sx: 1.35, sy: 0.75 })
    k.ball(0.04 * s, x + 0.07 * s, 0.11 * s + 0.05, z, body === 'white' ? 'leaf' : body)
    k.cyl(0.018 * s, 0.04 * s, x + 0.11 * s, 0.1 * s + 0.05, z, 'orange', { rTop: 0.008 * s, seg: 6 })
  }
  duck(-0.05, 0.1, 1, 'white')
  duck(0.15, 0.22, 0.6, 'sunny')
  k.bench(-0.2, -0.82, Math.PI, 'lightwood', 1.2)
}

function fountain(k: Kit) {
  // A paved round plaza with a two-tier fountain.
  k.ground(1.9, 1.9, 'lawn', 0.03)
  k.cyl(0.9, 0.025, 0, 0.03, 0, 'path', { seg: 32 })
  k.ring(0.9, 0.025, 0, 0.055, 0, 'stone', 'y', { seg: 32 })
  // Basin: a stone wall with a rim and water inside.
  const R = 0.62
  k.cyl(R, 0.18, 0, 0.055, 0, 'stone', { seg: 24, gradient: true })
  k.ring(R - 0.02, 0.035, 0, 0.235, 0, 'snow', 'y', { seg: 28 })
  k.cyl(R - 0.06, 0.02, 0, 0.2, 0, 'water', { seg: 24, finish: 'shiny' })
  // Column, lower bowl, upper bowl, and a spout of water.
  k.cyl(0.08, 0.32, 0, 0.2, 0, 'stone', { seg: 12, rTop: 0.06 })
  k.cyl(0.3, 0.07, 0, 0.47, 0, 'stone', { seg: 20, rTop: 0.34 })
  k.cyl(0.29, 0.015, 0, 0.535, 0, 'water', { seg: 20, finish: 'shiny' })
  k.cyl(0.05, 0.22, 0, 0.54, 0, 'stone', { seg: 10, rTop: 0.04 })
  k.cyl(0.15, 0.05, 0, 0.74, 0, 'stone', { seg: 16, rTop: 0.17 })
  k.cyl(0.14, 0.012, 0, 0.785, 0, 'water', { seg: 16, finish: 'shiny' })
  k.cyl(0.03, 0.14, 0, 0.79, 0, 'paleblue', { seg: 8, rTop: 0.01, finish: 'shiny' })
  k.ball(0.04, 0, 0.94, 0, 'paleblue', { finish: 'shiny' })
  // Falling water: thin curtains from the bowls' rims.
  k.cyl(0.33, 0.2, 0, 0.27, 0, 'paleblue', { seg: 20, open: true, rTop: 0.34, finish: 'shiny' })
  // Four planters on the plaza's corners and benches between.
  for (const a of [0.25, 0.75, 1.25, 1.75]) {
    const x = Math.cos(a * Math.PI) * 0.8
    const z = Math.sin(a * Math.PI) * 0.8
    k.cyl(0.08, 0.1, x, 0.055, z, 'terracotta', { seg: 10, rTop: 0.09 })
    k.bush(x, z, 0.09, 'hedge', 'rose', 0.13)
  }
}

function statue(k: Kit) {
  k.ground(0.96, 0.96, 'stone', 0.03)
  // Flowers round a stepped plinth with a plaque.
  for (const [x, z] of [[-0.35, 0.35], [0.35, 0.35], [0.35, -0.35], [-0.35, -0.35]]) k.bush(x, z, 0.08, 'hedge', 'rose', 0.03)
  k.box(0.56, 0.06, 0.56, 0, 0.03, 0, 'stonedark', { bevel: 0.01 })
  k.box(0.42, 0.42, 0.42, 0, 0.09, 0, 'stone', { bevel: 0.02, gradient: true })
  k.box(0.48, 0.05, 0.48, 0, 0.5, 0, 'stonedark', { bevel: 0.012 })
  k.onFace('+z', 0.21, 0, 0.22, 0.2, 0.1, 0.02, 'gold')
  // A hero in bronze, one arm raised with a torch.
  const B: Paint = '#c9973f'
  const y = 0.55
  k.cyl(0.08, 0.03, 0, y, 0, B, { seg: 12 })
  for (const s of [-1, 1]) k.cyl(0.03, 0.22, s * 0.04, y + 0.03, 0, B, { seg: 8, rTop: 0.035 })
  k.cyl(0.07, 0.22, 0, y + 0.24, 0, B, { seg: 10, rTop: 0.06, gradient: true })
  k.cyl(0.08, 0.06, 0, y + 0.24, 0, B, { seg: 10, rTop: 0.07 }) // the coat's hem
  k.ball(0.05, 0, y + 0.5, 0, B)
  k.cyl(0.055, 0.02, 0, y + 0.52, 0, B, { seg: 10, rTop: 0.04 }) // a hat brim
  k.strut([0.06, y + 0.42, 0], [0.12, y + 0.62, 0.03], 0.02, B)
  k.strut([-0.06, y + 0.42, 0], [-0.09, y + 0.27, 0.03], 0.02, B)
  k.cyl(0.02, 0.07, 0.125, y + 0.62, 0.03, B, { seg: 8, rTop: 0.03 })
  k.ball(0.03, 0.125, y + 0.71, 0.03, 'orange', { finish: 'glow', lumpy: true })
}

function benchDecor(k: Kit) {
  k.box(0.9, 0.02, 0.5, 0, 0, 0.05, 'path', { bevel: 0.006 })
  k.bench(0, -0.05, 0, 'lightwood', 1.8)
  k.bush(-0.38, -0.25, 0.1, 'hedge', 'rose')
  k.bush(0.38, -0.25, 0.09, 'hedge')
}

function lampPost(k: Kit) {
  const C: Paint = 'charcoal'
  k.cyl(0.12, 0.04, 0, 0, 0, 'stone', { seg: 8 })
  k.cyl(0.07, 0.12, 0, 0.04, 0, C, { seg: 8, rTop: 0.05 })
  k.cyl(0.028, 0.62, 0, 0.16, 0, C, { seg: 8, rTop: 0.022 })
  k.ring(0.04, 0.012, 0, 0.3, 0, C, 'y', { seg: 10 })
  k.cyl(0.04, 0.03, 0, 0.78, 0, C, { seg: 8 })
  // Two arms with lanterns.
  for (const s of [-1, 1]) {
    k.strut([0, 0.79, 0], [s * 0.16, 0.86, 0], 0.012, C)
    k.ring(0.06, 0.008, s * 0.08, 0.79, 0, C, 'z', { arc: Math.PI, seg: 8 })
    const x = s * 0.17
    k.cyl(0.012, 0.02, x, 0.84, 0, C, { seg: 6 })
    k.cyl(0.035, 0.09, x, 0.73, 0, 'light', { seg: 6, rTop: 0.05, finish: 'glow' })
    k.cyl(0.055, 0.04, x, 0.82, 0, C, { seg: 6, rTop: 0.015 })
    k.cyl(0.03, 0.02, x, 0.71, 0, C, { seg: 6 })
  }
  k.ball(0.025, 0, 0.83, 0, 'gold')
  // A hanging basket of flowers.
  k.strut([0, 0.55, 0], [0.11, 0.55, 0], 0.008, C)
  k.ball(0.06, 0.11, 0.44, 0, 'wooddark', { sy: 0.7 })
  for (const [dx, dz, c] of [[0, 0, 'rose'], [0.04, 0.03, 'sunny'], [-0.03, 0.03, 'white'], [0.02, -0.04, 'violet']] as const) k.ball(0.028, 0.11 + dx, 0.48, dz, c, { lumpy: true })
  k.ball(0.05, 0.11, 0.42, 0.04, 'foliage', { lumpy: true, sy: 0.6 })
}

function hedgeDecor(k: Kit) {
  k.box(0.98, 0.32, 0.36, 0, 0, 0, 'hedge', { bevel: 0.06, gradient: true })
  for (let i = 0; i < 6; i++) {
    const x = -0.4 + i * 0.16
    k.ball(0.05, x, 0.28, (i % 2 ? 0.06 : -0.05), 'foliage', { lumpy: true, sy: 0.6 })
  }
  for (let i = 0; i < 5; i++) k.ball(0.02, -0.36 + i * 0.18, 0.2 + (i % 2) * 0.06, 0.185, i % 2 ? 'white' : 'rose')
}

function flowerBedDecor(k: Kit) {
  k.box(0.9, 0.09, 0.9, 0, 0, 0, 'lightwood', { bevel: 0.015 })
  k.box(0.82, 0.04, 0.82, 0, 0.06, 0, 'soil', { bevel: 0 })
  // Rows of tulips in bands of color, a border of greenery.
  const rows: Paint[] = ['rose', 'sunny', 'violet', 'coral', 'white']
  for (const [r, c] of rows.entries()) {
    const z = -0.32 + r * 0.16
    for (let i = 0; i < 5; i++) {
      const x = -0.32 + i * 0.16 + (r % 2) * 0.04
      k.cyl(0.006, 0.1, x, 0.1, z, 'foliage', { seg: 4 })
      k.ball(0.04, x - 0.02, 0.12, z + 0.02, 'foliage', { lumpy: true, sy: 0.5 })
      k.cyl(0.03, 0.05, x, 0.18, z, c, { seg: 6, rTop: 0.038 })
    }
  }
}

function busStop(k: Kit) {
  // A curb and paving, a glass shelter with a blue roof, a bench and the sign.
  k.box(0.94, 0.04, 0.6, 0, 0, -0.05, 'concrete', { bevel: 0.01 })
  k.box(0.94, 0.05, 0.06, 0, 0, 0.25, 'stone', { bevel: 0.008 })
  const z = -0.18
  for (const x of [-0.33, 0.33]) for (const dz of [-0.12, 0.14]) k.box(0.03, 0.5, 0.03, x, 0.04, z + dz, 'charcoal', { bevel: 0 })
  k.box(0.66, 0.42, 0.015, 0, 0.1, z - 0.12, 'paleblue', { bevel: 0, finish: 'shiny' })
  k.box(0.66, 0.04, 0.03, 0, 0.08, z - 0.12, 'charcoal', { bevel: 0 })
  k.box(0.015, 0.36, 0.24, -0.33, 0.12, z + 0.01, 'paleblue', { bevel: 0, finish: 'shiny' })
  // An advert on the right side.
  k.box(0.02, 0.3, 0.22, 0.335, 0.12, z + 0.01, 'charcoal', { bevel: 0 })
  k.box(0.012, 0.26, 0.18, 0.348, 0.14, z + 0.01, 'coral', { bevel: 0 })
  k.ball(0.04, 0.355, 0.27, z + 0.01, 'sunny')
  // The roof, curving gently.
  k.box(0.76, 0.05, 0.4, 0, 0.54, z + 0.01, 'blue', { bevel: 0.015, gradient: true })
  k.box(0.78, 0.03, 0.42, 0, 0.59, z + 0.01, 'white', { bevel: 0.01 })
  k.box(0.5, 0.025, 0.12, 0, 0.18, z - 0.04, 'lightwood', { bevel: 0.005 })
  for (const x of [-0.2, 0.2]) k.box(0.03, 0.14, 0.08, x, 0.04, z - 0.04, 'charcoal', { bevel: 0 })
  // The sign: a pole with a yellow bus plate and a timetable.
  k.cyl(0.015, 0.66, 0.4, 0.04, 0.18, 'steel', { seg: 6 })
  k.cyl(0.08, 0.02, 0.4, 0.66, 0.18, 'sunny', { seg: 16, ry: Math.PI / 2 })
  k.rod(0.09, 0.025, 0.4, 0.6, 0.18, 'sunny', 'z', { seg: 18 })
  k.rod(0.06, 0.03, 0.4, 0.6, 0.18, 'navy', 'z', { seg: 18 })
  k.box(0.08, 0.1, 0.012, 0.4, 0.38, 0.19, 'white', { bevel: 0 })
  k.cyl(0.05, 0.12, -0.38, 0.04, 0.12, 'charcoal', { seg: 10 }) // a bin
}

// ---- Parks

function park(k: Kit) {
  k.ground(1.95, 1.95, 'lawn', 0.03)
  // A winding path across, with a flower circle in the middle.
  const path: [number, number][] = []
  const back: [number, number][] = []
  for (let i = 0; i <= 12; i++) {
    const x = -0.98 + (i / 12) * 1.96
    const z = 0.2 * Math.sin(x * 2.2)
    path.push([x, z - 0.13])
    back.push([x, z + 0.13])
  }
  k.slab([...path, ...back.reverse()], 0.03, 0.012, 'path')
  k.cyl(0.36, 0.014, 0, 0.03, 0, 'path', { seg: 24 })
  k.cyl(0.24, 0.06, 0, 0.03, 0, 'stone', { seg: 20 })
  k.cyl(0.21, 0.03, 0, 0.07, 0, 'soil', { seg: 20 })
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2
    k.ball(0.045, Math.cos(a) * 0.14, 0.11, Math.sin(a) * 0.14, (['rose', 'sunny', 'white'] as Paint[])[i % 3], { lumpy: true })
  }
  k.ball(0.07, 0, 0.12, 0, 'foliage', { lumpy: true })
  // Trees, benches by the path, a lamp, flowers and a picnic blanket.
  k.tree(-0.6, -0.6, 1.25)
  k.tree(0.62, -0.55, 1.05, 'lime')
  k.tree(0.7, 0.62, 1.15)
  k.bench(-0.45, -0.25, 0, 'lightwood', 1.1)
  k.bench(0.35, 0.42, Math.PI, 'lightwood', 1.1)
  k.lamp(-0.15, 0.45, 0.55)
  k.lamp(0.5, -0.15, 0.55)
  k.bush(-0.82, 0.3, 0.1, 'hedge', 'rose')
  k.bush(-0.6, 0.72, 0.12, 'hedge', 'sunny')
  k.bush(0.2, -0.82, 0.1, 'hedge', 'violet')
  k.box(0.3, 0.008, 0.26, -0.42, 0.03, 0.62, 'red', { bevel: 0, ry: 0.3 })
  k.box(0.3, 0.009, 0.06, -0.42, 0.03, 0.62, 'white', { bevel: 0, ry: 0.3 })
  k.box(0.1, 0.07, 0.07, -0.36, 0.035, 0.6, 'lightwood', { bevel: 0.01, ry: 0.3 })
}

function playground(k: Kit) {
  k.ground(1.95, 1.95, 'lawn', 0.03)
  k.box(1.7, 0.02, 1.7, 0, 0.03, 0, 'coral', { bevel: 0.01 })
  k.box(0.8, 0.021, 0.8, 0.42, 0.03, 0.42, 'aqua', { bevel: 0 })
  // A low fence round it.
  const F = 0.9
  k.fence(-F, -F, F, -F, 'white', { h: 0.12 })
  k.fence(-F, -F, -F, F, 'white', { h: 0.12 })
  k.fence(F, -F, F, F, 'white', { h: 0.12 })
  k.fence(-F, F, -0.2, F, 'white', { h: 0.12 })
  k.fence(0.2, F, F, F, 'white', { h: 0.12 })
  // The climbing frame: a deck on posts with a roof, a ladder and a slide.
  const px = -0.45
  const pz = -0.4
  for (const [dx, dz] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) k.box(0.045, 0.72, 0.045, px + dx, 0.05, pz + dz, 'blue', { bevel: 0.006 })
  k.box(0.42, 0.04, 0.42, px, 0.34, pz, 'sunny', { bevel: 0.01 })
  k.gableRoof(0.42, 0.42, 0.16, px, 0.77, pz, 'red', 'red', { overhang: 0.04, thick: 0.03 })
  for (const s of [-1, 1]) k.box(0.42, 0.12, 0.025, px, 0.38, pz + s * 0.2, 'lime', { bevel: 0.006 })
  // Slide down toward the front.
  const len = 0.6
  k.slope([pz + 0.21, 0.36], [pz + 0.21 + len, 0.05], 0.16, px, 0, 0, 'orange', 'x', { thick: 0.03 })
  for (const s of [-1, 1]) k.strut([px + s * 0.08, 0.4, pz + 0.21], [px + s * 0.08, 0.1, pz + 0.21 + len], 0.012, 'orange')
  // Ladder up the back left.
  for (const s of [-1, 1]) k.strut([px - 0.21 - 0.25, 0.05, pz + s * 0.07], [px - 0.21, 0.38, pz + s * 0.07], 0.012, 'blue')
  for (let i = 1; i < 5; i++) {
    const t = i / 5
    k.rod(0.009, 0.14, px - 0.46 + 0.25 * t, 0.05 + 0.33 * t, pz, 'white', 'z')
  }
  // Swings: an A-frame with two seats.
  const sx = 0.45
  const sz = -0.45
  for (const s of [-1, 1]) {
    k.strut([sx + s * 0.38, 0.05, sz - 0.14], [sx + s * 0.38, 0.58, sz], 0.022, 'red')
    k.strut([sx + s * 0.38, 0.05, sz + 0.14], [sx + s * 0.38, 0.58, sz], 0.022, 'red')
  }
  k.rod(0.022, 0.8, sx, 0.58, sz, 'red', 'x')
  for (const [x, c] of [[sx - 0.15, 'sunny'], [sx + 0.15, 'aqua']] as const) {
    for (const s of [-1, 1]) k.strut([x + s * 0.05, 0.58, sz], [x + s * 0.05, 0.2, sz], 0.005, 'steel')
    k.box(0.12, 0.02, 0.06, x, 0.19, sz, c, { bevel: 0.004 })
  }
  // Sandbox with a bucket, a seesaw and a spring rider.
  const bx = 0.42
  const bz = 0.42
  for (const s of [-1, 1]) {
    k.box(0.6, 0.07, 0.05, bx, 0.05, bz + s * 0.28, 'lightwood', { bevel: 0.01 })
    k.box(0.05, 0.07, 0.6, bx + s * 0.28, 0.05, bz, 'lightwood', { bevel: 0.01 })
  }
  k.box(0.52, 0.05, 0.52, bx, 0.05, bz, 'sand', { bevel: 0 })
  k.ball(0.07, bx - 0.08, 0.1, bz + 0.05, 'sand', { sy: 0.6, lumpy: true })
  k.cyl(0.035, 0.05, bx + 0.1, 0.1, bz - 0.05, 'red', { seg: 10, rTop: 0.045 })
  k.box(0.06, 0.06, 0.06, -0.5, 0.05, 0.5, 'charcoal', { bevel: 0.01 })
  k.box(0.75, 0.03, 0.08, -0.5, 0.1, 0.5, 'purple', { bevel: 0.006, ry: Math.PI / 2 })
  for (const s of [-1, 1]) k.box(0.025, 0.06, 0.08, -0.5, 0.13, 0.5 + s * 0.32, 'charcoal', { bevel: 0 })
  k.cyl(0.02, 0.12, -0.05, 0.05, 0.62, 'charcoal', { seg: 6 })
  k.ball(0.07, -0.05, 0.22, 0.62, 'lime', { sx: 1.4, sy: 0.8 })
  k.ball(0.04, 0.03, 0.29, 0.62, 'lime')
  k.tree(0.78, -0.05, 0.9)
  k.tree(-0.8, 0.15, 0.8, 'lime')
}

function sportsField(k: Kit) {
  const W = 2.9
  const D = 1.95
  k.ground(W, D, 'lawn', 0.03)
  // The pitch: mown stripes in two greens, white lines.
  const pw = 2.4
  const pd = 1.3
  const pz = 0.22
  const n = 8
  for (let i = 0; i < n; i++) k.box(pw / n, 0.012, pd, -pw / 2 + (i + 0.5) * (pw / n), 0.03, pz, i % 2 ? 'turf' : '#56ad46', { bevel: 0 })
  const L: Paint = 'white'
  const y = 0.043
  for (const s of [-1, 1]) {
    k.box(pw - 0.1, 0.004, 0.025, 0, y, pz + s * (pd / 2 - 0.05), L, { bevel: 0 })
    k.box(0.025, 0.004, pd - 0.1, s * (pw / 2 - 0.05), y, pz, L, { bevel: 0 })
    // Penalty boxes.
    k.box(0.025, 0.004, 0.6, s * (pw / 2 - 0.4), y, pz, L, { bevel: 0 })
    for (const t of [-1, 1]) k.box(0.35, 0.004, 0.025, s * (pw / 2 - 0.225), y, pz + t * 0.3, L, { bevel: 0 })
    // Goals with nets.
    const gx = s * (pw / 2 - 0.05)
    for (const t of [-1, 1]) {
      k.box(0.03, 0.22, 0.03, gx, 0.03, pz + t * 0.2, 'white', { bevel: 0 })
      k.strut([gx, 0.25, pz + t * 0.2], [gx + s * 0.14, 0.03, pz + t * 0.2], 0.008, 'white')
    }
    k.rod(0.015, 0.43, gx, 0.25, pz, 'white', 'z')
    k.box(0.006, 0.22, 0.4, gx + s * 0.14, 0.03, pz, 'skyblue', { bevel: 0, finish: 'shiny' })
    // Floodlights at the corners.
    k.cyl(0.02, 0.95, s * (W / 2 - 0.08), 0.03, -D / 2 + 0.12, 'steel', { seg: 6 })
    k.box(0.16, 0.1, 0.05, s * (W / 2 - 0.08), 0.95, -D / 2 + 0.14, 'charcoal', { bevel: 0.006 })
    k.box(0.13, 0.07, 0.01, s * (W / 2 - 0.08), 0.965, -D / 2 + 0.17, 'light', { bevel: 0, finish: 'glow' })
  }
  k.box(0.025, 0.004, pd - 0.1, 0, y, pz, L, { bevel: 0 })
  k.ring(0.2, 0.012, 0, y, pz, L, 'y', { seg: 28 })
  k.ball(0.035, 0.3, 0.075, pz + 0.1, 'white')
  // A stand of seats along the back.
  const sz = -0.68
  for (let r = 0; r < 3; r++) {
    k.box(1.6, 0.08 + r * 0.08, 0.14, 0, 0.03, sz - r * 0.12 + 0.12, 'concrete', { bevel: 0.006 })
    for (let i = 0; i < 12; i++) {
      const x = -0.72 + i * 0.13
      k.box(0.09, 0.05, 0.06, x, 0.11 + r * 0.08, sz - r * 0.12 + 0.13, (['red', 'blue', 'sunny'] as Paint[])[(r + i) % 3], { bevel: 0.006 })
    }
  }
  k.box(1.7, 0.03, 0.5, 0, 0.55, sz - 0.04, 'roofblue', { bevel: 0.01 })
  for (const x of [-0.8, 0.8]) k.box(0.03, 0.52, 0.03, x, 0.03, sz + 0.18, 'steel', { bevel: 0 })
  // A scoreboard.
  k.box(0.04, 0.6, 0.04, -1.25, 0.03, sz, 'steel', { bevel: 0 })
  k.box(0.32, 0.2, 0.05, -1.25, 0.55, sz, 'charcoal', { bevel: 0.01 })
  k.box(0.26, 0.12, 0.01, -1.25, 0.59, sz + 0.03, 'light', { bevel: 0, finish: 'glow' })
}

function beach(k: Kit) {
  const W = 2.95
  const D = 1.95
  k.ground(W, D, 'sand', 0.03)
  // Small dunes and beach grass at the back.
  for (const [x, z, r] of [[-1.1, -0.75, 0.25], [-0.6, -0.82, 0.2], [0.9, -0.8, 0.22]]) {
    k.ball(r, x, 0.0, z, 'sand', { sy: 0.35, lumpy: true })
    for (let i = 0; i < 3; i++) k.cyl(0.006, 0.16, x + (i - 1) * 0.06, r * 0.25, z, 'olive', { seg: 3, rTop: 0 })
  }
  // A boardwalk down from the back.
  k.box(0.3, 0.03, 0.9, -0.05, 0.03, -0.55, 'lightwood', { bevel: 0.006 })
  for (let i = 0; i < 7; i++) k.box(0.3, 0.004, 0.01, -0.05, 0.06, -0.95 + i * 0.13, 'wooddark', { bevel: 0 })
  // Striped umbrellas over towels.
  const umbrella = (x: number, z: number, a: Paint, b: Paint, towel: Paint) => {
    k.cyl(0.012, 0.5, x, 0.03, z, 'white', { seg: 6 })
    for (let i = 0; i < 8; i++) k.cyl(0.32, 0.12, x, 0.47, z, i % 2 ? a : b, { rTop: 0, seg: 2, start: (i / 8) * Math.PI * 2, arc: Math.PI / 4 })
    k.ball(0.02, x, 0.6, z, 'white')
    k.box(0.2, 0.008, 0.38, x + 0.22, 0.03, z + 0.12, towel, { bevel: 0, ry: 0.2 })
    k.box(0.2, 0.009, 0.05, x + 0.25, 0.03, z + 0.28, 'white', { bevel: 0, ry: 0.2 })
  }
  umbrella(-0.95, 0.15, 'rose', 'white', 'sunny')
  umbrella(0.35, 0.3, 'blue', 'white', 'coral')
  umbrella(-0.35, 0.6, 'orange', 'sunny', 'aqua')
  // A deckchair, a beach ball, a sandcastle with a flag.
  k.slope([-0.12, 0.03], [0.12, 0.2], 0.16, 0.85, 0.03, 0.55, 'red', 'x', { thick: 0.02 })
  k.slope([0.12, 0.08], [0.32, 0.06], 0.16, 0.85, 0.03, 0.55, 'red', 'x', { thick: 0.02 })
  k.ball(0.07, 0.1, 0.1, 0.75, 'white')
  k.ball(0.072, 0.1, 0.1, 0.75, 'red', { sx: 0.3 })
  k.ball(0.072, 0.1, 0.1, 0.75, 'blue', { sz: 0.3 })
  const cx = -1.15
  const cz = 0.65
  k.box(0.22, 0.08, 0.22, cx, 0.03, cz, 'sand', { bevel: 0.01 })
  for (const [dx, dz] of [[-0.09, -0.09], [0.09, -0.09], [-0.09, 0.09], [0.09, 0.09]]) k.cyl(0.04, 0.14, cx + dx, 0.03, cz + dz, 'sand', { seg: 8 })
  k.cyl(0.05, 0.12, cx, 0.11, cz, 'sand', { seg: 8, rTop: 0.035 })
  k.cyl(0.005, 0.1, cx, 0.23, cz, 'charcoal', { seg: 4 })
  k.box(0.05, 0.03, 0.004, cx + 0.025, 0.3, cz, 'red', { bevel: 0 })
  // The lifeguard tower, right.
  const lx = 1.05
  const lz = -0.1
  for (const [dx, dz] of [[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13]]) k.strut([lx + dx * 1.3, 0.03, lz + dz * 1.3], [lx + dx, 0.5, lz + dz], 0.018, 'white')
  k.box(0.34, 0.03, 0.34, lx, 0.5, lz, 'lightwood', { bevel: 0.006 })
  k.box(0.3, 0.22, 0.26, lx, 0.53, lz - 0.02, 'red', { bevel: 0.01 })
  k.onFace('+z', lz + 0.11, lx, 0.6, 0.2, 0.1, 0.02, 'glassdark', { bevel: 0, finish: 'shiny' })
  k.cyl(0.24, 0.1, lx, 0.75, lz - 0.02, 'white', { seg: 4, rTop: 0.02, ry: Math.PI / 4 })
  k.cyl(0.006, 0.25, lx + 0.15, 0.53, lz + 0.15, 'white', { seg: 4 })
  k.box(0.1, 0.06, 0.004, lx + 0.2, 0.71, lz + 0.15, 'sunny', { bevel: 0 })
  for (let i = 0; i < 5; i++) k.box(0.2, 0.015, 0.03, lx, 0.1 * i + 0.05, lz + 0.25 + 0.04 * i, 'white', { bevel: 0 }) // ladder
  k.ring(0.05, 0.015, lx - 0.17, 0.62, lz + 0.11, 'orange', 'z', { seg: 12 })
  // Surfboards stuck in the sand, and a palm.
  for (const [x, c, a] of [[1.32, 'aqua', 0.15], [1.4, 'sunny', -0.1]] as const) k.box(0.1, 0.42, 0.025, x, 0.03, 0.55, c, { bevel: 0.012, ry: a })
  palm(k, 1.05, -0.72, 1)
  palm(k, -1.15, -0.35, 0.85)
}

function palm(k: Kit, x: number, z: number, s: number) {
  let px = x
  let py = 0.03
  for (let i = 0; i < 6; i++) {
    const nx = px + 0.02 * s
    k.cyl(0.035 * s, 0.13 * s, px, py, z, i % 2 ? 'wood' : 'lightwood', { seg: 7, rTop: 0.03 * s })
    px = nx
    py += 0.12 * s
  }
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2
    k.strut([px, py, z], [px + Math.cos(a) * 0.3 * s, py - 0.1 * s, z + Math.sin(a) * 0.3 * s], 0.028 * s, i % 2 ? 'foliage' : 'leaf', { seg: 4 })
  }
  for (const [dx, dz] of [[0.03, 0.02], [-0.02, 0.03], [0, -0.03]]) k.ball(0.03 * s, px + dx * s, py - 0.03 * s, z + dz * s, 'wooddark')
}

function centralPark(k: Kit) {
  k.ground(3.95, 3.95, 'lawn', 0.03)
  // Two paths crossing at a fountain plaza, with a ring path round it.
  k.box(3.9, 0.012, 0.32, 0, 0.03, 0, 'path', { bevel: 0 })
  k.box(0.32, 0.012, 3.9, 0, 0.03, 0, 'path', { bevel: 0 })
  k.cyl(0.75, 0.014, 0, 0.03, 0, 'path', { seg: 32 })
  k.ring(0.75, 0.02, 0, 0.045, 0, 'stone', 'y', { seg: 32 })
  k.cyl(0.42, 0.14, 0, 0.03, 0, 'stone', { seg: 24, gradient: true })
  k.ring(0.41, 0.03, 0, 0.17, 0, 'snow', 'y', { seg: 24 })
  k.cyl(0.38, 0.02, 0, 0.14, 0, 'water', { seg: 24, finish: 'shiny' })
  k.cyl(0.06, 0.3, 0, 0.14, 0, 'stone', { seg: 10 })
  k.cyl(0.18, 0.05, 0, 0.44, 0, 'stone', { seg: 16, rTop: 0.2 })
  k.cyl(0.03, 0.12, 0, 0.47, 0, 'paleblue', { seg: 8, rTop: 0.01, finish: 'shiny' })
  // A pond with ducks in the front right quarter.
  const pts: [number, number][] = []
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    const r = 0.62 + 0.07 * Math.sin(a * 3)
    pts.push([1.05 + Math.cos(a) * r * 1.15, 1.05 + Math.sin(a) * r * 0.9])
  }
  k.slab(pts, 0.03, 0.02, 'soil')
  k.slab(pts.map(([x, z]) => [1.05 + (x - 1.05) * 0.9, 1.05 + (z - 1.05) * 0.9]), 0.035, 0.02, 'water', { finish: 'shiny' })
  for (const [i, [x, z]] of pts.entries()) if (i % 2 === 0) k.rock(x, z, 0.06, 'stone', 0.03)
  for (const [x, z] of [[0.9, 1.0], [1.2, 1.2]]) {
    k.ball(0.06, x, 0.07, z, 'white', { sx: 1.35, sy: 0.75 })
    k.ball(0.035, x + 0.06, 0.12, z, 'leaf')
    k.cyl(0.015, 0.03, x + 0.1, 0.11, z, 'orange', { seg: 6, rTop: 0.007 })
  }
  // Lily pads.
  for (const [x, z] of [[1.3, 0.8], [0.75, 1.3], [1.45, 1.35]]) k.cyl(0.07, 0.008, x, 0.056, z, 'leaf', { seg: 10, arc: Math.PI * 1.8 })
  // Trees in clumps round the edges.
  for (const [x, z, s, c] of [[-1.5, -1.5, 1.3, 'foliage'], [-1.0, -1.65, 1.0, 'lime'], [-1.6, -0.8, 1.1, 'foliage'], [1.5, -1.5, 1.2, 'foliage'], [0.9, -1.6, 1.0, 'coral'], [1.65, -0.75, 1.05, 'lime'], [-1.55, 1.5, 1.25, 'foliage'], [-0.8, 1.65, 1.0, 'rose'], [-1.65, 0.8, 1.0, 'foliage'], [1.7, 0.3, 0.9, 'foliage'], [0.3, 1.7, 0.9, 'lime']] as [number, number, number, Paint][]) k.tree(x, z, s, c)
  for (const [x, z] of [[-0.6, -1.3], [-1.3, -0.4], [1.3, -0.5], [0.5, -1.2]]) k.pine(x, z, 0.85)
  // Flower beds in the quarters, benches and lamps along the paths.
  k.flowerBed(0.7, 0.35, -0.9, -0.55)
  k.flowerBed(0.35, 0.7, 0.55, -0.95)
  k.flowerBed(0.7, 0.35, -0.95, 0.55, ['violet', 'white', 'rose'])
  for (const [x, z, ry] of [[-0.45, -1.1, Math.PI / 2], [-0.4, 1.35, Math.PI / 2], [-1.2, 0.35, Math.PI], [1.4, -0.32, 0], [-0.55, 0.85, 0]]) k.bench(x, z, ry, 'lightwood', 1.2)
  for (const [x, z] of [[-0.3, -1.6], [0.3, -0.9], [-1.6, 0.3], [1.0, -0.3], [-0.3, 1.0], [0.3, 1.8]]) k.lamp(x, z, 0.55)
  // A bandstand-style gazebo in the back left.
  const gx = -1.2
  const gz = -1.0
  k.cyl(0.36, 0.06, gx, 0.03, gz, 'stone', { seg: 8 })
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    k.cyl(0.018, 0.38, gx + Math.cos(a) * 0.3, 0.09, gz + Math.sin(a) * 0.3, 'white', { seg: 6 })
  }
  k.cyl(0.42, 0.24, gx, 0.47, gz, 'roofred', { seg: 8, rTop: 0.03, gradient: true })
  k.ball(0.03, gx, 0.73, gz, 'gold')
  // Low hedges along the outer edge.
  for (const s of [-1, 1]) {
    k.hedgeRow(1.55, s * 1.05, 1.88, { h: 0.12, d: 0.12, flowers: 'rose' })
    k.hedgeRow(1.55, s * 1.05, -1.88, { h: 0.12, d: 0.12 })
    k.hedgeRow(1.55, 1.88, s * 1.05, { h: 0.12, d: 0.12, ry: Math.PI / 2 })
    k.hedgeRow(1.55, -1.88, s * 1.05, { h: 0.12, d: 0.12, ry: Math.PI / 2 })
  }
}

function botanicalGarden(k: Kit) {
  k.ground(2.92, 2.92, 'lawn', 0.03)
  // Formal paths: one up the middle to the palm house, one across.
  k.box(0.36, 0.012, 1.5, 0, 0.03, 0.72, 'path', { bevel: 0 })
  k.box(2.8, 0.012, 0.3, 0, 0.03, 0.55, 'path', { bevel: 0 })
  // The palm house: a domed glass rotunda with two barrel-vaulted wings.
  const z = -0.45
  k.box(2.5, 0.1, 1.05, 0, 0.03, z, 'stone', { bevel: 0.015 })
  // Wings: glass walls, white ribs, barrel roofs.
  for (const s of [-1, 1]) {
    const x = s * 0.72
    k.box(0.9, 0.4, 0.7, x, 0.13, z, 'paleblue', { bevel: 0.01, finish: 'shiny' })
    for (let i = 0; i <= 5; i++) {
      const rx = x - 0.45 + i * 0.18
      k.box(0.025, 0.4, 0.72, rx, 0.13, z, 'white', { bevel: 0 })
      k.ring(0.36, 0.014, rx, 0.53, z, 'white', 'x', { arc: Math.PI, seg: 14 })
    }
    k.box(0.92, 0.03, 0.72, x, 0.13 + 0.2, z, 'white', { bevel: 0 })
    k.rod(0.35, 0.9, x, 0.53, z, 'paleblue', 'x', { seg: 16, finish: 'shiny' })
    k.box(0.9, 0.04, 0.74, x, 0.51, z, 'white', { bevel: 0 })
    // Plants showing through the glass.
    for (const dx of [-0.25, 0.1, 0.3]) k.ball(0.12, x + dx, 0.3, z + 0.1, 'foliage', { lumpy: true })
  }
  // The rotunda.
  k.cyl(0.52, 0.55, 0, 0.13, z, 'paleblue', { seg: 16, finish: 'shiny' })
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    k.box(0.025, 0.55, 0.025, Math.cos(a) * 0.52, 0.13, z + Math.sin(a) * 0.52, 'white', { bevel: 0 })
  }
  k.ring(0.53, 0.025, 0, 0.42, z, 'white', 'y', { seg: 20 })
  k.ring(0.53, 0.03, 0, 0.68, z, 'white', 'y', { seg: 20 })
  k.ball(0.5, 0, 0.68, z, 'paleblue', { sy: 0.85, seg: 18, finish: 'shiny' })
  k.ring(0.5, 0.012, 0, 0.68, z, 'white', 'x', { arc: Math.PI, seg: 14 })
  k.ring(0.5, 0.012, 0, 0.68, z, 'white', 'z', { arc: Math.PI, seg: 14 })
  k.cyl(0.12, 0.12, 0, 1.08, z, 'white', { seg: 10 })
  k.ball(0.1, 0, 1.2, z, 'paleblue', { finish: 'shiny' })
  k.ball(0.035, 0, 1.31, z, 'gold')
  // A palm reaching up inside the dome.
  palm(k, 0, z, 0.9)
  // The entrance porch.
  k.box(0.4, 0.5, 0.24, 0, 0.13, z + 0.6, 'white', { bevel: 0.01 })
  k.onFace('+z', z + 0.72, 0, 0.13, 0.22, 0.32, 0.02, 'glass', { finish: 'shiny', bevel: 0 })
  k.gableRoof(0.4, 0.24, 0.14, 0, 0.63, z + 0.6, 'white', 'white', { ridge: 'z', overhang: 0.04, thick: 0.03 })
  // Formal beds, topiary and an arch of roses.
  for (const s of [-1, 1]) {
    k.flowerBed(0.9, 0.42, s * 0.85, 1.0, s < 0 ? ['rose', 'white', 'violet'] : ['sunny', 'coral', 'white'])
    k.flowerBed(0.9, 0.3, s * 0.85, 0.2, ['violet', 'rose'])
    for (const dz of [0.6, 1.3]) {
      k.cyl(0.05, 0.08, s * 0.28, 0.03, dz, 'terracotta', { seg: 8, rTop: 0.06 })
      k.ball(0.09, s * 0.28, 0.2, dz, 'hedge', { seg: 12 })
      k.ball(0.06, s * 0.28, 0.34, dz, 'hedge', { seg: 12 })
    }
    k.tree(s * 1.2, -1.2, 1.0, s < 0 ? 'rose' : 'foliage')
    k.pine(s * 1.25, 0.0, 0.9)
  }
  k.ring(0.24, 0.025, 0, 0.03, 1.4, 'white', 'z', { arc: Math.PI, seg: 14 })
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * Math.PI
    k.ball(0.045, Math.cos(a) * 0.24, 0.03 + Math.sin(a) * 0.24, 1.4, i % 2 ? 'rose' : 'foliage', { lumpy: true })
  }
}

// ---- Transport

function trainStation(k: Kit) {
  k.ground(2.95, 1.95, 'concrete', 0.03)
  // The platform along the front, with its yellow safety line.
  k.box(2.95, 0.08, 0.66, 0, 0.03, 0.64, 'stone', { bevel: 0.01 })
  k.box(2.9, 0.004, 0.04, 0, 0.11, 0.9, 'sunny', { bevel: 0 })
  // The hall: brick walls with cream trim and a slate hip roof.
  const W = 2.0
  const D = 0.95
  const z0 = -0.42
  const H = 0.62
  k.box(W + 0.05, 0.08, D + 0.05, 0, 0.03, z0, 'stonedark', { bevel: 0.01 })
  k.box(W, H, D, 0, 0.11, z0, 'brick', { bevel: 0.02 })
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.07, H, 0.07, sx * (W / 2 - 0.02), 0.11, z0 + sz * (D / 2 - 0.02), 'cream', { bevel: 0.008 })
  k.trim(W, D, 0.11 + H - 0.03, 'cream', { h: 0.07, out: 0.03, z: z0 })
  k.trim(W, D, 0.11 + 0.28, 'cream', { h: 0.03, out: 0.015, z: z0 })
  k.hipRoof(W, D, 0.34, 0, 0.11 + H + 0.04, z0, 'roofgray', 0.1)
  const front = z0 + D / 2
  // Arched windows along the front and side.
  for (const u of [-0.8, -0.55, 0.55, 0.8]) {
    k.window('+z', front, u, 0.2, { w: 0.16, h: 0.3, frame: 'cream' })
    k.ring(0.06, 0.016, u, 0.5, front + 0.02, 'cream', 'z', { arc: Math.PI, seg: 8 })
  }
  k.windows('+x', W / 2, z0 - 0.3, z0 + 0.3, 0.2, 2, { w: 0.16, h: 0.3, frame: 'cream' })
  // The central bay: a taller gable with a clock over the doors.
  k.box(0.7, H + 0.32, 0.18, 0, 0.11, front + 0.02, 'brick', { bevel: 0.015 })
  k.gableRoof(0.7, 0.18, 0.22, 0, 0.11 + H + 0.32, front + 0.02, 'roofgray', 'cream', { ridge: 'z', overhang: 0.05, thick: 0.035 })
  k.door('+z', front + 0.11, 0, { w: 0.3, h: 0.38, color: 'navy', y: 0.11, glass: true })
  k.ring(0.15, 0.025, 0, 0.49, front + 0.13, 'cream', 'z', { arc: Math.PI, seg: 12 })
  k.rod(0.13, 0.03, 0, 0.78, front + 0.12, 'gold', 'z', { seg: 20 })
  k.rod(0.11, 0.035, 0, 0.78, front + 0.12, 'white', 'z', { seg: 20 })
  k.strut([0, 0.78, front + 0.145], [0, 0.86, front + 0.145], 0.008, 'navy')
  k.strut([0, 0.78, front + 0.145], [0.06, 0.78, front + 0.145], 0.008, 'navy')
  // Chimneys.
  for (const x of [-0.6, 0.6]) k.box(0.1, 0.32, 0.1, x, 0.11 + H + 0.12, z0 - 0.2, 'brickdark', { bevel: 0.01 })
  // The platform canopy: iron columns, a glazed roof and a white valance.
  const cz = 0.66
  for (const x of [-1.3, -0.65, 0.65, 1.3]) {
    k.cyl(0.022, 0.42, x, 0.11, cz + 0.12, 'roofgreen', { seg: 8 })
    k.strut([x, 0.45, cz + 0.12], [x, 0.53, cz - 0.12], 0.012, 'roofgreen')
  }
  k.slope([cz - 0.3, 0.6], [cz + 0.32, 0.52], 2.85, 0, 0, 0, 'roofgreen', 'x', { thick: 0.025 })
  for (let i = 0; i < 6; i++) k.slope([cz - 0.27, 0.627], [cz + 0.29, 0.553], 0.36, -1.18 + i * 0.47, 0, 0, 'paleblue', 'x', { thick: 0.008, finish: 'shiny' })
  for (let i = 0; i < 28; i++) k.cyl(0.05, 0.05, -1.4 + i * 0.104, 0.46, cz + 0.32, 'white', { seg: 3, rTop: 0, ry: Math.PI })
  // Benches, lamps, a timetable, a trolley of luggage and flowers.
  for (const x of [-1.0, 0.95]) k.bench(x, 0.5, 0, 'wood', 1.1)
  for (const x of [-0.35, 0.35]) k.lamp(x, 0.88, 0.5, 'navy')
  k.box(0.04, 0.32, 0.04, 1.3, 0.11, 0.48, 'navy', { bevel: 0 })
  k.box(0.32, 0.18, 0.04, 1.3, 0.38, 0.48, 'navy', { bevel: 0.008 })
  k.box(0.27, 0.13, 0.01, 1.3, 0.405, 0.505, 'charcoal', { bevel: 0, finish: 'glow' })
  k.box(0.26, 0.05, 0.14, -1.3, 0.17, 0.62, 'wood', { bevel: 0.006 })
  for (const [x, c] of [[-1.36, 'brown'], [-1.25, 'navy']] as const) k.box(0.1, 0.08, 0.1, x, 0.22, 0.62, c, { bevel: 0.01 })
  for (const x of [-0.6, 0.6]) {
    k.cyl(0.06, 0.08, x, 0.11, 0.42, 'terracotta', { seg: 10, rTop: 0.07 })
    k.bush(x, 0.42, 0.08, 'hedge', 'rose', 0.19)
  }
  // Round the back: a taxi rank and a bike rack.
  k.box(0.6, 0.008, 0.3, -0.8, 0.03, -1.0 + 0.05, 'asphalt', { bevel: 0 })
  k.box(0.26, 0.09, 0.14, -0.9, 0.035, -0.95, 'sunny', { bevel: 0.02 })
  k.box(0.14, 0.05, 0.12, -0.92, 0.12, -0.95, 'glassdark', { bevel: 0.01, finish: 'shiny' })
}

function airport(k: Kit) {
  const W = 7
  const D = 3
  const rz = D * 0.23 // the runway's center line (FlightView)
  k.ground(W - 0.05, D - 0.05, 'lawn', 0.03)
  // Runway: asphalt, edge lines, dashed center, piano keys at both ends, lights.
  k.box(W - 0.1, 0.02, 1.2, 0, 0.03, rz, 'asphalt', { bevel: 0.005 })
  for (const s of [-1, 1]) k.box(W - 0.4, 0.004, 0.025, 0, 0.05, rz + s * 0.54, 'white', { bevel: 0 })
  for (let x = -W / 2 + 1.0; x < W / 2 - 0.9; x += 0.42) k.box(0.22, 0.004, 0.03, x, 0.05, rz, 'white', { bevel: 0 })
  for (const end of [-1, 1]) {
    for (let i = 0; i < 6; i++) k.box(0.32, 0.004, 0.06, end * (W / 2 - 0.35), 0.05, rz - 0.4 + i * 0.16, 'white', { bevel: 0 })
    for (let i = 0; i < 5; i++) k.ball(0.022, end * (W / 2 - 0.08), 0.05, rz - 0.4 + i * 0.2, end < 0 ? 'lime' : 'red', { finish: 'glow' })
  }
  for (let x = -W / 2 + 0.3; x < W / 2 - 0.2; x += 0.6) for (const s of [-1, 1]) k.ball(0.016, x, 0.05, rz + s * 0.61, 'sunny', { finish: 'glow' })
  // Apron and taxiway (the second plane waits at x 1.3, z −0.55).
  k.box(3.1, 0.02, 1.25, 1.85, 0.03, -0.82, 'concrete', { bevel: 0.005 })
  k.box(0.5, 0.02, 0.5, 1.3, 0.03, -0.16, 'concrete', { bevel: 0.005 })
  k.box(0.025, 0.004, 1.1, 1.3, 0.052, -0.3, 'sunny', { bevel: 0 })
  k.ring(0.32, 0.01, 1.3, 0.052, -0.68, 'sunny', 'y', { seg: 24, arc: Math.PI })
  // The terminal: a long glass hall under a wave of white roof.
  const tx = -1.9
  const tz = -0.95
  k.box(2.7, 0.06, 0.95, tx, 0.03, tz, 'stonedark', { bevel: 0.01 })
  k.box(2.6, 0.48, 0.8, tx, 0.09, tz, 'snow', { bevel: 0.02 })
  k.box(2.5, 0.34, 0.02, tx, 0.13, tz + 0.405, 'glass', { bevel: 0, finish: 'shiny' })
  for (let i = 0; i <= 12; i++) k.box(0.02, 0.34, 0.03, tx - 1.25 + i * (2.5 / 12), 0.13, tz + 0.41, 'white', { bevel: 0 })
  k.box(2.6, 0.03, 0.03, tx, 0.3, tz + 0.415, 'white', { bevel: 0 })
  k.box(2.7, 0.04, 0.94, tx, 0.55, tz, 'white', { bevel: 0.01 })
  k.prism(Array.from({ length: 13 }, (_, i) => { const a = (i / 12) * Math.PI; return [Math.cos(a) * 0.47, Math.sin(a) * 0.2] as [number, number] }), 2.7, tx, 0.59, tz, 'white', 'x')
  for (let i = 0; i < 5; i++) k.prism(Array.from({ length: 13 }, (_, j) => { const a = (j / 12) * Math.PI; return [Math.cos(a) * 0.49, Math.sin(a) * 0.215] as [number, number] }), 0.03, tx - 1.2 + i * 0.6, 0.585, tz, 'skyblue', 'x')
  k.box(0.5, 0.1, 0.02, tx, 0.47, tz + 0.43, 'blue', { bevel: 0 })
  // A jet bridge reaching out toward the runway.
  k.box(0.14, 0.12, 0.5, tx + 0.7, 0.2, tz + 0.65, 'concrete', { bevel: 0.01 })
  k.box(0.04, 0.2, 0.04, tx + 0.7, 0.03, tz + 0.82, 'charcoal', { bevel: 0 })
  // Control tower.
  const cx = 0.35
  const cz = -1.1
  k.cyl(0.2, 0.08, cx, 0.03, cz, 'stonedark', { seg: 12 })
  k.cyl(0.13, 1.35, cx, 0.11, cz, 'snow', { seg: 12, rTop: 0.1, gradient: true })
  k.cyl(0.22, 0.06, cx, 1.42, cz, 'white', { seg: 8, ry: Math.PI / 8 })
  k.cyl(0.24, 0.2, cx, 1.48, cz, 'glass', { seg: 8, rTop: 0.27, finish: 'shiny', ry: Math.PI / 8 })
  k.cyl(0.29, 0.05, cx, 1.68, cz, 'charcoal', { seg: 8, ry: Math.PI / 8 })
  k.cyl(0.012, 0.3, cx, 1.73, cz, 'steel', { seg: 5 })
  k.ball(0.03, cx, 2.03, cz, 'red', { finish: 'glow' })
  k.box(0.32, 0.36, 0.32, cx, 0.11, cz, 'snow', { bevel: 0.015 })
  // The hangar on the right, its doors open toward the runway.
  const hx = 2.65
  const hz = -0.95
  const arch = (r: number, h: number) => Array.from({ length: 13 }, (_, i) => { const a = (i / 12) * Math.PI; return [Math.cos(a) * r, Math.sin(a) * h] as [number, number] })
  k.box(1.3, 0.04, 0.95, hx, 0.03, hz, 'stonedark', { bevel: 0.01 })
  k.prism(arch(0.62, 0.55), 0.95, hx, 0.05, hz, 'concrete', 'z')
  for (let i = 0; i <= 4; i++) k.prism(arch(0.635, 0.565).concat(arch(0.61, 0.54).reverse()), 0.025, hx, 0.05, hz - 0.46 + i * 0.23, 'steel', 'z')
  k.prism(arch(0.5, 0.45), 0.02, hx, 0.05, hz + 0.48, 'ink', 'z')
  // Fuel truck and a baggage train on the apron.
  k.box(0.32, 0.12, 0.13, 2.35, 0.05, -0.3, 'white', { bevel: 0.02 })
  k.rod(0.07, 0.22, 2.3, 0.21, -0.3, 'pipe', 'x', { seg: 12 })
  k.box(0.1, 0.12, 0.13, 2.53, 0.05, -0.3, 'sunny', { bevel: 0.02 })
  for (const [x, c] of [[2.9, 'blue'], [3.1, 'orange'], [3.3, 'blue']] as const) {
    k.box(0.15, 0.04, 0.11, x, 0.06, -0.35, 'steel', { bevel: 0.006 })
    k.box(0.12, 0.08, 0.09, x, 0.1, -0.35, c, { bevel: 0.015 })
  }
  // Car park and windsock on the left.
  k.box(0.9, 0.012, 0.5, -3.0, 0.03, -0.2, 'asphalt', { bevel: 0 })
  for (const [i, c] of (['red', 'blue', 'white', 'sunny', 'green'] as Paint[]).entries()) {
    const x = -3.35 + i * 0.17
    k.box(0.1, 0.06, 0.18, x, 0.05, -0.2, c, { bevel: 0.02 })
    k.box(0.08, 0.04, 0.09, x, 0.1, -0.21, 'glassdark', { bevel: 0.012, finish: 'shiny' })
  }
  k.cyl(0.012, 0.45, -3.3, 0.03, 0.05, 'white', { seg: 5 })
  k.cyl(0.05, 0.2, -3.2, 0.44, 0.05, 'orange', { seg: 8, rTop: 0.025 })
  for (const [x, z, s] of [[-3.25, -1.25, 0.9], [-0.55, -1.25, 0.8], [3.3, -1.3, 0.85], [-0.75, -0.45, 0.7]]) k.tree(x, z, s)
}

function cargoHangar(k: Kit) {
  k.ground(2.95, 2.95, 'concrete', 0.03)
  // A big barrel-roofed hangar, its orange doors facing the front.
  const hx = -0.2
  const hz = -0.3
  const R = 0.95
  const L = 1.7
  const arch = (r: number, h: number) => Array.from({ length: 17 }, (_, i) => { const a = (i / 16) * Math.PI; return [Math.cos(a) * r, Math.sin(a) * h] as [number, number] })
  k.prism(arch(R, 1.0), L, hx, 0.04, hz, 'concrete', 'z')
  for (let i = 0; i <= 6; i++) {
    const z = hz - L / 2 + (i * L) / 6
    k.prism(arch(R + 0.02, 1.02).concat(arch(R - 0.01, 0.99).reverse()), 0.03, hx, 0.04, z, 'steel', 'z')
  }
  const front = hz + L / 2
  k.prism(arch(R - 0.05, 0.94), 0.03, hx, 0.04, front + 0.01, 'charcoal', 'z')
  for (let i = 0; i < 4; i++) {
    const x = hx - 0.6 + i * 0.4
    const top = Math.sqrt(Math.max(0, 1 - ((x - hx) / (R - 0.1)) ** 2)) * 0.82
    k.box(0.37, Math.max(0.3, top), 0.03, x, 0.04, front + 0.03, 'orange', { bevel: 0.006 })
    for (let j = 1; j < 5; j++) k.box(0.37, 0.012, 0.035, x, 0.04 + j * 0.13, front + 0.035, 'rust', { bevel: 0 })
  }
  k.box(1.2, 0.12, 0.04, hx, 0.88, front + 0.03, 'white', { bevel: 0.01 })
  k.box(0.9, 0.06, 0.02, hx, 0.91, front + 0.05, 'navy', { bevel: 0 })
  // Office on the right side.
  const ox = 1.05
  k.block(0.65, 0.42, 0.7, ox, 0.04, -0.75, { wall: 'snow', top: 'charcoal' })
  k.windows('+z', -0.4, ox - 0.25, ox + 0.25, 0.25, 2, { w: 0.16, h: 0.14 })
  k.windows('+x', ox + 0.325, -1.0, -0.5, 0.25, 2, { w: 0.16, h: 0.14 })
  k.door('+z', -0.4, ox + 0.15, { w: 0.13, h: 0.2, color: 'navy', y: 0.04 })
  k.cyl(0.05, 0.12, ox - 0.2, 0.55, -0.9, 'steel', { seg: 10 })
  // Containers stacked out front, a forklift, apron lines and a windsock.
  const crate = (x: number, y: number, z: number, c: Paint, ry = 0) => {
    k.box(0.6, 0.24, 0.25, x, y, z, c, { bevel: 0.01, ry })
    for (let i = 0; i < 7; i++) k.box(0.012, 0.22, 0.26, x - 0.27 * Math.cos(ry) + i * 0.09 * Math.cos(ry), y + 0.01, z + 0.27 * Math.sin(ry) - i * 0.09 * Math.sin(ry), 'charcoal', { bevel: 0, ry })
  }
  crate(1.0, 0.04, 0.55, 'blue')
  crate(1.0, 0.04, 0.85, 'red')
  crate(1.0, 0.28, 0.7, 'green')
  crate(-1.1, 0.04, 1.1, 'orange', 0)
  k.box(0.18, 0.1, 0.12, 0.3, 0.06, 1.0, 'sunny', { bevel: 0.015 })
  k.box(0.1, 0.12, 0.1, 0.27, 0.16, 1.0, 'charcoal', { bevel: 0.01 })
  k.box(0.02, 0.3, 0.1, 0.4, 0.04, 1.0, 'charcoal', { bevel: 0 })
  k.box(0.1, 0.02, 0.12, 0.47, 0.06, 1.0, 'charcoal', { bevel: 0 })
  for (const s of [-1, 1]) k.box(0.025, 0.004, 1.3, hx + s * 0.75, 0.035, 0.85, 'sunny', { bevel: 0 })
  k.box(1.5, 0.004, 0.025, hx, 0.035, 1.42, 'sunny', { bevel: 0 })
  k.cyl(0.012, 0.6, 1.3, 0.03, -1.3, 'white', { seg: 5 })
  k.cyl(0.05, 0.2, 1.2, 0.58, -1.3, 'orange', { seg: 8, rTop: 0.025 })
}

// ---- Army base: the flag, helipad, watchtower and parade ground sit where
// ArmyView expects them (ARMY_BASE).

function armyBase(k: Kit) {
  const { flag, pad, tower, ground: parade } = ARMY_BASE
  k.ground(2.95, 2.95, 'khaki', 0.03)
  k.box(2.8, 0.01, 2.8, 0, 0.03, 0, '#a7b276', { bevel: 0 })
  // A concrete wall round the back and left, a fence front and right.
  const E = 1.42
  k.box(2.9, 0.18, 0.08, 0, 0.03, -E, 'concrete', { bevel: 0.01 })
  k.box(0.08, 0.18, 2.9, -E, 0.03, 0, 'concrete', { bevel: 0.01 })
  for (let i = 0; i < 6; i++) k.box(0.04, 0.24, 0.04, -1.4 + i * 0.56, 0.03, E, 'steel', { bevel: 0 })
  k.box(1.6, 0.18, 0.006, 0.6, 0.06, E, 'bluegray', { bevel: 0, finish: 'shiny' })
  k.box(2.86, 0.02, 0.02, 0, 0.26, E, 'steel', { bevel: 0 })
  k.box(0.006, 0.18, 2.4, E, 0.06, -0.2, 'bluegray', { bevel: 0, finish: 'shiny' })
  k.box(0.02, 0.02, 2.86, E, 0.26, 0, 'steel', { bevel: 0 })
  for (let i = 0; i < 6; i++) k.box(0.04, 0.24, 0.04, E, 0.03, -1.4 + i * 0.56, 'steel', { bevel: 0 })
  // The gate: a guard hut and a striped barrier at the front left.
  k.box(0.26, 0.3, 0.24, -1.15, 0.03, 1.2, 'snow', { bevel: 0.015 })
  k.box(0.32, 0.04, 0.3, -1.15, 0.33, 1.2, 'olive', { bevel: 0.01 })
  k.window('+z', 1.32, -1.15, 0.15, { w: 0.14, h: 0.1, sill: false })
  for (let i = 0; i < 6; i++) k.box(0.1, 0.03, 0.03, -0.95 + i * 0.1, 0.18, 1.38, i % 2 ? 'white' : 'red', { bevel: 0 })
  // The parade ground, marked out.
  const pw = parade.x1 - parade.x0
  const pd = parade.z1 - parade.z0
  const px = (parade.x0 + parade.x1) / 2
  k.box(pw + 0.12, 0.012, pd + 0.12, px, 0.035, 0, 'asphalt', { bevel: 0 })
  for (const s of [-1, 1]) k.box(pw, 0.004, 0.02, px, 0.048, s * (pd / 2 + 0.03), 'white', { bevel: 0 })
  // Two barracks: quonset huts along the parade ground.
  const hut = (z: number) => {
    const L = 1.6
    const x = -0.35
    const R = 0.3
    k.box(L + 0.06, 0.05, R * 2 + 0.06, x, 0.03, z, 'concrete', { bevel: 0.008 })
    k.prism(Array.from({ length: 13 }, (_, i) => { const a = (i / 12) * Math.PI; return [Math.cos(a) * R, Math.sin(a) * R * 1.05] as [number, number] }), L, x, 0.08, z, 'olive', 'x')
    for (let i = 0; i <= 8; i++) k.ring(R + 0.006, 0.008, x - L / 2 + (i * L) / 8, 0.08, z, '#55613b', 'x', { arc: Math.PI, seg: 12 })
    k.door('+x', x + L / 2, z, { w: 0.14, h: 0.2, color: 'wooddark', frame: 'khaki', y: 0.08, step: false })
    // Windows on the side facing the parade ground.
    const s = z < 0 ? 1 : -1
    for (const dx of [-0.5, -0.1, 0.3]) k.box(0.14, 0.08, 0.03, x + dx, 0.2, z + s * 0.26, 'glassdark', { bevel: 0, finish: 'shiny' })
  }
  hut(-0.85)
  hut(0.85)
  // The flagpole (ArmyView flies the flag) on a stone base.
  k.box(0.22, 0.06, 0.22, flag.x, 0.03, flag.z, 'stone', { bevel: 0.01 })
  k.cyl(0.018, flag.top + 0.05, flag.x, 0.04, flag.z, 'white', { seg: 8 })
  k.ball(0.03, flag.x, flag.top + 0.1, flag.z, 'gold')
  // Helipad.
  k.cyl(0.38, 0.015, pad.x, 0.03, pad.z, 'asphalt', { seg: 28 })
  k.ring(0.33, 0.012, pad.x, 0.047, pad.z, 'sunny', 'y', { seg: 28 })
  for (const dz of [-0.1, 0.1]) k.box(0.04, 0.004, 0.22, pad.x + dz, 0.05, pad.z, 'white', { bevel: 0 })
  k.box(0.2, 0.004, 0.04, pad.x, 0.05, pad.z, 'white', { bevel: 0 })
  // The watchtower: four legs, a deck at the sentry's floor, a hut on top.
  for (const [dx, dz] of [[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13]]) k.strut([tower.x + dx * 1.25, 0.03, tower.z + dz * 1.25], [tower.x + dx, tower.floor, tower.z + dz], 0.022, 'wooddark')
  for (const y of [0.4, 0.75]) {
    k.strut([tower.x - 0.15, y, tower.z + 0.15], [tower.x + 0.15, y + 0.2, tower.z + 0.15], 0.01, 'wood')
    k.strut([tower.x + 0.15, y, tower.z - 0.15], [tower.x + 0.15, y + 0.2, tower.z + 0.15], 0.01, 'wood')
  }
  k.box(0.38, 0.03, 0.38, tower.x, tower.floor - 0.03, tower.z, 'wood', { bevel: 0.006 })
  for (const s of [-1, 1]) {
    k.box(0.38, 0.1, 0.025, tower.x, tower.floor, tower.z + s * 0.18, 'olive', { bevel: 0 })
    k.box(0.025, 0.1, 0.38, tower.x + s * 0.18, tower.floor, tower.z, 'olive', { bevel: 0 })
  }
  for (const [dx, dz] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) k.box(0.025, 0.28, 0.025, tower.x + dx, tower.floor, tower.z + dz, 'wooddark', { bevel: 0 })
  k.cyl(0.32, 0.14, tower.x, tower.floor + 0.28, tower.z, '#55613b', { seg: 4, rTop: 0.02, ry: Math.PI / 4 })
  k.cyl(0.03, 0.04, tower.x + 0.12, tower.floor + 0.25, tower.z + 0.12, 'light', { seg: 6, finish: 'glow' })
  // Sandbags, crates and a jeep.
  for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) k.box(0.12, 0.05, 0.07, 0.15 + i * 0.1 + j * 0.05, 0.03 + j * 0.05, -0.45, 'khaki', { bevel: 0.02 })
  for (const [x, z, y] of [[-1.25, -0.2, 0.03], [-1.25, 0.05, 0.03], [-1.25, -0.08, 0.15]]) k.box(0.13, 0.12, 0.13, x, y, z, '#7a6a3a', { bevel: 0.01 })
  k.box(0.32, 0.1, 0.18, 0.4, 0.06, 0.5, '#55613b', { bevel: 0.02 })
  k.box(0.14, 0.08, 0.16, 0.36, 0.16, 0.5, '#55613b', { bevel: 0.015 })
  k.box(0.02, 0.07, 0.16, 0.45, 0.16, 0.5, 'glassdark', { bevel: 0, finish: 'shiny' })
  for (const [dx, dz] of [[-0.1, -0.1], [0.1, -0.1], [-0.1, 0.1], [0.1, 0.1]]) k.rod(0.04, 0.03, 0.4 + dx, 0.07, 0.5 + dz, 'tyre', 'z', { seg: 10 })
}

// ---- Utilities

function solarFarm(k: Kit) {
  k.ground(2.95, 2.95, 'stonedark', 0.03)
  k.box(2.8, 0.008, 2.8, 0, 0.03, 0, '#b9b4a6', { bevel: 0 })
  // Three rows of panels on frames, facing the front.
  for (const rz of [-0.95, -0.1, 0.75]) {
    for (const x of [-1.05, 0, 1.05]) {
      for (const dx of [-0.4, 0, 0.4]) k.box(0.03, 0.3, 0.03, x + dx, 0.03, rz - 0.12, 'steel', { bevel: 0 })
      for (const dx of [-0.4, 0, 0.4]) k.box(0.03, 0.14, 0.03, x + dx, 0.03, rz + 0.18, 'steel', { bevel: 0 })
      k.slope([rz - 0.27, 0.42], [rz + 0.27, 0.16], 1.0, x, 0, 0, 'pipe', 'x', { thick: 0.02 })
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
        const t0 = j * 0.5 + 0.02
        const t1 = j * 0.5 + 0.48
        const a: [number, number] = [rz - 0.27 + 0.54 * t0, 0.42 - 0.26 * t0 + 0.022]
        const b: [number, number] = [rz - 0.27 + 0.54 * t1, 0.42 - 0.26 * t1 + 0.022]
        k.slope(a, b, 0.23, x - 0.375 + i * 0.25, 0, 0, 'solar', 'x', { thick: 0.01 })
      }
    }
  }
  // A control hut with an inverter, gravel paths and a chain-link fence.
  k.block(0.5, 0.32, 0.36, 1.1, 0.03, 1.2, { wall: 'snow', top: 'charcoal' })
  k.door('+z', 1.38, 1.15, { w: 0.12, h: 0.2, color: 'steel', y: 0.03 })
  k.box(0.14, 0.18, 0.1, 0.7, 0.03, 1.25, 'steel', { bevel: 0.01 })
  k.box(0.06, 0.03, 0.01, 0.7, 0.16, 1.305, 'lime', { bevel: 0, finish: 'glow' })
  const E = 1.44
  for (const [a, b, c, d] of [[-E, -E, E, -E], [-E, -E, -E, E], [E, -E, E, 0.9], [-E, E, 0.6, E]] as const) {
    const len = Math.hypot(c - a, d - b)
    const ry = Math.atan2(-(d - b), c - a)
    k.box(len, 0.2, 0.006, (a + c) / 2, 0.04, (b + d) / 2, 'bluegray', { bevel: 0, ry, finish: 'shiny' })
    k.box(len, 0.015, 0.015, (a + c) / 2, 0.24, (b + d) / 2, 'steel', { bevel: 0, ry })
    const n = Math.round(len / 0.45)
    for (let i = 0; i <= n; i++) k.box(0.025, 0.26, 0.025, a + ((c - a) * i) / n, 0.03, b + ((d - b) * i) / n, 'steel', { bevel: 0 })
  }
  k.bush(-1.25, 1.25, 0.1, 'hedge', 'sunny')
  k.bush(1.3, -1.25, 0.09, 'hedge')
}

// ---- The Ski Resort: the mountain is the cone the skiers ride on
// (SKI_SLOPE, slopeHeight), the lift towers stand on its line (SKI_LIFT),
// and nothing stands on the runs down its front.

function skiResort(k: Kit) {
  const { cx, cz, height, radius } = SKI_SLOPE
  k.ground(3.95, 3.95, 'snow', 0.03)
  k.cyl(radius, height, cx, 0.03, cz, 'snow', { rTop: 0, seg: 32, gradient: true })
  // Rocky outcrops and pines on its back and sides, away from the runs.
  const on = (a: number, f: number): [number, number, number] => {
    const x = cx + Math.cos(a) * radius * f
    const z = cz + Math.sin(a) * radius * f
    return [x, slopeHeight(x, z), z]
  }
  for (const [a, f, r] of [[2.3, 0.45, 0.16], [2.9, 0.3, 0.14], [3.6, 0.55, 0.18], [4.3, 0.35, 0.15], [5.0, 0.5, 0.17], [5.6, 0.62, 0.12], [2.6, 0.7, 0.12], [4.0, 0.75, 0.14]]) {
    const [x, y, z] = on(a, f)
    k.ball(r, x, y - r * 0.2, z, 'stonedark', { lumpy: true, sy: 0.55 })
    k.ball(r * 0.6, x, y + r * 0.1, z, 'snow', { lumpy: true, sy: 0.4 })
  }
  for (const [a, f, s] of [[2.0, 0.85, 0.85], [2.4, 0.8, 1], [2.9, 0.78, 0.9], [3.3, 0.8, 1.0], [3.8, 0.78, 0.95], [4.4, 0.8, 1], [4.8, 0.8, 0.9], [5.3, 0.82, 1], [5.8, 0.85, 0.85], [2.7, 0.55, 0.7], [4.6, 0.58, 0.75]]) {
    const [x, y, z] = on(a, f)
    k.pine(x, z, s, { y: y - 0.04, snow: true })
  }
  for (const [x, z, s] of [[-1.8, 1.0, 1], [-1.6, 1.6, 0.9], [-1.85, 0.4, 0.8], [1.7, -1.6, 1], [1.2, -1.8, 0.85], [1.85, -0.9, 0.9], [-0.4, 1.8, 0.8]]) k.pine(x, z, s, { snow: true })
  // A flag on the peak.
  k.cyl(0.012, 0.3, cx, height + 0.02, cz, 'charcoal', { seg: 5 })
  k.box(0.14, 0.08, 0.008, cx + 0.07, height + 0.22, cz, 'red', { bevel: 0 })
  // The chairlift: five towers along the line, a station at each end.
  for (let i = 0; i <= 4; i++) {
    const t = i / 4
    const x = SKI_LIFT.from.x + (SKI_LIFT.to.x - SKI_LIFT.from.x) * t
    const z = SKI_LIFT.from.z + (SKI_LIFT.to.z - SKI_LIFT.from.z) * t
    const y = slopeHeight(x, z)
    k.cyl(0.03, 0.04, x, y - 0.02, z, 'concrete', { seg: 8 })
    k.cyl(0.018, 0.45, x, y, z, 'steel', { seg: 6, rTop: 0.014 })
    const ry = Math.atan2(-(SKI_LIFT.to.z - SKI_LIFT.from.z), SKI_LIFT.to.x - SKI_LIFT.from.x) + Math.PI / 2
    k.box(0.22, 0.025, 0.03, x, y + 0.44, z, 'steel', { bevel: 0, ry })
  }
  const station = (x: number, z: number, roof: Paint) => {
    const y = slopeHeight(x, z) - 0.04
    k.box(0.3, 0.2, 0.26, x, y, z, 'wood', { bevel: 0.012 })
    k.gableRoof(0.3, 0.26, 0.12, x, y + 0.2, z, roof, 'wood', { overhang: 0.05, thick: 0.03 })
    k.box(0.3, 0.02, 0.3, x, y + 0.36, z, 'snow', { bevel: 0.008 })
    k.rod(0.07, 0.03, x, y + 0.42, z, 'charcoal', 'z', { seg: 14 })
  }
  station(SKI_LIFT.from.x + 0.15, SKI_LIFT.from.z + 0.12, 'red')
  station(SKI_LIFT.to.x - 0.12, SKI_LIFT.to.z - 0.1, 'red')
  // The lodge at the foot: a wooden chalet with a snowy roof and a balcony.
  const lx = 1.35
  const lz = 1.35
  k.box(0.86, 0.06, 0.66, lx, 0.03, lz, 'stonedark', { bevel: 0.01 })
  k.box(0.8, 0.3, 0.6, lx, 0.09, lz, 'stone', { bevel: 0.015 })
  k.box(0.8, 0.24, 0.6, lx, 0.39, lz, 'wood', { bevel: 0.015 })
  k.gableRoof(0.8, 0.6, 0.34, lx, 0.63, lz, 'brickdark', 'wood', { ridge: 'z', overhang: 0.09, thick: 0.04 })
  k.gableRoof(0.82, 0.62, 0.34, lx, 0.67, lz, 'snow', 'wood', { ridge: 'z', overhang: 0.09, thick: 0.03 })
  k.door('+z', lz + 0.3, lx, { w: 0.16, h: 0.24, color: 'darkwood', y: 0.09 })
  for (const u of [lx - 0.25, lx + 0.25]) k.window('+z', lz + 0.3, u, 0.17, { w: 0.14, h: 0.14, glass: 'light', shutters: 'red' })
  k.windows('+x', lx + 0.4, lz - 0.2, lz + 0.2, 0.17, 2, { w: 0.14, h: 0.14, glass: 'light', shutters: 'red' })
  k.window('+z', lz + 0.3, lx, 0.45, { w: 0.18, h: 0.16, glass: 'light' })
  k.box(0.7, 0.03, 0.14, lx, 0.38, lz + 0.37, 'lightwood', { bevel: 0.006 })
  for (let i = 0; i <= 8; i++) k.box(0.015, 0.1, 0.015, lx - 0.34 + i * 0.085, 0.41, lz + 0.43, 'lightwood', { bevel: 0 })
  k.box(0.7, 0.02, 0.02, lx, 0.5, lz + 0.43, 'lightwood', { bevel: 0 })
  k.box(0.12, 0.42, 0.12, lx - 0.22, 0.6, lz - 0.1, 'stone', { bevel: 0.012 })
  k.box(0.14, 0.03, 0.14, lx - 0.22, 1.02, lz - 0.1, 'snow', { bevel: 0.01 })
  // Skis in a rack, a snowman, and a sledge.
  for (let i = 0; i < 4; i++) k.box(0.025, 0.3, 0.012, lx + 0.5, 0.03, lz - 0.2 + i * 0.06, (['red', 'blue', 'sunny', 'lime'] as Paint[])[i], { bevel: 0, ry: 0.1 })
  k.box(0.04, 0.03, 0.26, lx + 0.5, 0.25, lz - 0.11, 'wooddark', { bevel: 0 })
  const sx = 0.55
  const sz = 1.6
  k.ball(0.11, sx, 0.12, sz, 'snow')
  k.ball(0.08, sx, 0.28, sz, 'snow')
  k.ball(0.06, sx, 0.4, sz, 'snow')
  k.cyl(0.012, 0.06, sx, 0.4, sz + 0.06, 'orange', { seg: 6, rTop: 0 , ry: 0})
  k.cyl(0.05, 0.05, sx, 0.44, sz, 'charcoal', { seg: 10 })
  k.box(0.14, 0.03, 0.04, sx, 0.32, sz + 0.03, 'red', { bevel: 0 })
}

// ---- Farm workshops and orchards

function bakehouse(k: Kit) {
  k.ground(1.92, 1.92, 'lawn', 0.03)
  k.box(1.6, 0.012, 0.5, 0.05, 0.03, 0.62, 'path', { bevel: 0 })
  // A butter-yellow cottage with timber framing and a steep roof.
  const x0 = -0.05
  const z0 = -0.2
  const W = 1.3
  const D = 0.9
  k.box(W + 0.05, 0.06, D + 0.05, x0, 0.03, z0, 'stonedark', { bevel: 0.01 })
  k.box(W, 0.5, D, x0, 0.09, z0, 'butter', { bevel: 0.018 })
  for (const u of [-0.62, -0.2, 0.2, 0.62]) k.onFace('+z', z0 + D / 2, x0 + u, 0.09, 0.04, 0.5, 0.02, 'wooddark', { bevel: 0 })
  k.onFace('+z', z0 + D / 2, x0, 0.36, W, 0.035, 0.02, 'wooddark', { bevel: 0 })
  k.gableRoof(W, D, 0.38, x0, 0.59, z0, 'roofred', 'butter', { overhang: 0.08 })
  const front = z0 + D / 2
  // A shop window under a striped awning, the door, a loaf on the sign.
  k.window('+z', front, x0 - 0.38, 0.14, { w: 0.42, h: 0.2, frame: 'white', panes: false })
  for (const dx of [-0.12, 0, 0.12]) k.cyl(0.035, 0.05, x0 - 0.38 + dx, 0.17, front + 0.03, 'lightwood', { seg: 8, sx: 1.6 })
  k.awning('+z', front, x0 - 0.38, 0.4, 0.5, ['red', 'white'], { depth: 0.2, drop: 0.08 })
  k.door('+z', front, x0 + 0.2, { w: 0.18, h: 0.3, color: 'roofred', y: 0.09, glass: true })
  k.window('+z', front, x0 + 0.5, 0.2, { w: 0.15, h: 0.15, box: 'wooddark' })
  k.onFace('+z', front, x0, 0.66, 0.36, 0.12, 0.03, 'wooddark')
  k.ball(0.05, x0, 0.72, front + 0.05, 'lightwood', { sx: 2, sy: 0.8 })
  k.windows('+x', x0 + W / 2, z0 - 0.25, z0 + 0.25, 0.25, 2, { w: 0.15, h: 0.16, box: 'wooddark' })
  // The brick bread oven on the side, its chimney smoking.
  const ox = x0 + W / 2 + 0.16
  k.box(0.28, 0.3, 0.4, ox, 0.03, z0 - 0.15, 'brick', { bevel: 0.02 })
  k.ball(0.17, ox, 0.33, z0 - 0.15, 'brick', { sy: 0.6, sz: 1.2 })
  k.ring(0.08, 0.02, ox + 0.14, 0.14, z0 - 0.15, 'stone', 'x', { arc: Math.PI, seg: 8 })
  k.box(0.14, 0.75, 0.14, x0 - 0.4, 0.55, z0 - 0.2, 'brick', { bevel: 0.01 })
  k.box(0.18, 0.04, 0.18, x0 - 0.4, 1.3, z0 - 0.2, 'stonedark', { bevel: 0.006 })
  // A bench of loaves, flour sacks and flowers.
  k.box(0.44, 0.12, 0.18, -0.5, 0.03, 0.62, 'wood', { bevel: 0.01 })
  for (const [i, x] of [-0.64, -0.5, -0.36].entries()) k.ball(0.045, x, 0.18, 0.62 + (i % 2) * 0.03, 'lightwood', { sx: 1.7, sy: 0.75 })
  for (const [x, z] of [[0.55, 0.45], [0.66, 0.5]]) k.ball(0.07, x, 0.08, z, 'snow', { sy: 1.2 })
  k.bush(0.75, -0.75, 0.1, 'hedge', 'rose')
  k.bush(-0.8, 0.25, 0.09, 'hedge', 'sunny')
}

function dairy(k: Kit) {
  k.ground(1.92, 1.92, 'lawn', 0.03)
  k.box(1.0, 0.012, 0.5, -0.3, 0.03, 0.62, 'path', { bevel: 0 })
  // A white creamery with a blue roof and trim.
  const x0 = -0.3
  const z0 = -0.18
  const W = 1.15
  const D = 0.9
  k.box(W + 0.05, 0.06, D + 0.05, x0, 0.03, z0, 'stonedark', { bevel: 0.01 })
  k.box(W, 0.48, D, x0, 0.09, z0, 'snow', { bevel: 0.018 })
  k.trim(W, D, 0.3, 'blue', { h: 0.03, out: 0.012, x: x0, z: z0 })
  k.gableRoof(W, D, 0.32, x0, 0.57, z0, 'roofblue', 'snow', { overhang: 0.08 })
  const front = z0 + D / 2
  k.door('+z', front, x0 + 0.2, { w: 0.28, h: 0.32, color: 'blue', y: 0.09 })
  k.window('+z', front, x0 - 0.3, 0.17, { w: 0.22, h: 0.18, shutters: 'blue' })
  k.windows('+x', x0 + W / 2, z0 - 0.25, z0 + 0.25, 0.17, 2, { w: 0.16, h: 0.18, shutters: 'blue' })
  // A cheese-wheel sign on the gable.
  k.rod(0.1, 0.04, x0, 0.66, front + 0.03, 'sunny', 'z', { seg: 16 })
  k.cyl(0.1, 0.045, x0, 0.66 - 0.0, front + 0.03, 'gold', { seg: 16, arc: Math.PI / 3, start: Math.PI / 2 })
  // The steel milk tank on legs, and a pipe into the creamery.
  const tx = 0.6
  const tz = -0.35
  for (const [dx, dz] of [[-0.15, -0.12], [0.15, -0.12], [-0.15, 0.12], [0.15, 0.12]]) k.box(0.035, 0.22, 0.035, tx + dx, 0.03, tz + dz, 'steel', { bevel: 0 })
  k.rod(0.2, 0.55, tx, 0.42, tz, 'pipe', 'z', { seg: 18 })
  for (const s of [-1, 1]) k.ball(0.2, tx, 0.42, tz + s * 0.27, 'pipe', { sz: 0.35 })
  k.strut([tx - 0.2, 0.45, tz], [x0 + W / 2, 0.45, tz], 0.025, 'steel')
  k.cyl(0.05, 0.06, tx, 0.62, tz, 'steel', { seg: 10 })
  // Churns, a crate of bottles and a little milk float.
  for (const [x, z] of [[0.2, 0.55], [0.34, 0.6], [0.27, 0.42]]) {
    k.cyl(0.06, 0.14, x, 0.03, z, 'pipe', { seg: 10, rTop: 0.045 })
    k.cyl(0.04, 0.04, x, 0.17, z, 'pipe', { seg: 10 })
  }
  k.box(0.32, 0.14, 0.18, 0.7, 0.07, 0.55, 'snow', { bevel: 0.02 })
  k.box(0.12, 0.12, 0.18, 0.88, 0.07, 0.55, 'blue', { bevel: 0.02 })
  k.box(0.11, 0.06, 0.16, 0.9, 0.13, 0.55, 'glass', { bevel: 0.01, finish: 'shiny' })
  for (const [dx, dz] of [[0.6, 0.47], [0.85, 0.47], [0.6, 0.63], [0.85, 0.63]]) k.rod(0.04, 0.03, dx, 0.07, dz, 'tyre', 'z', { seg: 10 })
  k.bush(-0.85, 0.5, 0.1, 'hedge', 'white')
  k.bush(0.85, -0.85, 0.1, 'hedge')
}

function winery(k: Kit) {
  k.ground(2.92, 1.92, 'lawn', 0.03)
  // A stone cellar house with a terracotta roof and an arched door.
  const x0 = -0.6
  const z0 = -0.25
  const W = 1.5
  const D = 0.95
  k.box(W + 0.05, 0.06, D + 0.05, x0, 0.03, z0, 'stonedark', { bevel: 0.01 })
  k.box(W, 0.58, D, x0, 0.09, z0, 'stone', { bevel: 0.02, gradient: true })
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.08, 0.58, 0.08, x0 + sx * (W / 2 - 0.02), 0.09, z0 + sz * (D / 2 - 0.02), 'stonedark', { bevel: 0.01 })
  k.gableRoof(W, D, 0.34, x0, 0.67, z0, 'terracotta', 'stone', { overhang: 0.09 })
  const front = z0 + D / 2
  k.onFace('+z', front, x0, 0.09, 0.36, 0.32, 0.03, 'stonedark')
  k.onFace('+z', front + 0.01, x0, 0.09, 0.3, 0.29, 0.02, 'darkwood', { bevel: 0 })
  k.ring(0.15, 0.03, x0, 0.38, front + 0.015, 'stonedark', 'z', { arc: Math.PI, seg: 12 })
  k.cyl(0.15, 0.02, x0, 0.38, front + 0.01, 'darkwood', { seg: 12 })
  for (const u of [-0.5, 0.5]) k.window('+z', front, x0 + u, 0.25, { w: 0.18, h: 0.22, shutters: 'purple', box: 'wooddark' })
  k.windows('+x', x0 + W / 2, z0 - 0.25, z0 + 0.25, 0.25, 2, { w: 0.16, h: 0.22, shutters: 'purple' })
  // A little bell cote on the ridge, and a grape sign.
  k.box(0.14, 0.18, 0.14, x0 + 0.45, 1.0, z0, 'stone', { bevel: 0.01 })
  k.cyl(0.13, 0.1, x0 + 0.45, 1.18, z0, 'terracotta', { seg: 4, rTop: 0, ry: Math.PI / 4 })
  for (const [dx, dy] of [[0, 0], [-0.03, -0.04], [0.03, -0.04], [0, -0.08], [-0.015, -0.11], [0.015, -0.11]]) k.ball(0.022, x0 + dx, 0.82 + dy, front + 0.06, 'purple')
  // Barrels: a stack on their sides, two upright.
  const barrel = (x: number, y: number, z: number) => {
    k.rod(0.11, 0.24, x, y + 0.11, z, 'wood', 'z', { seg: 14 })
    for (const dz of [-0.08, 0.08]) k.ring(0.112, 0.008, x, y + 0.11, z + dz, 'charcoal', 'z', { seg: 14 })
  }
  barrel(0.35, 0.03, 0.55)
  barrel(0.58, 0.03, 0.55)
  barrel(0.465, 0.23, 0.55)
  for (const x of [0.2, -0.05]) {
    k.cyl(0.1, 0.24, x - 0.0, 0.03, -0.0 + 0.62 + (x < 0 ? 0.05 : 0.15), 'wood', { seg: 14 })
  }
  // Rows of vines on trellises to the right, heavy with grapes.
  for (let r = 0; r < 3; r++) {
    const z = -0.7 + r * 0.38
    k.box(0.016, 0.02, 0.016, 0, 0, 0, 'wood', { bevel: 0 })
    for (const x of [0.35, 0.8, 1.25]) k.box(0.03, 0.34, 0.03, x, 0.03, z, 'wood', { bevel: 0 })
    k.box(0.95, 0.012, 0.012, 0.8, 0.32, z, 'wood', { bevel: 0 })
    for (let i = 0; i < 6; i++) {
      const x = 0.4 + i * 0.16
      k.ball(0.075, x, 0.22, z, i % 2 ? 'foliage' : 'leaf', { lumpy: true, sy: 1.2 })
      k.ball(0.028, x + 0.02, 0.15, z + 0.06, 'purple')
      k.ball(0.022, x - 0.02, 0.13, z + 0.06, 'violet')
    }
    k.box(1.0, 0.01, 0.12, 0.8, 0.03, z, 'soil', { bevel: 0 })
  }
  k.box(0.2, 0.1, 0.14, 1.2, 0.03, 0.55, 'lightwood', { bevel: 0.01 })
  for (const dx of [-0.05, 0.05]) k.ball(0.035, 1.2 + dx, 0.15, 0.55, 'purple', { lumpy: true })
  k.bush(-1.3, 0.6, 0.11, 'hedge', 'violet')
}

function farmersMarket(k: Kit) {
  k.ground(2.92, 1.92, 'path', 0.03)
  for (let i = 0; i < 6; i++) k.box(0.45, 0.004, 1.85, -1.2 + i * 0.48, 0.032, 0, i % 2 ? 'sand' : 'path', { bevel: 0 })
  // Three stalls with striped awnings and crates of produce.
  const produce: Paint[][] = [['red', 'orange', 'lime'], ['sunny', 'purple', 'coral'], ['green', 'red', 'orange']]
  const cloths: [Paint, Paint][] = [['red', 'white'], ['green', 'white'], ['blue', 'white']]
  for (let s = 0; s < 3; s++) {
    const x = -0.95 + s * 0.95
    const z = -0.15
    for (const px of [-0.38, 0.38]) for (const pz of [-0.25, 0.25]) k.box(0.035, pz < 0 ? 0.7 : 0.58, 0.035, x + px, 0.03, z + pz, 'wood', { bevel: 0 })
    k.box(0.8, 0.24, 0.36, x, 0.03, z + 0.08, 'wood', { bevel: 0.012 })
    k.box(0.84, 0.03, 0.4, x, 0.27, z + 0.08, 'lightwood', { bevel: 0.006 })
    for (let c = 0; c < 3; c++) {
      const cx = x - 0.25 + c * 0.25
      k.box(0.22, 0.06, 0.24, cx, 0.3, z + 0.08, 'lightwood', { bevel: 0.006 })
      for (const [ox, oz] of [[-0.05, -0.05], [0.05, -0.05], [0, 0.04], [-0.06, 0.06], [0.06, 0.06], [0, -0.01]]) k.ball(0.038, cx + ox, 0.36, z + 0.08 + oz, produce[s][c])
    }
    // Awning: stripes sloping down to the front.
    for (let i = 0; i < 6; i++) k.slope([z - 0.33, 0.76], [z + 0.36, 0.6], 0.15, x - 0.375 + i * 0.15, 0, 0, cloths[s][i % 2], 'x', { thick: 0.02 })
    for (let i = 0; i < 6; i++) k.box(0.13, 0.06, 0.015, x - 0.375 + i * 0.15, 0.55, z + 0.37, cloths[s][i % 2], { bevel: 0 })
    // Baskets on the ground.
    k.cyl(0.07, 0.07, x + 0.28, 0.03, z + 0.42, 'lightwood', { seg: 10, rTop: 0.085 })
    k.ball(0.05, x + 0.28, 0.1, z + 0.42, produce[s][(s + 1) % 3], { lumpy: true })
  }
  // A string of bunting flags along the front.
  for (let i = 0; i < 16; i++) {
    const x = -1.35 + i * 0.18
    const sag = 0.08 * Math.sin(((i % 8) / 8) * Math.PI)
    k.cyl(0.04, 0.07, x, 0.66 - sag, 0.32, (['red', 'sunny', 'blue', 'green'] as Paint[])[i % 4], { seg: 3, rTop: 0, ry: Math.PI })
  }
  // A chalkboard sign, a hay bale seat, flowers in buckets.
  k.box(0.04, 0.5, 0.04, 1.3, 0.03, 0.72, 'wood', { bevel: 0 })
  k.box(0.38, 0.22, 0.04, 1.3, 0.38, 0.74, 'green', { bevel: 0.012 })
  k.box(0.3, 0.14, 0.01, 1.3, 0.42, 0.765, 'charcoal', { bevel: 0 })
  k.box(0.26, 0.12, 0.16, -1.15, 0.03, 0.6, 'hay', { bevel: 0.025, gradient: true })
  for (const [x, c] of [[-0.55, 'rose'], [-0.4, 'sunny'], [-0.25, 'violet']] as const) {
    k.cyl(0.05, 0.08, x, 0.03, 0.6, 'steel', { seg: 10, rTop: 0.06 })
    k.bush(x, 0.6, 0.06, 'foliage', c, 0.08)
  }
  k.tree(1.25, -0.6, 0.85)
}

function tractorShed(k: Kit) {
  k.ground(1.92, 1.92, 'path', 0.03)
  k.box(0.7, 0.008, 0.7, -0.1, 0.03, 0.6, 'stonedark', { bevel: 0 })
  // An open-fronted red shed (the tractor parks inside at its middle).
  const x0 = -0.1
  const z0 = -0.22
  const W = 1.5
  const D = 1.0
  k.box(W, 0.72, 0.06, x0, 0.03, z0 - D / 2 + 0.03, 'barnred', { bevel: 0.012 })
  for (const s of [-1, 1]) k.box(0.06, 0.72, D, x0 + s * (W / 2 - 0.03), 0.03, z0, 'barnred', { bevel: 0.012 })
  for (const s of [-1, 1]) {
    k.box(0.07, 0.72, 0.07, x0 + s * (W / 2 - 0.03), 0.03, z0 + D / 2, 'white', { bevel: 0.008 })
    k.strut([x0 + s * (W / 2 - 0.03), 0.4, z0 + D / 2 - 0.04], [x0 + s * (W / 2 - 0.28), 0.72, z0 + D / 2 - 0.04], 0.018, 'white')
  }
  k.box(W, 0.07, 0.07, x0, 0.72, z0 + D / 2, 'white', { bevel: 0.008 })
  k.gableRoof(W, D, 0.3, x0, 0.75, z0, 'roofgray', 'barnred', { overhang: 0.08 })
  k.window('+x', x0 + W / 2, z0, 0.35, { w: 0.2, h: 0.18, frame: 'white', glass: 'glassdark' })
  // Inside: a workbench and tools on the back wall.
  k.box(0.4, 0.2, 0.14, x0 - 0.45, 0.03, z0 - D / 2 + 0.13, 'wood', { bevel: 0.01 })
  for (const dx of [0.3, 0.42, 0.54]) k.box(0.02, 0.24, 0.01, x0 + dx, 0.3, z0 - D / 2 + 0.07, 'steel', { bevel: 0 })
  // Hay bales, a fuel drum and a wheelbarrow beside it.
  for (const [z, y] of [[-0.5, 0.03], [-0.1, 0.03], [-0.3, 0.33]]) k.rod(0.15, 0.22, 0.8, y + 0.15, z, 'hay', 'x', { seg: 14 })
  k.cyl(0.09, 0.26, 0.8, 0.03, 0.4, 'red', { seg: 12 })
  k.ring(0.09, 0.008, 0.8, 0.12, 0.4, 'charcoal', 'y', { seg: 12 })
  k.box(0.14, 0.06, 0.22, -0.8, 0.08, 0.55, 'green', { bevel: 0.015, ry: 0.3 })
  k.rod(0.04, 0.02, -0.78, 0.06, 0.68, 'tyre', 'x', { seg: 10 })
  k.bush(0.82, 0.8, 0.09, 'hedge', 'sunny')
}

function orchard(fruit: Paint): Builder {
  return (k) => {
    k.ground(1.95, 1.95, 'lawn', 0.03)
    // Four fruit trees in rows, mown grass between, a ladder and baskets.
    for (const [i, [x, z]] of ([[-0.48, -0.5], [0.5, -0.45], [-0.5, 0.45], [0.46, 0.52]] as [number, number][]).entries()) {
      k.disc(0.3, 0.008, x, 0.03, z, 'turf', { seg: 16 })
      k.tree(x, z, 1.05 + (i % 2) * 0.1, 'foliage', { fruit })
    }
    k.strut([0.2, 0.03, -0.35], [0.36, 0.48, -0.45], 0.012, 'lightwood')
    k.strut([0.28, 0.03, -0.3], [0.44, 0.48, -0.4], 0.012, 'lightwood')
    for (let i = 1; i < 6; i++) {
      const t = i / 6
      k.strut([0.2 + 0.16 * t, 0.03 + 0.45 * t, -0.35 - 0.1 * t], [0.28 + 0.16 * t, 0.03 + 0.45 * t, -0.3 - 0.1 * t], 0.007, 'lightwood')
    }
    for (const [x, z] of [[0.0, 0.05], [0.15, 0.12], [-0.1, -0.1]]) {
      k.cyl(0.08, 0.08, x, 0.03, z, 'lightwood', { seg: 10, rTop: 0.095 })
      for (const [dx, dz] of [[-0.03, 0], [0.03, 0.01], [0, -0.03], [0, 0.03]]) k.ball(0.035, x + dx, 0.12, z + dz, fruit)
    }
    k.rails(-0.92, 0.92, 0.92, 0.92, 'lightwood', { h: 0.12 })
  }
}

// ---- Festival prizes

function blossomArch(k: Kit) {
  k.box(1.9, 0.012, 0.5, 0, 0, 0, 'lawn', { bevel: 0 })
  k.box(0.5, 0.014, 0.5, 0, 0.01, 0, 'path', { bevel: 0 })
  for (const s of [-1, 1]) {
    k.box(0.1, 0.75, 0.1, s * 0.62, 0, 0, 'white', { bevel: 0.012 })
    k.box(0.14, 0.05, 0.14, s * 0.62, 0, 0, 'stone', { bevel: 0.01 })
    k.bush(s * 0.78, 0.05, 0.13, 'hedge', 'rose')
    k.bush(s * 0.45, 0.12, 0.08, 'hedge', 'white')
  }
  k.ring(0.62, 0.05, 0, 0.75, 0, 'white', 'z', { arc: Math.PI, seg: 20 })
  for (let i = 0; i <= 14; i++) {
    const a = (i / 14) * Math.PI
    const x = Math.cos(a) * 0.62
    const y = 0.75 + Math.sin(a) * 0.62
    k.ball(0.09, x, y, (i % 2) * 0.04 - 0.02, i % 3 ? 'rose' : '#ffd6e5', { lumpy: true })
    if (i % 2) k.ball(0.06, x * 1.05, y + 0.04, 0.06, 'pink', { lumpy: true })
  }
  for (let i = 0; i < 8; i++) {
    const s = i < 4 ? -1 : 1
    k.ball(0.06, s * 0.62 + (i % 2 ? 0.05 : -0.05), 0.2 + (i % 4) * 0.15, 0.06, i % 2 ? 'rose' : 'foliage', { lumpy: true })
  }
}

function iceCreamCart(k: Kit) {
  k.box(0.9, 0.015, 0.9, 0, 0, 0, 'path', { bevel: 0 })
  for (const s of [-1, 1]) {
    k.rod(0.11, 0.03, s * 0.2, 0.12, 0.2, 'white', 'z', { seg: 16 })
    k.ring(0.11, 0.015, s * 0.2, 0.12, 0.215, 'tyre', 'z', { seg: 16 })
  }
  k.box(0.6, 0.32, 0.36, 0, 0.1, 0, 'paleblue', { bevel: 0.03, gradient: true })
  k.box(0.6, 0.04, 0.37, 0, 0.26, 0, 'pink', { bevel: 0.01 })
  k.box(0.62, 0.03, 0.38, 0, 0.42, 0, 'white', { bevel: 0.01 })
  for (const [x, c] of [[-0.18, 'pink'], [0, 'cream'], [0.18, 'brown']] as const) k.ball(0.06, x, 0.46, 0.05, c, { sy: 0.7 })
  k.strut([0.3, 0.3, 0], [0.45, 0.32, 0], 0.012, 'steel')
  // A striped umbrella over it.
  k.cyl(0.012, 0.5, 0, 0.45, -0.1, 'white', { seg: 6 })
  for (let i = 0; i < 8; i++) k.cyl(0.42, 0.14, 0, 0.88, -0.1, i % 2 ? 'pink' : 'white', { rTop: 0, seg: 2, start: (i / 8) * Math.PI * 2, arc: Math.PI / 4 })
  k.ball(0.025, 0, 1.03, -0.1, 'pink')
  // A giant cone on a pole.
  k.cyl(0.008, 0.2, 0.25, 0.44, -0.12, 'steel', { seg: 4 })
  k.cyl(0.05, 0.14, 0.25, 0.6, -0.12, 'lightwood', { seg: 8, rTop: 0.0, ry: 0 })
  k.ball(0.06, 0.25, 0.78, -0.12, 'pink')
  k.box(0.18, 0.2, 0.02, -0.38, 0, 0.3, 'white', { bevel: 0.006, ry: 0.4 })
  k.box(0.14, 0.12, 0.01, -0.375, 0.05, 0.315, 'pink', { bevel: 0, ry: 0.4 })
}

function pumpkinPatch(k: Kit) {
  k.box(1.9, 0.05, 0.85, 0, 0, 0, 'soil', { bevel: 0.01 })
  k.box(1.94, 0.04, 0.9, 0, 0, 0, 'lawn', { bevel: 0.01 })
  k.box(1.86, 0.03, 0.8, 0, 0.03, 0, 'soil', { bevel: 0 })
  // Vines and leaves, pumpkins big and small.
  for (let i = 0; i < 9; i++) k.ball(0.06, -0.85 + i * 0.21, 0.07, (i % 2 ? 0.2 : -0.22), 'foliage', { lumpy: true, sy: 0.4 })
  for (const [x, z, r] of [[-0.7, -0.1, 0.13], [-0.35, 0.18, 0.1], [0.05, -0.15, 0.16], [0.5, 0.15, 0.11], [0.75, -0.2, 0.09], [-0.1, 0.22, 0.07]]) {
    k.ball(r, x, 0.06 + r * 0.75, z, 'orange', { sy: 0.72, seg: 12 })
    for (let j = 0; j < 4; j++) k.ball(r * 0.98, x, 0.06 + r * 0.75, z, j % 2 ? 'orange' : '#e86f1c', { sy: 0.7, sx: 0.4 + j * 0.15, seg: 10 })
    k.cyl(0.015, 0.06, x, 0.06 + r * 1.4, z, 'olive', { seg: 5 })
  }
  // A scarecrow, a hay bale and a crate.
  const sx = 0.3
  const sz = -0.28
  k.cyl(0.018, 0.75, sx, 0.06, sz, 'wood', { seg: 6 })
  k.box(0.46, 0.03, 0.03, sx, 0.58, sz, 'wood', { bevel: 0 })
  k.box(0.22, 0.26, 0.11, sx, 0.4, sz, 'red', { bevel: 0.02 })
  for (let i = 0; i < 3; i++) k.box(0.225, 0.012, 0.115, sx, 0.45 + i * 0.06, sz, 'navy', { bevel: 0 })
  for (const s of [-1, 1]) k.cyl(0.035, 0.08, sx + s * 0.25, 0.53, sz, 'hay', { seg: 6, rTop: 0.015 })
  k.ball(0.08, sx, 0.73, sz, 'sand')
  k.cyl(0.14, 0.03, sx, 0.78, sz, 'hay', { seg: 12 })
  k.cyl(0.08, 0.1, sx, 0.8, sz, 'hay', { seg: 10, rTop: 0.05 })
  k.box(0.28, 0.16, 0.18, -0.75, 0.05, 0.25, 'hay', { bevel: 0.03, gradient: true })
  k.box(0.18, 0.12, 0.16, 0.8, 0.06, 0.25, 'lightwood', { bevel: 0.01 })
  k.ball(0.06, 0.8, 0.2, 0.25, 'orange', { sy: 0.75 })
}

function festiveFir(k: Kit) {
  k.cyl(0.42, 0.03, 0, 0, 0, 'snow', { seg: 20 })
  k.cyl(0.07, 0.16, 0, 0.03, 0, 'wooddark', { seg: 8 })
  const tiers = 4
  for (let i = 0; i < tiers; i++) {
    const r = 0.4 - i * 0.08
    const y = 0.13 + i * 0.25
    k.cyl(r, 0.42, 0, y, 0, i % 2 ? 'foliage' : 'foliagedark', { rTop: 0, seg: 10 })
    k.cyl(r * 0.85, 0.05, 0, y, 0, 'snow', { seg: 10, rTop: r * 0.75 })
  }
  // Garland lights spiralling round, baubles, the star.
  const lights: Paint[] = ['red', 'sunny', 'aqua', 'white', 'violet']
  for (let i = 0; i < 22; i++) {
    const t = i / 22
    const y = 0.17 + t * 0.95
    const r = 0.38 * (1 - t * 0.85)
    const a = i * 1.15
    k.ball(0.026, Math.cos(a) * r, y, Math.sin(a) * r, lights[i % lights.length], { finish: 'glow' })
  }
  k.cyl(0.11, 0.06, 0, 1.33, 0, 'gold', { seg: 5, rTop: 0, finish: 'glow' })
  k.cyl(0.11, 0.06, 0, 1.33, 0, 'gold', { seg: 5, rTop: 0, finish: 'glow', ry: Math.PI })
  k.ball(0.05, 0, 1.33, 0, 'gold', { finish: 'glow' })
  // Presents underneath.
  for (const [x, z, s, c, r] of [[0.28, 0.25, 0.12, 'red', 'sunny'], [-0.25, 0.28, 0.1, 'blue', 'white'], [0.05, 0.36, 0.08, 'green', 'red']] as [number, number, number, Paint, Paint][]) {
    k.box(s, s, s, x, 0.03, z, c, { bevel: 0.008, ry: x })
    k.box(s + 0.004, s + 0.004, 0.02, x, 0.03, z, r, { bevel: 0, ry: x })
    k.box(0.02, s + 0.004, s + 0.004, x, 0.03, z, r, { bevel: 0, ry: x })
  }
}

// ---- Highlands

function mountainLodge(k: Kit) {
  k.ground(1.9, 1.9, 'stone', 0.04)
  k.box(1.8, 0.01, 1.8, 0, 0.04, 0, 'lawn', { bevel: 0 })
  k.box(0.4, 0.012, 0.5, 0, 0.04, 0.68, 'path', { bevel: 0 })
  // Stone ground floor, timber above, a steep red roof with deep eaves.
  const z0 = -0.1
  const W = 1.2
  const D = 0.95
  k.box(W + 0.06, 0.36, D + 0.06, 0, 0.05, z0, 'stone', { bevel: 0.02, gradient: true })
  k.box(W, 0.36, D, 0, 0.41, z0, 'wood', { bevel: 0.015 })
  for (let i = 0; i < 6; i++) k.box(W + 0.01, 0.012, D + 0.01, 0, 0.45 + i * 0.055, z0, 'wooddark', { bevel: 0 })
  k.gableRoof(W, D, 0.5, 0, 0.77, z0, 'roofred', 'wood', { ridge: 'z', overhang: 0.14, thick: 0.05 })
  const front = z0 + D / 2
  k.door('+z', front + 0.03, 0, { w: 0.2, h: 0.28, color: 'darkwood', y: 0.05 })
  for (const u of [-0.38, 0.38]) k.window('+z', front + 0.03, u, 0.16, { w: 0.16, h: 0.16, shutters: 'red' })
  k.windows('+x', W / 2 + 0.03, z0 - 0.25, z0 + 0.25, 0.16, 2, { w: 0.16, h: 0.16, shutters: 'red' })
  k.window('+z', front, 0, 0.82, { w: 0.2, h: 0.2, shutters: 'red' })
  // Balcony round the upper floor at the front, with flower boxes.
  k.box(W + 0.1, 0.035, 0.2, 0, 0.42, front + 0.1, 'lightwood', { bevel: 0.006 })
  for (let i = 0; i <= 12; i++) k.box(0.02, 0.13, 0.02, -W / 2 - 0.04 + i * ((W + 0.08) / 12), 0.455, front + 0.19, 'lightwood', { bevel: 0 })
  k.box(W + 0.1, 0.025, 0.03, 0, 0.58, front + 0.19, 'lightwood', { bevel: 0 })
  for (const u of [-0.38, 0.38]) {
    k.box(0.22, 0.05, 0.06, u, 0.6, front + 0.19, 'wooddark', { bevel: 0.006 })
    for (const dx of [-0.07, 0, 0.07]) k.ball(0.03, u + dx, 0.66, front + 0.19, dx ? 'red' : 'white', { lumpy: true })
  }
  for (const s of [-1, 1]) k.strut([s * 0.55, 0.05, front + 0.18], [s * 0.55, 0.42, front + 0.18], 0.025, 'wooddark')
  // Chimney, firewood and pines.
  k.box(0.16, 0.6, 0.16, 0.38, 0.85, z0 - 0.25, 'stone', { bevel: 0.012 })
  k.box(0.2, 0.04, 0.2, 0.38, 1.45, z0 - 0.25, 'stonedark', { bevel: 0.008 })
  for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - r; i++) k.rod(0.04, 0.28, -0.78 + i * 0.08 + r * 0.04, 0.09 + r * 0.07, 0.3, 'wood', 'z', { seg: 8 })
  k.pine(-0.75, -0.7, 0.95)
  k.pine(0.78, -0.65, 0.85)
  k.pine(0.8, 0.65, 0.7)
  k.bush(-0.75, 0.75, 0.09, 'hedge', 'violet', 0.04)
}

export const KIT_MODELS: Record<string, Builder> = {
  barn,
  'pen-chicken': pen(2, 2, 'chicken'),
  'pen-pig': pen(2, 2, 'pig'),
  'pen-sheep': pen(3, 2, 'sheep'),
  'pen-cow': pen(3, 3, 'cow'),
  'clock-tower': clockTower,
  lighthouse,
  gazebo,
  pond,
  fountain,
  statue,
  bench: benchDecor,
  'lamp-post': lampPost,
  hedge: hedgeDecor,
  'flower-bed': flowerBedDecor,
  'bus-stop': busStop,
  park,
  playground,
  'sports-field': sportsField,
  beach,
  'central-park': centralPark,
  'botanical-garden': botanicalGarden,
  'train-station': trainStation,
  airport,
  hangar: cargoHangar,
  'army-base': armyBase,
  'solar-farm': solarFarm,
  'ski-resort': skiResort,
  bakehouse,
  dairy,
  winery,
  'farmers-market': farmersMarket,
  'tractor-shed': tractorShed,
  'orchard-apples': orchard('red'),
  'orchard-cherries': orchard('#b3122e'),
  'orchard-oranges': orchard('orange'),
  'blossom-arch': blossomArch,
  'ice-cream-cart': iceCreamCart,
  'pumpkin-patch': pumpkinPatch,
  'festive-fir': festiveFir,
  'mountain-lodge': mountainLodge,
}
