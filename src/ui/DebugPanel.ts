import { el } from './dom'
import { Sheet, button } from './Sheet'

// Development tools: grant resources and skip waiting, to test expensive or
// late content quickly. Its button only appears in development builds
// (npm run dev); players never see it.

export interface DebugActions {
  coins: () => void
  xp: () => void
  materials: () => void
  goods: () => void
  energy: () => void
  finishTimers: () => void
  nextMonth: () => void
}

export class DebugPanel {
  private sheet: Sheet

  constructor(container: HTMLElement, a: DebugActions) {
    this.sheet = new Sheet(container, '🐞 Debug')
    this.sheet.body.append(el('p', 'muted', 'Development only. These change your saved town.'))
    const grid = el('div', 'debug-grid')
    grid.append(
      button('+1,000 🪙', a.coins),
      button('+100 ⭐ XP', a.xp),
      button('+10 of each material', a.materials),
      button('+100 📦 goods', a.goods),
      button('Fill ⚡ energy', a.energy),
      button('Finish all timers', a.finishTimers),
      button('Skip to next month', a.nextMonth),
    )
    this.sheet.body.append(grid)
  }

  open() {
    this.sheet.open()
  }
}
