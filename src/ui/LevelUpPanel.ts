import type { PlayerEvent } from '../game/Player'
import { coins, el } from './dom'
import { Modal, button } from './Sheet'

type LevelUp = Extract<PlayerEvent, { kind: 'levelUp' }>

const CATEGORY_ICON = { home: '🏠', business: '🏪', farm: '🌱', decoration: '🌳', utility: '🏭', community: '🏫', road: '🛣️', storage: '📦', port: '⚓', landmark: '🏛️', rail: '🚆', air: '✈️', industry: '🏭' }

const CONFETTI = ['#ffd84d', '#ff6b8a', '#5cc07c', '#5aa9ff', '#b46cf0', '#ff9f43']

// The window that celebrates a new level: the new level on a big star with
// light rays turning behind it and confetti falling, then the coin reward,
// the energy refill and everything that just unlocked.
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
    const burst = el('div', 'level-burst')
    const star = el('div', 'level-star')
    star.append(el('span', 'level-star-icon', '⭐'), el('span', 'level-number', String(e.level)))
    burst.append(el('div', 'level-rays'), star)
    // Confetti: pieces of every color, each falling from its own spot at its own pace.
    for (let i = 0; i < 24; i++) {
      const piece = el('span', 'confetti')
      piece.style.left = `${(i * 37) % 100}%`
      piece.style.background = CONFETTI[i % CONFETTI.length]
      piece.style.animationDelay = `${((i * 7) % 10) / 10}s`
      piece.style.animationDuration = `${1.6 + ((i * 13) % 10) / 10}s`
      burst.append(piece)
    }
    const list = el('ul', 'level-list')
    for (const row of rows) list.append(el('li', '', row))
    this.modal.body.replaceChildren(burst, list)
    if (unlocked.length > 0) {
      const unlocks = el('ul', 'level-list unlocks')
      for (const item of unlocked) unlocks.append(el('li', '', item))
      this.modal.body.append(el('h3', 'level-subtitle', 'Now unlocked'), unlocks)
    }
    this.modal.show(`Level ${e.level}!`, button('Nice!', () => this.modal.close()))
  }
}
