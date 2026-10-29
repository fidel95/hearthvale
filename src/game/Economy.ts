import type { CityEvent } from './City'

// The town's resources: coins, goods in storage, and debt. Every change to
// them goes through here, so the rules live in one place:
//
// - Coins never go below zero. Spending more than you have is a bug and
//   throws; every purchase checks canAfford first.
// - A bill bigger than the coins on hand takes them all and the rest becomes
//   debt; income pays debt down before it reaches the coins.
// - Goods never go below zero, and never above what storage holds.
//
// Changes are announced as City events (coins, debt, goods, award, expense,
// goodsIn), since they're part of the town's story.

const STARTING_COINS = 600
// A new town has some goods in stock so its first shop can open right away.
export const STARTING_GOODS = 40

export class Economy {
  private _coins = STARTING_COINS
  private _goods = STARTING_GOODS
  private _debt = 0
  private emit: (event: CityEvent) => void
  private capacity: () => number

  // capacity: how many goods storage holds right now (City works it out from the buildings).
  constructor(emit: (event: CityEvent) => void, capacity: () => number) {
    this.emit = emit
    this.capacity = capacity
  }

  get coins() {
    return this._coins
  }

  get goods() {
    return this._goods
  }

  get debt() {
    return this._debt
  }

  canAfford(cost: number): boolean {
    return this._coins >= cost
  }

  // Add or spend coins. Income pays any debt first; spending below zero throws.
  // payDebt: false keeps a grant out of the debt collector's hands (safetyNet.ts).
  adjust(delta: number, { payDebt = true } = {}) {
    if (delta === 0) return
    if (delta < 0 && this._coins + delta < 0) throw new Error(`Spending ${-delta} coins with only ${this._coins}`)
    if (delta > 0 && payDebt && this._debt > 0) {
      const toDebt = Math.min(this._debt, delta)
      this._debt -= toDebt
      delta -= toDebt
      this.emit({ kind: 'debt', debt: this._debt })
      if (delta === 0) return
    }
    this._coins += delta
    this.emit({ kind: 'coins', coins: this._coins })
  }

  // A bill the town must pay (taxes, running costs, penalties): from coins as
  // far as they go, the rest becomes debt. Returns what was owed beyond the coins.
  bill(amount: number): number {
    if (amount <= 0) return 0
    const paid = Math.min(this._coins, amount)
    const owed = amount - paid
    if (paid > 0) {
      this._coins -= paid
      this.emit({ kind: 'coins', coins: this._coins })
    }
    if (owed > 0) {
      this._debt += owed
      this.emit({ kind: 'debt', debt: this._debt })
    }
    return owed
  }

  // Prize money (a level-up, quest or collection reward). It's income, so it
  // gets its own event for Taxes rather than a bare adjust.
  award(amount: number, reason: string, options: { payDebt?: boolean } = {}) {
    if (amount <= 0) return
    this.emit({ kind: 'award', amount, reason })
    this.adjust(amount, options)
  }

  // A running cost, like utility upkeep: a deductible expense, and a bill (it can leave debt).
  expense(amount: number, reason: string) {
    if (amount <= 0) return
    this.emit({ kind: 'expense', amount, reason })
    this.bill(amount)
  }

  // Goods bought and delivered. Only what fits in storage is taken (and its
  // cost recorded proportionally). Returns the units taken.
  addGoods(units: number, cost: number): number {
    const taken = Math.min(units, Math.max(0, this.capacity() - this._goods))
    if (taken <= 0) return 0
    this.emit({ kind: 'goodsIn', units: taken, cost: (cost * taken) / units })
    this.changeGoods(taken)
    return taken
  }

  // Free room in storage.
  room(): number {
    return Math.max(0, this.capacity() - this._goods)
  }

  // Goods moved in or out without being bought (harvests in, restocking out).
  changeGoods(delta: number) {
    if (delta === 0) return
    if (this._goods + delta < 0) throw new Error(`Taking ${-delta} goods with only ${this._goods}`)
    this._goods += delta
    this.emit({ kind: 'goods', goods: this._goods })
  }

  load(save: { coins: number; goods?: number; debt?: number }) {
    // Older saves kept debt as negative coins.
    this._coins = Math.max(0, save.coins)
    this._debt = save.debt ?? Math.max(0, -save.coins)
    this._goods = save.goods ?? STARTING_GOODS
    this.emit({ kind: 'goods', goods: this._goods })
    this.emit({ kind: 'debt', debt: this._debt })
    this.emit({ kind: 'coins', coins: this._coins })
  }
}
