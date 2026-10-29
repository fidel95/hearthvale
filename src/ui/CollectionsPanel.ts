import { COLLECTIONS, type Collections } from '../game/collections'
import type { Inventory } from '../game/Inventory'
import { coins, el } from './dom'
import { Sheet, button } from './Sheet'

// Collections: every set, with the items you have (and the ones you're
// missing), where they turn up, and the reward for handing in a full set.
export class CollectionsPanel {
  private sheet: Sheet
  private collections: Collections
  private inventory: Inventory

  constructor(container: HTMLElement, collections: Collections, inventory: Inventory) {
    this.collections = collections
    this.inventory = inventory
    this.sheet = new Sheet(container, '🏆 Collections')
    const refresh = () => this.sheet.isOpen && this.render()
    inventory.onChange(refresh)
    collections.onChange(refresh)
  }

  open() {
    this.render()
    this.sheet.open()
  }

  private render() {
    const ready = COLLECTIONS.filter((c) => this.collections.isComplete(c)).length
    const parts: HTMLElement[] = [
      el('p', 'muted', `${ready} of ${COLLECTIONS.length} sets ready to hand in. Rewards are prize money, so they count as taxable income.`),
    ]
    for (const c of COLLECTIONS) {
      const card = el('section', 'collection')
      const head = el('div', 'collection-head')
      const times = this.collections.timesCompleted(c.id)
      head.append(el('strong', '', c.name), el('span', 'muted', times ? `Completed × ${times}` : ''))
      const slots = el('div', 'collection-slots')
      for (const item of c.items) {
        const count = this.inventory.count(item.id)
        const slot = el('div', `slot${count ? '' : ' missing'}`)
        slot.title = item.name
        slot.append(el('span', 'slot-icon', item.icon), el('span', 'slot-count', count ? `${count}` : '?'))
        slots.append(slot)
      }
      const { reward } = c
      const complete = button(`Hand in: ${coins(reward.coins)} · ⭐ ${reward.xp} · ⚡ ${reward.energy}`, () => this.collections.complete(c))
      complete.disabled = !this.collections.isComplete(c)
      card.append(head, el('p', 'muted collection-source', `Found by: ${c.source.toLowerCase()}`), slots, complete)
      parts.push(card)
    }
    this.sheet.body.replaceChildren(...parts)
  }
}
