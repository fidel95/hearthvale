import { BUILDING_TYPES, type BuildingType, type Category, isPlot } from '../game/buildings'
import type { City } from '../game/City'
import { roadBonus } from '../game/communityRules'
import type { PlacementSystem } from '../game/PlacementSystem'
import type { Player } from '../game/Player'
import type { UnlockSystem } from '../game/UnlockSystem'
import { UTILITIES, UTILITY_INFO } from '../game/utilityRules'
import { el } from './dom'
import { Sheet, button } from './Sheet'
import { PARADE } from '../game/Army'
import { PRODUCTS, soldBy } from '../game/products'
import { thumbnail } from './thumbnails'

// The build menu, laid out like a shop: tabs by kind of building, a card for
// each with a picture, what it earns, its size and a price tag (a padlock
// and the level while it's locked, and a "New!" ribbon on what the latest
// level unlocked), and a preview of the chosen one with
// everything about it and a Place button. Locked and unaffordable cards stay
// visible and say exactly what's missing.

const TABS: { label: string; categories: Category[] }[] = [
  { label: '🏠 Homes', categories: ['home'] },
  { label: '🏪 Businesses', categories: ['business', 'port'] },
  { label: '🏫 Community', categories: ['community', 'utility'] },
  { label: '🌾 Farms', categories: ['farm', 'storage'] },
  { label: '🏭 Industry', categories: ['industry'] },
  { label: '🛣️ Transport', categories: ['road', 'rail', 'air'] },
  { label: '🌳 Decor', categories: ['decoration'] },
  { label: '🏛️ Landmarks', categories: ['landmark'] },
]

// One line on what a building does, for its card.
function headline(type: BuildingType): string {
  if (type.income) return `🪙 ${type.income.coins} every ${type.income.seconds}s`
  if (type.supplies) return `Supplies ${UTILITY_INFO[type.supplies.utility].icon} ${type.supplies.amount}`
  if (type.amenity) return `+${type.amenity.bonus * 100}% nearby`
  if (type.storage) return `Stores 📦 ${type.storage}`
  if (isPlot(type)) return 'Grows crops'
  if (type.category === 'road') return `+${Math.round(roadBonus(type) * 100)}% beside it`
  if (type.id === 'rail') return 'Trains run on it'
  if (type.townBonus) return `+${Math.round(type.townBonus * 100)}% town-wide`
  return 'Decoration'
}

// Everything about a building, for the preview.
function details(type: BuildingType): string[] {
  const lines: string[] = []
  if (type.income) lines.push(`Earns 🪙 ${type.income.coins} every ${type.income.seconds} seconds`)
  if (type.residents) lines.push(`Home to 👥 ${type.residents} residents`)
  if (type.goodsPerSale) {
    const sold = soldBy(type)
    lines.push(`Sells ${sold.icon} ${type.goodsPerSale} ${sold.name.toLowerCase()} each time`)
  }
  if (type.factory) {
    const p = PRODUCTS[type.factory.product]
    lines.push(`Makes ${p.icon} ${type.factory.output} ${p.name.toLowerCase()} from 📦 ${type.factory.input} goods every ${type.factory.seconds}s`)
  }
  if (isPlot(type)) lines.push('Plant crops on it: harvests stock your shops or sell at market')
  if (type.storage) lines.push(`Stores 📦 ${type.storage} goods`)
  if (type.supplies) lines.push(`Supplies ${UTILITY_INFO[type.supplies.utility].icon} ${type.supplies.amount} ${UTILITY_INFO[type.supplies.utility].name.toLowerCase()}`)
  if (type.amenity) {
    const reach = type.amenity.radius === 0 ? 'right beside it' : `within ${type.amenity.radius} tile${type.amenity.radius === 1 ? '' : 's'}`
    const cap = type.category === 'decoration' ? ' (decorations add up to +10% at most)' : ''
    lines.push(`+${Math.round(type.amenity.bonus * 100)}% income for homes and shops ${reach}${cap}`)
  }
  if (type.populationCapacity) lines.push(`Room for 👥 ${type.populationCapacity} more residents in town`)
  if (type.category === 'road') lines.push(`Drag to draw. Homes and shops beside it earn +${Math.round(roadBonus(type) * 100)}% (the best road beside them counts). Every kind of road joins up with the others`)
  if (type.onShore) lines.push('Must be built on the shore. Order shipments of goods here')
  if (type.nearMountain) lines.push('⛰️ Must be built at the foot of a mountain, in the Highlands (buy land to the east)')
  if (type.id === 'spaceport') lines.push('🚀 A rocket lifts off every few minutes')
  if (type.id === 'tunnel-works') lines.push('🛠️ A tunnel boring machine drills into the mountain, and a conveyor brings out the rock')
  if (type.id === 'cable-car') lines.push('🚡 Cabins ride up and down the mountainside')
  if (type.requiresRoad) lines.push('🛣️ Needs a road touching one of its sides to open')
  if (type.id === 'rail') lines.push('Drag to lay track. A Train Station beside it runs a train to the end of the line and back')
  if (type.requiresRail) lines.push('🛤️ Needs railway track touching one of its sides; its train runs along the track')
  if (type.id === 'bus-stop') lines.push('🚌 Buses drive from stop to stop on your roads')
  if (type.id === 'army-base') {
    lines.push('🪖 A squad drills on the parade ground, a sentry keeps watch, a helicopter flies, and a jeep patrols')
    lines.push(`🎖️ Hold a parade (🪙 ${PARADE.cost}): +${PARADE.bonus * 100}% to all rent and sales for ${PARADE.durationMs / 60_000} minutes`)
  }
  if (type.id === 'coal-mine') lines.push('⛏️ An excavator digs coal from the pit and loads a haul truck that drives it up to the stockpile; the coal sells as income')
  if (type.id === 'landfill') lines.push('🚛 Garbage trucks tip here and a bulldozer spreads it: cheaper to run than a Recycling Center, but it takes more room')
  if (type.id === 'airport') lines.push('✈️ Planes take off, fly a lap round the whole map and land')
  if (type.arrivals) lines.push(`🧳 Brings ${type.arrivals} visitors a month`)
  if (type.visitors) lines.push(`🎡 Room for ${type.visitors} visitors a month (each spends 🪙 2)`)
  if (type.animals) lines.push(`🐾 ${type.animals.count} ${type.animals.kind === 'sheep' ? 'sheep' : type.animals.kind + 's'} live here; what they give sells as farm income`)
  if (type.id === 'public-beach') lines.push('🏖️ Sunbathers and swimmers come when it isn\'t raining')
  if (type.id === 'ski-resort') lines.push('⛷️ Skiers ski down and ride the chairlift back up')
  if (type.townBonus) lines.push(`+${Math.round(type.townBonus * 100)}% to all rent and sales in town`)
  if (type.shipSpeedBonus) lines.push(`Ships arrive ${Math.round(type.shipSpeedBonus * 100)}% sooner`)
  if (type.minRating) lines.push(`Needs a city rating of ${type.minRating} (see Town)`)
  if (type.unique) lines.push('One of a kind: you can only build one')
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
  private cards: { card: HTMLButtonElement; status: HTMLElement; price: HTMLElement; type: BuildingType }[] = []
  private player: Player
  private chosen: BuildingType | null = null
  private placement: PlacementSystem
  private unlocks: UnlockSystem
  // Called when the menu closes (Game forgets a "Build here" spot then).
  onClosed?: () => void
  private onPlace: (type: BuildingType) => void

  constructor(
    container: HTMLElement,
    city: City,
    player: Player,
    placement: PlacementSystem,
    unlocks: UnlockSystem,
    onPlace: (type: BuildingType) => void,
  ) {
    this.placement = placement
    this.unlocks = unlocks
    this.player = player
    this.onPlace = onPlace
    this.sheet = new Sheet(container, '🔨 Build', 'build-sheet')
    this.sheet.onClose = () => this.onClosed?.()
    this.sheet.body.append(this.tabs, this.grid)
    this.sheet.footer.append(this.preview)

    for (const tab of TABS) {
      const b = el('button', 'catalog-tab', tab.label)
      b.addEventListener('click', () => this.showTab(tab))
      this.tabs.append(b)
    }
    // Cheapest first within each level, so each tab reads as a path from small to big.
    const ordered = [...BUILDING_TYPES].sort((a, b) => a.unlockLevel - b.unlockLevel || a.cost - b.cost)
    for (const type of ordered) {
      const card = el('button', 'build-card')
      const picture = el('img', 'build-thumb')
      picture.alt = ''
      const status = el('span', 'build-status')
      const price = el('span', 'build-price')
      const footer = el('span', 'build-footer')
      footer.append(el('span', 'build-size', `${type.size.x}×${type.size.z}`), price)
      card.append(picture, el('span', 'build-new', 'New!'), el('span', 'build-name', type.name), el('span', 'build-meta', headline(type)), status, footer)
      card.addEventListener('click', () => this.choose(type))
      this.grid.append(card)
      this.cards.push({ card, status, price, type })
    }
    this.showTab(TABS[0])

    city.onChange((e) => e.kind === 'coins' && this.sheet.isOpen && this.refresh())
    player.onChange(() => this.sheet.isOpen && this.refresh())
  }

  // tab: open on the tab whose label contains this (e.g. 'Community').
  open(tab?: string) {
    this.refresh()
    const wanted = tab && TABS.find((t) => t.label.includes(tab))
    if (wanted) this.showTab(wanted)
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
    for (const { card, status, price, type } of this.cards) {
      // The placement system says what's in the way; the menu only shows it.
      const check = this.placement.check(type)
      const locked = !this.unlocks.isUnlocked(type)
      card.classList.toggle('locked', locked)
      card.classList.toggle('unaffordable', !locked && !check.ok)
      card.classList.toggle('new', !locked && type.unlockLevel === this.player.level && this.player.level > 1)
      price.textContent = locked ? `🔒 Level ${type.unlockLevel}` : this.placement.freeBuild ? 'Free' : `🪙 ${type.cost.toLocaleString()}`
      // The price tag already says it's locked.
      status.textContent = locked ? '' : (check.problems[0] ?? '')
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

    const check = this.placement.check(type)
    const list = el('ul', 'build-details')
    for (const line of details(type)) list.append(el('li', '', line))
    const price = this.placement.freeBuild ? 'Place (free: admin)' : `Place for 🪙 ${type.cost.toLocaleString()}`
    const place = button(check.problems[0] ?? price, () => {
      this.onPlace(type)
      this.sheet.close()
    })
    place.disabled = !check.ok
    const title = el('div', 'build-preview-title')
    title.append(el('strong', '', type.name), el('span', 'muted', ` · ${type.size.x}×${type.size.z} tiles`))
    this.preview.replaceChildren(title, list, place)
  }
}
