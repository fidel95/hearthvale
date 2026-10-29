import { Emitter } from './events'

// Player preferences, saved with the town. Each one is applied by whatever
// it affects (Game wires them up), so adding a setting means adding a field
// here, a row in the Settings sheet, and one line where it applies.

export interface Settings {
  showGrid: boolean // tile grid lines on your land
  showPeople: boolean // residents walking around town
  showTraffic: boolean // cars, buses, trains and the army on the move
  confirmPurchases: boolean // the ✓ step before buying a building
  reduceMotion: boolean // no bobbing bubbles, floating pop-ups or waves
  music: boolean // gentle background music
  weather: boolean // rain showers now and then
  snowMode: boolean // winter: snow on the ground, and showers fall as snow
  disasters: boolean // tornados, lightning, floods and tsunamis now and then
  soundVolume: number // 0 (muted) to 1
  admin: AdminSettings
}

// Admin tools (cheats), off unless turned on in Settings.
export interface AdminSettings {
  enabled: boolean // show the 🛠️ button
  freeBuild: boolean // build anything for free, instantly, at any level
  infiniteEnergy: boolean
  instantTimers: boolean // everything is ready the moment it starts
  calendarSpeed: number // 1, 10 or 60 times as fast
}

// The settings that are on/off switches, for the checkbox rows.
export type SwitchSetting = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings]

export const DEFAULT_SETTINGS: Settings = {
  showGrid: true,
  showPeople: true,
  showTraffic: true,
  confirmPurchases: true,
  reduceMotion: false,
  music: false,
  weather: true,
  snowMode: false,
  disasters: true,
  soundVolume: 0.6,
  admin: { enabled: false, freeBuild: false, infiniteEnergy: false, instantTimers: false, calendarSpeed: 1 },
}

export const SETTING_LABELS: Record<SwitchSetting, string> = {
  showGrid: 'Show the tile grid',
  showPeople: 'Show residents walking around',
  showTraffic: 'Show cars, buses, trains, planes and soldiers',
  confirmPurchases: 'Confirm (✓) before buying a building',
  reduceMotion: 'Reduce motion',
  music: 'Background music',
  weather: 'Rain showers',
  snowMode: '❄️ Snow mode (winter)',
  disasters: 'Natural disasters (they damage, never destroy)',
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
    this.values = { ...DEFAULT_SETTINGS, ...saved, admin: { ...DEFAULT_SETTINGS.admin, ...saved.admin } }
    this.events.emit(this.values)
  }
}
