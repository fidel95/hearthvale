import { describe, expect, it } from 'vitest'
import { BUILDINGS_BY_ID } from './buildings'
import { City } from './City'
import { AMBER_SECONDS, GREEN_SECONDS, lightFor, signalJunctions } from './signals'

describe('traffic lights', () => {
  it('never show green both ways, and give each way its turn', () => {
    const seen = { x: new Set<string>(), z: new Set<string>() }
    for (let t = 0; t < 60; t += 0.25) {
      const x = lightFor('x', t)
      const z = lightFor('z', t)
      expect(x === 'red' || z === 'red').toBe(true)
      seen.x.add(x)
      seen.z.add(z)
    }
    expect([...seen.x].sort()).toEqual(['amber', 'green', 'red'])
    expect([...seen.z].sort()).toEqual(['amber', 'green', 'red'])
    expect(lightFor('x', 0)).toBe('green')
    expect(lightFor('x', GREEN_SECONDS + AMBER_SECONDS / 2)).toBe('amber')
    expect(lightFor('z', GREEN_SECONDS + AMBER_SECONDS + 1)).toBe('green')
  })

  it('stand at junctions of three or four paved roads', () => {
    const city = new City()
    const road = BUILDINGS_BY_ID.get('road')!
    // A T: a road along x with one branching off it.
    for (let x = 20; x < 25; x++) city.place(road, { x, z: 22 }, { free: true })
    city.place(road, { x: 22, z: 23 }, { free: true })
    expect(signalJunctions(city)).toEqual([{ x: 22, z: 22 }])
  })
})
