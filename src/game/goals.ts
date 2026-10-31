import { Emitter } from './events'
import { BUILDING_TYPES, type BuildingType } from './buildings'
import { CROP_TYPES, type CropType } from './crops'
import type { City } from './City'
import type { Player } from './Player'
import type { Quests } from './quests'
import type { Services } from './Services'

// Long-term goals that never run out, for after the quests and unlocks are
// done (quests end around level 17):
//
// - Mastery: every building that earns and every crop has three stars, for
//   collecting from it (or harvesting it) enough times. Each star pays coins
//   and XP. Slower buildings need fewer collections for the same star.
// - Milestones: population and lifetime earnings, on an endless 1-2-3-5
//   ladder (10, 20, 30, 50, 100, …). Population also names the town: a Hamlet
//   grows into a Village, a Town, a City…
//
// Both are paid as they're reached, with a toast; the Goals tab in Quests
// shows what's next.

// ---- Mastery

export const MASTERY_XP = [10, 25, 60] as const
const MASTERY_COUNTS = [10, 40, 120]
const MASTERY_COINS = [5, 15, 40] // times one collection's coins

export interface Mastery {
  key: string // 'b:cottage' or 'c:wheat'
  name: string
  icon: string // an emoji, or '' for a building (shown with its thumbnail)
  building?: BuildingType
  goals: number[] // collections for each of the three stars
  coins: number[] // the reward for each star
}

// Slower buildings and crops need fewer collections: a 30-second Cottage
// needs 10/40/120, a 5-minute Coal Mine 3/12/36.
function counts(seconds: number): number[] {
  const scale = Math.max(0.25, Math.min(1, 90 / seconds))
  return MASTERY_COUNTS.map((n) => Math.max(2, Math.round(n * scale)))
}

export const MASTERIES: Mastery[] = [
  ...BUILDING_TYPES.filter((b) => b.income && b.income.coins > 0).map(
    (b): Mastery => ({
      key: `b:${b.id}`,
      name: b.name,
      icon: '',
      building: b,
      goals: counts(b.income!.seconds),
      coins: MASTERY_COINS.map((m) => m * b.income!.coins),
    }),
  ),
  ...CROP_TYPES.map(
    (c: CropType): Mastery => ({
      key: `c:${c.id}`,
      name: c.name,
      icon: c.emoji,
      goals: counts(c.growSeconds),
      coins: MASTERY_COINS.map((m) => m * c.sellPrice),
    }),
  ),
]
const MASTERY_BY_KEY = new Map(MASTERIES.map((m) => [m.key, m]))

// ---- Milestones

// The i-th step of an endless 1-2-3-5 ladder: 1, 2, 3, 5, 10, 20, 30, 50, 100, …
export function ladder(i: number): number {
  return [1, 2, 3, 5][i % 4] * 10 ** Math.floor(i / 4)
}

export interface MilestoneKind {
  id: 'population' | 'earned'
  label: string
  icon: string
  base: number // the first goal; then the ladder
}

export const MILESTONES: MilestoneKind[] = [
  { id: 'population', label: 'Population', icon: '👥', base: 10 },
  { id: 'earned', label: 'Coins earned', icon: '💰', base: 1000 },
]

export function milestoneGoal(kind: MilestoneKind, step: number): number {
  return kind.base * ladder(step)
}

// The reward for a milestone grows with each step.
export function milestoneReward(step: number): { coins: number; xp: number } {
  return { coins: 50 * (step + 1), xp: 15 + 10 * step }
}

// What the town is called at each population.
export const TOWN_TITLES: [number, string][] = [
  [0, 'Hamlet'],
  [30, 'Village'],
  [100, 'Town'],
  [300, 'Large Town'],
  [1000, 'City'],
  [3000, 'Big City'],
  [10000, 'Metropolis'],
]

export function townTitle(population: number): string {
  let title = TOWN_TITLES[0][1]
  for (const [from, name] of TOWN_TITLES) if (population >= from) title = name
  return title
}

// ---- Keeping track

export interface GoalsSave {
  counts: [string, number][] // mastery key and collections so far
  stars: [string, number][] // mastery key and stars earned
  steps: [string, number][] // milestone id and steps reached
}

export type GoalsEvent =
  | { kind: 'changed' }
  | { kind: 'mastery'; mastery: Mastery; stars: number; coins: number; xp: number }
  | { kind: 'milestone'; milestone: MilestoneKind; goal: number; coins: number; xp: number; title?: string } // title: the town's new name, if it changed

export class Goals {
  private counts = new Map<string, number>()
  private stars = new Map<string, number>()
  private steps = new Map<string, number>()
  private city: City
  private player: Player
  private services: Services
  private quests: Quests
  private events = new Emitter<GoalsEvent>()
  // Off while a save loads, so rebuilding the town doesn't pay milestones again.
  private paused = false

  constructor(city: City, player: Player, services: Services, quests: Quests) {
    this.city = city
    this.player = player
    this.services = services
    this.quests = quests
    city.onChange((e) => {
      if (e.kind === 'collected') {
        this.count(`b:${e.building.type.id}`)
        this.checkMilestones()
      }
      if (e.kind === 'harvested') this.count(`c:${e.crop.id}`)
    })
    services.onChange(() => this.checkMilestones())
  }

  onChange(listener: (event: GoalsEvent) => void) {
    this.events.on(listener)
  }

  countOf(m: Mastery): number {
    return this.counts.get(m.key) ?? 0
  }

  starsOf(m: Mastery): number {
    return this.stars.get(m.key) ?? 0
  }

  // A crop's stars, for its harvest bonus (crops.ts masteryBonus).
  cropStars(cropId: string): number {
    return this.stars.get(`c:${cropId}`) ?? 0
  }

  // A crop's stars, harvests so far, and the harvests the next star needs (null when mastered).
  cropMastery(cropId: string): { stars: number; count: number; next: number | null } {
    const m = MASTERY_BY_KEY.get(`c:${cropId}`)
    if (!m) return { stars: 0, count: 0, next: null }
    const stars = this.starsOf(m)
    return { stars, count: this.countOf(m), next: stars < 3 ? m.goals[stars] : null }
  }

  stepOf(kind: MilestoneKind): number {
    return this.steps.get(kind.id) ?? 0
  }

  value(kind: MilestoneKind): number {
    return kind.id === 'population' ? this.services.report.population : this.quests.stat('earned')
  }

  title(): string {
    return townTitle(this.services.report.population)
  }

  toSave(): GoalsSave {
    return { counts: [...this.counts], stars: [...this.stars], steps: [...this.steps] }
  }

  pause() {
    this.paused = true
  }

  load(save: GoalsSave) {
    this.paused = false
    this.counts = new Map(save.counts)
    this.stars = new Map(save.stars)
    this.steps = new Map(save.steps)
    this.emit({ kind: 'changed' })
  }

  // A town from before goals: count the milestones it has already passed as
  // reached, without paying them all at once.
  startFromTown() {
    this.paused = false
    for (const kind of MILESTONES) {
      let step = 0
      while (this.value(kind) >= milestoneGoal(kind, step)) step++
      this.steps.set(kind.id, step)
    }
    this.emit({ kind: 'changed' })
  }

  private count(key: string) {
    const m = MASTERY_BY_KEY.get(key)
    if (!m) return
    const n = this.countOf(m) + 1
    this.counts.set(key, n)
    const stars = this.starsOf(m)
    if (stars < 3 && n >= m.goals[stars]) {
      this.stars.set(key, stars + 1)
      const coins = m.coins[stars]
      const xp = MASTERY_XP[stars]
      this.city.economy.award(coins, `Mastery: ${m.name}`)
      this.player.grantXp(xp)
      this.emit({ kind: 'mastery', mastery: m, stars: stars + 1, coins, xp })
    }
    this.emit({ kind: 'changed' })
  }

  private checkMilestones() {
    if (this.paused) return
    for (const kind of MILESTONES) {
      // One step at a time, so a big jump still pays each step.
      let step = this.stepOf(kind)
      while (this.value(kind) >= milestoneGoal(kind, step)) {
        const goal = milestoneGoal(kind, step)
        const { coins, xp } = milestoneReward(step)
        step++
        this.steps.set(kind.id, step)
        this.city.economy.award(coins, `Milestone: ${kind.label} ${goal.toLocaleString()}`)
        this.player.grantXp(xp)
        // Every title starts on a step of the ladder.
        const title = kind.id === 'population' ? TOWN_TITLES.find(([from]) => from === goal)?.[1] : undefined
        this.emit({ kind: 'milestone', milestone: kind, goal, coins, xp, title })
      }
    }
  }

  private emit(event: GoalsEvent) {
    this.events.emit(event)
  }
}
