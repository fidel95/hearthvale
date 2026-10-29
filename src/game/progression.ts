import { BUILDING_TYPES, type BuildingType } from './buildings'
import { CROP_TYPES, type CropType } from './crops'

// The rules for XP, levels and energy, as plain numbers and pure functions
// (like taxRules.ts). Player.ts applies them over time.
//
// - XP comes from building, collecting and harvesting. Enough XP raises your
//   level, which unlocks buildings and crops and pays a coin reward.
// - Energy limits how many things you can tap in one sitting. Each collect,
//   harvest, planting or clearing uses 1, and it refills slowly in real time.
//   It's the genre's way of pacing play: a short session, then come back later.

// ---- Levels

// Total XP needed to reach a level: 5·k·(k+1) with k = level − 1, so each
// level needs 10 XP more than the last (10, 30, 60, 100, 150, …).
export function xpForLevel(level: number): number {
  const k = level - 1
  return 5 * k * (k + 1)
}

export function levelForXp(xp: number): number {
  let level = 1
  while (xp >= xpForLevel(level + 1)) level++
  return level
}

// Coins awarded on reaching a level.
export function levelReward(level: number): number {
  return level * 25
}

// What becomes available at exactly this level.
export function unlocksAt(level: number): { buildings: BuildingType[]; crops: CropType[] } {
  return {
    buildings: BUILDING_TYPES.filter((b) => b.unlockLevel === level),
    crops: CROP_TYPES.filter((c) => c.unlockLevel === level),
  }
}

// ---- XP for actions

// Building: 1 XP per 20 coins spent, so bigger investments level you faster.
// Free buildings (the starting town, loading a save) give none.
export function buildXp(paid: number): number {
  return paid > 0 ? Math.ceil(paid / 20) : 0
}

// Collecting rent or sales: about 1 XP per 15 coins, at least 1.
export function collectXp(coins: number): number {
  return Math.max(1, Math.round(coins / 15))
}

// Harvesting gives the crop's own XP (crops.ts), more for slower crops.

// ---- Energy

export const ENERGY_REGEN_MS = 2 * 60_000 // one energy every 2 minutes, real time

// Each level adds one to the maximum.
export function maxEnergy(level: number): number {
  return 14 + level
}
