import * as THREE from 'three'

export const GRID_SIZE = 20 // the map is GRID_SIZE x GRID_SIZE tiles, 1 world unit per tile

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
