import { describe, expect, it } from 'vitest'
import { BUILDINGS_BY_ID } from './buildings'
import { City } from './City'
import { PlacementSystem } from './PlacementSystem'
import { Player } from './Player'
import { Services } from './Services'
import { UnlockSystem } from './UnlockSystem'

const at = (x: number, z: number) => ({ x: 20 + x, z: 20 + z })
const b = (id: string) => BUILDINGS_BY_ID.get(id)!

describe('city rating', () => {
  it('adds up visible parts, each with a hint', () => {
    const city = new City()
    const services = new Services(city)
    city.place(b('cottage'), at(0, 0), { free: true })
    const r = services.rating()
    expect(r.total).toBe(r.parts.reduce((s, p) => s + p.points, 0))
    expect(r.total).toBeLessThanOrEqual(100)
    for (const p of r.parts) expect(p.hint.length).toBeGreaterThan(0)
  })

  it('goes up with roads, decorations and paid bills, and down with debt', () => {
    const city = new City()
    const services = new Services(city)
    city.place(b('cottage'), at(0, 0), { free: true })
    const bare = services.rating().total
    city.place(b('road'), at(2, 0), { free: true })
    city.place(b('oak-tree'), at(0, 2), { free: true })
    const nicer = services.rating().total
    expect(nicer).toBeGreaterThan(bare)
    city.economy.adjust(-city.coins)
    city.economy.bill(500)
    expect(services.rating().total).toBeLessThan(nicer)
  })
})

describe('landmarks', () => {
  it('need a minimum rating, and only one of each can be built', () => {
    const city = new City()
    const services = new Services(city)
    const player = new Player(city)
    player.grantXp(100_000) // high enough level to build landmarks
    city.economy.adjust(10_000)
    const placement = new PlacementSystem(city, services, new UnlockSystem(player))
    const problems = () => placement.check(tower).problems.join(' ')
    const tower = b('clock-tower')
    // A bare cottage, with no road or neighborhood around it, rates low.
    city.place(b('cottage'), at(0, 0), { free: true })
    expect(problems()).toMatch(/rating/)
    // A road and a tree make it a tidy little town.
    city.place(b('road'), at(2, 0), { free: true })
    city.place(b('oak-tree'), at(0, 2), { free: true })
    expect(services.rating().total).toBeGreaterThanOrEqual(tower.minRating!)
    expect(placement.check(tower).ok).toBe(true)
    city.place(tower, at(6, 6), { free: true })
    expect(problems()).toMatch(/already/)
  })

  it('raise all rent and sales in town', () => {
    const city = new City()
    new Services(city)
    const home = city.place(b('cottage'), at(0, 0), { now: 0, free: true })!
    city.place(b('clock-tower'), at(10, 10), { free: true })
    expect(city.production.payout(home)).toBe(Math.round(15 * 1.05))
  })
})
