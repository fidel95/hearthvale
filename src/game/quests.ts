import type { City } from './City'
import type { Collections } from './collections'
import type { Inventory } from './Inventory'
import type { Materials } from './items'
import { MATERIAL_IDS } from './items'
import type { Player } from './Player'
import type { Services } from './Services'
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

export interface World {
  city: City
  player: Player
  services: Services
}

export interface Task {
  label: string
  count: number
  // Either a stat counted since the quest started...
  stat?: StatId
  // ...or something about the town right now.
  have?: (w: World) => number
}

export interface Reward {
  coins?: number
  xp?: number
  materials?: Materials
}

export interface Quest {
  id: string
  title: string
  intro: string
  tasks: Task[]
  reward: Reward
  after?: string // a quest that must be done first
  level?: number // the player level needed to start it
}

const count = (w: World, test: (id: string, category: string) => boolean) =>
  [...w.city.all()].filter((b) => w.city.isBuilt(b) && test(b.type.id, b.type.category)).length

export const QUESTS: Quest[] = [
  {
    id: 'welcome',
    title: 'Welcome to Hearthvale',
    intro: 'Every town starts small. Collect the rent and bring in your first harvest.',
    tasks: [
      { label: 'Collect rent 3 times', stat: 'rent', count: 3 },
      { label: 'Harvest a crop', stat: 'harvests', count: 1 },
    ],
    reward: { coins: 100, xp: 10 },
  },
  {
    id: 'growing',
    title: 'A Growing Town',
    intro: 'More homes mean more rent. Keep the fields busy too.',
    after: 'welcome',
    tasks: [
      { label: 'Have 3 homes', have: (w) => count(w, (_, c) => c === 'home'), count: 3 },
      { label: 'Plant 3 crops', stat: 'plantings', count: 3 },
    ],
    reward: { coins: 150, xp: 15, materials: { lumber: 3 } },
  },
  {
    id: 'shop',
    title: 'Open for Business',
    intro: 'Shops sell goods from their shelves. Stock one up and make some sales.',
    after: 'welcome',
    level: 2,
    tasks: [
      { label: 'Build a Bakery', have: (w) => count(w, (id) => id === 'bakery'), count: 1 },
      { label: 'Restock a shop', stat: 'restocks', count: 1 },
      { label: 'Make 3 sales', stat: 'sales', count: 3 },
    ],
    reward: { coins: 200, xp: 20, materials: { bricks: 4 } },
  },
  {
    id: 'utilities',
    title: 'Keep the Taps Running',
    intro: 'The county only supplies a small town. Build your own water supply before you outgrow it.',
    after: 'growing',
    level: 4,
    tasks: [
      { label: 'Build a Water Tower', have: (w) => count(w, (id) => id === 'water-tower'), count: 1 },
      { label: 'Reach 16 residents', have: (w) => w.services.report.population, count: 16 },
    ],
    reward: { coins: 250, xp: 20, materials: { steel: 4 } },
  },
  {
    id: 'storage',
    title: 'Room for the Harvest',
    intro: 'Once you have a shop, harvests become goods. A barn holds more of them.',
    after: 'shop',
    level: 5,
    tasks: [
      { label: 'Build a Barn', have: (w) => count(w, (id) => id === 'barn'), count: 1 },
      { label: 'Store 50 goods', have: (w) => w.city.goods, count: 50 },
    ],
    reward: { coins: 250, xp: 25, materials: { lumber: 4 } },
  },
  {
    id: 'roads',
    title: 'Paving the Way',
    intro: 'Homes and shops beside a road earn more, and residents prefer to walk on them.',
    after: 'growing',
    tasks: [{ label: 'Have 10 road tiles', have: (w) => count(w, (_, c) => c === 'road'), count: 10 }],
    reward: { coins: 150, xp: 15 },
  },
  {
    id: 'builder',
    title: 'Master Builder',
    intro: 'Bigger buildings take time to build, then materials to finish. Build a Townhouse.',
    after: 'shop',
    level: 3,
    tasks: [
      { label: 'Build a Townhouse', have: (w) => count(w, (id) => id === 'townhouse'), count: 1 },
      { label: 'Finish a construction', stat: 'finished', count: 1 },
    ],
    reward: { coins: 300, xp: 30, materials: { glass: 3 } },
  },
  {
    id: 'renovator',
    title: 'Renovator',
    intro: 'Homes and shops can be upgraded to earn more. Upgrading is an improvement: its cost is depreciated, not deducted.',
    after: 'builder',
    level: 7,
    tasks: [{ label: 'Upgrade a building', stat: 'upgrades', count: 1 }],
    reward: { coins: 400, xp: 40, materials: { bricks: 4, glass: 3 } },
  },
  {
    id: 'land',
    title: 'Room to Grow',
    intro: 'Buy the land next door. Land is taxed every year, but never depreciated.',
    after: 'utilities',
    level: 8,
    tasks: [{ label: 'Buy a lot of land', stat: 'lots', count: 1 }],
    reward: { coins: 400, xp: 25 },
  },
  {
    id: 'community',
    title: 'Community Spirit',
    intro: 'Parks, schools and fire stations make nearby homes worth more.',
    after: 'utilities',
    level: 6,
    tasks: [
      { label: 'Build a Park', have: (w) => count(w, (id) => id === 'park'), count: 1 },
      { label: 'Reach 24 residents', have: (w) => w.services.report.population, count: 24 },
    ],
    reward: { coins: 400, xp: 30 },
  },
  {
    id: 'collector',
    title: 'Treasure Hunter',
    intro: 'Collectibles turn up as you play. Complete a set and hand it in.',
    after: 'growing',
    tasks: [{ label: 'Hand in a collection', stat: 'sets', count: 1 }],
    reward: { coins: 300, xp: 30 },
  },
  {
    id: 'taxes',
    title: 'Good Citizen',
    intro: 'Tax Day comes after December. Open Taxes (tap your coins) to see what you will owe.',
    after: 'welcome',
    tasks: [{ label: 'File a tax return', stat: 'returns', count: 1 }],
    reward: { coins: 200, xp: 20 },
  },
  {
    id: 'harbor',
    title: 'Harbor Town',
    intro: 'Build a dock on the shore and bring goods in by sea.',
    after: 'land',
    level: 9,
    tasks: [
      { label: 'Build a Dock', have: (w) => count(w, (id) => id === 'dock'), count: 1 },
      { label: 'Unload a ship', stat: 'unloads', count: 1 },
    ],
    reward: { coins: 500, xp: 40, materials: { steel: 4 } },
  },
  {
    id: 'tycoon',
    title: 'Tycoon',
    intro: 'Earn 5,000 coins from rent and sales. Mind the brackets on Tax Day!',
    after: 'builder',
    level: 8,
    tasks: [{ label: 'Earn 🪙 5,000 from rent and sales', stat: 'earned', count: 5000 }],
    reward: { coins: 1000, xp: 60 },
  },
]

// Lifetime milestones, each with three tiers.
export interface Achievement {
  id: string
  name: string
  icon: string
  stat: StatId
  tiers: [number, number, number]
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'landlord', name: 'Landlord', icon: '🏠', stat: 'rent', tiers: [10, 50, 250] },
  { id: 'shopkeeper', name: 'Shopkeeper', icon: '🏪', stat: 'sales', tiers: [10, 50, 250] },
  { id: 'farmer', name: 'Farmer', icon: '🌾', stat: 'harvests', tiers: [10, 50, 250] },
  { id: 'builder', name: 'Builder', icon: '🔨', stat: 'built', tiers: [5, 25, 100] },
  { id: 'explorer', name: 'Explorer', icon: '🗺️', stat: 'lots', tiers: [1, 5, 15] },
  { id: 'captain', name: 'Captain', icon: '🚢', stat: 'unloads', tiers: [1, 10, 50] },
  { id: 'collector', name: 'Collector', icon: '🏆', stat: 'sets', tiers: [1, 5, 20] },
  { id: 'taxpayer', name: 'Taxpayer', icon: '🧾', stat: 'returns', tiers: [1, 5, 10] },
]

export const ACHIEVEMENT_XP = [10, 25, 50]
const MAX_ACTIVE = 3

export interface QuestsSave {
  stats: Partial<Record<StatId, number>>
  active: [string, Partial<Record<StatId, number>>][] // quest id and its starting stats
  claimed: string[]
  tiers: [string, number][] // achievement id and tiers reached
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
  private announced = new Set<string>() // quests already reported as done this session
  private world: World
  private inventory: Inventory
  private listeners: ((event: QuestsEvent) => void)[] = []

  constructor(world: World, inventory: Inventory, collections: Collections, taxes: Taxes) {
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
          if (e.paid > 0 && e.building.type.category !== 'road') this.bump('built')
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
        case 'goodsIn':
          this.bump('unloads')
          break
      }
      // "Have X" tasks depend on the town itself, so any change may complete one.
      this.check()
    })
    collections.onChange((e) => e.kind === 'completed' && this.bump('sets'))
    taxes.onChange((e) => e.kind === 'taxDay' && this.bump('returns'))
    world.player.onChange((e) => e.kind === 'levelUp' && this.refresh())
    world.services.onChange(() => this.check())
    this.refresh()
  }

  onChange(listener: (event: QuestsEvent) => void) {
    this.listeners.push(listener)
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
    const value = task.stat ? this.stat(task.stat) - (this.active.get(quest.id)?.[task.stat] ?? 0) : task.have!(this.world)
    return Math.min(task.count, value)
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
    this.claimed.add(quest.id)
    const { coins = 0, xp = 0, materials = {} } = quest.reward
    // Quest rewards are prizes, so taxable, like the other rewards.
    this.world.city.awardCoins(coins, `Quest: ${quest.title}`)
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
    }
  }

  load(save: QuestsSave) {
    this.stats = { ...save.stats }
    this.active = new Map(save.active)
    this.claimed = new Set(save.claimed)
    this.tiers = new Map(save.tiers)
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

  // Announce quests that have just become ready to claim.
  private check() {
    for (const q of this.activeQuests()) {
      if (!this.announced.has(q.id) && this.isDone(q)) {
        this.announced.add(q.id)
        this.emit({ kind: 'questDone', quest: q })
      }
    }
    this.emit({ kind: 'changed' })
  }

  private emit(event: QuestsEvent) {
    for (const listener of this.listeners) listener(event)
  }
}
