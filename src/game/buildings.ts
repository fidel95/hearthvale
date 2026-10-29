// The building catalog. Everything the game knows about a kind of building
// lives here as plain data, so adding a building means adding an entry,
// not writing new code.

import type { Utility } from './utilityRules'

export type Category = 'home' | 'business' | 'farm' | 'decoration' | 'utility' | 'community' | 'road'

export type PlaceholderShape =
  | 'house'
  | 'shop'
  | 'field'
  | 'tree'
  | 'tower'
  | 'plant'
  | 'recycling'
  | 'solar'
  | 'road'
  | 'park'
  | 'school'
  | 'firestation'

export interface BuildingType {
  id: string
  name: string
  category: Category
  size: { x: number; z: number } // footprint in tiles
  cost: number
  unlockLevel: number // the player level that makes it available (progression.ts)
  // Coins this building pays out every `seconds`. Homes collect rent, businesses earn sales.
  income?: { coins: number; seconds: number }
  // People living here (homes only). They count toward population and walk around town.
  residents?: number
  // Units of each utility this building uses (utilityRules.ts).
  needs?: Partial<Record<Utility, number>>
  // Utility buildings: what they supply.
  supplies?: { utility: Utility; amount: number }
  // Coins it costs to run each game month (utilities and community buildings).
  upkeep?: number
  // Community buildings: homes and shops within `radius` tiles earn `bonus` more (communityRules.ts).
  amenity?: { bonus: number; radius: number }
  // Must be built on the shore, next to the sea (docks).
  onShore?: boolean
  // Depreciation period in years, when it differs from its category's (taxRules.ts).
  recoveryYears?: number
  // How to draw it when there's no model (or the model fails to load).
  placeholder: { shape: PlaceholderShape; color: string; accent: string; height: number }
  // URL of a .glb model, e.g. suburban('building-type-a'). Optional: without it we draw the placeholder.
  model?: string
}

// Models live in public/models/. BASE_URL is '/' in dev but may be a
// subfolder once deployed (Stage 12), so build URLs from it instead of hardcoding '/'.
const suburban = (name: string) => `${import.meta.env.BASE_URL}models/suburban/${name}.glb`

export const BUILDING_TYPES: BuildingType[] = [
  {
    id: 'cottage',
    name: 'Cottage',
    category: 'home',
    size: { x: 2, z: 2 },
    cost: 100,
    unlockLevel: 1,
    income: { coins: 15, seconds: 30 },
    residents: 2,
    needs: { water: 2, power: 2, trash: 2 },
    model: suburban('building-type-g'),
    placeholder: { shape: 'house', color: '#f2d7b0', accent: '#c4553f', height: 0.9 },
  },
  {
    id: 'townhouse',
    name: 'Townhouse',
    category: 'home',
    size: { x: 2, z: 2 },
    cost: 250,
    unlockLevel: 3,
    income: { coins: 35, seconds: 60 },
    residents: 3,
    needs: { water: 3, power: 3, trash: 3 },
    model: suburban('building-type-k'),
    placeholder: { shape: 'house', color: '#c9d8e8', accent: '#4a5d7a', height: 1.6 },
  },
  {
    id: 'family-house',
    name: 'Family House',
    category: 'home',
    size: { x: 2, z: 2 },
    cost: 400,
    unlockLevel: 6,
    income: { coins: 50, seconds: 90 },
    residents: 4,
    needs: { water: 4, power: 4, trash: 4 },
    model: suburban('building-type-a'),
    placeholder: { shape: 'house', color: '#f4f4f4', accent: '#3fae6b', height: 1.2 },
  },
  {
    id: 'modern-house',
    name: 'Modern House',
    category: 'home',
    size: { x: 2, z: 2 },
    cost: 600,
    unlockLevel: 8,
    income: { coins: 80, seconds: 120 },
    residents: 4,
    needs: { water: 4, power: 5, trash: 3 },
    model: suburban('building-type-p'),
    placeholder: { shape: 'house', color: '#f4f4f4', accent: '#4b5060', height: 1.2 },
  },
  {
    id: 'bakery',
    name: 'Bakery',
    category: 'business',
    size: { x: 2, z: 2 },
    cost: 300,
    unlockLevel: 2,
    income: { coins: 40, seconds: 45 },
    needs: { water: 2, power: 3, trash: 2 },
    placeholder: { shape: 'shop', color: '#f6e7c8', accent: '#d9822b', height: 1 },
  },
  {
    id: 'general-store',
    name: 'General Store',
    category: 'business',
    size: { x: 3, z: 2 },
    cost: 500,
    unlockLevel: 5,
    income: { coins: 75, seconds: 90 },
    needs: { water: 2, power: 4, trash: 3 },
    placeholder: { shape: 'shop', color: '#e3e3e3', accent: '#3a8f5c', height: 1.2 },
  },
  {
    // A plowed plot to plant crops on (crops.ts). It earns nothing by itself.
    id: 'farm-plot',
    name: 'Farm Plot',
    category: 'farm',
    size: { x: 2, z: 2 },
    cost: 50,
    unlockLevel: 1,
    needs: { water: 2 }, // irrigation
    placeholder: { shape: 'field', color: '#8a5a36', accent: '#6e4529', height: 0.06 },
  },
  {
    id: 'oak-tree',
    name: 'Oak Tree',
    category: 'decoration',
    size: { x: 1, z: 1 },
    cost: 20,
    unlockLevel: 1,
    model: suburban('tree-large'),
    placeholder: { shape: 'tree', color: '#7a5233', accent: '#3f8f3a', height: 1 },
  },
  {
    id: 'pine-tree',
    name: 'Pine Tree',
    category: 'decoration',
    size: { x: 1, z: 1 },
    cost: 15,
    unlockLevel: 1,
    model: suburban('tree-small'),
    placeholder: { shape: 'tree', color: '#7a5233', accent: '#2f7a4f', height: 1 },
  },
  {
    id: 'planter',
    name: 'Planter',
    category: 'decoration',
    size: { x: 1, z: 1 },
    cost: 30,
    unlockLevel: 2,
    model: suburban('planter'),
    placeholder: { shape: 'tree', color: '#5b5f6b', accent: '#3f8f3a', height: 0.5 },
  },
  // ---- Utilities. Building one costs coins once; running it costs coins every
  // game month. Real towns face the same choice between cheap-to-build,
  // expensive-to-run plants and the reverse (compare the power plant and solar farm).
  {
    id: 'water-tower',
    name: 'Water Tower',
    category: 'utility',
    size: { x: 2, z: 2 },
    cost: 250,
    unlockLevel: 2,
    supplies: { utility: 'water', amount: 20 },
    upkeep: 15,
    recoveryYears: 25, // water utility property
    placeholder: { shape: 'tower', color: '#8fb8d8', accent: '#5b7f9e', height: 2 },
  },
  {
    id: 'power-plant',
    name: 'Power Plant',
    category: 'utility',
    size: { x: 3, z: 2 },
    cost: 500,
    unlockLevel: 3,
    supplies: { utility: 'power', amount: 30 },
    upkeep: 30, // fuel makes it expensive to run
    recoveryYears: 20, // electric utility steam production plant
    placeholder: { shape: 'plant', color: '#b9b4ab', accent: '#d9a441', height: 1.1 },
  },
  {
    id: 'recycling-center',
    name: 'Recycling Center',
    category: 'utility',
    size: { x: 2, z: 2 },
    cost: 300,
    unlockLevel: 3,
    supplies: { utility: 'trash', amount: 20 },
    upkeep: 20,
    recoveryYears: 7, // waste reduction and resource recovery plants
    placeholder: { shape: 'recycling', color: '#5e9e6e', accent: '#2f6f8f', height: 0.9 },
  },
  {
    id: 'solar-farm',
    name: 'Solar Farm',
    category: 'utility',
    size: { x: 3, z: 3 },
    cost: 1200,
    unlockLevel: 6,
    supplies: { utility: 'power', amount: 25 },
    upkeep: 5, // no fuel: cheap to run
    recoveryYears: 5, // solar energy property gets a short 5-year period
    placeholder: { shape: 'solar', color: '#2c3e66', accent: '#c9ccd2', height: 0.5 },
  },
  // ---- Roads and community buildings
  {
    // Drawn by dragging. Its look depends on which neighbors are roads too (CityView).
    id: 'road',
    name: 'Road',
    category: 'road',
    size: { x: 1, z: 1 },
    cost: 10,
    unlockLevel: 1,
    placeholder: { shape: 'road', color: '#5d6168', accent: '#f2f2f2', height: 0.03 },
  },
  {
    id: 'park',
    name: 'Park',
    category: 'community',
    size: { x: 2, z: 2 },
    cost: 200,
    unlockLevel: 3,
    needs: { water: 1 },
    upkeep: 5,
    amenity: { bonus: 0.1, radius: 4 },
    recoveryYears: 15, // land improvements
    placeholder: { shape: 'park', color: '#6fbf5a', accent: '#d9c79a', height: 0.6 },
  },
  {
    id: 'fire-station',
    name: 'Fire Station',
    category: 'community',
    size: { x: 2, z: 2 },
    cost: 600,
    unlockLevel: 4,
    needs: { water: 2, power: 2, trash: 1 },
    upkeep: 20,
    amenity: { bonus: 0.1, radius: 6 },
    placeholder: { shape: 'firestation', color: '#c8463a', accent: '#f0e6d8', height: 1.1 },
  },
  {
    id: 'school',
    name: 'School',
    category: 'community',
    size: { x: 3, z: 2 },
    cost: 900,
    unlockLevel: 5,
    needs: { water: 3, power: 3, trash: 2 },
    upkeep: 30,
    amenity: { bonus: 0.15, radius: 6 },
    placeholder: { shape: 'school', color: '#e2c08d', accent: '#a0473b', height: 1.2 },
  },
]

export const BUILDINGS_BY_ID = new Map(BUILDING_TYPES.map((b) => [b.id, b]))

// Ids that were renamed, so old saves still load. Saves store a building's
// type id, so renaming an id without this would silently drop those buildings.
export const RENAMED_BUILDING_IDS: Record<string, string> = {
  'wheat-field': 'farm-plot', // Stage 4: the fixed wheat field became a plot you plant
}
