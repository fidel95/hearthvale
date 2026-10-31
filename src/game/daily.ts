import { Emitter } from './events'
import type { City } from './City'
import type { Player } from './Player'

// A gift for coming back each day, on a 7-day calendar that grows toward a
// big gift on day 7, then starts again. It's gentle: missing a day doesn't
// lose your place, you just carry on from the next day of the calendar.

export const DAILY_DAYS = 7

export interface DailyGift {
  coins: number
  xp: number
  energy: number
}

// The gift on a day of the calendar (1 to 7), growing with the player's level.
export function dailyGift(day: number, level: number): DailyGift {
  const big = day === DAILY_DAYS
  return {
    coins: Math.round(level * 20 * day * (big ? 2 : 1)),
    xp: 5 * day + (big ? 25 : 0),
    energy: big ? 15 : day % 2 === 0 ? 3 : 0,
  }
}

// The local calendar day, like '2026-10-31'.
export function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export interface DailySave {
  lastDay: string | null // the day the last gift was collected
  day: number // the calendar day it was (1 to 7); 0 before the first
  visits: number // gifts collected in all
}

export class Daily {
  private lastDay: string | null = null
  private day = 0
  private _visits = 0
  private city: City
  private player: Player
  private events = new Emitter<void>()

  constructor(city: City, player: Player) {
    this.city = city
    this.player = player
  }

  onChange(listener: () => void) {
    this.events.on(listener)
  }

  get visits() {
    return this._visits
  }

  // Is today's gift still waiting?
  due(now: Date): boolean {
    return this.lastDay !== dayKey(now)
  }

  // The calendar day today's gift is on (1 to 7).
  get next(): number {
    return (this.day % DAILY_DAYS) + 1
  }

  // Days of this calendar already collected (before today's gift).
  get collected(): number {
    return this.day % DAILY_DAYS
  }

  // Collect today's gift. Returns it, or null if it was already collected today.
  claim(now: Date): DailyGift | null {
    if (!this.due(now)) return null
    const gift = dailyGift(this.next, this.player.level)
    this.day = this.next
    this.lastDay = dayKey(now)
    this._visits++
    this.city.economy.award(gift.coins, 'Daily gift')
    this.player.grantXp(gift.xp)
    if (gift.energy > 0) this.player.grantEnergy(gift.energy)
    this.events.emit()
    return gift
  }

  toSave(): DailySave {
    return { lastDay: this.lastDay, day: this.day, visits: this._visits }
  }

  load(save: DailySave) {
    this.lastDay = save.lastDay
    this.day = save.day
    this._visits = save.visits
    this.events.emit()
  }
}
