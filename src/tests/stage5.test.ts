import { describe, expect, it } from 'vitest'
import { GameState } from '../game/GameState'
import { SAVE_VERSION, type SaveData } from '../game/save'
import { SaveSystem } from '../game/SaveSystem'
import { TIPS } from '../game/tips'
import { PRODUCT_IDS } from '../game/products'
import { at, b, richGame } from './helpers'

// Stage 5: older saves keep working, and tips show one at a time.

// A save as an older version of the game wrote it: the same version number
// (the newer sections are optional), but without the sections added since.
function olderSave(state: GameState, drop: (keyof SaveData)[]): SaveData {
  const save = { version: SAVE_VERSION, savedAt: Date.now(), ...new SaveSystem(state).toSave() } as SaveData
  const old = JSON.parse(JSON.stringify(save))
  for (const key of drop) delete old[key]
  delete old.resources.products
  return old
}

describe('Older saves', () => {
  const added: [string, (keyof SaveData)[]][] = [
    ['before the Farmers\' Market', ['market']],
    ['before tips', ['market', 'tips']],
    ['before the financial report', ['market', 'tips', 'finances']],
    ['before events and factories', ['market', 'tips', 'finances', 'events']],
    ['before neighbors and parades', ['market', 'tips', 'finances', 'events', 'neighbors', 'army']],
  ]
  for (const [when, drop] of added) {
    it(`load and keep playing: a save from ${when}`, () => {
      const state = richGame()
      const save = olderSave(state, drop)
      expect(SaveSystem.canLoad(save)).toBe(true)
      const loaded = new GameState()
      new SaveSystem(loaded).load(save)
      // The town is all there…
      expect([...loaded.city.all()].length).toBe([...state.city.all()].length)
      expect(loaded.city.coins).toBe(state.city.coins)
      expect(loaded.city.products).toEqual(Object.fromEntries(PRODUCT_IDS.map((id) => [id, 0])))
      // …and new features work from here on.
      const prizes = () => loaded.finances.totals(loaded.clock.year).income.prizes
      const before = prizes()
      loaded.city.economy.award(10, 'test')
      expect(prizes()).toBe(before + 10)
      loaded.townEvents.refresh()
      const home = loaded.city.place(b('cottage'), at(12, 12), { free: true })
      expect(home).not.toBeNull()
      // Saving again writes every section, and that loads back the same.
      const again = new SaveSystem(loaded).toSave()
      for (const key of drop) expect(again).toHaveProperty(key)
      const third = new GameState()
      new SaveSystem(third).load(again)
      expect(new SaveSystem(third).toSave()).toEqual(again)
    })
  }
})

describe('Tips', () => {
  it('wait for the tutorial, then show one at a time, each once', () => {
    const state = new GameState()
    state.player.grantXp(400) // level 3: events
    expect(state.tips.current()).toBeNull() // still in the tutorial
    state.tutorial.skip()
    const first = state.tips.current()!
    expect(first).not.toBeNull()
    state.tips.dismiss(first.id)
    expect(state.tips.current()?.id).not.toBe(first.id)
  })

  it('can be turned off, and remember what was read', () => {
    const state = new GameState()
    state.player.grantXp(400)
    state.tutorial.skip()
    const first = state.tips.current()!
    state.tips.dismiss(first.id)
    const loaded = new GameState()
    new SaveSystem(loaded).load(new SaveSystem(state).toSave())
    expect(loaded.tips.toSave()).toEqual([first.id])
    loaded.settings.set('tips', false)
    expect(loaded.tips.current()).toBeNull()
  })

  it('every tip has its own id', () => {
    expect(new Set(TIPS.map((t) => t.id)).size).toBe(TIPS.length)
  })
})
