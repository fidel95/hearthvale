import { describe, expect, it } from 'vitest'
import { BUILDINGS_BY_ID } from './buildings'
import { City, type CityEvent } from './City'
import { CROPS_BY_ID } from './crops'

const cottage = BUILDINGS_BY_ID.get('cottage')! // 2×2, costs 100, pays 15 every 30 s
const store = BUILDINGS_BY_ID.get('general-store')! // 3×2, costs 500
const plotType = BUILDINGS_BY_ID.get('farm-plot')!
const strawberries = CROPS_BY_ID.get('strawberries')! // seeds 10, grows 60 s, sells 40, fresh 180 s
const wheat = CROPS_BY_ID.get('wheat')!

describe('City', () => {
  it('charges for buildings and refuses ones you cannot afford', () => {
    const city = new City()
    const start = city.coins
    expect(city.place(cottage, { x: 0, z: 0 })).not.toBeNull()
    expect(city.coins).toBe(start - 100)
    city.adjustCoins(-city.coins) // spend everything
    expect(city.place(cottage, { x: 5, z: 5 })).toBeNull()
  })

  it('places free buildings without charging', () => {
    const city = new City()
    const start = city.coins
    city.place(store, { x: 0, z: 0 }, { free: true })
    expect(city.coins).toBe(start)
  })

  it('blocks overlapping and off-map placements', () => {
    const city = new City()
    city.place(cottage, { x: 4, z: 4 }, { free: true })
    expect(city.canPlace(cottage, { x: 5, z: 5 })).toBe(false) // overlaps one tile
    expect(city.canPlace(cottage, { x: 6, z: 4 })).toBe(true) // right next to it
    expect(city.canPlace(cottage, { x: 19, z: 0 })).toBe(false) // hangs off the edge
  })

  it('finds a building from any tile it covers', () => {
    const city = new City()
    const placed = city.place(store, { x: 2, z: 3 }, { free: true })!
    expect(city.buildingAt({ x: 4, z: 4 })).toBe(placed)
    expect(city.buildingAt({ x: 5, z: 4 })).toBeUndefined()
  })

  it('moves a building onto a spot that overlaps its old one', () => {
    const city = new City()
    const placed = city.place(cottage, { x: 0, z: 0 }, { free: true })!
    expect(city.move(placed.id, { x: 1, z: 0 })).toBe(true)
    expect(city.buildingAt({ x: 0, z: 0 })).toBeUndefined()
    expect(city.buildingAt({ x: 2, z: 1 })).toBe(placed)
  })

  it('pays income only when ready, and restarts the timer on collection', () => {
    const city = new City()
    const placed = city.place(cottage, { x: 0, z: 0 }, { now: 0, free: true })!
    const start = city.coins
    expect(city.collect(placed.id, 29_999)).toBe(0)
    expect(city.collect(placed.id, 30_000)).toBe(15)
    expect(city.coins).toBe(start + 15)
    expect(placed.readyAt).toBe(60_000)
    expect(city.collect(placed.id, 30_001)).toBe(0) // can't double-collect
  })

  it('announces changes to listeners', () => {
    const city = new City()
    const kinds: CityEvent['kind'][] = []
    city.onChange((e) => kinds.push(e.kind))
    const placed = city.place(cottage, { x: 0, z: 0 })!
    city.remove(placed.id)
    expect(kinds).toEqual(['added', 'coins', 'removed'])
  })

  it('round-trips through a save', () => {
    const city = new City()
    city.place(cottage, { x: 0, z: 0 }, { now: 1000 })
    city.place(store, { x: 10, z: 10 }, { now: 2000 })
    const save = JSON.parse(JSON.stringify(city.toSave())) // as if written to localStorage

    const loaded = new City()
    loaded.load(save)
    expect(loaded.toSave()).toEqual(save)
    // New buildings get fresh ids rather than reusing saved ones.
    const next = loaded.place(cottage, { x: 5, z: 5 }, { free: true })!
    expect(save.buildings.map((b: { id: number }) => b.id)).not.toContain(next.id)
  })

  it('skips saved buildings whose type no longer exists', () => {
    const city = new City()
    city.load({ coins: 50, nextId: 3, buildings: [{ id: 1, typeId: 'castle', tile: { x: 0, z: 0 }, readyAt: 0 }] })
    expect([...city.all()]).toHaveLength(0)
    expect(city.coins).toBe(50)
  })

  it('round-trips crops through a save, and loads renamed building ids', () => {
    const city = new City()
    const plot = city.place(plotType, { x: 0, z: 0 }, { free: true })!
    city.plant(plot.id, wheat, { now: 5000 })
    const loaded = new City()
    loaded.load(JSON.parse(JSON.stringify(city.toSave())))
    expect(loaded.get(plot.id)!.crop).toEqual({ cropId: 'wheat', plantedAt: 5000 })

    // A save from before Stage 4: the plot was called 'wheat-field' and had no crop field.
    const old = new City()
    old.load({ coins: 10, nextId: 2, buildings: [{ id: 1, typeId: 'wheat-field', tile: { x: 3, z: 3 }, readyAt: 0 }] })
    expect(old.get(1)).toMatchObject({ type: plotType, crop: null })
  })
})

describe('Farming', () => {
  function farm() {
    const city = new City()
    const plot = city.place(plotType, { x: 0, z: 0 }, { free: true })!
    return { city, plot, start: city.coins }
  }

  it('charges for seeds and only plants on an empty plot', () => {
    const { city, plot, start } = farm()
    expect(city.plant(plot.id, strawberries, { now: 0 })).toBe(true)
    expect(city.coins).toBe(start - 10)
    expect(city.plant(plot.id, wheat, { now: 0 })).toBe(false) // already planted
    expect(city.coins).toBe(start - 10)
  })

  it('refuses to plant without enough coins, and only on farm plots', () => {
    const { city, plot } = farm()
    const home = city.place(cottage, { x: 5, z: 5 }, { free: true })!
    expect(city.plant(home.id, strawberries)).toBe(false)
    city.adjustCoins(-city.coins + 5)
    expect(city.plant(plot.id, strawberries)).toBe(false)
  })

  it('harvests only when ripe, then empties the plot', () => {
    const { city, plot, start } = farm()
    city.plant(plot.id, strawberries, { now: 0 })
    expect(city.harvest(plot.id, 59_999)).toBe(0)
    expect(city.harvest(plot.id, 60_000)).toBe(40)
    expect(city.coins).toBe(start - 10 + 40)
    expect(plot.crop).toBeNull()
    expect(city.harvest(plot.id, 60_001)).toBe(0) // nothing left to harvest
  })

  it('loses a crop that withers, which must be cleared before replanting', () => {
    const { city, plot, start } = farm()
    city.plant(plot.id, strawberries, { now: 0 })
    const withered = 60_000 + 180_000
    expect(city.harvest(plot.id, withered)).toBe(0)
    expect(city.plant(plot.id, strawberries, { now: withered })).toBe(false)
    expect(city.clearPlot(plot.id, withered)).toBe(true)
    expect(city.coins).toBe(start - 10) // the seeds are lost, nothing earned
    expect(city.plant(plot.id, strawberries, { now: withered })).toBe(true)
  })

  it('announces planting and harvesting', () => {
    const { city, plot } = farm()
    const events: CityEvent[] = []
    city.onChange((e) => events.push(e))
    city.plant(plot.id, strawberries, { now: 0 })
    city.harvest(plot.id, 60_000)
    expect(events.map((e) => e.kind)).toEqual(['planted', 'coins', 'harvested', 'coins'])
    expect(events[0]).toMatchObject({ cost: 10 })
    expect(events[2]).toMatchObject({ amount: 40 })
  })
})
