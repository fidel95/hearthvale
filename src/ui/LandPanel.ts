import type { City } from '../game/City'
import type { Lot } from '../game/grid'
import { expansionLevel } from '../game/land'
import type { Player } from '../game/Player'
import { PROPERTY_TAX_RATE } from '../game/taxRules'
import { coins, el } from './dom'
import { Sheet, button } from './Sheet'

// The window for buying a lot of land: what it costs, what it needs, and what
// owning it means for taxes.
export class LandPanel {
  private sheet: Sheet
  private buy = button('Buy', () => this.confirm())
  private city: City
  private player: Player
  private onNotice: (message: string) => void
  private lot: Lot | null = null

  constructor(container: HTMLElement, city: City, player: Player, onNotice: (message: string) => void) {
    this.city = city
    this.player = player
    this.onNotice = onNotice
    this.sheet = new Sheet(container, '🏷️ Land for sale')
    this.sheet.setButtons(this.buy)
  }

  open(lot: Lot) {
    this.lot = lot
    const price = this.city.nextLotPrice
    const level = expansionLevel(this.city.expansions + 1)
    const tooLow = this.player.level < level
    const tooPoor = this.city.coins < price

    const facts = el('ul', 'level-list')
    for (const line of [
      `A 10×10 lot: room for about 20 more buildings`,
      `Price ${coins(price)} (each lot costs more than the last)`,
      `Needs level ${level}${tooLow ? ` (you're level ${this.player.level})` : ''}`,
      `Property tax ${coins(price * PROPERTY_TAX_RATE)} a year`,
    ]) {
      facts.append(el('li', '', line))
    }
    this.sheet.body.replaceChildren(
      facts,
      el(
        'p',
        'muted',
        "Land is a real asset: it's taxed every year on what you paid, but unlike buildings it's never depreciated, because land doesn't wear out.",
      ),
    )
    this.buy.disabled = tooLow || tooPoor
    this.buy.textContent = tooLow ? `Reach level ${level} first` : tooPoor ? 'Not enough coins' : `Buy for ${coins(price)}`
    this.sheet.open()
  }

  close() {
    this.lot = null
    this.sheet.close()
  }

  private confirm() {
    if (this.lot && this.city.buyLot(this.lot)) this.onNotice('New land! Your town just got bigger.')
    this.close()
  }
}
