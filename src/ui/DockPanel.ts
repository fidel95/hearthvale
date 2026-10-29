import type { City, PlacedBuilding } from '../game/City'
import { SHIPMENT_OPTIONS, type Docks } from '../game/Docks'
import { coins, el, timeSpan } from './dom'

// The window for ordering goods at a dock: each kind of ship, what it brings,
// what it costs and how long it takes.
export class DockPanel {
  private overlay = el('div', 'overlay')
  private body = el('div', 'panel-body')
  private city: City
  private docks: Docks
  private onNotice: (message: string) => void

  constructor(container: HTMLElement, city: City, docks: Docks, onNotice: (message: string) => void) {
    this.city = city
    this.docks = docks
    this.onNotice = onNotice

    const card = el('div', 'panel')
    const header = el('div', 'panel-header')
    const close = el('button', 'panel-close', '✕')
    close.setAttribute('aria-label', 'Close')
    close.addEventListener('click', () => this.close())
    header.append(el('h2', '', '⚓ Order goods by sea'), close)
    card.append(header, this.body)
    this.overlay.append(card)
    this.overlay.hidden = true
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close()
    })
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close()
    })
    container.append(this.overlay)
  }

  open(dock: PlacedBuilding) {
    const room = Math.max(0, this.city.storageCapacity - this.city.goods)
    const list = el('div', 'crop-grid')
    for (const option of SHIPMENT_OPTIONS) {
      const item = el('button', 'catalog-item')
      item.append(
        el('span', 'catalog-name', `🚢 ${option.name}`),
        el('span', 'catalog-meta', `📦 ${option.units} goods for ${coins(option.cost)}`),
        el('span', 'catalog-meta', `${coins(option.cost / option.units)} per good · arrives in ${timeSpan(option.seconds)}`),
      )
      item.disabled = !this.docks.canOrder(dock, option)
      item.addEventListener('click', () => {
        if (this.docks.order(dock, option, Date.now())) this.onNotice(`🚢 ${option.name} ordered. Arriving in ${timeSpan(option.seconds)}.`)
        this.close()
      })
      list.append(item)
    }
    this.body.replaceChildren(
      el('p', '', `Storage: 📦 ${this.city.goods} of ${this.city.storageCapacity} (room for ${room}).`),
      list,
      el(
        'p',
        'muted',
        "Your shops sell a good for about 10 coins, so shipped goods earn a profit once sold. Paying for a shipment isn't a tax deduction: goods are inventory, and their cost is deducted as your shops sell them (cost of goods sold).",
      ),
    )
    this.overlay.hidden = false
  }

  close() {
    this.overlay.hidden = true
  }
}
