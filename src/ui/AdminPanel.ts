import type { AdminSettings, SettingsStore } from '../game/settings'
import { el } from './dom'
import { Sheet, button } from './Sheet'

// Admin tools: cheats for playing however you like, or for testing anything
// quickly. Turned on in Settings (and always available in development
// builds). Gifts happen once; powers stay on, saved with the town, until
// switched off. Game carries them out; this panel only shows them.

export interface AdminActions {
  level: () => number
  setLevel: (level: number) => void // up or down
  maxLevel: number // the level that unlocks everything
  coins: (amount: number) => void // negative takes coins away
  clearDebt: () => void
  materials: (each: number) => void
  goods: (amount: number) => void
  fillStorage: () => void
  products: (each: number) => void
  collections: () => void
  energy: () => void
  allLand: () => number // lots bought
  finishTimers: () => void
  repairAll: () => number
  upgradeAll: () => number
  unlockEverything: () => void
  nextMonth: () => void
  toggleRain: () => void
  toggleSnow: () => void
  disaster: (kind: 'tornado' | 'lightning' | 'flood' | 'tsunami') => void
  notice: (message: string) => void
}

const POWERS: [keyof AdminSettings, string][] = [
  ['freeBuild', '🏗️ Build anything, free and instantly (ignores level)'],
  ['infiniteCoins', '🪙 Unlimited coins (never below 1,000,000)'],
  ['infiniteEnergy', '⚡ Unlimited energy'],
  ['instantTimers', '⏩ Everything is ready right away'],
]
const SPEEDS = [1, 10, 60, 600]

// A number box with buttons acting on its value.
function numberRow(label: string, start: number, actions: [string, (value: number) => void][]) {
  const row = el('div', 'admin-row')
  const input = el('input', 'admin-number')
  input.type = 'number'
  input.inputMode = 'numeric'
  input.value = String(start)
  input.setAttribute('aria-label', label)
  const value = () => Math.max(0, Math.floor(Number(input.value) || 0))
  row.append(el('span', '', label), input, ...actions.map(([text, act]) => button(text, () => act(value()), 'panel-button secondary')))
  return { row, input }
}

function grid(...buttons: HTMLButtonElement[]) {
  const g = el('div', 'debug-grid')
  g.append(...buttons)
  return g
}

export class AdminPanel {
  private sheet: Sheet
  private levelInput: HTMLInputElement
  private a: AdminActions

  constructor(container: HTMLElement, settings: SettingsStore, a: AdminActions) {
    this.a = a
    this.sheet = new Sheet(container, '🛠️ Admin tools')
    const admin = () => settings.values.admin
    const setPower = (patch: Partial<AdminSettings>) => settings.set('admin', { ...admin(), ...patch })
    const done = (message: string) => a.notice(`🛠️ ${message}`)

    const level = numberRow('⭐ Level', a.level(), [
      ['Set', (n) => (a.setLevel(Math.max(1, n)), done(`Level ${Math.max(1, n)}`))],
      ['+1', () => (a.setLevel(a.level() + 1), done(`Level ${a.level()}`))],
      ['−1', () => (a.setLevel(Math.max(1, a.level() - 1)), done(`Level ${a.level()}`))],
      [`Max (${a.maxLevel})`, () => (a.setLevel(a.maxLevel), done(`Level ${a.maxLevel}: everything unlocked`))],
    ])
    this.levelInput = level.input
    const coins = numberRow('🪙 Coins', 10_000, [
      ['Give', (n) => (a.coins(n), done(`+${n.toLocaleString()} coins`))],
      ['Take', (n) => (a.coins(-n), done(`−${n.toLocaleString()} coins`))],
    ])
    const materials = numberRow('🧱 Each material', 50, [['Give', (n) => (a.materials(n), done(`+${n} of each material`))]])
    const goods = numberRow('📦 Goods', 100, [
      ['Give', (n) => (a.goods(n), done(`+${n} goods (as much as storage holds)`))],
      ['Fill storage', () => (a.fillStorage(), done('Storage full'))],
    ])
    const products = numberRow('🏭 Each product', 20, [['Give', (n) => (a.products(n), done(`+${n} of each product`))]])

    const stock = grid(
      button('⚡ Fill energy', () => (a.energy(), done('Energy full'))),
      button('🏆 One of every collectible', () => (a.collections(), done('A full set of every collection'))),
      button('💸 Clear debt', () => (a.clearDebt(), done('Debt paid off'))),
    )
    const town = grid(
      button('🗺️ Buy all land, free', () => done(`${a.allLand()} lots bought`)),
      button('⏩ Finish all timers', () => (a.finishTimers(), done('Everything is ready'))),
      button('🔧 Repair all damage', () => done(`${a.repairAll()} buildings repaired`)),
      button('⬆️ Upgrade everything to the top', () => done(`${a.upgradeAll()} upgrades`)),
      button('🎁 Unlock everything', () => (a.unlockEverything(), done('Max level, all land, and plenty of everything'))),
    )
    const time = grid(
      button('📅 Skip to next month', a.nextMonth),
      button('🌧️ Rain / ☀️ Sun', a.toggleRain),
      button('❄️ Snow on/off', a.toggleSnow),
    )
    const disasters = grid(
      button('🌪️ Tornado', () => a.disaster('tornado')),
      button('⚡ Lightning storm', () => a.disaster('lightning')),
      button('🌊 Flood', () => a.disaster('flood')),
      button('🌊 Tsunami', () => a.disaster('tsunami')),
    )
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
      el('p', 'muted', 'Cheats for testing anything. They change your saved town. Turn admin tools off in Settings to hide this.'),
      el('h3', 'level-subtitle', 'Player'),
      level.row,
      coins.row,
      el('h3', 'level-subtitle', 'Stock'),
      materials.row,
      goods.row,
      products.row,
      stock,
      el('h3', 'level-subtitle', 'Town'),
      town,
      el('h3', 'level-subtitle', 'Time and weather'),
      time,
      speedRow,
      el('h3', 'level-subtitle', 'Disasters now'),
      disasters,
      el('h3', 'level-subtitle', 'Powers'),
      ...powers.map((p) => p.row),
    )
  }

  open() {
    this.levelInput.value = String(this.a.level())
    this.sheet.open()
  }
}
