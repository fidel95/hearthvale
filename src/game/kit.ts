import * as THREE from 'three'
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { markShared } from './modelLoading'

// Hearthvale's modelling kit in code: the same look as the Blender kit
// (assets-src/blender/hv.py), for models built when the game starts instead
// of exported from Blender. Chunky shapes with softly bevelled edges, dark
// trim bands, roofs that overhang, framed windows with blue glass, and the
// palette the Kenney kits use, so these sit beside the rest of the town.
//
// Coordinates are the game's: x across, y up, z toward the front (the
// camera looks from the +x, +z corner, so the front and right sides show).
// Every helper takes the center of the part's base (x, y, z), like the
// placeholder builders' add().
//
// A model is built once per kind and shared by every building of that kind:
// all its parts are merged into one mesh (plus one for shiny water and glass,
// and one for anything that glows), colored per vertex.

export const PALETTE = {
  // Kenney City Kit colors
  green: '#61cb8b', yellow: '#ffc044', orange: '#ff7e44', red: '#cf534f',
  blue: '#6794d9', skyblue: '#d0e8ff', purple: '#a878e8', pink: '#f378f0',
  steel: '#868ba1', charcoal: '#4f5260', lavender: '#a0a8c9', white: '#ffffff',
  salmon: '#f1976c', brown: '#b06041', peach: '#f2bf99', cream: '#fde4c7',
  terracotta: '#cf735b', apricot: '#faae8a', black: '#3a3c3f', slate: '#515566',
  slate2: '#666b80', bluegray: '#8e95b3', ink: '#38383d', leaf: '#3da679',
  // Our buildings
  glass: '#5b8fd6', glassdark: '#3e5f96', brick: '#b9503e', brickdark: '#8f3b30',
  wood: '#9a6a43', wooddark: '#6e4a2f', stone: '#c9c3b6', stonedark: '#a39d91',
  concrete: '#b8bcc4', asphalt: '#5a5e66', roofred: '#c8463a', roofblue: '#3f6fc4',
  roofgreen: '#3f9a6a', roofgray: '#6d7380', gold: '#f2c14e', firered: '#d83a33',
  navy: '#2f4f8a', mint: '#cdeee0', butter: '#ffe9b0', snow: '#f6f7fb',
  lilac: '#e3d8ff', lightwood: '#d8a86a', grass: '#6cc24a', hedge: '#3f9a4f',
  sand: '#f0dca8', rust: '#b8642e', light: '#fff6c8', teal: '#2fae8f',
  water: '#38b6e0', turf: '#5eb84d', sail: '#f8f4e8', hull: '#7a4928',
  rose: '#ff5c8a', sunny: '#ffd23f', coral: '#ff6b4a', darkwood: '#5c381e',
  lime: '#7be068', violet: '#b46cf0', aqua: '#2bb3b1', tyre: '#2b2e33',
  pipe: '#c8d0d8', paleblue: '#9fd3f0', soil: '#8a5a3c', hay: '#e8c55a',
  lawn: '#7cc85a', path: '#e3d3a8', foliage: '#4caf50', foliagedark: '#2f8a44',
  olive: '#6b7a3a', khaki: '#b8a878', barnred: '#c23b30', solar: '#2c4a8a',
}
export type Paint = keyof typeof PALETTE | `#${string}`

// What a part is made of: matte paint, shiny (water, glass) or glowing (lamps).
type Finish = 'matte' | 'shiny' | 'glow'

export interface PartOptions {
  bevel?: number // edge bevel width (boxes)
  ry?: number // turn about the vertical, radians
  gradient?: boolean // lighter toward the top, like Kenney's swatches
  finish?: Finish
}

// Glowing parts are unlit, so they show their full color in any light.
const materials: Record<Finish, THREE.Material> = {
  matte: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 }),
  shiny: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.05 }),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
}

const UP = new THREE.Vector3(0, 1, 0)

export class Kit {
  private parts: Record<Finish, THREE.BufferGeometry[]> = { matte: [], shiny: [], glow: [] }

  // ---- Basic shapes

  // A box w (x) × h (y) × d (z), its base centered at (x, y, z), its edges bevelled.
  box(w: number, h: number, d: number, x: number, y: number, z: number, color: Paint, o: PartOptions = {}) {
    const b = Math.min(o.bevel ?? 0.015, w / 3, h / 3, d / 3)
    let g: THREE.BufferGeometry
    if (b < 0.004 || Math.min(w, h, d) < 0.05) g = new THREE.BoxGeometry(w, h, d)
    else {
      const pts: THREE.Vector3[] = []
      const [W, H, D] = [w / 2, h / 2, d / 2]
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
        pts.push(new THREE.Vector3(sx * W, sy * (H - b), sz * (D - b)))
        pts.push(new THREE.Vector3(sx * (W - b), sy * H, sz * (D - b)))
        pts.push(new THREE.Vector3(sx * (W - b), sy * (H - b), sz * D))
      }
      g = new ConvexGeometry(pts)
    }
    g.translate(0, h / 2, 0)
    return this.place(g, x, y, z, color, o)
  }

  // An upright cylinder (or cone, with rTop) of radius r and height h.
  cyl(r: number, h: number, x: number, y: number, z: number, color: Paint, o: PartOptions & { seg?: number; rTop?: number; sx?: number; sz?: number; open?: boolean; arc?: number; start?: number } = {}) {
    const g = new THREE.CylinderGeometry(o.rTop ?? r, r, h, o.seg ?? 16, 1, o.open ?? false, o.start ?? 0, o.arc ?? Math.PI * 2)
    g.translate(0, h / 2, 0)
    if (o.sx || o.sz) g.scale(o.sx ?? 1, 1, o.sz ?? 1)
    return this.place(g, x, y, z, color, o)
  }

  // A cylinder lying along x or z, centered at (x, y, z).
  rod(r: number, length: number, x: number, y: number, z: number, color: Paint, axis: 'x' | 'z', o: PartOptions & { seg?: number; rEnd?: number } = {}) {
    const g = new THREE.CylinderGeometry(o.rEnd ?? r, r, length, o.seg ?? 12)
    g.rotateZ(axis === 'x' ? -Math.PI / 2 : 0)
    if (axis === 'z') g.rotateX(Math.PI / 2)
    return this.place(g, x, y, z, color, o, false)
  }

  // A rod from point a to point b.
  strut(a: [number, number, number], b: [number, number, number], r: number, color: Paint, o: PartOptions & { seg?: number } = {}) {
    const from = new THREE.Vector3(...a)
    const dir = new THREE.Vector3(...b).sub(from)
    const g = new THREE.CylinderGeometry(r, r, dir.length(), o.seg ?? 6)
    g.translate(0, dir.length() / 2, 0)
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()))
    return this.place(g, from.x, from.y, from.z, color, o, false)
  }

  // A ball centered at (x, y, z); sy squashes it upright. lumpy: faceted, for leaves and rocks.
  ball(r: number, x: number, y: number, z: number, color: Paint, o: PartOptions & { sy?: number; sx?: number; sz?: number; lumpy?: boolean; seg?: number } = {}) {
    const g = o.lumpy ? new THREE.IcosahedronGeometry(r, 1) : new THREE.SphereGeometry(r, o.seg ?? 14, Math.max(6, Math.round((o.seg ?? 14) * 0.6)))
    g.scale(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1)
    return this.place(g, x, y, z, color, o, false)
  }

  // A ring of radius R and thickness r centered at (x, y, z), around the given
  // axis ('y' lies flat); arc < 2π draws part of it, starting at +x.
  ring(R: number, r: number, x: number, y: number, z: number, color: Paint, axis: 'x' | 'y' | 'z' = 'y', o: PartOptions & { arc?: number; seg?: number } = {}) {
    const g = new THREE.TorusGeometry(R, r, 6, o.seg ?? 24, o.arc ?? Math.PI * 2)
    if (axis === 'y') g.rotateX(-Math.PI / 2)
    else if (axis === 'x') g.rotateY(Math.PI / 2)
    return this.place(g, x, y, z, color, o, false)
  }

  // A shape drawn side-on and extruded: outline points (across, up) in the
  // plane facing `axis`, `depth` thick along it, centered on (x, y, z) with
  // the outline's up measured from y.
  prism(points: [number, number][], depth: number, x: number, y: number, z: number, color: Paint, axis: 'x' | 'z' = 'z', o: PartOptions = {}) {
    const shape = new THREE.Shape(points.map(([a, b]) => new THREE.Vector2(a, b)))
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false })
    g.translate(0, 0, -depth / 2)
    // Drawn in the x–y plane, extruded along z; along x, it turns a quarter
    // (the outline's across then runs along +z).
    if (axis === 'x') g.rotateY(-Math.PI / 2)
    return this.place(g, x, y, z, color, o, false)
  }

  // A flat shape drawn from above (outline points (x, z)), h tall from height y.
  slab(outline: [number, number][], y: number, h: number, color: Paint, o: PartOptions = {}) {
    const shape = new THREE.Shape(outline.map(([a, b]) => new THREE.Vector2(a, -b)))
    const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: o.bevel !== undefined && o.bevel > 0, bevelSize: o.bevel ?? 0, bevelThickness: o.bevel ?? 0, bevelSegments: 1 })
    g.rotateX(-Math.PI / 2)
    if (o.bevel) g.translate(0, o.bevel, 0)
    return this.place(g, 0, y, 0, color, o, false)
  }

  // A disc (a short cylinder) lying flat: a pond, a pad, a rug of flowers.
  disc(r: number, h: number, x: number, y: number, z: number, color: Paint, o: PartOptions & { sx?: number; sz?: number; seg?: number } = {}) {
    return this.cyl(r, h, x, y, z, color, { seg: 28, ...o })
  }

  // ---- Building parts

  // A roof slab lying on the line from a to b, points (across, up) in the
  // plane across `along`, extruded `length` along it, centered on (x, y, z).
  slope(a: [number, number], b: [number, number], length: number, x: number, y: number, z: number, color: Paint, along: 'x' | 'z' = 'z', o: { thick?: number; overhang?: number; finish?: Finish } = {}) {
    const thick = o.thick ?? 0.045
    const du = b[0] - a[0]
    const dv = b[1] - a[1]
    const len = Math.hypot(du, dv) + (o.overhang ?? 0)
    const angle = Math.atan2(dv, du)
    let g: THREE.BufferGeometry
    if (along === 'z') {
      g = new THREE.BoxGeometry(len, thick, length).translate(0, thick / 2, 0).rotateZ(angle)
      g.translate(x + (a[0] + b[0]) / 2, y + (a[1] + b[1]) / 2, z)
    } else {
      g = new THREE.BoxGeometry(length, thick, len).translate(0, thick / 2, 0).rotateX(-angle)
      g.translate(x, y + (a[1] + b[1]) / 2, z + (a[0] + b[0]) / 2)
    }
    return this.place(g, 0, 0, 0, color, { gradient: true, finish: o.finish }, false)
  }

  // A pitched roof over a w × d wall top at height y: triangular gable ends
  // and two slabs that overhang all round. ridge: which way the ridge runs.
  gableRoof(w: number, d: number, h: number, x: number, y: number, z: number, color: Paint, gable: Paint, o: { overhang?: number; thick?: number; ridge?: 'x' | 'z' } = {}) {
    const overhang = o.overhang ?? 0.08
    const thick = o.thick ?? 0.05
    const ridgeX = (o.ridge ?? 'x') === 'x'
    const across = ridgeX ? d : w
    const along = ridgeX ? w : d
    const half = across / 2
    // Attic: a triangle in the gable color, extruded along the ridge.
    const triAxis = ridgeX ? 'x' : 'z'
    this.prism([[-half, 0], [half, 0], [0, h]], along, x, y, z, gable, triAxis)
    const pitch = Math.atan2(h, half)
    const slope = Math.hypot(half, h) + overhang
    for (const side of [-1, 1]) {
      // A slab lying on the slope: centered between ridge and eave, tilted.
      const g = new THREE.BoxGeometry(along + overhang * 2, thick, slope)
      g.translate(0, thick / 2, -slope / 2)
      g.rotateX(-pitch)
      if (side < 0) g.rotateY(Math.PI)
      if (!ridgeX) g.rotateY(Math.PI / 2)
      this.place(g, x, y + h + 0.004, z, color, { gradient: true }, false)
    }
    // A ridge cap.
    this.rod(thick * 0.9, along + overhang * 2 + 0.01, x, y + h + thick * 0.55, z, color, ridgeX ? 'x' : 'z', { seg: 8 })
  }

  // A roof sloping on all four sides over a w × d top at height y.
  hipRoof(w: number, d: number, h: number, x: number, y: number, z: number, color: Paint, overhang = 0.08) {
    const W = w / 2 + overhang
    const D = d / 2 + overhang
    const verts: number[] = []
    const tri = (a: number[], b: number[], c: number[]) => verts.push(...a, ...b, ...c)
    const base = [[-W, 0, -D], [W, 0, -D], [W, 0, D], [-W, 0, D]]
    if (W > D) {
      const r = W - D
      const t = [[-r, h, 0], [r, h, 0]]
      tri(base[0], t[0], base[1]); tri(base[1], t[0], t[1])
      tri(base[1], t[1], base[2])
      tri(base[2], t[1], base[3]); tri(base[3], t[1], t[0])
      tri(base[3], t[0], base[0])
    } else {
      const r = D - W
      const t = [[0, h, -r], [0, h, r]]
      tri(base[0], t[0], base[1])
      tri(base[1], t[0], t[1]); tri(base[1], t[1], base[2])
      tri(base[2], t[1], base[3])
      tri(base[3], t[1], t[0]); tri(base[3], t[0], base[0])
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
    g.computeVertexNormals()
    this.place(g, x, y + 0.03, z, color, { gradient: true }, false)
    // An eave board under the edge.
    this.box(w + overhang * 2, 0.04, d + overhang * 2, x, y, z, color, { bevel: 0.01 })
  }

  // ---- Facades. face: which wall ('+z' front, '-z' back, '+x' right,
  // '-x' left); at: that wall's position along its normal (d/2 for the front
  // of a box d deep at the origin); u: position along the wall; y: bottom.

  onFace(face: Face, at: number, u: number, y: number, w: number, h: number, depth: number, color: Paint, o: PartOptions = {}) {
    const s = face[0] === '+' ? 1 : -1
    const n = at + s * (depth / 2 - 0.01)
    if (face[1] === 'z') return this.box(w, h, depth, u, y, n, color, { bevel: 0.01, ...o })
    return this.box(depth, h, w, n, y, u, color, { bevel: 0.01, ...o })
  }

  window(face: Face, at: number, u: number, y: number, o: { w?: number; h?: number; frame?: Paint; glass?: Paint; sill?: boolean; shutters?: Paint; panes?: boolean; box?: Paint } = {}) {
    const w = o.w ?? 0.2
    const h = o.h ?? 0.24
    const out = face[0] === '+' ? 1 : -1
    this.onFace(face, at, u, y, w, h, 0.035, o.frame ?? 'white')
    this.onFace(face, at + out * 0.02, u, y + 0.025, w - 0.05, h - 0.05, 0.02, o.glass ?? 'glass', { finish: 'shiny', bevel: 0 })
    if (o.panes !== false) {
      this.onFace(face, at + out * 0.03, u, y + 0.025, 0.015, h - 0.05, 0.012, o.frame ?? 'white', { bevel: 0 })
      this.onFace(face, at + out * 0.03, u, y + h / 2 - 0.006, w - 0.05, 0.012, 0.012, o.frame ?? 'white', { bevel: 0 })
    }
    if (o.sill !== false) this.onFace(face, at, u, y - 0.025, w + 0.04, 0.03, 0.06, 'white', { bevel: 0.008 })
    if (o.shutters) for (const side of [-1, 1]) this.onFace(face, at, u + side * (w / 2 + 0.035), y, 0.06, h, 0.03, o.shutters, { bevel: 0.006 })
    if (o.box) {
      // A window box of flowers.
      this.onFace(face, at, u, y - 0.07, w + 0.02, 0.06, 0.08, o.box, { bevel: 0.006 })
      for (let i = 0; i < 4; i++) {
        const k = u - w / 2 + (i + 0.5) * (w / 4)
        const p = face[1] === 'z' ? [k, at + out * 0.05] : [at + out * 0.05, k]
        this.ball(0.032, p[0], y - 0.005, p[1], (['rose', 'sunny', 'white', 'violet'] as Paint[])[i % 4], { lumpy: true })
      }
    }
  }

  windows(face: Face, at: number, start: number, end: number, y: number, count: number, o: Parameters<Kit['window']>[4] = {}) {
    const step = (end - start) / count
    for (let i = 0; i < count; i++) this.window(face, at, start + step * (i + 0.5), y, o)
  }

  door(face: Face, at: number, u: number, o: { w?: number; h?: number; color?: Paint; frame?: Paint; y?: number; step?: boolean; glass?: boolean } = {}) {
    const w = o.w ?? 0.22
    const h = o.h ?? 0.34
    const y = o.y ?? 0
    const out = face[0] === '+' ? 1 : -1
    this.onFace(face, at, u, y, w + 0.06, h + 0.035, 0.035, o.frame ?? 'white')
    this.onFace(face, at + out * 0.02, u, y, w, h, 0.03, o.color ?? 'wooddark', { bevel: 0.006 })
    if (o.glass) this.onFace(face, at + out * 0.035, u, y + h * 0.45, w * 0.6, h * 0.4, 0.01, 'glass', { finish: 'shiny', bevel: 0 })
    const knob = face[1] === 'z' ? [u + w * 0.3, at + out * 0.05] : [at + out * 0.05, u + w * 0.3]
    this.ball(0.012, knob[0], y + h * 0.48, knob[1], 'gold')
    if (o.step !== false) this.onFace(face, at + out * 0.04, u, y, w + 0.12, 0.03, 0.1, 'stonedark', { bevel: 0.006 })
  }

  // A striped awning sloping out from a wall, its top edge at height y.
  awning(face: Face, at: number, u: number, y: number, w: number, colors: [Paint, Paint], o: { depth?: number; stripes?: number; drop?: number } = {}) {
    const depth = o.depth ?? 0.22
    const drop = o.drop ?? 0.1
    const stripes = o.stripes ?? Math.max(3, Math.round(w / 0.09))
    const s = face[0] === '+' ? 1 : -1
    const sw = w / stripes
    const tilt = Math.atan2(drop, depth)
    const len = Math.hypot(depth, drop)
    for (let i = 0; i < stripes; i++) {
      const k = u - w / 2 + (i + 0.5) * sw
      const g = new THREE.BoxGeometry(sw + 0.002, 0.02, len)
      g.translate(0, 0, len / 2)
      g.rotateX(tilt)
      // Built sloping out toward +z; turned to face its wall.
      g.rotateY(face[1] === 'z' ? (s > 0 ? 0 : Math.PI) : (s * Math.PI) / 2)
      const p = face[1] === 'z' ? [k, at] : [at, k]
      this.place(g, p[0], y, p[1], colors[i % 2], {}, false)
      // A scalloped valance along the front edge.
      const v = face[1] === 'z' ? [k, at + s * depth] : [at + s * depth, k]
      this.box(face[1] === 'z' ? sw * 0.92 : 0.015, 0.05, face[1] === 'z' ? 0.015 : sw * 0.92, v[0], y - drop - 0.05, v[1], colors[i % 2], { bevel: 0 })
    }
  }

  // A band round a w × d block (centered at x, z) at height y, standing proud of the walls.
  trim(w: number, d: number, y: number, color: Paint, o: { h?: number; out?: number; x?: number; z?: number } = {}) {
    const out = o.out ?? 0.025
    this.box(w + out * 2, o.h ?? 0.05, d + out * 2, o.x ?? 0, y, o.z ?? 0, color, { bevel: 0.01 })
  }

  // A building block: plinth, walls, and a flat roof inside a rim. Returns the roof's height.
  block(w: number, h: number, d: number, x: number, y: number, z: number, o: { wall?: Paint; base?: Paint; top?: Paint; roof?: Paint; parapet?: boolean } = {}) {
    this.box(w + 0.04, 0.07, d + 0.04, x, y, z, o.base ?? 'charcoal', { bevel: 0.012 })
    this.box(w, h, d, x, y, z, o.wall ?? 'cream', { bevel: 0.02 })
    if (o.parapet !== false) {
      const W = w + 0.06
      const D = d + 0.06
      const t = 0.07
      const rh = 0.08
      for (const side of [-1, 1]) {
        this.box(W, rh, t, x, y + h, z + side * (D - t) / 2, o.top ?? 'charcoal', { bevel: 0.012 })
        this.box(t, rh, D - 2 * t, x + side * (W - t) / 2, y + h, z, o.top ?? 'charcoal', { bevel: 0.012 })
      }
      // The roof sits below the rim's top, never level with it (it would flicker).
      this.box(W - 2 * t + 0.01, 0.05, D - 2 * t + 0.01, x, y + h, z, o.roof ?? 'slate2', { bevel: 0 })
    }
    return y + h
  }

  // A paved or grassy lot under everything.
  ground(w: number, d: number, color: Paint, h = 0.04, x = 0, z = 0) {
    this.box(w, h, d, x, 0, z, color, { bevel: 0.012 })
  }

  // ---- Garden things: what makes a place look lived in.

  // A round, puffy tree: a trunk and a crown of a few overlapping balls.
  tree(x: number, z: number, s = 1, leaf: Paint = 'foliage', o: { y?: number; trunk?: Paint; fruit?: Paint } = {}) {
    const y = o.y ?? 0
    this.cyl(0.045 * s, 0.32 * s, x, y, z, o.trunk ?? 'wood', { seg: 7, rTop: 0.035 * s })
    const c = y + 0.42 * s
    const dark = leaf === 'foliage' ? 'foliagedark' : leaf
    this.ball(0.24 * s, x, c, z, dark, { lumpy: true, sy: 0.9 })
    this.ball(0.19 * s, x + 0.1 * s, c + 0.08 * s, z + 0.08 * s, leaf, { lumpy: true })
    this.ball(0.17 * s, x - 0.11 * s, c + 0.05 * s, z + 0.06 * s, leaf, { lumpy: true })
    this.ball(0.15 * s, x, c + 0.17 * s, z - 0.02 * s, leaf, { lumpy: true })
    if (o.fruit) {
      // Fruit on the crown's surface, on the sides the camera sees (+x, +z).
      const cy = c + 0.07 * s
      for (let i = 0; i < 9; i++) {
        const a = -0.25 + i * 0.26
        const e = [0.05, 0.45, 0.8][i % 3]
        const r = 0.255 * s
        this.ball(0.042 * s, x + Math.cos(e) * Math.cos(a) * r, cy + Math.sin(e) * r, z + 0.03 * s + Math.cos(e) * Math.sin(a) * r, o.fruit)
      }
    }
  }

  // A conifer: stacked cones.
  pine(x: number, z: number, s = 1, o: { y?: number; snow?: boolean } = {}) {
    const y = o.y ?? 0
    this.cyl(0.04 * s, 0.14 * s, x, y, z, 'wooddark', { seg: 6 })
    for (let i = 0; i < 3; i++) {
      const r = (0.26 - i * 0.065) * s
      this.cyl(r, 0.3 * s, x, y + (0.1 + i * 0.17) * s, z, i % 2 ? 'foliage' : 'foliagedark', { rTop: 0, seg: 8 })
      if (o.snow) this.cyl(r * 0.45, 0.13 * s, x, y + (0.1 + i * 0.17) * s + 0.17 * s, z, 'snow', { rTop: 0, seg: 8 })
    }
  }

  // A clipped bush, with flowers if given.
  bush(x: number, z: number, r = 0.12, color: Paint = 'hedge', flowers?: Paint, y = 0) {
    this.ball(r, x, y + r * 0.7, z, color, { lumpy: true, sy: 0.85 })
    if (flowers) for (let i = 0; i < 5; i++) {
      const a = i * 1.3
      this.ball(r * 0.22, x + Math.cos(a) * r * 0.75, y + r * (0.9 + (i % 2) * 0.35), z + Math.abs(Math.sin(a)) * r * 0.75, flowers)
    }
  }

  // A clipped hedge, w long along x (or z when turned).
  hedgeRow(w: number, x: number, z: number, o: { h?: number; d?: number; ry?: number; color?: Paint; flowers?: Paint } = {}) {
    const h = o.h ?? 0.16
    const d = o.d ?? 0.14
    this.box(w, h, d, x, 0, z, o.color ?? 'hedge', { bevel: 0.035, ry: o.ry, gradient: true })
    if (o.flowers) {
      const n = Math.max(2, Math.round(w / 0.12))
      for (let i = 0; i < n; i++) {
        const k = -w / 2 + (i + 0.5) * (w / n)
        const ry = o.ry ?? 0
        this.ball(0.025, x + k * Math.cos(ry), h + 0.005, z - k * Math.sin(ry), o.flowers)
      }
    }
  }

  // A bed of flowers: a soil edge and blooms in mixed colors.
  flowerBed(w: number, d: number, x: number, z: number, colors: Paint[] = ['rose', 'sunny', 'white', 'violet', 'coral']) {
    this.box(w, 0.05, d, x, 0, z, 'stonedark', { bevel: 0.01 })
    this.box(w - 0.04, 0.03, d - 0.04, x, 0.035, z, 'soil', { bevel: 0 })
    const nx = Math.max(2, Math.round(w / 0.1))
    const nz = Math.max(1, Math.round(d / 0.1))
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const px = x - w / 2 + (i + 0.5) * (w / nx)
      const pz = z - d / 2 + (j + 0.5) * (d / nz)
      this.ball(0.032, px, 0.075, pz, 'foliage', { lumpy: true })
      this.ball(0.024, px + 0.008, 0.105, pz + 0.008, colors[(i * 3 + j * 2) % colors.length])
    }
  }

  // A street lamp: post, arm and a glowing lantern.
  lamp(x: number, z: number, h = 0.5, color: Paint = 'charcoal') {
    this.cyl(0.03, 0.04, x, 0, z, color, { seg: 8 })
    this.cyl(0.014, h, x, 0.04, z, color, { seg: 6 })
    this.cyl(0.04, 0.02, x, h + 0.02, z, color, { seg: 6 })
    this.cyl(0.032, 0.06, x, h + 0.04, z, 'light', { seg: 6, rTop: 0.042, finish: 'glow' })
    this.cyl(0.05, 0.035, x, h + 0.1, z, color, { seg: 6, rTop: 0.012 })
  }

  // A park bench facing `ry` (0: toward +z), s times the usual size.
  bench(x: number, z: number, ry = 0, color: Paint = 'lightwood', s = 1) {
    const p = (dx: number, dz: number): [number, number] => [x + (dx * Math.cos(ry) + dz * Math.sin(ry)) * s, z + (-dx * Math.sin(ry) + dz * Math.cos(ry)) * s]
    for (const side of [-1, 1]) {
      const [lx, lz] = p(side * 0.13, 0)
      this.box(0.025 * s, 0.09 * s, 0.1 * s, lx, 0, lz, 'charcoal', { bevel: 0, ry })
      const [ax, az] = p(side * 0.15, 0)
      this.box(0.02 * s, 0.02 * s, 0.1 * s, ax, 0.15 * s, az, 'charcoal', { bevel: 0, ry })
    }
    for (const k of [-0.025, 0.02]) {
      const [sx, sz] = p(0, k)
      this.box(0.32 * s, 0.018 * s, 0.04 * s, sx, 0.09 * s, sz, color, { bevel: 0.004, ry })
    }
    for (const yy of [0.13, 0.18]) {
      const [bx, bz] = p(0, -0.055)
      this.box(0.32 * s, 0.03 * s, 0.016 * s, bx, yy * s, bz, color, { bevel: 0.004, ry })
    }
  }

  // A picket fence along a straight line from (x0, z0) to (x1, z1).
  fence(x0: number, z0: number, x1: number, z1: number, color: Paint = 'white', o: { h?: number; gap?: number } = {}) {
    const h = o.h ?? 0.15
    const len = Math.hypot(x1 - x0, z1 - z0)
    const ry = Math.atan2(-(z1 - z0), x1 - x0)
    const n = Math.max(1, Math.round(len / (o.gap ?? 0.075)))
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const px = x0 + (x1 - x0) * t
      const pz = z0 + (z1 - z0) * t
      this.box(0.022, h, 0.022, px, 0, pz, color, { bevel: 0, ry })
      this.cyl(0.016, 0.03, px, h, pz, color, { rTop: 0, seg: 4, ry })
    }
    for (const y of [h * 0.3, h * 0.72]) this.box(len, 0.02, 0.012, (x0 + x1) / 2, y, (z0 + z1) / 2, color, { bevel: 0, ry })
  }

  // A post-and-rail fence (farms).
  rails(x0: number, z0: number, x1: number, z1: number, color: Paint = 'lightwood', o: { h?: number; gap?: number } = {}) {
    const h = o.h ?? 0.17
    const len = Math.hypot(x1 - x0, z1 - z0)
    const ry = Math.atan2(-(z1 - z0), x1 - x0)
    const n = Math.max(1, Math.round(len / (o.gap ?? 0.32)))
    for (let i = 0; i <= n; i++) {
      const t = i / n
      this.box(0.04, h + 0.02, 0.04, x0 + (x1 - x0) * t, 0, z0 + (z1 - z0) * t, 'wood', { bevel: 0.006, ry })
    }
    for (const y of [h * 0.38, h * 0.82]) this.box(len, 0.03, 0.02, (x0 + x1) / 2, y, (z0 + z1) / 2, color, { bevel: 0.004, ry })
  }

  // A rock or boulder.
  rock(x: number, z: number, r = 0.08, color: Paint = 'stonedark', y = 0) {
    this.ball(r, x, y + r * 0.45, z, color, { lumpy: true, sy: 0.65 })
  }

  // ---- Putting it together

  // Bake a shape into the model: turn it, move it, color its vertices.
  private place(g: THREE.BufferGeometry, x: number, y: number, z: number, color: Paint, o: PartOptions, turn = true) {
    if (turn && o.ry) g.rotateY(o.ry)
    g.translate(x, y, z)
    let geo = g.index ? g.toNonIndexed() : g
    if (geo !== g) g.dispose()
    for (const name of Object.keys(geo.attributes)) if (name !== 'position' && name !== 'normal') geo.deleteAttribute(name)
    if (!geo.attributes.normal) geo.computeVertexNormals()
    const base = new THREE.Color(color in PALETTE ? PALETTE[color as keyof typeof PALETTE] : color)
    const pos = geo.attributes.position
    const nrm = geo.attributes.normal
    let lo = Infinity
    let hi = -Infinity
    for (let i = 0; i < pos.count; i++) {
      lo = Math.min(lo, pos.getY(i))
      hi = Math.max(hi, pos.getY(i))
    }
    const colors = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      const py = pos.getY(i)
      // Kenney's swatches: a touch lighter toward the top.
      let k = o.gradient && hi > lo ? 0.9 + 0.16 * ((py - lo) / (hi - lo)) : 1
      // Walls darken a little near the ground, like soft contact shadow.
      if (Math.abs(nrm.getY(i)) < 0.5) k *= 0.84 + 0.16 * Math.min(1, Math.max(0, py / 0.25))
      colors[i * 3] = base.r * k
      colors[i * 3 + 1] = base.g * k
      colors[i * 3 + 2] = base.b * k
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    this.parts[o.finish ?? 'matte'].push(geo)
    return geo
  }

  // Merge everything into one mesh per finish, shared by every building of this kind.
  build(): THREE.Group {
    const group = new THREE.Group()
    for (const finish of ['matte', 'shiny', 'glow'] as Finish[]) {
      const parts = this.parts[finish]
      if (!parts.length) continue
      const merged = mergeGeometries(parts)
      for (const p of parts) p.dispose()
      if (!merged) throw new Error('kit: parts could not be merged')
      merged.computeBoundingBox()
      merged.computeBoundingSphere()
      markShared(merged)
      const mesh = new THREE.Mesh(merged, materials[finish])
      mesh.castShadow = mesh.receiveShadow = true
      group.add(mesh)
    }
    group.userData.trueSize = true
    return group
  }
}

export type Face = '+z' | '-z' | '+x' | '-x'
