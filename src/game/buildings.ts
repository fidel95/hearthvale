import type { FactoryRecipe, ProductId } from './products'
// The building catalog. Everything the game knows about a kind of building
// lives here as plain data, so adding a building means adding an entry,
// not writing new code.

import type { Materials } from './items'
import type { Utility } from './utilityRules'

export type RoadStyle = 'dirt' | 'asphalt' | 'cobble' | 'avenue'

export type Category =
  | 'home'
  | 'business'
  | 'farm'
  | 'decoration'
  | 'utility'
  | 'community'
  | 'road'
  | 'storage'
  | 'port'
  | 'landmark'
  | 'rail' // railway track and the train station
  | 'air' // the airport
  | 'industry' // factories (products.ts)

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
  | 'barn'
  | 'warehouse'
  | 'dock'
  | 'flowers'
  | 'bench'
  | 'fountain'
  | 'statue'
  | 'library'
  | 'townhall'
  | 'clocktower'
  | 'lighthouse'
  | 'garden'
  | 'busstop'
  | 'armybase'
  | 'rail'
  | 'station'
  | 'airport'
  | 'beach'
  | 'playground'
  | 'sportsfield'
  | 'bigpark'
  | 'skiresort'
  | 'mine'
  | 'landfill'
  | 'pen'
  | 'arch'
  | 'cart'
  | 'pumpkins'
  | 'fir'
  | 'factory'
  | 'apartment'
  | 'hospital'
  | 'police'
  | 'mall'
  | 'lamp'
  | 'hedge'
  | 'gazebo'
  | 'lodge'
  | 'cablecar'
  | 'tunnel'
  | 'spaceport'
  | 'pond'
  | 'orchard'
  | 'bakery'
  | 'dairy'
  | 'winery'
  | 'market'
  | 'tractorshed'

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
  // Laid in lines by dragging, like roads (garden paths, hedges, flower beds).
  drawn?: boolean
  // Room for this many more residents in town (see utilityRules.ts, population capacity).
  populationCapacity?: number
  // Walkers like to visit, and linger this many seconds (PeopleView).
  attractsVisitors?: { lingerSeconds: number }
  // Experience for building it; without this it's worked out from the cost (progression.ts buildXp).
  xpReward?: number
  // Shops: goods used up by each sale (they can't sell without them), and how
  // many goods their shelves hold (filled from town storage by restocking).
  goodsPerSale?: number // units of what it sells (goods, or its product)
  sells?: ProductId // a specialty shop: sells this product instead of goods
  // A factory: each batch takes `input` goods (or a farm workshop's `recipe`
  // of products) and makes `output` of a product.
  factory?: FactoryRecipe
  stockCapacity?: number
  // Bigger buildings take time to build and need materials to finish
  // (construction.ts). Without this, a building is ready the moment it's placed.
  build?: { seconds: number; materials?: Materials }
  // Room for this many more goods in the town's storage.
  storage?: number
  // Landmarks: only one of each, a minimum city rating to build it, and a
  // town-wide bonus to all rent and sales (and, for the Lighthouse, faster ships).
  unique?: boolean
  minRating?: number
  townBonus?: number
  shipSpeedBonus?: number
  // Needs a road touching one side of its footprint to work (shops: customers
  // have to get there). See City.hasRoadAccess.
  requiresRoad?: boolean
  // Tourism (Tourism.ts): visitors this brings to town each month (transport),
  // and visitors it has room for (attractions).
  arrivals?: number
  visitors?: number
  // Shops: residents they need living nearby for full sales (demand.ts).
  customers?: number
  // How tall its model may stand, in tiles per tile of footprint (default 1.2;
  // a tall pine gets more).
  heightLimit?: number
  // Animal pens: which animals live here and how many (AnimalView draws them).
  animals?: { kind: 'chicken' | 'pig' | 'sheep' | 'cow'; count: number }
  // Pens and orchards: farm products each collection puts in town storage (products.ts).
  produce?: { product: ProductId; units: number }
  // Needs railway track touching one side to work (the train station).
  requiresRail?: boolean
  // Must be built on the shore, next to the sea (docks).
  onShore?: boolean
  // Must be built at the foot of a Highlands mountain (terrain.ts).
  nearMountain?: boolean
  // Depreciation period in years, when it differs from its category's (taxRules.ts).
  recoveryYears?: number
  // A festival prize (eventData.ts): never sold in the build menu; says where it was won.
  prize?: string
  // How to draw it when there's no model (or the model fails to load).
  placeholder: { shape: PlaceholderShape; color: string; accent: string; height: number }
  // Roads: how much they add to homes and shops beside them, and how they're
  // drawn (RoadView). Every kind of road joins up with every other.
  road?: { bonus: number; style: RoadStyle }
  // URL of a .glb model, e.g. suburban('building-type-a'). Optional: without it we draw the placeholder.
  model?: string
}

// Models live in public/models/. BASE_URL is '/' in dev but may be a
// subfolder once deployed (Stage 12), so build URLs from it instead of hardcoding '/'.
const suburban = (name: string) => `${import.meta.env.BASE_URL}models/suburban/${name}.glb`
// Kenney's Mini Forest pack (CC0): pines, rocks and stones.
export const forest = (name: string) => `${import.meta.env.BASE_URL}models/forest/${name}.glb`
// Kenney's Nature Kit, CC0: trees, bushes, flowers, rocks and more.
export const nature = (name: string) => `${import.meta.env.BASE_URL}models/nature/${name}.glb`
// Kenney's City Kit (Commercial) and (Industrial), CC0: shops, apartments, factories and utilities.
const commercial = (name: string) => `${import.meta.env.BASE_URL}models/commercial/${name}.glb`
const industrial = (name: string) => `${import.meta.env.BASE_URL}models/industrial/${name}.glb`

export const BUILDING_TYPES: BuildingType[] = [
  // ---- Industry: factories turn goods into products for specialty shops.
  {
    id: 'coal-mine',
    name: 'Coal Mine',
    category: 'industry',
    size: { x: 4, z: 4 },
    cost: 1200,
    unlockLevel: 12,
    requiresRoad: true,
    build: { seconds: 150, materials: { steel: 3, lumber: 2 } },
    income: { coins: 150, seconds: 300 },
    needs: { power: 3, water: 2 },
    placeholder: { shape: 'mine', color: '#a4825c', accent: '#262322', height: 0.35 },
  },
  {
    id: 'cannery',
    name: 'Cannery',
    category: 'industry',
    size: { x: 3, z: 2 },
    cost: 600,
    unlockLevel: 12,
    requiresRoad: true,
    build: { seconds: 90, materials: { bricks: 4, steel: 1 } },
    factory: { product: 'preserves', input: 10, output: 5, seconds: 60 },
    needs: { water: 4, power: 4, trash: 3 },
    model: industrial('building-c'),
    placeholder: { shape: 'factory', color: '#d9cbb0', accent: '#c4483a', height: 1.1 },
  },
  {
    id: 'textile-mill',
    name: 'Textile Mill',
    category: 'industry',
    size: { x: 3, z: 3 },
    cost: 900,
    unlockLevel: 13,
    requiresRoad: true,
    build: { seconds: 150, materials: { bricks: 6, steel: 2, glass: 2 } },
    factory: { product: 'clothes', input: 15, output: 5, seconds: 90 },
    needs: { water: 5, power: 6, trash: 3 },
    model: industrial('building-m'),
    placeholder: { shape: 'factory', color: '#c9d6e3', accent: '#5a6fa8', height: 1.3 },
  },
  {
    id: 'furniture-workshop',
    name: 'Furniture Workshop',
    category: 'industry',
    size: { x: 3, z: 2 },
    cost: 1100,
    unlockLevel: 16,
    requiresRoad: true,
    build: { seconds: 180, materials: { lumber: 8, steel: 2 } },
    factory: { product: 'furniture', input: 20, output: 5, seconds: 120 },
    needs: { water: 2, power: 6, trash: 4 },
    model: industrial('building-h'),
    placeholder: { shape: 'factory', color: '#d8b98c', accent: '#7a5233', height: 1.1 },
  },
  // ---- Specialty shops: they sell a factory's product, and earn more for it.
  {
    id: 'deli',
    name: 'Deli',
    category: 'business',
    size: { x: 2, z: 2 },
    cost: 520,
    unlockLevel: 12,
    requiresRoad: true,
    build: { seconds: 60, materials: { bricks: 2, glass: 2 } },
    income: { coins: 80, seconds: 60 },
    goodsPerSale: 3,
    sells: 'preserves',
    stockCapacity: 24,
    needs: { water: 2, power: 3, trash: 2 },
    customers: 8,
    model: commercial('building-b'),
    placeholder: { shape: 'shop', color: '#f6e7c8', accent: '#3f8f3a', height: 1 },
  },
  {
    id: 'clothing-store',
    name: 'Clothing Store',
    category: 'business',
    size: { x: 2, z: 2 },
    cost: 800,
    unlockLevel: 13,
    requiresRoad: true,
    build: { seconds: 120, materials: { glass: 4, bricks: 2 } },
    income: { coins: 135, seconds: 90 },
    goodsPerSale: 3,
    sells: 'clothes',
    stockCapacity: 24,
    needs: { water: 1, power: 4, trash: 2 },
    customers: 10,
    model: commercial('building-h'),
    placeholder: { shape: 'shop', color: '#efe1f5', accent: '#8e44ad', height: 1.1 },
  },
  {
    id: 'furniture-store',
    name: 'Furniture Store',
    category: 'business',
    size: { x: 3, z: 2 },
    cost: 1000,
    unlockLevel: 16,
    requiresRoad: true,
    build: { seconds: 150, materials: { lumber: 4, glass: 4 } },
    income: { coins: 165, seconds: 120 },
    goodsPerSale: 2,
    sells: 'furniture',
    stockCapacity: 16,
    needs: { water: 1, power: 3, trash: 3 },
    customers: 12,
    model: commercial('building-j'),
    placeholder: { shape: 'shop', color: '#f3e3cf', accent: '#8a5a36', height: 1.1 },
  },

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
    build: { seconds: 60, materials: { lumber: 3 } },
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
    build: { seconds: 120, materials: { bricks: 4, lumber: 4 } },
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
    unlockLevel: 11,
    build: { seconds: 180, materials: { bricks: 4, glass: 4, steel: 2 } },
    income: { coins: 80, seconds: 120 },
    residents: 4,
    needs: { water: 4, power: 5, trash: 3 },
    model: suburban('building-type-p'),
    placeholder: { shape: 'house', color: '#f4f4f4', accent: '#4b5060', height: 1.2 },
  },  {
    id: 'bungalow',
    name: 'Bungalow',
    category: 'home',
    size: { x: 2, z: 2 },
    cost: 180,
    unlockLevel: 2,
    income: { coins: 24, seconds: 45 },
    residents: 2,
    needs: { water: 2, power: 2, trash: 2 },
    model: suburban('building-type-h'),
    placeholder: { shape: 'house', color: '#f0e2c4', accent: '#7a8f4e', height: 0.8 },
  },
  {
    id: 'duplex',
    name: 'Duplex',
    category: 'home',
    size: { x: 2, z: 2 },
    cost: 330,
    unlockLevel: 5,
    build: { seconds: 90, materials: { bricks: 3, lumber: 3 } },
    income: { coins: 42, seconds: 75 },
    residents: 4,
    needs: { water: 4, power: 3, trash: 4 },
    model: suburban('building-type-c'),
    placeholder: { shape: 'house', color: '#e6e1d8', accent: '#5c7d9e', height: 1.4 },
  },
  {
    // Solar panels on the roof: it uses less power from the town than other homes.
    id: 'eco-house',
    name: 'Eco House',
    category: 'home',
    size: { x: 2, z: 2 },
    cost: 480,
    unlockLevel: 8,
    build: { seconds: 120, materials: { glass: 4, steel: 2 } },
    income: { coins: 60, seconds: 100 },
    residents: 4,
    needs: { water: 3, power: 1, trash: 3 },
    model: suburban('building-type-b'),
    placeholder: { shape: 'house', color: '#f2efe6', accent: '#2c3e66', height: 1.3 },
  },
  {
    id: 'villa',
    name: 'Villa',
    category: 'home',
    size: { x: 2, z: 2 },
    cost: 560,
    unlockLevel: 9,
    build: { seconds: 150, materials: { bricks: 4, lumber: 4, glass: 3 } },
    income: { coins: 70, seconds: 110 },
    residents: 5,
    needs: { water: 5, power: 4, trash: 4 },
    model: suburban('building-type-n'),
    placeholder: { shape: 'house', color: '#f6efe3', accent: '#b5543c', height: 1.2 },
  },
  {
    id: 'manor',
    name: 'Manor',
    category: 'home',
    size: { x: 2, z: 2 },
    cost: 900,
    unlockLevel: 12,
    build: { seconds: 240, materials: { bricks: 8, glass: 6, steel: 2 } },
    income: { coins: 120, seconds: 180 },
    residents: 6,
    needs: { water: 6, power: 6, trash: 5 },
    model: suburban('building-type-t'),
    placeholder: { shape: 'house', color: '#f4f0e8', accent: '#3a6b4a', height: 1.6 },
  },
  {
    // Apartments: lots of residents on a small lot. Big buildings want a
    // hospital and a police station nearby, as well as shops and parks (needs.ts).
    id: 'apartment-block',
    name: 'Apartment Block',
    category: 'home',
    size: { x: 2, z: 2 },
    cost: 1300,
    unlockLevel: 14,
    build: { seconds: 300, materials: { bricks: 10, glass: 8, steel: 4 } },
    income: { coins: 175, seconds: 210 },
    residents: 16,
    needs: { water: 10, power: 10, trash: 8 },
    heightLimit: 2.4,
    model: commercial('building-l'),
    placeholder: { shape: 'apartment', color: '#e8d2b8', accent: '#8a5a44', height: 2.2 },
  },
  {
    id: 'high-rise',
    name: 'High-Rise',
    category: 'home',
    size: { x: 2, z: 2 },
    cost: 2000,
    unlockLevel: 17,
    build: { seconds: 480, materials: { glass: 14, steel: 10, bricks: 6 } },
    income: { coins: 250, seconds: 240 },
    residents: 28,
    needs: { water: 14, power: 16, trash: 12 },
    heightLimit: 3.6,
    model: commercial('building-m'),
    placeholder: { shape: 'apartment', color: '#c9d9e6', accent: '#3d5a75', height: 3.4 },
  },

  {
    id: 'bakery',
    name: 'Bakery',
    category: 'business',
    size: { x: 2, z: 2 },
    cost: 300,
    unlockLevel: 2,
    requiresRoad: true,
    income: { coins: 40, seconds: 45 },
    goodsPerSale: 4,
    stockCapacity: 40,
    needs: { water: 2, power: 3, trash: 2 },
    customers: 6,
    model: commercial('building-a'),
    placeholder: { shape: 'shop', color: '#ffe3a8', accent: '#ff7a2f', height: 1 },
  },
  {
    id: 'general-store',
    name: 'General Store',
    category: 'business',
    size: { x: 3, z: 2 },
    cost: 500,
    unlockLevel: 8,
    requiresRoad: true,
    build: { seconds: 120, materials: { lumber: 4, glass: 2 } },
    income: { coins: 75, seconds: 90 },
    goodsPerSale: 7,
    stockCapacity: 70,
    needs: { water: 2, power: 4, trash: 3 },
    customers: 10,
    model: commercial('building-e'),
    placeholder: { shape: 'shop', color: '#dff0ff', accent: '#22a85a', height: 1.2 },
  },  {
    id: 'cafe',
    name: 'Café',
    category: 'business',
    size: { x: 2, z: 2 },
    cost: 380,
    unlockLevel: 4,
    requiresRoad: true,
    build: { seconds: 60, materials: { bricks: 2, lumber: 2 } },
    income: { coins: 52, seconds: 60 },
    goodsPerSale: 5,
    stockCapacity: 40,
    needs: { water: 3, power: 2, trash: 2 },
    customers: 8,
    model: commercial('building-c'),
    placeholder: { shape: 'shop', color: '#ffd9c4', accent: '#b8432f', height: 0.9 },
  },
  {
    id: 'flower-shop',
    name: 'Flower Shop',
    category: 'business',
    size: { x: 2, z: 2 },
    cost: 450,
    unlockLevel: 6,
    requiresRoad: true,
    build: { seconds: 90, materials: { lumber: 3, glass: 2 } },
    income: { coins: 62, seconds: 75 },
    goodsPerSale: 6,
    stockCapacity: 48,
    needs: { water: 4, power: 2, trash: 1 },
    customers: 8,
    model: commercial('building-d'),
    placeholder: { shape: 'shop', color: '#ffd6ea', accent: '#e8408f', height: 1 },
  },
  {
    id: 'restaurant',
    name: 'Restaurant',
    category: 'business',
    size: { x: 3, z: 2 },
    cost: 700,
    unlockLevel: 10,
    requiresRoad: true,
    build: { seconds: 180, materials: { bricks: 6, glass: 3, steel: 1 } },
    income: { coins: 110, seconds: 120 },
    goodsPerSale: 10,
    stockCapacity: 80,
    needs: { water: 5, power: 4, trash: 4 },
    customers: 14,
    model: commercial('building-k'),
    placeholder: { shape: 'shop', color: '#fff0c4', accent: '#d62f2f', height: 1.2 },
  },
  {
    id: 'supermarket',
    name: 'Supermarket',
    category: 'business',
    size: { x: 3, z: 3 },
    cost: 1100,
    unlockLevel: 12,
    requiresRoad: true,
    build: { seconds: 300, materials: { steel: 6, glass: 6, bricks: 6 } },
    income: { coins: 160, seconds: 150 },
    goodsPerSale: 14,
    stockCapacity: 120,
    needs: { water: 4, power: 8, trash: 6 },
    customers: 20,
    model: commercial('building-i'),
    placeholder: { shape: 'shop', color: '#d8f4ff', accent: '#1f7fe0', height: 1.3 },
  },  {
    id: 'shopping-center',
    name: 'Shopping Center',
    category: 'business',
    size: { x: 4, z: 3 },
    cost: 3400,
    unlockLevel: 15,
    requiresRoad: true,
    build: { seconds: 420, materials: { steel: 8, glass: 10, bricks: 8 } },
    income: { coins: 290, seconds: 180 },
    goodsPerSale: 18,
    stockCapacity: 160,
    needs: { water: 5, power: 10, trash: 8 },
    customers: 30,
    attractsVisitors: { lingerSeconds: 10 },
    visitors: 15,
    model: commercial('building-n'),
    placeholder: { shape: 'mall', color: '#f2ece2', accent: '#e0663a', height: 1.3 },
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
    amenity: { bonus: 0.02, radius: 1 },
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
    amenity: { bonus: 0.01, radius: 1 },
    model: forest('tree'),
    placeholder: { shape: 'tree', color: '#7a5233', accent: '#2f7a4f', height: 1 },
  },
  {
    id: 'tall-pine',
    name: 'Tall Pine',
    category: 'decoration',
    size: { x: 1, z: 1 },
    cost: 25,
    unlockLevel: 2,
    amenity: { bonus: 0.02, radius: 1 },
    heightLimit: 2,
    model: forest('tree-high'),
    placeholder: { shape: 'tree', color: '#7a5233', accent: '#2f7a4f', height: 1.5 },
  },
  {
    id: 'stone-pile',
    name: 'Stone Pile',
    category: 'decoration',
    size: { x: 1, z: 1 },
    cost: 15,
    unlockLevel: 2,
    amenity: { bonus: 0.01, radius: 1 },
    model: forest('stones'),
    placeholder: { shape: 'statue', color: '#9a8f86', accent: '#9a8f86', height: 0.3 },
  },
  {
    id: 'boulders',
    name: 'Boulders',
    category: 'decoration',
    size: { x: 1, z: 1 },
    cost: 40,
    unlockLevel: 4,
    amenity: { bonus: 0.03, radius: 1 },
    model: forest('rocks-low'),
    placeholder: { shape: 'statue', color: '#7d7f9a', accent: '#7d7f9a', height: 0.5 },
  },
  {
    id: 'leafy-tree',
    name: 'Leafy Tree',
    category: 'decoration',
    size: { x: 1, z: 1 },
    cost: 20,
    unlockLevel: 1,
    amenity: { bonus: 0.02, radius: 1 },
    model: nature('tree_default'),
    placeholder: { shape: 'tree', color: '#7a5233', accent: '#4caf50', height: 1 },
  },
  {
    id: 'round-tree',
    name: 'Round Tree',
    category: 'decoration',
    size: { x: 1, z: 1 },
    cost: 20,
    unlockLevel: 2,
    amenity: { bonus: 0.02, radius: 1 },
    model: nature('tree_fat'),
    placeholder: { shape: 'tree', color: '#7a5233', accent: '#3f9a45', height: 1 },
  },
  {
    id: 'autumn-oak',
    name: 'Autumn Oak',
    category: 'decoration',
    size: { x: 1, z: 1 },
    cost: 30,
    unlockLevel: 3,
    amenity: { bonus: 0.02, radius: 1 },
    model: nature('tree_oak_fall'),
    placeholder: { shape: 'tree', color: '#7a5233', accent: '#f5a742', height: 1 },
  },
  {
    id: 'golden-birch',
    name: 'Golden Birch',
    category: 'decoration',
    size: { x: 1, z: 1 },
    cost: 30,
    unlockLevel: 4,
    amenity: { bonus: 0.02, radius: 1 },
    model: nature('tree_default_fall'),
    placeholder: { shape: 'tree', color: '#f4efe6', accent: '#f5a742', height: 1.2 },
  },
  {
    id: 'palm-tree',
    name: 'Palm Tree',
    category: 'decoration',
    size: { x: 1, z: 1 },
    cost: 35,
    unlockLevel: 5,
    amenity: { bonus: 0.03, radius: 1 },
    heightLimit: 1.6,
    model: nature('tree_palmTall'),
    placeholder: { shape: 'tree', color: '#8a5a36', accent: '#3f9a45', height: 1.3 },
  },
  {
    id: 'bush',
    name: 'Bush',
    category: 'decoration',
    size: { x: 1, z: 1 },
    cost: 10,
    unlockLevel: 1,
    amenity: { bonus: 0.01, radius: 1 },
    model: nature('plant_bushLarge'),
    placeholder: { shape: 'hedge', color: '#3f8f3a', accent: '#2e6e2b', height: 0.3 },
  },
  {
    id: 'log-pile',
    name: 'Log Pile',
    category: 'decoration',
    size: { x: 1, z: 1 },
    cost: 15,
    unlockLevel: 2,
    amenity: { bonus: 0.01, radius: 1 },
    model: nature('log_stackLarge'),
    placeholder: { shape: 'bench', color: '#8a5a36', accent: '#f5d7bb', height: 0.3 },
  },
  {
    id: 'stone-column',
    name: 'Stone Column',
    category: 'decoration',
    size: { x: 1, z: 1 },
    cost: 120,
    unlockLevel: 6,
    amenity: { bonus: 0.04, radius: 2 },
    model: nature('statue_column'),
    placeholder: { shape: 'statue', color: '#b9c4c8', accent: '#b9c4c8', height: 1 },
  },
  {
    id: 'obelisk',
    name: 'Obelisk',
    category: 'decoration',
    size: { x: 1, z: 1 },
    cost: 300,
    unlockLevel: 9,
    amenity: { bonus: 0.07, radius: 3 },
    heightLimit: 1.6,
    visitors: 1,
    model: nature('statue_obelisk'),
    placeholder: { shape: 'statue', color: '#9aaab0', accent: '#9aaab0', height: 1.2 },
  },
  {
    id: 'planter',
    name: 'Planter',
    category: 'decoration',
    size: { x: 1, z: 1 },
    cost: 30,
    unlockLevel: 3,
    amenity: { bonus: 0.03, radius: 1 },
    model: suburban('planter'),
    placeholder: { shape: 'tree', color: '#5b5f6b', accent: '#3f8f3a', height: 0.5 },
  },  {
    id: 'flower-bed',
    name: 'Flower Bed',
    category: 'decoration',
    size: { x: 1, z: 1 },
    cost: 25,
    unlockLevel: 2,
    drawn: true,
    amenity: { bonus: 0.02, radius: 1 },
    placeholder: { shape: 'flowers', color: '#7a5233', accent: '#e8579a', height: 0.3 },
  },
  {
    id: 'stone-path',
    name: 'Stone Path',
    category: 'decoration',
    size: { x: 1, z: 1 },
    cost: 15,
    unlockLevel: 2,
    drawn: true,
    amenity: { bonus: 0.01, radius: 0 },
    model: suburban('path-stones-short'),
    placeholder: { shape: 'road', color: '#9a9a94', accent: '#cfccc4', height: 0.03 },
  },
  {
    id: 'picket-fence',
    name: 'Picket Fence',
    category: 'decoration',
    size: { x: 1, z: 2 },
    cost: 20,
    unlockLevel: 4,
    amenity: { bonus: 0.01, radius: 1 },
    model: suburban('fence-1x2'),
    placeholder: { shape: 'bench', color: '#c9874f', accent: '#c9874f', height: 0.3 },
  },
  {
    id: 'bench',
    name: 'Bench',
    category: 'decoration',
    size: { x: 1, z: 1 },
    cost: 40,
    unlockLevel: 5,
    amenity: { bonus: 0.03, radius: 2 },
    placeholder: { shape: 'bench', color: '#8a6a4a', accent: '#3b3b3b', height: 0.25 },
  },  {
    id: 'lamp-post',
    name: 'Lamp Post',
    category: 'decoration',
    size: { x: 1, z: 1 },
    cost: 20,
    unlockLevel: 3,
    amenity: { bonus: 0.02, radius: 1 },
    placeholder: { shape: 'lamp', color: '#3b3f46', accent: '#ffe08a', height: 0.9 },
  },
  {
    id: 'hedge',
    name: 'Hedge',
    category: 'decoration',
    size: { x: 1, z: 1 },
    cost: 15,
    unlockLevel: 3,
    drawn: true,
    amenity: { bonus: 0.01, radius: 1 },
    placeholder: { shape: 'hedge', color: '#3f8f3a', accent: '#2e6e2b', height: 0.35 },
  },
  {
    id: 'gazebo',
    name: 'Gazebo',
    category: 'decoration',
    size: { x: 2, z: 2 },
    cost: 140,
    unlockLevel: 7,
    amenity: { bonus: 0.05, radius: 2 },
    placeholder: { shape: 'gazebo', color: '#f4efe6', accent: '#b8432f', height: 1.1 },
  },
  {
    id: 'pond',
    name: 'Duck Pond',
    category: 'decoration',
    size: { x: 2, z: 2 },
    cost: 160,
    unlockLevel: 8,
    amenity: { bonus: 0.05, radius: 3 },
    visitors: 3,
    placeholder: { shape: 'pond', color: '#4fa3d9', accent: '#8a6a4a', height: 0.15 },
  },

  {
    id: 'fountain',
    name: 'Fountain',
    category: 'decoration',
    size: { x: 2, z: 2 },
    cost: 250,
    unlockLevel: 7,
    amenity: { bonus: 0.06, radius: 3 },
    attractsVisitors: { lingerSeconds: 6 },
    visitors: 2,
    placeholder: { shape: 'fountain', color: '#c9c6bd', accent: '#6fb7e0', height: 0.6 },
  },
  {
    id: 'statue',
    name: 'Statue',
    category: 'decoration',
    size: { x: 1, z: 1 },
    cost: 400,
    unlockLevel: 10,
    amenity: { bonus: 0.08, radius: 4 },
    visitors: 2,
    placeholder: { shape: 'statue', color: '#b9b4ab', accent: '#d9a441', height: 1.2 },
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
    unlockLevel: 4,
    build: { seconds: 90, materials: { steel: 4 } },
    supplies: { utility: 'water', amount: 20 },
    upkeep: 15,
    recoveryYears: 25, // water utility property
    model: industrial('water-tower'),
    placeholder: { shape: 'tower', color: '#8fb8d8', accent: '#5b7f9e', height: 2 },
  },
  {
    id: 'power-plant',
    name: 'Power Plant',
    category: 'utility',
    size: { x: 3, z: 2 },
    cost: 500,
    unlockLevel: 4,
    build: { seconds: 180, materials: { steel: 6, bricks: 4 } },
    supplies: { utility: 'power', amount: 30 },
    upkeep: 30, // fuel makes it expensive to run
    recoveryYears: 20, // electric utility steam production plant
    model: industrial('building-f'),
    placeholder: { shape: 'plant', color: '#b9b4ab', accent: '#d9a441', height: 1.1 },
  },
  {
    id: 'landfill',
    name: 'Landfill',
    category: 'utility',
    size: { x: 3, z: 3 },
    cost: 200,
    unlockLevel: 6,
    build: { seconds: 90, materials: { lumber: 2 } },
    supplies: { utility: 'trash', amount: 30 },
    upkeep: 12,
    recoveryYears: 15, // land improvements
    placeholder: { shape: 'landfill', color: '#7d6a52', accent: '#7da35a', height: 0.3 },
  },
  {
    id: 'recycling-center',
    name: 'Recycling Center',
    category: 'utility',
    size: { x: 2, z: 2 },
    cost: 300,
    unlockLevel: 4,
    build: { seconds: 120, materials: { steel: 3, bricks: 3 } },
    supplies: { utility: 'trash', amount: 20 },
    upkeep: 20,
    recoveryYears: 7, // waste reduction and resource recovery plants
    model: industrial('building-t'),
    placeholder: { shape: 'recycling', color: '#5e9e6e', accent: '#2f6f8f', height: 0.9 },
  },
  {
    id: 'solar-farm',
    name: 'Solar Farm',
    category: 'utility',
    size: { x: 3, z: 3 },
    cost: 1200,
    unlockLevel: 11,
    build: { seconds: 240, materials: { glass: 8, steel: 4 } },
    supplies: { utility: 'power', amount: 25 },
    upkeep: 5, // no fuel: cheap to run
    recoveryYears: 5, // solar energy property gets a short 5-year period
    placeholder: { shape: 'solar', color: '#2c3e66', accent: '#c9ccd2', height: 0.5 },
  },
  // ---- Storage and trade
  {
    id: 'barn',
    name: 'Barn',
    category: 'storage',
    size: { x: 2, z: 2 },
    cost: 150,
    unlockLevel: 5,
    build: { seconds: 60, materials: { lumber: 6 } },
    storage: 150,
    recoveryYears: 20, // farm buildings
    placeholder: { shape: 'barn', color: '#b5432f', accent: '#f2ead8', height: 1.1 },
  },
  {
    id: 'warehouse',
    name: 'Warehouse',
    category: 'storage',
    size: { x: 3, z: 2 },
    cost: 500,
    unlockLevel: 10,
    build: { seconds: 180, materials: { steel: 6, lumber: 4 } },
    storage: 400,
    needs: { power: 1 },
    model: industrial('building-q'),
    placeholder: { shape: 'warehouse', color: '#a8c8e6', accent: '#3a6ea8', height: 1 },
  },
  {
    // Built on the shore. Order shipments of goods here; a cargo ship brings them (Docks.ts).
    id: 'dock',
    name: 'Dock',
    category: 'port',
    size: { x: 3, z: 2 },
    cost: 800,
    unlockLevel: 9,
    build: { seconds: 180, materials: { lumber: 10, steel: 4 } },
    onShore: true,
    storage: 100,
    upkeep: 10,
    needs: { power: 1, trash: 1 },
    arrivals: 10,
    placeholder: { shape: 'dock', color: '#b9b4a8', accent: '#f2c230', height: 0.6 },
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
    road: { bonus: 0.05, style: 'asphalt' },
    placeholder: { shape: 'road', color: '#5d6168', accent: '#f2f2f2', height: 0.03 },
  },
  {
    // A cheap packed-earth track: no sidewalks or lamps, and less of a draw.
    id: 'dirt-road',
    name: 'Dirt Road',
    category: 'road',
    size: { x: 1, z: 1 },
    cost: 3,
    unlockLevel: 1,
    road: { bonus: 0.02, style: 'dirt' },
    placeholder: { shape: 'road', color: '#9a7650', accent: '#b08e64', height: 0.02 },
  },
  {
    // Brick paving and old-style lanterns.
    id: 'cobble-street',
    name: 'Cobblestone Street',
    category: 'road',
    size: { x: 1, z: 1 },
    cost: 20,
    unlockLevel: 5,
    road: { bonus: 0.06, style: 'cobble' },
    placeholder: { shape: 'road', color: '#8d7f70', accent: '#cbbfa8', height: 0.03 },
  },
  {
    // A boulevard: a raised median with double street lamps (Kenney's Modular Road Kit).
    id: 'avenue',
    name: 'Avenue',
    category: 'road',
    size: { x: 1, z: 1 },
    cost: 40,
    unlockLevel: 8,
    road: { bonus: 0.08, style: 'avenue' },
    placeholder: { shape: 'road', color: '#6f7689', accent: '#c2c2cd', height: 0.03 },
  },
  {
    id: 'park',
    name: 'Park',
    category: 'community',
    size: { x: 2, z: 2 },
    cost: 200,
    unlockLevel: 6,
    build: { seconds: 60, materials: { lumber: 3 } },
    needs: { water: 1 },
    upkeep: 5,
    amenity: { bonus: 0.1, radius: 4 },
    populationCapacity: 15,
    attractsVisitors: { lingerSeconds: 8 },
    recoveryYears: 15, // land improvements
    visitors: 5,
    placeholder: { shape: 'park', color: '#6fbf5a', accent: '#d9c79a', height: 0.6 },
  },
  {
    id: 'fire-station',
    name: 'Fire Station',
    category: 'community',
    size: { x: 2, z: 2 },
    cost: 600,
    unlockLevel: 9,
    build: { seconds: 180, materials: { bricks: 8, steel: 2 } },
    needs: { water: 2, power: 2, trash: 1 },
    upkeep: 20,
    amenity: { bonus: 0.1, radius: 6 },
    populationCapacity: 30,
    placeholder: { shape: 'firestation', color: '#c8463a', accent: '#f0e6d8', height: 1.1 },
  },
  {
    id: 'police-station',
    name: 'Police Station',
    category: 'community',
    size: { x: 2, z: 2 },
    cost: 700,
    unlockLevel: 12,
    build: { seconds: 180, materials: { bricks: 6, glass: 2, steel: 2 } },
    needs: { water: 1, power: 3, trash: 1 },
    upkeep: 25,
    amenity: { bonus: 0.06, radius: 6 },
    populationCapacity: 25,
    placeholder: { shape: 'police', color: '#dfe6ee', accent: '#2f5aa8', height: 1.1 },
  },
  {
    id: 'hospital',
    name: 'Hospital',
    category: 'community',
    size: { x: 3, z: 3 },
    cost: 1400,
    unlockLevel: 13,
    build: { seconds: 360, materials: { bricks: 10, glass: 8, steel: 4 } },
    needs: { water: 6, power: 8, trash: 6 },
    upkeep: 45,
    amenity: { bonus: 0.08, radius: 8 },
    populationCapacity: 70,
    placeholder: { shape: 'hospital', color: '#f6f6f2', accent: '#d8343a', height: 1.8 },
  },
  {
    id: 'school',
    name: 'School',
    category: 'community',
    size: { x: 3, z: 2 },
    cost: 900,
    unlockLevel: 10,
    build: { seconds: 240, materials: { bricks: 10, lumber: 6, glass: 4 } },
    needs: { water: 3, power: 3, trash: 2 },
    upkeep: 30,
    amenity: { bonus: 0.15, radius: 6 },
    populationCapacity: 50,
    placeholder: { shape: 'school', color: '#ffd27a', accent: '#d9482b', height: 1.2 },
  },  {
    id: 'library',
    name: 'Library',
    category: 'community',
    size: { x: 2, z: 2 },
    cost: 500,
    unlockLevel: 7,
    build: { seconds: 120, materials: { bricks: 6, lumber: 4 } },
    needs: { water: 1, power: 2, trash: 1 },
    upkeep: 10,
    amenity: { bonus: 0.05, radius: 8 },
    populationCapacity: 20,
    attractsVisitors: { lingerSeconds: 6 },
    placeholder: { shape: 'library', color: '#e9dcff', accent: '#6b3fc0', height: 1.1 },
  },
  {
    id: 'town-hall',
    name: 'Town Hall',
    category: 'community',
    size: { x: 3, z: 3 },
    cost: 1500,
    unlockLevel: 12,
    build: { seconds: 300, materials: { bricks: 12, glass: 6, steel: 4 } },
    needs: { water: 3, power: 4, trash: 2 },
    upkeep: 40,
    amenity: { bonus: 0.05, radius: 12 },
    populationCapacity: 80,
    placeholder: { shape: 'townhall', color: '#f8f1df', accent: '#2f5fc4', height: 1.6 },
  },

  // ---- Landmarks: long-term goals, one of each, with a town-wide effect.
  {
    id: 'clock-tower',
    name: 'Clock Tower',
    category: 'landmark',
    size: { x: 2, z: 2 },
    cost: 3000,
    unlockLevel: 11,
    build: { seconds: 300, materials: { bricks: 15, steel: 6, glass: 4 } },
    unique: true,
    minRating: 60,
    townBonus: 0.05,
    populationCapacity: 30,
    attractsVisitors: { lingerSeconds: 5 },
    visitors: 15,
    placeholder: { shape: 'clocktower', color: '#f2dfb0', accent: '#2f5fc4', height: 3 },
  },
  {
    id: 'lighthouse',
    name: 'Lighthouse',
    category: 'landmark',
    size: { x: 2, z: 2 },
    cost: 4000,
    unlockLevel: 12,
    build: { seconds: 360, materials: { bricks: 12, glass: 10, steel: 6 } },
    unique: true,
    minRating: 65,
    onShore: true,
    townBonus: 0.03,
    shipSpeedBonus: 0.25,
    visitors: 20,
    placeholder: { shape: 'lighthouse', color: '#f4f1ea', accent: '#c8463a', height: 3.2 },
  },
  {
    id: 'botanical-garden',
    name: 'Botanical Garden',
    category: 'landmark',
    size: { x: 3, z: 3 },
    cost: 5000,
    unlockLevel: 13,
    build: { seconds: 420, materials: { glass: 16, lumber: 12, steel: 4 } },
    unique: true,
    minRating: 75,
    townBonus: 0.05,
    populationCapacity: 50,
    attractsVisitors: { lingerSeconds: 10 },
    visitors: 30,
    placeholder: { shape: 'garden', color: '#6fbf5a', accent: '#cfe8f2', height: 1.4 },
  },
  // ---- Transport and the army
  {
    id: 'bus-stop',
    name: 'Bus Stop',
    category: 'community',
    size: { x: 1, z: 1 },
    cost: 150,
    unlockLevel: 7,
    upkeep: 3,
    amenity: { bonus: 0.04, radius: 4 },
    requiresRoad: true, // the bus has to reach it
    recoveryYears: 15, // a shelter beside the road: a land improvement
    arrivals: 3,
    placeholder: { shape: 'busstop', color: '#2f7fe0', accent: '#ffd23f', height: 0.6 },
  },
  {
    id: 'army-base',
    name: 'Army Base',
    category: 'community',
    size: { x: 3, z: 3 },
    cost: 2500,
    unlockLevel: 12,
    build: { seconds: 240, materials: { bricks: 8, steel: 6 } },
    needs: { water: 3, power: 3, trash: 2 },
    upkeep: 40,
    amenity: { bonus: 0.05, radius: 6 }, // people feel safe nearby
    populationCapacity: 40,
    requiresRoad: true, // the squad and the jeep go out on the roads
    placeholder: { shape: 'armybase', color: '#6b7a4a', accent: '#c2b280', height: 0.9 },
  },
  {
    id: 'rail',
    name: 'Railway Track',
    category: 'rail',
    size: { x: 1, z: 1 },
    cost: 20,
    unlockLevel: 14,
    xpReward: 0,
    placeholder: { shape: 'rail', color: '#8a7a6a', accent: '#9aa3ad', height: 0.05 },
  },
  {
    id: 'train-station',
    name: 'Train Station',
    category: 'rail',
    size: { x: 3, z: 2 },
    cost: 3000,
    unlockLevel: 14,
    build: { seconds: 300, materials: { bricks: 10, steel: 8, glass: 4 } },
    needs: { water: 2, power: 3, trash: 2 },
    upkeep: 30,
    unique: true,
    townBonus: 0.04, // visitors arriving by train spend money all over town
    attractsVisitors: { lingerSeconds: 6 },
    requiresRail: true,
    recoveryYears: 39, // the station building: nonresidential real property
    arrivals: 40,
    placeholder: { shape: 'station', color: '#e9d3b0', accent: '#2f5fc4', height: 1.2 },
  },
  {
    id: 'airport',
    name: 'Airport',
    category: 'air',
    size: { x: 7, z: 3 },
    cost: 8000,
    unlockLevel: 15,
    build: { seconds: 360, materials: { steel: 12, glass: 6, bricks: 10 } },
    needs: { water: 3, power: 5, trash: 3 },
    upkeep: 60,
    unique: true,
    townBonus: 0.05, // visitors flying in spend money all over town
    attractsVisitors: { lingerSeconds: 8 },
    requiresRoad: true, // passengers need to get there
    recoveryYears: 15, // mostly runway and aprons: land improvements
    arrivals: 80,
    placeholder: { shape: 'airport', color: '#4a4f57', accent: '#e8eef2', height: 0.9 },
  },
  // ---- Parks, the beach and the slopes
  {
    id: 'playground',
    name: 'Playground',
    category: 'community',
    size: { x: 2, z: 2 },
    cost: 250,
    unlockLevel: 6,
    upkeep: 4,
    amenity: { bonus: 0.06, radius: 3 },
    attractsVisitors: { lingerSeconds: 7 },
    recoveryYears: 15, // land improvements
    visitors: 3,
    placeholder: { shape: 'playground', color: '#7fcf62', accent: '#ff7a3d', height: 0.5 },
  },
  {
    id: 'sports-field',
    name: 'Sports Field',
    category: 'community',
    size: { x: 3, z: 2 },
    cost: 650,
    unlockLevel: 8,
    build: { seconds: 90, materials: { lumber: 4 } },
    needs: { water: 2 },
    upkeep: 10,
    amenity: { bonus: 0.08, radius: 5 },
    populationCapacity: 10,
    attractsVisitors: { lingerSeconds: 9 },
    recoveryYears: 15, // land improvements
    visitors: 10,
    placeholder: { shape: 'sportsfield', color: '#4fae4a', accent: '#ffffff', height: 0.4 },
  },
  {
    id: 'public-beach',
    name: 'Public Beach',
    category: 'community',
    size: { x: 3, z: 2 },
    cost: 400,
    unlockLevel: 9,
    onShore: true,
    upkeep: 8,
    amenity: { bonus: 0.08, radius: 5 },
    attractsVisitors: { lingerSeconds: 12 },
    recoveryYears: 15, // land improvements
    visitors: 25,
    placeholder: { shape: 'beach', color: '#f6e3a4', accent: '#ff5c8a', height: 0.5 },
  },
  {
    id: 'central-park',
    name: 'Central Park',
    category: 'community',
    size: { x: 4, z: 4 },
    cost: 1800,
    unlockLevel: 11,
    build: { seconds: 180, materials: { lumber: 8, bricks: 4 } },
    needs: { water: 3 },
    upkeep: 25,
    amenity: { bonus: 0.12, radius: 7 },
    populationCapacity: 30,
    attractsVisitors: { lingerSeconds: 12 },
    recoveryYears: 15, // land improvements
    visitors: 20,
    placeholder: { shape: 'bigpark', color: '#5fbf52', accent: '#d9c79a', height: 0.8 },
  },
  {
    id: 'ski-resort',
    name: 'Ski Resort',
    category: 'business',
    size: { x: 4, z: 4 },
    cost: 3500,
    unlockLevel: 13,
    build: { seconds: 300, materials: { lumber: 10, steel: 8 } },
    needs: { water: 2, power: 4, trash: 2 },
    income: { coins: 260, seconds: 300 }, // lift tickets
    requiresRoad: true,
    attractsVisitors: { lingerSeconds: 10 },
    visitors: 30,
    placeholder: { shape: 'skiresort', color: '#f4f8fb', accent: '#c8463a', height: 2.4 },
  },
  // ---- The Highlands: built at the foot of a mountain (terrain.ts).
  {
    id: 'mountain-lodge',
    name: 'Mountain Lodge',
    category: 'home',
    size: { x: 2, z: 2 },
    cost: 1800,
    unlockLevel: 16,
    nearMountain: true,
    build: { seconds: 150, materials: { lumber: 8, glass: 4 } },
    needs: { water: 1, power: 1, trash: 1 },
    income: { coins: 210, seconds: 200 },
    residents: 8,
    placeholder: { shape: 'lodge', color: '#8a5a36', accent: '#c8463a', height: 1.3 },
  },
  {
    id: 'cable-car',
    name: 'Cable Car',
    category: 'business',
    size: { x: 2, z: 2 },
    cost: 3800,
    unlockLevel: 16,
    nearMountain: true,
    requiresRoad: true,
    build: { seconds: 180, materials: { steel: 6, glass: 3 } },
    needs: { power: 3 },
    income: { coins: 310, seconds: 240 }, // rides to the top
    attractsVisitors: { lingerSeconds: 12 },
    visitors: 25,
    placeholder: { shape: 'cablecar', color: '#e8e2d4', accent: '#c8463a', height: 1.2 },
  },
  {
    id: 'tunnel-works',
    name: 'Tunnel Works',
    category: 'industry',
    size: { x: 3, z: 3 },
    cost: 2800,
    unlockLevel: 16,
    nearMountain: true,
    requiresRoad: true,
    build: { seconds: 240, materials: { steel: 8, bricks: 4 } },
    needs: { power: 5, water: 2 },
    income: { coins: 260, seconds: 300 }, // ore and gems from the dig
    placeholder: { shape: 'tunnel', color: '#e0a030', accent: '#3a3d42', height: 1 },
  },
  {
    id: 'spaceport',
    name: 'Spaceport',
    category: 'business',
    size: { x: 4, z: 4 },
    cost: 6000,
    unlockLevel: 18,
    unique: true,
    requiresRoad: true,
    build: { seconds: 420, materials: { steel: 14, glass: 8, bricks: 6 } },
    needs: { power: 8, water: 4, trash: 2 },
    income: { coins: 520, seconds: 420 }, // launches and tours
    attractsVisitors: { lingerSeconds: 15 },
    visitors: 60,
    placeholder: { shape: 'spaceport', color: '#d8dde2', accent: '#c8463a', height: 3 },
  },
  // ---- Farm animals: they earn farm income (eggs, pork, wool, milk) like a shop earns sales
  {
    id: 'chicken-coop',
    name: 'Chicken Coop',
    category: 'farm',
    size: { x: 2, z: 2 },
    cost: 220,
    unlockLevel: 3,
    income: { coins: 22, seconds: 45 },
    produce: { product: 'eggs', units: 2 },
    animals: { kind: 'chicken', count: 5 },
    recoveryYears: 10, // a single-purpose livestock structure, IRC §168(e)(3)(D)
    placeholder: { shape: 'pen', color: '#c8463a', accent: '#f2ead8', height: 0.5 },
  },
  {
    id: 'pig-pen',
    name: 'Pig Pen',
    category: 'farm',
    size: { x: 2, z: 2 },
    cost: 420,
    unlockLevel: 5,
    income: { coins: 38, seconds: 70 },
    produce: { product: 'truffles', units: 1 }, // they sniff them out
    needs: { water: 1 },
    animals: { kind: 'pig', count: 3 },
    recoveryYears: 10,
    placeholder: { shape: 'pen', color: '#8a5a36', accent: '#e8c9a0', height: 0.5 },
  },
  {
    id: 'sheep-meadow',
    name: 'Sheep Meadow',
    category: 'farm',
    size: { x: 3, z: 2 },
    cost: 650,
    unlockLevel: 7,
    income: { coins: 58, seconds: 90 },
    produce: { product: 'wool', units: 2 },
    needs: { water: 1 },
    animals: { kind: 'sheep', count: 4 },
    recoveryYears: 10,
    placeholder: { shape: 'pen', color: '#5b6b7a', accent: '#f2ead8', height: 0.5 },
  },
  {
    id: 'cow-pasture',
    name: 'Cow Pasture',
    category: 'farm',
    size: { x: 3, z: 3 },
    cost: 950,
    unlockLevel: 9,
    income: { coins: 92, seconds: 120 },
    produce: { product: 'milk', units: 3 },
    needs: { water: 2 },
    animals: { kind: 'cow', count: 3 },
    recoveryYears: 10,
    placeholder: { shape: 'pen', color: '#b5432f', accent: '#f2ead8', height: 0.6 },
  },
  // ---- Orchards: planted once, picked again and again.
  orchard('apple-orchard', 'Apple Orchard', 300, 4, 300, 20, 'apples', 4, '#e0383e'),
  orchard('cherry-orchard', 'Cherry Orchard', 550, 8, 480, 30, 'cherries', 4, '#b3122e'),
  orchard('orange-grove', 'Orange Grove', 850, 12, 720, 45, 'oranges', 5, '#f39a1e'),
  // ---- Farm workshops: farm products in, something worth more out (sold at the Farmers' Market).
  {
    id: 'bakehouse',
    name: 'Bakehouse',
    category: 'farm',
    size: { x: 2, z: 2 },
    cost: 700,
    unlockLevel: 6,
    build: { seconds: 60, materials: { bricks: 2, lumber: 2 } },
    factory: { product: 'bread', input: 0, output: 2, seconds: 120, recipe: { wheat: 6, eggs: 2 } },
    needs: { water: 1, power: 2 },
    placeholder: { shape: 'bakery', color: '#f1dcb4', accent: '#b5432f', height: 0.9 },
  },
  {
    id: 'dairy',
    name: 'Dairy',
    category: 'farm',
    size: { x: 2, z: 2 },
    cost: 1100,
    unlockLevel: 9,
    build: { seconds: 90, materials: { bricks: 3, steel: 1 } },
    factory: { product: 'cheese', input: 0, output: 2, seconds: 180, recipe: { milk: 6 } },
    needs: { water: 2, power: 2 },
    placeholder: { shape: 'dairy', color: '#f4f6f8', accent: '#3a6fb0', height: 0.9 },
  },
  {
    id: 'winery',
    name: 'Winery',
    category: 'farm',
    size: { x: 3, z: 2 },
    cost: 1500,
    unlockLevel: 11,
    build: { seconds: 120, materials: { lumber: 4, bricks: 3 } },
    factory: { product: 'wine', input: 0, output: 2, seconds: 300, recipe: { grapes: 8 } },
    needs: { water: 2, power: 2 },
    placeholder: { shape: 'winery', color: '#e8d9c0', accent: '#7b3fa0', height: 1 },
  },
  {
    // Buys farm products, and posts orders that pay extra (market.ts).
    id: 'farmers-market',
    name: "Farmers' Market",
    category: 'farm',
    size: { x: 3, z: 2 },
    cost: 600,
    unlockLevel: 4,
    unique: true,
    attractsVisitors: { lingerSeconds: 10 },
    visitors: 10,
    placeholder: { shape: 'market', color: '#f4efe6', accent: '#3f8f3a', height: 0.9 },
  },
  {
    // Its tractor drives out to harvest ripe crops, clear withered ones and sow again (TractorView).
    id: 'tractor-shed',
    name: 'Tractor Shed',
    category: 'farm',
    size: { x: 2, z: 2 },
    cost: 1600,
    unlockLevel: 8,
    unique: true,
    build: { seconds: 90, materials: { lumber: 4, steel: 2 } },
    placeholder: { shape: 'tractorshed', color: '#b5432f', accent: '#f2ead8', height: 0.9 },
  },
]

// An orchard: trees planted once that bear fruit again and again (2×2).
function orchard(id: string, name: string, cost: number, unlockLevel: number, seconds: number, coins: number, product: ProductId, units: number, fruit: string): BuildingType {
  return {
    id,
    name,
    category: 'farm',
    size: { x: 2, z: 2 },
    cost,
    unlockLevel,
    income: { coins, seconds },
    produce: { product, units },
    needs: { water: 1 },
    recoveryYears: 10, // orchard trees: 10 years (IRC §168(e)(3)(D))
    placeholder: { shape: 'orchard', color: '#4f9a3c', accent: fruit, height: 0.9 },
  }
}

// Festival prizes (eventData.ts): decorations you can only win, one per
// season. Not in BUILDING_TYPES, so the build menu never sells them; their
// cost is what they're worth (taxable as a prize, and their value for
// depreciation). They brighten the neighborhood and draw a few visitors.
const prize = (id: string, name: string, festival: string, size: { x: number; z: number }, placeholder: BuildingType['placeholder']): BuildingType => ({
  id,
  name,
  category: 'decoration',
  size,
  cost: 300,
  unlockLevel: 1,
  amenity: { bonus: 0.06, radius: 2 },
  visitors: 5,
  prize: festival,
  placeholder,
})

export const PRIZE_TYPES: BuildingType[] = [
  prize('blossom-arch', 'Blossom Arch', 'Blossom Festival', { x: 2, z: 1 }, { shape: 'arch', color: '#f4efe6', accent: '#f28cb1', height: 1.1 }),
  prize('ice-cream-cart', 'Ice Cream Cart', 'Summer Fair', { x: 1, z: 1 }, { shape: 'cart', color: '#7fd1e8', accent: '#f6a6c1', height: 0.8 }),
  prize('pumpkin-patch', 'Pumpkin Patch', 'Harvest Fair', { x: 2, z: 1 }, { shape: 'pumpkins', color: '#7a5233', accent: '#f08a24', height: 0.8 }),
  prize('festive-fir', 'Festive Fir', 'Winter Lights', { x: 1, z: 1 }, { shape: 'fir', color: '#2e7d4f', accent: '#ffd23f', height: 1.5 }),
]

// A road bridge over the railway (bridges.ts): one tile that's both road and
// track. Never sold in the build menu: drawing a road across the track (or
// track across a road) builds one. Its cost is a road's and a bridge's.
export const OVERPASS_TYPE: BuildingType = {
  id: 'overpass',
  name: 'Road Bridge',
  category: 'road',
  size: { x: 1, z: 1 },
  cost: 120,
  unlockLevel: 14,
  xpReward: 0,
  road: { bonus: 0.05, style: 'asphalt' },
  placeholder: { shape: 'road', color: '#5d6168', accent: '#f2f2f2', height: 0.03 },
}

export const BUILDINGS_BY_ID = new Map([...BUILDING_TYPES, ...PRIZE_TYPES, OVERPASS_TYPE].map((b) => [b.id, b]))

// A crop plot: plowed soil to plant on. (Pens, orchards, workshops, the
// market and the tractor shed are farm buildings too.)
export function isPlot(type: BuildingType): boolean {
  return type.category === 'farm' && type.placeholder.shape === 'field'
}

// Roads and railway track: 1×1 tiles you draw by dragging, drawn on screen
// as one connected network (RoadView, RailView) rather than one by one.
export function isTrack(type: BuildingType): boolean {
  return type.category === 'road' || type.id === 'rail'
}

// Anything placed by dragging along a line: roads, track, and the decorations
// that are drawn (paths, hedges, flower beds), one tile at a time.
export function isDrawn(type: BuildingType): boolean {
  return isTrack(type) || !!type.drawn
}

// A building can be turned in quarter turns (0–3). Turned a quarter, its
// footprint swaps width and depth.
export type Rotation = 0 | 1 | 2 | 3

export function footprint(type: BuildingType, rotation: Rotation = 0): { x: number; z: number } {
  return rotation % 2 === 0 ? type.size : { x: type.size.z, z: type.size.x }
}

// Ids that were renamed, so old saves still load. Saves store a building's
// type id, so renaming an id without this would silently drop those buildings.
export const RENAMED_BUILDING_IDS: Record<string, string> = {
  'wheat-field': 'farm-plot', // Stage 4: the fixed wheat field became a plot you plant
}
