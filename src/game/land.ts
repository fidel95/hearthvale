import type { Lot, Tile } from './grid'
import type { Materials } from './items'

// The rules for owning and buying land. Like buildings.ts and taxRules.ts,
// it's plain data and pure functions; City applies them.

// The town starts on the four lots in the middle of the world (tiles 20–39).
export const START_LOTS: Lot[] = [
  { x: 2, z: 2 },
  { x: 3, z: 2 },
  { x: 2, z: 3 },
  { x: 3, z: 3 },
]

// What a new town starts with: a cottage, a farm plot with strawberries
// already 40 seconds in (so the first harvest comes quickly), and some trees.
// Tiles 20–39 are the starting land in the middle of the world.
export const STARTING_TOWN: { typeId: string; tile: Tile; crop?: { cropId: string; secondsIn: number } }[] = [
  { typeId: 'cottage', tile: { x: 29, z: 29 } },
  { typeId: 'farm-plot', tile: { x: 32, z: 29 }, crop: { cropId: 'strawberries', secondsIn: 40 } },
  { typeId: 'oak-tree', tile: { x: 28, z: 32 } },
  { typeId: 'oak-tree', tile: { x: 31, z: 32 } },
  { typeId: 'oak-tree', tile: { x: 27, z: 28 } },
]

// The starting land came with the town, but it still has a value for
// property tax: what a lot like it would sell for.
export const START_LOT_VALUE = 250

// The nth expansion (1 = your first) costs more than the last, and needs a
// higher level, so the town grows at the pace you do.
export function expansionPrice(n: number): number {
  return 500 * n
}

// The first expansion comes at level 8: the starting 20×20 tiles hold a town
// comfortably until then, and buying land is that level's new mechanic.
export function expansionLevel(n: number): number {
  return 7 + n
}

// Clearing and fencing new land takes materials too, more for each lot.
export function expansionMaterials(n: number): Materials {
  return { lumber: 2 + 2 * n, bricks: 2 * n }
}
