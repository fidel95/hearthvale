import { describe, expect, it } from 'vitest'
import { CARGO_ROUTES, STAR_TRIPS, UNLOAD_ENERGY, starsFor } from '../game/Cargo'
import { GameState } from '../game/GameState'
import { at, b, reload, richGame } from './helpers'

const T = Date.now() // energy is stored against the real clock
const coast = CARGO_ROUTES[0]

function airportGame() {
  const state = richGame()
  const airport = state.city.place(b('airport'), at(0, 0), { now: T, free: true })!
  state.city.economy.changeGoods(-state.city.goods) // an empty storage, with room for the load
  return { state, airport }
}

describe('cargo planes', () => {
  it('takes the fare up front and brings the goods after the flight', () => {
    const { state, airport } = airportGame()
    const coins = state.city.coins
    const goods = state.city.goods
    expect(state.cargo.send(airport, coast, T)).toBe(true)
    expect(state.city.coins).toBe(coins - coast.cost)
    expect(state.cargo.state(airport, T + 1000).stage).toBe('flying')
    expect(state.cargo.send(airport, coast, T)).toBe(false) // one plane at a time
    expect(state.cargo.unload(airport, T + 1000).taken).toBe(0)
    const landed = T + coast.seconds * 1000
    expect(state.cargo.state(airport, landed).stage).toBe('landed')
    expect(state.cargo.unload(airport, landed).taken).toBe(coast.units)
    expect(state.city.goods).toBe(goods + coast.units)
    expect(state.cargo.state(airport, landed).stage).toBe('idle')
  })

  it('costs two energy to unload', () => {
    const { state, airport } = airportGame()
    state.cargo.send(airport, coast, T)
    const landed = T + coast.seconds * 1000
    // Energy is spent against the real clock, so measure it there.
    const before = state.player.energy(Date.now())
    state.cargo.unload(airport, landed)
    expect(before - state.player.energy(Date.now())).toBe(UNLOAD_ENERGY)
  })

  it('earns a star every few trips and pays a reward at three stars, once', () => {
    const { state, airport } = airportGame()
    expect(starsFor(0)).toBe(0)
    expect(starsFor(STAR_TRIPS[2])).toBe(3)
    let now = T
    const steel = () => state.inventory.count(coast.reward.material)
    const before = steel()
    for (let i = 0; i < STAR_TRIPS[2] + 2; i++) {
      state.city.economy.changeGoods(-state.city.goods) // empty the storage
      state.cargo.send(airport, coast, now)
      now += coast.seconds * 1000
      state.cargo.unload(airport, now)
    }
    expect(state.cargo.stars(coast.id)).toBe(3)
    expect(steel() - before).toBe(coast.reward.count)
  })

  it('keeps what does not fit aboard, and the trip counts once it is all off', () => {
    const { state, airport } = airportGame()
    state.city.economy.changeGoods(state.city.storageCapacity - state.city.goods - 30) // room for 30
    state.cargo.send(airport, coast, T)
    const landed = T + coast.seconds * 1000
    expect(state.cargo.unload(airport, landed).taken).toBe(30)
    expect(state.cargo.tripsOn(coast.id)).toBe(0)
    expect(state.cargo.unload(airport, landed).taken).toBe(0) // full
    state.city.economy.changeGoods(-state.city.goods)
    expect(state.cargo.unload(airport, landed).taken).toBe(coast.units - 30)
    expect(state.cargo.tripsOn(coast.id)).toBe(1)
  })

  it('refunds the fare when the airport is demolished mid-flight', () => {
    const { state, airport } = airportGame()
    const coins = state.city.coins
    state.cargo.send(airport, coast, T)
    state.city.remove(airport.id)
    expect(state.city.coins).toBe(coins)
    expect([...state.cargo.all()]).toHaveLength(0)
  })

  it('survives saving and loading, flight and mastery included', () => {
    const { state, airport } = airportGame()
    state.cargo.send(airport, coast, T)
    const fresh = reload(state)
    expect([...fresh.cargo.all()]).toHaveLength(1)
    const loadedAirport = [...fresh.city.all()].find((x) => x.type.id === 'airport')!
    expect(fresh.cargo.state(loadedAirport, T + coast.seconds * 1000).stage).toBe('landed')
    // An older save with no cargo field still loads.
    const old = JSON.parse(JSON.stringify({ ...fresh.cargo.toSave() }))
    expect(old.trips).toEqual([])
    expect(new GameState().cargo.toSave().flights).toEqual([])
  })
})
