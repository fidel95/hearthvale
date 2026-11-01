import { describe, expect, it } from 'vitest'
import { BUILDING_TYPES, isDrawn, isTrack } from './buildings'
import { grassTint } from './seasons'

describe('Grass through the year', () => {
  it('is cool in winter, fresh in spring, warm in summer and golden in fall', () => {
    const [jan, apr, jul, oct] = [0.5, 3.5, 6.5, 9.5].map(grassTint)
    expect(jan[2]).toBeGreaterThan(jan[0]) // bluer than red
    expect(apr[1]).toBeGreaterThan(1) // greener
    expect(jul[0]).toBeGreaterThan(1)
    expect(oct[0]).toBeGreaterThan(jul[0]) // more golden still
    expect(oct[2]).toBeLessThan(jul[2])
  })

  it('turns smoothly, across the new year too', () => {
    for (let m = 0; m < 12; m += 0.05) {
      const a = grassTint(m)
      const b = grassTint(m + 0.05)
      for (let k = 0; k < 3; k++) expect(Math.abs(a[k] - b[k])).toBeLessThan(0.01)
    }
    expect(grassTint(11.99)[0]).toBeCloseTo(grassTint(0)[0], 2)
  })
})

describe('Drawn decorations', () => {
  it('paths, hedges and flower beds are drawn by dragging, like roads', () => {
    const drawn = BUILDING_TYPES.filter((t) => isDrawn(t) && !isTrack(t)).map((t) => t.id)
    expect(drawn.sort()).toEqual(['flower-bed', 'hedge', 'stone-path'])
    for (const t of BUILDING_TYPES.filter(isDrawn)) expect(t.size).toEqual({ x: 1, z: 1 })
  })
})
