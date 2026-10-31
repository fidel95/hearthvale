import { describe, expect, it } from 'vitest'
import { DAILY_DAYS, dailyGift, dayKey } from './daily'
import { GameState } from './GameState'
import { SaveSystem } from './SaveSystem'

const day = (d: number) => new Date(2026, 9, d, 12)

describe('daily gift', () => {
  it('grows through the week to a big gift on day 7', () => {
    const gifts = Array.from({ length: DAILY_DAYS }, (_, i) => dailyGift(i + 1, 10))
    for (let i = 1; i < gifts.length; i++) expect(gifts[i].coins).toBeGreaterThan(gifts[i - 1].coins)
    expect(gifts[6].energy).toBeGreaterThan(gifts[5].energy)
    expect(dailyGift(1, 20).coins).toBe(2 * dailyGift(1, 10).coins)
  })

  it('is collected once a day, and pays coins, XP and energy', () => {
    const state = new GameState()
    state.seedNewTown(0)
    const coins = state.city.economy.coins
    const xp = state.player.xp
    expect(state.daily.due(day(1))).toBe(true)
    const gift = state.daily.claim(day(1))!
    expect(state.city.economy.coins).toBe(coins + gift.coins)
    expect(state.player.xp).toBe(xp + gift.xp)
    expect(state.daily.claim(day(1))).toBeNull()
    expect(state.daily.due(new Date(2026, 9, 1, 23, 59))).toBe(false)
    expect(state.daily.due(day(2))).toBe(true)
  })

  it('carries on where it left off after a missed day, and starts again after day 7', () => {
    const state = new GameState()
    state.seedNewTown(0)
    state.daily.claim(day(1))
    state.daily.claim(day(2))
    state.daily.claim(day(9)) // a week away
    expect(state.daily.next).toBe(4)
    for (let d = 10; d <= 13; d++) state.daily.claim(day(d))
    expect(state.daily.next).toBe(1)
    expect(state.daily.visits).toBe(7)
  })

  it('is saved and loaded', () => {
    const state = new GameState()
    state.seedNewTown(0)
    state.daily.claim(day(1))
    state.daily.claim(day(2))
    const save = new SaveSystem(state).toSave()
    const loaded = new GameState()
    new SaveSystem(loaded).load(save)
    expect(loaded.daily.next).toBe(3)
    expect(loaded.daily.due(day(2))).toBe(false)
  })

  it('uses the local calendar day', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05')
  })
})
