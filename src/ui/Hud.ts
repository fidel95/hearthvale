import { BUILDING_TYPES } from '../game/buildings'
import type { Builder, Mode } from '../game/Builder'
import type { City } from '../game/City'
import { MONTH_NAMES, type GameClock } from '../game/GameClock'
import { el } from './dom'

// The HTML overlay on top of the canvas: coins and calendar (top left),
// hints and messages (top middle), New town (top right), the build catalog
// and tool buttons (bottom). It changes the game only through Builder and
// callbacks, and reads from City and GameClock.

function hintFor(mode: Mode): string {
  switch (mode.kind) {
    case 'select':
      return ''
    case 'build':
      return `Placing ${mode.type.name} · tap the map to place`
    case 'move':
      return mode.carrying ? 'Tap where it should go' : 'Tap a building to move it'
    case 'demolish':
      return 'Tap a building to demolish it'
  }
}

export interface HudCallbacks {
  onOpenTaxes: () => void
  onNewTown: () => void
}

export class Hud {
  private coins = el('div', 'coins')
  private date = el('div', 'date-label')
  private monthBar = el('div', 'month-bar-fill')
  private toasts = el('div', 'toasts')
  private shownMonth = -1

  constructor(container: HTMLElement, builder: Builder, city: City, callbacks: HudCallbacks) {
    const hud = el('div', 'hud')

    // ---- Top left: coins and the calendar
    const status = el('div', 'status')
    const monthBar = el('div', 'month-bar')
    monthBar.append(this.monthBar)
    status.append(this.coins, this.date, monthBar)

    // ---- Top middle: what the current tool does, with a way out on touch screens (no Esc key)
    const hint = el('div', 'hint')
    const hintText = el('span', '')
    const done = el('button', 'hint-done', 'Done')
    done.addEventListener('click', () => builder.setMode({ kind: 'select' }))
    hint.append(hintText, done)
    hint.hidden = true

    const top = el('div', 'hud-top')
    top.append(hint, this.toasts)

    // ---- Top right
    const newTown = el('button', 'corner-button', 'New town')
    newTown.addEventListener('click', callbacks.onNewTown)

    // ---- Bottom: catalog and tools
    const catalog = el('div', 'catalog')
    catalog.hidden = true
    const catalogItems: [HTMLButtonElement, number][] = []
    for (const type of BUILDING_TYPES) {
      const item = el('button', 'catalog-item')
      item.append(
        el('span', 'catalog-name', type.name),
        el('span', 'catalog-meta', `${type.size.x}×${type.size.z} · 🪙 ${type.cost}`),
      )
      if (type.income) item.append(el('span', 'catalog-meta', `Earns 🪙 ${type.income.coins} / ${type.income.seconds}s`))
      if (type.category === 'farm') item.append(el('span', 'catalog-meta', 'Plant crops to sell'))
      item.addEventListener('click', () => {
        catalog.hidden = true
        builder.setMode({ kind: 'build', type })
      })
      catalog.append(item)
      catalogItems.push([item, type.cost])
    }

    const tools = {
      build: el('button', 'tool', 'Build'),
      move: el('button', 'tool', 'Move'),
      demolish: el('button', 'tool', 'Demolish'),
    }
    const taxes = el('button', 'tool', 'Taxes')
    tools.build.addEventListener('click', () => (catalog.hidden = !catalog.hidden))
    tools.move.addEventListener('click', () => {
      catalog.hidden = true
      builder.setMode(builder.mode.kind === 'move' ? { kind: 'select' } : { kind: 'move', carrying: null })
    })
    tools.demolish.addEventListener('click', () => {
      catalog.hidden = true
      builder.setMode(builder.mode.kind === 'demolish' ? { kind: 'select' } : { kind: 'demolish' })
    })
    taxes.addEventListener('click', () => {
      catalog.hidden = true
      callbacks.onOpenTaxes()
    })
    const bar = el('div', 'toolbar')
    bar.append(tools.build, tools.move, tools.demolish, taxes)

    const bottom = el('div', 'hud-bottom')
    bottom.append(catalog, bar)

    builder.onModeChange = (mode) => {
      hintText.textContent = hintFor(mode)
      hint.hidden = mode.kind === 'select'
      for (const [kind, button] of Object.entries(tools)) button.classList.toggle('active', kind === mode.kind)
    }
    builder.onNotice = (message) => this.toast(message)

    // Grey out what you can't afford, and bump the counter when coins change.
    const showCoins = () => {
      this.coins.textContent = `🪙 ${city.coins.toLocaleString()}`
      this.coins.classList.toggle('in-debt', city.coins < 0)
      for (const [item, cost] of catalogItems) item.disabled = city.coins < cost
    }
    city.onChange((event) => {
      if (event.kind !== 'coins') return
      showCoins()
      this.coins.classList.remove('bump')
      void this.coins.offsetWidth // force the browser to notice the removal, so the animation restarts
      this.coins.classList.add('bump')
    })
    showCoins()

    hud.append(status, top, newTown, bottom)
    container.append(hud)
  }

  // Called every frame; only touches the DOM when something visible changed.
  update(clock: GameClock) {
    if (clock.monthIndex !== this.shownMonth) {
      this.shownMonth = clock.monthIndex
      this.date.textContent = `Year ${clock.year} · ${MONTH_NAMES[clock.month]}`
    }
    this.monthBar.style.width = `${clock.monthProgress * 100}%`
  }

  // A message that shows for a few seconds at the top of the screen.
  toast(message: string, tone: 'info' | 'warn' = 'info') {
    const toast = el('div', `toast toast-${tone}`, message)
    this.toasts.append(toast)
    window.setTimeout(() => toast.remove(), 3500)
  }
}
