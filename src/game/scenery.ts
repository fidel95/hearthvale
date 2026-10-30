import * as THREE from 'three'
import { GRID_SIZE, tileToWorld, type Tile } from './grid'

// Trees, bushes and flowers scattered over land the town doesn't own yet, so
// the world around the town looks lived-in and colorful rather than empty.
// Purely decoration: it's never saved and never blocks anything, and it's
// cleared from a lot the moment the town buys it.
//
// Everything is drawn with instancing: one mesh per kind of shape, drawn many
// times with a different position and color each, which costs about as much
// as drawing one.

const CROWNS = ['#4caf50', '#3f9a45', '#66bb4a', '#2e8b57', '#f28cb1', '#f5a742'] // greens, with blossom and autumn trees
const BLOOMS = ['#ff5c8a', '#ffd23f', '#ffffff', '#b46cf0', '#ff7043', '#4fc3f7']

// The same "random" choice for a tile every time (so scenery doesn't shuffle
// when the land changes).
function noise(x: number, z: number, salt: number): number {
  let h = Math.imul(x * 374761393 + z * 668265263 + salt * 2246822519, 1274126177)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

export class Scenery {
  private group = new THREE.Group()
  private crowns: THREE.InstancedMesh | null = null
  private crownColors: THREE.Color[] = []
  private bushes: THREE.InstancedMesh | null = null
  private snow = 0
  private trees: { at: THREE.Vector3; size: number }[] = []

  constructor(scene: THREE.Scene) {
    scene.add(this.group)
  }

  // Scatter scenery on every tile where open(tile) is true.
  rebuild(open: (tile: Tile) => boolean) {
    for (const child of [...this.group.children]) {
      const mesh = child as THREE.InstancedMesh
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
      mesh.dispose()
      this.group.remove(mesh)
    }

    const trees: { at: THREE.Vector3; size: number; color: string }[] = []
    const bushes: { at: THREE.Vector3; size: number }[] = []
    const flowers: { at: THREE.Vector3; color: string }[] = []
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        if (!open({ x, z })) continue
        const roll = noise(x, z, 1)
        const c = tileToWorld({ x, z })
        const jitter = new THREE.Vector3(noise(x, z, 2) - 0.5, 0, noise(x, z, 3) - 0.5).multiplyScalar(0.5)
        const at = c.clone().add(jitter)
        if (roll < 0.07) {
          trees.push({ at, size: 0.75 + noise(x, z, 4) * 0.5, color: CROWNS[Math.floor(noise(x, z, 5) * CROWNS.length)] })
        } else if (roll < 0.11) {
          bushes.push({ at, size: 0.6 + noise(x, z, 4) * 0.4 })
        } else if (roll < 0.18) {
          // A little patch of flowers, all one color.
          const color = BLOOMS[Math.floor(noise(x, z, 5) * BLOOMS.length)]
          for (let i = 0; i < 5; i++) {
            const offset = new THREE.Vector3(noise(x, z, 10 + i) - 0.5, 0, noise(x, z, 20 + i) - 0.5).multiplyScalar(0.7)
            flowers.push({ at: c.clone().add(offset), color })
          }
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

    const trunks = instanced(new THREE.CylinderGeometry(0.07, 0.09, 0.5, 6), '#8a5a36', trees.length)
    const crowns = instanced(new THREE.IcosahedronGeometry(0.38, 0), '#ffffff', trees.length)
    trees.forEach((t, i) => {
      place(trunks, i, t.at, t.size, 0.25)
      place(crowns, i, t.at, t.size, 0.75)
      crowns.setColorAt(i, new THREE.Color(t.color))
    })
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

  // A gentle breeze: every tree's crown leans a little this way and that.
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
  }

  // Snow mode: trees and bushes turn white (by how much snow, 0 to 1), and
  // the flowers are buried.
  setSnow(amount: number) {
    this.snow = amount
    const white = new THREE.Color('#f4f8fb')
    if (this.crowns) {
      this.crownColors.forEach((c, i) => this.crowns!.setColorAt(i, c.clone().lerp(white, amount * 0.8)))
      if (this.crowns.instanceColor) this.crowns.instanceColor.needsUpdate = true
    }
    if (this.bushes) (this.bushes.material as THREE.MeshStandardMaterial).color.set('#57a84a').lerp(white, amount * 0.8)
    for (const child of this.group.children) if (child.userData.flowers) child.visible = amount < 0.5
  }
}
