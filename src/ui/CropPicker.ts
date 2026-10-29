import type { City, PlacedBuilding } from '../game/City'
import { CROP_TYPES, cropState, profitPerMinute, type CropType } from '../game/crops'
import type { Player } from '../game/Player'
import { coins, el, outOfEnergyMessage, timeSpan } from './dom'
import { Sheet } from './Sheet'

// The seed window that opens when you tap an empty farm plot. Each crop shows
// what it costs, what it sells for, how long it takes and how long it stays
// fresh, so choosing is a real decision: quick crops earn the most per minute
// but wither if you're not around; slow ones can be left overnight.
// Crops above your level are shown locked, so you can see what's coming.

export class CropPicker {
  private sheet: Sheet
  private list = el('div', 'crop-grid')
  private allRow = el('label', 'crop-all')
  private allBox = el('input', '')
  private allText = el('span', '')
  private city: City
  private player: Player
  private onNotice: (message: string) => void
  private plot: PlacedBuilding | null = null

  constructor(container: HTMLElement, city: City, player: Player, onNotice: (message: string) => void) {
    this.city = city
    this.player = player
    this.onNotice = onNotice
    this.sheet = new Sheet(container, '🌱 Plant a crop')
    this.sheet.onClose = () => (this.plot = null)
    this.allBox.type = 'checkbox'
    this.allRow.append(this.allBox, this.allText)
    this.sheet.body.append(this.allRow, this.list)

    // Re-check what's affordable if coins change while the window is open.
    city.onChange((e) => e.kind === 'coins' && this.plot && this.render())
  }

  open(plot: PlacedBuilding) {
    this.plot = plot
    this.allBox.checked = false
    this.render()
    this.sheet.open()
  }

  close() {
    this.sheet.close()
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
    this.allText.textContent = `Plant all ${empty} empty plots (⚡ 1 each)`

    this.list.replaceChildren(
      ...CROP_TYPES.map((crop) => {
        const item = el('button', 'catalog-item crop-item')
        if (this.player.level < crop.unlockLevel) {
          item.disabled = true
          item.classList.add('locked')
          item.append(
            el('span', 'catalog-name', `${crop.emoji} ${crop.name}`),
            el('span', 'catalog-meta', `🔒 Unlocks at level ${crop.unlockLevel}`),
          )
          return item
        }
        const profit = crop.sellPrice - crop.seedCost
        item.append(
          el('span', 'catalog-name', `${crop.emoji} ${crop.name}`),
          el('span', 'catalog-meta', `Seeds ${coins(crop.seedCost)} → sells ${coins(crop.sellPrice)}`),
          el('span', 'catalog-meta', `Ready in ${timeSpan(crop.growSeconds)} · fresh for ${timeSpan(crop.freshSeconds)}`),
          el('span', 'crop-profit', `Profit ${coins(profit)} · ${coins(profitPerMinute(crop))}/min · ⭐ ${crop.xp}`),
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
    let outOfEnergy = false
    for (const plot of plots) {
      // Each planting uses 1 energy (the Player takes it when City reports it).
      if (!this.player.hasEnergy(Date.now())) {
        outOfEnergy = true
        break
      }
      if (!this.city.production.plant(plot.id, crop)) break // out of coins
      planted++
    }
    if (outOfEnergy) {
      const message = outOfEnergyMessage(this.player, Date.now())
      this.onNotice(plots.length > 1 ? `Planted ${planted} of ${plots.length} plots. ${message}` : message)
    } else if (planted < plots.length) {
      this.onNotice(`Planted ${planted} of ${plots.length} plots: not enough coins for more ${crop.name.toLowerCase()} seeds`)
    }
    this.close()
  }
}
