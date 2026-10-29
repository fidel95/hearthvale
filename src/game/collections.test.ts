import { describe, expect, it } from 'vitest'
import { BUILDINGS_BY_ID } from './buildings'
import { City } from './City'
import { COLLECTIONS, Collections } from './collections'
import { GameClock } from './GameClock'
import { Inventory } from './Inventory'
import { Player } from './Player'
import { Taxes } from './Taxes'

const at = (x: number, z: number) => ({ x: 20 + x, z: 20 + z })
const home = COLLECTIONS.find((c) => c.id === 'home')!

// A town whose "random" numbers come from a list, so the test decides what drops.
function town(rolls: number[]) {
  const city = new City()
  const taxes = new Taxes(city, new GameClock())
  const inventory = new Inventory(city)
  const player = new Player(city, () => 0)
  let i = 0
  const collections = new Collections(city, inventory, player, () => rolls[i++ % rolls.length])
  return { city, taxes, inventory, player, collections }
}

describe('Collections', () => {
  it('sometimes finds an item when collecting rent, preferring ones you have fewest of', () => {
    const { city, inventory } = town([0.05, 0]) // drop (under 10%), then the first of the fewest
    const cottage = city.place(BUILDINGS_BY_ID.get('cottage')!, at(0, 0), { now: 0, free: true })!
    city.collect(cottage.id, 30_000)
    expect(inventory.count('teddy-bear')).toBe(1)
    city.collect(cottage.id, 60_000)
    expect(inventory.count('candle')).toBe(1) // teddy bear isn't among the fewest any more
  })

  it('finds nothing when the roll misses', () => {
    const { city, inventory } = town([0.99])
    const cottage = city.place(BUILDINGS_BY_ID.get('cottage')!, at(0, 0), { now: 0, free: true })!
    city.collect(cottage.id, 30_000)
    expect(inventory.all()).toHaveLength(0)
  })

  it('pays a taxable reward for a full set, which can be completed again', () => {
    const { city, taxes, inventory, player, collections } = town([0.99])
    expect(collections.complete(home)).toBe(false)
    for (const item of home.items) inventory.add(item.id, 1)
    const coins = city.coins
    expect(collections.complete(home)).toBe(true)
    // The set's 25 XP also reaches level 2, which pays its own 50-coin reward.
    expect(player.xp).toBe(home.reward.xp)
    expect(city.coins).toBe(coins + home.reward.coins + 50)
    expect(taxes.estimate().otherIncome).toBe(home.reward.coins + 50) // both are prizes
    expect(inventory.count('teddy-bear')).toBe(0)
    expect(collections.timesCompleted('home')).toBe(1)
  })
})
