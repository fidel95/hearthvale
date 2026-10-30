import { describe, expect, it } from 'vitest'
import { BUILDINGS_BY_ID } from './buildings'
import { GameState } from './GameState'
import { happiness, happinessFactor, HAPPINESS_BONUS, homeNeeds } from './needs'

const b = (id: string) => BUILDINGS_BY_ID.get(id)!
const at = (x: number, z: number) => ({ x: 20 + x, z: 20 + z })
const placed = (id: string, x: number, z: number) => ({ type: b(id), tile: at(x, z), rotation: 0 as const })

describe('Resident needs', () => {
  it('every home wants shopping and green space; family homes want a school too', () => {
    expect(homeNeeds(placed('cottage', 0, 0), []).map((n) => n.need.id)).toEqual(['shopping', 'green'])
    expect(homeNeeds(placed('manor', 0, 0), []).map((n) => n.need.id)).toEqual(['shopping', 'green', 'school'])
  })

  it('apartment buildings also want a hospital and a police station; smaller homes never do', () => {
    expect(homeNeeds(placed('apartment-block', 0, 0), []).map((n) => n.need.id)).toEqual(['shopping', 'green', 'school', 'health', 'safety'])
    expect(homeNeeds(placed('manor', 0, 0), []).map((n) => n.need.id)).not.toContain('health')
    const met = homeNeeds(placed('apartment-block', 0, 0), [placed('hospital', 5, 5), placed('police-station', 0, 5)])
    expect(met.filter((n) => n.met).map((n) => n.need.id)).toEqual(['health', 'safety'])
  })

  it('are met by the right buildings within reach', () => {
    const home = placed('cottage', 0, 0)
    const needs = homeNeeds(home, [placed('bakery', 4, 0), placed('park', 15, 15)])
    expect(needs.map((n) => [n.need.id, n.met])).toEqual([
      ['shopping', true],
      ['green', false], // too far
    ])
    expect(happiness(needs)).toBe(0.5)
  })

  it('lift rent by up to 15%, and never lower it', () => {
    expect(happinessFactor(0)).toBe(1)
    expect(happinessFactor(1)).toBe(1 + HAPPINESS_BONUS)
  })

  it('show up in the town: happiness, wishes and rent', () => {
    const state = new GameState()
    const home = state.city.place(b('cottage'), at(0, 0), { now: 0, free: true })!
    expect(state.services.happiness(home)).toBe(0)
    expect(state.services.wishes().map((w) => w.need.id)).toEqual(['shopping', 'green'])
    const plain = state.city.production.payout(home)
    state.city.place(b('playground'), at(3, 0), { free: true })
    state.city.place(b('bakery'), at(0, 3), { free: true })
    state.city.place(b('road'), at(0, 5), { free: true }) // a shop only serves once it's open
    expect(state.services.happiness(home)).toBe(1)
    expect(state.services.wishes()).toEqual([])
    expect(state.city.production.payout(home)).toBeGreaterThan(plain)
  })
})
