import { describe, expect, it } from 'vitest'
import { City } from './City'
import { GameClock } from './GameClock'
import { Inventory } from './Inventory'
import { HELPS_PER_DAY, HELP_REWARD, NEIGHBORS, dailyRequest, dayKey, planTown, seededRandom } from './neighborData'
import { Neighbors } from './Neighbors'
import { Player } from './Player'
import { xpForLevel } from './progression'
import { Taxes } from './Taxes'

const rosa = NEIGHBORS[0]
const DAY = new Date(2026, 9, 29, 12).getTime()

function town() {
  const city = new City()
  const taxes = new Taxes(city, new GameClock())
  const player = new Player(city, () => DAY)
  const inventory = new Inventory(city)
  const neighbors = new Neighbors(city, player, inventory)
  return { city, taxes, player, inventory, neighbors }
}

describe('neighbor towns', () => {
  it('are the same every time for the same neighbor, level and day', () => {
    const a = planTown(rosa, 6, '2026-10-29').map((p) => `${p.type.id}@${p.tile.x},${p.tile.z}`)
    const b = planTown(rosa, 6, '2026-10-29').map((p) => `${p.type.id}@${p.tile.x},${p.tile.z}`)
    expect(a).toEqual(b)
    expect(seededRandom(5)()).toBe(seededRandom(5)())
  })

  it('fit on the starting land without overlaps, and grow with the level', () => {
    for (const level of [1, 6, 12]) {
      const city = new City()
      const plan = planTown(rosa, level, 'any day')
      for (const p of plan) expect(city.place(p.type, p.tile, { free: true, rotation: p.rotation }), `${p.type.id} at level ${level}`).not.toBeNull()
    }
    expect(planTown(rosa, 12, 'd').length).toBeGreaterThan(planTown(rosa, 1, 'd').length)
  })

  it('only use buildings unlocked at their level', () => {
    for (const p of planTown(rosa, 3, 'd')) expect(p.type.unlockLevel).toBeLessThanOrEqual(3)
  })
})

describe('Neighbors', () => {
  it('unlock at level 7', () => {
    const { player, neighbors } = town()
    expect(neighbors.unlocked).toBe(false)
    player.grantXp(xpForLevel(7))
    expect(neighbors.unlocked).toBe(true)
  })

  it('pay for help (taxable), up to five times a day, once per spot', () => {
    const { city, taxes, neighbors } = town()
    const coins = city.coins
    expect(neighbors.help(rosa, '25,25', DAY)).toBe(true)
    expect(neighbors.help(rosa, '25,25', DAY)).toBe(false) // already helped there
    for (let i = 1; i < HELPS_PER_DAY; i++) neighbors.help(rosa, `spot${i}`, DAY)
    expect(neighbors.helpsLeft(rosa, DAY)).toBe(0)
    expect(neighbors.help(rosa, 'one more', DAY)).toBe(false)
    expect(city.coins).toBeGreaterThanOrEqual(coins + HELP_REWARD.coins * HELPS_PER_DAY)
    expect(taxes.estimate().otherIncome).toBeGreaterThanOrEqual(HELP_REWARD.coins * HELPS_PER_DAY) // payment for a service
    expect(neighbors.friendship(rosa)).toBe(HELPS_PER_DAY)
    // A new day brings new helps; friendship stays.
    const tomorrow = DAY + 24 * 3600_000
    expect(neighbors.helpsLeft(rosa, tomorrow)).toBe(HELPS_PER_DAY)
    expect(neighbors.friendship(rosa)).toBe(HELPS_PER_DAY)
  })

  it('send a daily gift, which is not income', () => {
    const { taxes, inventory, neighbors } = town()
    const gift = neighbors.gift(rosa, DAY)
    expect(neighbors.claimGift(rosa, DAY)).toBe(true)
    expect(neighbors.claimGift(rosa, DAY)).toBe(false)
    expect(inventory.count(gift.material)).toBe(gift.amount)
    expect(taxes.estimate().grossIncome).toBe(0) // gifts aren't income (IRC §102)
  })

  it('thank you with a gift for what they asked for', () => {
    const { city, taxes, inventory, neighbors } = town()
    const request = dailyRequest(rosa, dayKey(DAY))
    expect(neighbors.canFulfill(rosa, DAY)).toBe(false)
    inventory.add(request.material, request.amount)
    const coins = city.coins
    const thanks = neighbors.fulfill(rosa, DAY)
    expect(thanks).toBeGreaterThan(0)
    expect(city.coins).toBeGreaterThanOrEqual(coins + thanks)
    expect(inventory.count(request.material)).toBe(0)
    expect(taxes.estimate().otherIncome).toBe(0) // a gift both ways: no income
    expect(neighbors.isRequestDone(rosa, DAY)).toBe(true)
  })

  it('round-trips through a save', () => {
    const { neighbors } = town()
    neighbors.help(rosa, 'a', DAY)
    const other = town().neighbors
    other.load(JSON.parse(JSON.stringify(neighbors.toSave())))
    expect(other.friendship(rosa)).toBe(1)
    expect(other.helpsLeft(rosa, DAY)).toBe(HELPS_PER_DAY - 1)
  })
})
