import type { City, PlacedBuilding } from './City'
import type { GameClock } from './GameClock'
import {
  LATE_PENALTY_PER_MONTH,
  PROPERTY_TAX_RATE,
  STANDARD_DEDUCTION,
  annualPropertyTax,
  assessedValue,
  incomeTax,
  monthlyDepreciation,
  salesTaxOn,
  type BracketSlice,
} from './taxRules'

// Keeps the town's tax books, the way an accountant would:
// - records income as it's collected (rent from homes, sales from shops,
//   crop sales from farms) and farm expenses as they're paid (seeds),
// - holds the sales tax customers pay and sends it in every quarter,
// - accrues property tax and depreciation month by month,
// - files the yearly return on Tax Day (after December) and pays what's due,
// - charges a late penalty every month the town is in tax debt.
//
// The rules themselves (rates, brackets, formulas) live in taxRules.ts.
// This class is the bookkeeping that applies them over time.

// Tax bookkeeping for one building we own.
interface Asset {
  basis: number // what it cost; the total that can ever be depreciated
  depreciated: number // how much of the basis has been deducted so far
  placedMonth: number // clock.monthIndex when it was built
}

// Running totals for the current tax year.
export interface YearLedger {
  year: number
  rentIncome: number
  salesIncome: number
  farmIncome: number // crop sales
  farmExpenses: number // seeds, deducted when bought (the cash method most farmers use)
  operatingExpenses: number // running costs like utility upkeep
  otherIncome: number
  salesTaxCollected: number
  salesTaxRemitted: number
  propertyTax: number // accrued this year, paid on Tax Day
  depreciation: number
  penalties: number
}

export interface TaxReturn {
  year: number
  grossIncome: number
  rentIncome: number
  salesIncome: number
  farmIncome: number
  otherIncome: number
  farmExpenses: number
  operatingExpenses: number
  propertyTax: number
  depreciation: number
  standardDeduction: number
  taxableIncome: number
  incomeTax: number
  slices: BracketSlice[]
  marginalRate: number
  effectiveRate: number // income tax / gross income
  salesTaxRemitted: number
  penalties: number
  amountDue: number // property tax + income tax, rounded to whole coins
}

export type TaxEvent =
  | { kind: 'salesTax'; building: PlacedBuilding; amount: number }
  | { kind: 'remitted'; amount: number; quarter: number }
  | { kind: 'taxDay'; taxReturn: TaxReturn }
  | { kind: 'penalty'; amount: number }
  | { kind: 'changed' }

export interface TaxesSave {
  ledger: YearLedger
  salesTaxHeld: number
  lastReturn: TaxReturn | null
  assets: [number, Asset][]
}

function emptyLedger(year: number): YearLedger {
  return {
    year,
    rentIncome: 0,
    salesIncome: 0,
    farmIncome: 0,
    farmExpenses: 0,
    operatingExpenses: 0,
    otherIncome: 0,
    salesTaxCollected: 0,
    salesTaxRemitted: 0,
    propertyTax: 0,
    depreciation: 0,
    penalties: 0,
  }
}

export class Taxes {
  ledger: YearLedger
  salesTaxHeld = 0 // customers' money we're holding until the end of the quarter
  lastReturn: TaxReturn | null = null

  private city: City
  private clock: GameClock
  private assets = new Map<number, Asset>()
  private listeners: ((event: TaxEvent) => void)[] = []

  constructor(city: City, clock: GameClock) {
    this.city = city
    this.clock = clock
    this.ledger = emptyLedger(clock.year)

    city.onChange((event) => {
      switch (event.kind) {
        case 'added':
          this.assets.set(event.building.id, {
            basis: event.building.type.cost,
            depreciated: 0,
            placedMonth: this.clock.monthIndex,
          })
          break
        case 'removed':
          // No deduction for demolishing: in the US (IRC §280B) the leftover
          // cost of a demolished building is added to the land's cost instead,
          // which only matters when the land is sold. See docs/TAXES.md.
          this.assets.delete(event.building.id)
          this.emit({ kind: 'changed' })
          break
        case 'collected':
          this.recordIncome(event.building, event.amount)
          break
        // Running a business's utilities is an "ordinary and necessary"
        // business expense (IRC §162), so it's deducted from income.
        case 'expense':
          this.ledger.operatingExpenses += event.amount
          this.emit({ kind: 'changed' })
          break
        // Prizes and awards are taxable income in the US (IRC §74), even in coins.
        case 'award':
          this.ledger.otherIncome += event.amount
          this.emit({ kind: 'changed' })
          break
        // Farming is a business too (Schedule F in the US). Crops are sold
        // wholesale to the market, and sales for resale carry no sales tax.
        case 'harvested':
          this.ledger.farmIncome += event.amount
          this.emit({ kind: 'changed' })
          break
        case 'planted':
          // A withered crop's seeds were already deducted when bought, so
          // losing the crop adds no further deduction ('cleared' needs nothing).
          if (event.cost > 0) {
            this.ledger.farmExpenses += event.cost
            this.emit({ kind: 'changed' })
          }
          break
      }
    })
  }

  onChange(listener: (event: TaxEvent) => void) {
    this.listeners.push(listener)
  }

  // Called by the game once for every in-game month that ends.
  endOfMonth(monthIndex: number) {
    const month = monthIndex % 12

    this.accrue(monthIndex)
    if (month % 3 === 2) this.remitSalesTax(Math.floor(month / 3) + 1)
    if (month === 11) this.fileReturn()
    this.chargeLatePenalty()
    this.emit({ kind: 'changed' })
  }

  // What this year's return would look like if the year ended now.
  estimate(): TaxReturn {
    const l = this.ledger
    const grossIncome = l.rentIncome + l.salesIncome + l.farmIncome + l.otherIncome
    const deductions = l.farmExpenses + l.operatingExpenses + l.propertyTax + l.depreciation + STANDARD_DEDUCTION
    const taxableIncome = Math.max(0, grossIncome - deductions)
    const { tax, slices, marginalRate } = incomeTax(taxableIncome)
    return {
      year: l.year,
      grossIncome,
      rentIncome: l.rentIncome,
      salesIncome: l.salesIncome,
      farmIncome: l.farmIncome,
      otherIncome: l.otherIncome,
      farmExpenses: l.farmExpenses,
      operatingExpenses: l.operatingExpenses,
      propertyTax: l.propertyTax,
      depreciation: l.depreciation,
      standardDeduction: STANDARD_DEDUCTION,
      taxableIncome,
      incomeTax: tax,
      slices,
      marginalRate,
      effectiveRate: grossIncome > 0 ? tax / grossIncome : 0,
      salesTaxRemitted: l.salesTaxRemitted,
      penalties: l.penalties,
      amountDue: Math.round(l.propertyTax) + Math.round(tax),
    }
  }

  // The land we own: how many lots, their total value (what they cost) and the
  // yearly property tax on it. Land is taxed but never depreciated.
  land(): { lots: number; value: number; annualTax: number } {
    let lots = 0
    let value = 0
    for (const owned of this.city.ownedLots()) {
      lots++
      value += owned.price
    }
    return { lots, value, annualTax: value * PROPERTY_TAX_RATE }
  }

  // Every building we own with its assessed value and yearly property tax.
  properties(): { building: PlacedBuilding; value: number; annualTax: number }[] {
    return [...this.city.all()].map((building) => {
      const location = this.city.valueMultiplier(building)
      return {
        building,
        value: assessedValue(building.type) * location,
        annualTax: annualPropertyTax(building.type) * location,
      }
    })
  }

  toSave(): TaxesSave {
    return {
      ledger: { ...this.ledger },
      salesTaxHeld: this.salesTaxHeld,
      lastReturn: this.lastReturn,
      assets: [...this.assets.entries()],
    }
  }

  // Call after City.load, so the saved asset records replace the fresh ones
  // that City's 'added' events just created.
  load(save: TaxesSave) {
    this.ledger = { ...emptyLedger(save.ledger.year), ...save.ledger }
    this.salesTaxHeld = save.salesTaxHeld
    // Returns filed by older versions lack the lines added since (farms, utilities).
    const last = save.lastReturn
    this.lastReturn = last && {
      ...last,
      farmIncome: last.farmIncome ?? 0,
      farmExpenses: last.farmExpenses ?? 0,
      operatingExpenses: last.operatingExpenses ?? 0,
    }
    for (const [id, asset] of save.assets) {
      if (this.city.get(id)) this.assets.set(id, asset)
    }
    this.emit({ kind: 'changed' })
  }

  private recordIncome(building: PlacedBuilding, amount: number) {
    switch (building.type.category) {
      case 'home':
        this.ledger.rentIncome += amount
        break
      case 'business': {
        this.ledger.salesIncome += amount
        // The customer pays sales tax on top of the price. It lands in our
        // coins, but it's owed to the government, so we track it separately.
        const tax = salesTaxOn(amount)
        if (tax > 0) {
          this.salesTaxHeld += tax
          this.ledger.salesTaxCollected += tax
          this.city.adjustCoins(tax)
          this.emit({ kind: 'salesTax', building, amount: tax })
        }
        break
      }
      default:
        this.ledger.otherIncome += amount
    }
    this.emit({ kind: 'changed' })
  }

  // Property tax and depreciation build up a month at a time, so a building
  // owned for half the year counts for half the year.
  private accrue(monthIndex: number) {
    this.ledger.propertyTax += this.land().annualTax / 12
    for (const building of this.city.all()) {
      let asset = this.assets.get(building.id)
      if (!asset) {
        asset = { basis: building.type.cost, depreciated: 0, placedMonth: monthIndex }
        this.assets.set(building.id, asset)
      }
      // Mid-month convention: a building placed this month counts for half of it.
      const fraction = asset.placedMonth === monthIndex ? 0.5 : 1

      // A good location (parks, schools, roads nearby) raises the assessed value.
      const location = this.city.valueMultiplier(building)
      this.ledger.propertyTax += ((annualPropertyTax(building.type) * location) / 12) * fraction

      const remaining = asset.basis - asset.depreciated
      const depreciation = Math.min(remaining, monthlyDepreciation(asset.basis, building.type) * fraction)
      asset.depreciated += depreciation
      this.ledger.depreciation += depreciation
    }
  }

  private remitSalesTax(quarter: number) {
    const amount = this.salesTaxHeld
    if (amount <= 0) return
    this.city.adjustCoins(-amount)
    this.ledger.salesTaxRemitted += amount
    this.salesTaxHeld = 0
    this.emit({ kind: 'remitted', amount, quarter })
  }

  private fileReturn() {
    const taxReturn = this.estimate()
    this.city.adjustCoins(-taxReturn.amountDue)
    this.lastReturn = taxReturn
    this.ledger = emptyLedger(taxReturn.year + 1)
    this.emit({ kind: 'taxDay', taxReturn })
  }

  // Coins only go negative from unpaid taxes, so a negative balance is tax debt.
  private chargeLatePenalty() {
    const debt = -this.city.coins
    if (debt <= 0) return
    const penalty = Math.max(1, Math.round(debt * LATE_PENALTY_PER_MONTH))
    this.city.adjustCoins(-penalty)
    this.ledger.penalties += penalty
    this.emit({ kind: 'penalty', amount: penalty })
  }

  private emit(event: TaxEvent) {
    for (const listener of this.listeners) listener(event)
  }
}
