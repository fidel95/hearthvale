import type { City } from '../game/City'
import { GRID_SIZE, lotOf, type Lot, type Tile } from '../game/grid'
import { isWater } from '../game/terrain'
import { el } from './dom'
import { Sheet } from './Sheet'

// The map: the whole world at a glance, drawn as a diamond at the same angle
// as the game so it's easy to match up. Tap to jump the camera there; tap a
// lot for sale to look at buying it.

const COLORS: Record<string, string> = {
  sea: '#3d8fc6',
  owned: '#7cc46a',
  unowned: '#b9c7a6',
  sale: '#f1e4b0',
  home: '#e07a4f',
  business: '#e0b23a',
  farm: '#8a5a36',
  community: '#6c8fe0',
  utility: '#7d8b99',
  road: '#5d6168',
  decoration: '#3f8f3a',
  storage: '#a4553f',
  port: '#8a6a4a',
}

export class MapPanel {
  private sheet: Sheet
  private canvas = el('canvas', 'world-map')
  private city: City
  private getCenter: () => Tile
  private onJump: (tile: Tile) => void
  private onLot: (lot: Lot) => void

  constructor(container: HTMLElement, city: City, getCenter: () => Tile, onJump: (tile: Tile) => void, onLot: (lot: Lot) => void) {
    this.city = city
    this.getCenter = getCenter
    this.onJump = onJump
    this.onLot = onLot
    this.sheet = new Sheet(container, '🗺️ Map')
    const legend = el('div', 'map-legend')
    for (const [label, color] of [
      ['Your land', COLORS.owned],
      ['For sale', COLORS.sale],
      ['Homes', COLORS.home],
      ['Shops', COLORS.business],
      ['Farms', COLORS.farm],
      ['Community', COLORS.community],
      ['Roads', COLORS.road],
      ['Sea', COLORS.sea],
    ]) {
      const item = el('span', '', label)
      item.style.setProperty('--swatch', color)
      legend.append(item)
    }
    this.sheet.body.append(el('p', 'muted', 'Tap anywhere to go there. Tap a lot for sale to buy it.'), this.canvas, legend)
    this.canvas.addEventListener('click', (e) => this.onClick(e))
  }

  open() {
    this.sheet.open()
    this.draw()
  }

  // The diamond: tile (x, z) goes to screen (x − z, (x + z) / 2), scaled to fit.
  private layout() {
    const width = this.canvas.clientWidth || 320
    const scale = width / (2 * GRID_SIZE)
    return { width, height: width / 2, scale }
  }

  private toScreen(x: number, z: number, scale: number, width: number) {
    return { sx: width / 2 + (x - z) * scale, sy: ((x + z) / 2) * scale }
  }

  private draw() {
    const { width, height, scale } = this.layout()
    const ratio = Math.min(window.devicePixelRatio, 2)
    this.canvas.width = width * ratio
    this.canvas.height = height * ratio
    this.canvas.style.height = `${height}px`
    const ctx = this.canvas.getContext('2d')!
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.clearRect(0, 0, width, height)

    // One small diamond per tile.
    const tile = (x: number, z: number, color: string) => {
      const a = this.toScreen(x, z, scale, width)
      const b = this.toScreen(x + 1, z, scale, width)
      const c = this.toScreen(x + 1, z + 1, scale, width)
      const d = this.toScreen(x, z + 1, scale, width)
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(a.sx, a.sy)
      ctx.lineTo(b.sx, b.sy)
      ctx.lineTo(c.sx, c.sy)
      ctx.lineTo(d.sx, d.sy)
      ctx.closePath()
      ctx.fill()
    }
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        const t = { x, z }
        if (isWater(t)) tile(x, z, COLORS.sea)
        else if (this.city.ownsTile(t)) tile(x, z, COLORS.owned)
        else tile(x, z, this.city.canBuyLot(lotOf(t)) ? COLORS.sale : COLORS.unowned)
      }
    }
    for (const b of this.city.all()) {
      for (let dx = 0; dx < b.type.size.x; dx++) {
        for (let dz = 0; dz < b.type.size.z; dz++) tile(b.tile.x + dx, b.tile.z + dz, COLORS[b.type.category] ?? '#999')
      }
    }

    // Where the camera is looking.
    const center = this.getCenter()
    const p = this.toScreen(center.x + 0.5, center.z + 0.5, scale, width)
    ctx.strokeStyle = '#3b2f22'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(p.sx, p.sy, 8, 0, Math.PI * 2)
    ctx.stroke()
  }

  // Undo the diamond: from screen back to a tile.
  private onClick(e: MouseEvent) {
    const { width, scale } = this.layout()
    const rect = this.canvas.getBoundingClientRect()
    const u = (e.clientX - rect.left - width / 2) / scale // x − z
    const v = ((e.clientY - rect.top) * 2) / scale // x + z
    const t = { x: Math.floor((u + v) / 2), z: Math.floor((v - u) / 2) }
    if (t.x < 0 || t.z < 0 || t.x >= GRID_SIZE || t.z >= GRID_SIZE) return
    const lot = lotOf(t)
    this.sheet.close()
    if (this.city.canBuyLot(lot)) this.onLot(lot)
    this.onJump(t)
  }
}
