import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { RoadSpace } from '../game/roadSpace'
import { TrafficView } from '../game/TrafficView'
import { at, b, richGame } from './helpers'

// The shuttles TrafficView is running, for a look inside.
type Shuttle = { kind: string; objects: THREE.Object3D[] }
const shuttles = (t: TrafficView) => (t as unknown as { shuttles: Shuttle[] }).shuttles

function highwayTown() {
  const state = richGame()
  for (let x = 0; x <= 6; x++) state.city.place(b('highway'), at(x, 4), { free: true })
  for (let x = 7; x <= 9; x++) state.city.place(b('road'), at(x, 4), { free: true })
  state.city.place(b('barn'), at(8, 5), { free: true })
  return state
}

describe('highways and semis', () => {
  it('a highway is a road (cars use it), and pays a little for living beside it', () => {
    const highway = b('highway')
    expect(highway.category).toBe('road')
    expect(highway.road?.style).toBe('highway')
    expect(highway.road!.bonus).toBeLessThan(b('road').road!.bonus)
    const state = highwayTown()
    expect(state.city.isRoad(at(3, 4))).toBe(true)
  })

  it('brings semis in from the end of the highway, trailer hitched behind', () => {
    const state = highwayTown()
    const traffic = new TrafficView(new THREE.Scene(), state.city, new RoadSpace())
    traffic.update(0.016)
    const semis = shuttles(traffic).filter((s) => s.kind === 'semi')
    expect(semis.length).toBeGreaterThan(0)
    for (let i = 0; i < 60; i++) traffic.update(0.05)
    for (const semi of semis) {
      const [tractor, trailer] = semi.objects
      const gap = Math.hypot(tractor.position.x - trailer.position.x, tractor.position.z - trailer.position.z)
      expect(gap).toBeCloseTo(0.5, 2) // the kingpin on the fifth wheel
    }
  })

  it('no highway, no semis', () => {
    const state = richGame()
    for (let x = 0; x <= 6; x++) state.city.place(b('road'), at(x, 4), { free: true })
    const traffic = new TrafficView(new THREE.Scene(), state.city, new RoadSpace())
    traffic.update(0.016)
    expect(shuttles(traffic).filter((s) => s.kind === 'semi')).toHaveLength(0)
  })
})
