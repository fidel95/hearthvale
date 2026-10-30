import { describe, expect, it } from 'vitest'
import { GameState } from '../game/GameState'
import { upgradeQuote } from '../game/projects'
import { at, b } from './helpers'

// Bugs the audit found, each pinned by a test so it can't come back.

describe('Audit fixes', () => {
  it('Admin free building still allows only one of a one-of-a-kind building', () => {
    const state = new GameState()
    state.placement.freeBuild = true
    const airport = b('airport')
    expect(state.placement.check(airport, { tile: at(0, 0), rotation: 0 }).ok).toBe(true)
    state.city.place(airport, at(0, 0), { free: true })
    expect(state.placement.check(airport, { tile: at(0, 10), rotation: 0 }).problems.join()).toMatch(/already have/)
  })

  it('a damaged park stops lifting the homes around it, and a repaired one starts again', () => {
    const state = new GameState()
    state.city.economy.adjust(5000)
    const park = state.city.place(b('park'), at(0, 0), { free: true })!
    const home = state.city.place(b('cottage'), at(3, 0), { free: true })!
    const lifted = state.services.bonus(home).total
    expect(lifted).toBeGreaterThan(0)
    state.disasters.strike('tornado', [park.tile], 1)
    expect(state.services.bonus(home).total).toBeLessThan(lifted)
    state.disasters.repair(park.id)
    expect(state.services.bonus(home).total).toBe(lifted)
  })

  it('a damaged building must be repaired before it can be upgraded', () => {
    const state = new GameState()
    state.player.grantXp(100_000)
    const home = state.city.place(b('cottage'), at(0, 0), { free: true })!
    state.disasters.strike('tornado', [home.tile], 1)
    expect(upgradeQuote(state.city, state.inventory, state.player, home)!.result).toEqual({ ok: false, reason: 'damaged' })
  })

  it('a building that cost nothing has nothing to depreciate', () => {
    const state = new GameState()
    const gift = state.city.place(b('villa'), at(0, 0), { free: true, basis: 0 })!
    const bought = state.city.place(b('villa'), at(5, 0), { free: true })!
    const assets = new Map(state.taxes.toSave().assets)
    expect(assets.get(gift.id)!.basis).toBe(0)
    expect(assets.get(bought.id)!.basis).toBe(b('villa').cost)
  })
})
