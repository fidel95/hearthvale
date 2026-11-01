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

// The grass through the year: a tint (red, green and blue multipliers) over
// every green, cool and dull in winter, fresh in spring, warm in summer,
// golden in fall. month runs from 0 to 12 through the year, with fractions;
// the tints are keyed at the middle of January, April, July and October and
// eased between, so the grass turns slowly.
const GRASS_TINTS: [number, number, number][] = [
  [0.94, 0.97, 0.98],
  [0.98, 1.04, 0.95],
  [1.04, 1.02, 0.88],
  [1.12, 0.97, 0.78],
]
export function grassTint(month: number): [number, number, number] {
  const at = ((((month - 0.5) % 12) + 12) % 12) / 3 // 0 to 4 through the keys
  const i = Math.floor(at)
  const t = at - i
  const ease = t * t * (3 - 2 * t)
  const a = GRASS_TINTS[i % 4]
  const b = GRASS_TINTS[(i + 1) % 4]
  return [0, 1, 2].map((k) => a[k] + (b[k] - a[k]) * ease) as [number, number, number]
}
