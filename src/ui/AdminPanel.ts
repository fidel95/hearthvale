import type { AdminSettings, SettingsStore } from '../game/settings'
import { el } from './dom'
import { Sheet, button } from './Sheet'

// Admin tools: cheats for playing however you like, or for testing late
// content quickly. Turned on in Settings (and always available in development
// builds). Gifts happen once; powers stay on, saved with the town, until
// switched off. Game carries them out; this panel only shows them.

export interface AdminActions {
  coins: (amount: number) => void
  levelUp: () => void
  maxLevel: () => void
  materials: () => void
  goods: () => void
  energy: () => void
  finishTimers: () => void
  nextMonth: () => void
  toggleRain: () => void
}

const POWERS: [keyof AdminSettings, string][] = [
  ['freeBuild', '🏗️ Build anything, free and instantly (ignores level)'],
  ['infiniteEnergy', '⚡ Unlimited energy'],
  ['instantTimers', '⏩ Everything is ready right away'],
]
const SPEEDS = [1, 10, 60]

export class AdminPanel {
  private sheet: Sheet

  constructor(container: HTMLElement, settings: SettingsStore, a: AdminActions) {
    this.sheet = new Sheet(container, '🛠️ Admin tools')
    const admin = () => settings.values.admin
    const setPower = (patch: Partial<AdminSettings>) => settings.set('admin', { ...admin(), ...patch })

    const gifts = el('div', 'debug-grid')
    gifts.append(
      button('+1,000 🪙', () => a.coins(1000)),
      button('+100,000 🪙', () => a.coins(100_000)),
      button('+1 level', a.levelUp),
      button('Max level: unlock all', a.maxLevel),
      button('+10 of each material', a.materials),
      button('+100 📦 goods', a.goods),
      button('Fill ⚡ energy', a.energy),
    )

    const time = el('div', 'debug-grid')
    time.append(button('Finish all timers', a.finishTimers), button('Skip to next month', a.nextMonth), button('🌧️ Rain / ☀️ Sun', a.toggleRain))
    const speedRow = el('div', 'setting-row')
    const speedButtons = SPEEDS.map((speed) => {
      const b = button(`${speed}×`, () => setPower({ calendarSpeed: speed }), 'panel-button secondary')
      b.setAttribute('aria-label', `Calendar speed ${speed} times`)
      return b
    })
    const speeds = el('div', 'speed-buttons')
    speeds.append(...speedButtons)
    speedRow.append(el('span', '', '📅 Calendar speed'), speeds)

    const powers = POWERS.map(([key, label]) => {
      const row = el('label', 'setting-row')
      const box = el('input', '')
      box.type = 'checkbox'
      box.addEventListener('change', () => setPower({ [key]: box.checked }))
      row.append(el('span', '', label), box)
      return { row, box, key }
    })

    settings.onChange((s) => {
      for (const p of powers) p.box.checked = Boolean(s.admin[p.key])
      speedButtons.forEach((b, i) => b.classList.toggle('chosen', s.admin.calendarSpeed === SPEEDS[i]))
    })

    this.sheet.body.append(
      el('p', 'muted', 'Cheats for playing however you like. They change your saved town. Turn admin tools off in Settings to hide this.'),
      el('h3', 'level-subtitle', 'Give'),
      gifts,
      el('h3', 'level-subtitle', 'Time'),
      time,
      speedRow,
      el('h3', 'level-subtitle', 'Powers'),
      ...powers.map((p) => p.row),
    )
  }

  open() {
    this.sheet.open()
  }
}
