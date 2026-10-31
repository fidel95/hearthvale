import { describe, expect, it } from 'vitest'
import { GameState } from './GameState'
import { MASTERIES, MILESTONES, ladder, milestoneGoal, townTitle } from './goals'
import { SaveSystem } from './SaveSystem'
import { at, b } from '../tests/helpers'

const cottage = MASTERIES.find((m) => m.key === 'b:cottage')!

describe('mastery', () => {
  it('needs fewer collections from slower buildings', () => {
    const coal = MASTERIES.find((m) => m.key === 'b:coal-mine')!
    expect(cottage.goals).toEqual([10, 40, 120])
    expect(coal.goals[2]).toBeLessThan(cottage.goals[2])
    for (const m of MASTERIES) expect(m.goals[0]).toBeLessThan(m.goals[1])
  })

  it('pays a star when a building has been collected from enough times', () => {
    const state = new GameState()
    const home = state.city.place(b('cottage'), at(0, 0), { now: 0, free: true })!
    const xp = state.player.xp
    for (let i = 1; i <= 10; i++) state.city.production.collect(home.id, i * 30_000)
    expect(state.goals.starsOf(cottage)).toBe(1)
    expect(state.goals.countOf(cottage)).toBe(10)
    // 10 collections' XP plus the star's.
    expect(state.player.xp).toBeGreaterThanOrEqual(xp + 10 + 10)
  })
})

describe('milestones', () => {
  it('climb an endless 1-2-3-5 ladder', () => {
    expect([0, 1, 2, 3, 4, 5, 8].map(ladder)).toEqual([1, 2, 3, 5, 10, 20, 100])
    expect(milestoneGoal(MILESTONES[0], 4)).toBe(100)
  })

  it('name the town after its population, with every title on the ladder', () => {
    expect(townTitle(0)).toBe('Hamlet')
    expect(townTitle(100)).toBe('Town')
    expect(townTitle(2500)).toBe('City')
  })

  it("don't pay again for a town loaded from a save, or for one from before goals", () => {
    const state = new GameState()
    state.seedNewTown(0)
    const saves = new SaveSystem(state)
    const before = saves.toSave()
    const loaded = new GameState()
    const paid: string[] = []
    loaded.goals.onChange((e) => e.kind === 'milestone' && paid.push(e.milestone.id))
    new SaveSystem(loaded).load({ ...before, goals: undefined })
    expect(paid).toEqual([])
    const population = MILESTONES[0]
    expect(milestoneGoal(population, loaded.goals.stepOf(population))).toBeGreaterThan(loaded.goals.value(population))
  })
})
