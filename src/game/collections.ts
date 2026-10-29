import type { City, CityEvent } from './City'
import type { Inventory } from './Inventory'
import type { ItemType } from './items'
import type { Player } from './Player'

// Collections: sets of five collectible items that turn up now and then while
// you play (each kind of activity has its own set). Hand in a full set for a
// reward; sets can be completed again and again.

export interface Collection {
  id: string
  name: string
  // Where its items turn up.
  source: string
  items: ItemType[]
  reward: { coins: number; xp: number; energy: number }
}

const item = (id: string, name: string, icon: string): ItemType => ({ id, name, icon })

export const COLLECTIONS: Collection[] = [
  {
    id: 'home',
    name: 'Home Sweet Home',
    source: 'Collecting rent from homes',
    items: [
      item('teddy-bear', 'Teddy Bear', '🧸'),
      item('candle', 'Candle', '🕯️'),
      item('picture-frame', 'Picture Frame', '🖼️'),
      item('houseplant', 'Houseplant', '🪴'),
      item('house-key', 'House Key', '🔑'),
    ],
    reward: { coins: 300, xp: 25, energy: 5 },
  },
  {
    id: 'shop',
    name: "Baker's Dozen",
    source: 'Sales at shops',
    items: [
      item('croissant', 'Croissant', '🥐'),
      item('baguette', 'Baguette', '🥖'),
      item('cupcake', 'Cupcake', '🧁'),
      item('pie', 'Pie', '🥧'),
      item('pretzel', 'Pretzel', '🥨'),
    ],
    reward: { coins: 400, xp: 30, energy: 5 },
  },
  {
    id: 'farm',
    name: 'Country Fair',
    source: 'Harvesting crops',
    items: [
      item('basket', 'Basket', '🧺'),
      item('straw-hat', 'Straw Hat', '👒'),
      item('bucket', 'Bucket', '🪣'),
      item('honeybee', 'Honeybee', '🐝'),
      item('honey-jar', 'Honey Jar', '🍯'),
    ],
    reward: { coins: 350, xp: 30, energy: 5 },
  },
  {
    id: 'sea',
    name: 'Seafarer',
    source: 'Unloading ships at a dock',
    items: [
      item('shell', 'Seashell', '🐚'),
      item('anchor', 'Anchor', '⚓'),
      item('compass', 'Compass', '🧭'),
      item('coral', 'Coral', '🪸'),
      item('crab', 'Crab', '🦀'),
    ],
    reward: { coins: 600, xp: 50, energy: 10 },
  },
  {
    id: 'town',
    name: 'Town Pride',
    source: 'Finishing construction',
    items: [
      item('medal', 'Medal', '🏅'),
      item('newspaper', 'Newspaper', '📰'),
      item('ticket', 'Ticket', '🎟️'),
      item('trumpet', 'Trumpet', '🎺'),
      item('old-key', 'Old Key', '🗝️'),
    ],
    reward: { coins: 800, xp: 60, energy: 10 },
  },
]

export const COLLECTIBLES_BY_ID = new Map(COLLECTIONS.flatMap((c) => c.items.map((i) => [i.id, i])))

// How likely each activity is to turn up an item.
const DROP_CHANCE: Record<string, number> = { home: 0.1, shop: 0.12, farm: 0.15, sea: 0.5, town: 0.6 }

// Which collection an activity on the map feeds, if any.
function sourceOf(event: CityEvent): string | null {
  switch (event.kind) {
    case 'collected':
      return event.building.type.category === 'home' ? 'home' : event.building.type.category === 'business' ? 'shop' : null
    case 'harvested':
      return 'farm'
    case 'goodsIn':
      return 'sea'
    case 'finished':
      return 'town'
    default:
      return null
  }
}

export type CollectionsEvent =
  | { kind: 'found'; item: ItemType; event: CityEvent }
  | { kind: 'completed'; collection: Collection; times: number }

export class Collections {
  private completed = new Map<string, number>()
  private city: City
  private inventory: Inventory
  private player: Player
  private random: () => number
  private listeners: ((event: CollectionsEvent) => void)[] = []

  // random is injectable so tests can decide what drops.
  constructor(city: City, inventory: Inventory, player: Player, random: () => number = Math.random) {
    this.city = city
    this.inventory = inventory
    this.player = player
    this.random = random
    city.onChange((event) => {
      const source = sourceOf(event)
      if (!source || this.random() >= DROP_CHANCE[source]) return
      const collection = COLLECTIONS.find((c) => c.id === source)!
      // Pick the item you have fewest of, so sets fill up rather than piling up duplicates.
      const fewest = Math.min(...collection.items.map((i) => inventory.count(i.id)))
      const choices = collection.items.filter((i) => inventory.count(i.id) === fewest)
      const found = choices[Math.floor(this.random() * choices.length)]
      inventory.add(found.id, 1)
      this.emit({ kind: 'found', item: found, event })
    })
  }

  onChange(listener: (event: CollectionsEvent) => void) {
    this.listeners.push(listener)
  }

  timesCompleted(id: string): number {
    return this.completed.get(id) ?? 0
  }

  isComplete(collection: Collection): boolean {
    return collection.items.every((i) => this.inventory.count(i.id) > 0)
  }

  // Hand in one of each item for the reward. The coins are a prize, so
  // they're taxable income, like level-up rewards.
  complete(collection: Collection): boolean {
    if (!this.isComplete(collection)) return false
    for (const i of collection.items) this.inventory.remove(i.id, 1)
    const times = this.timesCompleted(collection.id) + 1
    this.completed.set(collection.id, times)
    const { coins, xp, energy } = collection.reward
    this.city.awardCoins(coins, `${collection.name} collection`)
    this.player.grantXp(xp)
    this.player.grantEnergy(energy)
    this.emit({ kind: 'completed', collection, times })
    return true
  }

  toSave(): [string, number][] {
    return [...this.completed.entries()]
  }

  load(saved: [string, number][]) {
    this.completed = new Map(saved)
  }

  private emit(event: CollectionsEvent) {
    for (const listener of this.listeners) listener(event)
  }
}
