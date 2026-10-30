import type { City } from './City'

// Visitors from out of town. Transport brings them (arrivals: bus stops, the
// dock, the train station, the airport) and attractions give them something
// to do (room for visitors: parks, the beach, the ski resort, landmarks...).
// Each month the town gets the smaller of the two, and each visitor spends a
// little: taxable income for the town. Only working buildings count.

export const SPEND_PER_VISITOR = 2 // coins, each month

export interface TourismReport {
  arrivals: number // visitors transport can bring each month
  room: number // visitors the attractions can take
  visitors: number // the smaller of the two
  income: number // what they spend each month
}

export class Tourism {
  private city: City

  constructor(city: City) {
    this.city = city
  }

  report(): TourismReport {
    let arrivals = 0
    let room = 0
    for (const b of this.city.all()) {
      if (!this.city.isOperating(b)) continue
      arrivals += b.type.arrivals ?? 0
      room += b.type.visitors ?? 0
    }
    const visitors = Math.min(arrivals, room)
    return { arrivals, room, visitors, income: visitors * SPEND_PER_VISITOR }
  }

  // At the end of each game month: the visitors' spending comes in.
  endOfMonth() {
    const { income } = this.report()
    if (income > 0) this.city.economy.award(income, 'Tourism: visitor spending')
  }
}
