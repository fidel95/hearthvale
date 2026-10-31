import { soldBy } from './products'
import { BUILDING_TYPES, type BuildingType, isPlot } from './buildings'
import { MAX_LOCATION_BONUS, roadBonus } from './communityRules'
import { upgradeCost } from './construction'
import { CROP_TYPES, type CropType } from './crops'
import { SHIPMENT_OPTIONS } from './Docks'
import { MATERIALS, MATERIAL_IDS, materialsText, type Materials } from './items'
import { expansionLevel } from './land'
import { ENERGY_REGEN_MS, buildXp, collectXp, maxEnergy, unlocksAt, xpForLevel } from './progression'
import { NEIGHBORS_UNLOCK_LEVEL } from './neighborData'
import { QUESTS } from './quests'
import { UTILITY_INFO, UTILITIES } from './utilityRules'

// The balancing worksheet: every building and crop's numbers, worked out from
// the catalogs themselves, so it can never drift from the game. It feeds
// docs/BALANCE.md (npm run balance) and the balance tests, which check the
// design principles in that doc.
//
// Assumptions, so the numbers compare like with like:
// - Income is collected as soon as it's ready (active play), at full utility
//   service, with no location bonus, before taxes.
// - A shop's goods are valued at what a shipment costs per good (they could
//   have been sold or bought at that price), so shop income is shown net of it.
// - One game month (for running costs) is one minute of play.

export type Role = 'early' | 'middle' | 'late'

export function roleOf(unlockLevel: number): Role {
  return unlockLevel <= 3 ? 'early' : unlockLevel <= 7 ? 'middle' : 'late'
}

// What a good costs when shipped in: the cheapest shipment, per good.
export const GOOD_COST = Math.min(...SHIPMENT_OPTIONS.map((o) => o.cost / o.units))

export function materialsValue(m: Materials = {}): number {
  return MATERIAL_IDS.reduce((sum, id) => sum + (m[id] ?? 0) * MATERIALS[id].price!, 0)
}

// Quests whose tasks name this building or crop.
function questsFor(name: string): string[] {
  return QUESTS.filter((q) => q.tasks.some((t) => t.label.includes(name))).map((q) => q.title)
}

export interface BuildingRow {
  id: string
  name: string
  category: string
  role: Role
  unlockLevel: number
  quests: string[]
  footprint: string
  tiles: number
  cost: number // coins
  materials: string
  materialsValue: number
  totalCost: number // coins + materials at their price
  buildSeconds: number
  cycleSeconds: number | null
  coinsPerCycle: number | null // gross
  goodsPerCycle: number
  netPerCycle: number | null // gross minus the goods it sold, at GOOD_COST
  xpPerCycle: number | null
  buildXp: number
  residents: number
  needs: string
  upkeepPerMonth: number
  effect: string // what it does for the town, if not income
  paybackCycles: number | null // total cost ÷ net per cycle
  paybackMinutes: number | null // build time + payback cycles × cycle length
  coinsPerMinute: number | null
  coinsPerEnergy: number | null // each collection uses one energy
  roads: string
  upgrades: string
}

export function buildingRow(type: BuildingType): BuildingRow {
  const income = type.income
  // In goods: a product counts as the goods it was made from.
  const goods = (type.goodsPerSale ?? 0) * soldBy(type).goodsEach
  const net = income ? income.coins - goods * GOOD_COST : null
  const mValue = materialsValue(type.build?.materials)
  const totalCost = type.cost + mValue
  const buildSeconds = type.build?.seconds ?? 0
  const paybackCycles = net && net > 0 ? totalCost / net : null
  const effect = [
    type.supplies ? `supplies ${UTILITY_INFO[type.supplies.utility].icon} ${type.supplies.amount}` : '',
    type.amenity ? `+${type.amenity.bonus * 100}% within ${type.amenity.radius} tiles` : '',
    type.storage ? `stores 📦 ${type.storage}` : '',
    isPlot(type) ? 'grows crops' : '',
    type.category === 'road' ? `+${Math.round(roadBonus(type) * 100)}% for homes and shops beside it` : '',
    type.category === 'decoration' ? 'looks nice' : '',
  ]
    .filter(Boolean)
    .join('; ')
  const canUpgrade = type.category === 'home' || type.category === 'business'
  return {
    id: type.id,
    name: type.name,
    category: type.category,
    role: roleOf(type.unlockLevel),
    unlockLevel: type.unlockLevel,
    quests: questsFor(type.name),
    footprint: `${type.size.x}×${type.size.z}`,
    tiles: type.size.x * type.size.z,
    cost: type.cost,
    materials: materialsText(type.build?.materials ?? {}),
    materialsValue: mValue,
    totalCost,
    buildSeconds,
    cycleSeconds: income?.seconds ?? null,
    coinsPerCycle: income?.coins ?? null,
    goodsPerCycle: goods,
    netPerCycle: net,
    xpPerCycle: income ? collectXp(income.coins) : null,
    buildXp: buildXp(type.cost, type.xpReward) + (type.build ? Math.max(2, Math.floor(type.cost / 50)) : 0),
    residents: type.residents ?? 0,
    needs: UTILITIES.filter((u) => type.needs?.[u]).map((u) => `${UTILITY_INFO[u].icon}${type.needs![u]}`).join(' '),
    upkeepPerMonth: type.upkeep ?? 0,
    effect,
    paybackCycles,
    paybackMinutes: paybackCycles !== null && income ? buildSeconds / 60 + (paybackCycles * income.seconds) / 60 : null,
    coinsPerMinute: net !== null && income ? net / (income.seconds / 60) : null,
    coinsPerEnergy: net,
    roads: type.category === 'home' || type.category === 'business' ? 'not required; +2–8% beside one, by kind of road' : '—',
    upgrades: canUpgrade ? `★★ at level ${upgradeCost(type, 2).playerLevel}, ★★★ at ${upgradeCost(type, 3).playerLevel}` : '—',
  }
}

export interface CropRow {
  id: string
  name: string
  role: Role
  unlockLevel: number
  quests: string[]
  seedCost: number
  growSeconds: number
  freshSeconds: number
  marketPrice: number // coins if sold at the market
  goods: number // goods if stored for your shops
  goodsValue: number // those goods at what shops get for them
  profitPerCycle: number // market price − seeds
  profitPerMinute: number
  xp: number
  energyPerCycle: number // planting + harvesting
  coinsPerEnergy: number
  plotPaybackHarvests: number // harvests to earn back a farm plot
}

const PLOT_COST = BUILDING_TYPES.find((t) => t.id === 'farm-plot')!.cost
// What shops get per good: the Bakery's sale price ÷ the goods it uses.
const bakery = BUILDING_TYPES.find((t) => t.id === 'bakery')!
export const GOOD_RETAIL = bakery.income!.coins / bakery.goodsPerSale!

export function cropRow(crop: CropType): CropRow {
  const profit = crop.sellPrice - crop.seedCost
  return {
    id: crop.id,
    name: crop.name,
    role: roleOf(crop.unlockLevel),
    unlockLevel: crop.unlockLevel,
    quests: questsFor(crop.name),
    seedCost: crop.seedCost,
    growSeconds: crop.growSeconds,
    freshSeconds: crop.freshSeconds,
    marketPrice: crop.sellPrice,
    goods: crop.goods,
    goodsValue: crop.goods * GOOD_RETAIL,
    profitPerCycle: profit,
    profitPerMinute: profit / (crop.growSeconds / 60),
    xp: crop.xp,
    energyPerCycle: 2,
    coinsPerEnergy: profit / 2,
    plotPaybackHarvests: PLOT_COST / profit,
  }
}

// ---- Progression: which mechanic each level introduces

export type Mechanic =
  | 'homes'
  | 'farming'
  | 'roads'
  | 'decorations'
  | 'shops'
  | 'construction'
  | 'utilities'
  | 'storage'
  | 'community'
  | 'upgrades'
  | 'land'
  | 'shipping'
  | 'neighbors'
  | 'landmarks'
  | 'railways'
  | 'flights'
  | 'factories'

// The mechanics a building brings with it.
export function mechanicsOf(type: BuildingType): Mechanic[] {
  const byCategory: Record<string, Mechanic> = {
    home: 'homes',
    farm: 'farming',
    road: 'roads',
    decoration: 'decorations',
    business: 'shops',
    utility: 'utilities',
    storage: 'storage',
    community: 'community',
    port: 'shipping',
    landmark: 'landmarks',
    rail: 'railways',
    air: 'flights',
    industry: 'factories',
  }
  return type.build ? [byCategory[type.category], 'construction'] : [byCategory[type.category]]
}

// For each level, the mechanics that first appear there.
export function mechanicsByLevel(): Map<number, Mechanic[]> {
  const first = new Map<Mechanic, number>()
  const see = (m: Mechanic, level: number) => first.set(m, Math.min(first.get(m) ?? Infinity, level))
  for (const type of BUILDING_TYPES) for (const m of mechanicsOf(type)) see(m, type.unlockLevel)
  const anyUpgradeable = BUILDING_TYPES.find((t) => t.category === 'home')!
  see('upgrades', upgradeCost(anyUpgradeable, 2).playerLevel)
  see('land', expansionLevel(1))
  see('neighbors', NEIGHBORS_UNLOCK_LEVEL)
  const byLevel = new Map<number, Mechanic[]>()
  for (const [m, level] of first) byLevel.set(level, [...(byLevel.get(level) ?? []), m])
  return byLevel
}

export interface LevelRow {
  level: number
  totalXp: number
  newMechanics: Mechanic[]
  unlocks: string[]
  quests: string[] // quests that need this level
}

export function levelRows(maxLevel: number): LevelRow[] {
  const mechanics = mechanicsByLevel()
  const rows: LevelRow[] = []
  for (let level = 1; level <= maxLevel; level++) {
    const { buildings, crops } = unlocksAt(level)
    rows.push({
      level,
      totalXp: xpForLevel(level),
      newMechanics: mechanics.get(level) ?? [],
      unlocks: [...buildings.map((b) => b.name), ...crops.map((c) => `${c.emoji} ${c.name}`)],
      quests: QUESTS.filter((q) => (q.level ?? 1) === level).map((q) => q.title),
    })
  }
  return rows
}

// The energy budget of an early session: how long a full bar lasts when
// collecting from a starter town, and how fast it refills.
export function energyBudget() {
  const cottage = BUILDING_TYPES.find((t) => t.id === 'cottage')!
  const homes = 3
  const usePerMinute = homes * (60 / cottage.income!.seconds) + 1 // three cottages and a strawberry plot (plant + harvest a minute)
  const regenPerMinute = 60_000 / ENERGY_REGEN_MS
  return {
    maxAtLevel1: maxEnergy(1),
    regenPerMinute,
    usePerMinute,
    minutesOfActivePlay: maxEnergy(1) / Math.max(0.1, usePerMinute - regenPerMinute),
    locationBonusCap: MAX_LOCATION_BONUS,
  }
}

export function worksheet() {
  return {
    assumptions: {
      goodCost: GOOD_COST,
      goodRetail: GOOD_RETAIL,
      collection: 'income collected as soon as it is ready, full utilities, no location bonus, before tax',
      gameMonth: 'one minute of play',
    },
    buildings: BUILDING_TYPES.map(buildingRow),
    crops: CROP_TYPES.map(cropRow),
    levels: levelRows(12),
    energy: energyBudget(),
  }
}
