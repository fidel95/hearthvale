import { describe, expect, it } from 'vitest'
import { BRIDGE_HEIGHT, bridgeAlongX, liftOnTile, roadLift } from './bridges'
import { OVERPASS_TYPE } from './buildings'
import { tileToWorld } from './grid'
import { trainRoute } from './routes'
import { b, reload, richGame } from '../tests/helpers'

// Track down x = 25 and a road along z = 28 that crosses it on a bridge.
function crossing() {
  const state = richGame()
  const city = state.city
  for (let z = 22; z <= 34; z++) if (z !== 28) city.place(b('rail'), { x: 25, z }, { free: true })
  for (let x = 21; x <= 29; x++) if (x !== 25) city.place(b('road'), { x, z: 28 }, { free: true })
  expect(city.place(OVERPASS_TYPE, { x: 25, z: 28 }, { free: true })).not.toBeNull()
  return state
}

describe('Road bridges over the railway', () => {
  it('a bridge is road and railway both, so trains run on under it', () => {
    const { city } = crossing()
    const at = { x: 25, z: 28 }
    expect(city.isRoad(at)).toBe(true)
    expect(city.isRail(at)).toBe(true)
    expect(bridgeAlongX(city, at)).toBe(true)
    const route = trainRoute({ x: 25, z: 22 }, city.isRail)
    expect(route.tiles.some((t) => t.x === 25 && t.z === 28)).toBe(true)
    expect(route.tiles).toHaveLength(13)
  })

  it('the road rises on a ramp either side, up to the deck', () => {
    const { city } = crossing()
    const deck = tileToWorld({ x: 25, z: 28 })
    expect(roadLift(city, deck.x, deck.z)).toBe(BRIDGE_HEIGHT)
    // Two tiles of ramp on each side (there's road enough), rising evenly.
    const lift = (x: number, dx: number) => liftOnTile(city, { x, z: 28 }, tileToWorld({ x, z: 28 }).x + dx, tileToWorld({ x, z: 28 }).z)
    expect(lift(23, -0.5)).toBeCloseTo(0) // the foot of the ramp
    expect(lift(23, 0.5)).toBeCloseTo(BRIDGE_HEIGHT / 2)
    expect(lift(24, 0)).toBeCloseTo(BRIDGE_HEIGHT * 0.75)
    expect(lift(24, 0.5)).toBeCloseTo(BRIDGE_HEIGHT) // meeting the deck
    expect(lift(27, 0.5)).toBeCloseTo(0) // and down the other side
    expect(lift(26, -0.5)).toBeCloseTo(BRIDGE_HEIGHT)
    const beyond = tileToWorld({ x: 22, z: 28 })
    expect(roadLift(city, beyond.x, beyond.z)).toBe(0)
    const track = tileToWorld({ x: 25, z: 27 })
    expect(roadLift(city, track.x, track.z)).toBe(0) // the track beside it stays down
  })

  it('keeps its bridges through a save', () => {
    const loaded = reload(crossing())
    expect(loaded.city.buildingAt({ x: 25, z: 28 })?.type.id).toBe(OVERPASS_TYPE.id)
  })
})

describe('A short ramp', () => {
  it('with only one tile of road beside the bridge, the ramp is that tile', () => {
    const state = richGame()
    const city = state.city
    for (let z = 22; z <= 34; z++) if (z !== 28) city.place(b('rail'), { x: 25, z }, { free: true })
    city.place(b('road'), { x: 24, z: 28 }, { free: true })
    city.place(OVERPASS_TYPE, { x: 25, z: 28 }, { free: true })
    const c = tileToWorld({ x: 24, z: 28 })
    expect(liftOnTile(city, { x: 24, z: 28 }, c.x - 0.5, c.z)).toBeCloseTo(0)
    expect(liftOnTile(city, { x: 24, z: 28 }, c.x + 0.5, c.z)).toBeCloseTo(BRIDGE_HEIGHT)
  })
})
