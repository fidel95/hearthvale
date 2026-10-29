import { describe, expect, it } from 'vitest'
import { BUILDINGS_BY_ID } from './buildings'
import { City } from './City'
import { Collections } from './collections'
import { CROPS_BY_ID } from './crops'
import { GameClock } from './GameClock'
import { Inventory } from './Inventory'
import { Player } from './Player'
import { ACHIEVEMENTS, QUESTS, Quests, type QuestsEvent } from './quests'
import { Services } from './Services'
import { Taxes } from './Taxes'

const at = (x: number, z: number) => ({ x: 20 + x, z: 20 + z })
const b = (id: string) => BUILDINGS_BY_ID.get(id)!

function town() {
  const city = new City()
  const player = new Player(city, () => 0)
  const services = new Services(city)
  const inventory = new Inventory(city)
  const taxes = new Taxes(city, new GameClock())
  const collections = new Collections(city, inventory, player, () => 0.99) // nothing drops
  const quests = new Quests({ city, player, services }, inventory, collections, taxes)
  const events: QuestsEvent[] = []
  quests.onChange((e) => e.kind !== 'changed' && events.push(e))
  return { city, player, inventory, quests, events }
}

describe('Quests', () => {
  it('starts with the first quest and tracks its tasks from when it started', () => {
    const { city, quests } = town()
    const welcome = QUESTS[0]
    expect(quests.activeQuests().map((q) => q.id)).toEqual(['welcome'])
    const home = city.place(b('cottage'), at(0, 0), { now: 0, free: true })!
    city.production.collect(home.id, 30_000)
    city.production.collect(home.id, 60_000)
    expect(quests.progress(welcome, welcome.tasks[0])).toBe(2)
    expect(quests.isDone(welcome)).toBe(false)
  })

  it('announces a finished quest, pays its reward when claimed, and opens the next ones', () => {
    const { city, player, quests, events } = town()
    const home = city.place(b('cottage'), at(0, 0), { now: 0, free: true })!
    for (let i = 1; i <= 3; i++) city.production.collect(home.id, i * 30_000)
    const plot = city.place(b('farm-plot'), at(4, 0), { free: true })!
    city.production.plant(plot.id, CROPS_BY_ID.get('strawberries')!, { now: 0, free: true })
    city.production.harvest(plot.id, 60_000)
    expect(events.map((e) => e.kind)).toContain('questDone')

    const coins = city.coins
    expect(quests.claim(QUESTS[0])).toBe(true)
    expect(city.coins).toBe(coins + 100 + 50) // its 10 XP also reaches level 2 (+50)
    expect(player.xp).toBeGreaterThanOrEqual(10)
    expect(quests.activeQuests().map((q) => q.id)).toEqual(expect.arrayContaining(['growing', 'taxes']))
    expect(quests.claim(QUESTS[0])).toBe(false) // only once
  })

  it('counts "have X" tasks from the town as it is', () => {
    const { city, quests } = town()
    const growing = QUESTS.find((q) => q.id === 'growing')!
    for (const x of [0, 3, 6]) city.place(b('cottage'), at(x, 0), { free: true })
    expect(quests.progress(growing, growing.tasks[0])).toBe(3)
  })

  it('raises achievement tiers as lifetime stats grow', () => {
    const { city, quests, events } = town()
    const landlord = ACHIEVEMENTS.find((a) => a.id === 'landlord')!
    const home = city.place(b('cottage'), at(0, 0), { now: 0, free: true })!
    for (let i = 1; i <= 10; i++) city.production.collect(home.id, i * 30_000)
    expect(quests.tierOf(landlord)).toBe(1)
    expect(events).toContainEqual({ kind: 'achievement', achievement: landlord, tier: 1 })
  })

  it('round-trips through a save', () => {
    const { city, quests } = town()
    const home = city.place(b('cottage'), at(0, 0), { now: 0, free: true })!
    city.production.collect(home.id, 30_000)
    const save = JSON.parse(JSON.stringify(quests.toSave()))
    const other = town()
    other.quests.load(save)
    expect(other.quests.toSave()).toEqual(save)
    expect(other.quests.stat('rent')).toBe(1)
  })
})
