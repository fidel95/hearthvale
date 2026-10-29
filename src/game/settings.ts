import { Emitter } from './events'

// Player preferences, saved with the town. Each one is applied by whatever
// it affects (Game wires them up), so adding a setting means adding a field
// here, a row in the Settings sheet, and one line where it applies.

export interface Settings {
  showGrid: boolean // tile grid lines on your land
  showPeople: boolean // residents walking around town
  confirmPurchases: boolean // the ✓ step before buying a building
  reduceMotion: boolean // no bobbing bubbles, floating pop-ups or waves
  music: boolean // gentle background music
  soundVolume: number // 0 (muted) to 1
}

// The settings that are on/off switches, for the checkbox rows.
export type SwitchSetting = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings]

export const DEFAULT_SETTINGS: Settings = {
  showGrid: true,
  showPeople: true,
  confirmPurchases: true,
  reduceMotion: false,
  music: false,
  soundVolume: 0.6,
}

export const SETTING_LABELS: Record<SwitchSetting, string> = {
  showGrid: 'Show the tile grid',
  showPeople: 'Show residents walking around',
  confirmPurchases: 'Confirm (✓) before buying a building',
  reduceMotion: 'Reduce motion',
  music: 'Background music',
}

export class SettingsStore {
  values: Settings = { ...DEFAULT_SETTINGS }
  private events = new Emitter<Settings>()

  onChange(listener: (settings: Settings) => void) {
    this.events.on(listener)
    listener(this.values)
  }

  set<K extends keyof Settings>(key: K, value: Settings[K]) {
    this.values[key] = value
    this.events.emit(this.values)
  }

  load(saved: Partial<Settings>) {
    // Unknown or missing keys fall back to the defaults, so old saves and new settings both work.
    this.values = { ...DEFAULT_SETTINGS, ...saved }
    this.events.emit(this.values)
  }
}
