import * as THREE from 'three'
import type { City, PlacedBuilding } from './City'
import { sizeOf } from './City'
import { isPlot } from './buildings'
import { cropState } from './crops'
import { makeTractor } from './farmModels'
import { footprintCenter, footprintTiles, inBounds, tileToWorld, worldToTile, type Tile } from './grid'
import { findPath } from './pathfinding'
import { Polyline } from './routes'
import { isRiver, isRock } from './terrain'

// The Tractor Shed's tractor: it drives out to each field with a ripe or
// withered crop, makes a pass across it, and Game harvests (or clears) it and
// sows the same crop again (onTend), with no energy used. When nothing needs
// doing it drives home and parks in the shed.
//
// It drives over the town's own land, keeping to grass, roads and farmland
// (never through houses, shops or the river), and only while the game is open.

const SPEED = 1.4 // tiles per second
const PASS_SPEED = 0.9 // across a field
const LOOK_EVERY = 1 // seconds between looks for work
const SKIP_FOR = 30 // seconds before trying again a field it couldn't reach

interface Tractor {
  shed: PlacedBuilding
  object: THREE.Group
  wheels: THREE.Object3D[]
  line: Polyline | null
  s: number
  state: 'parked' | 'driving' | 'pass' | 'home'
  target: PlacedBuilding | null
  look: number
}

export class TractorView {
  // Harvest (or clear) a field and sow it again; Game does the farming.
  onTend: ((plot: PlacedBuilding) => void) | null = null
  private group = new THREE.Group()
  private tractors = new Map<number, Tractor>() // by shed id
  private city: City
  private unreachable = new Map<number, number>() // plot id → seconds until it's tried again
  private claimed = new Set<number>() // plots a tractor is on its way to

  constructor(scene: THREE.Scene, city: City) {
    this.city = city
    scene.add(this.group)
    city.onChange((e) => {
      if (e.kind === 'added' || e.kind === 'removed' || e.kind === 'moved' || e.kind === 'finished' || e.kind === 'stored' || e.kind === 'restored' || e.kind === 'land') this.sync()
    })
    this.sync()
  }

  // One tractor for each built shed, parked inside.
  private sync() {
    const sheds = [...this.city.all()].filter((b) => b.type.id === 'tractor-shed' && this.city.isBuilt(b))
    for (const [id, t] of this.tractors) {
      if (sheds.some((s) => s.id === id && s.tile === t.shed.tile && s.rotation === t.shed.rotation)) continue
      this.group.remove(t.object)
      if (t.target) this.claimed.delete(t.target.id)
      this.tractors.delete(id)
    }
    for (const shed of sheds) {
      if (this.tractors.has(shed.id)) continue
      const { root, wheels } = this.build()
      this.group.add(root)
      const t: Tractor = { shed, object: root, wheels, line: null, s: 0, state: 'parked', target: null, look: Math.random() }
      this.park(t)
      this.tractors.set(shed.id, t)
    }
  }

  private build() {
    const root = makeTractor()
    const wheels: THREE.Object3D[] = []
    root.traverse((o) => o.name.startsWith('wheel') && wheels.push(o))
    return { root, wheels }
  }

  private park(t: Tractor) {
    const at = footprintCenter(t.shed.tile, sizeOf(t.shed))
    t.object.position.set(at.x - 0.1, 0.03, at.z - 0.1)
    t.object.rotation.y = -Math.PI / 2 // nose out the open front (+z)
    t.state = 'parked'
    t.line = null
  }

  // Where it can drive: the town's own land, on grass, roads or farmland.
  private passable = (tile: Tile, goal: PlacedBuilding | null): boolean => {
    if (!inBounds(tile) || !this.city.ownsTile(tile) || isRock(tile)) return false
    const b = this.city.buildingAt(tile)
    if (!b) return !isRiver(tile)
    return b.type.category === 'road' || b.type.category === 'farm' || b === goal
  }

  private shedTile(t: Tractor): Tile {
    // The front middle of the shed (its open side faces +z when not turned).
    const s = sizeOf(t.shed)
    return { x: t.shed.tile.x + Math.floor(s.x / 2), z: t.shed.tile.z + s.z - 1 }
  }

  private here(t: Tractor): Tile {
    return worldToTile(t.object.position) ?? this.shedTile(t)
  }

  // A field that needs the tractor: ripe or withered, not already claimed.
  private findWork(t: Tractor, now: number): { plot: PlacedBuilding; path: Tile[] } | null {
    const from = t.state === 'parked' ? this.shedTile(t) : this.here(t)
    const fields = [...this.city.all()]
      .filter((b) => isPlot(b.type) && this.city.isBuilt(b) && !this.claimed.has(b.id) && !this.unreachable.has(b.id))
      .filter((b) => {
        const stage = cropState(b.crop, now).stage
        return stage === 'ripe' || stage === 'withered'
      })
      .sort((a, b) => Math.hypot(a.tile.x - from.x, a.tile.z - from.z) - Math.hypot(b.tile.x - from.x, b.tile.z - from.z))
    for (const plot of fields.slice(0, 4)) {
      const path = findPath(from, plot.tile, (tile) => this.passable(tile, plot), { maxVisited: 4000 })
      if (path) return { plot, path }
      this.unreachable.set(plot.id, SKIP_FOR)
    }
    return null
  }

  private drive(t: Tractor, path: Tile[]) {
    const points = path.map((tile) => tileToWorld(tile))
    // Start from where it is, so it doesn't jump to the tile's middle.
    points.unshift(t.object.position.clone())
    t.line = new Polyline(points.map((p) => ({ x: p.x, z: p.z })))
    t.s = 0
  }

  update(dt: number) {
    if (this.tractors.size === 0) return
    const now = Date.now()
    for (const [id, wait] of this.unreachable) {
      if (wait - dt <= 0) this.unreachable.delete(id)
      else this.unreachable.set(id, wait - dt)
    }
    for (const t of this.tractors.values()) this.step(t, dt, now)
  }

  private step(t: Tractor, dt: number, now: number) {
    // Parked, or on the way home: look for work now and then.
    if (t.state === 'parked' || t.state === 'home') {
      t.look -= dt
      if (t.look <= 0) {
        t.look = LOOK_EVERY
        const work = this.findWork(t, now)
        if (work) this.go(t, work)
      }
    }
    if (!t.line) return
    const speed = t.state === 'pass' ? PASS_SPEED : SPEED
    t.s = Math.min(t.line.length, t.s + speed * dt)
    const pose = t.line.at(t.s)
    t.object.position.set(pose.x, 0.03 + Math.abs(Math.sin(t.s * 9)) * 0.008, pose.z)
    t.object.rotation.y = pose.angle
    for (const w of t.wheels) w.rotation.z -= (speed * dt) / (w.name === 'wheel-back' ? 0.17 : 0.09)
    if (t.s < t.line.length) return

    if (t.state === 'driving') {
      // At the field: one pass across it, corner to corner.
      const plot = t.target!
      const still = this.city.get(plot.id) === plot && ['ripe', 'withered'].includes(cropState(plot.crop, now).stage)
      if (!still) return this.next(t, now)
      const tiles = footprintTiles(plot.tile, sizeOf(plot))
      const far = tiles[tiles.length - 1]
      t.state = 'pass'
      this.drive(t, [plot.tile, { x: plot.tile.x, z: far.z }, far])
      return
    }
    if (t.state === 'pass') {
      const plot = t.target!
      if (this.city.get(plot.id) === plot) this.onTend?.(plot)
      return this.next(t, now)
    }
    if (t.state === 'home') this.park(t)
  }

  private go(t: Tractor, work: { plot: PlacedBuilding; path: Tile[] }) {
    t.target = work.plot
    this.claimed.add(work.plot.id)
    t.state = 'driving'
    this.drive(t, work.path)
  }

  // On to the next field, or home.
  private next(t: Tractor, now: number) {
    if (t.target) this.claimed.delete(t.target.id)
    t.target = null
    const work = this.findWork(t, now)
    if (work) return this.go(t, work)
    const path = findPath(this.here(t), this.shedTile(t), (tile) => this.passable(tile, t.shed), { maxVisited: 4000 })
    t.state = 'home'
    if (path) this.drive(t, path)
    else this.park(t)
  }
}
