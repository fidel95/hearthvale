import { describe, expect, it } from 'vitest'
import { BUILDINGS_BY_ID } from './buildings'
import { City, type CityEvent } from './City'
import { CROPS_BY_ID } from './crops'

// Tests use tiles relative to the starting land, which begins at tile 20 on both axes.
const at = (x: number, z: number) => ({ x: 20 + x, z: 20 + z })
const startLots = new City().toSave().lots

const cottage = BUILDINGS_BY_ID.get('cottage')! // 2×2, costs 100, pays 15 every 30 s
const store = BUILDINGS_BY_ID.get('general-store')! // 3×2, costs 500
const plotType = BUILDINGS_BY_ID.get('farm-plot')!
const strawberries = CROPS_BY_ID.get('strawberries')! // seeds 10, grows 60 s, sells 40, fresh 180 s
const wheat = CROPS_BY_ID.get('wheat')!

describe('City', () => {
  it('charges for buildings and refuses ones you cannot afford', () => {
    const city = new City()
    const start = city.coins
    expect(city.place(cottage, at(0, 0))).not.toBeNull()
    expect(city.coins).toBe(start - 100)
    city.economy.adjust(-city.coins) // spend everything
    expect(city.place(cottage, at(5, 5))).toBeNull()
  })

  it('places free buildings without charging', () => {
    const city = new City()
    const start = city.coins
    city.place(store, at(0, 0), { free: true })
    expect(city.coins).toBe(start)
  })

  it('blocks overlapping and off-map placements', () => {
    const city = new City()
    city.place(cottage, at(4, 4), { free: true })
    expect(city.canPlace(cottage, at(5, 5))).toBe(false) // overlaps one tile
    expect(city.canPlace(cottage, at(6, 4))).toBe(true) // right next to it
    expect(city.canPlace(cottage, at(19, 0))).toBe(false) // hangs off the edge of the town's land
  })

  it('finds a building from any tile it covers', () => {
    const city = new City()
    const placed = city.place(store, at(2, 3), { free: true })!
    expect(city.buildingAt(at(4, 4))).toBe(placed)
    expect(city.buildingAt(at(5, 4))).toBeUndefined()
  })

  it('moves a building onto a spot that overlaps its old one', () => {
    const city = new City()
    const placed = city.place(cottage, at(0, 0), { free: true })!
    expect(city.move(placed.id, at(1, 0))).toBe(true)
    expect(city.buildingAt(at(0, 0))).toBeUndefined()
    expect(city.buildingAt(at(2, 1))).toBe(placed)
  })

  it('pays income only when ready, and restarts the timer on collection', () => {
    const city = new City()
    const placed = city.place(cottage, at(0, 0), { now: 0, free: true })!
    const start = city.coins
    expect(city.production.collect(placed.id, 29_999)).toBe(0)
    expect(city.production.collect(placed.id, 30_000)).toBe(15)
    expect(city.coins).toBe(start + 15)
    expect(placed.readyAt).toBe(60_000)
    expect(city.production.collect(placed.id, 30_001)).toBe(0) // can't double-collect
  })

  it('announces changes to listeners', () => {
    const city = new City()
    const kinds: CityEvent['kind'][] = []
    city.onChange((e) => kinds.push(e.kind))
    const placed = city.place(cottage, at(0, 0))!
    city.remove(placed.id)
    expect(kinds).toEqual(['added', 'coins', 'removed'])
  })

  it('round-trips through a save', () => {
    const city = new City()
    city.place(cottage, at(0, 0), { now: 1000 })
    city.place(store, at(10, 10), { now: 2000 })
    const save = JSON.parse(JSON.stringify(city.toSave())) // as if written to localStorage

    const loaded = new City()
    loaded.load(save)
    expect(loaded.toSave()).toEqual(save)
    // New buildings get fresh ids rather than reusing saved ones.
    const next = loaded.place(cottage, at(5, 5), { free: true })!
    expect(save.buildings.map((b: { id: number }) => b.id)).not.toContain(next.id)
  })

  it('skips saved buildings whose type no longer exists', () => {
    const city = new City()
    city.load({ coins: 50, nextId: 3, lots: startLots, buildings: [{ id: 1, typeId: 'castle', tile: at(0, 0), readyAt: 0 }] })
    expect([...city.all()]).toHaveLength(0)
    expect(city.coins).toBe(50)
  })

  it('round-trips crops through a save, and loads renamed building ids', () => {
    const city = new City()
    const plot = city.place(plotType, at(0, 0), { free: true })!
    city.production.plant(plot.id, wheat, { now: 5000 })
    const loaded = new City()
    loaded.load(JSON.parse(JSON.stringify(city.toSave())))
    expect(loaded.get(plot.id)!.crop).toEqual({ cropId: 'wheat', plantedAt: 5000 })

    // A save from before Stage 4: the plot was called 'wheat-field' and had no crop field.
    const old = new City()
    old.load({ coins: 10, nextId: 2, lots: startLots, buildings: [{ id: 1, typeId: 'wheat-field', tile: at(3, 3), readyAt: 0 }] })
    expect(old.get(1)).toMatchObject({ type: plotType, crop: null })
  })
})

describe('Farming', () => {
  function farm() {
    const city = new City()
    const plot = city.place(plotType, at(0, 0), { free: true })!
    return { city, plot, start: city.coins }
  }

  it('charges for seeds and only plants on an empty plot', () => {
    const { city, plot, start } = farm()
    expect(city.production.plant(plot.id, strawberries, { now: 0 })).toBe(true)
    expect(city.coins).toBe(start - 10)
    expect(city.production.plant(plot.id, wheat, { now: 0 })).toBe(false) // already planted
    expect(city.coins).toBe(start - 10)
  })

  it('refuses to plant without enough coins, and only on farm plots', () => {
    const { city, plot } = farm()
    const home = city.place(cottage, at(5, 5), { free: true })!
    expect(city.production.plant(home.id, strawberries)).toBe(false)
    city.economy.adjust(-city.coins + 5)
    expect(city.production.plant(plot.id, strawberries)).toBe(false)
  })

  it('harvests only when ripe, then empties the plot', () => {
    const { city, plot, start } = farm()
    city.production.plant(plot.id, strawberries, { now: 0 })
    expect(city.production.harvest(plot.id, 59_999)).toBe(0)
    expect(city.production.harvest(plot.id, 60_000)).toBe(40)
    expect(city.coins).toBe(start - 10 + 40)
    expect(plot.crop).toBeNull()
    expect(city.production.harvest(plot.id, 60_001)).toBe(0) // nothing left to harvest
  })

  it('loses a crop that withers, which must be cleared before replanting', () => {
    const { city, plot, start } = farm()
    city.production.plant(plot.id, strawberries, { now: 0 })
    const withered = 60_000 + 180_000
    expect(city.production.harvest(plot.id, withered)).toBe(0)
    expect(city.production.plant(plot.id, strawberries, { now: withered })).toBe(false)
    expect(city.production.clearPlot(plot.id, withered)).toBe(true)
    expect(city.coins).toBe(start - 10) // the seeds are lost, nothing earned
    expect(city.production.plant(plot.id, strawberries, { now: withered })).toBe(true)
  })

  it('announces planting and harvesting', () => {
    const { city, plot } = farm()
    const events: CityEvent[] = []
    city.onChange((e) => events.push(e))
    city.production.plant(plot.id, strawberries, { now: 0 })
    city.production.harvest(plot.id, 60_000)
    expect(events.map((e) => e.kind)).toEqual(['planted', 'coins', 'harvested', 'coins'])
    expect(events[0]).toMatchObject({ cost: 10 })
    expect(events[2]).toMatchObject({ amount: 40 })
  })
})

describe('Land', () => {
  it("only builds on land the town owns", () => {
    const city = new City()
    expect(city.canPlace(cottage, { x: 0, z: 0 })).toBe(false) // a corner of the world, not owned
    expect(city.canPlace(cottage, at(0, 0))).toBe(true)
  })

  it('sells only lots next to owned land, each one dearer than the last', () => {
    const city = new City()
    city.economy.adjust(10_000)
    expect(city.canBuyLot({ x: 0, z: 0 })).toBe(false) // not next to the town
    expect(city.canBuyLot({ x: 2, z: 2 })).toBe(false) // already owned
    expect(city.nextLotPrice).toBe(500)
    const before = city.coins
    expect(city.buyLot({ x: 4, z: 2 })).toBe(true)
    expect(city.coins).toBe(before - 500)
    expect(city.nextLotPrice).toBe(1000)
    expect(city.canPlace(cottage, { x: 40, z: 20 })).toBe(true) // on the new lot
    expect(city.canBuyLot({ x: 5, z: 2 })).toBe(true) // now next to owned land
  })

  it("refuses a lot you can't afford", () => {
    const city = new City()
    city.economy.adjust(-city.coins + 499)
    expect(city.buyLot({ x: 4, z: 2 })).toBe(false)
  })

  it('round-trips land through a save', () => {
    const city = new City()
    city.economy.adjust(1000)
    city.buyLot({ x: 1, z: 2 })
    const loaded = new City()
    loaded.load(JSON.parse(JSON.stringify(city.toSave())))
    expect(loaded.ownsLot({ x: 1, z: 2 })).toBe(true)
    expect(loaded.expansions).toBe(1)
  })
})
