import { describe, expect, it } from 'vitest'
import { BUILDINGS_BY_ID } from './buildings'
import { MAX_LOCATION_BONUS, ROAD_BONUS, footprintGap, locationBonus, roadMask } from './communityRules'
import type { Tile } from './grid'

const b = (id: string, x: number, z: number) => ({ type: BUILDINGS_BY_ID.get(id)!, tile: { x, z } })
const noRoads = () => false

describe('footprintGap', () => {
  it('counts the tiles between two footprints, 0 when touching', () => {
    const home = b('cottage', 0, 0) // covers x 0–1
    expect(footprintGap(home, b('park', 2, 0))).toBe(0) // touching
    expect(footprintGap(home, b('park', 6, 0))).toBe(4) // 4 empty tiles between
    expect(footprintGap(home, b('park', 6, 5))).toBe(4) // diagonal: the larger gap counts
  })
})

describe('locationBonus', () => {
  it('adds the bonus of every amenity in range', () => {
    const home = b('cottage', 0, 0)
    const town = [home, b('park', 6, 0), b('school', 0, 6)]
    expect(locationBonus(home, town, noRoads)).toEqual({ total: 0.25, sources: ['Park', 'School'] })
  })

  it('ignores amenities out of range', () => {
    const home = b('cottage', 0, 0)
    expect(locationBonus(home, [home, b('park', 7, 0)], noRoads).total).toBe(0) // 5 tiles away, radius 4
  })

  it('adds a bonus for touching a road', () => {
    const home = b('cottage', 5, 5)
    const isRoad = (t: Tile) => t.x === 7 && t.z === 5 // right beside its east edge
    expect(locationBonus(home, [home], isRoad)).toEqual({ total: ROAD_BONUS, sources: ['Road'] })
  })

  it('caps the total, and only applies to homes and shops', () => {
    const home = b('cottage', 10, 10)
    const crowd = [home, ...[0, 3, 6].flatMap((dz) => [b('school', 4, dz), b('school', 14, dz)])]
    expect(locationBonus(home, crowd, noRoads).total).toBe(MAX_LOCATION_BONUS)
    const plot = b('farm-plot', 10, 10)
    expect(locationBonus(plot, [plot, b('park', 12, 10)], noRoads).total).toBe(0)
  })
})

describe('roadMask', () => {
  // Roads at the center and to its north, east and south: a T junction.
  const roads = new Set(['5,5', '5,4', '6,5', '5,6'])
  const isRoad = (t: Tile) => roads.has(`${t.x},${t.z}`)

  it('sets one bit per neighboring road', () => {
    expect(roadMask({ x: 5, z: 5 }, isRoad)).toBe(1 | 2 | 4)
    expect(roadMask({ x: 5, z: 4 }, isRoad)).toBe(4) // a dead end pointing south
    expect(roadMask({ x: 9, z: 9 }, isRoad)).toBe(0)
  })
})
