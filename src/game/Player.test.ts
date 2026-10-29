import { describe, expect, it } from 'vitest'
import { BUILDINGS_BY_ID } from './buildings'
import { City } from './City'
import { CROPS_BY_ID } from './crops'
import { Player, type PlayerEvent } from './Player'
import { ENERGY_REGEN_MS, maxEnergy } from './progression'

// Tests use tiles relative to the starting land, which begins at tile 20 on both axes.
const at = (x: number, z: number) => ({ x: 20 + x, z: 20 + z })

const cottage = BUILDINGS_BY_ID.get('cottage')! // costs 100, pays 15 every 30 s
const plotType = BUILDINGS_BY_ID.get('farm-plot')!
const strawberries = CROPS_BY_ID.get('strawberries')! // 1 XP, grows 60 s

// A town and player whose clock the test controls.
function setup() {
  const city = new City()
  let time = 1_000_000
  const player = new Player(city, () => time)
  const events: PlayerEvent[] = []
  player.onChange((e) => events.push(e))
  return { city, player, events, now: () => time, setTime: (t: number) => (time = t) }
}

describe('Player XP', () => {
  it('earns XP for paid buildings but not free ones', () => {
    const { city, player } = setup()
    city.place(cottage, at(0, 0))
    expect(player.xp).toBe(5)
    city.place(cottage, at(4, 4), { free: true })
    expect(player.xp).toBe(5)
  })

  it('earns XP for collecting and harvesting', () => {
    const { city, player, now } = setup()
    const home = city.place(cottage, at(0, 0), { now: now(), free: true })!
    city.production.collect(home.id, now() + 30_000)
    expect(player.xp).toBe(1)
    const plot = city.place(plotType, at(5, 5), { free: true })!
    city.production.plant(plot.id, strawberries, { now: now() })
    city.production.harvest(plot.id, now() + 60_000)
    expect(player.xp).toBe(2)
  })

  it('levels up with a coin award, refilled energy and the unlocks for that level', () => {
    const { city, player, events } = setup()
    const coinsBefore = city.coins
    const awards: number[] = []
    city.onChange((e) => e.kind === 'award' && awards.push(e.amount))
    city.place(cottage, at(0, 0)) // 5 XP
    city.place(cottage, at(4, 0)) // 10 XP: level 2
    expect(player.level).toBe(2)
    expect(awards).toEqual([50])
    expect(city.coins).toBe(coinsBefore - 200 + 50)
    const levelUp = events.find((e) => e.kind === 'levelUp')
    expect(levelUp).toMatchObject({ level: 2, reward: 50, maxEnergy: maxEnergy(2) })
    expect(levelUp && 'buildings' in levelUp && levelUp.buildings.map((b) => b.id)).toContain('bakery')
    expect(player.energy(Date.now())).toBe(maxEnergy(2))
  })

  it('rewards every level when one action jumps several', () => {
    const { city, player } = setup()
    city.economy.adjust(10_000)
    const levels: number[] = []
    player.onChange((e) => e.kind === 'levelUp' && levels.push(e.level))
    city.place(BUILDINGS_BY_ID.get('modern-house')!, at(0, 0)) // 30 XP: level 1 → 3
    expect(levels).toEqual([2, 3])
  })

  it('knows what is unlocked', () => {
    const { player } = setup()
    expect(player.isUnlocked(cottage)).toBe(true)
    expect(player.isUnlocked(BUILDINGS_BY_ID.get('townhouse')!)).toBe(false)
  })
})

describe('Player energy', () => {
  // Collect from a cottage repeatedly, each time it's ready, to spend energy.
  function spender(city: City, clock: () => number) {
    const home = city.place(cottage, at(10, 10), { now: 0, free: true })!
    return () => {
      home.readyAt = 0 // ready now
      return city.production.collect(home.id, clock())
    }
  }

  it('starts full and uses 1 per collect, harvest, planting or clearing', () => {
    const { city, player, now } = setup()
    const full = maxEnergy(1)
    expect(player.energy(now())).toBe(full)
    const plot = city.place(plotType, at(0, 0), { free: true })!
    city.production.plant(plot.id, strawberries, { now: now() }) // −1
    city.production.harvest(plot.id, now() + 60_000) // −1
    city.production.plant(plot.id, strawberries, { now: now() }) // −1
    city.production.clearPlot(plot.id, now() + 10 * 60 * 60_000) // −1 (long withered)
    expect(player.energy(now())).toBe(full - 4)
  })

  it("doesn't use energy for free starter crops", () => {
    const { city, player, now } = setup()
    const plot = city.place(plotType, at(0, 0), { free: true })!
    city.production.plant(plot.id, strawberries, { now: now(), free: true })
    expect(player.energy(now())).toBe(maxEnergy(1))
  })

  it('refills one point per period, keeping progress toward the next', () => {
    const { city, player, now, setTime } = setup()
    const collect = spender(city, now)
    const start = now()
    const full = maxEnergy(1)
    collect() // full − 1, regen clock starts at `start`
    collect() // full − 2
    setTime(start + ENERGY_REGEN_MS * 1.5)
    expect(player.energy(now())).toBe(full - 1)
    expect(player.nextEnergyAt(now())).toBe(start + ENERGY_REGEN_MS * 2)
    collect() // full − 2, but the half period already waited still counts
    expect(player.nextEnergyAt(now())).toBe(start + ENERGY_REGEN_MS * 2)
    setTime(start + ENERGY_REGEN_MS * 100)
    expect(player.energy(now())).toBe(full) // never above the maximum
    expect(player.nextEnergyAt(now())).toBeNull()
  })

  it('reports when energy runs out', () => {
    const { city, player, now } = setup()
    const collect = spender(city, now)
    // Collecting earns XP, and a level-up refills energy, so collect until it truly runs dry.
    for (let i = 0; i < 200 && player.hasEnergy(now()); i++) collect()
    expect(player.hasEnergy(now())).toBe(false)
    expect(player.nextEnergyAt(now())).toBe(now() + ENERGY_REGEN_MS)
  })

  it('round-trips through a save', () => {
    const { city, player, now } = setup()
    spender(city, now)()
    const save = JSON.parse(JSON.stringify(player.toSave()))
    const loaded = new Player(new City(), now)
    loaded.load(save)
    expect(loaded.toSave()).toEqual(save)
    expect(loaded.energy(now())).toBe(player.energy(now()))
  })
})
