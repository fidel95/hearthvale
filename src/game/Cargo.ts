import type { City, PlacedBuilding } from './City'
import type { Inventory } from './Inventory'
import { MATERIALS, type MaterialId } from './items'

// Cargo planes. At the Airport you pick a destination; a freighter flies
// there and back in real time (so it keeps flying while the game is closed,
// like ships and crops), and you unload the goods into storage. One flight
// per airport at a time; a Cargo Hangar flies a second plane from the
// Airport's runway, so it needs the Airport built too.
//
// Like a shipment, the fare is paid up front and counts as inventory, not an
// expense: it's deducted bit by bit as shops sell the goods. Flying the same
// route again and again earns mastery stars, and the third star pays a reward.

export interface CargoRoute {
  id: string
  name: string
  icon: string
  units: number // goods brought back
  cost: number // coins paid
  seconds: number
  level: number // the player level that opens the route
  reward: { material: MaterialId; count: number } // for the third star
}

// Farther routes cost less per good, but take longer and need more room.
// The first three open with the Airport (level 15); the rest come later.
export const CARGO_ROUTES: CargoRoute[] = [
  { id: 'coast', name: 'Coastal run', icon: '🏖️', units: 80, cost: 400, seconds: 90, level: 15, reward: { material: 'lumber', count: 6 } },
  { id: 'mountain', name: 'Mountain pass', icon: '🏔️', units: 220, cost: 990, seconds: 4 * 60, level: 15, reward: { material: 'bricks', count: 8 } },
  { id: 'island', name: 'Island hop', icon: '🏝️', units: 350, cost: 1500, seconds: 6 * 60, level: 17, reward: { material: 'glass', count: 8 } },
  { id: 'overseas', name: 'Overseas haul', icon: '🌏', units: 600, cost: 2500, seconds: 12 * 60, level: 15, reward: { material: 'steel', count: 10 } },
  { id: 'polar', name: 'Polar freight', icon: '🧊', units: 1200, cost: 4500, seconds: 30 * 60, level: 18, reward: { material: 'steel', count: 20 } },
]

export const CARGO_ROUTES_BY_ID = new Map(CARGO_ROUTES.map((r) => [r.id, r]))

// Energy points spent unloading a plane.
export const UNLOAD_ENERGY = 2

// Finished trips on a route that earn each star.
export const STAR_TRIPS = [3, 8, 15]

export function starsFor(trips: number): number {
  return STAR_TRIPS.filter((n) => trips >= n).length
}

export interface CargoFlight {
  airportId: number
  routeId: string
  units: number // still aboard
  cost: number
  sentAt: number
  returnsAt: number
}

export type CargoState =
  | { stage: 'idle' }
  | { stage: 'flying'; flight: CargoFlight }
  | { stage: 'landed'; flight: CargoFlight }

export interface CargoSave {
  flights: CargoFlight[]
  trips: [string, number][] // finished trips per route
  rewarded: string[] // routes whose third-star reward was paid
}

export class Cargo {
  private flights = new Map<number, CargoFlight>()
  private trips = new Map<string, number>()
  private rewarded = new Set<string>()
  private listeners: (() => void)[] = []
  private city: City
  private inventory: Inventory
  private level: () => number
  // How much sooner planes return; Game can wire it to Services.
  speedBonus: () => number = () => 0

  constructor(city: City, inventory: Inventory, level: () => number) {
    this.city = city
    this.inventory = inventory
    this.level = level
    city.onChange((event) => {
      // Demolishing an airport with a plane out: the order is cancelled and refunded.
      if (event.kind === 'removed') {
        const flight = this.flights.get(event.building.id)
        if (!flight) return
        this.flights.delete(event.building.id)
        city.economy.adjust(flight.cost)
        this.changed()
      }
    })
  }

  onChange(listener: () => void) {
    this.listeners.push(listener)
  }

  private changed() {
    for (const l of this.listeners) l()
  }

  all(): Iterable<CargoFlight> {
    return this.flights.values()
  }

  state(airport: PlacedBuilding, now: number): CargoState {
    const flight = this.flights.get(airport.id)
    if (!flight) return { stage: 'idle' }
    return now < flight.returnsAt ? { stage: 'flying', flight } : { stage: 'landed', flight }
  }

  tripsOn(routeId: string): number {
    return this.trips.get(routeId) ?? 0
  }

  stars(routeId: string): number {
    return starsFor(this.tripsOn(routeId))
  }

  routeOpen(route: CargoRoute): boolean {
    return this.level() >= route.level
  }

  // A hangar's planes use the Airport's runway: no finished Airport, no flights.
  needsAirport(from: PlacedBuilding): boolean {
    return from.type.id !== 'airport' && ![...this.city.all()].some((b) => b.type.id === 'airport' && this.city.isBuilt(b))
  }

  canSend(airport: PlacedBuilding, route: CargoRoute): boolean {
    return (
      this.city.isBuilt(airport) &&
      !this.flights.has(airport.id) &&
      this.city.coins >= route.cost &&
      this.routeOpen(route) &&
      !this.needsAirport(airport)
    )
  }

  send(airport: PlacedBuilding, route: CargoRoute, now: number): boolean {
    if (!this.canSend(airport, route)) return false
    // Paid up front. Buying inventory isn't an expense, so this is a plain coin change.
    this.city.economy.adjust(-route.cost)
    this.flights.set(airport.id, {
      airportId: airport.id,
      routeId: route.id,
      units: route.units,
      cost: route.cost,
      sentAt: now,
      returnsAt: now + route.seconds * 1000 * (1 - this.speedBonus()),
    })
    this.changed()
    return true
  }

  // Unload as much as fits in storage (what doesn't fit stays aboard). Costs
  // UNLOAD_ENERGY once something comes off. Returns the units unloaded and,
  // when this finished the trip, whether it earned a reward.
  unload(airport: PlacedBuilding, now: number): { taken: number; reward?: { material: MaterialId; count: number }; star?: number } {
    const state = this.state(airport, now)
    if (state.stage !== 'landed') return { taken: 0 }
    const f = state.flight
    const taken = this.city.economy.addGoods(f.units, f.cost, UNLOAD_ENERGY)
    if (taken === 0) return { taken: 0 }
    const costTaken = (f.cost * taken) / f.units
    f.units -= taken
    f.cost -= costTaken
    if (f.units > 0) {
      this.changed()
      return { taken }
    }
    this.flights.delete(airport.id)
    const result: { taken: number; reward?: { material: MaterialId; count: number }; star?: number } = { taken }
    const before = this.stars(f.routeId)
    this.trips.set(f.routeId, this.tripsOn(f.routeId) + 1)
    const after = this.stars(f.routeId)
    if (after > before) result.star = after
    const route = CARGO_ROUTES_BY_ID.get(f.routeId)
    if (route && after >= 3 && !this.rewarded.has(route.id)) {
      this.rewarded.add(route.id)
      this.inventory.add(route.reward.material, route.reward.count)
      result.reward = route.reward
    }
    this.changed()
    return result
  }

  // Everything landed at once (the admin panel's "finish timers").
  landAll(now: number): boolean {
    let any = false
    for (const f of this.flights.values()) if (f.returnsAt > now) (f.returnsAt = now), (any = true)
    if (any) this.changed()
    return any
  }

  toSave(): CargoSave {
    return {
      flights: [...this.flights.values()].map((f) => ({ ...f })),
      trips: [...this.trips],
      rewarded: [...this.rewarded],
    }
  }

  load(saved: CargoSave) {
    this.flights.clear()
    this.trips = new Map(saved.trips)
    this.rewarded = new Set(saved.rewarded)
    for (const f of saved.flights) if (this.city.get(f.airportId) && CARGO_ROUTES_BY_ID.has(f.routeId)) this.flights.set(f.airportId, { ...f })
  }
}

export function rewardText(reward: { material: MaterialId; count: number }): string {
  return `${MATERIALS[reward.material].icon} ${reward.count} ${MATERIALS[reward.material].name.toLowerCase()}`
}
