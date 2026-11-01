import * as THREE from 'three'
import { forest, nature } from './buildings'
import { tileToWorld } from './grid'
import { loadStanding, type Part } from './scenery'
import type { Wild, WildKind, Wilds } from './wilds'

// Draws the wilds (wilds.ts): the trees, boulders, bushes and stumps growing
// on the town's land, with the same Nature Kit and Mini Forest models as the
// countryside. Each one grows in when it appears and shrinks away when it's
// cleared, and the trees lean a little in the breeze.
//
// Instanced like the countryside (Scenery): one mesh per model part, drawn
// once per wild. There are only ever a few dozen, so every copy's position is
// simply set again each frame.

interface Variant {
  url: string
  node?: string
  height: number
  tree?: boolean // sways
}
const n = (name: string, height: number, tree = false): Variant => ({ url: nature(name), node: name, height, tree })
const VARIANTS = {
  leafy: n('tree_default', 1.35, true),
  oak: n('tree_oak', 1.15, true),
  round: n('tree_fat', 1.2, true),
  pine: { url: forest('tree'), height: 1.45, tree: true },
  tallPine: { url: forest('tree-high'), height: 1.8, tree: true },
  rock: n('rock_largeA', 0.32),
  boulders: { url: forest('rocks-low'), height: 0.4 },
  bush: n('plant_bushLarge', 0.42),
  shrub: n('plant_bushDetailed', 0.34),
  stump: n('stump_old', 0.3),
} satisfies Record<string, Variant>
type VariantName = keyof typeof VARIANTS

const BY_KIND: Record<WildKind, VariantName[]> = {
  tree: ['leafy', 'oak', 'round'],
  pine: ['pine', 'tallPine'],
  rock: ['rock', 'boulders'],
  bush: ['bush', 'shrub'],
  stump: ['stump'],
}
const LEAVES = ['#7ccf5a', '#6cc04a', '#8fd65f', '#5cb85c', '#a3d95a']

const GROW_SECONDS = 0.45
const LEAVE_SECONDS = 0.35

// The same "random" number for a tile every time, so a wild keeps its look.
function hash(x: number, z: number, salt: number): number {
  let h = Math.imul(x * 374761393 + z * 668265263 + salt * 2246822519, 1274126177)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

interface Entry {
  wild: Wild
  variant: VariantName
  at: THREE.Vector3
  turn: number
  size: number
  green: THREE.Color
  age: number // seconds since it appeared (it grows in)
  leaving: number | null // seconds left as it shrinks away, once cleared
}

export class WildsView {
  private group = new THREE.Group()
  private models: Partial<Record<VariantName, Part[]>> = {}
  private snow = { value: 0 }
  private entries = new Map<string, Entry>()
  private meshes: { mesh: THREE.InstancedMesh; entries: Entry[] }[] = []
  private wilds: Wilds
  private time = 0
  // Off while the town loads (what's there is simply there); Game turns it on.
  animate = false

  constructor(scene: THREE.Scene, wilds: Wilds) {
    this.wilds = wilds
    scene.add(this.group)
    wilds.onChange(() => this.sync())
    void Promise.all((Object.keys(VARIANTS) as VariantName[]).map(async (v) => (this.models[v] = await this.load(VARIANTS[v]))))
      .then(() => this.rebuild())
      .catch((err) => console.warn("Couldn't load the models for trees and rocks on the town's land", err))
    this.sync()
  }

  private load(v: Variant): Promise<Part[]> {
    return loadStanding(v.url, v.node, v.height, this.snow)
  }

  // Match the entries to the wilds: new ones grow in, cleared ones shrink away.
  private sync() {
    const keep = new Set<string>()
    let added = false
    for (const wild of this.wilds.all()) {
      const key = `${wild.tile.x},${wild.tile.z}`
      keep.add(key)
      const had = this.entries.get(key)
      if (had && had.wild.kind === wild.kind && had.leaving === null) continue
      const { x, z } = wild.tile
      const options = BY_KIND[wild.kind]
      this.entries.set(key, {
        wild,
        variant: options[Math.floor(hash(x, z, 1) * options.length)],
        at: tileToWorld(wild.tile).add(new THREE.Vector3(hash(x, z, 2) - 0.5, 0, hash(x, z, 3) - 0.5).multiplyScalar(0.3)),
        turn: hash(x, z, 4) * Math.PI * 2,
        size: 0.85 + hash(x, z, 5) * 0.3,
        green: new THREE.Color(LEAVES[Math.floor(hash(x, z, 6) * LEAVES.length)]),
        age: this.animate ? 0 : GROW_SECONDS,
        leaving: null,
      })
      added = true
    }
    for (const [key, e] of this.entries) if (!keep.has(key) && e.leaving === null) e.leaving = LEAVE_SECONDS
    if (added) this.rebuild()
  }

  // One instanced mesh per model part, for the entries using that model.
  private rebuild() {
    for (const { mesh } of this.meshes) {
      this.group.remove(mesh)
      mesh.dispose()
    }
    this.meshes = []
    const byVariant = new Map<VariantName, Entry[]>()
    for (const e of this.entries.values()) {
      const list = byVariant.get(e.variant) ?? []
      list.push(e)
      byVariant.set(e.variant, list)
    }
    for (const [variant, entries] of byVariant) {
      for (const part of this.models[variant] ?? []) {
        const mesh = new THREE.InstancedMesh(part.geometry, part.material, entries.length)
        mesh.castShadow = mesh.receiveShadow = true
        if (part.leaves) entries.forEach((e, i) => mesh.setColorAt(i, e.green))
        this.group.add(mesh)
        this.meshes.push({ mesh, entries })
      }
    }
    this.place()
  }

  private place() {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const s = new THREE.Vector3()
    for (const { mesh, entries } of this.meshes) {
      entries.forEach((entry, i) => {
        // Grow in with a little overshoot; shrink away when cleared.
        const t = Math.min(1, entry.age / GROW_SECONDS)
        let scale = t < 1 ? Math.sin(t * Math.PI * 0.5) * (1 + 0.15 * Math.sin(t * Math.PI)) : 1
        if (entry.leaving !== null) scale *= Math.max(0, entry.leaving / LEAVE_SECONDS)
        const k = this.time * 0.9 + entry.at.x + entry.at.z
        const lean = (VARIANTS[entry.variant] as Variant).tree ? 0.025 : 0
        e.set(Math.sin(k) * lean, entry.turn + (entry.leaving !== null ? (1 - entry.leaving / LEAVE_SECONDS) * 2 : 0), Math.cos(k * 0.8) * lean)
        m.compose(entry.at, q.setFromEuler(e), s.setScalar(entry.size * scale))
        mesh.setMatrixAt(i, m)
      })
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
  }

  update(dt: number) {
    if (this.entries.size === 0) return
    this.time += dt
    let gone = false
    for (const [key, e] of this.entries) {
      e.age += dt
      if (e.leaving === null) continue
      e.leaving -= dt
      if (e.leaving <= 0) {
        this.entries.delete(key)
        gone = true
      }
    }
    if (gone) this.rebuild()
    else this.place()
  }

  // Snow (0 to 1) whitens them, as it does the countryside.
  setSnow(amount: number) {
    this.snow.value = amount * 0.75
  }
}
