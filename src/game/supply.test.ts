import { describe, expect, it } from 'vitest'
import { BUILDINGS_BY_ID } from './buildings'
import { BASE_STORAGE, City } from './City'
import { CROPS_BY_ID } from './crops'
import { Docks, SHIPMENT_OPTIONS } from './Docks'
import { GameClock } from './GameClock'
import { Taxes } from './Taxes'
import { productionState } from './production'
import { coastZ } from './terrain'

const at = (x: number, z: number) => ({ x: 20 + x, z: 20 + z })
const b = (id: string) => BUILDINGS_BY_ID.get(id)!
const strawberries = CROPS_BY_ID.get('strawberries')! // 6 goods, or 40 coins wholesale
const small = SHIPMENT_OPTIONS[0] // 40 goods for 240, 60 s

// Shops need a road beside them: put one on the tile east of a 2×2 shop at at(0, 0).
const road = (city: City) => city.place(b('road'), at(2, 0), { free: true })

function town() {
  const city = new City()
  const taxes = new Taxes(city, new GameClock())
  const docks = new Docks(city)
  return { city, taxes, docks }
}

describe('goods and shops', () => {
  it('shops sell from their shelves, which are restocked from town storage', () => {
    const { city } = town()
    const bakery = city.place(b('bakery'), at(0, 0), { now: 0, free: true })! // 4 goods a sale, shelves hold 40
    road(city)
    expect(city.hasStock(bakery)).toBe(false) // a new shop starts empty
    expect(city.collect(bakery.id, 45_000)).toBe(0)
    expect(city.restock(bakery.id)).toBe(40) // all 40 starting goods
    expect(city.goods).toBe(0)
    expect(city.collect(bakery.id, 45_000)).toBe(40)
    expect(bakery.stock).toBe(36)
    // Empty the shelves: 9 more sales use 36 goods.
    for (let i = 2; i <= 10; i++) city.collect(bakery.id, i * 45_000)
    expect(bakery.stock).toBe(0)
    expect(city.collect(bakery.id, 11 * 45_000)).toBe(0)
  })

  it('restocks only as much as the shelves hold and storage has', () => {
    const { city } = town()
    const bakery = city.place(b('bakery'), at(0, 0), { free: true })!
    city.addGoods(50, 0) // 90 in storage
    expect(city.restock(bakery.id)).toBe(40) // shelves hold 40
    expect(city.restock(bakery.id)).toBe(0) // already full
    expect(city.goods).toBe(50)
  })

  it('stores harvests as goods when the town has shops, selling only what does not fit', () => {
    const { city } = town()
    city.place(b('bakery'), at(0, 0), { free: true })
    const plot = city.place(b('farm-plot'), at(4, 0), { free: true })!
    city.plant(plot.id, strawberries, { now: 0, free: true })
    expect(city.harvest(plot.id, 60_000)).toBe(0) // all 6 went into storage
    expect(city.goods).toBe(46)

    // Fill storage to 2 short of full: 2 go in, the other 4 of 6 sell for 4/6 of 40.
    city.addGoods(BASE_STORAGE - 2 - city.goods, 0)
    city.plant(plot.id, strawberries, { now: 0, free: true })
    expect(city.harvest(plot.id, 60_000)).toBe(Math.round((40 * 4) / 6))
    expect(city.goods).toBe(BASE_STORAGE)
  })

  it('sells the whole harvest at the market when there are no shops', () => {
    const { city } = town()
    const plot = city.place(b('farm-plot'), at(0, 0), { free: true })!
    city.plant(plot.id, strawberries, { now: 0, free: true })
    expect(city.harvest(plot.id, 60_000)).toBe(40)
    expect(city.goods).toBe(40)
  })

  it('adds storage with barns', () => {
    const { city } = town()
    city.place(b('barn'), at(0, 0), { free: true })
    expect(city.storageCapacity).toBe(BASE_STORAGE + 150)
  })
})

describe('inventory and cost of goods sold', () => {
  it('deducts what goods cost only when they are sold, at the average cost', () => {
    const { city, taxes } = town()
    const bakery = city.place(b('bakery'), at(0, 0), { now: 0, free: true })!
    road(city)
    // 40 free starting goods, plus 40 bought for 240: 80 goods costing 240, 3 a unit on average.
    city.addGoods(40, 240)
    expect(taxes.inventory).toEqual({ units: 80, cost: 240 })
    expect(taxes.estimate().costOfGoodsSold).toBe(0) // buying isn't an expense

    city.restock(bakery.id) // moving goods onto the shelves isn't a sale
    expect(taxes.estimate().costOfGoodsSold).toBe(0)
    city.collect(bakery.id, 45_000) // sells 4 goods
    expect(taxes.estimate().costOfGoodsSold).toBeCloseTo(12)
    expect(taxes.inventory.units).toBe(76)
    expect(taxes.inventory.cost).toBeCloseTo(228)
  })

  it('records harvested goods in inventory at no cost, and market sales as farm income', () => {
    const { city, taxes } = town()
    city.place(b('bakery'), at(0, 0), { free: true })
    const plot = city.place(b('farm-plot'), at(4, 0), { free: true })!
    city.plant(plot.id, strawberries, { now: 0, free: true })
    city.harvest(plot.id, 60_000)
    expect(taxes.inventory).toEqual({ units: 46, cost: 0 })
    expect(taxes.estimate().farmIncome).toBe(0) // not sold yet
  })
})

describe('Docks', () => {
  // A town that owns the lot by the sea, with a dock on the shore.
  function port() {
    const t = town()
    t.city.adjustCoins(10_000)
    t.city.buyLot({ x: 2, z: 4 })
    const x = 22
    const shoreZ = Math.min(coastZ(x), coastZ(x + 1), coastZ(x + 2))
    const dock = t.city.place(b('dock'), { x, z: shoreZ - 2 }, { free: true })
    return { ...t, dock: dock! }
  }

  it('only goes on the shore', () => {
    const { city, dock } = port()
    expect(dock).toBeTruthy()
    expect(city.canPlace(b('dock'), at(0, 0))).toBe(false) // inland
  })

  it('pays up front, sails, then unloads into storage as inventory', () => {
    const { city, docks, taxes, dock } = port()
    const coins = city.coins
    expect(docks.order(dock, small, 0)).toBe(true)
    expect(city.coins).toBe(coins - 240)
    expect(docks.order(dock, small, 0)).toBe(false) // one at a time
    expect(docks.state(dock, 59_999).stage).toBe('sailing')
    expect(docks.unload(dock, 59_999)).toBe(0)
    expect(docks.unload(dock, 60_000)).toBe(40)
    expect(city.goods).toBe(80)
    expect(taxes.inventory.cost).toBe(240)
    expect(docks.state(dock, 60_000).stage).toBe('idle')
  })

  it("keeps what doesn't fit aboard", () => {
    const { city, docks, dock } = port()
    city.addGoods(city.storageCapacity - city.goods - 10, 0) // room for 10
    docks.order(dock, small, 0)
    expect(docks.unload(dock, 60_000)).toBe(10)
    const state = docks.state(dock, 60_000)
    expect(state.stage === 'arrived' && state.shipment.units).toBe(30)
    expect(state.stage === 'arrived' && state.shipment.cost).toBeCloseTo(180)
  })

  it('refunds an order if the dock is demolished', () => {
    const { city, docks, dock } = port()
    const coins = city.coins
    docks.order(dock, small, 0)
    city.remove(dock.id)
    expect(city.coins).toBe(coins)
  })
})

describe('road access', () => {
  it("blocks a shop with no road beside it, until one's built", () => {
    const { city } = town()
    const bakery = city.place(b('bakery'), at(0, 0), { now: 0, free: true })!
    city.restock(bakery.id)
    expect(productionState(city, bakery, 45_000)).toEqual({ state: 'blocked', reason: 'road' })
    expect(city.collect(bakery.id, 45_000)).toBe(0)
    road(city)
    expect(productionState(city, bakery, 45_000)).toEqual({ state: 'ready' })
    expect(city.collect(bakery.id, 45_000)).toBe(40)
  })

  it('knows which buildings removing a road would cut off', () => {
    const { city } = town()
    const bakery = city.place(b('bakery'), at(0, 0), { free: true })!
    const only = road(city)!
    expect(city.cutOffBy(only)).toEqual([bakery])
    city.place(b('road'), at(0, 2), { free: true }) // a second road along its south side
    expect(city.cutOffBy(only)).toEqual([])
  })

  it("homes don't need a road (they just earn more beside one)", () => {
    const { city } = town()
    const home = city.place(b('cottage'), at(0, 0), { now: 0, free: true })!
    expect(city.collect(home.id, 30_000)).toBe(15)
  })
})

