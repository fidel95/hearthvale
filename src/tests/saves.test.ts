import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CROPS_BY_ID } from '../game/crops'
import { GameState } from '../game/GameState'
import { buyLand } from '../game/projects'
import { QUESTS } from '../game/quests'
import { SAVE_VERSION, importSave, readSave, upgradeSave } from '../game/save'
import { SaveSystem } from '../game/SaveSystem'
import { at, b, reload, richGame, snapshot } from './helpers'

// Test plan: saving.

// A stand-in for the browser's localStorage.
function fakeStorage() {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  }
}

describe('Save and load', () => {
  it('keeps resources and placed buildings', () => {
    const state = richGame()
    state.city.economy.bill(state.city.coins + 25) // some debt
    state.city.place(b('general-store'), at(0, 0), { free: true, rotation: 1 })
    const stored = state.city.place(b('cottage'), at(8, 0), { free: true })!
    state.city.store(stored.id)
    const loaded = reload(state)
    expect([loaded.city.coins, loaded.city.goods, loaded.city.debt]).toEqual([state.city.coins, state.city.goods, state.city.debt])
    const shape = (s: GameState) => [...s.city.all()].map(({ id, type, tile, rotation, level }) => ({ id, type: type.id, tile, rotation, level }))
    expect(shape(loaded)).toEqual(shape(state))
    expect([...loaded.city.storedBuildings()].map((x) => x.id)).toEqual([stored.id])
  })

  it('keeps production in progress', () => {
    const state = richGame()
    const home = state.city.place(b('cottage'), at(0, 0), { now: 5_000, free: true })!
    const plot = state.city.place(b('farm-plot'), at(4, 0), { free: true })!
    state.city.production.plant(plot.id, CROPS_BY_ID.get('wheat')!, { now: 7_000 })
    const site = state.city.place(b('townhouse'), at(8, 0), { now: 9_000 })!
    const shop = state.city.place(b('bakery'), at(12, 0), { free: true })!
    state.city.production.restock(shop.id)
    const loaded = reload(state)
    expect(loaded.city.get(home.id)!.readyAt).toBe(home.readyAt)
    expect(loaded.city.get(plot.id)!.crop).toEqual(plot.crop)
    expect(loaded.city.get(site.id)!.construction).toEqual(site.construction)
    expect(loaded.city.get(shop.id)!.stock).toBe(shop.stock)
  })

  it('keeps quests, level, inventory and land', () => {
    const state = richGame()
    const home = state.city.place(b('cottage'), at(0, 0), { now: 0, free: true })!
    state.city.production.collect(home.id, 30_000)
    state.inventory.add('lumber', 10)
    state.inventory.add('bricks', 10)
    state.inventory.add('candle', 2)
    expect(buyLand(state.city, state.inventory, state.player, { x: 4, z: 2 }).ok).toBe(true)
    const loaded = reload(state)
    const welcome = QUESTS[0]
    expect(loaded.quests.progress(welcome, welcome.tasks[0])).toBe(state.quests.progress(welcome, welcome.tasks[0]))
    expect(loaded.quests.activeQuests()).toEqual(state.quests.activeQuests())
    expect([loaded.player.level, loaded.player.xp]).toEqual([state.player.level, state.player.xp])
    for (const id of ['lumber', 'bricks', 'candle']) expect(loaded.inventory.count(id)).toBe(state.inventory.count(id))
    expect(loaded.city.ownsLot({ x: 4, z: 2 })).toBe(true)
    expect(snapshot(loaded)).toEqual(snapshot(state))
  })
})

describe('Old and damaged saves', () => {
  let storage: ReturnType<typeof fakeStorage>
  beforeEach(() => {
    storage = fakeStorage()
    vi.stubGlobal('localStorage', storage)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => vi.unstubAllGlobals())

  it('upgrades older versions, and rejects newer ones safely', () => {
    const v1 = {
      version: 1,
      savedAt: 0,
      city: { coins: 300, nextId: 2, buildings: [{ id: 1, typeId: 'cottage', tile: { x: 9, z: 9 }, readyAt: 0, crop: null }] },
      clock: { playedMs: 0 },
      taxes: { ledger: { year: 1 }, salesTaxHeld: 0, lastReturn: null, assets: [] },
    }
    const upgraded = upgradeSave(structuredClone(v1))!
    expect(upgraded.version).toBe(SAVE_VERSION)
    expect(SaveSystem.canLoad(upgraded)).toBe(true)
    const state = new GameState()
    new SaveSystem(state).load(upgraded)
    expect(state.city.coins).toBe(300)

    storage.setItem('hearthvale.save', JSON.stringify({ ...v1, version: 99 }))
    const result = readSave(SaveSystem.canLoad)
    expect(result.save).toBeNull()
    expect(storage.getItem('hearthvale.save.unreadable')).toContain('"version":99') // kept, not lost
  })

  it("starts a new town instead of crashing on invalid save data", () => {
    const valid = JSON.stringify({ version: SAVE_VERSION, savedAt: 0, ...new SaveSystem(new GameState()).toSave() })
    const broken = [
      '{not json',
      'null',
      '42',
      '[]',
      `{"version":${SAVE_VERSION}}`, // the right version, but nothing in it
      valid.replace('"buildings":{', '"buildings":null,"x":{'), // a section missing
    ]
    for (const raw of broken) {
      storage.clear()
      storage.setItem('hearthvale.save', raw)
      const state = new GameState()
      let outcome: ReturnType<SaveSystem['restoreOrStart']> | undefined
      expect(() => (outcome = new SaveSystem(state).restoreOrStart())).not.toThrow()
      expect(outcome!.savedAt).toBeNull()
      expect(outcome!.problem).toMatch(/couldn't be read/)
      expect([...state.city.all()].length).toBeGreaterThan(0) // a fresh starting town
      expect(storage.getItem('hearthvale.save.unreadable')).toBe(raw) // the damaged save is kept
    }
  })

  it('refuses to import a damaged file, keeping the current town', () => {
    storage.setItem('hearthvale.save', 'current town')
    expect(importSave('{not json', SaveSystem.canLoad)).toMatch(/isn't a Hearthvale save/)
    expect(importSave(`{"version":${SAVE_VERSION}}`, SaveSystem.canLoad)).toMatch(/damaged/)
    expect(storage.getItem('hearthvale.save')).toBe('current town')
  })
})
