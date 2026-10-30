import type { BuildingType, Rotation } from './buildings'
import { footprintGap } from './communityRules'
import type { Tile } from './grid'

// What residents want nearby. Every home wants somewhere to shop and some
// green space; bigger family homes want a school too, and apartment
// buildings a hospital and a police station. A home's happiness is
// the share of its needs that are met, and it lifts the rent by up to 15%
// (everything met). A reward, never a penalty: a new town with nothing
// nearby earns just what it always did.

export type NeedId = 'shopping' | 'green' | 'school' | 'health' | 'safety'

export interface Need {
  id: NeedId
  icon: string
  name: string
  reach: number // tiles from the home
  hint: string // what meets it
  tab: string // the build menu tab where it's found
  meets: (type: BuildingType) => boolean
  wantedBy: (home: BuildingType) => boolean
}

export const FAMILY_SIZE = 4 // homes with this many residents or more want a school
export const APARTMENT_SIZE = 10 // apartment buildings also want a hospital and a police station

export const NEEDS: Need[] = [
  {
    id: 'shopping',
    icon: '🛒',
    name: 'Shopping',
    reach: 8,
    hint: 'a shop within 8 tiles',
    tab: 'Businesses',
    meets: (t) => t.category === 'business',
    wantedBy: () => true,
  },
  {
    id: 'green',
    icon: '🌳',
    name: 'Green space',
    reach: 6,
    hint: 'a park, playground, sports field, beach or Central Park within 6 tiles',
    tab: 'Community',
    meets: (t) => ['park', 'playground', 'sports-field', 'public-beach', 'central-park', 'botanical-garden'].includes(t.id),
    wantedBy: () => true,
  },
  {
    id: 'school',
    icon: '🏫',
    name: 'School',
    reach: 10,
    hint: 'a school or library within 10 tiles',
    tab: 'Community',
    meets: (t) => t.id === 'school' || t.id === 'library',
    wantedBy: (home) => (home.residents ?? 0) >= FAMILY_SIZE,
  },
  {
    id: 'health',
    icon: '🏥',
    name: 'Healthcare',
    reach: 14,
    hint: 'a hospital within 14 tiles',
    tab: 'Community',
    meets: (t) => t.id === 'hospital',
    wantedBy: (home) => (home.residents ?? 0) >= APARTMENT_SIZE,
  },
  {
    id: 'safety',
    icon: '👮',
    name: 'Safety',
    reach: 12,
    hint: 'a police station within 12 tiles',
    tab: 'Community',
    meets: (t) => t.id === 'police-station',
    wantedBy: (home) => (home.residents ?? 0) >= APARTMENT_SIZE,
  },
]

export const HAPPINESS_BONUS = 0.15 // rent with every need met

interface Placed {
  type: BuildingType
  tile: Tile
  rotation: Rotation
}

// Each need a home has, and whether something nearby meets it.
export function homeNeeds(home: Placed, providers: Placed[]): { need: Need; met: boolean }[] {
  return NEEDS.filter((n) => n.wantedBy(home.type)).map((need) => ({
    need,
    met: providers.some((p) => need.meets(p.type) && footprintGap(home, p) <= need.reach),
  }))
}

// 0 (nothing met) to 1 (everything met).
export function happiness(needs: { met: boolean }[]): number {
  return needs.length === 0 ? 1 : needs.filter((n) => n.met).length / needs.length
}

// How happiness changes the rent.
export function happinessFactor(share: number): number {
  return 1 + HAPPINESS_BONUS * share
}
