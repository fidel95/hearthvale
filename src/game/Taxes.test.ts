import { describe, expect, it } from 'vitest'
import { BUILDINGS_BY_ID } from './buildings'
import { City } from './City'
import { CROPS_BY_ID } from './crops'
import { GameClock, MONTH_MS } from './GameClock'
import { Taxes, type TaxEvent } from './Taxes'
import { STANDARD_DEDUCTION, annualPropertyTax, incomeTax } from './taxRules'

const cottage = BUILDINGS_BY_ID.get('cottage')!
const bakery = BUILDINGS_BY_ID.get('bakery')! // business: 40 coins of sales
const plotType = BUILDINGS_BY_ID.get('farm-plot')!
const strawberries = CROPS_BY_ID.get('strawberries')! // seeds 10, sells 40

// A fresh town with a clock and tax books, plus a helper that runs whole months.
function setup() {
  const city = new City()
  const clock = new GameClock()
  const taxes = new Taxes(city, clock)
  const events: TaxEvent[] = []
  taxes.onChange((e) => e.kind !== 'changed' && events.push(e))
  const runMonths = (n: number) => {
    for (let i = 0; i < n; i++) {
      for (const m of advanceOneMonth(clock)) taxes.endOfMonth(m)
    }
  }
  return { city, clock, taxes, events, runMonths }
}

// GameClock caps each step at 250 ms (to survive stalls), so step through.
function advanceOneMonth(clock: GameClock): number[] {
  const ended: number[] = []
  for (let t = 0; t < MONTH_MS; t += 250) ended.push(...clock.advance(250))
  return ended
}

describe('Taxes', () => {
  it('records rent as income', () => {
    const { city, taxes } = setup()
    const home = city.place(cottage, { x: 0, z: 0 }, { now: 0, free: true })!
    city.collect(home.id, 30_000)
    expect(taxes.ledger.rentIncome).toBe(15)
  })

  it('adds sales tax on top of shop sales and holds it until the quarter ends', () => {
    const { city, taxes, events, runMonths } = setup()
    const shop = city.place(bakery, { x: 0, z: 0 }, { now: 0, free: true })!
    const before = city.coins
    city.collect(shop.id, 45_000)
    expect(city.coins).toBe(before + 40 + 3) // the sale plus 7% the customer paid
    expect(taxes.salesTaxHeld).toBe(3)
    expect(taxes.ledger.salesIncome).toBe(40) // the tax is not our income

    runMonths(2) // end of February: nothing sent yet
    expect(taxes.salesTaxHeld).toBe(3)
    const coinsBeforeQ1 = city.coins
    runMonths(1) // end of March: quarter 1 is sent
    expect(taxes.salesTaxHeld).toBe(0)
    expect(city.coins).toBe(coinsBeforeQ1 - 3)
    expect(events).toContainEqual({ kind: 'remitted', amount: 3, quarter: 1 })
  })

  it('accrues a full year of property tax for a building owned all year', () => {
    const { city, taxes, runMonths } = setup()
    city.place(cottage, { x: 0, z: 0 }, { free: true })
    // Placed in January (month 0) → half a month (mid-month convention) + 11 full months.
    runMonths(11)
    expect(taxes.ledger.propertyTax).toBeCloseTo((annualPropertyTax(cottage) / 12) * 10.5)
  })

  it('files the return after December and pays income + property tax', () => {
    const { city, taxes, events, runMonths } = setup()
    city.place(cottage, { x: 0, z: 0 }, { free: true })
    city.adjustCoins(5000 - city.coins)
    // Pretend we earned 3,000 in rent this year.
    taxes.ledger.rentIncome = 3000

    runMonths(12)
    const filed = events.find((e) => e.kind === 'taxDay')
    expect(filed).toBeDefined()
    const r = filed!.kind === 'taxDay' ? filed!.taxReturn : null!

    const expectedTaxable = 3000 - r.propertyTax - r.depreciation - STANDARD_DEDUCTION
    expect(r.taxableIncome).toBeCloseTo(expectedTaxable)
    expect(r.incomeTax).toBeCloseTo(incomeTax(expectedTaxable).tax)
    expect(r.amountDue).toBe(Math.round(r.propertyTax) + Math.round(r.incomeTax))
    expect(city.coins).toBe(5000 - r.amountDue)
    // The books start fresh for year 2.
    expect(taxes.ledger.year).toBe(2)
    expect(taxes.ledger.rentIncome).toBe(0)
    expect(taxes.lastReturn).toEqual(r)
  })

  it('gives no deduction for demolishing, and stops taxing the building', () => {
    const { city, taxes, runMonths } = setup()
    const home = city.place(cottage, { x: 0, z: 0 }, { free: true })!
    city.remove(home.id)
    runMonths(2)
    expect(taxes.ledger.propertyTax).toBe(0)
    expect(taxes.ledger.depreciation).toBe(0)
    expect(taxes.estimate().taxableIncome).toBe(0)
  })

  it('charges a 0.5% late penalty each month you are in tax debt', () => {
    const { city, taxes, events, runMonths } = setup()
    city.adjustCoins(-1000 - city.coins) // 1,000 coins of tax debt
    runMonths(1)
    expect(events).toContainEqual({ kind: 'penalty', amount: 5 })
    expect(city.coins).toBe(-1005)
    expect(taxes.ledger.penalties).toBe(5)
  })

  it('round-trips through a save', () => {
    const { city, clock, taxes, runMonths } = setup()
    city.place(cottage, { x: 0, z: 0 }, { free: true })
    runMonths(4)
    const save = JSON.parse(JSON.stringify({ city: city.toSave(), taxes: taxes.toSave(), played: clock.playedMs }))

    const city2 = new City()
    const clock2 = new GameClock()
    clock2.playedMs = save.played
    const taxes2 = new Taxes(city2, clock2)
    city2.load(save.city)
    taxes2.load(save.taxes)
    expect(taxes2.toSave()).toEqual(save.taxes)
  })

  it('records crop sales as farm income and seeds as a deductible farm expense, with no sales tax', () => {
    const { city, taxes } = setup()
    const plot = city.place(plotType, { x: 0, z: 0 }, { free: true })!
    const before = city.coins
    city.plant(plot.id, strawberries, { now: 0 })
    city.harvest(plot.id, 60_000)
    expect(city.coins).toBe(before - 10 + 40) // no sales tax added on top
    expect(taxes.salesTaxHeld).toBe(0)
    const r = taxes.estimate()
    expect(r.farmIncome).toBe(40)
    expect(r.farmExpenses).toBe(10)
    expect(r.grossIncome).toBe(40)
  })

  it('deducts seeds from taxable income', () => {
    const { city, taxes } = setup()
    city.adjustCoins(100_000)
    const plots = [0, 2, 4, 6, 8].map((x) => city.place(plotType, { x, z: 0 }, { free: true })!)
    // Plant and harvest enough to get above the standard deduction.
    for (let round = 0; round < 10; round++) {
      const now = round * 60_000
      for (const p of plots) city.plant(p.id, strawberries, { now })
      for (const p of plots) city.harvest(p.id, now + 60_000)
    }
    const r = taxes.estimate()
    expect(r.farmIncome).toBe(2000) // 50 harvests × 40
    expect(r.farmExpenses).toBe(500) // 50 × 10 in seeds
    expect(r.taxableIncome).toBeCloseTo(2000 - 500 - STANDARD_DEDUCTION)
  })

  it('gives no extra deduction for a withered crop (its seeds were already deducted)', () => {
    const { city, taxes } = setup()
    const plot = city.place(plotType, { x: 0, z: 0 }, { free: true })!
    city.plant(plot.id, strawberries, { now: 0 })
    city.clearPlot(plot.id, 10 * 60_000)
    expect(taxes.estimate().farmExpenses).toBe(10)
  })

  it('does not count free starter crops as an expense', () => {
    const { city, taxes } = setup()
    const plot = city.place(plotType, { x: 0, z: 0 }, { free: true })!
    city.plant(plot.id, strawberries, { now: 0, free: true })
    expect(taxes.estimate().farmExpenses).toBe(0)
  })

  it('loads returns filed before farms existed', () => {
    const { taxes } = setup()
    const { farmIncome: _i, farmExpenses: _e, ...oldReturn } = taxes.estimate()
    taxes.load({ ...taxes.toSave(), lastReturn: oldReturn as never })
    expect(taxes.lastReturn).toMatchObject({ farmIncome: 0, farmExpenses: 0 })
  })
})
