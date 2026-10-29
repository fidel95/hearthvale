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
