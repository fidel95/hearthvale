import type { City, PlacedBuilding } from './City'
import { canUpgrade, levelFactor, upgradeCost } from './construction'
import type { Lot } from './grid'
import type { Inventory } from './Inventory'
import type { Materials } from './items'
import { expansionLevel, expansionMaterials, expansionQuest } from './land'
import { QUESTS, type Quests } from './quests'
import type { Player } from './Player'

// Finishing construction and upgrading both need things from more than one
// place: the building (City), materials (Inventory) and sometimes a level
// (Player). These functions check everything first and only then change
// anything, so a half-done upgrade can't happen.
//
// The quotes answer "what would it take, and can I do it now?" for the
// interface, from the same checks the actions use, so a button can't say yes
// when the action would say no.

export type ProjectResult =
  | { ok: true }
  | { ok: false; reason: 'not-ready' | 'level' | 'coins' | 'room' }
  | { ok: false; reason: 'quest'; quest: string } // a quest to finish first (its title)
  | { ok: false; reason: 'damaged' } // repair it first
  | { ok: false; reason: 'materials'; missing: Materials }

export function finishConstruction(city: City, inventory: Inventory, b: PlacedBuilding, now: number): ProjectResult {
  if (!city.production.constructionDone(b, now)) return { ok: false, reason: 'not-ready' }
  const needed = b.type.build?.materials ?? {}
  if (!inventory.hasAll(needed)) return { ok: false, reason: 'materials', missing: inventory.missing(needed) }
  const cost = inventory.use(needed)!
  city.production.finish(b.id, now, cost)
  return { ok: true }
}

export interface Quote {
  coins: number
  materials: Materials
  playerLevel: number
  missing: Materials // materials still to get
  result: ProjectResult // what trying it now would give
}

// The cost of the next upgrade and whether it can be done now; null if the
// building can't be upgraded (fully upgraded, or still being built).
// roomFor: is there population capacity for the residents an upgrade adds?
export function upgradeQuote(
  city: City,
  inventory: Inventory,
  player: Player,
  b: PlacedBuilding,
  roomFor: (residents: number) => boolean = () => true,
): Quote | null {
  if (!canUpgrade(b.type, b.level) || !city.isBuilt(b)) return null
  const cost = upgradeCost(b.type, b.level + 1)
  const extra = Math.round((b.type.residents ?? 0) * (levelFactor(b.level + 1) - levelFactor(b.level)))
  const missing = inventory.missing(cost.materials)
  const result: ProjectResult = b.damaged
    ? { ok: false, reason: 'damaged' }
    : player.level < cost.playerLevel
      ? { ok: false, reason: 'level' }
      : !roomFor(extra)
        ? { ok: false, reason: 'room' }
        : !city.economy.canAfford(cost.coins)
          ? { ok: false, reason: 'coins' }
          : Object.keys(missing).length
            ? { ok: false, reason: 'materials', missing }
            : { ok: true }
  return { ...cost, missing, result }
}

export function upgradeBuilding(
  city: City,
  inventory: Inventory,
  player: Player,
  b: PlacedBuilding,
  roomFor: (residents: number) => boolean = () => true,
): ProjectResult {
  const quote = upgradeQuote(city, inventory, player, b, roomFor)
  if (!quote) return { ok: false, reason: 'not-ready' }
  if (!quote.result.ok) return quote.result
  const materialsCost = inventory.use(quote.materials)!
  city.production.upgrade(b.id, quote.coins, materialsCost)
  return { ok: true }
}

// The next lot: its price, materials and level, and whether it can be bought now.
// quests: to check the quest some expansions need (optional, for tests of the rest).
export function landQuote(city: City, inventory: Inventory, player: Player, quests?: Quests): Quote {
  const n = city.expansions + 1
  const questId = expansionQuest(n)
  const quest = questId && quests && !quests.claimedQuests().some((q) => q.id === questId) ? QUESTS.find((q) => q.id === questId)! : null
  const materials = expansionMaterials(n)
  const playerLevel = expansionLevel(n)
  const coins = city.nextLotPrice
  const missing = inventory.missing(materials)
  const result: ProjectResult =
    player.level < playerLevel
      ? { ok: false, reason: 'level' }
      : quest
        ? { ok: false, reason: 'quest', quest: quest.title }
        : !city.economy.canAfford(coins)
          ? { ok: false, reason: 'coins' }
          : Object.keys(missing).length
            ? { ok: false, reason: 'materials', missing }
            : { ok: true }
  return { coins, materials, playerLevel, missing, result }
}

// Buying land: the level, the coins and the materials, all checked first.
export function buyLand(city: City, inventory: Inventory, player: Player, lot: Lot, quests?: Quests): ProjectResult {
  if (!city.canBuyLot(lot)) return { ok: false, reason: 'not-ready' }
  const quote = landQuote(city, inventory, player, quests)
  if (!quote.result.ok) return quote.result
  const cost = inventory.use(quote.materials)!
  city.buyLot(lot, cost)
  return { ok: true }
}
