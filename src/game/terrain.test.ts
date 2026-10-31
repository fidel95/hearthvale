import { describe, expect, it } from 'vitest'
import { BUILDINGS_BY_ID } from './buildings'
import { City } from './City'
import { GRID_SIZE, footprintTiles } from './grid'
import { HIGHLANDS_X, PEAKS, coastZ, isRock, isWater, nearMountain } from './terrain'

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
