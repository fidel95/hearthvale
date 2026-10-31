import type { City } from './City'
import { roadMask } from './communityRules'
import type { Tile } from './grid'

// Traffic lights: every junction of three or four paved roads has them (dirt
// roads don't). All of them run on one clock: green for traffic along x
// while it's red along z, amber, then the other way round. Cars stop at the
// line on red and amber (TrafficView); emergency vehicles go through.

export type Light = 'green' | 'amber' | 'red'
export type Axis = 'x' | 'z'

export const GREEN_SECONDS = 5
export const AMBER_SECONDS = 1.5
const HALF_CYCLE = GREEN_SECONDS + AMBER_SECONDS

// The light shown to traffic along an axis, at a time (seconds) on the clock.
export function lightFor(axis: Axis, time: number): Light {
  const t = ((time % (2 * HALF_CYCLE)) + 2 * HALF_CYCLE) % (2 * HALF_CYCLE)
  const mine = axis === 'x' ? t < HALF_CYCLE : t >= HALF_CYCLE
  if (!mine) return 'red'
  return t % HALF_CYCLE < GREEN_SECONDS ? 'green' : 'amber'
}

// The junctions with lights.
export function signalJunctions(city: City): Tile[] {
  const found: Tile[] = []
  for (const b of city.all()) {
    if (b.type.category !== 'road' || b.type.road?.style === 'dirt') continue
    const mask = roadMask(b.tile, city.isRoad)
    const links = [1, 2, 4, 8].filter((bit) => mask & bit).length
    if (links >= 3) found.push(b.tile)
  }
  return found
}
