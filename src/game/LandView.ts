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
  type Lot,
} from './grid'

// Draws the ground: the whole world as muted land, the lots the town owns as
// bright grass with a tile grid, and a "for sale" sign on every lot you could
// buy next. Rebuilt whenever the land changes (rare), so it can be simple.

const COLORS = { owned: '#7cc46a', unowned: '#a3b98c', grid: '#5a9a4c' }

export class LandView {
  // Called when a "for sale" sign is clicked.
  onLotClick?: (lot: Lot) => void

  private scene: THREE.Scene
  private city: City
  private owned: THREE.Mesh | null = null
  private grid: THREE.LineSegments | null = null
  private signs = new Map<string, CSS2DObject>()

  constructor(scene: THREE.Scene, city: City) {
    this.scene = scene
    this.city = city

    // The whole world, under everything.
    const world = new THREE.Mesh(
      new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: COLORS.unowned }),
    )
    world.receiveShadow = true
    scene.add(world)

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

    // Owned land: one merged mesh of grass squares, just above the world plane.
    const squares: THREE.BufferGeometry[] = []
    const lines: number[] = []
    for (const { lot } of this.city.ownedLots()) {
      const center = footprintCenter(lotCorner(lot), LOT_FOOTPRINT)
      squares.push(new THREE.PlaneGeometry(LOT_SIZE, LOT_SIZE).rotateX(-Math.PI / 2).translate(center.x, 0.005, center.z))
      // Tile grid lines for this lot, as pairs of points.
      const x0 = center.x - LOT_SIZE / 2
      const z0 = center.z - LOT_SIZE / 2
      for (let i = 0; i <= LOT_SIZE; i++) {
        lines.push(x0 + i, 0.01, z0, x0 + i, 0.01, z0 + LOT_SIZE)
        lines.push(x0, 0.01, z0 + i, x0 + LOT_SIZE, 0.01, z0 + i)
      }
    }
    this.owned = new THREE.Mesh(mergeGeometries(squares), new THREE.MeshStandardMaterial({ color: COLORS.owned }))
    this.owned.receiveShadow = true
    for (const g of squares) g.dispose()
    const lineGeometry = new THREE.BufferGeometry()
    lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3))
    this.grid = new THREE.LineSegments(lineGeometry, new THREE.LineBasicMaterial({ color: COLORS.grid }))
    this.scene.add(this.owned, this.grid)

    // A sign on every lot that could be bought next.
    for (const sign of this.signs.values()) sign.removeFromParent()
    this.signs.clear()
    for (let x = 0; x < LOTS_PER_SIDE; x++) {
      for (let z = 0; z < LOTS_PER_SIDE; z++) {
        const lot = { x, z }
        if (this.city.canBuyLot(lot)) this.addSign(lot)
      }
    }
    this.refreshSigns()
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
