import type { City, PlacedBuilding } from './City'
import { canUpgrade, levelFactor, upgradeCost } from './construction'
import type { Inventory } from './Inventory'
import type { Materials } from './items'
import type { Player } from './Player'

// Finishing construction and upgrading both need things from more than one
// place: the building (City), materials (Inventory) and sometimes a level
// (Player). These functions check everything first and only then change
// anything, so a half-done upgrade can't happen.

export type ProjectResult =
  | { ok: true }
  | { ok: false; reason: 'not-ready' | 'level' | 'coins' | 'room' }
  | { ok: false; reason: 'materials'; missing: Materials }

export function finishConstruction(city: City, inventory: Inventory, b: PlacedBuilding, now: number): ProjectResult {
  if (!city.constructionDone(b, now)) return { ok: false, reason: 'not-ready' }
  const needed = b.type.build?.materials ?? {}
  if (!inventory.hasAll(needed)) return { ok: false, reason: 'materials', missing: inventory.missing(needed) }
  const cost = inventory.use(needed)!
  city.finish(b.id, now, cost)
  return { ok: true }
}

// roomFor: is there population capacity for the residents an upgrade adds?
export function upgradeBuilding(
  city: City,
  inventory: Inventory,
  player: Player,
  b: PlacedBuilding,
  roomFor: (residents: number) => boolean = () => true,
): ProjectResult {
  if (!canUpgrade(b.type, b.level) || !city.isBuilt(b)) return { ok: false, reason: 'not-ready' }
  const cost = upgradeCost(b.type, b.level + 1)
  if (player.level < cost.playerLevel) return { ok: false, reason: 'level' }
  const extra = Math.round((b.type.residents ?? 0) * (levelFactor(b.level + 1) - levelFactor(b.level)))
  if (!roomFor(extra)) return { ok: false, reason: 'room' }
  if (city.coins < cost.coins) return { ok: false, reason: 'coins' }
  if (!inventory.hasAll(cost.materials)) return { ok: false, reason: 'materials', missing: inventory.missing(cost.materials) }
  const materialsCost = inventory.use(cost.materials)!
  city.upgrade(b.id, cost.coins, materialsCost)
  return { ok: true }
}
