import { seededRandom } from './neighborData'
import type { StatId } from './quests'

// Town events: a festival each season of the real year, and three challenges
// each real week. Both follow the device's own calendar (no server: the game
// stays offline), and both count things you do while they run (quests.ts
// stats). TownEvents.ts keeps the progress; this file is the plain rules.

export const EVENTS_UNLOCK_LEVEL = 3

export interface Goal {
  label: string
  stat: StatId
  count: number
}

export interface Reward {
  coins: number
  xp: number
  energy?: number
}

export type FestivalId = 'spring' | 'summer' | 'fall' | 'winter'

export interface Festival {
  id: FestivalId
  name: string
  icon: string
  intro: string
  goals: Goal[]
  goalReward: Reward
  prize: string // the building type id of the decoration won by finishing every goal
}

export const FESTIVALS: Record<FestivalId, Festival> = {
  spring: {
    id: 'spring',
    name: 'Blossom Festival',
    icon: '🌸',
    intro: 'Spring is here! Plant, build and get the town ready for the blossom.',
    goals: [
      { label: 'Plant crops', stat: 'plantings', count: 40 },
      { label: 'Finish constructions', stat: 'finished', count: 5 },
      { label: 'Collect rent', stat: 'rent', count: 50 },
    ],
    goalReward: { coins: 150, xp: 20 },
    prize: 'blossom-arch',
  },
  summer: {
    id: 'summer',
    name: 'Summer Fair',
    icon: '☀️',
    intro: 'Long days and busy shops: keep the fair going all summer.',
    goals: [
      { label: 'Make shop sales', stat: 'sales', count: 40 },
      { label: 'Collect rent', stat: 'rent', count: 50 },
      { label: 'Earn coins from rent and sales', stat: 'earned', count: 2500 },
    ],
    goalReward: { coins: 150, xp: 20 },
    prize: 'ice-cream-cart',
  },
  fall: {
    id: 'fall',
    name: 'Harvest Fair',
    icon: '🎃',
    intro: "The harvest is in! Fill the barns and the shelves for the fair.",
    goals: [
      { label: 'Harvest crops', stat: 'harvests', count: 30 },
      { label: 'Restock shops', stat: 'restocks', count: 15 },
      { label: 'Collect rent', stat: 'rent', count: 50 },
    ],
    goalReward: { coins: 150, xp: 20 },
    prize: 'pumpkin-patch',
  },
  winter: {
    id: 'winter',
    name: 'Winter Lights',
    icon: '❄️',
    intro: 'Light up the town for the long nights: keep everyone warm and busy.',
    goals: [
      { label: 'Collect rent', stat: 'rent', count: 60 },
      { label: 'Make shop sales', stat: 'sales', count: 30 },
      { label: 'Build something new', stat: 'built', count: 8 },
    ],
    goalReward: { coins: 150, xp: 20 },
    prize: 'festive-fir',
  },
}

// Which festival is on, from the real date (months 0-11): northern seasons,
// March to May is spring, and so on. Winter runs December to February.
export function festivalAt(now: number): { festival: Festival; key: string; endsAt: number } {
  const d = new Date(now)
  const month = d.getMonth()
  const year = d.getFullYear()
  const id: FestivalId = month === 11 || month <= 1 ? 'winter' : month <= 4 ? 'spring' : month <= 7 ? 'summer' : 'fall'
  // Winter belongs to the year it starts in (December).
  const startYear = id === 'winter' && month <= 1 ? year - 1 : year
  const startMonth = { spring: 2, summer: 5, fall: 8, winter: 11 }[id]
  const endsAt = new Date(startYear, startMonth + 3, 1).getTime()
  return { festival: FESTIVALS[id], key: `${id}-${startYear}`, endsAt }
}

// ---- Weekly challenges

// The pool challenges are drawn from. The goal grows with your level.
const CHALLENGES: { label: string; stat: StatId; count: (level: number) => number }[] = [
  { label: 'Collect rent', stat: 'rent', count: (l) => 15 + l * 2 },
  { label: 'Make shop sales', stat: 'sales', count: (l) => 10 + l * 2 },
  { label: 'Harvest crops', stat: 'harvests', count: (l) => 8 + l },
  { label: 'Plant crops', stat: 'plantings', count: (l) => 8 + l },
  { label: 'Restock shops', stat: 'restocks', count: (l) => 4 + Math.floor(l / 2) },
  { label: 'Build something new', stat: 'built', count: (l) => 3 + Math.floor(l / 3) },
  { label: 'Earn coins from rent and sales', stat: 'earned', count: (l) => 400 + l * 100 },
]

// A week runs Monday to Sunday, by the device's calendar.
export function weekAt(now: number): { key: string; endsAt: number } {
  const d = new Date(now)
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7))
  const key = `${monday.getFullYear()}-${monday.getMonth() + 1}-${monday.getDate()}`
  return { key, endsAt: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7).getTime() }
}

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

// This week's three challenges: the same for the whole week, sized for the
// level you were when the week began.
export function weeklyChallenges(weekKey: string, level: number): Goal[] {
  const rand = seededRandom(hash(weekKey))
  const pool = [...CHALLENGES]
  const picked: Goal[] = []
  while (picked.length < 3) {
    const [c] = pool.splice(Math.floor(rand() * pool.length), 1)
    picked.push({ label: c.label, stat: c.stat, count: c.count(level) })
  }
  return picked
}

export function challengeReward(level: number): Reward {
  return { coins: 50 + level * 10, xp: 10 }
}

// For finishing all three in a week.
export function weekBonus(level: number): Reward {
  return { coins: 150 + level * 25, xp: 30, energy: 10 }
}
