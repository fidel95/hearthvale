import type { City } from './City'
import { Emitter } from './events'
import type { GameClock } from './GameClock'
import type { Taxes } from './Taxes'

// The financial report's numbers: where the town's money came from and where
// it went, month by month (game months), and which buildings earn the most.
// It's the owner's view; the Taxes window is the tax form's view of the same
// year. Sales tax isn't counted at all: it's the county's money, passing
// through. Spending is what things are worth when they happen: an upgrade
// counts its materials too, a shipment counts when it's unloaded.

export type IncomeSource = 'rent' | 'sales' | 'farm' | 'tourism' | 'prizes'
export type Spending = 'running' | 'seeds' | 'goods' | 'taxes' | 'invested'

export const INCOME_LABELS: Record<IncomeSource, string> = {
  rent: '🏠 Rent',
  sales: '🏪 Shop sales',
  farm: '🌾 Farm sales',
  tourism: '🧳 Tourism',
  prizes: '🏆 Prizes and rewards',
}

export const SPENDING_LABELS: Record<Spending, string> = {
  running: '🔧 Running costs and repairs',
  seeds: '🌱 Seeds',
  goods: '🚢 Goods bought',
  taxes: '🏛️ Taxes and penalties',
  invested: '🏗️ Invested: buildings, upgrades, land',
}

// Invested isn't a cost of running the town (the buildings are still yours),
// so profit leaves it out.
export const OPERATING: Spending[] = ['running', 'seeds', 'goods', 'taxes']

export interface Month {
  index: number // GameClock.monthIndex
  income: Partial<Record<IncomeSource, number>>
  spending: Partial<Record<Spending, number>>
}

export interface Totals {
  income: Record<IncomeSource, number>
  spending: Record<Spending, number>
  totalIncome: number
  operatingCosts: number
  profit: number // income minus operating costs
  invested: number
}

export interface FinancesSave {
  months: Month[]
  earners: { year: number; byName: [string, number][] }[] // this year and last
}

const KEEP_MONTHS = 36

export class Finances {
  private months: Month[] = []
  private earners = new Map<number, Map<string, number>>() // year → building or crop → coins
  private clock: GameClock
  private events = new Emitter<{ kind: 'changed' }>()

  constructor(city: City, taxes: Taxes, clock: GameClock) {
    this.clock = clock
    city.onChange((e) => {
      switch (e.kind) {
        case 'collected': {
          const category = e.building.type.category
          this.earn(category === 'home' ? 'rent' : category === 'business' ? 'sales' : category === 'farm' ? 'farm' : 'prizes', e.amount, e.building.type.name)
          break
        }
        case 'harvested':
          this.earn('farm', e.amount, `${e.crop.emoji} ${e.crop.name}`)
          break
        case 'award':
          this.earn(e.reason.startsWith('Tourism') ? 'tourism' : 'prizes', e.amount)
          break
        case 'expense':
          this.spend('running', e.amount)
          break
        case 'planted':
          this.spend('seeds', e.cost)
          break
        case 'goodsIn':
          this.spend('goods', e.cost)
          break
        case 'added':
          this.spend('invested', e.paid)
          break
        case 'upgraded':
          this.spend('invested', e.cost)
          break
        case 'land':
          if (e.bought) this.spend('invested', e.bought.price)
          break
      }
    })
    taxes.onChange((e) => {
      if (e.kind === 'taxDay') this.spend('taxes', e.taxReturn.amountDue)
      if (e.kind === 'penalty') this.spend('taxes', e.amount)
    })
  }

  onChange(listener: () => void) {
    this.events.on(listener)
  }

  // The last `count` months, oldest first, ending with this one (empty months included).
  recent(count = 12): Month[] {
    const now = this.clock.monthIndex
    const out: Month[] = []
    for (let i = now - count + 1; i <= now; i++) {
      if (i < 0) continue
      out.push(this.months.find((m) => m.index === i) ?? { index: i, income: {}, spending: {} })
    }
    return out
  }

  // Totals for a game year (1 = the first), or for a single month.
  totals(year: number): Totals {
    return sum(this.months.filter((m) => Math.floor(m.index / 12) + 1 === year))
  }

  monthTotals(month: Month): Totals {
    return sum([month])
  }

  // The biggest earners in a year: buildings by type, and crops.
  topEarners(year: number, count = 5): [string, number][] {
    return [...(this.earners.get(year) ?? new Map())].sort((a, b) => b[1] - a[1]).slice(0, count)
  }

  toSave(): FinancesSave {
    return { months: this.months.map((m) => ({ ...m })), earners: [...this.earners].map(([year, byName]) => ({ year, byName: [...byName] })) }
  }

  load(save: FinancesSave | undefined) {
    this.months = save?.months.map((m) => ({ ...m })) ?? []
    this.earners = new Map((save?.earners ?? []).map((e) => [e.year, new Map(e.byName)]))
  }

  private month(): Month {
    const index = this.clock.monthIndex
    let m = this.months.find((x) => x.index === index)
    if (!m) {
      m = { index, income: {}, spending: {} }
      this.months.push(m)
      this.months = this.months.filter((x) => x.index > index - KEEP_MONTHS)
      // Keep the top earners for this year and last.
      for (const year of this.earners.keys()) if (year < this.clock.year - 1) this.earners.delete(year)
    }
    return m
  }

  private earn(source: IncomeSource, amount: number, name?: string) {
    if (amount <= 0) return
    const m = this.month()
    m.income[source] = (m.income[source] ?? 0) + amount
    if (name) {
      const year = this.clock.year
      const byName = this.earners.get(year) ?? new Map<string, number>()
      byName.set(name, (byName.get(name) ?? 0) + amount)
      this.earners.set(year, byName)
    }
    this.events.emit({ kind: 'changed' })
  }

  private spend(kind: Spending, amount: number) {
    if (amount <= 0) return
    const m = this.month()
    m.spending[kind] = (m.spending[kind] ?? 0) + amount
    this.events.emit({ kind: 'changed' })
  }
}

function sum(months: Month[]): Totals {
  const income: Record<IncomeSource, number> = { rent: 0, sales: 0, farm: 0, tourism: 0, prizes: 0 }
  const spending: Record<Spending, number> = { running: 0, seeds: 0, goods: 0, taxes: 0, invested: 0 }
  for (const m of months) {
    for (const [k, v] of Object.entries(m.income)) income[k as IncomeSource] += v
    for (const [k, v] of Object.entries(m.spending)) spending[k as Spending] += v
  }
  const totalIncome = Object.values(income).reduce((a, b) => a + b, 0)
  const operatingCosts = OPERATING.reduce((a, k) => a + spending[k], 0)
  return { income, spending, totalIncome, operatingCosts, profit: totalIncome - operatingCosts, invested: spending.invested }
}
