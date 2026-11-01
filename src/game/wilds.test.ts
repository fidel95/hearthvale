import { describe, expect, it } from 'vitest'
import { GameState } from './GameState'
import { LOT_SIZE, lotCorner, lotOf } from './grid'
import { GROW_EVERY_MS, WILDS, WILDS_PER_LOT, WILDS_PER_NEW_LOT, Wilds } from './wilds'
import { at, b, reload, richGame } from '../tests/helpers'

const NEW_LOT = { x: 4, z: 2 } // beside the starting land

// A rich town with its own Wilds, with chance under the test's control.
function town(rand: () => number = () => 0) {
  const state = richGame()
  const wilds = new Wilds(state.city, state.player, state.inventory, rand)
  return { state, wilds }
}

describe('The wilds', () => {
  it('new land comes with a few trees, rocks and bushes on it', () => {
    const state = richGame()
    const before = state.wilds.count
    expect(state.city.buyLot(NEW_LOT)).toBe(true)
    const grown = [...state.wilds.all()].filter((w) => lotOf(w.tile).x === NEW_LOT.x && lotOf(w.tile).z === NEW_LOT.z)
    expect(grown.length).toBeGreaterThanOrEqual(WILDS_PER_NEW_LOT - 1)
    expect(grown.length).toBeLessThanOrEqual(WILDS_PER_NEW_LOT + 1)
    expect(state.wilds.count - before).toBe(grown.length)
  })

  it('a new town has some on its starting land, but none under its buildings', () => {
    const state = new GameState()
    state.seedNewTown()
    expect(state.wilds.count).toBeGreaterThan(0)
    for (const w of state.wilds.all()) {
      expect(state.city.ownsTile(w.tile)).toBe(true)
      expect(state.city.buildingAt(w.tile)).toBeUndefined()
    }
  })

  it('clearing one pays coins and XP, uses energy, and sometimes leaves a material', () => {
    const { state, wilds } = town(() => 0) // always the first kind (a tree), always lucky
    wilds.spawnOnLot(lotOf(at(0, 0)), 2) // one, when chance is 0
    const wild = [...wilds.all()][0]
    expect(wild.kind).toBe('tree')
    const now = Date.now()
    const coins = state.city.coins
    const xp = state.player.xp
    const energy = state.player.energy(now)
    const lumber = state.inventory.count('lumber')
    const cleared = wilds.clear(wild.tile, now)!
    expect(cleared.coins).toBe(WILDS.tree.coins)
    expect(state.city.coins - coins).toBe(WILDS.tree.coins)
    expect(state.player.xp - xp).toBe(WILDS.tree.xp)
    expect(state.player.energy(Date.now())).toBe(energy - 1) // the Player spends it at its own clock time
    expect(state.inventory.count('lumber')).toBe(lumber + 1)
    expect(wilds.at(wild.tile)).toBeUndefined()
    expect(wilds.clear(wild.tile, now)).toBeNull() // nothing left there
  })

  it("can't be cleared without energy", () => {
    const { state, wilds } = town()
    wilds.spawnOnLot(lotOf(at(0, 0)), 2) // one, when chance is 0
    const wild = [...wilds.all()][0]
    const now = Date.now()
    while (state.player.energy(now) > 0) {
      wilds.spawnOnLot(lotOf(at(0, 0)), 2) // one, when chance is 0
      const other = [...wilds.all()].find((w) => w !== wild)!
      wilds.clear(other.tile, now)
    }
    expect(wilds.clear(wild.tile, now)).toBeNull()
    expect(wilds.at(wild.tile)).toBe(wild)
  })

  it('building on a spot clears what grows there, for nothing', () => {
    const { state, wilds } = town()
    wilds.spawnOnLot(lotOf(at(0, 0)), 2) // one, when chance is 0
    const wild = [...wilds.all()][0]
    const coins = state.city.coins
    const placed = state.city.place(b('oak-tree'), wild.tile)
    expect(placed).not.toBeNull()
    expect(wilds.at(wild.tile)).toBeUndefined()
    expect(state.city.coins).toBe(coins - b('oak-tree').cost)
  })

  it('springs up on empty land now and then, up to one per lot', () => {
    let seed = 1
    const { state, wilds } = town(() => ((seed = (seed * 16807) % 2147483647) / 2147483647))
    const lots = [...state.city.ownedLots()].length
    wilds.update(0)
    expect(wilds.count).toBe(0)
    wilds.update(GROW_EVERY_MS)
    expect(wilds.count).toBe(1)
    // A long time away fills the land up to the limit, and no more.
    wilds.update(GROW_EVERY_MS * 100)
    expect(wilds.count).toBe(lots * WILDS_PER_LOT)
    for (const w of wilds.all()) {
      expect(state.city.buildingAt(w.tile)).toBeUndefined()
      const corner = lotCorner(lotOf(w.tile))
      expect(w.tile.x - corner.x).toBeLessThan(LOT_SIZE)
    }
  })

  it('keeps its trees and rocks through a save', () => {
    const state = richGame()
    state.city.buyLot(NEW_LOT)
    state.wilds.update(1000)
    const loaded = reload(state)
    expect([...loaded.wilds.all()]).toEqual([...state.wilds.all()])
    expect(loaded.wilds.toSave().nextGrowAt).toBe(state.wilds.toSave().nextGrowAt)
  })
})
