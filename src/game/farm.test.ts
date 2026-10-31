import { describe, expect, it } from 'vitest'
import { BUILDINGS_BY_ID, isPlot } from './buildings'
import { CROPS_BY_ID, masteryBonus } from './crops'
import { GameState } from './GameState'
import { FarmMarket, makeOrder, makeableProducts, NEXT_ORDER_MS, ORDER_PREMIUM, SKIP_ORDER_MS } from './market'
import { PRODUCTS, inputsText, marketValue } from './products'
import { reload } from '../tests/helpers'

const b = (id: string) => BUILDINGS_BY_ID.get(id)!
const at = (x: number, z: number) => ({ x: 20 + x, z: 20 + z })
const wheat = CROPS_BY_ID.get('wheat')!

// A farm with water and power, so everything on it works.
function farm() {
  const state = new GameState()
  state.player.grantXp(100_000)
  state.city.economy.adjust(100_000)
  for (const [id, x] of [['water-tower', 0], ['power-plant', 2]] as const) expect(state.city.place(b(id), at(x, 8), { free: true })).not.toBeNull()
  return state
}

const place = (state: GameState, id: string, x: number, z: number) => {
  const placed = state.city.place(b(id), at(x, z), { free: true, now: 0 })!
  expect(placed).toBeTruthy()
  placed.construction = null
  return placed
}

describe('Animal products and orchards', () => {
  it('a pen puts its produce in storage when collected, besides the coins', () => {
    const state = farm()
    const coop = place(state, 'chicken-coop', 0, 0)
    const ready = coop.readyAt
    expect(state.city.production.collect(coop.id, ready)).toBeGreaterThan(0)
    expect(state.city.products.eggs).toBe(b('chicken-coop').produce!.units)
  })

  it('an orchard is picked again and again', () => {
    const state = farm()
    const trees = place(state, 'apple-orchard', 0, 0)
    const { seconds } = b('apple-orchard').income!
    state.city.production.collect(trees.id, trees.readyAt)
    state.city.production.collect(trees.id, trees.readyAt + seconds * 1000)
    expect(state.city.products.apples).toBe(2 * b('apple-orchard').produce!.units)
  })

  it('produce only takes the room storage has', () => {
    const state = farm()
    const coop = place(state, 'chicken-coop', 0, 0)
    state.city.economy.changeGoods(state.city.economy.room())
    state.city.production.collect(coop.id, coop.readyAt)
    expect(state.city.products.eggs).toBe(0)
  })

  it('pens, orchards, workshops, the market and the shed are not crop plots', () => {
    expect(isPlot(b('farm-plot'))).toBe(true)
    for (const id of ['chicken-coop', 'apple-orchard', 'bakehouse', 'farmers-market', 'tractor-shed']) expect(isPlot(b(id))).toBe(false)
  })
})

describe('Crops that give farm products', () => {
  it('a wheat harvest puts wheat in storage too', () => {
    const state = farm()
    const plot = place(state, 'farm-plot', 0, 0)
    state.city.production.plant(plot.id, wheat, { now: 0 })
    state.city.production.harvest(plot.id, wheat.growSeconds * 1000)
    expect(state.city.products.wheat).toBe(wheat.produce!.units)
  })
})

describe('Farm workshops', () => {
  it('the Bakehouse takes its recipe from storage and makes bread', () => {
    const state = farm()
    const bakehouse = place(state, 'bakehouse', 0, 0)
    const f = b('bakehouse').factory!
    expect(inputsText(f)).toBe('🌾 6 + 🥚 2')
    expect(state.city.production.startBatch(bakehouse.id, 0)).toBe(false) // nothing in storage
    state.city.economy.changeProduct('wheat', 6)
    state.city.economy.changeProduct('eggs', 1)
    expect(state.city.production.startBatch(bakehouse.id, 0)).toBe(false) // an egg short
    state.city.economy.changeProduct('eggs', 1)
    const goods = state.city.goods
    expect(state.city.production.startBatch(bakehouse.id, 0)).toBe(true)
    expect(state.city.products.wheat).toBe(0)
    expect(state.city.products.eggs).toBe(0)
    expect(state.city.goods).toBe(goods) // no goods used
    expect(state.city.production.collectBatch(bakehouse.id, f.seconds * 1000)).toBe(f.output)
    expect(state.city.products.bread).toBe(f.output)
  })

  it('crafting is worth it: each workshop makes more than its recipe sells for', () => {
    for (const id of ['bakehouse', 'dairy', 'winery']) {
      const f = b(id).factory!
      expect(PRODUCTS[f.product].price! * f.output).toBeGreaterThan(marketValue(f.recipe!) * 1.2)
    }
  })
})

describe('Crop mastery', () => {
  it('each star makes harvests bigger and worth more XP', () => {
    const plain = farm()
    const mastered = farm()
    mastered.goals.load({ counts: [['c:wheat', 200]], stars: [['c:wheat', 3]], steps: [] })
    const harvest = (state: GameState) => {
      const plot = place(state, 'farm-plot', 0, 0)
      state.city.production.plant(plot.id, wheat, { now: 0 })
      return { coins: state.city.production.harvestValue(plot, wheat), xp: state.player.xp, plot }
    }
    const a = harvest(plain)
    const m = harvest(mastered)
    expect(m.coins).toBe(Math.round(a.coins * (1 + masteryBonus(3))))
    const xpBefore = mastered.player.xp
    mastered.city.production.harvest(m.plot.id, wheat.growSeconds * 1000)
    expect(mastered.player.xp - xpBefore).toBeGreaterThanOrEqual(wheat.xp + 3)
  })
})

describe('The tractor', () => {
  it('harvests a ripe field and sows it again, using no energy', () => {
    const state = farm()
    const plot = place(state, 'farm-plot', 0, 0)
    state.city.production.plant(plot.id, wheat, { now: 0 })
    const ripe = wheat.growSeconds * 1000
    const energy = state.player.energy(ripe)
    expect(state.city.production.tend(plot.id, ripe)).toBe(true)
    expect(plot.crop).toEqual({ cropId: 'wheat', plantedAt: ripe })
    expect(state.player.energy(ripe)).toBe(energy)
  })

  it('clears a withered field and sows it again; leaves a growing one alone', () => {
    const state = farm()
    const plot = place(state, 'farm-plot', 0, 0)
    state.city.production.plant(plot.id, wheat, { now: 0 })
    expect(state.city.production.tend(plot.id, 1000)).toBe(false)
    const withered = (wheat.growSeconds + wheat.freshSeconds) * 1000 + 1
    expect(state.city.production.tend(plot.id, withered)).toBe(true)
    expect(plot.crop?.plantedAt).toBe(withered)
  })
})

describe("The Farmers' Market", () => {
  it('orders are only for what the farm can make', () => {
    const state = farm()
    expect(makeableProducts(state.city, state.player.level)).toEqual([])
    place(state, 'chicken-coop', 0, 0)
    place(state, 'farm-plot', 3, 0)
    expect(makeableProducts(state.city, state.player.level)).toEqual(['eggs', 'wheat', 'grapes'])
    const order = makeOrder(['eggs'], 5, () => 0.5)!
    expect(Object.keys(order.items)).toEqual(['eggs'])
    expect(order.coins).toBe(Math.round(marketValue(order.items) * ORDER_PREMIUM))
  })

  it('orders stay a sensible size at any level', () => {
    for (const level of [1, 10, 20, 60]) {
      for (let i = 0; i < 50; i++) {
        const order = makeOrder(['eggs', 'milk', 'wine'], level)!
        for (const n of Object.values(order.items)) expect(n).toBeGreaterThanOrEqual(1), expect(n).toBeLessThanOrEqual(12)
      }
    }
  })

  it('posts orders once the market is built, and delivering one pays coins and XP', () => {
    const state = farm()
    const market = new FarmMarket(state.city, state.player, () => 0)
    place(state, 'chicken-coop', 0, 0)
    market.refresh(0)
    expect(market.orders.every((o) => o === null)).toBe(true) // no market yet
    place(state, 'farmers-market', 3, 0)
    market.refresh(0)
    const order = market.orders[0]!
    expect(order.items.eggs).toBeGreaterThan(0)
    expect(market.deliver(0, 0)).toBeNull() // no eggs yet
    state.city.economy.changeProduct('eggs', order.items.eggs!)
    const coins = state.city.coins
    const xp = state.player.xp
    expect(market.deliver(0, 0)).toBe(order)
    expect(state.city.coins - coins).toBe(order.coins)
    expect(state.player.xp - xp).toBe(order.xp)
    expect(state.city.products.eggs).toBe(0)
    // A new one comes a minute later.
    market.refresh(NEXT_ORDER_MS - 1)
    expect(market.orders[0]).toBeNull()
    market.refresh(NEXT_ORDER_MS)
    expect(market.orders[0]).not.toBeNull()
  })

  it('skipping an order brings a new one later', () => {
    const state = farm()
    const market = new FarmMarket(state.city, state.player, () => 0)
    place(state, 'chicken-coop', 0, 0)
    place(state, 'farmers-market', 3, 0)
    market.refresh(0)
    market.skip(1, 0)
    market.refresh(SKIP_ORDER_MS - 1)
    expect(market.orders[1]).toBeNull()
    market.refresh(SKIP_ORDER_MS)
    expect(market.orders[1]).not.toBeNull()
  })

  it('buys farm products at their price, as farm income', () => {
    const state = farm()
    place(state, 'farmers-market', 3, 0)
    state.city.economy.changeProduct('milk', 5)
    const coins = state.city.coins
    expect(state.market.sell('milk', 5)).toBe(5 * PRODUCTS.milk.price!)
    expect(state.city.coins - coins).toBe(5 * PRODUCTS.milk.price!)
    expect(state.market.sell('milk', 1)).toBe(0) // none left
    expect(state.market.sell('preserves', 1)).toBe(0) // not a farm product
  })

  it('keeps its orders through a save', () => {
    const state = farm()
    place(state, 'chicken-coop', 0, 0)
    place(state, 'farmers-market', 3, 0)
    state.market.refresh(0)
    state.market.skip(2, 0)
    const loaded = reload(state)
    expect(loaded.market.orders).toEqual(state.market.orders)
    expect(loaded.market.nextOrderAt(2)).toBe(SKIP_ORDER_MS)
  })
})
