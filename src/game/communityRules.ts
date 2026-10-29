import { footprint, type BuildingType, type Rotation } from './buildings'
import type { Tile } from './grid'

// How a building's location changes what it earns. Homes and shops earn more
// near parks, schools and fire stations, and beside a road. Real estate works
// the same way: amenities nearby raise rents, and with them the property's
// value (and property tax). Services.ts applies these rules to the town.

// Homes and shops touching a road earn this much more.
export const ROAD_BONUS = 0.05
// However many amenities are nearby, the bonus stops here.
export const MAX_LOCATION_BONUS = 0.4

interface Placed {
  type: BuildingType
  tile: Tile
  rotation?: Rotation
}

export interface LocationBonus {
  total: number // e.g. 0.25 for +25%
  sources: string[] // what's contributing, e.g. ['Park', 'Road']
}

const NONE: LocationBonus = { total: 0, sources: [] }

// The number of tiles between two footprints (0 if they touch or overlap),
// counting diagonal steps as one: a square "radius" around a building.
export function footprintGap(a: Placed, b: Placed): number {
  const sa = footprint(a.type, a.rotation)
  const sb = footprint(b.type, b.rotation)
  const gapX = Math.max(0, b.tile.x - (a.tile.x + sa.x - 1), a.tile.x - (b.tile.x + sb.x - 1)) - 1
  const gapZ = Math.max(0, b.tile.z - (a.tile.z + sa.z - 1), a.tile.z - (b.tile.z + sb.z - 1)) - 1
  return Math.max(0, gapX, gapZ)
}

// The tiles directly around a footprint's edges (not the corners).
export function edgeTiles(p: Placed): Tile[] {
  const { x, z } = p.tile
  const { x: w, z: d } = footprint(p.type, p.rotation)
  const ring: Tile[] = []
  for (let i = 0; i < w; i++) ring.push({ x: x + i, z: z - 1 }, { x: x + i, z: z + d })
  for (let i = 0; i < d; i++) ring.push({ x: x - 1, z: z + i }, { x: x + w, z: z + i })
  return ring
}

export function locationBonus(building: Placed, all: Iterable<Placed>, isRoad: (tile: Tile) => boolean): LocationBonus {
  const { category } = building.type
  if (category !== 'home' && category !== 'business') return NONE
  let total = 0
  const sources: string[] = []
  for (const other of all) {
    const amenity = other.type.amenity
    if (!amenity || footprintGap(building, other) > amenity.radius) continue
    total += amenity.bonus
    sources.push(other.type.name)
  }
  if (edgeTiles(building).some(isRoad)) {
    total += ROAD_BONUS
    sources.push('Road')
  }
  return { total: Math.min(MAX_LOCATION_BONUS, total), sources }
}

// Which of a road tile's four neighbors are roads too, as a 4-bit number:
// 1 = north (z − 1), 2 = east (x + 1), 4 = south (z + 1), 8 = west (x − 1).
// Each of the 16 values is one road shape: 5 is a north–south straight,
// 6 a corner, 15 a crossroads. The trick is called "bitmask autotiling".
export function roadMask(tile: Tile, isRoad: (tile: Tile) => boolean): number {
  return (
    (isRoad({ x: tile.x, z: tile.z - 1 }) ? 1 : 0) |
    (isRoad({ x: tile.x + 1, z: tile.z }) ? 2 : 0) |
    (isRoad({ x: tile.x, z: tile.z + 1 }) ? 4 : 0) |
    (isRoad({ x: tile.x - 1, z: tile.z }) ? 8 : 0)
  )
}
