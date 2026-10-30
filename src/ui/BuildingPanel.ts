import type { City, PlacedBuilding } from '../game/City'
import { MAX_LEVEL, canUpgrade, levelFactor } from '../game/construction'
import { cropState } from '../game/crops'
import type { Docks } from '../game/Docks'
import type { Inventory } from '../game/Inventory'
import { MATERIALS, MATERIAL_IDS, materialsText, type Materials } from '../game/items'
import type { Player } from '../game/Player'
import { upgradeQuote } from '../game/projects'
import type { Services } from '../game/Services'
import type { Taxes } from '../game/Taxes'
import { UTILITIES, UTILITY_INFO } from '../game/utilityRules'
import { coins, duration, el, percent } from './dom'
import { isTrack, isPlot } from '../game/buildings'
import { CUSTOMER_REACH } from '../game/demand'
import { Sheet, button } from './Sheet'

// Everything about one building: status, a progress bar for whatever it's
// working on, goods, what its location and the town's services do to it,
// what it's worth, and actions. Opened from the context menu's Details.

export interface BuildingActions {
  collect: (b: PlacedBuilding) => void // collect, harvest, unload, finish: whatever a tap would do
  restock: (b: PlacedBuilding) => void
  upgrade: (b: PlacedBuilding) => void
  buyMaterials: (materials: Materials) => void
  move: (b: PlacedBuilding) => void
  store: (b: PlacedBuilding) => void
  remove: (b: PlacedBuilding) => void
}

// Can this building go into storage right now?
export function canStore(b: PlacedBuilding, city: City, docks: Docks): boolean {
  return city.isBuilt(b) && !isTrack(b.type) && !(b.type.category === 'port' && docks.state(b, Date.now()).stage !== 'idle')
}

export class BuildingPanel {
  private sheet: Sheet
  private building: PlacedBuilding | null = null
  private lastRender = 0
  private city: City
  private services: Services
  private taxes: Taxes
  private docks: Docks
  private inventory: Inventory
  private player: Player
  private describe: (b: PlacedBuilding, now: number) => [string, string]
  private actions: BuildingActions

  constructor(
    container: HTMLElement,
    deps: {
      city: City
      services: Services
      taxes: Taxes
      docks: Docks
      inventory: Inventory
      player: Player
      describe: (b: PlacedBuilding, now: number) => [string, string]
    },
    actions: BuildingActions,
  ) {
    this.city = deps.city
    this.services = deps.services
    this.taxes = deps.taxes
    this.docks = deps.docks
    this.inventory = deps.inventory
    this.player = deps.player
    this.describe = deps.describe
    this.actions = actions
    this.sheet = new Sheet(container, '')
    this.sheet.onClose = () => (this.building = null)
    deps.city.onChange((e) => {
      if (e.kind === 'removed' && e.building === this.building) this.sheet.close()
    })
  }

  open(building: PlacedBuilding) {
    this.building = building
    this.render(Date.now())
    this.sheet.open()
  }

  close() {
    this.sheet.close()
  }

  // Called every frame; redraws twice a second while open, for the timers.
  update(now: number) {
    if (!this.building || now - this.lastRender < 500) return
    this.render(now)
  }

  private render(now: number) {
    const b = this.building!
    this.lastRender = now
    const [title, status] = this.describe(b, now)
    this.sheet.setTitle(title)
    const parts: HTMLElement[] = [el('p', 'detail-status', status || b.type.name)]

    // ---- What it's working on, with a progress bar.
    const progress = this.progress(b, now)
    if (progress) {
      const track = el('div', 'progress')
      const fill = el('div', 'progress-fill')
      fill.style.width = `${Math.min(1, progress.share) * 100}%`
      track.append(fill)
      parts.push(section(progress.title, track, el('p', 'muted', progress.text)))
    }

    // ---- Construction: the materials it needs to finish.
    if (b.construction && b.type.build?.materials) {
      parts.push(section('🧱 Materials to finish', this.materialsList(b.type.build.materials)))
    }

    // ---- Goods: the shop's shelves, and the town storage they're filled from.
    if (b.type.goodsPerSale && this.city.isBuilt(b)) {
      const capacity = this.city.production.stockCapacity(b)
      const track = el('div', 'progress')
      const fill = el('div', 'progress-fill')
      fill.style.width = `${(b.stock / capacity) * 100}%`
      track.append(fill)
      parts.push(
        section(
          '📦 Stock',
          track,
          el('p', '', `${b.stock} of ${capacity} goods on the shelves · ${b.type.goodsPerSale} per sale`),
          el('p', 'muted', `Town storage: ${this.city.goods} of ${this.city.storageCapacity}. Restocking moves goods onto the shelves.`),
        ),
      )
    }

    // ---- Upgrade.
    if (this.city.isBuilt(b) && (b.type.category === 'home' || b.type.category === 'business')) {
      if (canUpgrade(b.type, b.level)) {
        const next = b.level + 1
        const cost = this.upgradeQuote(b)!
        parts.push(
          section(
            `⬆️ Upgrade to ${'★'.repeat(next)}`,
            el(
              'p',
              '',
              `Income${b.type.residents ? ', residents' : ''}${b.type.stockCapacity ? ', shelf space' : ''}: +${Math.round((levelFactor(b.level) - 1) * 100)}% now → +${Math.round((levelFactor(next) - 1) * 100)}% of the base building`,
            ),
            el(
              'p',
              '',
              `Costs ${coins(cost.coins)} and ${materialsText(cost.materials)} · needs level ${cost.playerLevel}` +
                (!cost.result.ok && cost.result.reason === 'room' ? ' · needs room for more residents' : ''),
            ),
            this.materialsList(cost.materials),
            el('p', 'muted', 'An upgrade is an improvement: its cost is added to what the building is depreciated on, and a building that earns more is assessed higher.'),
          ),
        )
      } else {
        parts.push(section(`⬆️ Level ${'★'.repeat(b.level)}`, el('p', 'muted', `Fully upgraded (level ${MAX_LEVEL}).`)))
      }
    }

    // ---- Location and services.
    const bonus = this.services.bonus(b)
    const share = this.services.utilityShare(b)
    const needs = UTILITIES.filter((u) => b.type.needs?.[u]).map((u) => `${UTILITY_INFO[u].icon} ${b.type.needs![u]}`)
    if (bonus.total > 0 || share < 1 || needs.length || b.type.customers) {
      const lines: HTMLElement[] = []
      if (needs.length) lines.push(el('p', '', `Uses ${needs.join(' ')}`))
      if (b.type.customers) {
        const customers = this.services.customersOf(b)
        const demand = this.services.demand(b)
        lines.push(
          el(
            'p',
            demand < 1 ? 'warning' : '',
            `👥 ${customers} residents live within ${CUSTOMER_REACH} tiles; it needs ${b.type.customers} for full sales${demand < 1 ? `, so it's selling at ${percent(demand)}. Build homes nearby.` : '.'}`,
          ),
        )
      }
      if (bonus.total > 0) {
        // "Oak Tree ×3, Park" rather than every tree by name.
        const counts = new Map<string, number>()
        for (const s of bonus.sources) counts.set(s, (counts.get(s) ?? 0) + 1)
        const from = [...counts].map(([name, n]) => (n > 1 ? `${name} ×${n}` : name)).join(', ')
        lines.push(el('p', '', `📍 +${percent(bonus.total)} from ${from}`))
      }
      if (share < 1) lines.push(el('p', 'warning', `⚠️ Earning only ${percent(share)}: the town is short on utilities.`))
      parts.push(section('🏘️ Location and services', ...lines))
    }

    // ---- Value and taxes.
    const property = this.taxes.properties().find((p) => p.building === b)
    if (property) {
      parts.push(
        section(
          '🧾 Value',
          el('p', '', `Assessed at ${coins(property.value)} · property tax ${coins(property.annualTax)} a year`),
          el('p', 'muted', `Cost ${coins(b.type.cost)}${b.type.upkeep ? ` · runs ${coins(b.type.upkeep)} a month` : ''}`),
        ),
      )
    }
    this.sheet.body.replaceChildren(...parts)

    // ---- Actions.
    const a = this.actions
    const buttons: HTMLElement[] = []
    const label = this.collectLabel(b, now)
    if (label) buttons.push(button(label, () => a.collect(b)))
    if (b.construction && b.type.build?.materials) {
      const missing = this.inventory.missing(b.type.build.materials)
      if (Object.keys(missing).length) {
        const price = this.inventory.priceOf(missing)
        const buy = button(`Buy missing for ${coins(price)}`, () => a.buyMaterials(missing))
        buy.disabled = this.city.coins < price
        buttons.push(buy)
      }
    }
    if (b.type.goodsPerSale && this.city.isBuilt(b)) {
      const restock = button('📦 Restock', () => a.restock(b))
      restock.disabled = b.stock >= this.city.production.stockCapacity(b) || this.city.goods === 0
      buttons.push(restock)
    }
    const quote = this.upgradeQuote(b)
    if (quote) {
      // projects.ts decides; the button only reflects it.
      const missing = quote.missing
      const upgrade = button('⬆️ Upgrade', () => a.upgrade(b))
      upgrade.disabled = !quote.result.ok
      buttons.push(upgrade)
      if (Object.keys(missing).length && this.player.level >= quote.playerLevel) {
        buttons.push(button(`Buy materials ${coins(this.inventory.priceOf(missing))}`, () => a.buyMaterials(missing), 'panel-button secondary'))
      }
    }
    buttons.push(button('✋ Move', () => a.move(b), 'panel-button secondary'))
    if (canStore(b, this.city, this.docks)) buttons.push(button('🎒 Store', () => a.store(b), 'panel-button secondary'))
    buttons.push(button('🗑️ Remove', () => a.remove(b), 'panel-button danger'))
    this.sheet.setButtons(...buttons)
  }

  // Each material needed, with how many you have.
  private materialsList(materials: Materials): HTMLElement {
    const list = el('div', 'materials')
    for (const id of MATERIAL_IDS) {
      const need = materials[id]
      if (!need) continue
      const have = this.inventory.count(id)
      list.append(el('span', have >= need ? 'have' : 'short', `${MATERIALS[id].icon} ${Math.min(have, need)}/${need}`))
    }
    return list
  }

  // What the building is working on: an income timer, a growing crop, a ship on its way.
  private progress(b: PlacedBuilding, now: number): { title: string; share: number; text: string } | null {
    if (b.construction && b.type.build) {
      const total = b.type.build.seconds * 1000
      const left = b.construction.endsAt - now
      return {
        title: '🚧 Construction',
        share: 1 - left / total,
        text: left > 0 ? `Ready to finish in ${duration(left)}` : 'Built! Finish it with the materials below.',
      }
    }
    if (b.type.income) {
      const total = b.type.income.seconds * 1000
      const left = b.readyAt - now
      return {
        title: '⏱️ Production',
        share: 1 - left / total,
        text: left > 0 ? `${coins(this.city.production.payout(b))} ready in ${duration(left)}` : `${coins(this.city.production.payout(b))} ready to collect`,
      }
    }
    const crop = cropState(b.crop, now)
    if (crop.stage === 'growing') {
      return { title: `🌱 ${crop.crop.name}`, share: crop.progress, text: `Ripe in ${duration(crop.readyAt - now)}` }
    }
    if (b.type.category === 'port') {
      const dock = this.docks.state(b, now)
      if (dock.stage !== 'idle') {
        const s = dock.shipment
        return {
          title: '🚢 Shipment',
          share: (now - s.orderedAt) / (s.arrivesAt - s.orderedAt),
          text: dock.stage === 'sailing' ? `📦 ${s.units} arriving in ${duration(s.arrivesAt - now)}` : `📦 ${s.units} waiting to unload`,
        }
      }
    }
    return null
  }

  private collectLabel(b: PlacedBuilding, now: number): string | null {
    if (b.construction) return this.city.production.constructionDone(b, now) ? '🔨 Finish' : null
    if (this.city.production.isReady(b, now) && this.city.production.hasStock(b)) return `🪙 Collect ${this.city.production.payout(b)}`
    const crop = cropState(b.crop, now)
    if (crop.stage === 'ripe') return '🧺 Harvest'
    if (crop.stage === 'withered') return '🥀 Clear'
    if (isPlot(b.type) && crop.stage === 'empty') return '🌱 Plant'
    if (b.type.category === 'port') {
      const stage = this.docks.state(b, now).stage
      return stage === 'arrived' ? '🚢 Unload' : stage === 'idle' ? '⚓ Order goods' : null
    }
    return null
  }

  private upgradeQuote(b: PlacedBuilding) {
    return upgradeQuote(this.city, this.inventory, this.player, b, (n) => this.services.roomFor(n))
  }
}

function section(title: string, ...children: HTMLElement[]): HTMLElement {
  const s = el('section', 'detail-section')
  s.append(el('h3', '', title), ...children)
  return s
}
