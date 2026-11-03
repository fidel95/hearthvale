import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { MountainView } from '../game/MountainView'
import { b, richGame } from './helpers'

// What MountainView keeps about each peak's grassy foothills, for a look inside.
type Foothill = { x: number; z: number; r: number; h: number; start: number; count: number; levelled: boolean }
type Inside = { peaks: { foothills: Foothill[]; mesh: THREE.Mesh }[]; refresh: () => void }

function heightsOf(view: Inside, f: Foothill, peak = 0): number[] {
  const position = view.peaks[peak].mesh.geometry.attributes.position
  return Array.from({ length: f.count }, (_, i) => position.getY(f.start + i))
}

describe('mountain foothills', () => {
  it('give way to a building standing on them, and come back when it goes', () => {
    const state = richGame()
    // The Highlands' lots, so there's land to build on at the foot of the peaks.
    for (let pass = 0; pass < 8; pass++) for (let x = 3; x < 8; x++) for (let z = 0; z < 8; z++) state.city.buyLot({ x, z })
    const view = new MountainView(new THREE.Scene(), state.city) as unknown as Inside
    // A buildable tile the foot of a foothill spreads over (its middle is up
    // in the rock; only its skirt reaches ground you can build on).
    const under = (f: Foothill) => {
      for (let dx = -3; dx <= 3; dx++) {
        for (let dz = -3; dz <= 3; dz++) {
          const tile = { x: Math.floor(f.x) + dx, z: Math.floor(f.z) + dz }
          const near = Math.hypot(tile.x + 0.5 - f.x, tile.z + 0.5 - f.z) < f.r * (1 - 0.08 / f.h) - 0.5
          if (near && state.city.canPlace(b('road'), tile)) return tile
        }
      }
      return undefined
    }
    const hill = view.peaks.flatMap((p) => p.foothills).find((f) => under(f))!
    expect(hill, 'a foothill with buildable ground under its skirt').toBeDefined()
    const peak = view.peaks.findIndex((p) => p.foothills.includes(hill))
    expect(hill.levelled).toBe(false)
    expect(Math.max(...heightsOf(view, hill, peak))).toBeGreaterThan(0.3) // standing, its top well above the ground

    const road = state.city.place(b('road'), under(hill)!, { free: true })!
    view.refresh()
    expect(hill.levelled).toBe(true)
    expect(Math.max(...heightsOf(view, hill, peak))).toBeLessThan(0) // gone below the ground

    state.city.remove(road.id)
    view.refresh()
    expect(hill.levelled).toBe(false)
    expect(Math.max(...heightsOf(view, hill, peak))).toBeGreaterThan(0.3)
  })

  it('leave foothills alone where nothing stands near them', () => {
    const state = richGame()
    const view = new MountainView(new THREE.Scene(), state.city) as unknown as Inside
    state.city.place(b('road'), { x: 25, z: 25 }, { free: true }) // far from the Highlands
    view.refresh()
    for (const peak of view.peaks) for (const f of peak.foothills) expect(f.levelled).toBe(false)
  })
})
