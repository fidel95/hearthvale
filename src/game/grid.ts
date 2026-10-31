import * as THREE from 'three'

// The whole world is GRID_SIZE x GRID_SIZE tiles, 1 world unit per tile.
// It's divided into square lots of land; you start owning a few near the
// middle and buy the rest as the town grows (land.ts). The world grew from 6
// to 8 lots a side in Stage 13: the new land is east and south of the old, so
// every tile of an older town stays where it was. The east is the Highlands
// (terrain.ts); the south is mostly sea.
export const LOT_SIZE = 10
export const LOTS_PER_SIDE = 8
export const GRID_SIZE = LOT_SIZE * LOTS_PER_SIDE

const HALF = GRID_SIZE / 2

// Tile coordinates run from 0 to GRID_SIZE - 1 on both axes.
// x follows world X, z follows world Z (three.js uses Y for "up").
export interface Tile {
  x: number
  z: number
}

// The map is centered on the world origin, so world X goes from -HALF to +HALF.
// Shift by HALF and round down to get which tile a world point falls in.
export function worldToTile(point: THREE.Vector3): Tile | null {
  const x = Math.floor(point.x + HALF)
  const z = Math.floor(point.z + HALF)
  if (x < 0 || z < 0 || x >= GRID_SIZE || z >= GRID_SIZE) return null
  return { x, z }
}

export function tileToWorld(tile: Tile, y = 0): THREE.Vector3 {
  return new THREE.Vector3(tile.x - HALF + 0.5, y, tile.z - HALF + 0.5)
}

// The world-space center of a rectangle of tiles whose lowest corner tile is `tile`.
// tile.x - HALF is the rectangle's edge; add half its size to reach the middle.
export function footprintCenter(tile: Tile, size: { x: number; z: number }): THREE.Vector3 {
  return new THREE.Vector3(tile.x - HALF + size.x / 2, 0, tile.z - HALF + size.z / 2)
}

// Every tile covered by a footprint of `size` with its lowest corner at `tile`.
export function footprintTiles(tile: Tile, size: { x: number; z: number }): Tile[] {
  const tiles: Tile[] = []
  for (let dx = 0; dx < size.x; dx++) {
    for (let dz = 0; dz < size.z; dz++) tiles.push({ x: tile.x + dx, z: tile.z + dz })
  }
  return tiles
}

export function inBounds(tile: Tile): boolean {
  return tile.x >= 0 && tile.z >= 0 && tile.x < GRID_SIZE && tile.z < GRID_SIZE
}

// ---- Lots of land

// A lot's position in the grid of lots (0 to LOTS_PER_SIDE - 1 on each axis).
export interface Lot {
  x: number
  z: number
}

export function lotOf(tile: Tile): Lot {
  return { x: Math.floor(tile.x / LOT_SIZE), z: Math.floor(tile.z / LOT_SIZE) }
}

// A string to use as a Map/Set key, since two {x, z} objects are never === each other.
export function lotKey(lot: Lot): string {
  return `${lot.x},${lot.z}`
}

export function lotInWorld(lot: Lot): boolean {
  return lot.x >= 0 && lot.z >= 0 && lot.x < LOTS_PER_SIDE && lot.z < LOTS_PER_SIDE
}

// The four lots sharing an edge with this one.
export function lotNeighbors(lot: Lot): Lot[] {
  return [
    { x: lot.x + 1, z: lot.z },
    { x: lot.x - 1, z: lot.z },
    { x: lot.x, z: lot.z + 1 },
    { x: lot.x, z: lot.z - 1 },
  ].filter(lotInWorld)
}

// The lot's lowest corner tile, e.g. for footprintCenter(lotCorner(lot), LOT_FOOTPRINT).
export function lotCorner(lot: Lot): Tile {
  return { x: lot.x * LOT_SIZE, z: lot.z * LOT_SIZE }
}

export const LOT_FOOTPRINT = { x: LOT_SIZE, z: LOT_SIZE }
