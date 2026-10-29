import { describe, expect, it } from 'vitest'
import { BUILDING_TYPES } from './buildings'
import { CROP_TYPES } from './crops'
import { buildXp, collectXp, levelForXp, maxEnergy, xpForLevel } from './progression'

describe('levels', () => {
  it('needs 10 more XP for each level than the last', () => {
    expect([1, 2, 3, 4, 5].map(xpForLevel)).toEqual([0, 10, 30, 60, 100])
  })

  it('finds the level for an amount of XP, right at the boundaries', () => {
    expect(levelForXp(0)).toBe(1)
    expect(levelForXp(9)).toBe(1)
    expect(levelForXp(10)).toBe(2)
    expect(levelForXp(29)).toBe(2)
    expect(levelForXp(30)).toBe(3)
  })

  it('adds one maximum energy per level', () => {
    expect(maxEnergy(10) - maxEnergy(1)).toBe(9)
  })
})

describe('XP for actions', () => {
  it('gives 1 XP per full 20 coins spent building, none for cheap or free ones', () => {
    expect(buildXp(100)).toBe(5)
    expect(buildXp(30)).toBe(1)
    expect(buildXp(10)).toBe(0) // a road tile
    expect(buildXp(0)).toBe(0)
  })

  it('gives at least 1 XP for collecting', () => {
    expect(collectXp(15)).toBe(1)
    expect(collectXp(80)).toBe(5)
    expect(collectXp(1)).toBe(1)
  })
})

describe('unlocks', () => {
  it('starts you with a home, a farm plot and a crop', () => {
    const level1 = BUILDING_TYPES.filter((b) => b.unlockLevel === 1).map((b) => b.category)
    expect(level1).toContain('home')
    expect(level1).toContain('farm')
    expect(CROP_TYPES.some((c) => c.unlockLevel === 1)).toBe(true)
  })

  it('gives slower crops more XP', () => {
    const byTime = [...CROP_TYPES].sort((a, b) => a.growSeconds - b.growSeconds)
    for (let i = 1; i < byTime.length; i++) expect(byTime[i].xp).toBeGreaterThan(byTime[i - 1].xp)
  })
})
