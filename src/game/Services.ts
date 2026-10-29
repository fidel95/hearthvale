import { Emitter } from './events'
import type { City, PlacedBuilding } from './City'
import { cityRating, type CityRating } from './cityRating'
import { locationBonus, type LocationBonus } from './communityRules'
import { UTILITIES, incomeMultiplier, plannedResidents, serviceReport, type ServiceReport, type Utility } from './utilityRules'

// Keeps the town's utility report and every building's location bonus up to
// date, tells City how much each building earns and is worth, and pays the
// running costs of utility and community buildings every game month.
// The rules themselves are in utilityRules.ts and communityRules.ts.

export type ServicesEvent =
  | { kind: 'changed'; report: ServiceReport }
  // Utilities that just started falling short of demand.
  | { kind: 'shortage'; utilities: Utility[] }

export class Services {
  report: ServiceReport
  private bonuses = new Map<number, LocationBonus>()
  private city: City
  private events = new Emitter<ServicesEvent>()

  constructor(city: City) {
    this.city = city
    this.report = this.compute()
    // Earnings: cut by utility shortages, raised by a good location.
    city.incomeMultiplier = (b) => this.utilityShare(b) * (1 + this.bonus(b).total) * (1 + this.townBonus())
    // Value for property tax: a good location raises it (shortages are temporary, so they don't).
    city.valueMultiplier = (b) => 1 + this.bonus(b).total
    city.onChange((event) => {
      const changes = ['added', 'removed', 'moved', 'finished', 'upgraded', 'stored', 'restored']
      if (changes.includes(event.kind)) this.refresh()
    })
  }

  onChange(listener: (event: ServicesEvent) => void) {
    this.events.on(listener)
  }

  // Landmarks' bonus to all rent and sales.
  townBonus(): number {
    let bonus = 0
    for (const b of this.city.all()) if (this.city.isBuilt(b)) bonus += b.type.townBonus ?? 0
    return bonus
  }

  // How much sooner ships arrive (the Lighthouse).
  shipSpeedBonus(): number {
    let bonus = 0
    for (const b of this.city.all()) if (this.city.isBuilt(b)) bonus += b.type.shipSpeedBonus ?? 0
    return Math.min(0.5, bonus)
  }

  rating(): CityRating {
    return cityRating({
      buildings: [...this.city.all()].filter((b) => this.city.isBuilt(b)),
      report: this.report,
      bonus: (b) => this.bonus(b as PlacedBuilding),
      hasRoad: (b) => this.city.hasRoadAccess(b as PlacedBuilding),
      debt: this.city.debt,
    })
  }

  // Is there room in town for this many more residents?
  roomFor(residents: number): boolean {
    return residents <= 0 || plannedResidents(this.city.all()) + residents <= this.report.capacity
  }

  // The share of its income a building gets from the utilities (1 = fully served).
  utilityShare(b: PlacedBuilding): number {
    return incomeMultiplier(this.report, b.type.category)
  }

  // What a building's surroundings add to its income and value.
  bonus(b: PlacedBuilding): LocationBonus {
    return this.bonuses.get(b.id) ?? { total: 0, sources: [] }
  }

  // Called once for every game month that ends: pay to run the utility buildings.
  endOfMonth() {
    if (this.report.upkeep > 0) this.city.economy.expense(this.report.upkeep, 'Running costs')
  }

  private compute(): ServiceReport {
    return serviceReport([...this.city.all()].filter((b) => this.city.isBuilt(b)))
  }

  private refresh() {
    const before = this.report
    this.report = this.compute()
    // Any building can change the bonus of the ones around it, so redo them all. Cheap for a town this size.
    const all = [...this.city.all()].filter((b) => this.city.isBuilt(b))
    this.bonuses.clear()
    for (const b of all) this.bonuses.set(b.id, locationBonus(b, all, this.city.isRoad))
    this.emit({ kind: 'changed', report: this.report })
    const newlyShort = UTILITIES.filter((u) => before.utilities[u].level >= 1 && this.report.utilities[u].level < 1)
    if (newlyShort.length > 0) this.emit({ kind: 'shortage', utilities: newlyShort })
  }

  private emit(event: ServicesEvent) {
    this.events.emit(event)
  }
}
