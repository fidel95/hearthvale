import { BUILDINGS_BY_ID, RENAMED_BUILDING_IDS, footprint, type BuildingType, type Rotation } from './buildings'
import { CROPS_BY_ID, type CropType, type PlantedCrop } from './crops'
import { Economy } from './Economy'
import { Emitter } from './events'
import { ProductionSystem } from './ProductionSystem'
import {
  GRID_SIZE,
  LOT_FOOTPRINT,
  footprintTiles,
  inBounds,
  lotCorner,
  lotInWorld,
  lotKey,
  lotNeighbors,
  lotOf,
  type Lot,
  type Tile,
} from './grid'
import { START_LOTS, START_LOT_VALUE, expansionPrice } from './land'
import { edgeTiles } from './communityRules'
import { isWater } from './terrain'

// The city's state: coins, which buildings exist and which tiles they cover.
// No three.js in here. CityView watches for changes and draws them, which
// keeps the rules testable (City.test.ts) and makes saving a matter of
// dumping this data (toSave / load).

// The town square stores this many goods; barns, warehouses and docks add more.
export const BASE_STORAGE = 100

// The tiles a placed building covers, given how it's turned.
export function sizeOf(b: { type: BuildingType; rotation?: Rotation }) {
  return footprint(b.type, b.rotation ?? 0)
}

export interface PlacedBuilding {
  id: number
  type: BuildingType
  tile: Tile // the footprint's lowest corner tile
  rotation: Rotation // quarter turns; see footprint()
  // When its income can next be collected, as a Date.now() timestamp.
  // Real clock time (not "seconds since the game started") so timers keep
  // running while the game is closed: rent is waiting when you come back.
  readyAt: number
  lastCollectedAt: number | null // when income was last collected, if ever
  // Farm plots only: what's planted, or null when the plot is empty.
  crop: PlantedCrop | null
  level: number // 1 to 3 (construction.ts)
  stock: number // shops: goods on the shelves
  // Under construction until endsAt; then it needs finishing (with materials).
  construction: { endsAt: number } | null
}

// The plain-JSON form of a building, for the save file.
interface BuildingSave {
  id: number
  typeId: string
  tile: Tile
  rotation?: Rotation
  readyAt: number
  lastCollectedAt?: number | null
  crop?: PlantedCrop | null
  level?: number // the fields from here on were added in Stage 9; older saves lack them
  stock?: number
  construction?: { endsAt: number } | null
  stored?: boolean
}

// A lot of land the town owns, and what it cost (its value for property tax).
export interface OwnedLot {
  lot: Lot
  price: number
}

// The plain-JSON form of a City, for the save file. Buildings store their
// type's id, not the whole type, so catalog changes apply to old saves.
export interface CitySave {
  coins: number
  goods?: number // missing in saves from before Stage 8
  debt?: number // saved separately since the coins-never-negative rule
  nextId: number
  buildings: BuildingSave[]
  lots: { x: number; z: number; price: number }[]
}

export type CityEvent =
  // paid is what the player spent: 0 for free buildings and ones loaded from a save.
  | { kind: 'added'; building: PlacedBuilding; paid: number }
  | { kind: 'removed'; building: PlacedBuilding }
  | { kind: 'moved'; building: PlacedBuilding }
  // goodsUsed: what a shop sold out of storage to earn it.
  | { kind: 'collected'; building: PlacedBuilding; amount: number; goodsUsed: number }
  | { kind: 'planted'; building: PlacedBuilding; crop: CropType; cost: number }
  // goods went into storage; amount is coins from selling the rest at the market.
  | { kind: 'harvested'; building: PlacedBuilding; crop: CropType; goods: number; amount: number }
  // Goods bought and delivered (a shipment), and what they cost.
  | { kind: 'goodsIn'; units: number; cost: number }
  | { kind: 'goods'; goods: number }
  | { kind: 'cleared'; building: PlacedBuilding; crop: CropType } // a withered crop was cleared away
  | { kind: 'award'; amount: number; reason: string } // prize coins, e.g. a level-up reward
  | { kind: 'expense'; amount: number; reason: string } // a running cost, e.g. utility upkeep
  | { kind: 'coins'; coins: number }
  | { kind: 'debt'; debt: number }
  // The land changed: a lot was bought (bought is set), or a save was loaded.
  | { kind: 'land'; bought?: OwnedLot }
  // Construction finished; materialsCost is what the materials used had cost.
  | { kind: 'finished'; building: PlacedBuilding; materialsCost: number }
  | { kind: 'restocked'; building: PlacedBuilding; units: number }
  // cost: coins plus materials, all of it an improvement to the building.
  | { kind: 'upgraded'; building: PlacedBuilding; cost: number }
  // Taken off the map into the inventory, and put back.
  | { kind: 'stored'; building: PlacedBuilding }
  | { kind: 'restored'; building: PlacedBuilding }

export class City {
  private buildings = new Map<number, PlacedBuilding>()
  // Buildings taken off the map and kept in the inventory, by id.
  private stored = new Map<number, PlacedBuilding>()
  // One slot per tile holding the id of the building on it, or null.
  // Tile (x, z) lives at index z * GRID_SIZE + x.
  private occupied: (number | null)[] = new Array(GRID_SIZE * GRID_SIZE).fill(null)
  private nextId = 1
  readonly events = new Emitter<CityEvent>()
  // Coins, goods and debt, and the rules for changing them.
  readonly economy = new Economy((e) => this.events.emit(e), () => this.storageCapacity)
  // Collecting, harvesting, restocking, finishing, upgrading.
  readonly production = new ProductionSystem(this, this.economy, (e) => this.events.emit(e))
  private land = new Map<string, OwnedLot>(
    START_LOTS.map((lot) => [lotKey(lot), { lot, price: START_LOT_VALUE }]),
  )

  // What share of its full income a building earns right now (0 to 1).
  // Services sets this from the utility report; without it everything earns in full.
  incomeMultiplier: (building: PlacedBuilding) => number = () => 1
  // How a building's location changes its value for property tax (1 = no change).
  // Services sets this from nearby parks, schools and roads.
  valueMultiplier: (building: PlacedBuilding) => number = () => 1

  // Quick reads of the economy (changes go through city.economy).
  get coins() {
    return this.economy.coins
  }

  get goods() {
    return this.economy.goods
  }

  get debt() {
    return this.economy.debt
  }

  onChange(listener: (event: CityEvent) => void) {
    this.events.on(listener)
  }

  all(): Iterable<PlacedBuilding> {
    return this.buildings.values()
  }

  get(id: number): PlacedBuilding | undefined {
    return this.buildings.get(id)
  }

  storedBuildings(): Iterable<PlacedBuilding> {
    return this.stored.values()
  }

  getStored(id: number): PlacedBuilding | undefined {
    return this.stored.get(id)
  }

  isRoad = (tile: Tile): boolean => this.buildingAt(tile)?.type.category === 'road'

  // The road rule: a road on any tile touching one side of the footprint.
  // (ignoring: pretend this road tile is gone, to check what removing it would cut off.)
  // ignoring: road tiles to treat as gone (to ask "what if these were removed?").
  hasRoadAccess(b: PlacedBuilding, ignoring: Tile[] = []): boolean {
    return edgeTiles(b).some((t) => this.isRoad(t) && !ignoring.some((i) => i.x === t.x && i.z === t.z))
  }

  // Buildings that need a road and would lose every one if these road tiles went.
  cutOffBy(...roads: PlacedBuilding[]): PlacedBuilding[] {
    const tiles = roads.map((r) => r.tile)
    return [...this.buildings.values()].filter((b) => b.type.requiresRoad && this.hasRoadAccess(b) && !this.hasRoadAccess(b, tiles))
  }

  // Working: built, and connected if it needs a road.
  isOperating(b: PlacedBuilding): boolean {
    return this.isBuilt(b) && (!b.type.requiresRoad || this.hasRoadAccess(b))
  }

  buildingAt(tile: Tile): PlacedBuilding | undefined {
    if (!inBounds(tile)) return undefined
    const id = this.occupied[tile.z * GRID_SIZE + tile.x]
    return id === null ? undefined : this.buildings.get(id)
  }

  // ---- Land

  ownedLots(): Iterable<OwnedLot> {
    return this.land.values()
  }

  ownsLot(lot: Lot): boolean {
    return this.land.has(lotKey(lot))
  }

  ownsTile(tile: Tile): boolean {
    return this.ownsLot(lotOf(tile))
  }

  // How many lots have been bought beyond the starting ones.
  get expansions(): number {
    return this.land.size - START_LOTS.length
  }

  // The price of the next lot, whichever one it is.
  get nextLotPrice(): number {
    return expansionPrice(this.expansions + 1)
  }

  // A lot can be bought if it's in the world, not owned yet, next to land you
  // own, and not entirely sea.
  canBuyLot(lot: Lot): boolean {
    if (!lotInWorld(lot) || this.ownsLot(lot) || !lotNeighbors(lot).some((n) => this.ownsLot(n))) return false
    const corner = lotCorner(lot)
    return footprintTiles(corner, LOT_FOOTPRINT).some((t) => !isWater(t))
  }

  // materialsCost: what the materials used to clear it had cost, added to the
  // land's value (clearing land is part of its cost, and land isn't depreciated).
  buyLot(lot: Lot, materialsCost = 0): boolean {
    const price = this.nextLotPrice
    if (!this.canBuyLot(lot) || !this.economy.canAfford(price)) return false
    const owned = { lot, price: price + materialsCost }
    this.land.set(lotKey(lot), owned)
    this.emit({ kind: 'land', bought: owned })
    this.economy.adjust(-price)
    return true
  }

  // ---- Buildings

  canAfford(type: BuildingType): boolean {
    return this.economy.canAfford(type.cost)
  }

  // ignoreId lets a building being moved (or turned) overlap its own current spot.
  canPlace(type: BuildingType, tile: Tile, ignoreId?: number, rotation: Rotation = 0): boolean {
    const fits = footprintTiles(tile, footprint(type, rotation)).every((t) => {
      if (!inBounds(t) || !this.ownsTile(t) || isWater(t)) return false
      const id = this.occupied[t.z * GRID_SIZE + t.x]
      return id === null || id === ignoreId
    })
    if (!fits) return false
    // Docks stand on the shore: at least two of the tiles along their edges must be sea.
    if (type.onShore) return edgeTiles({ type, tile, rotation }).filter(isWater).length >= 2
    return true
  }

  // free: true skips the cost, for the starting town.
  place(
    type: BuildingType,
    tile: Tile,
    { now = Date.now(), free = false, rotation = 0 as Rotation } = {},
  ): PlacedBuilding | null {
    if (!this.canPlace(type, tile, undefined, rotation)) return null
    if (!free && !this.canAfford(type)) return null

    // Bigger buildings start as a construction site (unless they're free, like the starting town).
    const construction = type.build && !free ? { endsAt: now + type.build.seconds * 1000 } : null
    const readyAt = type.income && !construction ? now + type.income.seconds * 1000 : 0
    const building: PlacedBuilding = {
      id: this.nextId++,
      type,
      tile,
      rotation,
      readyAt,
      lastCollectedAt: null,
      crop: null,
      level: 1,
      stock: 0,
      construction,
    }
    this.buildings.set(building.id, building)
    this.mark(building, building.id)
    const paid = free ? 0 : type.cost
    this.emit({ kind: 'added', building, paid })
    this.economy.adjust(-paid)
    return building
  }

  remove(id: number) {
    const building = this.buildings.get(id)
    if (!building) return
    this.mark(building, null)
    this.buildings.delete(id)
    this.emit({ kind: 'removed', building })
  }

  // Move a building, optionally turning it too.
  move(id: number, tile: Tile, rotation?: Rotation): boolean {
    const building = this.buildings.get(id)
    const turn = rotation ?? building?.rotation ?? 0
    if (!building || !this.canPlace(building.type, tile, id, turn)) return false
    this.mark(building, null)
    building.tile = tile
    building.rotation = turn
    this.mark(building, id)
    this.emit({ kind: 'moved', building })
    return true
  }

  // ---- Construction state and storing

  // Built and working: not a construction site.
  isBuilt(building: PlacedBuilding): boolean {
    return building.construction === null
  }

  // Take a finished building off the map and keep it for later.
  store(id: number): boolean {
    const b = this.buildings.get(id)
    if (!b || !this.isBuilt(b)) return false
    this.mark(b, null)
    this.buildings.delete(id)
    this.stored.set(id, b)
    this.emit({ kind: 'stored', building: b })
    return true
  }

  // Put a stored building back on the map, free.
  restore(id: number, tile: Tile, now = Date.now(), rotation: Rotation = 0): boolean {
    const b = this.stored.get(id)
    if (!b || !this.canPlace(b.type, tile, undefined, rotation)) return false
    this.stored.delete(id)
    b.tile = tile
    b.rotation = rotation
    if (b.type.income) b.readyAt = now + b.type.income.seconds * 1000
    this.buildings.set(id, b)
    this.mark(b, id)
    this.emit({ kind: 'restored', building: b })
    return true
  }

  // ---- Goods

  // How many goods town storage holds: the town square plus storage buildings.
  get storageCapacity(): number {
    let capacity = BASE_STORAGE
    for (const b of this.buildings.values()) if (this.isBuilt(b)) capacity += b.type.storage ?? 0
    return capacity
  }

  toSave(): CitySave {
    return {
      coins: this.economy.coins,
      goods: this.economy.goods,
      debt: this.economy.debt,
      nextId: this.nextId,
      buildings: [
        ...[...this.buildings.values()].map((b) => this.saveBuilding(b, false)),
        ...[...this.stored.values()].map((b) => this.saveBuilding(b, true)),
      ],
      lots: [...this.land.values()].map(({ lot, price }) => ({ x: lot.x, z: lot.z, price })),
    }
  }

  // Rebuild a City from a save. Meant for a fresh, empty City. Buildings whose
  // type no longer exists, or that would overlap, are skipped with a warning
  // rather than breaking the whole save.
  load(save: CitySave) {
    // Land first: buildings can only be placed on land the town owns.
    this.land = new Map(save.lots.map(({ x, z, price }) => [lotKey({ x, z }), { lot: { x, z }, price }]))
    this.emit({ kind: 'land' })
    for (const saved of save.buildings) {
      const type = BUILDINGS_BY_ID.get(RENAMED_BUILDING_IDS[saved.typeId] ?? saved.typeId)
      if (!type || (!saved.stored && !this.canPlace(type, saved.tile, undefined, saved.rotation ?? 0))) {
        console.warn('Skipping saved building that no longer fits:', saved)
        continue
      }
      // Saves from before Stage 4 have no crop field; a crop that was removed from the catalog is dropped.
      const crop = saved.crop && CROPS_BY_ID.has(saved.crop.cropId) ? saved.crop : null
      const building: PlacedBuilding = {
        id: saved.id,
        type,
        tile: saved.tile,
        rotation: saved.rotation ?? 0,
        readyAt: saved.readyAt,
        lastCollectedAt: saved.lastCollectedAt ?? null,
        crop,
        level: saved.level ?? 1,
        stock: saved.stock ?? 0,
        construction: saved.construction ?? null,
      }
      this.nextId = Math.max(this.nextId, building.id + 1)
      if (saved.stored) {
        this.stored.set(building.id, building)
        continue
      }
      this.buildings.set(building.id, building)
      this.mark(building, building.id)
      this.emit({ kind: 'added', building, paid: 0 })
    }
    this.nextId = Math.max(this.nextId, save.nextId)
    this.economy.load(save)
  }

  private saveBuilding(b: PlacedBuilding, stored: boolean): BuildingSave {
    return {
      id: b.id,
      typeId: b.type.id,
      tile: b.tile,
      rotation: b.rotation,
      readyAt: b.readyAt,
      lastCollectedAt: b.lastCollectedAt,
      crop: b.crop,
      level: b.level,
      stock: b.stock,
      construction: b.construction,
      ...(stored ? { stored } : {}),
    }
  }

  private mark(building: PlacedBuilding, value: number | null) {
    for (const t of footprintTiles(building.tile, sizeOf(building))) {
      this.occupied[t.z * GRID_SIZE + t.x] = value
    }
  }

  private emit(event: CityEvent) {
    this.events.emit(event)
  }
}
