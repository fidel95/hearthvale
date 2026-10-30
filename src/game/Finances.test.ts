import { describe, expect, it } from 'vitest'
import { BUILDINGS_BY_ID } from './buildings'
import { MONTH_MS } from './GameClock'
import { GameState } from './GameState'
import { SaveSystem } from './SaveSystem'

const b = (id: string) => BUILDINGS_BY_ID.get(id)!
const at = (x: number, z: number) => ({ x: 20 + x, z: 20 + z })

describe('Finances', () => {
  it('sorts income by source and spending by kind, month by month', () => {
    const state = new GameState()
    state.city.place(b('cottage'), at(0, 0), { now: 0 }) // invested
    const home = [...state.city.all()].find((x) => x.type.id === 'cottage')!
    state.city.place(b('road'), at(0, 2), { free: true })
    const rent = state.city.production.collect(home.id, 60_000)
    state.city.economy.award(30, 'Tourism: visitor spending')
    state.city.economy.award(20, 'Level 2 reward')
    state.city.economy.expense(7, 'Utility upkeep')
    const t = state.finances.totals(1)
    expect(t.income.rent).toBe(rent)
    expect(t.income.tourism).toBe(30)
    expect(t.income.prizes).toBe(20)
    expect(t.spending.invested).toBe(b('cottage').cost)
    expect(t.spending.running).toBe(7)
    expect(t.profit).toBe(rent + 50 - 7) // investing isn't a running cost
    expect(state.finances.topEarners(1)).toEqual([['Cottage', rent]])
  })

  it('keeps each month apart, and counts empty months in the chart', () => {
    const state = new GameState()
    state.city.economy.award(10, 'prize')
    state.clock.playedMs = 2 * MONTH_MS + 1
    state.city.economy.award(5, 'prize')
    const recent = state.finances.recent(12)
    expect(recent.map((m) => m.index)).toEqual([0, 1, 2])
    expect(recent.map((m) => state.finances.monthTotals(m).profit)).toEqual([10, 0, 5])
  })

  it('leaves sales tax out: it passes through to the county', () => {
    const state = new GameState()
    for (let x = 0; x < 4; x++) state.city.place(b('road'), at(x, 2), { free: true })
    const shop = state.city.place(b('bakery'), at(0, 0), { now: 0, free: true })!
    state.city.production.restock(shop.id)
    const coinsBefore = state.city.coins
    const sales = state.city.production.collect(shop.id, 600_000)
    expect(state.city.coins - coinsBefore).toBeGreaterThan(sales) // the customer paid sales tax on top
    expect(state.finances.totals(1).income.sales).toBe(sales)
  })

  it('survives a save and reload', () => {
    const state = new GameState()
    state.city.economy.award(10, 'prize')
    state.city.economy.expense(3, 'upkeep')
    const saved = new SaveSystem(state).toSave()
    const loaded = new GameState()
    new SaveSystem(loaded).load(saved)
    expect(loaded.finances.totals(1)).toEqual(state.finances.totals(1))
    expect(new SaveSystem(loaded).toSave().finances).toEqual(saved.finances)
  })
})
