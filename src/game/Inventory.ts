import { Emitter } from './events'
import type { City } from './City'
import { MATERIALS, MATERIAL_IDS, type Materials } from './items'

// The player's inventory of items: construction materials and collectibles.
// (Stored buildings are kept by City, which owns everything that has a place
// on the map; goods are kept by City too.)
//
// Each item kind remembers its count and what it all cost, so that when
// materials go into a building their cost can be added to the building's
// basis for depreciation (Taxes): construction costs are capitalized, not
// deducted. Items found for free have no cost.

export interface Stack {
  count: number
  cost: number
}

export type InventoryEvent =
  | { kind: 'items' }
  // Materials used up in construction or an upgrade, and what they had cost.
  | { kind: 'used'; materials: Materials; cost: number }

export class Inventory {
  private stacks = new Map<string, Stack>()
  private city: City
  private events = new Emitter<InventoryEvent>()

  constructor(city: City) {
    this.city = city
  }

  onChange(listener: (event: InventoryEvent) => void) {
    this.events.on(listener)
  }

  count(id: string): number {
    return this.stacks.get(id)?.count ?? 0
  }

  all(): [string, Stack][] {
    return [...this.stacks.entries()].filter(([, s]) => s.count > 0)
  }

  add(id: string, count: number, cost = 0) {
    if (count <= 0) return
    const stack = this.stacks.get(id) ?? { count: 0, cost: 0 }
    stack.count += count
    stack.cost += cost
    this.stacks.set(id, stack)
    this.emit({ kind: 'items' })
  }

  // Buy materials at their price. Buying isn't an expense: the materials
  // carry their cost until they're built into something.
  buy(materials: Materials): boolean {
    const price = this.priceOf(materials)
    if (this.city.coins < price) return false
    this.city.economy.adjust(-price)
    for (const id of MATERIAL_IDS) {
      const n = materials[id] ?? 0
      if (n > 0) this.add(id, n, n * MATERIALS[id].price!)
    }
    return true
  }

  priceOf(materials: Materials): number {
    return MATERIAL_IDS.reduce((sum, id) => sum + (materials[id] ?? 0) * MATERIALS[id].price!, 0)
  }

  // What's still needed, after counting what's in the inventory.
  missing(materials: Materials): Materials {
    const out: Materials = {}
    for (const id of MATERIAL_IDS) {
      const short = (materials[id] ?? 0) - this.count(id)
      if (short > 0) out[id] = short
    }
    return out
  }

  hasAll(materials: Materials): boolean {
    return Object.keys(this.missing(materials)).length === 0
  }

  // Use materials up. Returns their cost (average cost per unit), or null if
  // some are missing.
  use(materials: Materials): number | null {
    if (!this.hasAll(materials)) return null
    let cost = 0
    for (const id of MATERIAL_IDS) {
      const n = materials[id] ?? 0
      if (n <= 0) continue
      const stack = this.stacks.get(id)!
      const share = (stack.cost * n) / stack.count
      stack.count -= n
      stack.cost -= share
      cost += share
    }
    this.emit({ kind: 'used', materials, cost })
    this.emit({ kind: 'items' })
    return cost
  }

  // Take items away without a cost (e.g. turning in a collection).
  remove(id: string, count: number): boolean {
    const stack = this.stacks.get(id)
    if (!stack || stack.count < count) return false
    stack.cost -= (stack.cost * count) / stack.count
    stack.count -= count
    this.emit({ kind: 'items' })
    return true
  }

  toSave(): [string, Stack][] {
    return this.all().map(([id, s]) => [id, { ...s }])
  }

  load(saved: [string, Stack][]) {
    this.stacks = new Map(saved.map(([id, s]) => [id, { ...s }]))
    this.emit({ kind: 'items' })
  }

  private emit(event: InventoryEvent) {
    this.events.emit(event)
  }
}
