import { Emitter } from './events'
import type { City } from './City'
import type { Inventory } from './Inventory'
import { MATERIALS } from './items'
import { BUILDINGS_BY_ID, type BuildingType } from './buildings'
import {
  FRANCHISE_FRIENDSHIP,
  HELPS_PER_DAY,
  HELP_REWARD,
  NEIGHBORS,
  NEIGHBORS_UNLOCK_LEVEL,
  dailyGift,
  canFranchise,
  dailyRequest,
  dayKey,
  franchiseFee,
  franchiseTakings,
  type Neighbor,
} from './neighborData'
import type { Player } from './Player'

// Your relationships with the neighbors: friendship, and what's been done
// today (helps, the daily gift, the daily request). The rules and data are in
// neighborData.ts.
//
// Two tax rules meet here:
// - Coins a neighbor pays you for helping are payment for a service, so
//   they're taxable income (City.awardCoins records them).
// - A gift isn't income to whoever receives it (IRC §102), and isn't a
//   deduction for whoever gives it. Gifts move without any tax event.

interface NeighborState {
  friendship: number
  day: string // the day `helped` and the flags below are for
  helped: string[] // the spots in their town you've helped with that day
  giftClaimed: boolean
  requestDone: boolean
  franchise?: Franchise // your shop's branch in their town (added with franchises)
}

interface Franchise {
  typeId: string
  openedDay: string
  collectedDay: string // the day its takings were last collected (or the day it opened)
}

export type NeighborsSave = [string, NeighborState][]

export type NeighborsEvent = { kind: 'changed' } | { kind: 'helped' }

export class Neighbors {
  private states = new Map<string, NeighborState>()
  private city: City
  private player: Player
  private inventory: Inventory
  private events = new Emitter<NeighborsEvent>()
  // Franchise takings raised by this share (the Chamber of Commerce, Civic.ts).
  takingsBonus: () => number = () => 0

  constructor(city: City, player: Player, inventory: Inventory) {
    this.city = city
    this.player = player
    this.inventory = inventory
  }

  onChange(listener: (event: NeighborsEvent) => void) {
    this.events.on(listener)
  }

  get unlocked(): boolean {
    return this.player.level >= NEIGHBORS_UNLOCK_LEVEL // the level is set in neighborData, listed in UnlockSystem
  }

  // A neighbor's town grows with yours.
  townLevel(n: Neighbor): number {
    return Math.max(1, this.player.level + n.levelOffset)
  }

  friendship(n: Neighbor): number {
    return this.states.get(n.id)?.friendship ?? 0
  }

  // Today's state for a neighbor; a new day starts fresh (friendship carries on).
  private today(n: Neighbor, now: number): NeighborState {
    const day = dayKey(now)
    let s = this.states.get(n.id)
    if (!s) this.states.set(n.id, (s = { friendship: 0, day, helped: [], giftClaimed: false, requestDone: false }))
    if (s.day !== day) Object.assign(s, { day, helped: [], giftClaimed: false, requestDone: false })
    return s
  }

  helpsLeft(n: Neighbor, now: number): number {
    return HELPS_PER_DAY - this.today(n, now).helped.length
  }

  hasHelped(n: Neighbor, spot: string, now: number): boolean {
    return this.today(n, now).helped.includes(spot)
  }

  // Help with one spot in their town. Returns false if out of helps today or already done.
  help(n: Neighbor, spot: string, now: number): boolean {
    const s = this.today(n, now)
    if (s.helped.length >= HELPS_PER_DAY || s.helped.includes(spot)) return false
    s.helped.push(spot)
    s.friendship += HELP_REWARD.friendship
    this.city.economy.award(HELP_REWARD.coins, `Helping ${n.name}`)
    this.player.grantXp(HELP_REWARD.xp)
    this.events.emit({ kind: 'helped' })
    this.emit()
    return true
  }

  gift(n: Neighbor, now: number) {
    return dailyGift(n, dayKey(now), this.friendship(n))
  }

  canClaimGift(n: Neighbor, now: number): boolean {
    return !this.today(n, now).giftClaimed
  }

  // A gift: into the inventory at no cost, and not income.
  claimGift(n: Neighbor, now: number): boolean {
    const s = this.today(n, now)
    if (s.giftClaimed) return false
    const g = this.gift(n, now)
    s.giftClaimed = true
    this.inventory.add(g.material, g.amount)
    this.emit()
    return true
  }

  request(n: Neighbor, now: number) {
    return dailyRequest(n, dayKey(now))
  }

  canFulfill(n: Neighbor, now: number): boolean {
    const r = this.request(n, now)
    return !this.today(n, now).requestDone && this.inventory.count(r.material) >= r.amount
  }

  isRequestDone(n: Neighbor, now: number): boolean {
    return this.today(n, now).requestDone
  }

  // Give them what they asked for. They give coins back as a thank-you gift:
  // a gift both ways, so neither side has income or a deduction.
  fulfill(n: Neighbor, now: number): number {
    if (!this.canFulfill(n, now)) return 0
    const r = this.request(n, now)
    const s = this.today(n, now)
    this.inventory.remove(r.material, r.amount)
    s.requestDone = true
    s.friendship += 3
    const thanks = Math.round(r.amount * MATERIALS[r.material].price! * 1.5)
    this.city.economy.adjust(thanks)
    this.player.grantXp(5)
    this.emit()
    return thanks
  }

  // ---- Franchises (neighborData.ts has the numbers)

  // Your shop's branch in their town, if you've opened one.
  franchise(n: Neighbor): BuildingType | null {
    const f = this.states.get(n.id)?.franchise
    return (f && BUILDINGS_BY_ID.get(f.typeId)) || null
  }

  // The shops you could open a branch of: ones you've built in your own town.
  franchiseOptions(): BuildingType[] {
    const types = new Map<string, BuildingType>()
    for (const b of this.city.all()) if (canFranchise(b.type) && this.city.isBuilt(b)) types.set(b.type.id, b.type)
    return [...types.values()].sort((a, b) => a.cost - b.cost)
  }

  canOpenFranchise(n: Neighbor, type: BuildingType): boolean {
    return (
      this.unlocked &&
      this.friendship(n) >= FRANCHISE_FRIENDSHIP &&
      !this.franchise(n) &&
      this.franchiseOptions().includes(type) &&
      this.city.coins >= franchiseFee(type)
    )
  }

  // Pay the fee and open the branch. Buying into a business is a capital
  // cost, not a running expense, so it's a plain coin change (no deduction).
  // It opens today; its first takings are tomorrow's.
  openFranchise(n: Neighbor, type: BuildingType, now: number): boolean {
    if (!this.canOpenFranchise(n, type)) return false
    this.city.economy.adjust(-franchiseFee(type))
    this.today(n, now).franchise = { typeId: type.id, openedDay: dayKey(now), collectedDay: dayKey(now) }
    this.emit()
    return true
  }

  franchiseOpenedToday(n: Neighbor, now: number): boolean {
    return this.states.get(n.id)?.franchise?.openedDay === dayKey(now)
  }

  franchiseTakings(n: Neighbor): number {
    const type = this.franchise(n)
    return type ? Math.round(franchiseTakings(type, this.friendship(n)) * (1 + this.takingsBonus())) : 0
  }

  canCollectFranchise(n: Neighbor, now: number): boolean {
    const f = this.states.get(n.id)?.franchise
    return !!f && !!this.franchise(n) && f.collectedDay !== dayKey(now)
  }

  // The day's takings: business income, so taxable. Returns the coins.
  collectFranchise(n: Neighbor, now: number): number {
    if (!this.canCollectFranchise(n, now)) return 0
    const coins = this.franchiseTakings(n)
    this.today(n, now).franchise!.collectedDay = dayKey(now)
    this.city.economy.award(coins, `Franchise in ${n.town}`)
    this.player.grantXp(5)
    this.emit()
    return coins
  }

  all(): Neighbor[] {
    return NEIGHBORS
  }

  toSave(): NeighborsSave {
    return [...this.states.entries()].map(([id, s]) => [id, { ...s, helped: [...s.helped], ...(s.franchise && { franchise: { ...s.franchise } }) }])
  }

  load(saved: NeighborsSave) {
    this.states = new Map(saved.map(([id, s]) => [id, { ...s, helped: [...s.helped], ...(s.franchise && { franchise: { ...s.franchise } }) }]))
    this.emit()
  }

  private emit() {
    this.events.emit({ kind: 'changed' })
  }
}
