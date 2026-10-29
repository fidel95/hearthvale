import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, SettingsStore } from './settings'

describe('SettingsStore', () => {
  it('fills in admin settings missing from older saves', () => {
    const store = new SettingsStore()
    store.load({ showGrid: false })
    expect(store.values.showGrid).toBe(false)
    expect(store.values.admin).toEqual(DEFAULT_SETTINGS.admin)
    store.load({ admin: { enabled: true } as never })
    expect(store.values.admin).toEqual({ ...DEFAULT_SETTINGS.admin, enabled: true })
  })
})
