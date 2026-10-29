import { describe, expect, it } from 'vitest'
import { buildingRow, cropRow, mechanicsByLevel } from './balance'
import { BUILDINGS_BY_ID, BUILDING_TYPES } from './buildings'
import { City } from './City'
import { CROP_TYPES } from './crops'
import { MATERIALS, MATERIAL_IDS } from './items'
import { QUESTS } from './quests'
import { GRANT, canClaimGrant, isStuck } from './safetyNet'
import { COUNTY_SUPPLY, UTILITIES } from './utilityRules'

// The balance principles in docs/BALANCE.md, as tests. If one fails after a
// change to prices, timers or unlock levels, the change broke a principle:
// fix the numbers, or update the principle (and the doc) on purpose.

const earners = BUILDING_TYPES.filter((t) => t.income).map(buildingRow)

describe('1. early actions are quick and rewarding', () => {
  it('level 1 buildings and crops produce within a minute', () => {
    for (const t of BUILDING_TYPES.filter((t) => t.unlockLevel === 1 && t.income)) expect(t.income!.seconds).toBeLessThanOrEqual(60)
    for (const c of CROP_TYPES.filter((c) => c.unlockLevel === 1)) expect(c.growSeconds).toBeLessThanOrEqual(60)
  })

  it('early buildings pay for themselves within 15 minutes', () => {
    for (const row of earners.filter((r) => r.role === 'early')) expect(row.paybackMinutes, row.name).toBeLessThanOrEqual(15)
  })

  it('the first quest only needs what a new town starts with', () => {
    const first = QUESTS[0]
    expect(first.level ?? 1).toBe(1)
    expect(first.after).toBeUndefined()
  })
})

describe('2. nobody gets stuck for good', () => {
  it('every material can be bought for coins', () => {
    for (const id of MATERIAL_IDS) expect(MATERIALS[id].price).toBeGreaterThan(0)
  })

  it('the county always supplies some of every utility, so income never drops to zero', () => {
    for (const u of UTILITIES) expect(COUNTY_SUPPLY[u]).toBeGreaterThan(0)
  })

  it('a town with nothing that earns and no coins can claim the grant, which buys a home', () => {
    const city = new City()
    city.economy.adjust(-city.coins)
    expect(isStuck(city)).toBe(true)
    expect(canClaimGrant(city, null, 0)).toBe(true)
    expect(canClaimGrant(city, 0, 30 * 60_000)).toBe(false) // at most once an hour
    expect(GRANT).toBeGreaterThanOrEqual(BUILDINGS_BY_ID.get('cottage')!.cost)
  })

  it("a town with a home, or a home in storage, isn't stuck", () => {
    const city = new City()
    city.economy.adjust(-city.coins)
    const home = city.place(BUILDINGS_BY_ID.get('cottage')!, { x: 25, z: 25 }, { free: true })!
    expect(isStuck(city)).toBe(false)
    city.store(home.id)
    expect(isStuck(city)).toBe(false)
  })
})

describe('3. one new mechanic per level', () => {
  it('introduces at most one mechanic at each level from 2 up', () => {
    for (const [level, mechanics] of mechanicsByLevel()) {
      if (level > 1) expect(mechanics, `level ${level}`).toHaveLength(1)
    }
  })
})

describe('4. bigger buildings are meaningful goals', () => {
  for (const category of ['home', 'business']) {
    it(`${category}s unlocked later cost more and pay more per collection`, () => {
      const rows = earners.filter((r) => r.category === category).sort((a, b) => a.unlockLevel - b.unlockLevel)
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i].totalCost, rows[i].name).toBeGreaterThan(rows[i - 1].totalCost)
        expect(rows[i].coinsPerCycle!, rows[i].name).toBeGreaterThan(rows[i - 1].coinsPerCycle!)
      }
    })
  }

  it('every building and crop that earns turns a profit', () => {
    for (const row of earners) expect(row.netPerCycle!, row.name).toBeGreaterThan(0)
    for (const c of CROP_TYPES.map(cropRow)) expect(c.profitPerCycle, c.name).toBeGreaterThan(0)
  })
})

describe('5. timers fit the play session', () => {
  it('early timers are at most 5 minutes', () => {
    for (const t of BUILDING_TYPES.filter((t) => t.unlockLevel <= 3)) {
      expect(t.income?.seconds ?? 0, t.name).toBeLessThanOrEqual(300)
      expect(t.build?.seconds ?? 0, t.name).toBeLessThanOrEqual(300)
    }
    for (const c of CROP_TYPES.filter((c) => c.unlockLevel <= 3)) expect(c.growSeconds, c.name).toBeLessThanOrEqual(300)
  })

  it('nothing takes longer than 8 hours', () => {
    for (const c of CROP_TYPES) expect(c.growSeconds).toBeLessThanOrEqual(8 * 3600)
    for (const t of BUILDING_TYPES) expect(Math.max(t.income?.seconds ?? 0, t.build?.seconds ?? 0)).toBeLessThanOrEqual(8 * 3600)
  })

  it('crops stay fresh at least as long as they took to grow', () => {
    for (const c of CROP_TYPES) expect(c.freshSeconds, c.name).toBeGreaterThanOrEqual(c.growSeconds)
  })
})
