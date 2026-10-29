import type { PlayerEvent } from '../game/Player'
import { coins, el } from './dom'

type LevelUp = Extract<PlayerEvent, { kind: 'levelUp' }>

const CATEGORY_ICON = { home: '🏠', business: '🏪', farm: '🌱', decoration: '🌳' }

// The window that celebrates a new level: the coin reward, the energy refill
// and everything that just unlocked.
export class LevelUpPanel {
  private overlay = el('div', 'overlay')
  private title = el('h2', '')
  private body = el('div', 'panel-body')

  constructor(container: HTMLElement) {
    const card = el('div', 'panel level-panel')
    const header = el('div', 'panel-header')
    header.append(this.title)
    const ok = el('button', 'panel-button', 'Nice!')
    ok.addEventListener('click', () => this.close())
    card.append(header, this.body, ok)
    this.overlay.append(card)
    this.overlay.hidden = true
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close()
    })
    container.append(this.overlay)
  }

  show(e: LevelUp) {
    this.title.textContent = `⭐ Level ${e.level}!`
    const rows = [
      `${coins(e.reward)} reward (prize money, so it's taxable income)`,
      `⚡ Energy refilled, and your maximum is now ${e.maxEnergy}`,
    ]
    const unlocked = [...e.buildings.map((b) => `${CATEGORY_ICON[b.category]} ${b.name}`), ...e.crops.map((c) => `${c.emoji} ${c.name}`)]
    const list = el('ul', 'level-list')
    for (const row of rows) list.append(el('li', '', row))
    this.body.replaceChildren(list)
    if (unlocked.length > 0) {
      const unlocks = el('ul', 'level-list unlocks')
      for (const item of unlocked) unlocks.append(el('li', '', item))
      this.body.append(el('h3', 'level-subtitle', 'Now unlocked'), unlocks)
    }
    this.overlay.hidden = false
  }

  close() {
    this.overlay.hidden = true
  }
}
