import { describe, expect, it } from 'vitest'
import { BUILDING_TYPES } from '../game/buildings'
import { CROPS_BY_ID } from '../game/crops'
import { GameState } from '../game/GameState'
import { xpForLevel } from '../game/progression'
import { QUESTS } from '../game/quests'
import { FEATURE_LEVELS, type Feature } from '../game/UnlockSystem'
import { at, b, reload } from './helpers'

// Test plan: quests and progression.
const welcome = QUESTS.find((q) => q.id === 'welcome')! // collect rent 3 times, harvest a crop
const growing = QUESTS.find((q) => q.id === 'growing')! // have 3 homes, plant 3 crops
const [rent, harvests] = welcome.tasks

function town() {
  const state = new GameState()
  const home = state.city.place(b('cottage'), at(0, 0), { now: 0, free: true })!
  const plot = state.city.place(b('farm-plot'), at(4, 0), { free: true })!
  return { state, home, plot }
}

function finishWelcome({ state, home, plot }: ReturnType<typeof town>) {
  for (const t of [30_000, 60_000, 90_000]) state.city.production.collect(home.id, t)
  state.city.production.plant(plot.id, CROPS_BY_ID.get('strawberries')!, { now: 0, free: true })
  state.city.production.harvest(plot.id, 60_000)
  state.quests.claim(welcome)
}

describe('Quests', () => {
  it('count relevant events toward the right objectives', () => {
    const { state, home, plot } = town()
    state.city.production.collect(home.id, 30_000)
    expect(state.quests.progress(welcome, rent)).toBe(1)
    expect(state.quests.progress(welcome, harvests)).toBe(0)
    state.city.production.plant(plot.id, CROPS_BY_ID.get('strawberries')!, { now: 0, free: true })
    state.city.production.harvest(plot.id, 60_000)
    expect(state.quests.progress(welcome, harvests)).toBe(1)
    expect(state.quests.progress(welcome, rent)).toBe(1)
  })

  it('ignore unrelated events', () => {
    const { state, plot } = town()
    state.city.place(b('oak-tree'), at(8, 8)) // building something
    state.city.production.plant(plot.id, CROPS_BY_ID.get('strawberries')!, { now: 0 }) // planting
    state.city.economy.adjust(500) // coins from elsewhere
    state.inventory.add('lumber', 3)
    expect(state.quests.progress(welcome, rent)).toBe(0)
    expect(state.quests.progress(welcome, harvests)).toBe(0)
  })

  it('keep a completed objective completed', () => {
    const t = town()
    finishWelcome(t)
    const { state } = t
    const haveHomes = growing.tasks[0]
    expect(state.quests.activeQuests()).toContain(growing)
    const extra = [state.city.place(b('cottage'), at(8, 0), { free: true })!, state.city.place(b('cottage'), at(12, 0), { free: true })!]
    expect(state.quests.progress(growing, haveHomes)).toBe(3)
    state.city.remove(extra[0].id) // down to 2 homes before claiming
    expect(state.quests.progress(growing, haveHomes)).toBe(3)
    // …and after a save and reload.
    expect(reload(state).quests.progress(growing, haveHomes)).toBe(3)
  })

  it('pay their reward once', () => {
    const t = town()
    finishWelcome(t)
    const { state } = t
    const coins = state.city.coins
    const xp = state.player.xp
    expect(state.quests.claim(welcome)).toBe(false)
    expect(state.city.coins).toBe(coins)
    expect(state.player.xp).toBe(xp)
    expect(state.quests.claimedQuests()).toContain(welcome)
    expect(reload(state).quests.claim(welcome)).toBe(false)
  })
})

describe('Progression', () => {
  it('unlocks exactly the right content at each level threshold', () => {
    const state = new GameState()
    for (let level = 2; level <= 13; level++) {
      const unlocking = state.unlocks.at(level)
      state.player.grantXp(xpForLevel(level) - 1 - state.player.xp) // one XP short
      expect(state.player.level).toBe(level - 1)
      for (const t of unlocking.buildings) expect(state.unlocks.isUnlocked(t)).toBe(false)
      for (const f of unlocking.features) expect(state.unlocks.hasFeature(f)).toBe(false)
      state.player.grantXp(1)
      expect(state.player.level).toBe(level)
      for (const t of unlocking.buildings) expect(state.unlocks.isUnlocked(t)).toBe(true)
      for (const c of unlocking.crops) expect(state.unlocks.isUnlocked(c)).toBe(true)
      for (const f of unlocking.features) expect(state.unlocks.hasFeature(f)).toBe(true)
    }
  })

  it('keeps content unlocked after loading a save', () => {
    const state = new GameState()
    state.player.grantXp(xpForLevel(9))
    const loaded = reload(state)
    expect(loaded.player.level).toBe(9)
    for (const t of BUILDING_TYPES) expect(loaded.unlocks.isUnlocked(t)).toBe(t.unlockLevel <= 9)
    for (const f of Object.keys(FEATURE_LEVELS) as Feature[]) expect(loaded.unlocks.hasFeature(f)).toBe(FEATURE_LEVELS[f] <= 9)
  })
})
