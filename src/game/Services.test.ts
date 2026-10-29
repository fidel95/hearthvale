import { describe, expect, it } from 'vitest'
import { BUILDINGS_BY_ID } from './buildings'
import { City, type CityEvent } from './City'
import { Services, type ServicesEvent } from './Services'
import { COUNTY_SUPPLY } from './utilityRules'

const cottage = BUILDINGS_BY_ID.get('cottage')! // pays 15, needs 2 of each
const tower = BUILDINGS_BY_ID.get('water-tower')!
const at = (x: number, z: number) => ({ x: 20 + x, z: 20 + z })

describe('Services', () => {
  it('cuts income when a utility falls short, and announces the shortage once', () => {
    const city = new City()
    const services = new Services(city)
    const events: ServicesEvent['kind'][] = []
    services.onChange((e) => events.push(e.kind))
    // Ten cottages need 20 of each utility: more power and trash pickup than the county supplies.
    const homes = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18].map((x) => city.place(cottage, at(x, 0), { now: 0, free: true })!)
    expect(events.filter((k) => k === 'shortage')).toHaveLength(1) // one warning, however many run short
    const share = (u: keyof typeof COUNTY_SUPPLY) => Math.min(1, COUNTY_SUPPLY[u] / 20)
    expect(city.production.collect(homes[0].id, 30_000)).toBe(Math.round(15 * share('water') * share('power') * (0.75 + 0.25 * share('trash'))))
  })

  it('restores full income once a plant is built', () => {
    const city = new City()
    new Services(city)
    const homes = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18].map((x) => city.place(cottage, at(x, 0), { now: 0, free: true })!)
    city.place(tower, at(0, 4), { free: true })
    city.place(BUILDINGS_BY_ID.get('power-plant')!, at(4, 4), { free: true })
    city.place(BUILDINGS_BY_ID.get('recycling-center')!, at(0, 8), { free: true })
    expect(city.production.collect(homes[0].id, 30_000)).toBe(15)
  })

  it('pays the running costs each month as an expense', () => {
    const city = new City()
    const services = new Services(city)
    city.place(tower, at(0, 0), { free: true })
    const expenses: CityEvent[] = []
    city.onChange((e) => e.kind === 'expense' && expenses.push(e))
    const before = city.coins
    services.endOfMonth()
    expect(city.coins).toBe(before - 15)
    expect(expenses).toEqual([{ kind: 'expense', amount: 15, reason: 'Running costs' }])
  })

  it('raises income near a park and charges its running cost', () => {
    const city = new City()
    const services = new Services(city)
    const home = city.place(cottage, at(0, 0), { now: 0, free: true })!
    city.place(BUILDINGS_BY_ID.get('park')!, at(3, 0), { free: true })
    expect(services.bonus(home)).toEqual({ total: 0.1, sources: ['Park'] })
    expect(city.production.collect(home.id, 30_000)).toBe(Math.round(15 * 1.1))
    expect(city.valueMultiplier(home)).toBeCloseTo(1.1)
    expect(services.report.upkeep).toBe(5)
  })

  it('updates bonuses when a building moves away', () => {
    const city = new City()
    const services = new Services(city)
    const home = city.place(cottage, at(0, 0), { free: true })!
    const park = city.place(BUILDINGS_BY_ID.get('park')!, at(3, 0), { free: true })!
    city.move(park.id, at(15, 15))
    expect(services.bonus(home).total).toBe(0)
  })
})
