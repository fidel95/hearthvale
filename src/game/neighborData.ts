import { BUILDING_TYPES, type BuildingType, type Rotation } from './buildings'
import { CROP_TYPES } from './crops'
import type { Tile } from './grid'
import { MATERIAL_IDS, type MaterialId } from './items'

// The simulated neighbors: who they are, what their towns look like, and what
// they ask for and give each day. All plain data and pure functions, so every
// visit to a neighbor shows the same town (for their level) and the tests can
// check it. Neighbors.ts keeps the friendship and daily progress.

export interface Neighbor {
  id: string
  name: string
  avatar: string
  town: string
  greeting: string
  seed: number // their town is generated from this
  levelOffset: number // how far ahead of (or behind) you their town is
}

export const NEIGHBORS: Neighbor[] = [
  { id: 'rosa', name: 'Rosa', avatar: '👩‍🌾', town: 'Maple Hollow', greeting: 'Welcome! Mind the strawberries, they bruise easily.', seed: 11, levelOffset: 1 },
  { id: 'theo', name: 'Theo', avatar: '👨‍🍳', town: 'Brightwater', greeting: 'Hungry? The bakery opens when the shelves are full!', seed: 23, levelOffset: 0 },
  { id: 'amara', name: 'Amara', avatar: '👩‍🏫', town: 'Pinecrest', greeting: 'Hello neighbor! Our school just won a spelling bee.', seed: 37, levelOffset: 2 },
  { id: 'kenji', name: 'Kenji', avatar: '🧑‍🔧', town: 'Copperfield', greeting: 'Careful, the power plant is a little grumpy today.', seed: 41, levelOffset: -1 },
  { id: 'lucia', name: 'Lucía', avatar: '👩‍🎨', town: 'Sunnyvale Bay', greeting: 'Come see the fountain, I painted the tiles myself.', seed: 53, levelOffset: 1 },
]

export const NEIGHBORS_UNLOCK_LEVEL = 7
export const HELPS_PER_DAY = 5
export const HELP_REWARD = { coins: 10, xp: 2, friendship: 1 }

// Friendship grows with every help and fulfilled request; better friends send bigger gifts.
export const FRIENDSHIP_TIERS = [
  { points: 0, name: 'Acquaintance', gift: 1 },
  { points: 10, name: 'Friend', gift: 2 },
  { points: 30, name: 'Good friend', gift: 3 },
  { points: 60, name: 'Best friend', gift: 4 },
]

export function friendshipTier(points: number) {
  return [...FRIENDSHIP_TIERS].reverse().find((t) => points >= t.points)!
}

// Days are counted by the local calendar date, so "today" means today for the player.
export function dayKey(now: number): string {
  const d = new Date(now)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

// A small seeded random number generator (mulberry32): the same seed always
// gives the same sequence, which is what makes a neighbor's town repeatable.
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

// ---- Their town

export interface PlannedBuilding {
  type: BuildingType
  tile: Tile
  rotation: Rotation
  crop?: { cropId: string; secondsAgo: number } // planted this long ago
  readySecondsAgo?: number // for income: ready since this long ago (negative: not yet)
}

// A neighbor's town at a given level: a crossroads through the middle of the
// starting land, and buildings along it, more and bigger the higher the level.
// `day` varies what's ready to help with, not the town itself.
export function planTown(n: Neighbor, level: number, day: string): PlannedBuilding[] {
  const rand = seededRandom(n.seed)
  const daily = seededRandom(n.seed ^ hash(day))
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)]
  const plan: PlannedBuilding[] = []
  const road = BUILDING_TYPES.find((t) => t.category === 'road')!
  for (let i = 20; i < 40; i++) {
    plan.push({ type: road, tile: { x: i, z: 29 }, rotation: 0 })
    if (i !== 29) plan.push({ type: road, tile: { x: 29, z: i }, rotation: 0 })
  }

  const available = (category: string) =>
    BUILDING_TYPES.filter((t) => t.category === category && t.unlockLevel <= level && t.size.x <= 2 && t.size.z <= 2)
  const mix: [string, number][] = [
    ['home', 0.45],
    ['business', 0.15],
    ['farm', 0.15],
    ['decoration', 0.15],
    ['community', 0.1],
  ]
  const crops = CROP_TYPES.filter((c) => c.unlockLevel <= level)

  // Lots along the roads: 2×2 spots beside them, in each of the four quarters.
  const spots: Tile[] = []
  for (const x of [20, 22, 24, 26, 30, 32, 34, 36]) for (const z of [26, 30]) spots.push({ x, z })
  for (const z of [20, 22, 24, 32, 34, 36]) for (const x of [26, 30]) spots.push({ x, z })
  const count = Math.min(spots.length, 8 + level * 2)
  for (const tile of spots.slice(0, count)) {
    let roll = rand()
    let category = 'home'
    for (const [c, share] of mix) {
      if ((roll -= share) < 0) {
        category = c
        break
      }
    }
    const choices = available(category)
    const type = choices.length ? pick(choices) : available('home')[0]
    const p: PlannedBuilding = { type, tile, rotation: (Math.floor(rand() * 4) as Rotation) }
    if (type.category === 'farm' && crops.length) {
      const crop = pick(crops)
      // Today's state: some just planted, some ripe, a few withered.
      const age = daily() * (crop.growSeconds + crop.freshSeconds * 1.2)
      p.crop = { cropId: crop.id, secondsAgo: age }
    }
    if (type.income) p.readySecondsAgo = (daily() - 0.4) * type.income.seconds * 3
    plan.push(p)
  }
  return plan
}

// ---- Daily gifts and requests

// What a neighbor gives you today: a material, scaled by friendship.
export function dailyGift(n: Neighbor, day: string, friendship: number): { material: MaterialId; amount: number } {
  const rand = seededRandom(n.seed * 31 + hash(day))
  const material = MATERIAL_IDS[Math.floor(rand() * MATERIAL_IDS.length)]
  return { material, amount: 2 * friendshipTier(friendship).gift }
}

// What a neighbor asks you for today.
export function dailyRequest(n: Neighbor, day: string): { material: MaterialId; amount: number } {
  const rand = seededRandom(n.seed * 17 + hash(day) + 1)
  return { material: MATERIAL_IDS[Math.floor(rand() * MATERIAL_IDS.length)], amount: 2 + Math.floor(rand() * 3) }
}
