import { Emitter } from './events'
import type { City } from './City'
import type { Inventory } from './Inventory'
import type { Materials } from './items'

// Civic upgrades, bought at the Town Hall: town-wide improvements, each in
// three steps. They belong to the town, not to one building, so they stay if
// the Town Hall is moved or rebuilt; you need a finished Town Hall to buy the
// next step.
//
// Like the buildings they improve, they're capital spending: coins and
// materials paid once, not a running expense, so there's no deduction.

export type CivicId = 'storehouse' | 'port' | 'commerce'

export interface CivicStep {
  coins: number
  materials: Materials
  effect: number // the total effect once this step is bought
}

export interface CivicUpgrade {
  id: CivicId
  name: string
  icon: string
  describe: (effect: number) => string
  steps: CivicStep[]
}

export const CIVIC_UPGRADES: CivicUpgrade[] = [
  {
    id: 'storehouse',
    name: 'Town storehouse',
    icon: '📦',
    describe: (n) => `+${n} goods storage`,
    steps: [
      { coins: 3000, materials: { lumber: 10 }, effect: 100 },
      { coins: 8000, materials: { bricks: 15 }, effect: 250 },
      { coins: 20000, materials: { steel: 20 }, effect: 500 },
    ],
  },
  {
    id: 'port',
    name: 'Port authority',
    icon: '⚓',
    describe: (n) => `Ships and cargo planes back ${Math.round(n * 100)}% sooner`,
    steps: [
      { coins: 4000, materials: { steel: 8 }, effect: 0.1 },
      { coins: 10000, materials: { steel: 12, glass: 6 }, effect: 0.2 },
      { coins: 25000, materials: { steel: 20 }, effect: 0.3 },
    ],
  },
  {
    id: 'commerce',
    name: 'Chamber of Commerce',
    icon: '🤝',
    describe: (n) => `Franchise takings +${Math.round(n * 100)}%`,
    steps: [
      { coins: 5000, materials: { glass: 8 }, effect: 0.25 },
      { coins: 12000, materials: { glass: 12 }, effect: 0.5 },
      { coins: 30000, materials: { glass: 20 }, effect: 1 },
    ],
  },
]

export type CivicSave = [CivicId, number][]

export class Civic {
  private levels = new Map<CivicId, number>()
  private events = new Emitter<void>()
  private city: City
  private inventory: Inventory

  constructor(city: City, inventory: Inventory) {
    this.city = city
    this.inventory = inventory
  }

  onChange(listener: () => void) {
    this.events.on(listener)
  }

  level(id: CivicId): number {
    return this.levels.get(id) ?? 0
  }

  // The bought steps' total effect (0 before the first).
  effect(id: CivicId): number {
    const upgrade = CIVIC_UPGRADES.find((u) => u.id === id)!
    const level = this.level(id)
    return level ? upgrade.steps[level - 1].effect : 0
  }

  // The next step to buy, or null when it's done.
  next(id: CivicId): CivicStep | null {
    return CIVIC_UPGRADES.find((u) => u.id === id)!.steps[this.level(id)] ?? null
  }

  hasTownHall(): boolean {
    return [...this.city.all()].some((b) => b.type.id === 'town-hall' && this.city.isBuilt(b))
  }

  canBuy(id: CivicId): boolean {
    const step = this.next(id)
    return !!step && this.hasTownHall() && this.city.coins >= step.coins && this.inventory.hasAll(step.materials)
  }

  buy(id: CivicId): boolean {
    if (!this.canBuy(id)) return false
    const step = this.next(id)!
    this.inventory.use(step.materials)
    this.city.economy.adjust(-step.coins)
    this.levels.set(id, this.level(id) + 1)
    if (id === 'storehouse') this.city.storageChanged()
    this.events.emit()
    return true
  }

  toSave(): CivicSave {
    return [...this.levels]
  }

  load(saved: CivicSave) {
    const steps = (id: CivicId) => CIVIC_UPGRADES.find((u) => u.id === id)?.steps.length ?? 0
    this.levels = new Map(saved.filter(([id]) => steps(id) > 0).map(([id, n]) => [id, Math.min(n, steps(id))]))
    this.city.storageChanged()
    this.events.emit()
  }
}
