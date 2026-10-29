import { describe, expect, it } from 'vitest'
import { cropState, CROPS_BY_ID } from '../game/crops'
import { productionState } from '../game/production'
import { collectXp } from '../game/progression'
import { at, b, reload, richGame } from './helpers'

// Test plan: production timers.
const T = 1_000_000 // when production starts
const strawberries = CROPS_BY_ID.get('strawberries')! // grows in 60 s

function started() {
  const state = richGame()
  const home = state.city.place(b('cottage'), at(0, 0), { now: T, free: true })! // 15 coins every 30 s
  const plot = state.city.place(b('farm-plot'), at(4, 0), { now: T, free: true })!
  state.city.production.plant(plot.id, strawberries, { now: T })
  const site = state.city.place(b('townhouse'), at(8, 0), { now: T })! // 60 s to build
  return { state, home, plot, site }
}

describe('Production', () => {
  it('starts with the right completion time', () => {
    const { home, plot, site } = started()
    expect(home.readyAt).toBe(T + 30_000)
    expect(cropState(plot.crop, T)).toMatchObject({ stage: 'growing', readyAt: T + 60_000 })
    expect(site.construction!.endsAt).toBe(T + 60_000)
  })

  it('is not ready before its completion time', () => {
    const { state, home, plot, site } = started()
    const p = state.city.production
    expect(productionState(state.city, home, T + 29_999)).toEqual({ state: 'producing', readyAt: T + 30_000 })
    expect(p.isReady(home, T + 29_999)).toBe(false)
    expect(p.collect(home.id, T + 29_999)).toBe(0)
    expect(p.harvest(plot.id, T + 59_999)).toBe(0)
    expect(p.constructionDone(site, T + 59_999)).toBe(false)
  })

  it('is ready once its completion time comes, and stays ready', () => {
    const { state, home, plot, site } = started()
    for (const t of [T + 30_000, T + 3_600_000]) {
      expect(productionState(state.city, home, t)).toEqual({ state: 'ready' })
    }
    expect(cropState(plot.crop, T + 60_000).stage).toBe('ripe')
    expect(state.city.production.constructionDone(site, T + 60_000)).toBe(true)
  })

  it('keeps completion times through a save and reload', () => {
    const { state, home, plot, site } = started()
    const loaded = reload(state)
    expect(loaded.city.get(home.id)!.readyAt).toBe(T + 30_000)
    expect(loaded.city.get(plot.id)!.crop).toEqual({ cropId: 'strawberries', plantedAt: T })
    expect(loaded.city.get(site.id)!.construction).toEqual({ endsAt: T + 60_000 })
    expect(loaded.city.production.collect(home.id, T + 29_999)).toBe(0)
    expect(loaded.city.production.collect(home.id, T + 30_000)).toBe(15)
  })

  it('pays the right rewards when collected', () => {
    const { state, home, plot } = started()
    const coins = state.city.coins
    const xp = state.player.xp
    expect(state.city.production.collect(home.id, T + 30_000)).toBe(15)
    expect(state.city.coins).toBe(coins + 15)
    expect(state.player.xp).toBe(xp + collectXp(15))
    // No shops in town, so the whole harvest is sold at the market.
    expect(state.city.production.harvest(plot.id, T + 60_000)).toBe(strawberries.sellPrice)
  })

  it('cannot collect the same cycle twice', () => {
    const { state, home, plot } = started()
    const p = state.city.production
    expect(p.collect(home.id, T + 30_000)).toBe(15)
    expect(p.collect(home.id, T + 30_000)).toBe(0)
    expect(p.collect(home.id, T + 59_999)).toBe(0) // the next cycle starts at collection
    expect(p.collect(home.id, T + 60_000)).toBe(15)
    expect(p.harvest(plot.id, T + 60_000)).toBeGreaterThan(0)
    expect(p.harvest(plot.id, T + 60_000)).toBe(0)
  })
})

