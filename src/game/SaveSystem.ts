import type { GameState } from './GameState'
import { citySave, readSave, type SaveData } from './save'

// Turns the whole game state into a save and back. save.ts handles storage
// (the browser's localStorage, versions and upgrades, backups, files); this
// knows which system owns which part of the save, and the order to restore
// them in.

export type SaveContents = Omit<SaveData, 'version' | 'savedAt'>

export class SaveSystem {
  private state: GameState

  constructor(state: GameState) {
    this.state = state
  }

  toSave(): SaveContents {
    const s = this.state
    const city = s.city.toSave()
    const report = s.services.report
    return {
      player: { ...s.player.toSave(), level: s.player.level },
      resources: { coins: city.coins, goods: city.goods ?? 0, debt: city.debt ?? 0 },
      population: { current: report.population, capacity: report.capacity },
      land: { parcels: city.lots },
      buildings: { nextId: city.nextId, list: city.buildings },
      quests: s.quests.toSave(),
      inventory: { items: s.inventory.toSave(), collections: s.collections.toSave() },
      shipments: s.docks.toSave(),
      taxes: s.taxes.toSave(),
      calendar: { playedMs: s.clock.playedMs },
      settings: s.settings.values,
      tutorial: s.tutorial.toSave(),
      safetyNet: { lastGrantAt: s.safetyNet.lastGrantAt },
      neighbors: s.neighbors.toSave(),
    }
  }

  // Order matters: the clock first (Taxes reads it), then the town, then the
  // tax books, which replace the records City's 'added' events created.
  load(save: SaveContents) {
    const s = this.state
    s.clock.playedMs = save.calendar.playedMs
    s.city.load(citySave(save as SaveData))
    s.taxes.load(save.taxes)
    s.player.load(save.player)
    s.docks.load(save.shipments)
    s.collections.load(save.inventory.collections)
    if (save.quests) s.quests.load(save.quests)
    s.inventory.load(save.inventory.items)
    s.settings.load(save.settings)
    s.tutorial.load(save.tutorial)
    s.safetyNet.lastGrantAt = save.safetyNet.lastGrantAt
    if (save.neighbors) s.neighbors.load(save.neighbors)
  }

  // Load the town saved in this browser, or start a new one. Returns when it
  // was saved (null for a new town) and anything the player should be told.
  restoreOrStart(): { savedAt: number | null; problem: string | null } {
    const result = readSave()
    if (result.save) {
      this.load(result.save)
      return { savedAt: result.save.savedAt, problem: null }
    }
    this.state.seedNewTown()
    return { savedAt: null, problem: result.problem }
  }

  // Call changed whenever anything that's saved changes. (Docks change only
  // through City events, so City covers them.)
  watch(changed: () => void) {
    const s = this.state
    s.city.onChange(changed)
    s.taxes.onChange(changed)
    s.player.onChange(changed)
    s.inventory.onChange(changed)
    s.quests.onChange(changed)
    s.collections.onChange(changed)
    s.neighbors.onChange(changed)
    s.tutorial.onChange(changed)
    s.settings.onChange(changed)
  }
}
