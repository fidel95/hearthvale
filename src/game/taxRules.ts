import type { BuildingType, Category } from './buildings'
import { YEAR_MS } from './GameClock'

// The tax code of Hearthvale. Every rule here is modeled on a real US tax
// (2024 figures) and scaled to the game's economy. docs/TAXES.md explains each
// one with worked examples and lists where the game simplifies real life.
//
// This file is pure functions and constants (no state, no DOM), so it's easy
// to unit test (see taxRules.test.ts).

// Game coins are worth roughly $10 each when it comes to tax brackets:
// real dollar thresholds are divided by this.
const DOLLARS_PER_COIN = 10

// ---- Income tax ------------------------------------------------------------

// US federal income tax brackets, 2024, single filer. These are *marginal*
// rates: each rate applies only to the slice of income inside its bracket,
// so earning more never lowers your take-home pay.
export const INCOME_TAX_BRACKETS: readonly { upTo: number; rate: number }[] = [
  { upTo: 11_600 / DOLLARS_PER_COIN, rate: 0.1 },
  { upTo: 47_150 / DOLLARS_PER_COIN, rate: 0.12 },
  { upTo: 100_525 / DOLLARS_PER_COIN, rate: 0.22 },
  { upTo: 191_950 / DOLLARS_PER_COIN, rate: 0.24 },
  { upTo: 243_725 / DOLLARS_PER_COIN, rate: 0.32 },
  { upTo: 609_350 / DOLLARS_PER_COIN, rate: 0.35 },
  { upTo: Infinity, rate: 0.37 },
]

// Income everyone gets to subtract before brackets apply (2024 single: $14,600).
export const STANDARD_DEDUCTION = 14_600 / DOLLARS_PER_COIN

export interface BracketSlice {
  rate: number
  from: number
  to: number
  taxed: number // how much income fell into this bracket
  tax: number // taxed * rate
}

export interface IncomeTaxResult {
  tax: number
  slices: BracketSlice[]
  marginalRate: number // the rate on the last coin earned
}

export function incomeTax(taxableIncome: number): IncomeTaxResult {
  const slices: BracketSlice[] = []
  let from = 0
  let tax = 0
  let marginalRate = INCOME_TAX_BRACKETS[0].rate
  for (const { upTo, rate } of INCOME_TAX_BRACKETS) {
    if (taxableIncome <= from) break
    const taxed = Math.min(taxableIncome, upTo) - from
    slices.push({ rate, from, to: upTo, taxed, tax: taxed * rate })
    tax += taxed * rate
    marginalRate = rate
    from = upTo
  }
  return { tax, slices, marginalRate }
}

// ---- Sales tax -------------------------------------------------------------

// Typical combined state + local sales tax in the US. Customers pay it on top
// of the price; the shop holds it and passes it to the government each quarter.
// It's never the shop's income.
export const SALES_TAX_RATE = 0.07

// Sales tax is rounded per sale, like on a real receipt.
export function salesTaxOn(saleAmount: number): number {
  return Math.round(saleAmount * SALES_TAX_RATE)
}

// ---- Property tax ----------------------------------------------------------

// About 1% of a property's assessed value per year, close to the US average.
export const PROPERTY_TAX_RATE = 0.01

// Assessors value income-producing property with the "income approach":
// value = net operating income / capitalization rate.
// Net operating income = gross income minus running costs (repairs, insurance, ...).
export const OPERATING_EXPENSE_RATIO = 0.4
export const CAP_RATE = 0.08

// Gross income a building would earn in one game year if you always collected on time.
export function potentialAnnualIncome(type: BuildingType): number {
  if (!type.income) return 0
  return type.income.coins * (YEAR_MS / (type.income.seconds * 1000))
}

// What the tax assessor says the building is worth. Buildings with no income
// (decorations) are valued at what they cost ("cost approach").
export function assessedValue(type: BuildingType): number {
  const netOperatingIncome = potentialAnnualIncome(type) * (1 - OPERATING_EXPENSE_RATIO)
  return Math.max(type.cost, netOperatingIncome / CAP_RATE)
}

export function annualPropertyTax(type: BuildingType): number {
  return assessedValue(type) * PROPERTY_TAX_RATE
}

// ---- Depreciation ----------------------------------------------------------

// Buildings wear out, so the tax code lets you deduct their cost a little each
// year: straight-line over the US MACRS recovery period. Land (our farm
// fields) never wears out and can't be depreciated.
export const RECOVERY_YEARS: Record<Category, number | null> = {
  home: 27.5, // residential rental property
  business: 39, // nonresidential real property
  decoration: 15, // land improvements (landscaping, fences, ...)
  farm: null, // land
  utility: 20, // a default; each utility building sets its own class (buildings.ts recoveryYears)
  community: 39, // nonresidential real property (a park overrides it: land improvement)
  road: 15, // land improvements: roads, sidewalks
  storage: 39, // nonresidential real property (a barn overrides it: farm building)
  port: 15, // docks and wharves are land improvements
}

// Depreciation for one full month. In the month a building is placed you get
// half of this: the "mid-month convention" the IRS uses for real estate.
export function monthlyDepreciation(basis: number, type: Pick<BuildingType, 'category' | 'recoveryYears'>): number {
  const years = type.recoveryYears ?? RECOVERY_YEARS[type.category]
  return years ? basis / (years * 12) : 0
}

// ---- Paying late -----------------------------------------------------------

// IRS failure-to-pay penalty: 0.5% of the unpaid tax for each month it's late.
export const LATE_PENALTY_PER_MONTH = 0.005
