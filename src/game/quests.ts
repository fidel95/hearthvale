import { Emitter } from './events'
import type { City } from './City'
import type { Collections } from './collections'
import type { Inventory } from './Inventory'
import type { Neighbors } from './Neighbors'
import type { Materials } from './items'
import { MATERIAL_IDS } from './items'
import data from '../data/quests.json'
import type { Player } from './Player'
import type { Services } from './Services'
import { isTrack } from './buildings'
import type { Taxes } from './Taxes'

// Quests and achievements. Quests are a guided path through the game's
// systems, a few at a time, each with tasks and a reward. Achievements are
// lifetime milestones with tiers.
//
// Both run on stats: lifetime counters of things you've done (collections,
// harvests, ships unloaded, …), counted from game events. A "do X 3 times"
// task compares a stat with its value when the quest started; a "have X" task
// looks at the town as it is now.

export type StatId =
  | 'rent' // times rent was collected
  | 'sales' // shop sales
  | 'earned' // coins earned from rent and sales
  | 'harvests'
  | 'plantings'
  | 'built' // buildings bought and placed
  | 'restocks'
  | 'finished' // constructions finished
  | 'upgrades'
  | 'lots' // land bought
  | 'unloads' // ships unloaded
  | 'sets' // collections handed in
  | 'returns' // tax returns filed
  | 'helps' // times you helped a neighbor
  | 'made' // products made in factories

export interface World {
  city: City
  player: Player
  services: Services
}

// What a "have X" task measures in the town, as plain data:
// { building: 'bakery' } counts Bakeries, { category: 'home' } counts homes,
// and the others read a number from the town.
export type Measure =
  | { building: string }
  | { category: string }
  | { population: true }
  | { goods: true }
  | { rating: true }

export interface Task {
  label: string
  count: number
  // Either a stat counted since the quest started...
  stat?: StatId
  // ...or something about the town right now.
  have?: Measure
}

export interface Reward {
  coins?: number
  xp?: number
  materials?: Materials
}

export interface Quest {
  id: string
  title: string
  giver?: string // who asks: a townsperson, shown on the quest's bubble (Hud)
  intro: string
  tasks: Task[]
  reward: Reward
  after?: string // a quest that must be done first
  level?: number // the player level needed to start it
}

// Lifetime milestones, each with three tiers.
export interface Achievement {
  id: string
  name: string
  icon: string
  stat: StatId
  tiers: [number, number, number]
}

// The quests and achievements themselves are data, in src/data/quests.json.
export const QUESTS = data.quests as Quest[]
export const ACHIEVEMENTS = data.achievements as Achievement[]
export const ACHIEVEMENT_XP = data.achievementXp

// The number a "have X" task is measured by.
export function measure(w: World, m: Measure): number {
  const built = [...w.city.all()].filter((b) => w.city.isBuilt(b))
  if ('building' in m) return built.filter((b) => b.type.id === m.building).length
  if ('category' in m) return built.filter((b) => b.type.category === m.category).length
  if ('population' in m) return w.services.report.population
  if ('goods' in m) return w.city.goods
  return w.services.rating().total
}

const MAX_ACTIVE = 3

export interface QuestsSave {
  stats: Partial<Record<StatId, number>>
  active: [string, Partial<Record<StatId, number>>][] // quest id and its starting stats
  claimed: string[]
  tiers: [string, number][] // achievement id and tiers reached
  done?: [string, number[]][] // quest id and the tasks already completed (older saves: none)
}

export type QuestsEvent =
  | { kind: 'changed' }
  | { kind: 'questDone'; quest: Quest } // all tasks done: ready to claim
  | { kind: 'claimed'; quest: Quest }
  | { kind: 'achievement'; achievement: Achievement; tier: number }

export class Quests {
  private stats: Partial<Record<StatId, number>> = {}
  private active = new Map<string, Partial<Record<StatId, number>>>()
  private claimed = new Set<string>()
  private tiers = new Map<string, number>()
  // Tasks that have reached their count. They stay done: a "have 3 homes" task
  // isn't undone by removing a home before claiming the reward.
  private done = new Map<string, Set<number>>()
  private announced = new Set<string>() // quests already reported as done this session
  private world: World
  private inventory: Inventory
  private events = new Emitter<QuestsEvent>()

  constructor(world: World, inventory: Inventory, collections: Collections, taxes: Taxes, neighbors?: Neighbors) {
    this.world = world
    this.inventory = inventory
    world.city.onChange((e) => {
      switch (e.kind) {
        case 'collected':
          if (e.building.type.category === 'home') this.bump('rent')
          if (e.building.type.category === 'business') this.bump('sales')
          this.bump('earned', e.amount)
          break
        case 'harvested':
          this.bump('harvests')
          break
        case 'planted':
          if (e.cost > 0) this.bump('plantings')
          break
        case 'added':
          if (e.paid > 0 && !isTrack(e.building.type)) this.bump('built')
          break
        case 'restocked':
          this.bump('restocks')
          break
        case 'finished':
          this.bump('finished')
          break
        case 'upgraded':
          this.bump('upgrades')
          break
        case 'land':
          if (e.bought) this.bump('lots')
          break
        case 'made':
          this.bump('made', e.units)
          break
        case 'goodsIn':
          this.bump('unloads')
          break
      }
      // "Have X" tasks depend on the town itself, so any change may complete one.
      this.check()
    })
    collections.onChange((e) => e.kind === 'completed' && this.bump('sets'))
    taxes.onChange((e) => e.kind === 'taxDay' && this.bump('returns'))
    neighbors?.onChange((e) => e.kind === 'helped' && this.bump('helps'))
    world.player.onChange((e) => e.kind === 'levelUp' && this.refresh())
    world.services.onChange(() => this.check())
    this.refresh()
  }

  onChange(listener: (event: QuestsEvent) => void) {
    this.events.on(listener)
  }

  stat(id: StatId): number {
    return this.stats[id] ?? 0
  }

  activeQuests(): Quest[] {
    return QUESTS.filter((q) => this.active.has(q.id))
  }

  // Quests that come next, with what's holding each back.
  upcoming(): { quest: Quest; waitingFor: string }[] {
    return QUESTS.filter((q) => !this.active.has(q.id) && !this.claimed.has(q.id)).map((q) => {
      const after = q.after && !this.claimed.has(q.after) ? QUESTS.find((p) => p.id === q.after)!.title : null
      const level = q.level && this.world.player.level < q.level ? q.level : null
      const waitingFor = after ? `Finish “${after}”` : level ? `Reach level ${level}` : 'A free quest slot'
      return { quest: q, waitingFor }
    })
  }

  claimedQuests(): Quest[] {
    return QUESTS.filter((q) => this.claimed.has(q.id))
  }

  // How far along a task is, from 0 up to its count.
  progress(quest: Quest, task: Task): number {
    if (this.done.get(quest.id)?.has(quest.tasks.indexOf(task))) return task.count
    return this.measureTask(quest, task)
  }

  private measureTask(quest: Quest, task: Task): number {
    const value = task.stat ? this.stat(task.stat) - (this.active.get(quest.id)?.[task.stat] ?? 0) : measure(this.world, task.have!)
    return Math.min(task.count, value)
  }

  // How far along a quest is, from 0 to 1, over all its tasks.
  share(quest: Quest): number {
    const total = quest.tasks.reduce((sum, t) => sum + t.count, 0)
    const got = quest.tasks.reduce((sum, t) => sum + Math.min(t.count, this.progress(quest, t)), 0)
    return total > 0 ? got / total : 1
  }

  isDone(quest: Quest): boolean {
    return this.active.has(quest.id) && quest.tasks.every((t) => this.progress(quest, t) >= t.count)
  }

  readyCount(): number {
    return this.activeQuests().filter((q) => this.isDone(q)).length
  }

  claim(quest: Quest): boolean {
    if (!this.isDone(quest)) return false
    this.active.delete(quest.id)
    this.done.delete(quest.id)
    this.claimed.add(quest.id)
    const { coins = 0, xp = 0, materials = {} } = quest.reward
    // Quest rewards are prizes, so taxable, like the other rewards.
    this.world.city.economy.award(coins, `Quest: ${quest.title}`)
    for (const id of MATERIAL_IDS) this.inventory.add(id, materials[id] ?? 0)
    this.world.player.grantXp(xp)
    this.emit({ kind: 'claimed', quest })
    this.refresh()
    return true
  }

  tierOf(a: Achievement): number {
    return this.tiers.get(a.id) ?? 0
  }

  toSave(): QuestsSave {
    return {
      stats: { ...this.stats },
      active: [...this.active.entries()].map(([id, base]) => [id, { ...base }]),
      claimed: [...this.claimed],
      tiers: [...this.tiers.entries()],
      done: [...this.done.entries()].map(([id, tasks]) => [id, [...tasks]]),
    }
  }

  load(save: QuestsSave) {
    this.stats = { ...save.stats }
    this.active = new Map(save.active)
    this.claimed = new Set(save.claimed)
    this.tiers = new Map(save.tiers)
    this.done = new Map((save.done ?? []).map(([id, tasks]) => [id, new Set(tasks)]))
    this.announced = new Set(this.activeQuests().filter((q) => this.isDone(q)).map((q) => q.id))
    this.refresh()
  }

  private bump(stat: StatId, by = 1) {
    this.stats[stat] = this.stat(stat) + by
    for (const a of ACHIEVEMENTS) {
      if (a.stat !== stat) continue
      const tier = this.tierOf(a)
      if (tier < 3 && this.stat(stat) >= a.tiers[tier]) {
        this.tiers.set(a.id, tier + 1)
        this.world.player.grantXp(ACHIEVEMENT_XP[tier])
        this.emit({ kind: 'achievement', achievement: a, tier: tier + 1 })
      }
    }
    this.check()
  }

  // Start any quests that are now available, up to MAX_ACTIVE at a time.
  private refresh() {
    for (const q of QUESTS) {
      if (this.active.size >= MAX_ACTIVE) break
      if (this.active.has(q.id) || this.claimed.has(q.id)) continue
      if (q.after && !this.claimed.has(q.after)) continue
      if (q.level && this.world.player.level < q.level) continue
      this.active.set(q.id, { ...this.stats })
    }
    this.check()
  }

  // Mark tasks that have reached their count, and announce quests that have
  // just become ready to claim.
  private check() {
    for (const q of this.activeQuests()) {
      q.tasks.forEach((t, i) => {
        if (this.measureTask(q, t) < t.count) return
        if (!this.done.has(q.id)) this.done.set(q.id, new Set())
        this.done.get(q.id)!.add(i)
      })
      if (!this.announced.has(q.id) && this.isDone(q)) {
        this.announced.add(q.id)
        this.emit({ kind: 'questDone', quest: q })
      }
    }
    this.emit({ kind: 'changed' })
  }

  private emit(event: QuestsEvent) {
    this.events.emit(event)
  }
}
