import { BUILDING_TYPES, type BuildingType, type Category } from '../game/buildings'
import type { City } from '../game/City'
import { ROAD_BONUS } from '../game/communityRules'
import type { Player } from '../game/Player'
import type { Services } from '../game/Services'
import { UTILITIES, UTILITY_INFO } from '../game/utilityRules'
import { el } from './dom'
import { Sheet, button } from './Sheet'
import { thumbnail } from './thumbnails'

// The build menu: tabs by kind of building, a card for each with a picture,
// cost, size, level and what it earns, and a preview of the chosen one with
// everything about it and a Place button. Locked and unaffordable cards stay
// visible and say exactly what's missing.

const TABS: { label: string; categories: Category[] }[] = [
  { label: '🏠 Homes', categories: ['home'] },
  { label: '🏪 Businesses', categories: ['business', 'port'] },
  { label: '🏫 Community', categories: ['community', 'utility'] },
  { label: '🌾 Farms', categories: ['farm', 'storage'] },
  { label: '🛣️ Roads', categories: ['road'] },
  { label: '🌳 Decor', categories: ['decoration'] },
]

// One line on what a building does, for its card.
function headline(type: BuildingType): string {
  if (type.income) return `🪙 ${type.income.coins} every ${type.income.seconds}s`
  if (type.supplies) return `Supplies ${UTILITY_INFO[type.supplies.utility].icon} ${type.supplies.amount}`
  if (type.amenity) return `+${type.amenity.bonus * 100}% nearby`
  if (type.storage) return `Stores 📦 ${type.storage}`
  if (type.category === 'farm') return 'Grows crops'
  if (type.category === 'road') return `+${ROAD_BONUS * 100}% beside it`
  return 'Decoration'
}

// Everything about a building, for the preview.
function details(type: BuildingType): string[] {
  const lines: string[] = []
  if (type.income) lines.push(`Earns 🪙 ${type.income.coins} every ${type.income.seconds} seconds`)
  if (type.residents) lines.push(`Home to 👥 ${type.residents} residents`)
  if (type.goodsPerSale) lines.push(`Sells 📦 ${type.goodsPerSale} goods each time`)
  if (type.category === 'farm') lines.push('Plant crops on it: harvests stock your shops or sell at market')
  if (type.storage) lines.push(`Stores 📦 ${type.storage} goods`)
  if (type.supplies) lines.push(`Supplies ${UTILITY_INFO[type.supplies.utility].icon} ${type.supplies.amount} ${UTILITY_INFO[type.supplies.utility].name.toLowerCase()}`)
  if (type.amenity) lines.push(`+${type.amenity.bonus * 100}% income for homes and shops within ${type.amenity.radius} tiles`)
  if (type.populationCapacity) lines.push(`Room for 👥 ${type.populationCapacity} more residents in town`)
  if (type.category === 'road') lines.push(`Drag to draw. Homes and shops beside a road earn +${ROAD_BONUS * 100}%`)
  if (type.onShore) lines.push('Must be built on the shore. Order shipments of goods here')
  const needs = UTILITIES.filter((u) => type.needs?.[u]).map((u) => `${UTILITY_INFO[u].icon} ${type.needs![u]}`)
  if (needs.length) lines.push(`Uses ${needs.join(' ')}`)
  if (type.upkeep) lines.push(`Costs 🪙 ${type.upkeep} a month to run`)
  return lines
}

export class BuildMenu {
  private sheet: Sheet
  private tabs = el('div', 'catalog-tabs')
  private grid = el('div', 'catalog-grid')
  private preview = el('div', 'build-preview')
  private cards: { card: HTMLButtonElement; status: HTMLElement; type: BuildingType }[] = []
  private chosen: BuildingType | null = null
  private city: City
  private player: Player
  private services: Services
  private onPlace: (type: BuildingType) => void

  constructor(container: HTMLElement, city: City, player: Player, services: Services, onPlace: (type: BuildingType) => void) {
    this.city = city
    this.player = player
    this.services = services
    this.onPlace = onPlace
    this.sheet = new Sheet(container, '🔨 Build', 'build-sheet')
    this.sheet.body.append(this.tabs, this.grid)
    this.sheet.footer.append(this.preview)

    for (const tab of TABS) {
      const b = el('button', 'catalog-tab', tab.label)
      b.addEventListener('click', () => this.showTab(tab))
      this.tabs.append(b)
    }
    for (const type of BUILDING_TYPES) {
      const card = el('button', 'build-card')
      const picture = el('img', 'build-thumb')
      picture.alt = ''
      const status = el('span', 'build-status')
      card.append(
        picture,
        el('span', 'build-name', type.name),
        el('span', 'build-meta', `🪙 ${type.cost.toLocaleString()} · ${type.size.x}×${type.size.z}`),
        el('span', 'build-meta', headline(type)),
        status,
      )
      card.addEventListener('click', () => this.choose(type))
      this.grid.append(card)
      this.cards.push({ card, status, type })
    }
    this.showTab(TABS[0])

    city.onChange((e) => e.kind === 'coins' && this.sheet.isOpen && this.refresh())
    player.onChange(() => this.sheet.isOpen && this.refresh())
  }

  open() {
    this.refresh()
    this.sheet.open()
    // Pictures are drawn the first time the menu opens, not at startup.
    for (const { card, type } of this.cards) {
      const img = card.querySelector('img')!
      if (!img.src) thumbnail(type).then((url) => (img.src = url))
    }
  }

  close() {
    this.sheet.close()
  }

  private showTab(tab: (typeof TABS)[number]) {
    for (const { card, type } of this.cards) card.hidden = !tab.categories.includes(type.category)
    for (const b of this.tabs.children) b.classList.toggle('active', b.textContent === tab.label)
    this.choose(null)
  }

  // Lock and price status on every card.
  private refresh() {
    for (const { card, status, type } of this.cards) {
      const locked = !this.player.isUnlocked(type)
      const short = type.cost - this.city.coins
      const noRoom = !this.services.roomFor(type.residents ?? 0)
      card.classList.toggle('locked', locked)
      card.classList.toggle('unaffordable', !locked && (short > 0 || noRoom))
      status.textContent = locked
        ? `🔒 Reach level ${type.unlockLevel}`
        : short > 0
          ? `Need 🪙 ${short.toLocaleString()} more`
          : noRoom
            ? '👥 No room: build community buildings'
            : ''
      status.hidden = status.textContent === ''
    }
    if (this.chosen) this.choose(this.chosen)
  }

  // Preview a building at the bottom of the sheet, with a Place button.
  private choose(type: BuildingType | null) {
    this.chosen = type
    for (const { card, type: t } of this.cards) card.classList.toggle('chosen', t === type)
    this.sheet.footer.hidden = type === null
    if (!type) return

    const locked = !this.player.isUnlocked(type)
    const short = type.cost - this.city.coins
    const noRoom = !this.services.roomFor(type.residents ?? 0)
    const list = el('ul', 'build-details')
    for (const line of details(type)) list.append(el('li', '', line))
    const place = button(
      locked
        ? `🔒 Reach level ${type.unlockLevel}`
        : short > 0
          ? `Need 🪙 ${short.toLocaleString()} more`
          : noRoom
            ? '👥 No room for more residents'
            : `Place for 🪙 ${type.cost.toLocaleString()}`,
      () => {
        this.sheet.close()
        this.onPlace(type)
      },
    )
    place.disabled = locked || short > 0 || noRoom
    const title = el('div', 'build-preview-title')
    title.append(el('strong', '', type.name), el('span', 'muted', ` · ${type.size.x}×${type.size.z} tiles`))
    this.preview.replaceChildren(title, list, place)
  }
}
