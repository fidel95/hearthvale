import { describe, expect, it } from 'vitest'
import { BUILDINGS_BY_ID } from './buildings'
import { City } from './City'
import { GRID_SIZE, footprintTiles } from './grid'
import { HIGHLANDS_X, PEAKS, coastZ, isRiver, isRock, isWater, nearMountain } from './terrain'
import { SaveSystem } from './SaveSystem'
import { GameState } from './GameState'

describe('the coast', () => {
  it('runs between tiles 43 and 49, south of the starting land', () => {
    for (let x = 0; x < GRID_SIZE; x++) {
      expect(coastZ(x)).toBeGreaterThanOrEqual(43)
      expect(coastZ(x)).toBeLessThanOrEqual(49)
    }
    expect(isWater({ x: 30, z: 39 })).toBe(false)
    expect(isWater({ x: 30, z: 55 })).toBe(true)
  })

  it('keeps buildings off the water, and lots that are all sea off the market', () => {
    const city = new City()
    city.economy.adjust(100_000)
    expect(city.buyLot({ x: 2, z: 4 })).toBe(true) // the lot south of town reaches the shore
    const x = 25
    const shore = coastZ(x)
    const cottage = BUILDINGS_BY_ID.get('cottage')!
    expect(city.canPlace(cottage, { x, z: shore - 1 })).toBe(false) // half in the sea
    expect(city.canPlace(cottage, { x, z: shore - 4 })).toBe(true)
    // Lot row 5 (tiles 50–59) is all sea.
    expect(city.canBuyLot({ x: 2, z: 5 })).toBe(false)
  })
})

describe('the Highlands', () => {
  it('keeps the old world clear and leaves room to build on every highland lot', () => {
    for (let x = 0; x < HIGHLANDS_X - 1; x++) for (let z = 0; z < GRID_SIZE; z++) expect(isRock({ x, z })).toBe(false)
    for (let lx = HIGHLANDS_X / 10; lx < GRID_SIZE / 10; lx++) {
      for (let lz = 0; lz < 4; lz++) {
        const tiles = footprintTiles({ x: lx * 10, z: lz * 10 }, { x: 10, z: 10 })
        const open = tiles.filter((t) => !isRock(t) && !isWater(t)).length
        expect(open, `lot ${lx},${lz}`).toBeGreaterThanOrEqual(40)
      }
    }
  })

  it("won't build on a mountain, but will right beside one", () => {
    const city = new City()
    city.economy.adjust(1_000_000)
    // Buy the way east to the Highlands.
    for (let pass = 0; pass < 6; pass++) for (let x = 3; x < 8; x++) for (let z = 0; z < 4; z++) city.buyLot({ x, z })
    expect(city.ownsLot({ x: 6, z: 0 })).toBe(true)
    const cottage = BUILDINGS_BY_ID.get('cottage')!
    const peak = PEAKS[0]
    expect(city.canPlace(cottage, { x: Math.floor(peak.x) - 1, z: Math.floor(peak.z) - 1 })).toBe(false)
    expect(city.canPlace(cottage, { x: Math.floor(peak.x - peak.radius) - 2, z: Math.floor(peak.z) })).toBe(true)
    expect(nearMountain({ x: Math.floor(peak.x - peak.radius), z: Math.floor(peak.z) })).toBe(true)
    expect(nearMountain({ x: Math.floor(peak.x - peak.radius) - 3, z: Math.floor(peak.z) })).toBe(false)
  })
})

describe('the river', () => {
  const tiles = () => {
    const list = []
    for (let x = 0; x < GRID_SIZE; x++) for (let z = 0; z < GRID_SIZE; z++) if (isRiver({ x, z })) list.push({ x, z })
    return list
  }

  it('runs in the Highlands only, from the north edge to the sea, never through rock', () => {
    const river = tiles()
    expect(river.length).toBeGreaterThan(80)
    for (const t of river) {
      expect(t.x).toBeGreaterThanOrEqual(HIGHLANDS_X)
      expect(isRock(t)).toBe(false)
    }
    // Unbroken: every row from the top to the coast has river in it, touching the row above.
    const rows = new Map<number, number[]>()
    for (const t of river) rows.set(t.z, [...(rows.get(t.z) ?? []), t.x])
    const last = Math.max(...rows.keys())
    expect(rows.has(0)).toBe(true)
    expect(isWater({ x: rows.get(last)![0], z: last + 1 })).toBe(true)
    for (let z = 1; z <= last; z++) expect(rows.get(z)!.some((x) => rows.get(z - 1)!.some((above) => Math.abs(above - x) <= 1)), `row ${z}`).toBe(true)
  })

  it('takes roads (as bridges) but no other building', () => {
    const city = new City()
    city.economy.adjust(1_000_000)
    for (let pass = 0; pass < 6; pass++) for (let x = 3; x < 8; x++) for (let z = 0; z < 4; z++) city.buyLot({ x, z })
    const water = tiles().find((t) => city.ownsTile(t))!
    expect(city.canPlace(BUILDINGS_BY_ID.get('road')!, water)).toBe(true)
    expect(city.canPlace(BUILDINGS_BY_ID.get('cottage')!, water)).toBe(false)
  })

  it('moves a building that stood where it now flows into storage, finished', () => {
    const state = new GameState()
    state.city.economy.adjust(1_000_000)
    for (let pass = 0; pass < 6; pass++) for (let x = 3; x < 8; x++) for (let z = 0; z < 4; z++) state.city.buyLot({ x, z })
    const water = tiles().find((t) => state.city.ownsTile(t))!
    const save = new SaveSystem(state).toSave()
    // As if a Lodge had been built there before the river came.
    save.buildings.list.push({ id: 999, typeId: 'mountain-lodge', tile: water, rotation: 0, readyAt: 0, lastCollectedAt: null, crop: null, level: 1, stock: 0, construction: { endsAt: 5 }, damaged: false })
    const loaded = new GameState()
    new SaveSystem(loaded).load(save)
    expect(loaded.city.get(999)).toBeUndefined()
    const stored = [...loaded.city.storedBuildings()].find((b) => b.id === 999)!
    expect(stored.construction).toBeNull()
    expect(loaded.city.movedForRiver).toEqual(['Mountain Lodge'])
  })
})
