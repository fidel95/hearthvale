import type { BuildingType, Category } from './buildings'
import { levelFactor } from './construction'

// The rules for town utilities: water, electricity and trash pickup.
// (Services.ts applies them over time, like taxRules.ts and Taxes.ts.)
//
// Every home, shop and farm uses some of each (buildings.ts `needs`), and
// utility buildings supply them (`supplies`). Supply is shared across the
// whole town, as if every building were connected to every pipe and wire.
// When demand outgrows supply, buildings get only part of what they need and
// earn less; see incomeMultiplier.

export type Utility = 'water' | 'power' | 'trash'

export const UTILITIES: Utility[] = ['water', 'power', 'trash']

export const UTILITY_INFO: Record<Utility, { name: string; icon: string; builds: string }> = {
  water: { name: 'Water', icon: '💧', builds: 'Water Tower' },
  power: { name: 'Electricity', icon: '🔌', builds: 'Power Plant or Solar Farm' },
  trash: { name: 'Trash pickup', icon: '🗑️', builds: 'Recycling Center' },
}

// A small town is served by the county for free: enough for a few buildings,
// so a new town works before it can afford its own plants.
export const COUNTY_SUPPLY: Record<Utility, number> = { water: 8, power: 8, trash: 8 }

export interface UtilityStatus {
  supply: number
  demand: number
  level: number // share of demand that's met, 0 to 1
}

export interface ServiceReport {
  population: number
  upkeep: number // coins per game month to run every utility and community building
  utilities: Record<Utility, UtilityStatus>
}

// Built buildings only (construction sites don't use or supply anything yet).
// Upgraded buildings house more people and use more, by their level factor.
export function serviceReport(buildings: Iterable<{ type: BuildingType; level?: number }>): ServiceReport {
  const supply = { ...COUNTY_SUPPLY }
  const demand: Record<Utility, number> = { water: 0, power: 0, trash: 0 }
  let population = 0
  let upkeep = 0
  for (const { type, level = 1 } of buildings) {
    const factor = levelFactor(level)
    population += Math.round((type.residents ?? 0) * factor)
    for (const u of UTILITIES) demand[u] += Math.round((type.needs?.[u] ?? 0) * factor)
    if (type.supplies) supply[type.supplies.utility] += type.supplies.amount
    upkeep += type.upkeep ?? 0
  }
  const status = (u: Utility): UtilityStatus => ({
    supply: supply[u],
    demand: demand[u],
    level: demand[u] === 0 ? 1 : Math.min(1, supply[u] / demand[u]),
  })
  return { population, upkeep, utilities: { water: status('water'), power: status('power'), trash: status('trash') } }
}

// What share of its full income a building earns, given the service levels.
// - Homes and shops can't run without water and power: income scales with both.
// - Uncollected trash makes the town less pleasant: up to a quarter less.
// - Farms only need water, for irrigation.
export function incomeMultiplier(report: ServiceReport, category: Category): number {
  const { water, power, trash } = report.utilities
  switch (category) {
    case 'home':
    case 'business':
      return water.level * power.level * (0.75 + 0.25 * trash.level)
    case 'farm':
      return water.level
    default:
      return 1
  }
}

// Which utilities are short, as icons, for warnings ("💧🔌").
export function shortIcons(report: ServiceReport): string {
  return UTILITIES.filter((u) => report.utilities[u].level < 1)
    .map((u) => UTILITY_INFO[u].icon)
    .join('')
}
