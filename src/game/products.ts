// Products: what factories make out of goods, for specialty shops to sell,
// and what the farm gives besides crops.
// A supply chain: farms (or ships) → 📦 goods → a factory → a product → a shop.
// Products sit in town storage beside goods, a unit each.
//
// For the tax books a product is still the goods it was made from (goodsEach
// of them): making one moves no money, and selling it costs those goods.
//
// Farm products (farm: true) come from the farm itself: eggs, milk, wool and
// truffles from the animal pens, fruit from the orchards, wheat and grapes
// from harvests. The Bakehouse, Dairy and Winery turn them into something worth
// more (a recipe), and the Farmers' Market buys any of them (market.ts), at
// `price` each. They're made from no goods (goodsEach 0).

export type ProductId =
  | 'preserves'
  | 'clothes'
  | 'furniture'
  | 'eggs'
  | 'milk'
  | 'wool'
  | 'truffles'
  | 'apples'
  | 'cherries'
  | 'oranges'
  | 'wheat'
  | 'grapes'
  | 'bread'
  | 'cheese'
  | 'wine'

export interface Product {
  id: ProductId
  name: string
  icon: string
  goodsEach: number // goods it takes to make one
  price?: number // what the Farmers' Market pays for one (farm products)
  farm?: boolean
}

const farm = (id: ProductId, name: string, icon: string, price: number): Product => ({ id, name, icon, goodsEach: 0, price, farm: true })

export const PRODUCTS: Record<ProductId, Product> = {
  preserves: { id: 'preserves', name: 'Preserves', icon: '🫙', goodsEach: 2 },
  clothes: { id: 'clothes', name: 'Clothes', icon: '👕', goodsEach: 3 },
  furniture: { id: 'furniture', name: 'Furniture', icon: '🪑', goodsEach: 4 },
  eggs: farm('eggs', 'Eggs', '🥚', 6),
  milk: farm('milk', 'Milk', '🥛', 14),
  wool: farm('wool', 'Wool', '🧶', 18),
  truffles: farm('truffles', 'Truffles', '🍄', 30),
  apples: farm('apples', 'Apples', '🍎', 10),
  cherries: farm('cherries', 'Cherries', '🍒', 16),
  oranges: farm('oranges', 'Oranges', '🍊', 22),
  wheat: farm('wheat', 'Wheat', '🌾', 7),
  grapes: farm('grapes', 'Grapes', '🍇', 25),
  bread: farm('bread', 'Bread', '🍞', 45),
  cheese: farm('cheese', 'Cheese', '🧀', 70),
  wine: farm('wine', 'Wine', '🍷', 190),
}

export const PRODUCT_IDS = Object.keys(PRODUCTS) as ProductId[]
export const FARM_PRODUCT_IDS = PRODUCT_IDS.filter((id) => PRODUCTS[id].farm)

// What a shop sells: plain goods, or one product.
export function soldBy(type: { sells?: ProductId }): { icon: string; name: string; goodsEach: number } {
  return type.sells ? PRODUCTS[type.sells] : { icon: '📦', name: 'Goods', goodsEach: 1 }
}

// What a factory batch takes: goods, or (a farm workshop's recipe) products.
export type Recipe = Partial<Record<ProductId, number>>
export interface FactoryRecipe {
  product: ProductId
  input: number
  output: number
  seconds: number
  recipe?: Recipe
}

// What a batch needs, for the interface: "📦 10 goods" or "🌾 4 + 🥚 2".
export function inputsText(f: FactoryRecipe): string {
  if (!f.recipe) return `📦 ${f.input} goods`
  return Object.entries(f.recipe)
    .map(([id, n]) => `${PRODUCTS[id as ProductId].icon} ${n}`)
    .join(' + ')
}

// What a pile of products is worth at the Farmers' Market.
export function marketValue(items: Recipe): number {
  return Object.entries(items).reduce((sum, [id, n]) => sum + (PRODUCTS[id as ProductId].price ?? 0) * (n ?? 0), 0)
}
