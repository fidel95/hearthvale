import { BUILDING_TYPES } from './buildings'
import type { City } from './City'

// The safety net: a town should never be stuck for good. Every other
// shortage fixes itself in time (energy refills, rent keeps coming, a utility
// shortage only lowers income, materials can be bought). The one dead end is
// a town with nothing that earns and too few coins to build something that
// does. Then the county offers a grant, at most once an hour.

// The cheapest building that earns coins and is available from the start (the Cottage).
export const CHEAPEST_EARNER = Math.min(...BUILDING_TYPES.filter((t) => t.income && t.unlockLevel === 1).map((t) => t.cost))

export const GRANT = Math.round(CHEAPEST_EARNER * 1.5) // a home, plus a little for seeds
export const GRANT_COOLDOWN_MS = 60 * 60_000

// Nothing on the map or in storage earns coins, and there's not enough to build something that does.
export function isStuck(city: City): boolean {
  const earns = (b: { type: { income?: unknown } }) => b.type.income !== undefined
  const canEarn = [...city.all()].some(earns) || [...city.storedBuildings()].some(earns)
  return !canEarn && city.coins < CHEAPEST_EARNER
}

export function canClaimGrant(city: City, lastGrantAt: number | null, now: number): boolean {
  return isStuck(city) && (lastGrantAt === null || now - lastGrantAt >= GRANT_COOLDOWN_MS)
}
