import { footprint, type BuildingType, type Rotation } from './buildings'
import type { City } from './City'
import { edgeTiles } from './communityRules'
import { footprintTiles, type Tile } from './grid'
import { isRiver } from './terrain'
import type { Services } from './Services'
import { demandFactor } from './demand'
import type { UnlockSystem } from './UnlockSystem'

// Can this building go here? One answer, with every reason, for everything
// that places buildings (Builder) or offers them (the build menu):
//
// - problems: why it can't be placed (locked, can't afford, one-of-a-kind,
//   rating too low, no room for residents, doesn't fit, off the shore)
// - warnings: it can be placed but won't work yet (needs a road)
//
// The footprint itself (in bounds, owned land, not water, nothing in the way)
// is City.canPlace, which City also uses to protect its own state.

export interface PlacementCheck {
  ok: boolean
  problems: string[]
  warnings: string[]
}

export interface Spot {
  tile: Tile
  rotation: Rotation
  ignoreId?: number // a building being moved may overlap where it is now
}

export class PlacementSystem {
  // Admin power: build anything, at any level, for free.
  freeBuild = false
  private city: City
  private services: Services
  private unlocks: UnlockSystem

  constructor(city: City, services: Services, unlocks: UnlockSystem) {
    this.city = city
    this.services = services
    this.unlocks = unlocks
  }

  // Without a spot, it checks everything except the footprint (for the build menu).
  // free: moving or restoring a building costs nothing and needs no unlock.
  check(type: BuildingType, spot?: Spot, { free = false } = {}): PlacementCheck {
    const problems: string[] = []
    const warnings: string[] = []
    if (!free && !this.freeBuild) {
      if (!this.unlocks.isUnlocked(type)) problems.push(`🔒 Reach level ${type.unlockLevel}`)
      else if (!this.city.economy.canAfford(type.cost)) problems.push(`Need 🪙 ${(type.cost - this.city.coins).toLocaleString()} more`)
      const blocker = this.blocker(type)
      if (blocker) problems.push(blocker)
    } else if (!free && this.uniqueTaken(type)) {
      // Admin free building skips level, cost, rating and room, but one of a
      // kind is still one of a kind (an airport, the station).
      problems.push(`You already have the ${type.name}`)
    }
    if (spot) {
      if (!this.city.canPlace(type, spot.tile, spot.ignoreId, spot.rotation)) {
        problems.push(
          type.category !== 'road' && footprintTiles(spot.tile, footprint(type, spot.rotation)).some(isRiver)
            ? 'Only roads can cross the river (as bridges)'
            : type.onShore
              ? 'It must stand on the shore, next to the sea'
              : type.onWater
                ? 'It must stand out at sea, in the ocean'
                : type.nearMountain
                  ? 'It must stand at the foot of a mountain, in the Highlands'
                  : "It doesn't fit there",
        )
      } else if (type.requiresRoad && !edgeTiles({ type, tile: spot.tile, rotation: spot.rotation }).some(this.city.isRoad)) {
        warnings.push('Needs a road beside it to open')
      } else if (type.requiresRail && !edgeTiles({ type, tile: spot.tile, rotation: spot.rotation }).some(this.city.isRail)) {
        warnings.push('Needs railway track beside it to open')
      }
      if (type.customers && problems.length === 0) {
        const customers = this.services.customersAt(type, spot.tile, spot.rotation)
        const share = Math.round(demandFactor(type, customers) * 100)
        if (share < 100) warnings.push(`Only ${customers} of ${type.customers} customers nearby: sales at ${share}%`)
      }
    }
    return { ok: problems.length === 0, problems, warnings }
  }

  // Rules beyond coins and space: one of a kind, a minimum rating, room for residents.
  private uniqueTaken(type: BuildingType): boolean {
    return !!type.unique && [...this.city.all(), ...this.city.storedBuildings()].some((b) => b.type.id === type.id)
  }

  private blocker(type: BuildingType): string | null {
    if (this.uniqueTaken(type)) {
      return `You already have the ${type.name}`
    }
    if (type.minRating) {
      const rating = this.services.rating().total
      if (rating < type.minRating) return `Needs a city rating of ${type.minRating} (now ${rating})`
    }
    if (!this.services.roomFor(type.residents ?? 0)) return '👥 No room for more residents: build a Park, Fire Station or School'
    return null
  }
}
