import type { PlayerEvent } from '../game/Player'
import { coins, el } from './dom'
import { Modal, button } from './Sheet'

type LevelUp = Extract<PlayerEvent, { kind: 'levelUp' }>

const CATEGORY_ICON = { home: '🏠', business: '🏪', farm: '🌱', decoration: '🌳', utility: '🏭', community: '🏫', road: '🛣️', storage: '📦', port: '⚓', landmark: '🏛️', rail: '🚆', air: '✈️', industry: '🏭' }

// The window that celebrates a new level: the coin reward, the energy refill
// and everything that just unlocked.
export class LevelUpPanel {
  private modal: Modal

  constructor(container: HTMLElement) {
    this.modal = new Modal(container, 'level-panel')
  }

  show(e: LevelUp) {
    const rows = [
      `${coins(e.reward)} reward (prize money, so it's taxable income)`,
      `⚡ Energy refilled, and your maximum is now ${e.maxEnergy}`,
    ]
    const unlocked = [...e.buildings.map((b) => `${CATEGORY_ICON[b.category]} ${b.name}`), ...e.crops.map((c) => `${c.emoji} ${c.name}`)]
    const list = el('ul', 'level-list')
    for (const row of rows) list.append(el('li', '', row))
    this.modal.body.replaceChildren(list)
    if (unlocked.length > 0) {
      const unlocks = el('ul', 'level-list unlocks')
      for (const item of unlocked) unlocks.append(el('li', '', item))
      this.modal.body.append(el('h3', 'level-subtitle', 'Now unlocked'), unlocks)
    }
    this.modal.show(`⭐ Level ${e.level}!`, button('Nice!', () => this.modal.close()))
  }
}
