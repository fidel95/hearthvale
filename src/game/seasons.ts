import type { CropType } from './crops'

// The four seasons, from the game calendar (GameClock.month, 0 = January).
// Each crop has a best season; harvested then, it's bigger and sells for
// more. Out of season it grows just the same, so nothing is ever blocked.

export type Season = 'spring' | 'summer' | 'fall' | 'winter'

export const SEASON_INFO: Record<Season, { name: string; icon: string }> = {
  spring: { name: 'Spring', icon: '🌸' },
  summer: { name: 'Summer', icon: '☀️' },
  fall: { name: 'Fall', icon: '🍂' },
  winter: { name: 'Winter', icon: '❄️' },
}

// In season: +25% harvest (goods and market price).
export const IN_SEASON_BONUS = 0.25

export function seasonOf(month: number): Season {
  if (month === 11 || month <= 1) return 'winter'
  if (month <= 4) return 'spring'
  if (month <= 7) return 'summer'
  return 'fall'
}

export function seasonBonus(crop: CropType, month: number): number {
  return crop.season === seasonOf(month) ? IN_SEASON_BONUS : 0
}
