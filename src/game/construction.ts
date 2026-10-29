import type { BuildingType } from './buildings'
import type { Materials } from './items'

// The rules for building levels and upgrades. (Construction times and
// materials for new buildings are data on each building type: `build`.)

export const MAX_LEVEL = 3

// How much a level multiplies what a building does: income, residents,
// utility use and shelf space. Level 2 is +50%, level 3 is +100%.
export function levelFactor(level: number): number {
  return 1 + 0.5 * (level - 1)
}

// Homes and shops can be upgraded; other buildings stay as they are.
export function canUpgrade(type: BuildingType, level: number): boolean {
  return (type.category === 'home' || type.category === 'business') && level < MAX_LEVEL
}

export interface UpgradeCost {
  coins: number
  materials: Materials
  playerLevel: number // the player level needed
}

// Upgrading to `toLevel`: three quarters of the building's price per level,
// some materials, and a higher player level each time.
export function upgradeCost(type: BuildingType, toLevel: number): UpgradeCost {
  return {
    coins: Math.round(type.cost * 0.75 * (toLevel - 1)),
    materials: toLevel === 2 ? { lumber: 2 + type.size.x, bricks: 2 } : { bricks: 4, glass: 3, steel: 1 },
    playerLevel: type.unlockLevel + 2 * (toLevel - 1),
  }
}

// A new town starts with a few materials, enough to finish its first bigger building.
export const STARTING_MATERIALS: Materials = { bricks: 6, lumber: 6, glass: 2, steel: 2 }
