import { describe, expect, it } from 'vitest'
import { BUILDINGS_BY_ID } from './buildings'
import { GameState } from './GameState'
import { SaveSystem } from './SaveSystem'

describe('SaveSystem', () => {
  it('restores a whole town exactly', () => {
    const before = new GameState()
    before.seedNewTown(1_000_000)
    before.player.grantXp(250)
    before.city.economy.bill(before.city.coins + 400) // leaves some debt (after level rewards, which would pay it)
    before.city.place(BUILDINGS_BY_ID.get('oak-tree')!, { x: 22, z: 22 }, { free: true })
    before.tutorial.complete('camera')
    before.safetyNet.lastGrantAt = 42
    const saved = new SaveSystem(before).toSave()

    const after = new GameState()
    const saves = new SaveSystem(after)
    saves.load(JSON.parse(JSON.stringify(saved)))
    expect(saves.toSave()).toEqual(saved)
    expect(after.city.debt).toBeGreaterThan(0)
    expect(after.player.level).toBe(before.player.level)
  })

  it('reports changes to everything that is saved', () => {
    const state = new GameState()
    let changes = 0
    new SaveSystem(state).watch(() => changes++)
    changes = 0
    state.city.economy.adjust(10)
    state.inventory.add('lumber', 1)
    state.settings.set('music', true)
    expect(changes).toBeGreaterThanOrEqual(3)
  })
})
