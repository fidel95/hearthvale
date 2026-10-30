import { BUILDINGS_BY_ID } from './buildings'
import type { City } from './City'
import {
  EVENTS_UNLOCK_LEVEL,
  FESTIVALS,
  challengeReward,
  festivalAt,
  weekAt,
  weekBonus,
  weeklyChallenges,
  type Festival,
  type FestivalId,
  type Goal,
  type Reward,
} from './eventData'
import { Emitter } from './events'
import type { Player } from './Player'
import type { Quests, StatId } from './quests'

// The festival that's on and this week's challenges: what's been counted
// toward them, and what's been claimed. Progress is a stat's value now minus
// its value when the festival (or week) began for this town. The rules and
// data are in eventData.ts.

interface Period {
  key: string // which festival or week this is
  start: Partial<Record<StatId, number>> // the stats when it began
  goals: Goal[] // fixed when it began
  claimed: number[] // goals whose reward was claimed
  bonus: boolean // the festival prize, or the week's bonus, was claimed
}

export interface TownEventsSave {
  festival: Period | null
  week: Period | null
}

export type TownEventsEvent = { kind: 'changed' } | { kind: 'goalDone'; label: string; where: string } | { kind: 'prize'; name: string }

export type Which = 'festival' | 'week'

export class TownEvents {
  private city: City
  private player: Player
  private quests: Quests
  private festivalPeriod: Period | null = null
  private weekPeriod: Period | null = null
  private announced = new Set<string>()
  private events = new Emitter<TownEventsEvent>()

  constructor(city: City, player: Player, quests: Quests) {
    this.city = city
    this.player = player
    this.quests = quests
    quests.onChange(() => this.check())
    player.onChange((e) => e.kind === 'levelUp' && this.refresh())
  }

  onChange(listener: (event: TownEventsEvent) => void) {
    this.events.on(listener)
  }

  get unlocked(): boolean {
    return this.player.level >= EVENTS_UNLOCK_LEVEL
  }

  // Start a new festival or week when the calendar has moved on. Game calls
  // this now and then (and on load); it's cheap.
  refresh(now = Date.now()) {
    if (!this.unlocked) return
    let changed = false
    const { festival, key } = festivalAt(now)
    if (this.festivalPeriod?.key !== key) {
      this.festivalPeriod = this.begin(key, festival.goals)
      changed = true
    }
    const week = weekAt(now)
    if (this.weekPeriod?.key !== week.key) {
      this.weekPeriod = this.begin(week.key, weeklyChallenges(week.key, this.player.level))
      changed = true
    }
    if (changed) {
      this.announced = new Set(this.doneGoals())
      this.events.emit({ kind: 'changed' })
    }
  }

  // ---- Reading

  festival(now = Date.now()): (ReturnType<typeof festivalAt> & { period: Period }) | null {
    const on = festivalAt(now)
    return this.festivalPeriod?.key === on.key ? { ...on, period: this.festivalPeriod } : null
  }

  week(now = Date.now()): (ReturnType<typeof weekAt> & { period: Period }) | null {
    const on = weekAt(now)
    return this.weekPeriod?.key === on.key ? { ...on, period: this.weekPeriod } : null
  }

  progress(which: Which, index: number): number {
    const period = this.period(which)
    const goal = period?.goals[index]
    if (!period || !goal) return 0
    return Math.min(goal.count, this.quests.stat(goal.stat) - (period.start[goal.stat] ?? 0))
  }

  isDone(which: Which, index: number): boolean {
    const goal = this.period(which)?.goals[index]
    return !!goal && this.progress(which, index) >= goal.count
  }

  rewardFor(which: Which): Reward {
    return which === 'festival' ? this.currentFestival().goalReward : challengeReward(this.player.level)
  }

  // Every goal claimed: the festival prize or the week's bonus can be claimed.
  bonusReady(which: Which): boolean {
    const period = this.period(which)
    return !!period && !period.bonus && period.claimed.length === period.goals.length
  }

  // How many rewards are waiting to be claimed (for the badge on Quests).
  readyCount(): number {
    let n = 0
    for (const which of ['festival', 'week'] as const) {
      const period = this.period(which)
      if (!period) continue
      n += period.goals.filter((_, i) => !period.claimed.includes(i) && this.isDone(which, i)).length
      if (this.bonusReady(which)) n++
    }
    return n
  }

  // ---- Claiming

  claim(which: Which, index: number): boolean {
    const period = this.period(which)
    if (!period || period.claimed.includes(index) || !this.isDone(which, index)) return false
    period.claimed.push(index)
    const where = which === 'festival' ? this.currentFestival().name : 'Weekly challenge'
    this.pay(this.rewardFor(which), `${where}: ${period.goals[index].label}`)
    this.events.emit({ kind: 'changed' })
    return true
  }

  // The festival prize arrives in storage; the week's bonus is coins, XP and energy.
  claimBonus(which: Which): boolean {
    const period = this.period(which)
    if (!period || !this.bonusReady(which)) return false
    period.bonus = true
    if (which === 'festival') {
      const type = BUILDINGS_BY_ID.get(this.currentFestival().prize)!
      this.city.gift(type)
      this.events.emit({ kind: 'prize', name: type.name })
    } else {
      this.pay(weekBonus(this.player.level), 'Weekly challenges: all three done')
    }
    this.events.emit({ kind: 'changed' })
    return true
  }

  // ---- Saving

  toSave(): TownEventsSave {
    return { festival: this.festivalPeriod, week: this.weekPeriod }
  }

  load(save: TownEventsSave | undefined) {
    this.festivalPeriod = save?.festival ?? null
    this.weekPeriod = save?.week ?? null
    this.announced = new Set(this.doneGoals())
  }

  // ---- Inside

  private period(which: Which): Period | null {
    return which === 'festival' ? this.festivalPeriod : this.weekPeriod
  }

  // The festival being tracked (its key starts with its id, e.g. 'fall-2026').
  private currentFestival(): Festival {
    const id = this.festivalPeriod?.key.split('-')[0] as FestivalId | undefined
    return (id && FESTIVALS[id]) || festivalAt(Date.now()).festival
  }

  private begin(key: string, goals: Goal[]): Period {
    const start: Partial<Record<StatId, number>> = {}
    for (const g of goals) start[g.stat] = this.quests.stat(g.stat)
    return { key, start, goals, claimed: [], bonus: false }
  }

  private doneGoals(): string[] {
    const done: string[] = []
    for (const which of ['festival', 'week'] as const) {
      const period = this.period(which)
      period?.goals.forEach((_, i) => this.isDone(which, i) && done.push(`${period.key}/${i}`))
    }
    return done
  }

  // Tell the player when a goal is newly done.
  private check() {
    if (!this.unlocked) return
    for (const which of ['festival', 'week'] as const) {
      const period = this.period(which)
      if (!period) continue
      period.goals.forEach((goal, i) => {
        const id = `${period.key}/${i}`
        if (this.announced.has(id) || !this.isDone(which, i)) return
        this.announced.add(id)
        this.events.emit({ kind: 'goalDone', label: goal.label, where: which === 'festival' ? this.currentFestival().name : 'Weekly challenge' })
      })
    }
  }

  private pay(reward: Reward, reason: string) {
    if (reward.coins) this.city.economy.award(reward.coins, reason)
    if (reward.xp) this.player.grantXp(reward.xp)
    if (reward.energy) this.player.grantEnergy(reward.energy)
  }
}
