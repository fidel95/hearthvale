import type { City } from './City'
import { sizeOf } from './City'
import { Emitter } from './events'
import { GRID_SIZE, LOT_SIZE, footprintTiles, inBounds, lotCorner, type Lot, type Tile } from './grid'
import type { Inventory } from './Inventory'
import type { MaterialId } from './items'
import type { Player } from './Player'
import { coastZ, isRiver, isRock, isWater } from './terrain'

// The wilds: trees, boulders, bushes and old stumps growing on the town's own
// land. New land comes with a few, and now and then one springs up on an
// empty tile. Tapping one clears it, for a point of energy: some coins, a
// little XP, and now and then lumber (trees, stumps) or bricks (boulders).
//
// They never get in the way: building on a spot clears whatever grows there,
// for nothing. Like the market's orders, they're saved as they are.

export type WildKind = 'tree' | 'pine' | 'rock' | 'bush' | 'stump'

export interface WildType {
  id: WildKind
  name: string
  icon: string
  coins: number
  xp: number
  // A material it sometimes leaves behind, and how often (0 to 1).
  material?: { id: MaterialId; chance: number }
  weight: number // how often it grows, against the others
}

export const WILDS: Record<WildKind, WildType> = {
  tree: { id: 'tree', name: 'Tree', icon: '🌳', coins: 12, xp: 2, material: { id: 'lumber', chance: 0.5 }, weight: 3 },
  pine: { id: 'pine', name: 'Pine', icon: '🌲', coins: 12, xp: 2, material: { id: 'lumber', chance: 0.5 }, weight: 2 },
  rock: { id: 'rock', name: 'Boulder', icon: '🪨', coins: 10, xp: 2, material: { id: 'bricks', chance: 0.4 }, weight: 2 },
  bush: { id: 'bush', name: 'Bush', icon: '🌿', coins: 5, xp: 1, weight: 3 },
  stump: { id: 'stump', name: 'Old stump', icon: '🪵', coins: 6, xp: 1, material: { id: 'lumber', chance: 0.25 }, weight: 1 },
}
const KINDS = Object.values(WILDS)

export const WILDS_PER_NEW_LOT = 6 // about this many (one or two more or fewer)
export const GROW_EVERY_MS = 30 * 60_000 // one springs up every half hour…
export const WILDS_PER_LOT = 1 // …while there are fewer than this per lot owned

export interface Wild {
  tile: Tile
  kind: WildKind
}

export interface WildsSave {
  list: [number, number, WildKind][] // x, z, kind
  nextGrowAt: number
}

// What clearing one gave.
export interface Cleared {
  wild: Wild
  coins: number
  xp: number
  material: MaterialId | null
}

const index = (t: Tile) => t.z * GRID_SIZE + t.x

export class Wilds {
  private wilds = new Map<number, Wild>()
  private nextGrowAt = 0
  private city: City
  private player: Player
  private inventory: Inventory
  private rand: () => number
  private events = new Emitter<{ kind: 'changed' }>()

  constructor(city: City, player: Player, inventory: Inventory, rand: () => number = Math.random) {
    this.city = city
    this.player = player
    this.inventory = inventory
    this.rand = rand
    city.onChange((e) => {
      if (e.kind === 'land' && e.bought) this.spawnOnLot(e.bought.lot)
      // Building on a spot clears it.
      if (e.kind === 'added' || e.kind === 'moved' || e.kind === 'restored') {
        let changed = false
        for (const t of footprintTiles(e.building.tile, sizeOf(e.building))) changed = this.wilds.delete(index(t)) || changed
        if (changed) this.events.emit({ kind: 'changed' })
      }
    })
  }

  onChange(listener: () => void) {
    this.events.on(listener)
  }

  all(): Iterable<Wild> {
    return this.wilds.values()
  }

  get count() {
    return this.wilds.size
  }

  at(tile: Tile): Wild | undefined {
    return this.wilds.get(index(tile))
  }

  // Can something grow here: the town's own open land, off the beach.
  canGrow(tile: Tile): boolean {
    if (!inBounds(tile) || !this.city.ownsTile(tile) || this.wilds.has(index(tile))) return false
    if (isWater(tile) || isRock(tile) || isRiver(tile) || tile.z >= coastZ(tile.x) - 2) return false
    return !this.city.buildingAt(tile)
  }

  private pickKind(): WildKind {
    const total = KINDS.reduce((sum, k) => sum + k.weight, 0)
    let at = this.rand() * total
    for (const k of KINDS) if ((at -= k.weight) < 0) return k.id
    return 'bush'
  }

  private grow(tile: Tile, kind = this.pickKind()) {
    this.wilds.set(index(tile), { tile, kind })
  }

  // A new lot comes with a few trees, rocks and bushes on it.
  spawnOnLot(lot: Lot, about = WILDS_PER_NEW_LOT) {
    const corner = lotCorner(lot)
    const open: Tile[] = []
    for (let i = 0; i < LOT_SIZE; i++) {
      for (let j = 0; j < LOT_SIZE; j++) {
        const t = { x: corner.x + i, z: corner.z + j }
        if (this.canGrow(t)) open.push(t)
      }
    }
    const n = Math.min(open.length, about - 1 + Math.floor(this.rand() * 3))
    for (let i = 0; i < n; i++) this.grow(open.splice(Math.floor(this.rand() * open.length), 1)[0])
    if (n > 0) this.events.emit({ kind: 'changed' })
  }

  // Now and then something springs up on an empty tile (Game calls this now
  // and then; after time away, it catches up).
  update(now: number) {
    if (this.nextGrowAt === 0) this.nextGrowAt = now + GROW_EVERY_MS
    let grew = false
    const cap = [...this.city.ownedLots()].length * WILDS_PER_LOT
    while (now >= this.nextGrowAt) {
      this.nextGrowAt += GROW_EVERY_MS
      if (this.wilds.size >= cap) {
        // Full up: no need to count through every half hour of a long absence.
        this.nextGrowAt = Math.max(this.nextGrowAt, now + GROW_EVERY_MS)
        break
      }
      const tile = this.randomOpenTile()
      if (!tile) break
      this.grow(tile)
      grew = true
    }
    if (grew) this.events.emit({ kind: 'changed' })
  }

  private randomOpenTile(): Tile | null {
    const lots = [...this.city.ownedLots()]
    for (let tries = 0; tries < 40; tries++) {
      const corner = lotCorner(lots[Math.floor(this.rand() * lots.length)].lot)
      const t = { x: corner.x + Math.floor(this.rand() * LOT_SIZE), z: corner.z + Math.floor(this.rand() * LOT_SIZE) }
      if (this.canGrow(t)) return t
    }
    return null
  }

  // Clear what grows on a tile, for a point of energy. Null if there's
  // nothing there or no energy left.
  clear(tile: Tile, now: number): Cleared | null {
    const wild = this.at(tile)
    if (!wild || !this.player.hasEnergy(now)) return null
    const type = WILDS[wild.kind]
    this.wilds.delete(index(tile))
    const material = type.material && this.rand() < type.material.chance ? type.material.id : null
    // The Player takes the energy and gives the XP when the City reports it.
    this.city.announce({ kind: 'wildCleared', tile, wild: wild.kind, coins: type.coins, xp: type.xp })
    this.city.economy.award(type.coins, 'Clearing land')
    if (material) this.inventory.add(material, 1)
    this.events.emit({ kind: 'changed' })
    return { wild, coins: type.coins, xp: type.xp, material }
  }

  toSave(): WildsSave {
    return { list: [...this.wilds.values()].map((w) => [w.tile.x, w.tile.z, w.kind]), nextGrowAt: this.nextGrowAt }
  }

  load(save: WildsSave | undefined) {
    this.wilds.clear()
    for (const [x, z, kind] of save?.list ?? []) {
      const tile = { x, z }
      if (WILDS[kind] && this.canGrow(tile)) this.grow(tile, kind)
    }
    this.nextGrowAt = save?.nextGrowAt ?? 0
    this.events.emit({ kind: 'changed' })
  }
}
