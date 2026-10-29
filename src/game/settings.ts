// Player preferences, saved with the town. Each one is applied by whatever
// it affects (Game wires them up), so adding a setting means adding a field
// here, a row in the Settings sheet, and one line where it applies.

export interface Settings {
  showGrid: boolean // tile grid lines on your land
  showPeople: boolean // residents walking around town
  confirmPurchases: boolean // the ✓ step before buying a building
  reduceMotion: boolean // no bobbing bubbles, floating pop-ups or waves
}

export const DEFAULT_SETTINGS: Settings = {
  showGrid: true,
  showPeople: true,
  confirmPurchases: true,
  reduceMotion: false,
}

export const SETTING_LABELS: Record<keyof Settings, string> = {
  showGrid: 'Show the tile grid',
  showPeople: 'Show residents walking around',
  confirmPurchases: 'Confirm (✓) before buying a building',
  reduceMotion: 'Reduce motion',
}

export class SettingsStore {
  values: Settings = { ...DEFAULT_SETTINGS }
  private listeners: ((settings: Settings) => void)[] = []

  onChange(listener: (settings: Settings) => void) {
    this.listeners.push(listener)
    listener(this.values)
  }

  set<K extends keyof Settings>(key: K, value: Settings[K]) {
    this.values[key] = value
    for (const listener of this.listeners) listener(this.values)
  }

  load(saved: Partial<Settings>) {
    // Unknown or missing keys fall back to the defaults, so old saves and new settings both work.
    this.values = { ...DEFAULT_SETTINGS, ...saved }
    for (const listener of this.listeners) listener(this.values)
  }
}
