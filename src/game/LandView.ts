import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import type { City } from './City'
import {
  GRID_SIZE,
  LOTS_PER_SIDE,
  LOT_FOOTPRINT,
  LOT_SIZE,
  footprintCenter,
  lotCorner,
  lotKey,
  tileToWorld,
  type Lot,
} from './grid'
import { Scenery } from './scenery'
import { coastZ, isRock, isWater } from './terrain'

// Draws the ground: the whole world as muted land, the lots the town owns as
// lush grass (a tile grid shows while building), a sandy beach along the coast, the sea with
// gentle waves, and a "for sale" sign on every lot you could buy next. The
// land is rebuilt whenever it changes (rare), so it can be simple.

// Owned grass is a natural lawn: greens that drift softly across the land,
// with darker and sunnier patches. Land beyond the town is a paler green,
// still clearly not yours.
const COLORS = { owned: ['#69c055', '#93db6e', '#4ea544'], unowned: '#a8dc8c', grid: '#ffffff', sand: '#f6e3a4', sea: '#2fa3e0' }

// Smooth noise (0 to 1) over the ground, so the grass varies gently instead
// of tile by tile: a few overlapping waves at different angles.
function grassNoise(x: number, z: number): number {
  const n =
    Math.sin(x * 0.37 + z * 0.23) * 0.35 +
    Math.sin(x * -0.19 + z * 0.43 + 1.7) * 0.3 +
    Math.sin(x * 0.71 - z * 0.59 + 4.1) * 0.25 +
    Math.sin(x * 1.9 + z * 1.6) * 0.1
  return Math.min(1, Math.max(0, n * 0.75 + 0.5))
}
// How far the sea reaches past the edges of the world, so it fades into the distance.
const SEA_BEYOND = 40

export class LandView {
  // Called when a "for sale" sign is clicked.
  onLotClick?: (lot: Lot) => void

  private scene: THREE.Scene
  private city: City
  private owned: THREE.Mesh | null = null
  private grid: THREE.LineSegments | null = null
  private signs = new Map<string, CSS2DObject>()
  private sea: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
  private gridVisible = true
  // With reduced motion the sea holds still.
  calmSea = false

  private showSigns: boolean
  private scenery: Scenery
  private snowSheet: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial> | null = null

  // showSigns: false for a neighbor's town, where there's nothing for you to buy.
  constructor(scene: THREE.Scene, city: City, { showSigns = true } = {}) {
    this.scene = scene
    this.city = city
    this.showSigns = showSigns

    // The whole world, under everything.
    const world = new THREE.Mesh(
      new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: COLORS.unowned }),
    )
    world.receiveShadow = true
    scene.add(world)
    this.scenery = new Scenery(scene)
    this.sea = this.createSea()
    scene.add(this.sea, this.createBeach())

    city.onChange((event) => {
      if (event.kind === 'land') this.rebuild()
      // The price shown on every sign goes up after each purchase, and
      // whether you can afford it changes with coins.
      if (event.kind === 'coins') this.refreshSigns()
    })
    this.rebuild()
  }

  private rebuild() {
    for (const obj of [this.owned, this.grid]) {
      if (!obj) continue
      obj.removeFromParent()
      obj.geometry.dispose()
    }

    // Owned land: one merged mesh of grass squares, just above the world
    // plane, each tile colored by vertex colors in one of two greens.
    const squares: THREE.BufferGeometry[] = []
    const lines: number[] = []
    const [base, sunny, shady] = COLORS.owned.map((c) => new THREE.Color(c))
    const shadeAt = (x: number, z: number) => {
      const n = grassNoise(x, z)
      return n > 0.5 ? base.clone().lerp(sunny, (n - 0.5) * 2) : base.clone().lerp(shady, (0.5 - n) * 2)
    }
    for (const { lot } of this.city.ownedLots()) {
      const center = footprintCenter(lotCorner(lot), LOT_FOOTPRINT)
      // Grass up to the shore (the sea covers the rest).
      for (let i = 0; i < LOT_SIZE; i++) {
        for (let j = 0; j < LOT_SIZE; j++) {
          const tile = { x: lotCorner(lot).x + i, z: lotCorner(lot).z + j }
          if (tile.z >= coastZ(tile.x)) continue
          const c = tileToWorld(tile)
          const square = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(c.x, 0.005, c.z)
          // Each corner takes the grass color at its spot, so colors blend smoothly across tiles.
          const pos = square.getAttribute('position')
          const colors: number[] = []
          for (let v = 0; v < pos.count; v++) colors.push(...shadeAt(pos.getX(v), pos.getZ(v)).toArray())
          square.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
          squares.push(square)
        }
      }
      // Tile grid lines for this lot, as pairs of points.
      const x0 = center.x - LOT_SIZE / 2
      const z0 = center.z - LOT_SIZE / 2
      for (let i = 0; i <= LOT_SIZE; i++) {
        lines.push(x0 + i, 0.01, z0, x0 + i, 0.01, z0 + LOT_SIZE)
        lines.push(x0, 0.01, z0 + i, x0 + LOT_SIZE, 0.01, z0 + i)
      }
    }
    this.owned = new THREE.Mesh(mergeGeometries(squares), new THREE.MeshStandardMaterial({ vertexColors: true }))
    this.owned.receiveShadow = true
    for (const g of squares) g.dispose()
    const lineGeometry = new THREE.BufferGeometry()
    lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3))
    // Faint white lines: there to build by, not to look at.
    this.grid = new THREE.LineSegments(lineGeometry, new THREE.LineBasicMaterial({ color: COLORS.grid, transparent: true, opacity: 0.28 }))
    this.grid.visible = this.gridVisible
    this.scene.add(this.owned, this.grid)
    // Scenery everywhere that isn't the town's, the sea or the beach.
    this.scenery.rebuild((t) => !this.city.ownsTile(t) && t.z < coastZ(t.x) - 2 && !isRock(t))

    // A sign on every lot that could be bought next.
    for (const sign of this.signs.values()) sign.removeFromParent()
    this.signs.clear()
    for (let x = 0; x < LOTS_PER_SIDE; x++) {
      for (let z = 0; z < LOTS_PER_SIDE; z++) {
        const lot = { x, z }
        if (this.showSigns && this.city.canBuyLot(lot)) this.addSign(lot)
      }
    }
    this.refreshSigns()
  }

  // Snow mode: a blanket of snow over the land (roads, farm fields and the
  // sea stand above it, so they stay clear), and white trees.
  setSnow(amount: number) {
    if (!this.snowSheet) {
      this.snowSheet = new THREE.Mesh(
        new THREE.PlaneGeometry(260, 260).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: '#f4f8fb', transparent: true, opacity: 0, depthWrite: false }),
      )
      this.snowSheet.position.y = 0.008
      this.snowSheet.receiveShadow = true
      this.scene.add(this.snowSheet)
    }
    this.snowSheet.material.opacity = amount * 0.92
    this.snowSheet.visible = amount > 0.01
    this.scenery.setSnow(amount)
  }

  // Trees in the countryside sway in the breeze.
  sway(seconds: number) {
    this.scenery.sway(seconds)
  }

  setGridVisible(visible: boolean) {
    this.gridVisible = visible
    if (this.grid) this.grid.visible = visible
  }

  // Called every frame: a slow swell across the sea.
  update(seconds: number) {
    if (this.calmSea) seconds = 0
    const pos = this.sea.geometry.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      // Kept above the ground plane (y = 0) even in the troughs.
      pos.setY(i, 0.06 + 0.03 * Math.sin(seconds * 1.2 + x * 0.6 + z * 0.4))
    }
    // flatShading works out lighting per triangle on the GPU, so moving the
    // vertices is enough: no need to recompute normals every frame.
    pos.needsUpdate = true
  }

  // The sea: one strip per world column, from the coast out past the world's
  // edge, cut into 1-tile segments so the waves have vertices to move.
  private createSea() {
    const strips: THREE.BufferGeometry[] = []
    for (let x = -SEA_BEYOND; x < GRID_SIZE + SEA_BEYOND; x++) {
      const from = x >= 0 && x < GRID_SIZE ? coastZ(x) : coastZ(Math.max(0, Math.min(GRID_SIZE - 1, x)))
      const length = GRID_SIZE + SEA_BEYOND - from
      const start = tileToWorld({ x, z: from })
      strips.push(new THREE.PlaneGeometry(1, length, 1, length).rotateX(-Math.PI / 2).translate(start.x, 0, start.z - 0.5 + length / 2))
    }
    const geometry = mergeGeometries(strips)
    for (const g of strips) g.dispose()
    return new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ color: COLORS.sea, roughness: 0.35, metalness: 0.1, flatShading: true }),
    )
  }

  // Sand on every land tile that touches the sea.
  private createBeach() {
    const tiles: THREE.BufferGeometry[] = []
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let z = coastZ(x) - 2; z < coastZ(x); z++) {
        const tile = { x, z }
        const touches = [
          { x: x + 1, z },
          { x: x - 1, z },
          { x, z: z + 1 },
        ].some(isWater)
        if (!touches) continue
        const c = tileToWorld(tile)
        tiles.push(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(c.x, 0.012, c.z))
      }
    }
    const mesh = new THREE.Mesh(mergeGeometries(tiles), new THREE.MeshStandardMaterial({ color: COLORS.sand }))
    mesh.receiveShadow = true
    for (const g of tiles) g.dispose()
    return mesh
  }

  private addSign(lot: Lot) {
    const el = document.createElement('button')
    el.className = 'land-sign'
    el.title = 'Land for sale'
    el.addEventListener('click', () => this.onLotClick?.(lot))
    const sign = new CSS2DObject(el)
    sign.center.set(0.5, 1)
    sign.position.copy(footprintCenter(lotCorner(lot), LOT_FOOTPRINT)).setY(0.3)
    this.signs.set(lotKey(lot), sign)
    this.scene.add(sign)
  }

  private refreshSigns() {
    const price = this.city.nextLotPrice
    const text = `🏷️ 🪙 ${price.toLocaleString()}`
    for (const sign of this.signs.values()) {
      if (sign.element.textContent !== text) sign.element.textContent = text
      sign.element.classList.toggle('unaffordable', this.city.coins < price)
    }
  }
}
