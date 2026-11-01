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
import { RIVER, RIVER_HALF_WIDTH, coastZ, isRock, isWater, riverDistance } from './terrain'

// Draws the ground: the whole world as muted land, the lots the town owns as
// lush grass (a tile grid shows while building), a sandy beach along the coast, the sea with
// gentle waves, the Highlands' river between sandy banks, and a "for sale" sign on every lot you could buy next. The
// land is rebuilt whenever it changes (rare), so it can be simple.

// Owned grass is a natural lawn: greens that drift softly across the land,
// with darker and sunnier patches. Land beyond the town is a paler green,
// still clearly not yours.
const COLORS = { owned: ['#69c055', '#93db6e', '#4ea544'], unowned: '#a8dc8c', grid: '#ffffff', sand: '#f6e3a4', sea: '#2fa3e0', river: '#3cb0e6', bank: '#d8c68e' }

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

// The lawn's texture: thousands of short blades, a little lighter or darker
// than a light gray, which the grass colors tint green. One texture covers
// LAWN_REPEAT tiles each way and repeats, its blades wrapped at the edges so
// the seams don't show. Drawn once, on a canvas.
const LAWN_REPEAT = 4
const LAWN_GRAY = 225
function lawnTexture(): THREE.CanvasTexture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = `rgb(${LAWN_GRAY},${LAWN_GRAY},${LAWN_GRAY})`
  ctx.fillRect(0, 0, size, size)
  let seed = 12345
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  ctx.lineCap = 'round'
  for (let i = 0; i < 14000; i++) {
    const x = rand() * size
    const y = rand() * size
    const length = 4 + rand() * 7
    const lean = (rand() - 0.5) * 5
    const v = rand() < 0.6 ? 150 + rand() * 50 : 245 + rand() * 10
    ctx.strokeStyle = `rgb(${v},${v},${v})`
    ctx.lineWidth = 1 + rand() * 1.2
    // A blade near an edge is drawn again across it, so the texture repeats seamlessly.
    for (const dx of x < 12 ? [0, size] : x > size - 12 ? [0, -size] : [0]) {
      for (const dy of y < 12 ? [0, size] : [0]) {
        ctx.beginPath()
        ctx.moveTo(x + dx, y + dy)
        ctx.lineTo(x + dx + lean, y + dy - length)
        ctx.stroke()
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 8
  return texture
}

// Mown stripes: every other row of tiles a shade lighter.
const STRIPE = 0.045

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
  // Tufts, flowers and mushrooms on the town's empty grass.
  private lawn: Scenery
  private lawnTimer = 0
  private lawnMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: lawnTexture(),
    // Brighter than white, so the texture's gray comes out as the grass's own green.
    color: new THREE.Color(255 / LAWN_GRAY, 255 / LAWN_GRAY, 255 / LAWN_GRAY),
  })

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
    this.lawn = new Scenery(scene, { lawn: true })
    this.sea = this.createSea()
    scene.add(this.sea, this.createBeach(), this.createRiver(RIVER_HALF_WIDTH + 0.4, COLORS.bank, 0.009), this.createRiver(RIVER_HALF_WIDTH + 0.1, COLORS.river, 0.013))

    city.onChange((event) => {
      if (event.kind === 'land') this.rebuild()
      // The price shown on every sign goes up after each purchase, and
      // whether you can afford it changes with coins.
      if (event.kind === 'coins') this.refreshSigns()
      if (['added', 'removed', 'moved', 'stored', 'restored'].includes(event.kind)) this.rebuildLawn()
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
          // And the lawn texture runs on across tiles, by where each corner is in the world.
          const pos = square.getAttribute('position')
          const colors: number[] = []
          const uvs: number[] = []
          const stripe = tile.x % 2 === 0 ? 1 + STRIPE : 1 - STRIPE
          for (let v = 0; v < pos.count; v++) {
            colors.push(...shadeAt(pos.getX(v), pos.getZ(v)).multiplyScalar(stripe).toArray())
            uvs.push(pos.getX(v) / LAWN_REPEAT, pos.getZ(v) / LAWN_REPEAT)
          }
          square.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
          square.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
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
    this.owned = new THREE.Mesh(mergeGeometries(squares), this.lawnMaterial)
    this.owned.receiveShadow = true
    for (const g of squares) g.dispose()
    const lineGeometry = new THREE.BufferGeometry()
    lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3))
    // Faint white lines: there to build by, not to look at.
    this.grid = new THREE.LineSegments(lineGeometry, new THREE.LineBasicMaterial({ color: COLORS.grid, transparent: true, opacity: 0.28 }))
    this.grid.visible = this.gridVisible
    this.scene.add(this.owned, this.grid)
    // Scenery everywhere that isn't the town's, the sea or the beach.
    this.scenery.rebuild((t) => !this.city.ownsTile(t) && t.z < coastZ(t.x) - 2 && !isRock(t) && riverDistance(t.x + 0.5, t.z + 0.5) > RIVER_HALF_WIDTH + 0.6)
    this.rebuildLawn()

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

  // The lawn's tufts and flowers, on owned tiles with nothing built. Building
  // (a road drawn tile by tile) can change many tiles quickly, so it waits a
  // moment and redoes them all once.
  private rebuildLawn() {
    window.clearTimeout(this.lawnTimer)
    this.lawnTimer = window.setTimeout(() => {
      this.lawn.rebuild(
        (t) =>
          this.city.ownsTile(t) &&
          !this.city.buildingAt(t) &&
          t.z < coastZ(t.x) - 2 &&
          !isRock(t) &&
          riverDistance(t.x + 0.5, t.z + 0.5) > RIVER_HALF_WIDTH + 0.6,
      )
    }, 150)
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
    this.lawn.setSnow(amount)
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

  // The river (or its banks, a little wider): a ribbon along its line, flat
  // on the ground at height y. It runs on under the sea at the coast.
  private createRiver(halfWidth: number, color: string, y: number) {
    const points: THREE.Vector2[] = []
    for (let i = 0; i + 1 < RIVER.length; i++) {
      const [ax, az] = RIVER[i]
      const [bx, bz] = RIVER[i + 1]
      const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.25)
      for (let k = 0; k < steps; k++) points.push(new THREE.Vector2(ax + ((bx - ax) * k) / steps, az + ((bz - az) * k) / steps))
    }
    points.push(new THREE.Vector2(...RIVER[RIVER.length - 1]))
    const half = GRID_SIZE / 2
    const positions: number[] = []
    const indices: number[] = []
    points.forEach((p, i) => {
      // Square across the average direction here, so the bends stay smooth.
      const along = points[Math.min(points.length - 1, i + 2)].clone().sub(points[Math.max(0, i - 2)]).normalize()
      for (const side of [-1, 1]) positions.push(p.x - half - along.y * halfWidth * side, y, p.y - half + along.x * halfWidth * side)
      if (i > 0) {
        const a = (i - 1) * 2
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
    })
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.4, side: THREE.DoubleSide }))
    mesh.receiveShadow = true
    return mesh
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
