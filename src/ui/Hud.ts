import { BUILDING_TYPES, type Category } from '../game/buildings'
import type { Builder, Mode } from '../game/Builder'
import type { City } from '../game/City'
import { MONTH_NAMES, type GameClock } from '../game/GameClock'
import type { Player } from '../game/Player'
import type { Services } from '../game/Services'
import { ROAD_BONUS } from '../game/communityRules'
import { UTILITIES, UTILITY_INFO } from '../game/utilityRules'
import { duration, el } from './dom'

// The HTML overlay on top of the canvas: coins, level, energy and calendar (top left),
// hints and messages (top middle), New town (top right), the build catalog
// and tool buttons (bottom). It changes the game only through Builder and
// callbacks, and reads from City, Player and GameClock.

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

// The build menu's tabs, and which categories each one shows.
const CATALOG_TABS: { label: string; categories: Category[] }[] = [
  { label: 'Homes', categories: ['home'] },
  { label: 'Shops', categories: ['business', 'port'] },
  { label: 'Farms', categories: ['farm', 'storage'] },
  { label: 'Town', categories: ['road', 'community'] },
  { label: 'Utilities', categories: ['utility'] },
  { label: 'Decor', categories: ['decoration'] },
]

export interface HudCallbacks {
  onOpenTaxes: () => void
  onOpenTown: () => void
  onNewTown: () => void
}

export class Hud {
  private coins = el('div', 'coins')
  private level = el('div', 'level-label')
  private xpBar = el('div', 'xp-fill')
  private energy = el('div', 'energy')
  private town = el('div', 'town-line')
  private goods = el('div', 'town-line')
  private date = el('div', 'date-label')
  private monthBar = el('div', 'month-bar-fill')
  private toasts = el('div', 'toasts')
  private shownMonth = -1
  private player: Player

  constructor(
    container: HTMLElement,
    builder: Builder,
    city: City,
    player: Player,
    services: Services,
    callbacks: HudCallbacks,
  ) {
    this.player = player
    const hud = el('div', 'hud')

    // ---- Top left: coins, level and XP, energy, and the calendar
    const status = el('div', 'status')
    const monthBar = el('div', 'month-bar')
    monthBar.append(this.monthBar)
    const xpBar = el('div', 'xp-bar')
    xpBar.append(this.xpBar)
    status.append(this.coins, this.level, xpBar, this.energy, this.town, this.goods, this.date, monthBar)

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
    const tabs = el('div', 'catalog-tabs')
    const grid = el('div', 'catalog-grid')
    catalog.append(tabs, grid)
    // Every building is listed; ones above your level show what level unlocks them.
    const catalogItems = BUILDING_TYPES.map((type) => {
      const item = el('button', 'catalog-item')
      const lock = el('span', 'catalog-meta catalog-lock', `🔒 Unlocks at level ${type.unlockLevel}`)
      item.append(
        el('span', 'catalog-name', type.name),
        el('span', 'catalog-meta', `${type.size.x}×${type.size.z} · 🪙 ${type.cost}`),
      )
      if (type.income) item.append(el('span', 'catalog-meta', `Earns 🪙 ${type.income.coins} / ${type.income.seconds}s`))
      if (type.category === 'farm') item.append(el('span', 'catalog-meta', 'Plant crops to sell'))
      if (type.needs) {
        const needs = UTILITIES.filter((u) => type.needs?.[u]).map((u) => `${UTILITY_INFO[u].icon}${type.needs![u]}`)
        const people = type.residents ? `👥 ${type.residents} · ` : ''
        item.append(el('span', 'catalog-meta', `${people}uses ${needs.join(' ')}`))
      }
      if (type.goodsPerSale) item.append(el('span', 'catalog-meta', `Sells 📦 ${type.goodsPerSale} goods each time`))
      if (type.storage) item.append(el('span', 'catalog-meta', `Stores 📦 ${type.storage} goods`))
      if (type.onShore) item.append(el('span', 'catalog-meta', 'Build on the shore · order shipments by sea'))
      if (type.supplies) {
        const { utility, amount } = type.supplies
        item.append(el('span', 'catalog-meta', `Supplies ${UTILITY_INFO[utility].icon} ${amount}`))
      }
      if (type.amenity) {
        const { bonus, radius } = type.amenity
        item.append(el('span', 'catalog-meta', `+${bonus * 100}% for homes & shops within ${radius} tiles`))
      }
      if (type.category === 'road') item.append(el('span', 'catalog-meta', `Drag to draw · homes & shops beside a road earn +${ROAD_BONUS * 100}%`))
      if (type.upkeep) item.append(el('span', 'catalog-meta', `🪙 ${type.upkeep}/month to run`))
      item.append(lock)
      item.addEventListener('click', () => {
        catalog.hidden = true
        builder.setMode({ kind: 'build', type })
      })
      grid.append(item)
      return { item, lock, type }
    })
    const showTab = (tab: (typeof CATALOG_TABS)[number]) => {
      for (const { item, type } of catalogItems) item.hidden = !tab.categories.includes(type.category)
      for (const button of tabs.children) button.classList.toggle('active', button.textContent === tab.label)
    }
    for (const tab of CATALOG_TABS) {
      const button = el('button', 'catalog-tab', tab.label)
      button.addEventListener('click', () => showTab(tab))
      tabs.append(button)
    }
    showTab(CATALOG_TABS[0])
    const refreshCatalog = () => {
      for (const { item, lock, type } of catalogItems) {
        const unlocked = player.isUnlocked(type)
        item.classList.toggle('locked', !unlocked)
        lock.hidden = unlocked
        item.disabled = !unlocked || city.coins < type.cost
      }
    }

    const tools = {
      build: el('button', 'tool', 'Build'),
      move: el('button', 'tool', 'Move'),
      demolish: el('button', 'tool', 'Demolish'),
    }
    const taxes = el('button', 'tool', 'Taxes')
    const town = el('button', 'tool', 'Town')
    town.addEventListener('click', () => {
      catalog.hidden = true
      callbacks.onOpenTown()
    })
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
    bar.append(tools.build, tools.move, tools.demolish, taxes, town)

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
      refreshCatalog()
    }
    city.onChange((event) => {
      if (event.kind !== 'coins') return
      showCoins()
      this.coins.classList.remove('bump')
      void this.coins.offsetWidth // force the browser to notice the removal, so the animation restarts
      this.coins.classList.add('bump')
    })
    showCoins()

    const showLevel = () => {
      this.level.textContent = `⭐ Level ${player.level} · ${player.xp.toLocaleString()} XP`
      this.xpBar.style.width = `${player.levelProgress * 100}%`
    }
    // Any change (XP, a level-up, loading a save) can change the level and what's unlocked.
    player.onChange(() => {
      showLevel()

    // Population, and each utility as used/supplied, red when it falls short.
    const showTown = () => {
      const r = services.report
      const chips = UTILITIES.map((u) => {
        const { demand, supply, level } = r.utilities[u]
        return el('span', level < 1 ? 'short' : '', `${UTILITY_INFO[u].icon}${demand}/${supply}`)
      })
      this.town.replaceChildren(el('span', '', `👥 ${r.population}`), ...chips)
    }
    services.onChange(showTown)
    showTown()

    // Goods in storage, out of what fits. Red when full: harvests are being sold off instead.
    const showGoods = () => {
      const full = city.goods >= city.storageCapacity
      this.goods.replaceChildren(el('span', full ? 'short' : '', `📦 ${city.goods}/${city.storageCapacity} goods`))
    }
    city.onChange((e) => (e.kind === 'goods' || e.kind === 'added' || e.kind === 'removed') && showGoods())
    showGoods()
      refreshCatalog()
    })
    showLevel()

    hud.append(status, top, newTown, bottom)
    container.append(hud)
  }

  // Called every frame; only touches the DOM when something visible changed.
  update(clock: GameClock, now: number) {
    // Energy refills with time, so it's checked every frame rather than on events.
    const energy = this.player.energy(now)
    const next = this.player.nextEnergyAt(now)
    const text = `⚡ ${energy}/${this.player.maxEnergy}${next ? ` · +1 in ${duration(next - now)}` : ''}`
    if (this.energy.textContent !== text) this.energy.textContent = text
    this.energy.classList.toggle('empty', energy === 0)

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
