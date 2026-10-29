import { describe, expect, it } from 'vitest'
import { SAVE_VERSION, upgradeSave } from './save'

// A save as Stages 0–5 wrote it: version 1, a 20×20 map, no land.
const v1 = {
  version: 1,
  savedAt: 0,
  city: { coins: 300, nextId: 3, buildings: [{ id: 1, typeId: 'cottage', tile: { x: 9, z: 9 }, readyAt: 0, crop: null }] },
  clock: { playedMs: 0 },
  taxes: { ledger: { year: 1 }, salesTaxHeld: 0, lastReturn: null, assets: [] },
}

describe('upgradeSave', () => {
  it('moves version 1 buildings onto the starting land in the middle of the bigger world', () => {
    const save = upgradeSave(structuredClone(v1))!
    expect(save.version).toBe(SAVE_VERSION)
    expect(save.city.buildings[0].tile).toEqual({ x: 29, z: 29 })
    expect(save.city.lots).toHaveLength(4)
    expect(save.city.coins).toBe(300) // everything else is kept
  })

  it('passes current saves through and rejects ones from the future', () => {
    const current = upgradeSave(structuredClone(v1))!
    expect(upgradeSave(structuredClone(current) as never)).toEqual(current)
    expect(upgradeSave({ ...structuredClone(v1), version: 99 })).toBeNull()
  })
})
