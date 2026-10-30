import { describe, expect, it } from 'vitest'
import { CROPS_BY_ID } from '../game/crops'
import { customersNear, demandFactor, MIN_DEMAND } from '../game/demand'
import { GameState } from '../game/GameState'
import { landQuote } from '../game/projects'
import { QUESTS } from '../game/quests'
import { IN_SEASON_BONUS, seasonBonus, seasonOf } from '../game/seasons'
import { at, b } from './helpers'

// The gaps FEATURES.md listed, closed: crop seasons, shops needing
// customers, and land that needs a quest as well as a level.

describe('Crop seasons', () => {
  it('follow the calendar', () => {
    expect([0, 3, 6, 9, 11].map(seasonOf)).toEqual(['winter', 'spring', 'summer', 'fall', 'winter'])
  })

  it('make a crop in season yield more, and never block one out of season', () => {
    const strawberries = CROPS_BY_ID.get('strawberries')! // best in spring
    expect(seasonBonus(strawberries, 3)).toBe(IN_SEASON_BONUS)
    expect(seasonBonus(strawberries, 9)).toBe(0)
    const harvestIn = (month: number) => {
      const state = new GameState()
      state.city.production.month = () => month
      const plot = state.city.place(b('farm-plot'), at(0, 0), { free: true })!
      state.city.production.plant(plot.id, strawberries, { now: 0, free: true })
      return state.city.production.harvest(plot.id, 60_000)
    }
    expect(harvestIn(3)).toBe(Math.round(strawberries.sellPrice * (1 + IN_SEASON_BONUS)))
    expect(harvestIn(9)).toBe(strawberries.sellPrice)
  })
})

describe('Shops need customers', () => {
  it('sell at 60% with nobody nearby, rising to full with enough residents', () => {
    const bakery = b('bakery')
    expect(demandFactor(bakery, 0)).toBe(MIN_DEMAND)
    expect(demandFactor(bakery, bakery.customers! / 2)).toBeCloseTo(0.8)
    expect(demandFactor(bakery, bakery.customers! * 3)).toBe(1)
    expect(demandFactor(b('cottage'), 0)).toBe(1) // homes don't need customers
  })

  it('count residents within reach only', () => {
    const shop = { type: b('bakery'), tile: at(0, 0), rotation: 0 as const }
    const near = { type: b('cottage'), tile: at(4, 0), rotation: 0 as const, residents: 3 }
    const far = { type: b('cottage'), tile: at(19, 19), rotation: 0 as const, residents: 3 }
    expect(customersNear(shop, [near, far])).toBe(3)
  })

  it('earn more once homes are built nearby', () => {
    const state = new GameState()
    const shop = state.city.place(b('bakery'), at(0, 0), { free: true })!
    state.city.place(b('road'), at(0, 2), { free: true })
    const alone = state.city.production.payout(shop)
    for (let x = 3; x < 12; x += 2) state.city.place(b('cottage'), at(x, 3), { free: true })
    expect(state.city.production.payout(shop)).toBeGreaterThan(alone)
    expect(state.placement.check(b('bakery'), { tile: at(14, 14), rotation: 0 }, { free: true }).warnings.join()).toMatch(/customers/)
  })
})

describe('Land quests', () => {
  it('need the quest finished as well as the level', () => {
    const state = new GameState()
    state.player.grantXp(100_000)
    state.city.economy.adjust(100_000)
    for (const id of ['lumber', 'bricks', 'glass', 'steel']) state.inventory.add(id, 50)
    const quote = landQuote(state.city, state.inventory, state.player, state.quests)
    const community = QUESTS.find((q) => q.id === 'community')!
    expect(quote.result).toEqual({ ok: false, reason: 'quest', quest: community.title })
    // Without quests passed, only level, coins and materials count.
    expect(landQuote(state.city, state.inventory, state.player).result.ok).toBe(true)
  })
})
