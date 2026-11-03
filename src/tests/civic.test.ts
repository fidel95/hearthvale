import { describe, expect, it } from 'vitest'
import { CIVIC_UPGRADES } from '../game/Civic'
import { BASE_STORAGE } from '../game/City'
import { CARGO_ROUTES } from '../game/Cargo'
import { BUILDINGS_BY_ID } from '../game/buildings'
import { FRANCHISE_FRIENDSHIP, NEIGHBORS } from '../game/neighborData'
import { at, b, reload, richGame } from './helpers'

const T = Date.now()

function townHallGame() {
  const state = richGame()
  for (const id of ['lumber', 'bricks', 'steel', 'glass'] as const) state.inventory.add(id, 100)
  state.city.place(b('town-hall'), at(0, 0), { now: T, free: true })
  return state
}

describe('civic upgrades', () => {
  it('need a finished Town Hall, coins and materials, and go up one step at a time', () => {
    const state = richGame()
    expect(state.civic.canBuy('storehouse')).toBe(false) // no Town Hall
    const town = townHallGame()
    const step = CIVIC_UPGRADES[0].steps[0]
    const coins = town.city.coins
    const lumber = town.inventory.count('lumber')
    expect(town.civic.buy('storehouse')).toBe(true)
    expect(town.city.coins).toBe(coins - step.coins)
    expect(town.inventory.count('lumber')).toBe(lumber - step.materials.lumber!)
    expect(town.civic.level('storehouse')).toBe(1)
    town.civic.buy('storehouse')
    town.civic.buy('storehouse')
    expect(town.civic.next('storehouse')).toBeNull()
    expect(town.civic.buy('storehouse')).toBe(false) // complete
  })

  it('raise storage', () => {
    const state = townHallGame()
    const before = state.city.storageCapacity
    state.civic.buy('storehouse')
    expect(state.city.storageCapacity).toBe(before + 100)
    expect(BASE_STORAGE).toBeGreaterThan(0)
  })

  it('bring cargo planes back sooner', () => {
    const state = townHallGame()
    const airport = state.city.place(b('airport'), at(0, 4), { now: T, free: true })!
    state.civic.buy('port')
    expect(state.services.shipSpeedBonus()).toBeCloseTo(0.1)
    state.cargo.speedBonus = () => state.services.shipSpeedBonus() // as Game wires it
    const coast = CARGO_ROUTES[0]
    state.cargo.send(airport, coast, T)
    const flight = [...state.cargo.all()][0]
    expect(flight.returnsAt - T).toBeCloseTo(coast.seconds * 1000 * 0.9)
  })

  it('raise franchise takings', () => {
    const state = townHallGame()
    const rosa = NEIGHBORS[0]
    const deli = BUILDINGS_BY_ID.get('deli')!
    state.city.place(deli, at(4, 0), { now: T, free: true })
    for (let i = 0; i < FRANCHISE_FRIENDSHIP; i++) state.neighbors.help(rosa, `s${i}`, T - (i < 5 ? 86_400_000 : 0))
    expect(state.neighbors.openFranchise(rosa, deli, T)).toBe(true)
    const base = state.neighbors.franchiseTakings(rosa)
    state.civic.buy('commerce')
    expect(state.neighbors.franchiseTakings(rosa)).toBe(Math.round(base * 1.25))
  })

  it('are kept in the save', () => {
    const state = townHallGame()
    state.civic.buy('port')
    state.civic.buy('port')
    const fresh = reload(state)
    expect(fresh.civic.level('port')).toBe(2)
    expect(fresh.services.shipSpeedBonus()).toBeCloseTo(0.2)
  })
})
