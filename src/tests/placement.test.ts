import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { GameState } from '../game/GameState'
import { createBuildingObject } from '../game/models'
import { finishConstruction, buyLand } from '../game/projects'
import { at, b, reload, richGame, snapshot } from './helpers'

// Test plan: placement.
describe('Placement', () => {
  it('rejects placement outside unlocked land', () => {
    const state = richGame()
    const before = snapshot(state)
    const outside = { x: 5, z: 5 } // on the map, but not land the town owns
    expect(state.city.place(b('cottage'), outside)).toBeNull()
    expect(state.city.place(b('cottage'), at(19, 0))).toBeNull() // half over the edge of owned land
    expect(state.placement.check(b('cottage'), { tile: outside, rotation: 0 }).ok).toBe(false)
    expect(snapshot(state)).toEqual(before)
  })

  it('rejects overlapping footprints', () => {
    const state = richGame()
    state.city.place(b('cottage'), at(4, 4))
    expect(state.city.place(b('cottage'), at(5, 5))).toBeNull() // shares one tile
    expect(state.city.place(b('general-store'), at(2, 3))).toBeNull()
    expect(state.placement.check(b('cottage'), { tile: at(5, 5), rotation: 0 }).problems).toContain("It doesn't fit there")
    expect(state.city.place(b('cottage'), at(6, 4))).not.toBeNull() // right beside it is fine
  })

  it('rejects placement when coins are insufficient', () => {
    const state = new GameState()
    state.city.economy.bill(state.city.coins - 99) // 99 left; a cottage costs 100
    expect(state.city.place(b('cottage'), at(0, 0))).toBeNull()
    expect(state.placement.check(b('cottage')).problems[0]).toMatch(/Need 🪙 1 more/)
  })

  it('rejects finishing construction or buying land when materials are short', () => {
    const state = richGame()
    const site = state.city.place(b('townhouse'), at(0, 0), { now: 0 })! // needs 3 lumber to finish
    const result = finishConstruction(state.city, state.inventory, site, 60_000)
    expect(result).toEqual({ ok: false, reason: 'materials', missing: { lumber: 3 } })
    expect(site.construction).not.toBeNull()
    const lot = { x: 4, z: 2 } // next to the starting land
    expect(buyLand(state.city, state.inventory, state.player, lot)).toMatchObject({ ok: false, reason: 'materials' })
    expect(state.city.ownsLot(lot)).toBe(false)
  })

  it('does not deduct anything when placement fails', () => {
    const state = richGame()
    state.city.place(b('cottage'), at(4, 4))
    const site = state.city.place(b('townhouse'), at(10, 10), { now: 0 })!
    const before = snapshot(state)
    state.city.place(b('cottage'), at(5, 5)) // overlaps
    state.city.place(b('cottage'), { x: 5, z: 5 }) // not owned
    state.city.place(b('lighthouse'), at(0, 0)) // not on the shore
    finishConstruction(state.city, state.inventory, site, 60_000) // no lumber
    buyLand(state.city, state.inventory, state.player, { x: 4, z: 2 }) // no materials
    expect(snapshot(state)).toEqual(before)

    const poor = new GameState()
    poor.city.economy.bill(poor.city.coins)
    const poorBefore = snapshot(poor)
    poor.city.place(b('cottage'), at(0, 0))
    expect(snapshot(poor)).toEqual(poorBefore)
  })

  it('enforces road access for shops', () => {
    const state = richGame()
    const check = state.placement.check(b('bakery'), { tile: at(2, 2), rotation: 0 })
    expect(check.ok).toBe(true) // it can be placed…
    expect(check.warnings[0]).toMatch(/road/) // …with a warning
    const bakery = state.city.place(b('bakery'), at(2, 2), { now: 0 })!
    state.city.production.restock(bakery.id)
    const coins = state.city.coins
    expect(state.city.isOperating(bakery)).toBe(false)
    expect(state.city.production.collect(bakery.id, 10_000_000)).toBe(0)
    expect(state.city.coins).toBe(coins)
    state.city.place(b('road'), at(1, 2)) // touching its left side
    expect(state.city.isOperating(bakery)).toBe(true)
    expect(state.city.production.collect(bakery.id, 10_000_000)).toBeGreaterThan(0)
  })

  it('updates the footprint when a building moves or turns', () => {
    const state = richGame()
    const store = state.city.place(b('general-store'), at(0, 0), { free: true })! // 3×2
    expect(state.city.move(store.id, at(10, 10), 1)).toBe(true) // turned: now 2×3
    expect(state.city.buildingAt(at(0, 0))).toBeUndefined() // old tiles are free
    expect(state.city.buildingAt(at(2, 1))).toBeUndefined()
    expect(state.city.canPlace(b('general-store'), at(0, 0))).toBe(true)
    expect(state.city.buildingAt(at(11, 12))).toBe(store) // new footprint, turned
    expect(state.city.buildingAt(at(12, 10))).toBeUndefined()
    const loaded = reload(state)
    const moved = loaded.city.get(store.id)!
    expect(moved.tile).toEqual(at(10, 10))
    expect(loaded.city.buildingAt(at(11, 12))).toBe(moved)
  })

  it('lets the admin free-build power place anything, at any level, for nothing', () => {
    const state = new GameState()
    state.city.economy.bill(state.city.coins) // no coins, level 1
    state.placement.freeBuild = true
    expect(state.placement.check(b('manor'), { tile: at(0, 0), rotation: 0 }).ok).toBe(true)
    state.placement.freeBuild = false
    expect(state.placement.check(b('manor'), { tile: at(0, 0), rotation: 0 }).ok).toBe(false)
  })

  it('places the offshore oil refinery only out in the ocean and animates its rig', async () => {
    const state = richGame()
    const refinery = b('oil-refinery')
    expect(state.city.canPlace(refinery, at(4, 4))).toBe(false)
    expect(state.placement.check(refinery, { tile: at(4, 4), rotation: 0 }).problems).toContain('It must stand out at sea, in the ocean')
    // Right at the shoreline where edge tiles touch the beach is also rejected.
    expect(state.city.canPlace(refinery, { x: 30, z: 45 })).toBe(false)
    // Out in the open ocean, surrounded by water, it places and operates without a road.
    const oceanTile = { x: 30, z: 58 }
    expect(state.placement.check(refinery, { tile: oceanTile, rotation: 0 }).ok).toBe(true)
    const placed = state.city.place(refinery, oceanTile, { free: true })!
    expect(placed).not.toBeNull()
    expect(state.city.isOperating(placed)).toBe(true)

    const obj = await createBuildingObject(refinery)
    let animatedCount = 0
    obj.traverse((part: THREE.Object3D) => {
      if (typeof part.userData.animate === 'function') {
        animatedCount++
        part.userData.animate(0)
        part.userData.animate(5.5)
        part.userData.animate(14.2)
      }
    })
    expect(animatedCount).toBeGreaterThanOrEqual(7)
  })
})
