import { describe, expect, it } from 'vitest'
import { BUILDINGS_BY_ID } from './buildings'
import { City } from './City'
import { levelFactor, upgradeCost } from './construction'
import { GameClock, MONTH_MS } from './GameClock'
import { Inventory } from './Inventory'
import { Player } from './Player'
import { xpForLevel } from './progression'
import { finishConstruction, upgradeBuilding } from './projects'
import { Taxes } from './Taxes'

const at = (x: number, z: number) => ({ x: 20 + x, z: 20 + z })
const b = (id: string) => BUILDINGS_BY_ID.get(id)!
const townhouse = b('townhouse') // 60 s to build, needs 3 lumber

function town() {
  const city = new City()
  const clock = new GameClock()
  const taxes = new Taxes(city, clock)
  const inventory = new Inventory(city)
  let time = 0
  const player = new Player(city, () => time)
  const runMonths = (n: number) => {
    for (let i = 0; i < n; i++) for (let t = 0; t < MONTH_MS; t += 250) for (const m of clock.advance(250)) taxes.endOfMonth(m)
  }
  return { city, taxes, inventory, player, runMonths, setTime: (t: number) => (time = t) }
}

describe('Inventory', () => {
  it('buys materials at their price and uses them at average cost', () => {
    const { city, inventory } = town()
    const coins = city.coins
    expect(inventory.buy({ lumber: 3 })).toBe(true) // 12 each
    expect(city.coins).toBe(coins - 36)
    inventory.add('lumber', 3) // found for free
    expect(inventory.use({ lumber: 2 })).toBeCloseTo(12) // 36 for 6 → 6 each
    expect(inventory.count('lumber')).toBe(4)
    expect(inventory.missing({ lumber: 5, steel: 1 })).toEqual({ lumber: 1, steel: 1 })
  })
})

describe('construction', () => {
  it('starts as a site that earns nothing and isn’t depreciated', () => {
    const { city, taxes, runMonths } = town()
    const house = city.place(townhouse, at(0, 0), { now: 0 })!
    expect(city.isBuilt(house)).toBe(false)
    expect(city.isReady(house, 999_999)).toBe(false)
    runMonths(2)
    expect(taxes.ledger.depreciation).toBe(0)
  })

  it('finishes once the timer is done and the materials are there', () => {
    const { city, inventory } = town()
    const house = city.place(townhouse, at(0, 0), { now: 0 })!
    expect(finishConstruction(city, inventory, house, 59_999)).toEqual({ ok: false, reason: 'not-ready' })
    expect(finishConstruction(city, inventory, house, 60_000)).toEqual({ ok: false, reason: 'materials', missing: { lumber: 3 } })
    inventory.buy({ lumber: 3 })
    expect(finishConstruction(city, inventory, house, 60_000)).toEqual({ ok: true })
    expect(city.isBuilt(house)).toBe(true)
    expect(inventory.count('lumber')).toBe(0)
    expect(city.isReady(house, 60_000 + 60_000)).toBe(true) // its income timer starts now
  })

  it('adds the materials to the building’s cost for depreciation', () => {
    const { city, inventory, taxes } = town()
    const house = city.place(townhouse, at(0, 0), { now: 0 })!
    inventory.buy({ lumber: 3 })
    finishConstruction(city, inventory, house, 60_000)
    const asset = taxes.toSave().assets.find(([id]) => id === house.id)![1]
    expect(asset.basis).toBe(250 + 36)
  })

  it('places small and free buildings ready to use', () => {
    const { city } = town()
    expect(city.isBuilt(city.place(b('cottage'), at(0, 0))!)).toBe(true)
    expect(city.isBuilt(city.place(townhouse, at(4, 0), { free: true })!)).toBe(true)
  })
})

describe('upgrades', () => {
  it('needs the level, coins and materials, then pays more', () => {
    const { city, inventory, player } = town()
    const cottage = city.place(b('cottage'), at(0, 0), { now: 0, free: true })!
    const cost = upgradeCost(cottage.type, 2) // 75 coins, 4 lumber + 2 bricks, and a player level
    expect(upgradeBuilding(city, inventory, player, cottage)).toEqual({ ok: false, reason: 'level' })
    city.adjustCoins(10_000)
    player.grantXp(xpForLevel(cost.playerLevel))
    expect(upgradeBuilding(city, inventory, player, cottage)).toMatchObject({ ok: false, reason: 'materials' })
    inventory.buy(cost.materials)
    const coins = city.coins
    expect(upgradeBuilding(city, inventory, player, cottage)).toEqual({ ok: true })
    expect(cottage.level).toBe(2)
    expect(city.coins).toBe(coins - cost.coins)
    expect(city.payout(cottage)).toBe(Math.round(15 * levelFactor(2))) // 22.5, rounded
  })

  it('counts as an improvement: higher basis and higher assessed value', () => {
    const { city, taxes } = town()
    const cottage = city.place(b('cottage'), at(0, 0), { free: true })!
    const before = taxes.properties()[0].value
    city.upgrade(cottage.id, 75, 50)
    expect(taxes.properties()[0].value).toBeCloseTo(before * 1.5)
    expect(taxes.toSave().assets.find(([id]) => id === cottage.id)![1].basis).toBe(100 + 125)
  })
})

describe('storing buildings', () => {
  it('takes a building off the map and puts it back, free', () => {
    const { city } = town()
    const cottage = city.place(b('cottage'), at(0, 0), { free: true })!
    expect(city.store(cottage.id)).toBe(true)
    expect([...city.all()]).toHaveLength(0)
    expect(city.buildingAt(at(0, 0))).toBeUndefined()
    const coins = city.coins
    expect(city.restore(cottage.id, at(6, 6))).toBe(true)
    expect(city.coins).toBe(coins)
    expect(city.buildingAt(at(6, 6))).toBe(cottage)
  })

  it('pays no property tax while stored, and keeps its tax record', () => {
    const { city, taxes, runMonths } = town()
    const cottage = city.place(b('cottage'), at(0, 0), { free: true })!
    city.store(cottage.id)
    runMonths(1)
    const land = taxes.land().annualTax / 12
    expect(taxes.ledger.propertyTax).toBeCloseTo(land) // just the land
    expect(taxes.toSave().assets.some(([id]) => id === cottage.id)).toBe(true)
  })

  it('round-trips stored buildings through a save', () => {
    const { city } = town()
    const cottage = city.place(b('cottage'), at(0, 0), { free: true })!
    city.store(cottage.id)
    const loaded = new City()
    loaded.load(JSON.parse(JSON.stringify(city.toSave())))
    expect(loaded.getStored(cottage.id)?.type.id).toBe('cottage')
    expect([...loaded.all()]).toHaveLength(0)
  })
})

describe('turning buildings', () => {
  it('swaps a turned building’s footprint', () => {
    const { city } = town()
    const store = b('general-store') // 3×2
    const shop = city.place(store, at(0, 0), { free: true, rotation: 1 })!
    expect(city.buildingAt(at(1, 2))).toBe(shop) // 2 wide, 3 deep when turned
    expect(city.buildingAt(at(2, 0))).toBeUndefined()
  })

  it('turns a building in place only where it fits, and keeps the turn in saves', () => {
    const { city } = town()
    const shop = city.place(b('general-store'), at(0, 0), { free: true })!
    city.place(b('cottage'), at(0, 2), { free: true }) // right behind it
    expect(city.move(shop.id, shop.tile, 1)).toBe(false) // turned, it would need that space
    expect(city.move(shop.id, at(10, 10), 1)).toBe(true)
    const loaded = new City()
    loaded.load(JSON.parse(JSON.stringify(city.toSave())))
    expect(loaded.get(shop.id)!.rotation).toBe(1)
  })

  it('remembers when income was last collected', () => {
    const { city } = town()
    const home = city.place(b('cottage'), at(0, 0), { now: 0, free: true })!
    expect(home.lastCollectedAt).toBeNull()
    city.collect(home.id, 30_000)
    expect(home.lastCollectedAt).toBe(30_000)
  })
})
