import { describe, expect, it } from 'vitest'
import { BUILDINGS_BY_ID } from './buildings'
import { GameState } from './GameState'
import { SPEND_PER_VISITOR } from './Tourism'

const b = (id: string) => BUILDINGS_BY_ID.get(id)!
const at = (x: number, z: number) => ({ x: 20 + x, z: 20 + z })

describe('Tourism', () => {
  it('needs both a way in and something to do', () => {
    const state = new GameState()
    expect(state.tourism.report()).toEqual({ arrivals: 0, room: 0, visitors: 0, income: 0 })
    state.city.place(b('park'), at(0, 0), { free: true })
    expect(state.tourism.report().visitors).toBe(0) // nobody brings them
    state.city.place(b('bus-stop'), at(4, 0), { free: true })
    state.city.place(b('road'), at(4, 1), { free: true })
    const r = state.tourism.report()
    expect(r.arrivals).toBe(b('bus-stop').arrivals)
    expect(r.visitors).toBe(Math.min(b('bus-stop').arrivals!, b('park').visitors!))
  })

  it('pays visitor spending at the end of each month, as taxable income', () => {
    const state = new GameState()
    state.city.place(b('central-park'), at(0, 0), { free: true })
    state.city.place(b('bus-stop'), at(6, 0), { free: true })
    state.city.place(b('road'), at(6, 1), { free: true })
    const { visitors } = state.tourism.report()
    const coins = state.city.coins
    state.tourism.endOfMonth()
    expect(state.city.coins).toBe(coins + visitors * SPEND_PER_VISITOR)
    expect(state.taxes.toSave().ledger.otherIncome).toBe(visitors * SPEND_PER_VISITOR)
  })

  it('counts only working buildings', () => {
    const state = new GameState()
    state.city.place(b('park'), at(0, 0), { free: true })
    state.city.place(b('bus-stop'), at(4, 0), { free: true }) // no road: the bus can't reach it
    expect(state.tourism.report().arrivals).toBe(0)
  })
})
