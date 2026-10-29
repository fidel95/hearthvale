import { describe, expect, it } from 'vitest'
import { BUILDING_TYPES } from '../game/buildings'

// Test plan: offline. These check the source and the packaged assets; the
// in-browser check with the network cut off is in docs/TESTING.md.

const source = import.meta.glob(['/src/**/*.ts', '/src/**/*.css', '!/src/**/*.test.ts', '!/src/tests/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>
const html = import.meta.glob('/index.html', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const publicFiles = Object.keys(import.meta.glob('/public/**/*'))
const models = import.meta.glob('/public/models/**/*.glb', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

describe('Offline', () => {
  it('has the game source to check', () => {
    expect(Object.keys(source).length).toBeGreaterThan(40)
  })

  it('never calls a remote API: no network requests in the game code', () => {
    for (const [file, text] of Object.entries(source)) {
      expect(text, file).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon/)
    }
  })

  it('loads nothing from another site: no remote URLs in the code, styles or page', () => {
    for (const [file, text] of Object.entries({ ...source, ...html })) {
      expect(text, file).not.toMatch(/(https?:)?\/\/[a-z0-9-]+\.[a-z]{2,}/i)
    }
  })

  it('packages every model and texture locally', () => {
    for (const t of BUILDING_TYPES) {
      if (!t.model) continue
      expect(t.model).not.toMatch(/:\/\//)
      expect(publicFiles, t.id).toContain('/public/' + t.model.replace(/^\//, ''))
    }
    // Each model's textures are files beside it, not links elsewhere.
    let textures = 0
    for (const [file, bytes] of Object.entries(models)) {
      const folder = file.slice(0, file.lastIndexOf('/') + 1)
      for (const [, uri] of bytes.matchAll(/"uri":"([^"]+)"/g)) {
        expect(uri, file).not.toMatch(/:\/\//)
        expect(publicFiles, `${file} → ${uri}`).toContain(folder + uri)
        textures++
      }
    }
    expect(textures).toBeGreaterThan(0)
  })
})
