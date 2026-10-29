import { describe, expect, it } from 'vitest'
import { findPath } from './pathfinding'

// Build a passable() from a little ASCII map: '#' is blocked.
function grid(rows: string[]) {
  return (t: { x: number; z: number }) => rows[t.z]?.[t.x] !== undefined && rows[t.z][t.x] !== '#'
}

describe('findPath', () => {
  it('walks straight when nothing is in the way', () => {
    const path = findPath({ x: 0, z: 0 }, { x: 3, z: 0 }, grid(['....']))!
    expect(path).toEqual([{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 2, z: 0 }, { x: 3, z: 0 }])
  })

  it('goes around obstacles by a shortest route', () => {
    const map = grid([
      '.#..',
      '.#.#',
      '....',
    ])
    const path = findPath({ x: 0, z: 0 }, { x: 2, z: 0 }, map)!
    expect(path).toHaveLength(7) // down 2, right 2, up 2, plus the start
    for (const t of path) expect(map(t)).toBe(true)
    // Every step moves exactly one tile.
    for (let i = 1; i < path.length; i++) {
      expect(Math.abs(path[i].x - path[i - 1].x) + Math.abs(path[i].z - path[i - 1].z)).toBe(1)
    }
  })

  it('takes a longer but cheaper route when steps cost different amounts', () => {
    // 'r' is road (cost 1), '.' is grass (cost 4). Straight across is 2 grass
    // steps (8); dropping to the road and back is 3 road steps + 1 grass (7).
    const rows = ['...', 'rrr']
    const map = grid(['...', '...'])
    const cost = (t: { x: number; z: number }) => (rows[t.z][t.x] === 'r' ? 1 : 4)
    const path = findPath({ x: 0, z: 0 }, { x: 2, z: 0 }, map, { cost })!
    expect(path.map((t) => rows[t.z][t.x]).join('')).toBe('.rrr.')
  })

  it('returns null when the goal is walled off or blocked', () => {
    expect(findPath({ x: 0, z: 0 }, { x: 2, z: 0 }, grid(['.#.']))).toBeNull()
    expect(findPath({ x: 0, z: 0 }, { x: 1, z: 0 }, grid(['.#.']))).toBeNull()
  })
})
