import type { BuildingType, Rotation } from './buildings'
import { footprintGap } from './communityRules'
import type { Tile } from './grid'

// Shops need customers. Each shop says how many residents it needs living
// within reach to sell at full speed; with fewer it still sells, but less.
// Nobody is ever stuck: an empty neighborhood still earns 60%.

export const CUSTOMER_REACH = 8 // tiles between the shop and a home
export const MIN_DEMAND = 0.6

interface Placed {
  type: BuildingType
  tile: Tile
  rotation: Rotation
}

// Residents living within reach of a shop (in homes that are built).
export function customersNear(shop: Placed, homes: (Placed & { residents: number })[]): number {
  let total = 0
  for (const h of homes) if (footprintGap(shop, h) <= CUSTOMER_REACH) total += h.residents
  return total
}

// Share of full sales: 60% with no customers, rising to 100% once the shop has all it needs.
export function demandFactor(type: BuildingType, customers: number): number {
  if (!type.customers) return 1
  return MIN_DEMAND + (1 - MIN_DEMAND) * Math.min(1, customers / type.customers)
}
