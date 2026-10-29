import { describe, expect, it } from 'vitest'
import { BUILDINGS_BY_ID } from './buildings'
import { City } from './City'
import { GRID_SIZE } from './grid'
import { coastZ, isWater } from './terrain'

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
    city.adjustCoins(100_000)
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
