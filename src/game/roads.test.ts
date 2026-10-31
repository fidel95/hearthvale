import { describe, expect, test } from 'vitest'
import { BUILDINGS_BY_ID } from './buildings'
import { locationBonus, roadBonus } from './communityRules'

const type = (id: string) => BUILDINGS_BY_ID.get(id)!
const at = (id: string, x: number, z: number) => ({ type: type(id), tile: { x, z }, rotation: 0 as const })

describe('kinds of road', () => {
  test('each kind adds its own bonus to homes and shops beside it', () => {
    expect(roadBonus(type('dirt-road'))).toBe(0.02)
    expect(roadBonus(type('road'))).toBe(0.05)
    expect(roadBonus(type('cobble-street'))).toBe(0.06)
    expect(roadBonus(type('avenue'))).toBe(0.08)
  })

  test('the best road beside a home counts, once', () => {
    const home = at('cottage', 10, 10) // 2×2: tiles 10–11
    const roads = [at('dirt-road', 10, 12), at('avenue', 11, 12), at('road', 12, 10)]
    const isRoad = (t: { x: number; z: number }) => roads.some((r) => r.tile.x === t.x && r.tile.z === t.z)
    const bonus = locationBonus(home, [home, ...roads], isRoad)
    expect(bonus.total).toBe(0.08)
    expect(bonus.sources).toEqual(['Avenue'])
  })

  test('a dirt road alone gives less than a paved one', () => {
    const home = at('cottage', 10, 10)
    const dirt = at('dirt-road', 9, 10)
    const isRoad = (t: { x: number; z: number }) => t.x === 9 && t.z === 10
    expect(locationBonus(home, [home, dirt], isRoad).total).toBe(0.02)
  })
})
