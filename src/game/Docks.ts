import type { City, PlacedBuilding } from './City'

// Shipments by sea. At a Dock you order goods; a cargo ship brings them after
// a real-time voyage (so it keeps sailing while the game is closed, like crops),
// and you unload them into storage. One shipment per dock at a time.
//
// Paying for a shipment is buying inventory, not an expense, so it isn't
// deducted. Its cost is deducted bit by bit as shops sell the goods (Taxes,
// cost of goods sold).

export interface ShipmentOption {
  id: string
  name: string
  units: number
  cost: number
  seconds: number
}

// A bigger order costs less per unit but takes longer: bulk buying.
export const SHIPMENT_OPTIONS: ShipmentOption[] = [
  { id: 'small', name: 'Coastal freighter', units: 40, cost: 240, seconds: 60 },
  { id: 'large', name: 'Container ship', units: 150, cost: 750, seconds: 5 * 60 },
]

export interface Shipment {
  dockId: number
  optionId: string
  units: number
  cost: number
  orderedAt: number
  arrivesAt: number
}

export type DockState =
  | { stage: 'idle' }
  | { stage: 'sailing'; shipment: Shipment }
  | { stage: 'arrived'; shipment: Shipment }

export class Docks {
  private shipments = new Map<number, Shipment>()
  private city: City
  // How much sooner ships arrive (the Lighthouse); Game wires it to Services.
  speedBonus: () => number = () => 0

  constructor(city: City) {
    this.city = city
    city.onChange((event) => {
      // Demolishing a dock with a ship on the way: the order is cancelled and refunded.
      if (event.kind === 'removed') {
        const shipment = this.shipments.get(event.building.id)
        if (!shipment) return
        this.shipments.delete(event.building.id)
        city.economy.adjust(shipment.cost)
      }
    })
  }

  all(): Iterable<Shipment> {
    return this.shipments.values()
  }

  state(dock: PlacedBuilding, now: number): DockState {
    const shipment = this.shipments.get(dock.id)
    if (!shipment) return { stage: 'idle' }
    return now < shipment.arrivesAt ? { stage: 'sailing', shipment } : { stage: 'arrived', shipment }
  }

  canOrder(dock: PlacedBuilding, option: ShipmentOption): boolean {
    return !this.shipments.has(dock.id) && this.city.coins >= option.cost
  }

  order(dock: PlacedBuilding, option: ShipmentOption, now: number): boolean {
    if (!this.canOrder(dock, option)) return false
    // Paid up front, as most suppliers want. Buying inventory isn't an
    // expense, so this is a plain coin change, not a payExpense.
    this.city.economy.adjust(-option.cost)
    this.shipments.set(dock.id, {
      dockId: dock.id,
      optionId: option.id,
      units: option.units,
      cost: option.cost,
      orderedAt: now,
      arrivesAt: now + option.seconds * 1000 * (1 - this.speedBonus()),
    })
    return true
  }

  // Unload as much as fits in storage. What doesn't fit stays aboard for
  // later. Returns the units unloaded.
  unload(dock: PlacedBuilding, now: number): number {
    const state = this.state(dock, now)
    if (state.stage !== 'arrived') return 0
    const s = state.shipment
    const taken = this.city.economy.addGoods(s.units, s.cost)
    if (taken === 0) return 0
    const costTaken = (s.cost * taken) / s.units
    s.units -= taken
    s.cost -= costTaken
    if (s.units <= 0) this.shipments.delete(dock.id)
    return taken
  }

  toSave(): Shipment[] {
    return [...this.shipments.values()].map((s) => ({ ...s }))
  }

  load(saved: Shipment[]) {
    for (const s of saved) if (this.city.get(s.dockId)) this.shipments.set(s.dockId, { ...s })
  }
}
