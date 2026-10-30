import type { BuildingType } from './buildings'
import type { Tile } from './grid'
import type { LocationBonus } from './communityRules'
import { UTILITIES, type ServiceReport } from './utilityRules'

// The city rating: one number from 0 to 100 for how good a place the town is
// to live. It adds up a few parts, each with a clear reason, so there are no
// hidden penalties; the Town window shows every part and what would raise it.
// Landmarks need a minimum rating to be built.

export interface RatingPart {
  id: string
  label: string
  points: number
  max: number
  hint: string // what raises it
}

export interface CityRating {
  total: number
  parts: RatingPart[]
}

interface Building {
  type: BuildingType
  tile: Tile
}

export interface RatingInput {
  buildings: Building[] // built buildings on the map
  report: ServiceReport
  bonus: (b: Building) => LocationBonus
  hasRoad: (b: Building) => boolean
  debt: number
  happiness: number // homes' average happiness, 0 to 1 (needs.ts)
}

export function cityRating({ buildings, report, bonus, hasRoad, debt, happiness }: RatingInput): CityRating {
  const homes = buildings.filter((b) => b.type.category === 'home')
  const earners = buildings.filter((b) => b.type.category === 'home' || b.type.category === 'business')
  const decorations = buildings.filter((b) => b.type.category === 'decoration').length
  // A share of a group, or full marks when there's nothing in the group yet.
  const share = (count: number, of: number) => (of === 0 ? 1 : count / of)

  const service = UTILITIES.reduce((sum, u) => sum + report.utilities[u].level, 0) / UTILITIES.length
  const fullness = report.capacity > 0 ? report.population / report.capacity : 0
  const parts: RatingPart[] = [
    { id: 'services', label: 'Utilities', max: 30, points: 30 * service, hint: 'Supply enough water, power and trash pickup' },
    {
      id: 'needs',
      label: 'Resident needs',
      max: 15,
      points: 15 * happiness,
      hint: 'Homes want a shop and green space nearby (and family homes a school)',
    },
    {
      id: 'neighborhoods',
      label: 'Neighborhoods',
      max: 10,
      points: 10 * share(homes.filter((h) => bonus(h).total > 0).length, homes.length),
      hint: 'Put homes near parks, schools, decorations or roads',
    },
    {
      id: 'roads',
      label: 'Roads',
      max: 15,
      points: 15 * share(earners.filter(hasRoad).length, earners.length),
      hint: 'Give every home and shop a road beside it',
    },
    {
      id: 'room',
      label: 'Room to grow',
      max: 10,
      // Full marks up to 90% full, falling to nothing at 100%.
      points: 10 * Math.min(1, Math.max(0, (1 - fullness) / 0.1)),
      hint: 'Keep population under 90% of capacity: build community buildings',
    },
    { id: 'finances', label: 'Finances', max: 10, points: debt === 0 ? 10 : debt < 100 ? 5 : 0, hint: 'Pay off any unpaid bills' },
    {
      id: 'greenery',
      label: 'Greenery',
      max: 10,
      points: 10 * Math.min(1, share(decorations, homes.length)),
      hint: 'About one decoration per home',
    },
  ]
  for (const p of parts) p.points = Math.round(p.points)
  return { total: parts.reduce((sum, p) => sum + p.points, 0), parts }
}
