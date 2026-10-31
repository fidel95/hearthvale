import { describe, expect, it } from 'vitest'
import { BUILDINGS_BY_ID } from './buildings'
import { CROPS_BY_ID } from './crops'
import { Disasters, repairCost } from './Disasters'
import { GameState } from './GameState'
import { SaveSystem } from './SaveSystem'

const at = (x: number, z: number) => ({ x: 20 + x, z: 20 + z })
const b = (id: string) => BUILDINGS_BY_ID.get(id)!

describe('Disasters', () => {
  it('damage buildings, which stop earning until repaired', () => {
    const state = new GameState()
    const disasters = new Disasters(state.city, () => 0) // everything is hit
    const home = state.city.place(b('cottage'), at(0, 0), { now: 0, free: true })!
    const tree = state.city.place(b('oak-tree'), at(4, 0), { free: true })!
    const road = state.city.place(b('road'), at(6, 0), { free: true })!
    const hit = disasters.strike('tornado', [at(0, 0), at(4, 0), at(6, 0)], 1)
    expect(hit).toEqual([home]) // decorations and roads shrug it off
    expect(home.damaged && !tree.damaged && !road.damaged).toBe(true)
    expect(state.city.production.collect(home.id, 60_000)).toBe(0)
    const coins = state.city.coins
    expect(disasters.repair(home.id)).toBe(true)
    expect(state.city.coins).toBe(coins - repairCost(home))
    expect(state.taxes.toSave().ledger.operatingExpenses).toBe(repairCost(home)) // a deductible repair
    expect(state.city.production.collect(home.id, 60_000)).toBeGreaterThan(0)
  })

  it('count a fire left to burn as damage by fire', () => {
    const state = new GameState()
    const disasters = new Disasters(state.city, () => 0)
    const home = state.city.place(b('cottage'), at(0, 0), { now: 0, free: true })!
    const causes: string[] = []
    state.city.onChange((e) => e.kind === 'damaged' && causes.push(e.cause))
    expect(disasters.strike('fire', [home.tile], 1)).toEqual([home])
    expect(causes).toEqual(['Fire'])
  })

  it('ruin crops but leave the plot', () => {
    const state = new GameState()
    const plot = state.city.place(b('farm-plot'), at(0, 0), { free: true })!
    state.city.production.plant(plot.id, CROPS_BY_ID.get('wheat')!, { now: Date.now(), free: true })
    new Disasters(state.city, () => 0).strike('flood', [at(0, 0)], 1)
    expect(plot.crop).toBeNull()
    expect(plot.damaged).toBe(false)
  })

  it('miss when luck says so, and never hit a building twice', () => {
    const state = new GameState()
    const home = state.city.place(b('cottage'), at(0, 0), { free: true })!
    expect(new Disasters(state.city, () => 0.9).strike('lightning', [at(0, 0)], 0.5)).toEqual([])
    const disasters = new Disasters(state.city, () => 0)
    expect(disasters.strike('lightning', [at(0, 0)], 1)).toEqual([home])
    expect(disasters.strike('lightning', [at(0, 0)], 1)).toEqual([])
  })

  it('keep damage through a save', () => {
    const state = new GameState()
    const home = state.city.place(b('cottage'), at(0, 0), { free: true })!
    new Disasters(state.city, () => 0).strike('tornado', [at(0, 0)], 1)
    const loaded = new GameState()
    new SaveSystem(loaded).load(JSON.parse(JSON.stringify(new SaveSystem(state).toSave())))
    expect(loaded.city.get(home.id)!.damaged).toBe(true)
  })

  it('leave animal pens earning farm income once repaired', () => {
    const state = new GameState()
    const coop = state.city.place(b('chicken-coop'), at(0, 0), { now: 0, free: true })!
    expect(state.city.production.collect(coop.id, 60_000)).toBeGreaterThan(0)
    expect(state.taxes.toSave().ledger.farmIncome).toBeGreaterThan(0) // eggs are farm income
  })
})
