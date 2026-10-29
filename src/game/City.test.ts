import { describe, expect, it } from 'vitest'
import { BUILDINGS_BY_ID } from './buildings'
import { City, type CityEvent } from './City'

const cottage = BUILDINGS_BY_ID.get('cottage')! // 2×2, costs 100, pays 15 every 30 s
const store = BUILDINGS_BY_ID.get('general-store')! // 3×2, costs 500

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
})
