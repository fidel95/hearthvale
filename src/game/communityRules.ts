import { footprint, type BuildingType, type Rotation } from './buildings'
import type { Tile } from './grid'

// How a building's location changes what it earns. Homes and shops earn more
// near parks, schools and fire stations, and beside a road. Real estate works
// the same way: amenities nearby raise rents, and with them the property's
// value (and property tax). Services.ts applies these rules to the town.

// Homes and shops touching a Road earn this much more (other kinds of
// road have their own: roadBonus).
export const ROAD_BONUS = 0.05
// However many amenities are nearby, the bonus stops here.
export const MAX_LOCATION_BONUS = 0.4
// Decorations (trees, flowers, fountains) count up to this much of it, so a
// row of cheap trees can't stand in for a park or a school.
export const MAX_DECOR_BONUS = 0.1

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

// How much a road adds to homes and shops beside it (each kind has its own).
export function roadBonus(type: BuildingType): number {
  return type.road?.bonus ?? ROAD_BONUS
}

export function locationBonus(building: Placed, all: Iterable<Placed>, isRoad: (tile: Tile) => boolean): LocationBonus {
  const { category } = building.type
  if (category !== 'home' && category !== 'business') return NONE
  let community = 0
  let decor = 0
  const sources: string[] = []
  const roads = new Map<string, BuildingType>()
  for (const other of all) {
    if (other.type.category === 'road') roads.set(`${other.tile.x},${other.tile.z}`, other.type)
    const amenity = other.type.amenity
    if (!amenity || footprintGap(building, other) > amenity.radius) continue
    if (other.type.category === 'decoration') decor += amenity.bonus
    else community += amenity.bonus
    sources.push(other.type.name)
  }
  // The best road beside it counts (one road bonus, not one per road).
  const beside = edgeTiles(building).filter(isRoad)
  if (beside.length > 0) {
    const best = beside
      .map((t) => roads.get(`${t.x},${t.z}`))
      .reduce<BuildingType | undefined>((a, b) => (b && (!a || roadBonus(b) > roadBonus(a)) ? b : a), undefined)
    community += best ? roadBonus(best) : ROAD_BONUS
    sources.push(best?.name ?? 'Road')
  }
  const total = community + Math.min(MAX_DECOR_BONUS, decor)
  return { total: Math.min(MAX_LOCATION_BONUS, Math.round(total * 1000) / 1000), sources }
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
