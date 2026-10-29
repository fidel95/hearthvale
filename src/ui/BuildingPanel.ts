import type { City, PlacedBuilding } from '../game/City'
import { cropState } from '../game/crops'
import type { Docks } from '../game/Docks'
import type { Services } from '../game/Services'
import type { Taxes } from '../game/Taxes'
import { UTILITIES, UTILITY_INFO } from '../game/utilityRules'
import { coins, duration, el, percent } from './dom'
import { Sheet, button } from './Sheet'

// Everything about one building: status, a progress bar for whatever it's
// working on, goods, what its location and the town's services do to it,
// what it's worth, and actions. Opened from the context menu's Details.

export interface BuildingActions {
  collect: (b: PlacedBuilding) => void // collect, harvest or unload: whatever a tap would do
  move: (b: PlacedBuilding) => void
  remove: (b: PlacedBuilding) => void
  extra?: (b: PlacedBuilding) => HTMLElement[] // more buttons, added by later systems
}

export class BuildingPanel {
  private sheet: Sheet
  private building: PlacedBuilding | null = null
  private lastRender = 0
  private city: City
  private services: Services
  private taxes: Taxes
  private docks: Docks
  private describe: (b: PlacedBuilding, now: number) => [string, string]
  private actions: BuildingActions

  constructor(
    container: HTMLElement,
    deps: { city: City; services: Services; taxes: Taxes; docks: Docks; describe: (b: PlacedBuilding, now: number) => [string, string] },
    actions: BuildingActions,
  ) {
    this.city = deps.city
    this.services = deps.services
    this.taxes = deps.taxes
    this.docks = deps.docks
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

    // ---- Goods.
    if (b.type.goodsPerSale) {
      parts.push(
        section(
          '📦 Goods',
          el('p', '', `Uses ${b.type.goodsPerSale} goods per sale. Town storage: ${this.city.goods} of ${this.city.storageCapacity}.`),
        ),
      )
    }

    // ---- Location and services.
    const bonus = this.services.bonus(b)
    const share = this.services.utilityShare(b)
    const needs = UTILITIES.filter((u) => b.type.needs?.[u]).map((u) => `${UTILITY_INFO[u].icon} ${b.type.needs![u]}`)
    if (bonus.total > 0 || share < 1 || needs.length) {
      const lines: HTMLElement[] = []
      if (needs.length) lines.push(el('p', '', `Uses ${needs.join(' ')}`))
      if (bonus.total > 0) lines.push(el('p', '', `📍 +${percent(bonus.total)} from ${bonus.sources.join(', ')}`))
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
    const buttons: HTMLElement[] = []
    const label = this.collectLabel(b, now)
    if (label) buttons.push(button(label, () => this.actions.collect(b)))
    buttons.push(...(this.actions.extra?.(b) ?? []))
    buttons.push(button('✋ Move', () => this.actions.move(b), 'panel-button secondary'))
    buttons.push(button('🗑️ Remove', () => this.actions.remove(b), 'panel-button danger'))
    this.sheet.setButtons(...buttons)
  }

  // What the building is working on: an income timer, a growing crop, a ship on its way.
  private progress(b: PlacedBuilding, now: number): { title: string; share: number; text: string } | null {
    if (b.type.income) {
      const total = b.type.income.seconds * 1000
      const left = b.readyAt - now
      return {
        title: '⏱️ Production',
        share: 1 - left / total,
        text: left > 0 ? `${coins(this.city.payout(b))} ready in ${duration(left)}` : `${coins(this.city.payout(b))} ready to collect`,
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
    if (this.city.isReady(b, now) && this.city.hasStock(b)) return `🪙 Collect ${this.city.payout(b)}`
    const crop = cropState(b.crop, now)
    if (crop.stage === 'ripe') return '🧺 Harvest'
    if (crop.stage === 'withered') return '🥀 Clear'
    if (b.type.category === 'farm' && crop.stage === 'empty') return '🌱 Plant'
    if (b.type.category === 'port') {
      const stage = this.docks.state(b, now).stage
      return stage === 'arrived' ? '🚢 Unload' : stage === 'idle' ? '⚓ Order goods' : null
    }
    return null
  }
}

function section(title: string, ...children: HTMLElement[]): HTMLElement {
  const s = el('section', 'detail-section')
  s.append(el('h3', '', title), ...children)
  return s
}
