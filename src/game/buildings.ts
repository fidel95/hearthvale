// The building catalog. Everything the game knows about a kind of building
// lives here as plain data, so adding a building means adding an entry,
// not writing new code.

export type Category = 'home' | 'business' | 'farm' | 'decoration'

export type PlaceholderShape = 'house' | 'shop' | 'field' | 'tree'

export interface BuildingType {
  id: string
  name: string
  category: Category
  size: { x: number; z: number } // footprint in tiles
  cost: number
  // Coins this building pays out every `seconds`. Homes collect rent, businesses earn sales.
  income?: { coins: number; seconds: number }
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
    income: { coins: 15, seconds: 30 },
    model: suburban('building-type-g'),
    placeholder: { shape: 'house', color: '#f2d7b0', accent: '#c4553f', height: 0.9 },
  },
  {
    id: 'townhouse',
    name: 'Townhouse',
    category: 'home',
    size: { x: 2, z: 2 },
    cost: 250,
    income: { coins: 35, seconds: 60 },
    model: suburban('building-type-k'),
    placeholder: { shape: 'house', color: '#c9d8e8', accent: '#4a5d7a', height: 1.6 },
  },
  {
    id: 'family-house',
    name: 'Family House',
    category: 'home',
    size: { x: 2, z: 2 },
    cost: 400,
    income: { coins: 50, seconds: 90 },
    model: suburban('building-type-a'),
    placeholder: { shape: 'house', color: '#f4f4f4', accent: '#3fae6b', height: 1.2 },
  },
  {
    id: 'modern-house',
    name: 'Modern House',
    category: 'home',
    size: { x: 2, z: 2 },
    cost: 600,
    income: { coins: 80, seconds: 120 },
    model: suburban('building-type-p'),
    placeholder: { shape: 'house', color: '#f4f4f4', accent: '#4b5060', height: 1.2 },
  },
  {
    id: 'bakery',
    name: 'Bakery',
    category: 'business',
    size: { x: 2, z: 2 },
    cost: 300,
    income: { coins: 40, seconds: 45 },
    placeholder: { shape: 'shop', color: '#f6e7c8', accent: '#d9822b', height: 1 },
  },
  {
    id: 'general-store',
    name: 'General Store',
    category: 'business',
    size: { x: 3, z: 2 },
    cost: 500,
    income: { coins: 75, seconds: 90 },
    placeholder: { shape: 'shop', color: '#e3e3e3', accent: '#3a8f5c', height: 1.2 },
  },
  {
    // A plowed plot to plant crops on (crops.ts). It earns nothing by itself.
    id: 'farm-plot',
    name: 'Farm Plot',
    category: 'farm',
    size: { x: 2, z: 2 },
    cost: 50,
    placeholder: { shape: 'field', color: '#8a5a36', accent: '#6e4529', height: 0.06 },
  },
  {
    id: 'oak-tree',
    name: 'Oak Tree',
    category: 'decoration',
    size: { x: 1, z: 1 },
    cost: 20,
    model: suburban('tree-large'),
    placeholder: { shape: 'tree', color: '#7a5233', accent: '#3f8f3a', height: 1 },
  },
  {
    id: 'pine-tree',
    name: 'Pine Tree',
    category: 'decoration',
    size: { x: 1, z: 1 },
    cost: 15,
    model: suburban('tree-small'),
    placeholder: { shape: 'tree', color: '#7a5233', accent: '#2f7a4f', height: 1 },
  },
  {
    id: 'planter',
    name: 'Planter',
    category: 'decoration',
    size: { x: 1, z: 1 },
    cost: 30,
    model: suburban('planter'),
    placeholder: { shape: 'tree', color: '#5b5f6b', accent: '#3f8f3a', height: 0.5 },
  },
]

export const BUILDINGS_BY_ID = new Map(BUILDING_TYPES.map((b) => [b.id, b]))

// Ids that were renamed, so old saves still load. Saves store a building's
// type id, so renaming an id without this would silently drop those buildings.
export const RENAMED_BUILDING_IDS: Record<string, string> = {
  'wheat-field': 'farm-plot', // Stage 4: the fixed wheat field became a plot you plant
}
