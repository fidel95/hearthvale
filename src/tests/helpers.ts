import { BUILDINGS_BY_ID } from '../game/buildings'
import { GameState } from '../game/GameState'
import { SaveSystem } from '../game/SaveSystem'

// Shared helpers for the test-plan suites (docs/TESTING.md).

// Tiles relative to the starting land, which begins at tile 20 on both axes.
export const at = (x: number, z: number) => ({ x: 20 + x, z: 20 + z })
export const b = (id: string) => BUILDINGS_BY_ID.get(id)!

// Everything the game would save, for "nothing changed" comparisons.
export const snapshot = (state: GameState) => structuredClone(new SaveSystem(state).toSave())

// Save a game and load it into a brand-new one, through JSON like the real save.
export function reload(state: GameState): GameState {
  const fresh = new GameState()
  new SaveSystem(fresh).load(JSON.parse(JSON.stringify(new SaveSystem(state).toSave())))
  return fresh
}

// A game whose player has every level's content and plenty of coins.
export function richGame(): GameState {
  const state = new GameState()
  state.player.grantXp(100_000)
  state.city.economy.adjust(100_000)
  return state
}
