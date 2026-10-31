import type { City } from '../game/City'
import { ORDER_SLOTS, type FarmMarket, type Order } from '../game/market'
import { FARM_PRODUCT_IDS, PRODUCTS, type ProductId } from '../game/products'
import { duration, el } from './dom'
import { Sheet, button } from './Sheet'

// The Farmers' Market: its orders (what's wanted, what storage has, the
// reward) and a stall to sell any farm product loose at its price.
export class MarketPanel {
  private sheet: Sheet
  private city: City
  private market: FarmMarket
  private onNotice: (message: string) => void
  private timer = 0

  constructor(container: HTMLElement, city: City, market: FarmMarket, onNotice: (message: string) => void) {
    this.city = city
    this.market = market
    this.onNotice = onNotice
    this.sheet = new Sheet(container, "🧺 Farmers' Market")
    this.sheet.onClose = () => window.clearInterval(this.timer)
    const refresh = () => this.sheet.isOpen && this.render()
    market.onChange(refresh)
    city.onChange((e) => e.kind === 'products' && refresh())
  }

  open() {
    this.market.refresh(Date.now())
    this.render()
    this.sheet.open()
    // Count down to the next orders while it's open.
    window.clearInterval(this.timer)
    this.timer = window.setInterval(() => {
      this.market.refresh(Date.now())
      this.render()
    }, 1000)
  }

  private render() {
    const now = Date.now()
    const parts: HTMLElement[] = [el('h3', '', '📋 Orders')]
    for (let slot = 0; slot < ORDER_SLOTS; slot++) {
      const order = this.market.orders[slot]
      if (order) parts.push(this.orderCard(slot, order))
      else {
        const wait = this.market.nextOrderAt(slot) - now
        parts.push(
          el(
            'div',
            'quest market-order empty',
            wait > 0 ? `🕒 A new order in ${duration(wait)}` : 'Waiting for something to order: build pens, orchards or a workshop, or plant wheat.',
          ),
        )
      }
    }

    parts.push(el('h3', '', '🪙 Sell'))
    const stock = FARM_PRODUCT_IDS.filter((id) => this.city.products[id] > 0)
    if (stock.length === 0) parts.push(el('p', 'muted', 'Nothing to sell yet. Collect eggs, milk and wool from your pens, fruit from orchards, and wheat and grapes from your fields.'))
    const list = el('div', 'item-list')
    for (const id of stock) list.append(this.sellRow(id))
    parts.push(list)
    parts.push(el('p', 'muted', 'Orders pay more than selling loose. The Bakehouse, Dairy and Winery turn farm products into bread, cheese and wine, worth more still.'))
    this.sheet.body.replaceChildren(...parts)
  }

  private orderCard(slot: number, order: Order): HTMLElement {
    const card = el('div', 'quest market-order')
    const wants = el('div', 'market-wants')
    for (const [id, n] of Object.entries(order.items) as [ProductId, number][]) {
      const have = this.city.products[id]
      const item = el('span', `market-want${have >= n ? ' done' : ''}`, `${PRODUCTS[id].icon} ${Math.min(have, n)}/${n}`)
      item.title = PRODUCTS[id].name
      wants.append(item)
    }
    const deliver = button(`Deliver: 🪙 ${order.coins} · ⭐ ${order.xp}`, () => {
      if (this.market.deliver(slot, Date.now())) this.onNotice(`🧺 Order delivered! +${order.coins} coins, +${order.xp} XP`)
    })
    deliver.disabled = !this.market.canDeliver(order)
    const skip = button('Skip', () => this.market.skip(slot, Date.now()), 'panel-button secondary')
    skip.title = 'Skip this order (a new one comes in 10 minutes)'
    const buttons = el('div', 'market-buttons')
    buttons.append(deliver, skip)
    card.append(wants, buttons)
    return card
  }

  private sellRow(id: ProductId): HTMLElement {
    const p = PRODUCTS[id]
    const have = this.city.products[id]
    const row = el('div', 'item-row')
    const one = button(`Sell 1 · 🪙 ${p.price}`, () => this.market.sell(id, 1))
    const all = button(`All · 🪙 ${p.price! * have}`, () => {
      const coins = this.market.sell(id, have)
      if (coins) this.onNotice(`🧺 Sold ${p.icon} ${have} ${p.name.toLowerCase()} for ${coins} coins`)
    })
    row.append(el('span', 'item-icon', p.icon), el('span', 'item-name', `${p.name} × ${have}`), one, all)
    return row
  }
}
