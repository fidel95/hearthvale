import type { City, PlacedBuilding } from '../game/City'
import { COLLECTIBLES_BY_ID } from '../game/collections'
import type { Inventory } from '../game/Inventory'
import { MATERIALS, MATERIAL_IDS } from '../game/items'
import { coins, el } from './dom'
import { Sheet, button } from './Sheet'
import { thumbnail } from './thumbnails'

// The Inventory: buildings you've put away, construction materials (with a
// way to buy more), goods in storage, and the collectibles you've found.

const TABS = ['Buildings', 'Materials', 'Goods', 'Collectibles'] as const
type Tab = (typeof TABS)[number]

export class InventoryPanel {
  private sheet: Sheet
  private tabs = el('div', 'catalog-tabs')
  private content = el('div', '')
  private tab: Tab = 'Buildings'
  private city: City
  private inventory: Inventory
  private onPlaceStored: (b: PlacedBuilding) => void
  private onNotice: (message: string) => void

  constructor(
    container: HTMLElement,
    city: City,
    inventory: Inventory,
    onPlaceStored: (b: PlacedBuilding) => void,
    onNotice: (message: string) => void,
  ) {
    this.city = city
    this.inventory = inventory
    this.onPlaceStored = onPlaceStored
    this.onNotice = onNotice
    this.sheet = new Sheet(container, '🎒 Inventory')
    for (const tab of TABS) {
      const b = el('button', 'catalog-tab', tab)
      b.addEventListener('click', () => this.show(tab))
      this.tabs.append(b)
    }
    this.sheet.body.append(this.tabs, this.content)
    const refresh = () => this.sheet.isOpen && this.render()
    inventory.onChange(refresh)
    city.onChange((e) => (e.kind === 'stored' || e.kind === 'restored' || e.kind === 'goods' || e.kind === 'coins') && refresh())
  }

  open(tab: Tab = this.tab) {
    this.tab = tab
    this.render()
    this.sheet.open()
  }

  private show(tab: Tab) {
    this.tab = tab
    this.render()
  }

  private render() {
    for (const b of this.tabs.children) b.classList.toggle('active', b.textContent === this.tab)
    const parts: HTMLElement[] = []
    switch (this.tab) {
      case 'Buildings': {
        const stored = [...this.city.storedBuildings()]
        if (stored.length === 0) {
          parts.push(el('p', 'muted', 'No buildings in storage. Select a building on the map and choose Store to put it away; place it again any time, free.'))
          break
        }
        const grid = el('div', 'catalog-grid')
        for (const b of stored) {
          const card = el('div', 'build-card')
          const img = el('img', 'build-thumb')
          img.alt = ''
          thumbnail(b.type).then((url) => (img.src = url))
          card.append(
            img,
            el('span', 'build-name', b.level > 1 ? `${b.type.name} ${'★'.repeat(b.level)}` : b.type.name),
            el('span', 'build-meta', `${b.type.size.x}×${b.type.size.z}`),
            button('Place', () => {
              this.sheet.close()
              this.onPlaceStored(b)
            }),
          )
          grid.append(card)
        }
        parts.push(grid)
        break
      }
      case 'Materials': {
        parts.push(el('p', 'muted', 'Used to finish construction and to upgrade. Their cost becomes part of what the building is depreciated on.'))
        const list = el('div', 'item-list')
        for (const id of MATERIAL_IDS) {
          const m = MATERIALS[id]
          const row = el('div', 'item-row')
          const buy = button(`Buy 5 · ${coins(m.price! * 5)}`, () => {
            if (!this.inventory.buy({ [id]: 5 })) this.onNotice('Not enough coins')
          }, 'panel-button secondary')
          buy.disabled = this.city.coins < m.price! * 5
          row.append(el('span', 'item-icon', m.icon), el('span', 'item-name', m.name), el('span', 'item-count', `× ${this.inventory.count(id)}`), buy)
          list.append(row)
        }
        parts.push(list)
        break
      }
      case 'Goods': {
        const shops = [...this.city.all()].filter((b) => b.type.goodsPerSale && this.city.isBuilt(b))
        parts.push(
          el('p', 'detail-status', `📦 ${this.city.goods} of ${this.city.storageCapacity} goods in storage`),
          el('p', 'muted', 'Harvests go into storage once you have a shop; ships bring more. Shops sell from their own shelves, restocked from here.'),
        )
        const list = el('div', 'item-list')
        for (const shop of shops) {
          const row = el('div', 'item-row')
          row.append(el('span', 'item-icon', '🏪'), el('span', 'item-name', shop.type.name), el('span', 'item-count', `${shop.stock}/${this.city.production.stockCapacity(shop)} on shelves`))
          list.append(row)
        }
        parts.push(list)
        break
      }
      case 'Collectibles': {
        const found = this.inventory.all().filter(([id]) => COLLECTIBLES_BY_ID.has(id))
        if (found.length === 0) parts.push(el('p', 'muted', 'Nothing found yet. Collectibles turn up while you collect, harvest, unload ships and finish buildings.'))
        const list = el('div', 'item-grid')
        for (const [id, stack] of found) {
          const item = COLLECTIBLES_BY_ID.get(id)!
          const cell = el('div', 'item-cell')
          cell.append(el('span', 'item-icon', item.icon), el('span', 'item-name', item.name), el('span', 'item-count', `× ${stack.count}`))
          list.append(cell)
        }
        parts.push(list)
        break
      }
    }
    this.content.replaceChildren(...parts)
  }
}
