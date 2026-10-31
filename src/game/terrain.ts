import type { Tile } from './grid'

// The shape of the world: where the land ends and the sea begins.
// The coast runs along the south of the world (high z), wavy rather than
// straight, between about tile 43 and 49. The starting land (tiles 20–39) is
// all dry; the first lots south of it reach the shore.

// The first water tile in each column x. Two sine waves of different lengths
// make a natural-looking, repeatable coastline; no randomness, so every
// player's world (and every test) has the same coast.
export function coastZ(x: number): number {
  return Math.round(46 + 2 * Math.sin(x / 5) + Math.sin(x / 2.3 + 1))
}

export function isWater(tile: Tile): boolean {
  return tile.z >= coastZ(tile.x)
}

// ---- The Highlands

// The world's east strip (tiles 60–79) is mountain country: peaks you can't
// build on, with valleys and foothills between them that you can. Each peak
// covers the tiles within its radius of its middle. Fixed, like the coast, so
// every world is the same.
export const HIGHLANDS_X = 60

export interface Peak {
  x: number // the middle, in tiles (it can fall between tiles)
  z: number
  radius: number
  height: number
}

export const PEAKS: Peak[] = [
  { x: 65, z: 5, radius: 3.5, height: 7.5 },
  { x: 75, z: 8, radius: 4.5, height: 10 },
  { x: 66.5, z: 17, radius: 3, height: 6 },
  { x: 76, z: 21.5, radius: 4, height: 9 },
  { x: 64.5, z: 28, radius: 3, height: 6.5 },
  { x: 72.5, z: 31, radius: 3.5, height: 8 },
  { x: 77.5, z: 38, radius: 2.5, height: 5 },
]

// The peak covering this tile, if any (measured from the tile's middle).
export function peakAt(tile: Tile): Peak | undefined {
  return PEAKS.find((p) => Math.hypot(tile.x + 0.5 - p.x, tile.z + 0.5 - p.z) < p.radius)
}

export function isRock(tile: Tile): boolean {
  return tile.x >= HIGHLANDS_X - 1 && peakAt(tile) !== undefined
}

// Within this many tiles of a mountainside (for buildings that need one).
export function nearMountain(tile: Tile, reach = 1): boolean {
  return PEAKS.some((p) => Math.hypot(tile.x + 0.5 - p.x, tile.z + 0.5 - p.z) < p.radius + reach)
}

// Height of a peak's surface at a distance from its middle (the shape
// MountainView draws: broad flanks to half its height, then a steeper summit).
export function mountainHeight(p: Peak, distance: number): number {
  const base = p.radius + 0.4
  const waist = base * 0.48
  if (distance >= base) return 0
  if (distance >= waist) return (p.height / 2) * ((base - distance) / (base - waist))
  return p.height / 2 + (p.height / 2) * ((waist - distance) / waist)
}

// The nearest peak to a point (in tiles).
export function nearestPeak(x: number, z: number): Peak {
  return PEAKS.reduce((best, p) => (Math.hypot(p.x - x, p.z - z) < Math.hypot(best.x - x, best.z - z) ? p : best))
}

// ---- The river

// A river runs from the north edge of the Highlands down between the peaks
// to the sea: a line through these points (in tiles), about two tiles wide.
// Only roads can go on it (as bridges). Like the coast, it's fixed.
export const RIVER: [number, number][] = [
  [70, -1],
  [70, 4],
  [69, 9],
  [70.5, 13],
  [71, 17],
  [70, 21],
  [70, 24.5],
  [69, 28],
  [67.4, 31.5],
  [67.5, 35],
  [66.5, 40],
  [65.5, 52],
]
export const RIVER_HALF_WIDTH = 1.05

// How far a point (in tiles) is from the river's middle line.
export function riverDistance(x: number, z: number): number {
  let best = Infinity
  for (let i = 0; i + 1 < RIVER.length; i++) {
    const [ax, az] = RIVER[i]
    const [bx, bz] = RIVER[i + 1]
    const dx = bx - ax
    const dz = bz - az
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)))
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t))
  }
  return best
}

export function isRiver(tile: Tile): boolean {
  return tile.x >= HIGHLANDS_X - 1 && !isWater(tile) && riverDistance(tile.x + 0.5, tile.z + 0.5) < RIVER_HALF_WIDTH
}
