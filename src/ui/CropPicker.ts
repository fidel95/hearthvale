import type { City, PlacedBuilding } from '../game/City'
import { CROP_TYPES, cropState, profitPerMinute, type CropType } from '../game/crops'
import { coins, el, timeSpan } from './dom'

// The seed window that opens when you tap an empty farm plot. Each crop shows
// what it costs, what it sells for, how long it takes and how long it stays
// fresh, so choosing is a real decision: quick crops earn the most per minute
// but wither if you're not around; slow ones can be left overnight.

export class CropPicker {
  private overlay = el('div', 'overlay')
  private list = el('div', 'crop-grid')
  private allRow = el('label', 'crop-all')
  private allBox = el('input', '')
  private allText = el('span', '')
  private city: City
  private onNotice: (message: string) => void
  private plot: PlacedBuilding | null = null

  constructor(container: HTMLElement, city: City, onNotice: (message: string) => void) {
    this.city = city
    this.onNotice = onNotice

    const card = el('div', 'panel crop-panel')
    const header = el('div', 'panel-header')
    const close = el('button', 'panel-close', '✕')
    close.setAttribute('aria-label', 'Close')
    close.addEventListener('click', () => this.close())
    header.append(el('h2', '', '🌱 Plant a crop'), close)

    this.allBox.type = 'checkbox'
    this.allRow.append(this.allBox, this.allText)

    const body = el('div', 'panel-body')
    body.append(this.allRow, this.list)
    card.append(header, body)
    this.overlay.append(card)
    this.overlay.hidden = true
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close()
    })
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close()
    })
    container.append(this.overlay)

    // Re-check what's affordable if coins change while the window is open.
    city.onChange((e) => e.kind === 'coins' && this.plot && this.render())
  }

  open(plot: PlacedBuilding) {
    this.plot = plot
    this.allBox.checked = false
    this.render()
    this.overlay.hidden = false
  }

  close() {
    this.plot = null
    this.overlay.hidden = true
  }

  // Every empty plot, with the one that was tapped first.
  private emptyPlots(): PlacedBuilding[] {
    const now = Date.now()
    const plots = [...this.city.all()].filter(
      (b) => b.type.category === 'farm' && b !== this.plot && cropState(b.crop, now).stage === 'empty',
    )
    return this.plot ? [this.plot, ...plots] : plots
  }

  private render() {
    const empty = this.emptyPlots().length
    this.allRow.hidden = empty < 2
    this.allText.textContent = `Plant all ${empty} empty plots`

    this.list.replaceChildren(
      ...CROP_TYPES.map((crop) => {
        const item = el('button', 'catalog-item crop-item')
        const profit = crop.sellPrice - crop.seedCost
        item.append(
          el('span', 'catalog-name', `${crop.emoji} ${crop.name}`),
          el('span', 'catalog-meta', `Seeds ${coins(crop.seedCost)} → sells ${coins(crop.sellPrice)}`),
          el('span', 'catalog-meta', `Ready in ${timeSpan(crop.growSeconds)} · fresh for ${timeSpan(crop.freshSeconds)}`),
          el('span', 'crop-profit', `Profit ${coins(profit)} · ${coins(profitPerMinute(crop))}/min`),
        )
        item.disabled = this.city.coins < crop.seedCost
        item.addEventListener('click', () => this.plant(crop))
        return item
      }),
    )
  }

  private plant(crop: CropType) {
    const plots = this.allBox.checked ? this.emptyPlots() : this.plot ? [this.plot] : []
    let planted = 0
    for (const plot of plots) {
      if (!this.city.plant(plot.id, crop)) break // out of coins
      planted++
    }
    if (planted < plots.length) {
      this.onNotice(`Planted ${planted} of ${plots.length} plots: not enough coins for more ${crop.name.toLowerCase()} seeds`)
    }
    this.close()
  }
}
