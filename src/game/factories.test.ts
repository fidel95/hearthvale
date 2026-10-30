import { describe, expect, it } from 'vitest'
import { BUILDINGS_BY_ID } from './buildings'
import { GameState } from './GameState'
import { SaveSystem } from './SaveSystem'

const b = (id: string) => BUILDINGS_BY_ID.get(id)!
const at = (x: number, z: number) => ({ x: 20 + x, z: 20 + z })
const cannery = b('cannery')
const f = cannery.factory!

// A town with a working Cannery and a Deli, both on a road.
function town(goods: number) {
  const state = new GameState()
  for (let x = 0; x < 10; x++) state.city.place(b('road'), at(x, 2), { free: true })
  const factory = state.city.place(cannery, at(0, 0), { free: true })!
  const deli = state.city.place(b('deli'), at(5, 0), { now: 0, free: true })!
  expect(factory && deli).toBeTruthy()
  // Utilities, so both work (a water tower, power plant and dump nearby).
  for (const [id, x] of [['water-tower', 0], ['power-plant', 2], ['recycling-center', 5]] as const) expect(state.city.place(b(id), at(x, 3), { free: true })).not.toBeNull()
  state.city.economy.changeGoods(goods - state.city.goods)
  return { state, factory, deli }
}

describe('Factories and products', () => {
  it('a batch takes its goods when it starts and makes products when collected', () => {
    const { state, factory } = town(25)
    expect(state.city.isOperating(factory)).toBe(true)
    expect(state.city.production.startBatch(factory.id, 0)).toBe(true)
    expect(state.city.goods).toBe(25 - f.input)
    expect(state.city.production.factoryState(factory, 1000)).toBe('working')
    expect(state.city.production.collectBatch(factory.id, 1000)).toBe(0) // not ready
    const done = f.seconds * 1000
    expect(state.city.production.collectBatch(factory.id, done)).toBe(f.output)
    expect(state.city.products.preserves).toBe(f.output)
    // The next batch started by itself, with the goods left.
    expect(state.city.production.factoryState(factory, done)).toBe('working')
    expect(state.city.goods).toBe(25 - 2 * f.input)
  })

  it("waits when there aren't enough goods, and starts once there are", () => {
    const { state, factory } = town(f.input - 1)
    state.city.production.runFactories(0)
    expect(state.city.production.factoryState(factory, 0)).toBe('idle')
    state.city.economy.changeGoods(1)
    state.city.production.runFactories(0)
    expect(state.city.production.factoryState(factory, 0)).toBe('working')
  })

  it('products share storage with goods, and a full storage holds the batch', () => {
    const { state, factory } = town(f.input)
    state.city.production.startBatch(factory.id, 0)
    state.city.economy.changeGoods(state.city.storageCapacity - state.city.inStorage) // fill it
    expect(state.city.production.collectBatch(factory.id, f.seconds * 1000)).toBe(0)
    state.city.economy.changeGoods(-f.output)
    expect(state.city.production.collectBatch(factory.id, f.seconds * 1000)).toBe(f.output)
  })

  it('specialty shops restock from their product and sell it', () => {
    const { state, factory, deli } = town(f.input)
    state.city.production.startBatch(factory.id, 0)
    state.city.production.collectBatch(factory.id, f.seconds * 1000)
    expect(state.city.production.restock(deli.id)).toBe(f.output)
    expect(state.city.products.preserves).toBe(0)
    expect(state.city.goods).toBe(0) // goods untouched by the Deli
    expect(state.city.production.collect(deli.id, 600_000)).toBeGreaterThan(0)
  })

  it('the tax books count a product as the goods it was made from', () => {
    const { state, factory, deli } = town(f.input)
    const books = () => state.taxes.toSave()
    const before = books().inventory!.units
    state.city.production.startBatch(factory.id, 0)
    state.city.production.collectBatch(factory.id, f.seconds * 1000)
    expect(books().inventory!.units).toBe(before) // making moves no money
    state.city.production.restock(deli.id)
    state.city.production.collect(deli.id, 600_000)
    expect(books().inventory!.units).toBe(before - deli.type.goodsPerSale! * 2) // 2 goods per preserve
  })

  it('products and batches in the works survive a save and reload', () => {
    const { state, factory } = town(25)
    state.city.production.startBatch(factory.id, 0)
    state.city.production.collectBatch(factory.id, f.seconds * 1000)
    const saved = new SaveSystem(state).toSave()
    const loaded = new GameState()
    new SaveSystem(loaded).load(saved)
    expect(loaded.city.products.preserves).toBe(f.output)
    expect(loaded.city.get(factory.id)!.stock).toBe(f.output) // the second batch
    expect(new SaveSystem(loaded).toSave()).toEqual(saved)
  })
})
