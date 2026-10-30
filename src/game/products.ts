// Products: what factories make out of goods, for specialty shops to sell.
// A supply chain: farms (or ships) → 📦 goods → a factory → a product → a shop.
// Products sit in town storage beside goods, a unit each.
//
// For the tax books a product is still the goods it was made from (goodsEach
// of them): making one moves no money, and selling it costs those goods.

export type ProductId = 'preserves' | 'clothes' | 'furniture'

export interface Product {
  id: ProductId
  name: string
  icon: string
  goodsEach: number // goods it takes to make one
}

export const PRODUCTS: Record<ProductId, Product> = {
  preserves: { id: 'preserves', name: 'Preserves', icon: '🫙', goodsEach: 2 },
  clothes: { id: 'clothes', name: 'Clothes', icon: '👕', goodsEach: 3 },
  furniture: { id: 'furniture', name: 'Furniture', icon: '🪑', goodsEach: 4 },
}

export const PRODUCT_IDS = Object.keys(PRODUCTS) as ProductId[]

// What a shop sells: plain goods, or one product.
export function soldBy(type: { sells?: ProductId }): { icon: string; name: string; goodsEach: number } {
  return type.sells ? PRODUCTS[type.sells] : { icon: '📦', name: 'Goods', goodsEach: 1 }
}
