import type { City, PlacedBuilding } from './City'
import { footprint, isPlot, isTrack } from './buildings'
import { cropState } from './crops'
import { footprintTiles, type Tile } from './grid'
import { coastZ } from './terrain'

// Natural disasters, cozy edition: they never destroy anything. A building
// they hit is damaged: it stops working (no rent, sales or bonus) until you
// pay to repair it. A flooded or flattened crop is lost. Roads, track and
// decorations shrug it off. DisasterView shows each one and decides when it
// strikes; this is what it does to the town.
//
// Taxes: repairs keep property in working order, so they're an ordinary
// business expense, deducted in full the year you pay (not added to the
// building's cost, unlike an upgrade). See Treas. Reg. §1.263(a)-3.

export type DisasterKind = 'tornado' | 'lightning' | 'flood' | 'tsunami'

export const DISASTER_INFO: Record<DisasterKind, { name: string; icon: string; warning: string }> = {
  tornado: { name: 'Tornado', icon: '🌪️', warning: 'A tornado is crossing town!' },
  lightning: { name: 'Lightning', icon: '⚡', warning: 'Lightning struck!' },
  flood: { name: 'Flood', icon: '🌊', warning: 'Flooding by the coast!' },
  tsunami: { name: 'Tsunami', icon: '🌊', warning: 'Tsunami warning! A wave is coming in from the sea!' },
}

// How far inland the water reaches, in tiles from the shore.
export const FLOOD_REACH = 4
export const TSUNAMI_REACH = 9

// A repair costs a fifth of what the building cost (at least 20).
export function repairCost(b: PlacedBuilding): number {
  return Math.max(20, Math.round(b.type.cost * 0.2))
}

// Can a disaster hurt it? Not roads, track or decorations, or sites still being built.
function vulnerable(b: PlacedBuilding): boolean {
  return !isTrack(b.type) && b.type.category !== 'decoration' && b.construction === null && !b.damaged
}

export class Disasters {
  private city: City
  private random: () => number

  // random is injectable so tests can decide what gets hit.
  constructor(city: City, random: () => number = Math.random) {
    this.city = city
    this.random = random
  }

  // Everything standing on any of these tiles, each counted once.
  buildingsOn(tiles: Tile[]): PlacedBuilding[] {
    const found = new Set<PlacedBuilding>()
    for (const t of tiles) {
      const b = this.city.buildingAt(t)
      if (b) found.add(b)
    }
    return [...found]
  }

  // Hit whatever stands on these tiles: each building is damaged with the
  // given chance, and crops are lost. Returns what was damaged.
  // A fire (EmergencyView) is struck the same way, on the one building that burned.
  strike(kind: DisasterKind | 'fire', tiles: Tile[], chance: number, now = Date.now()): PlacedBuilding[] {
    const hit: PlacedBuilding[] = []
    for (const b of this.buildingsOn(tiles)) {
      if (isPlot(b.type)) {
        // The crop is ruined (the seeds were already deducted when planted).
        const state = cropState(b.crop, now)
        if (state.stage !== 'empty' && this.random() < chance) {
          b.crop = null
          this.city.announce({ kind: 'cleared', building: b, crop: state.crop })
        }
        continue
      }
      if (!vulnerable(b) || this.random() >= chance) continue
      b.damaged = true
      hit.push(b)
      this.city.announce({ kind: 'damaged', building: b, cause: kind === 'fire' ? 'Fire' : DISASTER_INFO[kind].name })
    }
    return hit
  }

  // Land within `reach` tiles of the shore (where floods and waves get to).
  lowLand(reach: number): Tile[] {
    const tiles: Tile[] = []
    for (const b of this.city.all()) {
      if (b.type.onWater) continue
      for (const t of footprintTiles(b.tile, footprint(b.type, b.rotation))) {
        if (t.z >= coastZ(t.x) - reach) tiles.push(t)
      }
    }
    return tiles
  }

  repair(id: number): boolean {
    const b = this.city.get(id)
    if (!b || !b.damaged) return false
    const cost = repairCost(b)
    if (!this.city.economy.canAfford(cost)) return false
    b.damaged = false
    this.city.economy.expense(cost, `Repairs: ${b.type.name}`)
    this.city.announce({ kind: 'repaired', building: b, cost })
    return true
  }
}
