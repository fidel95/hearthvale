import { FRANCHISE_FEE_FACTOR, franchiseFee, franchiseTakings, type Neighbor } from '../game/neighborData'
import type { Neighbors } from '../game/Neighbors'
import type { City } from '../game/City'
import { coins, el } from './dom'
import { Sheet } from './Sheet'

// Picking which of your shops opens a branch in a neighbor's town: each one's
// fee, its daily takings there, and how many days it takes to pay back.
export class FranchisePanel {
  private sheet: Sheet
  private neighbors: Neighbors
  private city: City
  private onNotice: (message: string) => void

  constructor(container: HTMLElement, city: City, neighbors: Neighbors, onNotice: (message: string) => void) {
    this.city = city
    this.neighbors = neighbors
    this.onNotice = onNotice
    this.sheet = new Sheet(container, '🏪 Open a franchise')
  }

  open(n: Neighbor) {
    this.sheet.setTitle(`🏪 A franchise in ${n.town}`)
    const options = this.neighbors.franchiseOptions()
    const list = el('div', 'crop-grid')
    const friendship = this.neighbors.friendship(n)
    for (const type of options) {
      const fee = franchiseFee(type)
      const takings = franchiseTakings(type, friendship)
      const item = el('button', 'catalog-item')
      item.append(
        el('span', 'catalog-name', `${type.name}`),
        el('span', 'catalog-meta', `Fee ${coins(fee)} · takes ${coins(takings)} a day`),
        el('span', 'catalog-meta', `Pays back in ${Math.ceil(fee / takings)} days`),
      )
      item.disabled = !this.neighbors.canOpenFranchise(n, type)
      item.addEventListener('click', () => {
        if (this.neighbors.openFranchise(n, type, Date.now())) {
          this.onNotice(`🏪 Your ${type.name} opened in ${n.town}! Collect its takings from the Neighbors tab, starting tomorrow.`)
        }
        this.sheet.close()
      })
      list.append(item)
    }
    this.sheet.body.replaceChildren(
      el('p', '', `${n.avatar} ${n.name} has room on Main Street for one of your shops. Pick which one opens a branch in ${n.town}.`),
      options.length ? list : el('p', 'warning', 'Build a shop in your own town first: a branch needs a shop to copy.'),
      el(
        'p',
        'muted',
        `The fee is ${FRANCHISE_FEE_FACTOR}× the shop's price, once. Takings come in once a day and grow as you become better friends. They're business income, so they're taxable. You have ${coins(this.city.coins)}.`,
      ),
    )
    this.sheet.open()
  }
}
