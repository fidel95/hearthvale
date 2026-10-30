import { describe, expect, it } from 'vitest'
import { BUILDINGS_BY_ID, BUILDING_TYPES, PRIZE_TYPES } from './buildings'
import { FESTIVALS, festivalAt, weekAt, weeklyChallenges } from './eventData'
import { GameState } from './GameState'
import { SaveSystem } from './SaveSystem'

const b = (id: string) => BUILDINGS_BY_ID.get(id)!
const at = (x: number, z: number) => ({ x: 20 + x, z: 20 + z })
const OCT = new Date(2026, 9, 29, 12).getTime()

// A town at level 3 with a home that has rent waiting.
function town() {
  const state = new GameState()
  state.player.grantXp(400)
  expect(state.townEvents.unlocked).toBe(true)
  const home = state.city.place(b('cottage'), at(0, 0), { now: 0, free: true })!
  state.city.place(b('road'), at(0, 2), { free: true })
  return { state, home }
}

describe('Town events', () => {
  it('follow the real calendar: a festival each season, winter across the new year', () => {
    expect(festivalAt(OCT).festival.id).toBe('fall')
    expect(festivalAt(new Date(2027, 0, 10).getTime()).key).toBe('winter-2026')
    expect(festivalAt(new Date(2026, 11, 1).getTime()).key).toBe('winter-2026')
    expect(festivalAt(new Date(2026, 3, 1).getTime()).festival.id).toBe('spring')
    expect(festivalAt(OCT).endsAt).toBe(new Date(2026, 11, 1).getTime())
  })

  it('weeks run Monday to Sunday, with the same three challenges all week', () => {
    const thursday = new Date(2026, 9, 29).getTime() // a Thursday
    const monday = new Date(2026, 9, 26).getTime()
    const sunday = new Date(2026, 10, 1, 23).getTime()
    expect(weekAt(thursday).key).toBe(weekAt(monday).key)
    expect(weekAt(sunday).key).toBe(weekAt(monday).key)
    expect(weekAt(new Date(2026, 10, 2).getTime()).key).not.toBe(weekAt(monday).key)
    const goals = weeklyChallenges(weekAt(monday).key, 5)
    expect(goals).toEqual(weeklyChallenges(weekAt(monday).key, 5))
    expect(new Set(goals.map((g) => g.stat)).size).toBe(3)
  })

  it('count only what happens after the festival begins, and pay each goal once', () => {
    const state = new GameState()
    const home = state.city.place(b('cottage'), at(0, 0), { now: 0, free: true })!
    state.city.place(b('road'), at(0, 2), { free: true })
    state.city.production.collect(home.id, 60_000) // before the festival begins (level 2): doesn't count
    state.player.grantXp(400) // level 3: it begins
    state.townEvents.refresh(OCT)
    const rentGoal = FESTIVALS.fall.goals.findIndex((g) => g.stat === 'rent')
    expect(state.townEvents.progress('festival', rentGoal)).toBe(0)
    for (let i = 0; i < FESTIVALS.fall.goals[rentGoal].count; i++) state.city.production.collect(home.id, 60_000 * (i + 2))
    expect(state.townEvents.progress('festival', rentGoal)).toBe(FESTIVALS.fall.goals[rentGoal].count)
    expect(state.townEvents.isDone('festival', rentGoal)).toBe(true)
    const coins = state.city.coins
    expect(state.townEvents.claim('festival', rentGoal)).toBe(true)
    expect(state.city.coins).toBe(coins + FESTIVALS.fall.goalReward.coins)
    expect(state.townEvents.claim('festival', rentGoal)).toBe(false)
  })

  it('give the festival prize into storage once every goal is claimed, and it is taxed at its value', () => {
    const { state } = town()
    state.townEvents.refresh(OCT)
    // Pretend the town did everything (lifetime stats grow).
    const period = state.townEvents.festival(OCT)!.period
    for (const g of period.goals) period.start[g.stat] = -g.count
    expect(state.townEvents.bonusReady('festival')).toBe(false)
    period.goals.forEach((_, i) => state.townEvents.claim('festival', i))
    expect(state.townEvents.bonusReady('festival')).toBe(true)
    const other = state.taxes.toSave().ledger.otherIncome
    expect(state.townEvents.claimBonus('festival')).toBe(true)
    const prize = [...state.city.storedBuildings()].find((s) => s.type.prize)
    expect(prize?.type.id).toBe(FESTIVALS.fall.prize)
    expect(state.taxes.toSave().ledger.otherIncome).toBe(other + prize!.type.cost)
    expect(state.townEvents.claimBonus('festival')).toBe(false)
    // And it can be placed, free.
    expect(state.city.restore(prize!.id, at(6, 6))).toBe(true)
  })

  it('start fresh when a new week begins, and survive a save and reload', () => {
    const { state } = town()
    state.townEvents.refresh(OCT)
    const before = state.townEvents.week(OCT)!.key
    const saved = new SaveSystem(state).toSave()
    const loaded = new GameState()
    new SaveSystem(loaded).load(saved)
    expect(new SaveSystem(loaded).toSave().events).toEqual(saved.events)
    loaded.townEvents.refresh(new Date(2026, 10, 3).getTime())
    expect(loaded.townEvents.week(new Date(2026, 10, 3).getTime())!.key).not.toBe(before)
  })

  it('prizes are never sold in the build menu', () => {
    for (const p of PRIZE_TYPES) expect(BUILDING_TYPES).not.toContain(p)
    for (const f of Object.values(FESTIVALS)) expect(BUILDINGS_BY_ID.get(f.prize)?.prize).toBe(f.name)
  })

  it('wait until level 3', () => {
    const state = new GameState()
    state.townEvents.refresh(OCT)
    expect(state.townEvents.festival(OCT)).toBeNull()
  })
})
