import { describe, expect, it } from 'vitest'
import { BUILDINGS_BY_ID } from './buildings'
import { City } from './City'
import { CROPS_BY_ID } from './crops'
import { Docks } from './Docks'
import { awaySummary } from './offline'
import { Player } from './Player'
import { ENERGY_REGEN_MS, maxEnergy } from './progression'

const at = (x: number, z: number) => ({ x: 20 + x, z: 20 + z })
const cottage = BUILDINGS_BY_ID.get('cottage')! // 15 every 30 s
const plot = BUILDINGS_BY_ID.get('farm-plot')!
const strawberries = CROPS_BY_ID.get('strawberries')! // ripe at 60 s, withers at 240 s
const potatoes = CROPS_BY_ID.get('potatoes')! // 8 h

describe('awaySummary', () => {
  it('counts income waiting, ripe and withered crops, and energy regained', () => {
    const city = new City()
    const player = new Player(city, () => 0)
    city.place(cottage, at(0, 0), { now: 0, free: true })
    city.place(cottage, at(3, 0), { now: 0, free: true })
    const a = city.place(plot, at(0, 3), { free: true })!
    const b = city.place(plot, at(3, 3), { free: true })!
    const c = city.place(plot, at(6, 3), { free: true })!
    // All plantings happen at time 0 by the player's clock: 3 energy used.
    city.production.plant(a.id, strawberries, { now: 0 }) // ripe at 1 min, withers at 4 min
    city.production.plant(b.id, potatoes, { now: 0 }) // still growing
    city.production.plant(c.id, strawberries, { now: 150_000 }) // ripe at 3.5 min, still fresh at return
    const leftAt = 1000
    const back = 241_000 // just over 4 minutes later

    const s = awaySummary(city, player, new Docks(city), leftAt, back)
    expect(s.readyBuildings).toBe(2)
    expect(s.readyCoins).toBe(30)
    expect(s.ripeCrops).toBe(1)
    expect(s.ripeValue).toBe(40)
    expect(s.witheredCrops).toBe(1)
    // Energy refills one per period, but never past the maximum.
    const atLeave = maxEnergy(1) - 3
    expect(s.energyGained).toBe(Math.min(maxEnergy(1), atLeave + Math.floor(back / ENERGY_REGEN_MS)) - atLeave)
  })

  it("doesn't count crops that had already withered before you left", () => {
    const city = new City()
    const player = new Player(city, () => 0)
    const p = city.place(plot, at(0, 0), { free: true })!
    city.production.plant(p.id, strawberries, { now: 0, free: true })
    expect(awaySummary(city, player, new Docks(city), 300_000, 900_000).witheredCrops).toBe(0)
  })
})
