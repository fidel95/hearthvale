import { describe, expect, it } from 'vitest'
import { PARADE } from './Army'
import { BUILDINGS_BY_ID } from './buildings'
import { GameState } from './GameState'
import { SaveSystem } from './SaveSystem'

const at = (x: number, z: number) => ({ x: 20 + x, z: 20 + z })

function withBase() {
  const state = new GameState()
  state.city.economy.adjust(5000)
  state.city.place(BUILDINGS_BY_ID.get('army-base')!, at(0, 0), { free: true })
  for (let x = 0; x < 4; x++) state.city.place(BUILDINGS_BY_ID.get('road')!, at(x, 3), { free: true })
  return state
}

describe('Army parades', () => {
  it('need an army base with a road', () => {
    const state = new GameState()
    expect(state.army.canHoldParade(0)).toMatchObject({ ok: false, reason: 'no-base' })
    state.city.place(BUILDINGS_BY_ID.get('army-base')!, at(0, 0), { free: true })
    expect(state.army.canHoldParade(0)).toMatchObject({ ok: false, reason: 'no-base' }) // no road yet
  })

  it('cost coins as a deductible expense, and lift all income while they last', () => {
    const state = withBase()
    const home = state.city.place(BUILDINGS_BY_ID.get('cottage')!, at(6, 0), { now: 0, free: true })!
    const before = state.city.production.payout(home)
    const coins = state.city.coins
    const now = Date.now()
    expect(state.army.holdParade(now).ok).toBe(true)
    expect(state.city.coins).toBe(coins - PARADE.cost)
    expect(state.taxes.toSave().ledger.operatingExpenses).toBeGreaterThanOrEqual(PARADE.cost)
    expect(state.army.bonus(now)).toBe(PARADE.bonus)
    expect(state.city.production.payout(home)).toBeGreaterThan(before)
    expect(state.army.bonus(now + PARADE.durationMs)).toBe(0)
  })

  it('need a rest between parades, and remember it through a save', () => {
    const state = withBase()
    state.army.holdParade(1_000)
    expect(state.army.canHoldParade(1_000 + PARADE.cooldownMs - 1)).toMatchObject({ ok: false, reason: 'resting' })
    const loaded = new GameState()
    new SaveSystem(loaded).load(JSON.parse(JSON.stringify(new SaveSystem(state).toSave())))
    expect(loaded.army.canHoldParade(1_000 + 5)).toMatchObject({ ok: false, reason: 'resting' })
    expect(state.army.canHoldParade(1_000 + PARADE.cooldownMs).ok).toBe(true)
  })
})
