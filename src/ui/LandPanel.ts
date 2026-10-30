import type { City } from '../game/City'
import type { Lot } from '../game/grid'
import type { Inventory } from '../game/Inventory'
import { materialsText } from '../game/items'
import { buyLand, landQuote } from '../game/projects'
import type { Player } from '../game/Player'
import { QUESTS, type Quests } from '../game/quests'
import { expansionQuest } from '../game/land'
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

  private inventory: Inventory

  private quests: Quests

  constructor(container: HTMLElement, city: City, player: Player, inventory: Inventory, quests: Quests, onNotice: (message: string) => void) {
    this.quests = quests
    this.city = city
    this.player = player
    this.inventory = inventory
    this.onNotice = onNotice
    this.sheet = new Sheet(container, '🏷️ Land for sale')
    this.sheet.setButtons(this.buy)
  }

  open(lot: Lot) {
    this.lot = lot
    // The rules live in landQuote; this window only shows its answer.
    const { coins: price, materials, playerLevel: level, missing, result } = landQuote(this.city, this.inventory, this.player, this.quests)
    const short = Object.keys(missing).length > 0
    const tooLow = !result.ok && result.reason === 'level'

    const facts = el('ul', 'level-list')
    for (const line of [
      `A 10×10 lot: room for about 20 more buildings`,
      `Price ${coins(price)} and ${materialsText(materials)} to clear it (each lot costs more than the last)`,
      `Needs level ${level}${tooLow ? ` (you're level ${this.player.level})` : ''}`,
      ...this.questLine(),
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
    const buyMaterials = button(`Buy materials ${coins(this.inventory.priceOf(missing))}`, () => {
      if (this.inventory.buy(missing) && this.lot) this.open(this.lot)
    }, 'panel-button secondary')
    buyMaterials.hidden = !short || tooLow
    this.sheet.setButtons(buyMaterials, this.buy)
    this.buy.disabled = !result.ok
    this.buy.textContent = result.ok
      ? `Buy for ${coins(price)}`
      : result.reason === 'level'
        ? `Reach level ${level} first`
        : result.reason === 'quest'
          ? `Finish the quest “${result.quest}” first`
        : result.reason === 'coins'
          ? 'Not enough coins'
          : `Needs ${materialsText(missing)} more`
    this.sheet.open()
  }

  // Some lots also need a quest finished (land.ts expansionQuest).
  private questLine(): string[] {
    const id = expansionQuest(this.city.expansions + 1)
    const quest = id && QUESTS.find((q) => q.id === id)
    if (!quest) return []
    const done = this.quests.claimedQuests().includes(quest)
    return [`Needs the quest “${quest.title}” finished${done ? ' ✓' : ''}`]
  }

  close() {
    this.lot = null
    this.sheet.close()
  }

  private confirm() {
    if (this.lot && buyLand(this.city, this.inventory, this.player, this.lot, this.quests).ok) this.onNotice('New land! Your town just got bigger.')
    this.close()
  }
}
