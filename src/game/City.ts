import { BUILDINGS_BY_ID, RENAMED_BUILDING_IDS, type BuildingType } from './buildings'
import { CROPS_BY_ID, cropState, type CropType, type PlantedCrop } from './crops'
import { GRID_SIZE, footprintTiles, inBounds, type Tile } from './grid'

// The city's state: coins, which buildings exist and which tiles they cover.
// No three.js in here. CityView watches for changes and draws them, which
// keeps the rules testable (City.test.ts) and makes saving a matter of
// dumping this data (toSave / load).

const STARTING_COINS = 600

export interface PlacedBuilding {
  id: number
  type: BuildingType
  tile: Tile // the footprint's lowest corner tile
  // When its income can next be collected, as a Date.now() timestamp.
  // Real clock time (not "seconds since the game started") so timers keep
  // running while the game is closed: rent is waiting when you come back.
  readyAt: number
  // Farm plots only: what's planted, or null when the plot is empty.
  crop: PlantedCrop | null
}

// The plain-JSON form of a City, for the save file. Buildings store their
// type's id, not the whole type, so catalog changes apply to old saves.
export interface CitySave {
  coins: number
  nextId: number
  buildings: { id: number; typeId: string; tile: Tile; readyAt: number; crop?: PlantedCrop | null }[]
}

export type CityEvent =
  // paid is what the player spent: 0 for free buildings and ones loaded from a save.
  | { kind: 'added'; building: PlacedBuilding; paid: number }
  | { kind: 'removed'; building: PlacedBuilding }
  | { kind: 'moved'; building: PlacedBuilding }
  | { kind: 'collected'; building: PlacedBuilding; amount: number }
  | { kind: 'planted'; building: PlacedBuilding; crop: CropType; cost: number }
  | { kind: 'harvested'; building: PlacedBuilding; crop: CropType; amount: number }
  | { kind: 'cleared'; building: PlacedBuilding; crop: CropType } // a withered crop was cleared away
  | { kind: 'award'; amount: number; reason: string } // prize coins, e.g. a level-up reward
  | { kind: 'coins'; coins: number }

export class City {
  private buildings = new Map<number, PlacedBuilding>()
  // One slot per tile holding the id of the building on it, or null.
  // Tile (x, z) lives at index z * GRID_SIZE + x.
  private occupied: (number | null)[] = new Array(GRID_SIZE * GRID_SIZE).fill(null)
  private nextId = 1
  private listeners: ((event: CityEvent) => void)[] = []
  private _coins = STARTING_COINS

  // A getter with no setter: other code can read coins but must go through
  // place / collect / adjustCoins to change them.
  get coins() {
    return this._coins
  }

  onChange(listener: (event: CityEvent) => void) {
    this.listeners.push(listener)
  }

  all(): Iterable<PlacedBuilding> {
    return this.buildings.values()
  }

  get(id: number): PlacedBuilding | undefined {
    return this.buildings.get(id)
  }

  buildingAt(tile: Tile): PlacedBuilding | undefined {
    if (!inBounds(tile)) return undefined
    const id = this.occupied[tile.z * GRID_SIZE + tile.x]
    return id === null ? undefined : this.buildings.get(id)
  }

  canAfford(type: BuildingType): boolean {
    return this._coins >= type.cost
  }

  // ignoreId lets a building being moved overlap its own current spot.
  canPlace(type: BuildingType, tile: Tile, ignoreId?: number): boolean {
    return footprintTiles(tile, type.size).every((t) => {
      if (!inBounds(t)) return false
      const id = this.occupied[t.z * GRID_SIZE + t.x]
      return id === null || id === ignoreId
    })
  }

  // free: true skips the cost, for the starting town.
  place(type: BuildingType, tile: Tile, { now = Date.now(), free = false } = {}): PlacedBuilding | null {
    if (!this.canPlace(type, tile)) return null
    if (!free && !this.canAfford(type)) return null

    const readyAt = type.income ? now + type.income.seconds * 1000 : 0
    const building = { id: this.nextId++, type, tile, readyAt, crop: null }
    this.buildings.set(building.id, building)
    this.mark(building, building.id)
    const paid = free ? 0 : type.cost
    this.emit({ kind: 'added', building, paid })
    this.adjustCoins(-paid)
    return building
  }

  remove(id: number) {
    const building = this.buildings.get(id)
    if (!building) return
    this.mark(building, null)
    this.buildings.delete(id)
    this.emit({ kind: 'removed', building })
  }

  move(id: number, tile: Tile): boolean {
    const building = this.buildings.get(id)
    if (!building || !this.canPlace(building.type, tile, id)) return false
    this.mark(building, null)
    building.tile = tile
    this.mark(building, id)
    this.emit({ kind: 'moved', building })
    return true
  }

  isReady(building: PlacedBuilding, now: number): boolean {
    return building.type.income !== undefined && now >= building.readyAt
  }

  // Collect a building's income if it's ready. Returns the coins earned (0 if not ready).
  collect(id: number, now: number): number {
    const building = this.buildings.get(id)
    if (!building || !building.type.income || !this.isReady(building, now)) return 0

    const { coins, seconds } = building.type.income
    // The next timer starts when you collect, not when it became ready,
    // so leaving money uncollected doesn't stack up extra payouts.
    building.readyAt = now + seconds * 1000
    this.emit({ kind: 'collected', building, amount: coins })
    this.adjustCoins(coins)
    return coins
  }

  // Plant a crop on an empty farm plot, paying for the seeds.
  // free: true skips the cost, for the starting town.
  plant(id: number, crop: CropType, { now = Date.now(), free = false } = {}): boolean {
    const plot = this.buildings.get(id)
    if (!plot || plot.type.category !== 'farm' || cropState(plot.crop, now).stage !== 'empty') return false
    if (!free && this._coins < crop.seedCost) return false

    plot.crop = { cropId: crop.id, plantedAt: now }
    const cost = free ? 0 : crop.seedCost
    this.emit({ kind: 'planted', building: plot, crop, cost })
    this.adjustCoins(-cost)
    return true
  }

  // Harvest a ripe crop and sell it. Returns the coins earned (0 if not ripe).
  harvest(id: number, now: number): number {
    const plot = this.buildings.get(id)
    if (!plot) return 0
    const state = cropState(plot.crop, now)
    if (state.stage !== 'ripe') return 0

    plot.crop = null
    const amount = state.crop.sellPrice
    this.emit({ kind: 'harvested', building: plot, crop: state.crop, amount })
    this.adjustCoins(amount)
    return amount
  }

  // Clear a withered crop so the plot can be planted again. The seeds are lost.
  clearPlot(id: number, now: number): boolean {
    const plot = this.buildings.get(id)
    if (!plot) return false
    const state = cropState(plot.crop, now)
    if (state.stage !== 'withered') return false

    plot.crop = null
    this.emit({ kind: 'cleared', building: plot, crop: state.crop })
    return true
  }

  // Prize money, like a level-up reward. It's income (Taxes counts it), so
  // it gets its own event rather than a bare adjustCoins.
  awardCoins(amount: number, reason: string) {
    if (amount <= 0) return
    this.emit({ kind: 'award', amount, reason })
    this.adjustCoins(amount)
  }

  // Add (or, with a negative delta, take away) coins. Unlike building, taxes
  // may push coins below zero: that's debt, and it accrues late penalties.
  adjustCoins(delta: number) {
    if (delta === 0) return
    this._coins += delta
    this.emit({ kind: 'coins', coins: this._coins })
  }

  toSave(): CitySave {
    return {
      coins: this._coins,
      nextId: this.nextId,
      buildings: [...this.buildings.values()].map((b) => ({
        id: b.id,
        typeId: b.type.id,
        tile: b.tile,
        readyAt: b.readyAt,
        crop: b.crop,
      })),
    }
  }

  // Rebuild a City from a save. Meant for a fresh, empty City. Buildings whose
  // type no longer exists, or that would overlap, are skipped with a warning
  // rather than breaking the whole save.
  load(save: CitySave) {
    for (const saved of save.buildings) {
      const type = BUILDINGS_BY_ID.get(RENAMED_BUILDING_IDS[saved.typeId] ?? saved.typeId)
      if (!type || !this.canPlace(type, saved.tile)) {
        console.warn('Skipping saved building that no longer fits:', saved)
        continue
      }
      // Saves from before Stage 4 have no crop field; a crop that was removed from the catalog is dropped.
      const crop = saved.crop && CROPS_BY_ID.has(saved.crop.cropId) ? saved.crop : null
      const building = { id: saved.id, type, tile: saved.tile, readyAt: saved.readyAt, crop }
      this.buildings.set(building.id, building)
      this.mark(building, building.id)
      this.emit({ kind: 'added', building, paid: 0 })
      this.nextId = Math.max(this.nextId, building.id + 1)
    }
    this.nextId = Math.max(this.nextId, save.nextId)
    this._coins = save.coins
    this.emit({ kind: 'coins', coins: this._coins })
  }

  private mark(building: PlacedBuilding, value: number | null) {
    for (const t of footprintTiles(building.tile, building.type.size)) {
      this.occupied[t.z * GRID_SIZE + t.x] = value
    }
  }

  private emit(event: CityEvent) {
    for (const listener of this.listeners) listener(event)
  }
}
