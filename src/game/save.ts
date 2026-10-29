import type { CitySave } from './City'
import { LOT_SIZE } from './grid'
import { START_LOTS, START_LOT_VALUE } from './land'
import type { Shipment } from './Docks'
import type { Stack } from './Inventory'
import type { PlayerSave } from './Player'
import type { QuestsSave } from './quests'
import type { TaxesSave } from './Taxes'

// Saving to the browser's localStorage. Everything stays on this device;
// nothing is sent anywhere. See docs/ARCHITECTURE.md, "Saving".

const STORAGE_KEY = 'hearthvale.save'
// Bump this when the save format changes, and add a step to upgradeSave.
export const SAVE_VERSION = 2
const AUTOSAVE_DELAY_MS = 1000

export interface SaveData {
  version: number
  savedAt: number // Date.now() when written
  city: CitySave
  clock: { playedMs: number }
  taxes: TaxesSave
  player?: PlayerSave // missing in saves from before Stage 5
  shipments?: Shipment[] // missing in saves from before Stage 8
  inventory?: [string, Stack][] // missing in saves from before Stage 9
  collections?: [string, number][] // times each collection was completed
  quests?: QuestsSave
  lastGrantAt?: number | null // when the county grant was last taken (safetyNet.ts)
}

export function readSave(): SaveData | null {
  // localStorage can be missing or blocked (private windows, strict settings),
  // and the stored text could be corrupt, so every step is guarded.
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return upgradeSave(JSON.parse(raw))
  } catch (err) {
    console.warn("Couldn't read the save; starting fresh", err)
    return null
  }
}

// Bring a save from any older version up to the current one, one version at a
// time, so each step only has to know about the version right before it.
// Returns null for saves it can't understand (corrupt, or from a newer game).
export function upgradeSave(data: { version: number } & Record<string, unknown>): SaveData | null {
  if (data.version === 1) data = upgradeV1(data)
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
    version: 2,
    city: {
      ...city,
      buildings: city.buildings.map((b) => ({ ...b, tile: { x: b.tile.x + offset, z: b.tile.z + offset } })),
      lots: START_LOTS.map((lot) => ({ ...lot, price: START_LOT_VALUE })),
    },
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

  saveNow() {
    window.clearTimeout(this.timer)
    if (!this.enabled) return
    const data: SaveData = { version: SAVE_VERSION, savedAt: Date.now(), ...this.collect() }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (err) {
      console.warn("Couldn't save the game", err)
    }
  }

  // Used when starting a new town, so the old town isn't saved again on the way out.
  disable() {
    this.enabled = false
    window.clearTimeout(this.timer)
  }
}
