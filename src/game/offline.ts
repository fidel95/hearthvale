import type { City } from './City'
import { CROPS_BY_ID, cropState } from './crops'
import type { Docks } from './Docks'
import type { Player } from './Player'

// What happened while the player was away. Nothing is simulated here: income
// timers, crops and energy all run on timestamps, so "catching up" is just
// asking each of them about the current time. This only counts the results,
// for the "Welcome back" window.
//
// The calendar (and with it taxes and utility bills) runs on play time, so it
// waited for you; see docs/ARCHITECTURE.md, "Two kinds of time".

export interface AwaySummary {
  awayMs: number
  readyBuildings: number // homes and shops with income waiting
  readyCoins: number // what collecting all of it would pay now
  ripeCrops: number
  ripeValue: number
  witheredCrops: number // crops that withered while you were away
  shipsWaiting: number // shipments that arrived and wait to be unloaded
  energyGained: number
}

// Shorter absences aren't worth a window.
export const WELCOME_BACK_AFTER_MS = 5 * 60_000

export function awaySummary(city: City, player: Player, docks: Docks, leftAt: number, now: number): AwaySummary {
  const summary: AwaySummary = {
    awayMs: now - leftAt,
    readyBuildings: 0,
    readyCoins: 0,
    ripeCrops: 0,
    ripeValue: 0,
    witheredCrops: 0,
    shipsWaiting: 0,
    energyGained: player.energy(now) - player.energy(leftAt),
  }
  for (const b of city.all()) {
    if (city.production.isReady(b, now)) {
      summary.readyBuildings++
      summary.readyCoins += city.production.payout(b)
    }
    if (b.type.category === 'port' && docks.state(b, now).stage === 'arrived') summary.shipsWaiting++
    const state = cropState(b.crop, now)
    if (state.stage === 'ripe') {
      summary.ripeCrops++
      summary.ripeValue += city.production.harvestValue(b, state.crop)
    }
    // Withered now, but not yet when you left: it withered while you were away.
    if (state.stage === 'withered' && b.crop) {
      const crop = CROPS_BY_ID.get(b.crop.cropId)!
      const witherAt = b.crop.plantedAt + (crop.growSeconds + crop.freshSeconds) * 1000
      if (witherAt > leftAt) summary.witheredCrops++
    }
  }
  return summary
}
