import * as THREE from 'three'
import { forest, nature } from './buildings'
import { GRID_SIZE, tileToWorld, type Tile } from './grid'
import { nearMountain } from './terrain'
import { loadMeshParts, NATURE_GREENS } from './models'

// Trees, bushes, rocks and flowers scattered over land the town doesn't own
// yet, so the world around the town looks lived-in and colorful rather than
// empty. Purely decoration: it's never saved and never blocks anything, and
// it's cleared from a lot the moment the town buys it.
//
// In lawn mode it's the town's own grass instead: just tufts of long grass,
// a few flowers and the odd clump of mushrooms on tiles with nothing built.
//
// The models come from Kenney's Nature Kit (leafy, autumn and slim trees,
// bushes, flowers, grass, mushrooms, rocks, stumps) and Mini Forest pack
// (pines and boulders). Until they've loaded, or if they can't, the
// countryside has simple round trees, bushes and flowers instead.
//
// Everything is drawn with instancing: one mesh per kind of shape (per
// material), drawn many times with a different position each, which costs
// about as much as drawing one. Leaves get a green of their own per tree.

const CROWNS = ['#4caf50', '#3f9a45', '#66bb4a', '#2e8b57', '#f28cb1', '#f5a742'] // greens, with blossom and autumn trees
const BLOOMS = ['#ff5c8a', '#ffd23f', '#ffffff', '#b46cf0', '#ff7043', '#4fc3f7']
const LEAVES = ['#7ccf5a', '#6cc04a', '#8fd65f', '#5cb85c', '#a3d95a'] // the leafy trees' greens

type Group = 'tree' | 'rock' | 'bush' | 'flower' | 'ground'
interface Kind {
  url: string
  node?: string // the model's part to draw (the Nature Kit's models are one named part)
  height: number
  group: Group
}
const n = (name: string, height: number, group: Group): Kind => ({ url: nature(name), node: name, height, group })
const KINDS = {
  pine: { url: forest('tree'), height: 1.5, group: 'tree' },
  tallPine: { url: forest('tree-high'), height: 2.1, group: 'tree' },
  boulders: { url: forest('rocks-low'), height: 0.42, group: 'rock' },
  leafy: n('tree_default', 1.5, 'tree'),
  oak: n('tree_oak', 1.25, 'tree'),
  round: n('tree_fat', 1.3, 'tree'),
  branchy: n('tree_detailed', 1.5, 'tree'),
  slim: n('tree_cone', 1.4, 'tree'),
  fallOak: n('tree_oak_fall', 1.25, 'tree'),
  fallBirch: n('tree_default_fall', 1.5, 'tree'),
  rock: n('rock_largeA', 0.3, 'rock'),
  stump: n('stump_old', 0.3, 'rock'),
  logs: n('log_stackLarge', 0.3, 'rock'),
  bush: n('plant_bushLarge', 0.4, 'bush'),
  shrub: n('plant_bushDetailed', 0.3, 'bush'),
  red: n('flower_redA', 0.24, 'flower'),
  yellow: n('flower_yellowA', 0.24, 'flower'),
  purple: n('flower_purpleA', 0.24, 'flower'),
  grass: n('grass_large', 0.18, 'ground'),
  mushrooms: n('mushroom_redGroup', 0.2, 'ground'),
} satisfies Record<string, Kind>
type KindName = keyof typeof KINDS

// The kinds that grow in a lawn.
const LAWN_KINDS: KindName[] = ['grass', 'red', 'yellow', 'purple', 'mushrooms']

// Which kinds a roll can pick, with how often.
const TREES: [KindName, number][] = [['pine', 3], ['tallPine', 2], ['leafy', 3], ['oak', 3], ['round', 2], ['branchy', 2], ['slim', 2], ['fallOak', 1], ['fallBirch', 1]]
const ROCKS: [KindName, number][] = [['boulders', 2], ['rock', 2], ['stump', 1], ['logs', 1]]
// On the mountainsides: pine woods and scree.
const MOUNTAIN_TREES: [KindName, number][] = [['pine', 4], ['tallPine', 4], ['slim', 1]]
const MOUNTAIN_ROCKS: [KindName, number][] = [['boulders', 3], ['rock', 2]]
const BUSHES: [KindName, number][] = [['bush', 2], ['shrub', 1]]
const FLOWERS: KindName[] = ['red', 'yellow', 'purple']

export interface Part {
  geometry: THREE.BufferGeometry
  material: THREE.MeshStandardMaterial
  leaves: boolean // painted a green per copy
}

// A nature model's parts, sized to its height and standing on the ground at
// its middle. snow (0 to 1) whitens them, by a shader tweak (tinting can't
// make the textured ones lighter). Leaves come out white, to be painted a
// green per copy.
export async function loadStanding(url: string, node: string | undefined, height: number, snow: { value: number }): Promise<Part[]> {
  const parts = await loadMeshParts(url, node)
  const box = new THREE.Box3()
  for (const p of parts) {
    p.geometry.computeBoundingBox()
    box.union(p.geometry.boundingBox!)
  }
  const center = box.getCenter(new THREE.Vector3())
  const scale = height / (box.max.y - box.min.y)
  return parts.map(({ geometry, material }) => {
    geometry.translate(-center.x, -box.min.y, -center.z).scale(scale, scale, scale)
    const leaves = NATURE_GREENS.has(material.name)
    const m = (material as THREE.MeshStandardMaterial).clone()
    if (leaves) m.color.set('#ffffff')
    m.onBeforeCompile = (shader) => {
      shader.uniforms.snow = snow
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float snow;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.94, 0.96, 0.99), snow);')
    }
    return { geometry, material: m, leaves }
  })
}

// The same "random" choice for a tile every time (so scenery doesn't shuffle
// when the land changes).
function noise(x: number, z: number, salt: number): number {
  let h = Math.imul(x * 374761393 + z * 668265263 + salt * 2246822519, 1274126177)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function pick(options: [KindName, number][], roll: number): KindName {
  const total = options.reduce((sum, [, weight]) => sum + weight, 0)
  let at = roll * total
  for (const [kind, weight] of options) {
    if ((at -= weight) < 0) return kind
  }
  return options[options.length - 1][0]
}

interface Placed {
  at: THREE.Vector3
  size: number
  turn: number
  green: THREE.Color
}

export class Scenery {
  private group = new THREE.Group()
  private crowns: THREE.InstancedMesh | null = null
  private crownColors: THREE.Color[] = []
  private bushes: THREE.InstancedMesh | null = null
  private snow = 0
  private trees: Placed[] = [] // round trees (their crowns sway)
  private swaying: { mesh: THREE.InstancedMesh; placed: Placed[] }[] = []
  private models: Partial<Record<KindName, Part[]>> = {}
  // Snow on the models: a shader tweak that whitens them (tinting can't make
  // the textured ones lighter).
  private snowUniform = { value: 0 }
  private lastOpen: ((tile: Tile) => boolean) | null = null
  private lawn: boolean
  private kinds: KindName[]

  constructor(scene: THREE.Scene, { lawn = false } = {}) {
    this.lawn = lawn
    this.kinds = lawn ? LAWN_KINDS : (Object.keys(KINDS) as KindName[])
    scene.add(this.group)
    void Promise.all(this.kinds.map(async (kind) => (this.models[kind] = await this.load(KINDS[kind]))))
      .then(() => {
        if (this.lastOpen) this.rebuild(this.lastOpen)
      })
      .catch((err) => console.warn("Couldn't load the countryside models; it keeps its round trees", err))
  }

  private load(kind: Kind): Promise<Part[]> {
    return loadStanding(kind.url, kind.node, kind.height, this.snowUniform)
  }

  // Scatter scenery on every tile where open(tile) is true.
  rebuild(open: (tile: Tile) => boolean) {
    this.lastOpen = open
    for (const child of [...this.group.children]) {
      const mesh = child as THREE.InstancedMesh
      // The models' shapes and materials are shared and kept; the rest are ours to free.
      if (!mesh.userData.shared) {
        mesh.geometry.dispose()
        ;(mesh.material as THREE.Material).dispose()
      }
      mesh.dispose()
      this.group.remove(mesh)
    }

    const loaded = Object.keys(this.models).length === this.kinds.length
    const trees: (Placed & { color: string })[] = []
    const placed = new Map<KindName, Placed[]>()
    const put = (kind: KindName, p: Placed) => {
      const list = placed.get(kind) ?? []
      list.push(p)
      placed.set(kind, list)
    }
    const bushes: { at: THREE.Vector3; size: number }[] = []
    const flowers: { at: THREE.Vector3; color: string }[] = []
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        if (!open({ x, z })) continue
        if (this.lawn) {
          if (loaded) this.lawnTile(x, z, put)
          continue
        }
        const mountainside = nearMountain({ x, z }, 2.5)
        const roll = noise(x, z, 1) * (mountainside ? 0.55 : 1)
        const c = tileToWorld({ x, z })
        const jitter = new THREE.Vector3(noise(x, z, 2) - 0.5, 0, noise(x, z, 3) - 0.5).multiplyScalar(0.5)
        const at = c.clone().add(jitter)
        const size = 0.75 + noise(x, z, 4) * 0.5
        const turn = noise(x, z, 6) * Math.PI * 2
        const green = new THREE.Color(LEAVES[Math.floor(noise(x, z, 5) * LEAVES.length)])
        if (roll < 0.08) {
          if (loaded) put(pick(mountainside ? MOUNTAIN_TREES : TREES, noise(x, z, 7)), { at, size, turn, green })
          else trees.push({ at, size, turn, green, color: CROWNS[Math.floor(noise(x, z, 5) * CROWNS.length)] })
        } else if (roll < 0.1 && loaded) {
          put(pick(mountainside ? MOUNTAIN_ROCKS : ROCKS, noise(x, z, 7)), { at, size: 0.7 + noise(x, z, 4) * 0.7, turn, green })
        } else if (roll < 0.13) {
          if (loaded) put(pick(BUSHES, noise(x, z, 7)), { at, size: 0.8 + noise(x, z, 4) * 0.5, turn, green })
          else bushes.push({ at, size: 0.6 + noise(x, z, 4) * 0.4 })
        } else if (roll < 0.2) {
          // A little patch of flowers, all one color.
          const k = Math.floor(noise(x, z, 5) * FLOWERS.length)
          const color = BLOOMS[Math.floor(noise(x, z, 5) * BLOOMS.length)]
          for (let i = 0; i < 5; i++) {
            const offset = new THREE.Vector3(noise(x, z, 10 + i) - 0.5, 0, noise(x, z, 20 + i) - 0.5).multiplyScalar(0.7)
            if (loaded) put(FLOWERS[k], { at: c.clone().add(offset), size: 0.8 + noise(x, z, 30 + i) * 0.4, turn: noise(x, z, 40 + i) * 6.3, green })
            else flowers.push({ at: c.clone().add(offset), color })
          }
        } else if (roll < 0.26 && loaded) {
          // Tufts of long grass, and now and then a clump of mushrooms.
          put(noise(x, z, 7) < 0.12 ? 'mushrooms' : 'grass', { at, size: 0.8 + noise(x, z, 4) * 0.5, turn, green })
        }
      }
    }

    const matrix = new THREE.Matrix4()
    const place = (mesh: THREE.InstancedMesh, i: number, at: THREE.Vector3, scale: number, y: number) => {
      matrix.compose(at.clone().setY(y * scale), new THREE.Quaternion(), new THREE.Vector3(scale, scale, scale))
      mesh.setMatrixAt(i, matrix)
    }
    const instanced = (geometry: THREE.BufferGeometry, color: string, count: number) => {
      const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ color, flatShading: true }), Math.max(1, count))
      mesh.count = count
      mesh.castShadow = true
      mesh.receiveShadow = true
      this.group.add(mesh)
      return mesh
    }

    // The round trees (before the models load): a trunk and a crown in its own color.
    const trunks = instanced(new THREE.CylinderGeometry(0.07, 0.09, 0.5, 6), '#8a5a36', trees.length)
    const crowns = instanced(new THREE.IcosahedronGeometry(0.38, 0), '#ffffff', trees.length)
    trees.forEach((t, i) => {
      place(trunks, i, t.at, t.size, 0.25)
      place(crowns, i, t.at, t.size, 0.75)
      crowns.setColorAt(i, new THREE.Color(t.color))
    })

    // The models, standing on the ground, each turned its own way.
    this.swaying = []
    for (const [kind, list] of placed) {
      const group = KINDS[kind].group
      for (const part of this.models[kind] ?? []) {
        const mesh = new THREE.InstancedMesh(part.geometry, part.material, list.length)
        mesh.userData.shared = true
        mesh.castShadow = group !== 'flower' && group !== 'ground'
        mesh.receiveShadow = true
        list.forEach((p, i) => {
          mesh.setMatrixAt(i, this.standing(p, 0, 0))
          if (part.leaves) mesh.setColorAt(i, p.green)
        })
        if (group === 'flower' || group === 'ground') mesh.userData.flowers = true
        this.group.add(mesh)
        if (group === 'tree') this.swaying.push({ mesh, placed: list })
      }
    }
    const bush = instanced(new THREE.IcosahedronGeometry(0.25, 0), '#57a84a', bushes.length)
    bushes.forEach((b, i) => place(bush, i, b.at, b.size, 0.15))
    const blooms = instanced(new THREE.IcosahedronGeometry(0.07, 0), '#ffffff', flowers.length)
    blooms.castShadow = false
    flowers.forEach((f, i) => {
      place(blooms, i, f.at, 1, 0.07)
      blooms.setColorAt(i, new THREE.Color(f.color))
    })
    for (const mesh of [crowns, blooms]) if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    blooms.userData.flowers = true
    this.crowns = crowns
    this.trees = trees
    this.crownColors = trees.map((t) => new THREE.Color(t.color))
    this.bushes = bush
    this.setSnow(this.snow)
  }

  // A lawn tile: now and then a tuft of long grass, a few flowers, or mushrooms.
  private lawnTile(x: number, z: number, put: (kind: KindName, p: Placed) => void) {
    const roll = noise(x, z, 11)
    if (roll > 0.2) return
    const c = tileToWorld({ x, z })
    const green = new THREE.Color(LEAVES[Math.floor(noise(x, z, 5) * LEAVES.length)])
    const spot = (salt: number, spread: number) => c.clone().add(new THREE.Vector3(noise(x, z, salt) - 0.5, 0, noise(x, z, salt + 1) - 0.5).multiplyScalar(spread))
    if (roll < 0.13) {
      // A tuft or two of grass.
      for (let i = 0; i < 1 + Math.floor(noise(x, z, 12) * 2); i++) put('grass', { at: spot(20 + i * 2, 0.8), size: 0.55 + noise(x, z, 30 + i) * 0.35, turn: noise(x, z, 40 + i) * 6.3, green })
    } else if (roll < 0.19) {
      // Three flowers of one color.
      const kind = FLOWERS[Math.floor(noise(x, z, 13) * FLOWERS.length)]
      for (let i = 0; i < 3; i++) put(kind, { at: spot(50 + i * 2, 0.6), size: 0.6 + noise(x, z, 60 + i) * 0.3, turn: noise(x, z, 70 + i) * 6.3, green })
    } else {
      put('mushrooms', { at: spot(80, 0.5), size: 0.6, turn: noise(x, z, 81) * 6.3, green })
    }
  }

  // A model standing at its spot: turned, sized, and leaning a little from
  // its base (for the breeze).
  private standing(p: Placed, leanX: number, leanZ: number): THREE.Matrix4 {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(leanX, p.turn, leanZ))
    return new THREE.Matrix4().compose(p.at, q, new THREE.Vector3(p.size, p.size, p.size))
  }

  // A gentle breeze: every tree leans a little this way and that.
  sway(seconds: number) {
    if (!this.crowns) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    this.trees.forEach((t, i) => {
      e.set(Math.sin(seconds * 1.1 + i) * 0.05, 0, Math.cos(seconds * 0.9 + i * 1.3) * 0.05)
      m.compose(t.at.clone().setY(0.75 * t.size), q.setFromEuler(e), new THREE.Vector3(t.size, t.size, t.size))
      this.crowns!.setMatrixAt(i, m)
    })
    this.crowns.instanceMatrix.needsUpdate = true
    for (const { mesh, placed } of this.swaying) {
      placed.forEach((p, i) => mesh.setMatrixAt(i, this.standing(p, Math.sin(seconds * 0.9 + i) * 0.025, Math.cos(seconds * 0.7 + i * 1.7) * 0.025)))
      mesh.instanceMatrix.needsUpdate = true
    }
  }

  // Snow mode: trees, rocks and bushes turn white (by how much snow, 0 to 1),
  // and the flowers and grass are buried.
  setSnow(amount: number) {
    this.snow = amount
    this.snowUniform.value = amount * 0.75
    const white = new THREE.Color('#f4f8fb')
    if (this.crowns) {
      this.crownColors.forEach((c, i) => this.crowns!.setColorAt(i, c.clone().lerp(white, amount * 0.8)))
      if (this.crowns.instanceColor) this.crowns.instanceColor.needsUpdate = true
    }
    if (this.bushes) (this.bushes.material as THREE.MeshStandardMaterial).color.set('#57a84a').lerp(white, amount * 0.8)
    for (const child of this.group.children) if (child.userData.flowers) child.visible = amount < 0.5
  }
}
