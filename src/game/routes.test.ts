import { describe, expect, it } from 'vitest'
import { nextTile, pathToFarthest, Polyline, reachable, trackNeighbors, trainRoute } from './routes'

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

describe('Train routes', () => {
  // A ring of track: the edge of the square from (0,0) to (5,5).
  const ring = new Set<string>()
  for (let i = 0; i <= 5; i++) for (const t of [`${i},0`, `${i},5`, `0,${i}`, `5,${i}`]) ring.add(t)
  const onRing = (t: { x: number; z: number }) => ring.has(`${t.x},${t.z}`)
  const adjacent = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z) === 1

  it('goes all the way round a loop through the station, back to it', () => {
    const route = trainRoute({ x: 2, z: 0 }, onRing)
    expect(route.loop).toBe(true)
    expect(route.tiles[0]).toEqual({ x: 2, z: 0 })
    expect(route.tiles.at(-1)).toEqual({ x: 2, z: 0 })
    expect(new Set(route.tiles.map((t) => `${t.x},${t.z}`)).size).toBe(ring.size) // every tile of it
    for (let i = 1; i < route.tiles.length; i++) expect(adjacent(route.tiles[i - 1], route.tiles[i])).toBe(true)
  })

  it('out along a branch to a loop, round it, and back', () => {
    const lollipop = new Set([...ring, '2,6', '2,7', '2,8'])
    const route = trainRoute({ x: 2, z: 8 }, (t) => lollipop.has(`${t.x},${t.z}`))
    expect(route.loop).toBe(false)
    expect(route.tiles[0]).toEqual({ x: 2, z: 8 })
    expect(route.tiles.at(-1)).toEqual({ x: 2, z: 8 })
    expect(new Set(route.tiles.map((t) => `${t.x},${t.z}`)).size).toBe(lollipop.size)
    for (let i = 1; i < route.tiles.length; i++) expect(adjacent(route.tiles[i - 1], route.tiles[i])).toBe(true)
  })

  it('on a plain line, from end to end, stopping at a station partway', () => {
    const line = (t: { x: number; z: number }) => t.z === 0 && t.x >= 0 && t.x <= 8
    const route = trainRoute({ x: 3, z: 0 }, line)
    expect(route.loop).toBe(false)
    expect(route.tiles).toHaveLength(9)
    expect(route.tiles[route.station]).toEqual({ x: 3, z: 0 })
  })
})
