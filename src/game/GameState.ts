import { Army } from './Army'
import { Disasters } from './Disasters'
import { Tourism } from './Tourism'
import { TownEvents } from './TownEvents'
import { Finances } from './Finances'
import { Tips } from './tips'
import { BUILDINGS_BY_ID } from './buildings'
import { City } from './City'
import { Collections } from './collections'
import { STARTING_MATERIALS } from './construction'
import { CROPS_BY_ID } from './crops'
import { Docks } from './Docks'
import { GameClock } from './GameClock'
import { Inventory } from './Inventory'
import { MATERIAL_IDS } from './items'
import { STARTING_TOWN } from './land'
import { Neighbors } from './Neighbors'
import { PlacementSystem } from './PlacementSystem'
import { Player } from './Player'
import { Quests } from './quests'
import { Services } from './Services'
import { SettingsStore } from './settings'
import { Taxes } from './Taxes'
import { Tutorial } from './tutorial'
import { UnlockSystem } from './UnlockSystem'

// Every game system, and nothing to do with drawing or the page: the town
// (with its economy and production), the player's progress, unlocks,
// placement rules, services, quests, collections, neighbors, shipping, taxes,
// the calendar, settings and the tutorial. Game puts views and windows on top;
// tests and tools can use it on its own.
//
// The systems talk to each other through their events (see events.ts), so
// creating them in this order is all the wiring they need.
export class GameState {
  readonly clock: GameClock
  readonly city = new City()
  readonly player = new Player(this.city)
  readonly unlocks = new UnlockSystem(this.player)
  readonly services = new Services(this.city)
  readonly placement = new PlacementSystem(this.city, this.services, this.unlocks)
  readonly docks = new Docks(this.city)
  readonly inventory = new Inventory(this.city)
  readonly collections = new Collections(this.city, this.inventory, this.player)
  readonly neighbors = new Neighbors(this.city, this.player, this.inventory)
  readonly taxes: Taxes
  readonly quests: Quests
  readonly settings = new SettingsStore()
  readonly tutorial = new Tutorial(this.city)
  readonly army = new Army(this.city)
  readonly disasters = new Disasters(this.city)
  readonly tourism = new Tourism(this.city)
  readonly townEvents: TownEvents
  readonly finances: Finances
  readonly tips: Tips = new Tips(this)
  // When the county last gave a grant (safetyNet.ts), so it can't be claimed again right away.
  safetyNet = { lastGrantAt: null as number | null }

  // speed: how fast the calendar runs (60 makes a month last a second, for testing).
  constructor(speed = 1) {
    this.clock = new GameClock(speed)
    this.services.extraTownBonus = () => this.army.bonus(Date.now())
    this.city.production.month = () => this.clock.month
    this.taxes = new Taxes(this.city, this.clock)
    this.quests = new Quests(
      { city: this.city, player: this.player, services: this.services },
      this.inventory,
      this.collections,
      this.taxes,
      this.neighbors,
    )
    this.townEvents = new TownEvents(this.city, this.player, this.quests)
    this.finances = new Finances(this.city, this.taxes, this.clock)
  }

  // A brand-new town: the starting buildings, crops and materials (land.ts, construction.ts).
  seedNewTown(now = Date.now()) {
    for (const start of STARTING_TOWN) {
      const b = this.city.place(BUILDINGS_BY_ID.get(start.typeId)!, start.tile, { free: true })!
      if (start.crop) this.city.production.plant(b.id, CROPS_BY_ID.get(start.crop.cropId)!, { now: now - start.crop.secondsIn * 1000, free: true })
    }
    for (const id of MATERIAL_IDS) this.inventory.add(id, STARTING_MATERIALS[id] ?? 0)
  }
}
