import type { CitySave } from './City'
import { STARTING_MATERIALS } from './construction'
import type { Shipment } from './Docks'
import { LOT_SIZE } from './grid'
import type { Stack } from './Inventory'
import { MATERIAL_IDS } from './items'
import { START_LOTS, START_LOT_VALUE } from './land'
import type { NeighborsSave } from './Neighbors'
import type { PlayerSave } from './Player'
import { levelForXp, maxEnergy } from './progression'
import type { QuestsSave } from './quests'
import type { Settings } from './settings'
import type { TaxesSave } from './Taxes'
import type { ArmySave } from './Army'
import type { TownEventsSave } from './TownEvents'
import type { ProductId } from './products'
import type { FinancesSave } from './Finances'
import { TUTORIAL, type TutorialSave } from './tutorial'

// Saving to the browser's localStorage. Everything stays on this device;
// nothing is sent anywhere. See docs/DATA_MODEL.md for every field.

const STORAGE_KEY = 'hearthvale.save'
// Bump this when the save format changes, and add a step to upgradeSave.
export const SAVE_VERSION = 3
const AUTOSAVE_DELAY_MS = 1000

// The save file, grouped by what it describes. Building *definitions* are
// never saved (they're in buildings.ts); only each placed building's state
// is, pointing at its definition by id.
export interface SaveData {
  version: number
  savedAt: number // Date.now() when written
  player: PlayerSave & { level: number } // level is worked out from XP; saved for readability
  resources: { coins: number; goods: number; debt?: number; products?: Partial<Record<ProductId, number>> }
  // Worked out from the buildings on load; saved so the file reads on its own.
  population: { current: number; capacity: number }
  land: { parcels: CitySave['lots'] }
  buildings: { nextId: number; list: CitySave['buildings'] } // placed and stored
  quests: QuestsSave | null // completed quests, active quest progress, achievements
  inventory: { items: [string, Stack][]; collections: [string, number][] } // materials, collectibles, sets completed
  shipments: Shipment[]
  taxes: TaxesSave
  calendar: { playedMs: number }
  settings: Partial<Settings>
  tutorial: TutorialSave
  safetyNet: { lastGrantAt: number | null }
  neighbors?: NeighborsSave // friendship and today's helps, gifts and requests (added in Stage 11)
  army?: ArmySave // when the last parade was (added with parades)
  events?: TownEventsSave // this season's festival and this week's challenges (added with events)
  finances?: FinancesSave // the financial report's months and top earners (added with the report)
}

// The City's part of the save, pieced back together from the file's sections.
export function citySave(save: SaveData): CitySave {
  return {
    coins: save.resources.coins,
    goods: save.resources.goods,
    debt: save.resources.debt,
    products: save.resources.products,
    nextId: save.buildings.nextId,
    buildings: save.buildings.list,
    lots: save.land.parcels,
  }
}

const BACKUP_KEY = 'hearthvale.save.unreadable'

// What reading the save found: a town, nothing (a new game), or a save that
// couldn't be read, kept aside as a backup instead of being thrown away.
export type ReadResult = { save: SaveData } | { save: null; problem: string | null }

// canLoad: a last check that the game can actually load it (SaveSystem.canLoad),
// so a save with the right version but missing parts is set aside, not a crash.
export function readSave(canLoad: (save: SaveData) => boolean = () => true): ReadResult {
  let raw: string | null = null
  try {
    // localStorage can be missing or blocked (private windows, strict settings).
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    return { save: null, problem: "This browser isn't allowing the game to save (private browsing or strict settings), so progress won't be kept." }
  }
  if (!raw) return { save: null, problem: null }
  let save: SaveData | null = null
  try {
    save = upgradeSave(JSON.parse(raw))
  } catch {
    // Not valid JSON: handled below.
  }
  if (save && canLoad(save)) return { save }
  // Corrupt, or from a newer version of the game: keep it, so nothing is lost for good.
  try {
    localStorage.setItem(BACKUP_KEY, raw)
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nowhere to keep it; the problem message still explains.
  }
  return { save: null, problem: "Your saved town couldn't be read, so a new town was started. The unreadable save was kept: you can download it from Settings." }
}

// The unreadable save kept by readSave, if there is one.
export function unreadableBackup(): string | null {
  try {
    return localStorage.getItem(BACKUP_KEY)
  } catch {
    return null
  }
}

// Check a save file someone is importing, and store it as the current save.
// Returns an error message, or null on success.
export function importSave(text: string, canLoad: (save: SaveData) => boolean = () => true): string | null {
  let save: SaveData | null = null
  try {
    save = upgradeSave(JSON.parse(text))
  } catch {
    return "That file isn't a Hearthvale save."
  }
  if (!save || !canLoad(save)) return 'That save is from a newer version of the game, or is damaged.'
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save))
  } catch {
    return "The browser wouldn't store the save."
  }
  return null
}

// Offer text as a file to download (export a save, keep a backup).
export function downloadText(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

// Bring a save from any older version up to the current one, one version at a
// time, so each step only has to know about the version right before it.
// Returns null for saves it can't understand (corrupt, or from a newer game).
export function upgradeSave(data: { version: number } & Record<string, unknown>): SaveData | null {
  if (data.version === 1) data = upgradeV1(data)
  if (data.version === 2) data = upgradeV2(data)
  if (data.version !== SAVE_VERSION) {
    console.warn(`Save is version ${data.version}, expected ${SAVE_VERSION}; starting fresh`)
    return null
  }
  return data as unknown as SaveData
}

// Version 1 (Stages 0–5) had a fixed 20×20 map. Version 2's world is 60×60
// with the starting land in the middle, so every building moves 20 tiles
// along each axis to land on the same spot of the same land, and the town
// owns the starting lots.
function upgradeV1(data: Record<string, unknown>): { version: number } & Record<string, unknown> {
  const offset = START_LOTS[0].x * LOT_SIZE // the lowest starting lot's first tile: 20
  const city = data.city as Omit<CitySave, 'lots'>
  return {
    ...data,
    version: 2, // then upgradeV2 takes it to 3
    city: {
      ...city,
      buildings: city.buildings.map((b) => ({ ...b, tile: { x: b.tile.x + offset, z: b.tile.z + offset } })),
      lots: START_LOTS.map((lot) => ({ ...lot, price: START_LOT_VALUE })),
    },
  }
}

// Version 2 (Stages 5.5–9.5) kept most things inside a "city" object and the
// rest at the top level. Version 3 groups the file into sections, and adds
// settings and tutorial progress. Players with a version 2 town have played
// already, so they skip the tutorial.
function upgradeV2(d: Record<string, unknown>): { version: number } & Record<string, unknown> {
  const city = d.city as CitySave
  const player = (d.player as PlayerSave | undefined) ?? { xp: 0, energy: maxEnergy(1), energyAt: 0 }
  // Towns from before Stage 9 had no inventory: they get the new-town materials.
  const items =
    (d.inventory as [string, Stack][] | undefined) ??
    MATERIAL_IDS.filter((id) => STARTING_MATERIALS[id]).map((id): [string, Stack] => [id, { count: STARTING_MATERIALS[id]!, cost: 0 }])
  return {
    version: 3,
    savedAt: d.savedAt,
    player: { ...player, level: levelForXp(player.xp) },
    resources: { coins: city.coins, goods: city.goods ?? 40 },
    population: { current: 0, capacity: 0 },
    land: { parcels: city.lots },
    buildings: { nextId: city.nextId, list: city.buildings },
    quests: d.quests ?? null,
    inventory: { items, collections: (d.collections as [string, number][] | undefined) ?? [] },
    shipments: d.shipments ?? [],
    taxes: d.taxes,
    calendar: d.clock,
    settings: {},
    tutorial: { step: TUTORIAL.length, skipped: false },
    safetyNet: { lastGrantAt: (d.lastGrantAt as number | null | undefined) ?? null },
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // nothing to clear
  }
}

// Saves a moment after things change (so a burst of changes is one write),
// and immediately when the page is hidden or closed.
export class AutoSaver {
  private collect: () => Omit<SaveData, 'version' | 'savedAt'>
  private timer: number | undefined
  private enabled = true

  constructor(collect: () => Omit<SaveData, 'version' | 'savedAt'>) {
    this.collect = collect
    // 'pagehide' fires on close and on mobile app-switching more reliably than 'beforeunload'.
    window.addEventListener('pagehide', () => this.saveNow())
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.saveNow()
    })
  }

  requestSave() {
    window.clearTimeout(this.timer)
    this.timer = window.setTimeout(() => this.saveNow(), AUTOSAVE_DELAY_MS)
  }

  // Returns false if the browser wouldn't store it.
  saveNow(): boolean {
    window.clearTimeout(this.timer)
    if (!this.enabled) return false
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.snapshot()))
      return true
    } catch (err) {
      console.warn("Couldn't save the game", err)
      return false
    }
  }

  // The save as it would be written now (also used to export it).
  snapshot(): SaveData {
    return { version: SAVE_VERSION, savedAt: Date.now(), ...this.collect() }
  }

  // Used when starting a new town, so the old town isn't saved again on the way out.
  disable() {
    this.enabled = false
    window.clearTimeout(this.timer)
  }
}
