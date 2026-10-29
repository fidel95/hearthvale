import { describe, expect, it } from 'vitest'
import { BUILDINGS_BY_ID } from './buildings'
import { City } from './City'
import { Inventory } from './Inventory'
import { PlacementSystem } from './PlacementSystem'
import { Player } from './Player'
import { landQuote, upgradeBuilding, upgradeQuote } from './projects'
import { Services } from './Services'
import { UnlockSystem } from './UnlockSystem'

const at = (x: number, z: number) => ({ x: 20 + x, z: 20 + z })
const b = (id: string) => BUILDINGS_BY_ID.get(id)!

function setup() {
  const city = new City()
  const services = new Services(city)
  const player = new Player(city)
  const inventory = new Inventory(city)
  const placement = new PlacementSystem(city, services, new UnlockSystem(player))
  return { city, services, player, inventory, placement }
}

describe('PlacementSystem', () => {
  it('gives every reason in words', () => {
    const { city, placement, player } = setup()
    expect(placement.check(b('townhouse')).problems[0]).toMatch(/level/)
    city.economy.bill(city.coins)
    expect(placement.check(b('cottage')).problems[0]).toMatch(/more/)
    city.economy.adjust(10_000)
    player.grantXp(100_000)
    expect(placement.check(b('cottage')).ok).toBe(true)
  })

  it('checks the footprint and warns about a missing road', () => {
    const { city, placement } = setup()
    city.economy.adjust(10_000)
    city.place(b('cottage'), at(0, 0), { free: true })
    expect(placement.check(b('cottage'), { tile: at(0, 0), rotation: 0 }).problems).toContain("It doesn't fit there")
    const shop = placement.check(b('bakery'), { tile: at(6, 6), rotation: 0 }, { free: true })
    expect(shop.ok).toBe(true)
    expect(shop.warnings[0]).toMatch(/road/)
  })

  it('lets a free move skip the unlock and coins checks', () => {
    const { city, placement } = setup()
    city.economy.bill(city.coins)
    expect(placement.check(b('townhouse'), { tile: at(6, 6), rotation: 0 }, { free: true }).ok).toBe(true)
  })
})

describe('PlacementSystem.checkMany', () => {
  const spot = (x: number, z: number) => ({ tile: at(x, z), rotation: 0 as const })

  it('accepts several spots that each fit and that the town can afford together', () => {
    const { city, placement } = setup()
    city.economy.adjust(1000)
    expect(placement.checkMany(b('cottage'), [spot(0, 0), spot(3, 0), spot(6, 0)]).ok).toBe(true)
  })

  it('refuses spots that overlap each other', () => {
    const { city, placement } = setup()
    city.economy.adjust(1000)
    expect(placement.checkMany(b('cottage'), [spot(0, 0), spot(1, 1)]).problems).toContain('Those spots overlap')
  })

  it('needs coins for all of them together, not just one', () => {
    const { city, placement } = setup()
    city.economy.bill(city.coins - 250) // enough for two cottages, not three
    expect(placement.checkMany(b('cottage'), [spot(0, 0), spot(3, 0)]).ok).toBe(true)
    expect(placement.checkMany(b('cottage'), [spot(0, 0), spot(3, 0), spot(6, 0)]).problems[0]).toMatch(/Need 🪙 50 more for 3/)
  })

  it('allows only one of a one-of-a-kind building', () => {
    const { city, placement, player } = setup()
    player.grantXp(100_000)
    city.economy.adjust(100_000)
    city.place(b('road'), at(5, 4), { free: true })
    city.place(b('oak-tree'), at(9, 9), { free: true })
    const problems = placement.checkMany(b('clock-tower'), [spot(0, 0), spot(4, 0)]).problems
    expect(problems.some((p) => p.includes('only be one'))).toBe(true)
  })
})

describe('quotes', () => {
  it('say what an upgrade needs, and agree with the action', () => {
    const { city, player, inventory, services } = setup()
    const home = city.place(b('cottage'), at(0, 0), { now: 0, free: true })!
    const room = (n: number) => services.roomFor(n)
    const quote = upgradeQuote(city, inventory, player, home, room)!
    expect(quote.result).toEqual({ ok: false, reason: 'level' })
    expect(upgradeBuilding(city, inventory, player, home, room)).toEqual(quote.result)
    player.grantXp(100_000)
    city.economy.adjust(100_000)
    for (const [id, n] of Object.entries(quote.materials)) inventory.add(id, n)
    expect(upgradeQuote(city, inventory, player, home, room)!.result.ok).toBe(true)
    expect(upgradeBuilding(city, inventory, player, home, room).ok).toBe(true)
  })

  it('say what the next lot needs', () => {
    const { city, player, inventory } = setup()
    const quote = landQuote(city, inventory, player)
    expect(quote.coins).toBe(city.nextLotPrice)
    expect(quote.result.ok).toBe(false)
    expect(Object.keys(quote.missing).length).toBeGreaterThan(0)
  })
})
