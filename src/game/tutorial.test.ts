import { describe, expect, it } from 'vitest'
import { BUILDINGS_BY_ID } from './buildings'
import { City } from './City'
import { CROPS_BY_ID } from './crops'
import { TUTORIAL, Tutorial } from './tutorial'
import { Services } from './Services'

const at = (x: number, z: number) => ({ x: 20 + x, z: 20 + z })

describe('Tutorial', () => {
  it('moves on when the player does what each step asks', () => {
    const city = new City()
    const tutorial = new Tutorial(city)
    expect(tutorial.current?.id).toBe('camera')
    tutorial.complete('camera') // the game reports a pan or zoom
    expect(tutorial.current?.id).toBe('collect')
    const home = city.place(BUILDINGS_BY_ID.get('cottage')!, at(0, 0), { now: 0, free: true })!
    city.production.collect(home.id, 30_000)
    expect(tutorial.current?.id).toBe('harvest')
    const plot = city.place(BUILDINGS_BY_ID.get('farm-plot')!, at(4, 0), { free: true })!
    city.production.plant(plot.id, CROPS_BY_ID.get('strawberries')!, { now: 0, free: true })
    city.production.harvest(plot.id, 60_000)
    expect(tutorial.current?.id).toBe('plant')
  })

  it('finishes UI steps when told, and can be skipped', () => {
    const tutorial = new Tutorial(new City())
    tutorial.load({ step: TUTORIAL.findIndex((s) => s.id === 'quests'), skipped: false })
    tutorial.complete('build') // not the current step: ignored
    expect(tutorial.current?.id).toBe('quests')
    tutorial.complete('quests')
    expect(tutorial.current?.id).toBe('land')
    tutorial.complete('land') // "Got it"
    expect(tutorial.current?.id).toBe('done')
    tutorial.skip()
    expect(tutorial.current).toBeNull()
  })
})

describe('Tutorial (continued)', () => {
  it('skips a step already done some other way', () => {
    const city = new City()
    const tutorial = new Tutorial(city)
    for (const x of [0, 3]) city.place(BUILDINGS_BY_ID.get('cottage')!, at(x, 0), { free: true }) // two homes already
    tutorial.load({ step: TUTORIAL.findIndex((s) => s.id === 'select'), skipped: false })
    tutorial.complete('select')
    expect(tutorial.current?.id).toBe('quests') // "build a cottage" was skipped
  })
})

describe('population capacity', () => {
  it('stops new homes once residents fill the room, until community buildings add more', () => {
    const city = new City()
    const services = new Services(city)
    city.economy.adjust(100_000)
    // 20 cottages × 2 residents = 40, the base capacity.
    for (let i = 0; i < 20; i++) city.place(BUILDINGS_BY_ID.get('cottage')!, at((i % 10) * 2, Math.floor(i / 10) * 2), { free: true })
    expect(services.roomFor(2)).toBe(false)
    city.place(BUILDINGS_BY_ID.get('park')!, at(0, 6), { free: true })
    expect(services.report.capacity).toBe(55)
    expect(services.roomFor(2)).toBe(true)
  })
})
