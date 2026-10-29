import { describe, expect, it } from 'vitest'
import { BUILDINGS_BY_ID } from './buildings'
import {
  STANDARD_DEDUCTION,
  annualPropertyTax,
  assessedValue,
  incomeTax,
  monthlyDepreciation,
  potentialAnnualIncome,
  salesTaxOn,
} from './taxRules'

const cottage = BUILDINGS_BY_ID.get('cottage')!
const oak = BUILDINGS_BY_ID.get('oak-tree')!

describe('incomeTax', () => {
  it('is zero with no taxable income', () => {
    expect(incomeTax(0)).toEqual({ tax: 0, slices: [], marginalRate: 0.1 })
  })

  it('taxes the first bracket at 10%', () => {
    expect(incomeTax(1000).tax).toBeCloseTo(100)
  })

  it('only taxes the income inside each bracket at that bracket’s rate', () => {
    // 1,160 at 10% + (2,000 - 1,160) at 12%
    const result = incomeTax(2000)
    expect(result.tax).toBeCloseTo(116 + 840 * 0.12)
    expect(result.marginalRate).toBe(0.12)
    expect(result.slices.map((s) => s.taxed)).toEqual([1160, 840])
  })

  it('never takes more than the extra income when you cross into a higher bracket', () => {
    const below = incomeTax(4715)
    const above = incomeTax(4716)
    expect(above.tax - below.tax).toBeCloseTo(0.22) // only the one extra coin is taxed at 22%
  })

  it('matches the 2024 US single-filer standard deduction, scaled ÷10', () => {
    expect(STANDARD_DEDUCTION).toBe(1460)
  })
})

describe('sales tax', () => {
  it('is 7%, rounded per sale', () => {
    expect(salesTaxOn(40)).toBe(3) // 2.8
    expect(salesTaxOn(75)).toBe(5) // 5.25
    expect(salesTaxOn(0)).toBe(0)
  })
})

describe('property valuation', () => {
  it('values income property by the income approach', () => {
    // Cottage: 15 coins every 30 s → 24 payouts per 12-minute year = 360/yr.
    expect(potentialAnnualIncome(cottage)).toBe(360)
    // 60% left after running costs, capitalized at 8%: 216 / 0.08 = 2,700
    expect(assessedValue(cottage)).toBeCloseTo(2700)
    expect(annualPropertyTax(cottage)).toBeCloseTo(27)
  })

  it('values buildings with no income at their cost', () => {
    expect(assessedValue(oak)).toBe(oak.cost)
  })
})

describe('depreciation', () => {
  it('spreads homes over 27.5 years', () => {
    expect(monthlyDepreciation(330, 'home')).toBeCloseTo(1)
  })

  it('never depreciates land', () => {
    expect(monthlyDepreciation(50, 'farm')).toBe(0)
  })
})
