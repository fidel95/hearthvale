import { isPlot } from './buildings'
import type { City } from './City'
import { CROP_TYPES } from './crops'
import { Emitter } from './events'
import type { Player } from './Player'
import { FARM_PRODUCT_IDS, PRODUCTS, marketValue, type ProductId, type Recipe } from './products'

// The Farmers' Market: it buys any farm product (products.ts) at its price,
// and posts orders, a few farm products wanted together, that pay well over
// the price plus XP. An order is only ever for things the farm can make right
// now (its pens, orchards and workshops, and crops unlocked at your level).
// Delivering one brings a new order a little later; skipping one, later still.
//
// Orders are saved as they're posted, so they don't change when the game reloads.

export const ORDER_SLOTS = 3
export const NEXT_ORDER_MS = 60_000 // after delivering
export const SKIP_ORDER_MS = 10 * 60_000
export const ORDER_PREMIUM = 1.6 // an order pays this many times the market price
const MAX_UNITS = 12

export interface Order {
  items: Recipe
  coins: number
  xp: number
}

export interface MarketSave {
  orders: (Order | null)[]
  nextAt: number[] // when each empty slot gets its next order
}

export const MARKET_ID = 'farmers-market'

// The farm products this town can make right now.
export function makeableProducts(city: City, level: number): ProductId[] {
  const made = new Set<ProductId>()
  for (const b of city.all()) {
    if (!city.isBuilt(b)) continue
    if (b.type.produce) made.add(b.type.produce.product)
    const f = b.type.factory
    if (f?.recipe && PRODUCTS[f.product].farm) made.add(f.product)
  }
  if ([...city.all()].some((b) => isPlot(b.type))) {
    for (const crop of CROP_TYPES) if (crop.produce && crop.unlockLevel <= level) made.add(crop.produce.product)
  }
  return FARM_PRODUCT_IDS.filter((id) => made.has(id))
}

// A new order: one to three of the products, about (20 + 6 × level) coins'
// worth of each at market price (levels past 20 add no more), and never more
// than a dozen of one thing.
export function makeOrder(products: ProductId[], level: number, rand: () => number = Math.random): Order | null {
  if (products.length === 0) return null
  const pool = [...products]
  const kinds = Math.min(pool.length, 1 + Math.floor(rand() * 3))
  const items: Recipe = {}
  for (let i = 0; i < kinds; i++) {
    const id = pool.splice(Math.floor(rand() * pool.length), 1)[0]
    const budget = (20 + 6 * Math.min(level, 20)) * (0.7 + rand() * 0.6)
    items[id] = Math.max(1, Math.min(MAX_UNITS, Math.round(budget / PRODUCTS[id].price!)))
  }
  const value = marketValue(items)
  return { items, coins: Math.round(value * ORDER_PREMIUM), xp: 5 + Math.round(value / 12) }
}

export class FarmMarket {
  private _orders: (Order | null)[] = Array(ORDER_SLOTS).fill(null)
  private nextAt: number[] = Array(ORDER_SLOTS).fill(0)
  private city: City
  private player: Player
  private rand: () => number
  private events = new Emitter<{ kind: 'changed' }>()

  constructor(city: City, player: Player, rand: () => number = Math.random) {
    this.city = city
    this.player = player
    this.rand = rand
  }

  onChange(listener: () => void) {
    this.events.on(listener)
  }

  get orders(): readonly (Order | null)[] {
    return this._orders
  }

  // When an empty slot gets its next order.
  nextOrderAt(slot: number): number {
    return this.nextAt[slot]
  }

  // Does the town have a Farmers' Market?
  isOpen(): boolean {
    return [...this.city.all()].some((b) => b.type.id === MARKET_ID && this.city.isBuilt(b))
  }

  // Post new orders in empty slots whose wait is over (Game calls this now and then).
  refresh(now: number) {
    if (!this.isOpen()) return
    const products = makeableProducts(this.city, this.player.level)
    let changed = false
    for (let i = 0; i < ORDER_SLOTS; i++) {
      if (this._orders[i] || now < this.nextAt[i]) continue
      const order = makeOrder(products, this.player.level, this.rand)
      if (!order) break
      this._orders[i] = order
      changed = true
    }
    if (changed) this.events.emit({ kind: 'changed' })
  }

  // Can storage fill this order?
  canDeliver(order: Order): boolean {
    return Object.entries(order.items).every(([id, n]) => this.city.products[id as ProductId] >= (n ?? 0))
  }

  // Is there an order storage can fill now (for the market's bubble)?
  anyDeliverable(): boolean {
    return this._orders.some((o) => o && this.canDeliver(o))
  }

  deliver(slot: number, now: number): Order | null {
    const order = this._orders[slot]
    if (!order || !this.canDeliver(order)) return null
    if (!this.city.production.sell(order.items, order.coins, { order: true })) return null
    this.player.grantXp(order.xp)
    this._orders[slot] = null
    this.nextAt[slot] = now + NEXT_ORDER_MS
    this.events.emit({ kind: 'changed' })
    return order
  }

  skip(slot: number, now: number) {
    if (!this._orders[slot]) return
    this._orders[slot] = null
    this.nextAt[slot] = now + SKIP_ORDER_MS
    this.events.emit({ kind: 'changed' })
  }

  // Sell some of one farm product at its price. Returns the coins.
  sell(id: ProductId, units: number): number {
    const price = PRODUCTS[id].price
    if (!price || units <= 0 || !this.isOpen()) return 0
    const coins = price * units
    return this.city.production.sell({ [id]: units }, coins) ? coins : 0
  }

  toSave(): MarketSave {
    return { orders: [...this._orders], nextAt: [...this.nextAt] }
  }

  load(save: MarketSave | undefined) {
    this._orders = Array.from({ length: ORDER_SLOTS }, (_, i) => save?.orders[i] ?? null)
    this.nextAt = Array.from({ length: ORDER_SLOTS }, (_, i) => save?.nextAt[i] ?? 0)
    this.events.emit({ kind: 'changed' })
  }
}
