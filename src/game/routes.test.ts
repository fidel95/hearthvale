import { describe, expect, it } from 'vitest'
import { nextTile, pathToFarthest, Polyline, reachable, trackNeighbors } from './routes'

// A small network: a line along z = 5 from x = 0 to 6, with a branch up from x = 3.
const tiles = new Set(['0,5', '1,5', '2,5', '3,5', '4,5', '5,5', '6,5', '3,4', '3,3'])
const isTrack = (t: { x: number; z: number }) => tiles.has(`${t.x},${t.z}`)

describe('routes', () => {
  it('finds connected neighbors', () => {
    expect(trackNeighbors({ x: 3, z: 5 }, isTrack)).toHaveLength(3)
    expect(trackNeighbors({ x: 0, z: 5 }, isTrack)).toEqual([{ x: 1, z: 5 }])
  })

  it('keeps going rather than turning back, except at a dead end', () => {
    expect(nextTile({ x: 1, z: 5 }, { x: 2, z: 5 }, isTrack)).toEqual({ x: 3, z: 5 })
    expect(nextTile({ x: 1, z: 5 }, { x: 0, z: 5 }, isTrack)).toEqual({ x: 1, z: 5 })
    // At the junction it picks one of the ways onward, never back.
    for (const r of [0, 0.5, 0.99]) expect(nextTile({ x: 2, z: 5 }, { x: 3, z: 5 }, isTrack, () => r)).not.toEqual({ x: 2, z: 5 })
  })

  it('finds every connected tile, and the way to the far end', () => {
    expect(reachable({ x: 0, z: 5 }, isTrack).size).toBe(9)
    const path = pathToFarthest({ x: 0, z: 5 }, isTrack)
    expect(path[0]).toEqual({ x: 0, z: 5 })
    expect(path.at(-1)).toEqual({ x: 6, z: 5 })
    expect(path).toHaveLength(7)
  })

  it('moves along a path, keeping to the right', () => {
    const line = new Polyline([
      { x: 0, z: 0 },
      { x: 2, z: 0 },
      { x: 2, z: 2 },
    ])
    expect(line.length).toBe(4)
    expect(line.at(1)).toMatchObject({ x: 1, z: 0 })
    expect(line.at(3)).toMatchObject({ x: 2, z: 1 })
    // Heading +x, the right-hand side is +z.
    expect(line.at(1, 0.2)).toMatchObject({ x: 1, z: 0.2 })
    expect(line.at(99)).toMatchObject({ x: 2, z: 2 })
  })
})
