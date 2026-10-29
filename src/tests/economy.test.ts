import { describe, expect, it } from 'vitest'
import type { CityEvent } from '../game/City'
import { CROPS_BY_ID } from '../game/crops'
import { GameState } from '../game/GameState'
import { buyLand, finishConstruction, upgradeBuilding } from '../game/projects'
import { levelReward, xpForLevel } from '../game/progression'
import { QUESTS } from '../game/quests'
import { at, b, reload, richGame, snapshot } from './helpers'

// Test plan: economy.
describe('Economy', () => {
  it('adds collected income to the coin balance, and nothing else', () => {
    const state = new GameState()
    const home = state.city.place(b('cottage'), at(0, 0), { now: 0, free: true })!
    const { coins, goods, debt } = state.city
    expect(state.city.production.collect(home.id, 30_000)).toBe(15)
    expect(state.city.coins).toBe(coins + 15)
    expect(state.city.goods).toBe(goods)
    expect(state.city.debt).toBe(debt)
  })

  it('pays debt from income before coins', () => {
    const state = new GameState()
    const home = state.city.place(b('cottage'), at(0, 0), { now: 0, free: true })!
    state.city.economy.bill(state.city.coins + 10) // 10 owed
    expect(state.city.debt).toBe(10)
    state.city.production.collect(home.id, 30_000) // pays 15
    expect(state.city.debt).toBe(0)
    expect(state.city.coins).toBe(5)
  })

  it('deducts each cost exactly once', () => {
    const state = richGame()
    const changes: number[] = []
    state.city.onChange((e: CityEvent) => e.kind === 'coins' && changes.push(e.coins))
    const start = state.city.coins
    const plot = state.city.place(b('farm-plot'), at(0, 0), { now: 0 })!
    expect(state.city.coins).toBe(start - b('farm-plot').cost)
    state.city.production.plant(plot.id, CROPS_BY_ID.get('strawberries')!, { now: 0 })
    expect(state.city.production.plant(plot.id, CROPS_BY_ID.get('strawberries')!, { now: 0 })).toBe(false) // already planted
    expect(state.city.coins).toBe(start - b('farm-plot').cost - 10)
    expect(changes).toHaveLength(2) // one deduction for the plot, one for the seeds
  })

  it('never lets a balance go below zero', () => {
    const state = new GameState()
    const coins = state.city.coins
    expect(() => state.city.economy.adjust(-(coins + 1))).toThrow()
    expect(state.city.coins).toBe(coins)
    state.city.economy.bill(coins + 50) // a bill bigger than the coins…
    expect(state.city.coins).toBe(0) // …takes them all
    expect(state.city.debt).toBe(50) // …and the rest is owed
    expect(() => state.city.economy.changeGoods(-(state.city.goods + 1))).toThrow()
    expect(state.city.goods).toBeGreaterThanOrEqual(0)
    expect(state.inventory.remove('lumber', 1)).toBe(false)
    expect(state.inventory.count('lumber')).toBe(0)
    expect(state.inventory.use({ lumber: 1 })).toBeNull()
  })

  it('pays each reward only once', () => {
    const state = new GameState()
    const home = state.city.place(b('cottage'), at(0, 0), { now: 0, free: true })!
    // Income: a second collection at the same moment pays nothing.
    expect(state.city.production.collect(home.id, 30_000)).toBe(15)
    expect(state.city.production.collect(home.id, 30_000)).toBe(0)
    // Quests: claimed once.
    const welcome = QUESTS[0]
    state.city.production.collect(home.id, 60_000)
    state.city.production.collect(home.id, 90_000)
    const plot = state.city.place(b('farm-plot'), at(4, 0), { free: true })!
    state.city.production.plant(plot.id, CROPS_BY_ID.get('strawberries')!, { now: 0, free: true })
    state.city.production.harvest(plot.id, 60_000)
    const before = state.city.coins
    expect(state.quests.claim(welcome)).toBe(true)
    const afterClaim = state.city.coins // the reward, plus a level-up reward its XP may bring
    expect(afterClaim).toBeGreaterThanOrEqual(before + welcome.reward.coins!)
    const xp = state.player.xp
    expect(state.quests.claim(welcome)).toBe(false)
    expect(state.city.coins).toBe(afterClaim)
    expect(state.player.xp).toBe(xp)
    // Level rewards: paid on reaching the level, never again after reloading.
    const withLevel = new GameState()
    const start = withLevel.city.coins
    withLevel.player.grantXp(xpForLevel(2))
    expect(withLevel.city.coins).toBe(start + levelReward(2))
    const loaded = reload(withLevel)
    loaded.player.grantXp(1)
    expect(loaded.city.coins).toBe(start + levelReward(2))
  })

  it('leaves the state untouched when an action is invalid', () => {
    const state = new GameState()
    const now = 1_000_000
    state.seedNewTown(now)
    const home = [...state.city.all()].find((x) => x.type.id === 'cottage')!
    const plot = [...state.city.all()].find((x) => x.type.category === 'farm')!
    const tree = [...state.city.all()].find((x) => x.type.category === 'decoration')!
    const before = snapshot(state)
    const p = state.city.production
    p.collect(home.id, home.readyAt - 1) // not ready
    p.collect(tree.id, now) // earns nothing
    p.harvest(plot.id, now) // not ripe
    p.clearPlot(plot.id, now) // not withered
    p.plant(plot.id, CROPS_BY_ID.get('wheat')!, { now }) // already planted
    p.plant(home.id, CROPS_BY_ID.get('wheat')!, { now }) // not a farm
    p.restock(home.id) // not a shop
    p.collect(9999, now) // no such building
    expect(upgradeBuilding(state.city, state.inventory, state.player, home).ok).toBe(false) // level too low
    expect(finishConstruction(state.city, state.inventory, home, now).ok).toBe(false) // nothing to finish
    expect(buyLand(state.city, state.inventory, state.player, { x: 0, z: 0 }).ok).toBe(false) // not next to the town
    expect(state.city.move(home.id, plot.tile)).toBe(false) // occupied
    expect(state.quests.claim(QUESTS[0])).toBe(false) // not done
    expect(snapshot(state)).toEqual(before)
  })
})
