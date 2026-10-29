import type { City } from './City'
import { Emitter } from './events'

// The army's one job in town that matters to the books: holding a parade.
// For a fee (a deductible expense), the base's squad marches through town and
// every home and shop earns a little more while the crowds are out. Then the
// troops need a rest before the next one. Needs an Army Base with a road.

export const PARADE = {
  cost: 300,
  bonus: 0.1, // +10% to all rent and sales while it lasts
  durationMs: 3 * 60_000,
  cooldownMs: 10 * 60_000, // from the start of one parade to the next
}

export type ParadeCheck = { ok: true } | { ok: false; reason: 'no-base' | 'resting' | 'coins'; waitMs?: number }

export interface ArmySave {
  lastParadeAt: number | null
}

export class Army {
  private city: City
  private lastParadeAt: number | null = null
  private events = new Emitter<{ kind: 'parade'; until: number }>()

  constructor(city: City) {
    this.city = city
  }

  onChange(listener: (event: { kind: 'parade'; until: number }) => void) {
    this.events.on(listener)
  }

  // When the current parade ends, or null if none is on.
  paradeUntil(now: number): number | null {
    if (this.lastParadeAt === null) return null
    const until = this.lastParadeAt + PARADE.durationMs
    return now < until ? until : null
  }

  // The town-wide bonus from a parade going on right now.
  bonus(now: number): number {
    return this.paradeUntil(now) !== null ? PARADE.bonus : 0
  }

  canHoldParade(now: number): ParadeCheck {
    const base = [...this.city.all()].some((b) => b.type.id === 'army-base' && this.city.isOperating(b))
    if (!base) return { ok: false, reason: 'no-base' }
    if (this.lastParadeAt !== null && now - this.lastParadeAt < PARADE.cooldownMs) {
      return { ok: false, reason: 'resting', waitMs: PARADE.cooldownMs - (now - this.lastParadeAt) }
    }
    if (!this.city.economy.canAfford(PARADE.cost)) return { ok: false, reason: 'coins' }
    return { ok: true }
  }

  holdParade(now: number): ParadeCheck {
    const check = this.canHoldParade(now)
    if (!check.ok) return check
    this.city.economy.expense(PARADE.cost, 'Army parade')
    this.lastParadeAt = now
    this.events.emit({ kind: 'parade', until: now + PARADE.durationMs })
    return check
  }

  toSave(): ArmySave {
    return { lastParadeAt: this.lastParadeAt }
  }

  load(save: ArmySave | undefined) {
    this.lastParadeAt = save?.lastParadeAt ?? null
  }
}
