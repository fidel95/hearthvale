import type * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { BUILDINGS_BY_ID, BUILDING_TYPES } from '../game/buildings'
import { Kit } from '../game/kit'
import { KIT_MODELS } from '../game/kitModels'
import { CROP_TYPES } from '../game/crops'
import { MATERIALS } from '../game/items'
import { ACHIEVEMENTS, QUESTS } from '../game/quests'

// Checks on the data files themselves, so a typo in a catalog or in
// quests.json fails a test instead of quietly breaking a quest or a model.

const STATS = ['rent', 'sales', 'earned', 'harvests', 'plantings', 'built', 'restocks', 'finished', 'upgrades', 'lots', 'unloads', 'sets', 'returns', 'helps', 'made']
const CATEGORIES = new Set(BUILDING_TYPES.map((b) => b.category))

describe('quests.json', () => {
  it('has unique ids, and every "after" points at a real quest without going round in circles', () => {
    const ids = new Set(QUESTS.map((q) => q.id))
    expect(ids.size).toBe(QUESTS.length)
    for (const q of QUESTS) {
      if (q.after) expect(ids.has(q.after), `${q.id} after ${q.after}`).toBe(true)
      // Follow the chain back: it must end, not loop.
      let at: string | undefined = q.id
      for (let steps = 0; at; steps++) {
        expect(steps, `${q.id} loops`).toBeLessThan(QUESTS.length)
        at = QUESTS.find((p) => p.id === at)!.after
      }
    }
  })

  it('only names stats, buildings, categories and materials that exist', () => {
    for (const q of QUESTS) {
      for (const t of q.tasks) {
        expect(t.stat || t.have, `${q.id}: ${t.label}`).toBeTruthy()
        if (t.stat) expect(STATS, `${q.id}: ${t.stat}`).toContain(t.stat)
        if (t.have && 'building' in t.have) expect(BUILDINGS_BY_ID.has(t.have.building), t.have.building).toBe(true)
        if (t.have && 'category' in t.have) expect(CATEGORIES.has(t.have.category as never), t.have.category).toBe(true)
        expect(t.count).toBeGreaterThan(0)
      }
      for (const id of Object.keys(q.reward.materials ?? {})) expect(MATERIALS, `${q.id}: ${id}`).toHaveProperty(id)
    }
  })

  it('never asks for a building before the quest’s level unlocks it', () => {
    for (const q of QUESTS) {
      for (const t of q.tasks) {
        if (t.have && 'building' in t.have) expect(BUILDINGS_BY_ID.get(t.have.building)!.unlockLevel, q.id).toBeLessThanOrEqual(q.level ?? 1)
      }
    }
  })

  it('has achievements with rising tiers', () => {
    for (const a of ACHIEVEMENTS) {
      expect(STATS).toContain(a.stat)
      expect(a.tiers[0]).toBeLessThan(a.tiers[1])
      expect(a.tiers[1]).toBeLessThan(a.tiers[2])
    }
  })
})

describe('catalogs', () => {
  it('have unique ids', () => {
    expect(new Set(BUILDING_TYPES.map((b) => b.id)).size).toBe(BUILDING_TYPES.length)
    expect(new Set(CROP_TYPES.map((c) => c.id)).size).toBe(CROP_TYPES.length)
  })

  it('point at model files that exist', () => {
    // Vite lists the files in public/ that match; a model URL is /models/... under it.
    const files = new Set(Object.keys(import.meta.glob('/public/models/**/*.glb')))
    for (const b of BUILDING_TYPES) {
      if (b.model?.startsWith('kit:')) expect(KIT_MODELS[b.model.slice(4)], b.model).toBeTypeOf('function')
      else if (b.model) expect(files.has(`/public${b.model}`), b.model).toBe(true)
    }
  })

  it('build every code-made model (kitModels.ts) inside its footprint', () => {
    for (const b of BUILDING_TYPES) {
      if (!b.model?.startsWith('kit:')) continue
      const kit = new Kit()
      KIT_MODELS[b.model.slice(4)](kit)
      const model = kit.build()
      // Every part merged: one mesh per finish, with real geometry.
      expect(model.children.length, b.id).toBeGreaterThan(0)
      for (const mesh of model.children as THREE.Mesh[]) {
        const box = mesh.geometry.boundingBox!
        expect(Number.isFinite(box.min.x + box.max.y), b.id).toBe(true)
        // Nothing sticks out more than a little past the building's tiles
        // (the Ski Resort's mountain, SKI_SLOPE, reaches 0.2 past its edge).
        expect(Math.max(-box.min.x, box.max.x), b.id).toBeLessThan(b.size.x / 2 + 0.22)
        expect(Math.max(-box.min.z, box.max.z), b.id).toBeLessThan(b.size.z / 2 + 0.22)
      }
    }
  })

  it('only use materials that exist', () => {
    for (const b of BUILDING_TYPES) for (const id of Object.keys(b.build?.materials ?? {})) expect(MATERIALS, `${b.id}: ${id}`).toHaveProperty(id)
  })
})
