import type { City, PlacedBuilding } from './City'
import { cropState } from './crops'

// What a building is doing right now, in one of a few states every part of
// the interface uses (bubbles, the info card, details, the map):
//
// - building:  under construction (or ready to finish)
// - idle:      nothing to do on its own (a decoration, an empty plot)
// - producing: working toward something, ready at `readyAt`
// - ready:     something to collect, harvest or clear
// - blocked:   can't produce until something's fixed, and why
//
// Everything comes from timestamps and the town's state, so it's never saved.

export type BlockedReason = 'road' | 'stock'

export type ProductionState =
  | { state: 'building'; endsAt: number; done: boolean }
  | { state: 'idle' }
  | { state: 'producing'; readyAt: number }
  | { state: 'ready' }
  | { state: 'blocked'; reason: BlockedReason }

export function productionState(city: City, b: PlacedBuilding, now: number): ProductionState {
  if (b.construction) return { state: 'building', endsAt: b.construction.endsAt, done: now >= b.construction.endsAt }
  if (b.type.requiresRoad && !city.hasRoadAccess(b)) return { state: 'blocked', reason: 'road' }
  if (b.type.income) {
    if (now < b.readyAt) return { state: 'producing', readyAt: b.readyAt }
    return city.production.hasStock(b) ? { state: 'ready' } : { state: 'blocked', reason: 'stock' }
  }
  if (b.type.category === 'farm') {
    const crop = cropState(b.crop, now)
    if (crop.stage === 'growing') return { state: 'producing', readyAt: crop.readyAt }
    if (crop.stage === 'ripe' || crop.stage === 'withered') return { state: 'ready' }
  }
  return { state: 'idle' }
}

export const BLOCKED_TEXT: Record<BlockedReason, string> = {
  road: 'No road access: build a road beside it',
  stock: 'Out of stock: restock it with goods',
}
