// Things you can hold in your inventory that aren't buildings or goods:
// construction materials, and (in collections.ts) collectible items.

export type MaterialId = 'bricks' | 'lumber' | 'glass' | 'steel'

export interface ItemType {
  id: string
  name: string
  icon: string
  // What one costs to buy. Materials can be bought any time; collectibles can't.
  price?: number
}

export const MATERIALS: Record<MaterialId, ItemType> = {
  bricks: { id: 'bricks', name: 'Bricks', icon: '🧱', price: 15 },
  lumber: { id: 'lumber', name: 'Lumber', icon: '🪵', price: 12 },
  glass: { id: 'glass', name: 'Glass', icon: '🪟', price: 20 },
  steel: { id: 'steel', name: 'Steel', icon: '🔩', price: 25 },
}

export const MATERIAL_IDS = Object.keys(MATERIALS) as MaterialId[]

// A list of materials and how many of each, e.g. { bricks: 8, steel: 2 }.
export type Materials = Partial<Record<MaterialId, number>>

export function materialsText(m: Materials): string {
  return MATERIAL_IDS.filter((id) => m[id])
    .map((id) => `${MATERIALS[id].icon} ${m[id]}`)
    .join(' ')
}
