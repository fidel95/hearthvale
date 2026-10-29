import { describe, expect, it } from 'vitest'
import { STARTING_MATERIALS } from './construction'
import { SAVE_VERSION, citySave, upgradeSave } from './save'
import { TUTORIAL } from './tutorial'

// A save as Stages 0–5 wrote it: version 1, a 20×20 map, no land.
const v1 = {
  version: 1,
  savedAt: 0,
  city: { coins: 300, nextId: 3, buildings: [{ id: 1, typeId: 'cottage', tile: { x: 9, z: 9 }, readyAt: 0, crop: null }] },
  clock: { playedMs: 0 },
  taxes: { ledger: { year: 1 }, salesTaxHeld: 0, lastReturn: null, assets: [] },
}

// A save as Stages 5.5–9.5 wrote it: version 2, with everything inside "city" or at the top level.
const v2 = {
  version: 2,
  savedAt: 123,
  city: {
    coins: 900,
    goods: 55,
    nextId: 2,
    buildings: [{ id: 1, typeId: 'bakery', tile: { x: 25, z: 25 }, readyAt: 0, stock: 12 }],
    lots: [{ x: 2, z: 2, price: 250 }],
  },
  clock: { playedMs: 5000 },
  taxes: { ledger: { year: 1 }, salesTaxHeld: 0, lastReturn: null, assets: [] },
  player: { xp: 40, energy: 7, energyAt: 100 },
  inventory: [['candle', { count: 2, cost: 0 }]],
  collections: [['home', 1]],
  lastGrantAt: 99,
}

describe('upgradeSave', () => {
  it('moves version 1 buildings onto the starting land in the middle of the bigger world', () => {
    const save = upgradeSave(structuredClone(v1))!
    expect(save.version).toBe(SAVE_VERSION)
    expect(save.buildings.list[0].tile).toEqual({ x: 29, z: 29 })
    expect(save.land.parcels).toHaveLength(4)
    expect(save.resources.coins).toBe(300) // everything else is kept
  })

  it('regroups a version 2 save into sections, keeping everything', () => {
    const save = upgradeSave(structuredClone(v2))!
    expect(save.version).toBe(SAVE_VERSION)
    expect(save.player).toEqual({ xp: 40, energy: 7, energyAt: 100, level: 3 })
    expect(save.resources).toEqual({ coins: 900, goods: 55 })
    expect(save.buildings.list[0]).toMatchObject({ typeId: 'bakery', stock: 12 })
    expect(save.inventory).toEqual({ items: [['candle', { count: 2, cost: 0 }]], collections: [['home', 1]] })
    expect(save.calendar.playedMs).toBe(5000)
    expect(save.safetyNet.lastGrantAt).toBe(99)
    expect(save.tutorial.step).toBe(TUTORIAL.length) // a returning player skips the tutorial
    expect(citySave(save)).toMatchObject({ coins: 900, goods: 55, nextId: 2, lots: [{ x: 2, z: 2, price: 250 }] })
  })

  it('gives towns from before the inventory existed the starting materials', () => {
    const save = upgradeSave(structuredClone(v1))!
    const bricks = save.inventory.items.find(([id]) => id === 'bricks')
    expect(bricks?.[1].count).toBe(STARTING_MATERIALS.bricks)
  })

  it('passes current saves through and rejects ones from the future', () => {
    const current = upgradeSave(structuredClone(v1))!
    expect(upgradeSave(structuredClone(current) as never)).toEqual(current)
    expect(upgradeSave({ ...structuredClone(v1), version: 99 })).toBeNull()
  })
})
