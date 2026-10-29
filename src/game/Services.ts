import type { City } from './City'
import { UTILITIES, incomeMultiplier, serviceReport, type ServiceReport, type Utility } from './utilityRules'

// Keeps the town's utility report up to date, tells City how much each
// building earns, and pays the plants' running costs every game month.
// The rules themselves are in utilityRules.ts.

export type ServicesEvent =
  | { kind: 'changed'; report: ServiceReport }
  // Utilities that just started falling short of demand.
  | { kind: 'shortage'; utilities: Utility[] }

export class Services {
  report: ServiceReport
  private city: City
  private listeners: ((event: ServicesEvent) => void)[] = []

  constructor(city: City) {
    this.city = city
    this.report = this.compute()
    city.incomeMultiplier = (b) => incomeMultiplier(this.report, b.type.category)
    city.onChange((event) => {
      if (event.kind === 'added' || event.kind === 'removed') this.refresh()
    })
  }

  onChange(listener: (event: ServicesEvent) => void) {
    this.listeners.push(listener)
  }

  // Called once for every game month that ends: pay to run the utility buildings.
  endOfMonth() {
    if (this.report.upkeep > 0) this.city.payExpense(this.report.upkeep, 'Utility operating costs')
  }

  private compute(): ServiceReport {
    return serviceReport([...this.city.all()].map((b) => b.type))
  }

  private refresh() {
    const before = this.report
    this.report = this.compute()
    this.emit({ kind: 'changed', report: this.report })
    const newlyShort = UTILITIES.filter((u) => before.utilities[u].level >= 1 && this.report.utilities[u].level < 1)
    if (newlyShort.length > 0) this.emit({ kind: 'shortage', utilities: newlyShort })
  }

  private emit(event: ServicesEvent) {
    for (const listener of this.listeners) listener(event)
  }
}
