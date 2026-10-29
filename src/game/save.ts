import type { CitySave } from './City'
import type { TaxesSave } from './Taxes'

// Saving to the browser's localStorage. Everything stays on this device;
// nothing is sent anywhere. See docs/ARCHITECTURE.md, "Saving".

const STORAGE_KEY = 'hearthvale.save'
// Bump this when the save format changes, and teach readSave to upgrade old versions.
const SAVE_VERSION = 1
const AUTOSAVE_DELAY_MS = 1000

export interface SaveData {
  version: number
  savedAt: number // Date.now() when written
  city: CitySave
  clock: { playedMs: number }
  taxes: TaxesSave
}

export function readSave(): SaveData | null {
  // localStorage can be missing or blocked (private windows, strict settings),
  // and the stored text could be corrupt, so every step is guarded.
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as SaveData
    if (data.version !== SAVE_VERSION) {
      console.warn(`Save is version ${data.version}, expected ${SAVE_VERSION}; starting fresh`)
      return null
    }
    return data
  } catch (err) {
    console.warn("Couldn't read the save; starting fresh", err)
    return null
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
