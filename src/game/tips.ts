import { Emitter } from './events'
import type { GameState } from './GameState'
import { APARTMENT_SIZE } from './needs'

// One-time tips about the game's newer systems, each shown when it first
// matters (after the tutorial). For a town that's been going a while they
// double as a "what's new" tour, one card at a time. They can be turned off
// in Settings, and the ones you've read are saved.

export interface Tip {
  id: string
  text: string
  ready: (s: GameState) => boolean
}

export const TIPS: Tip[] = [
  {
    id: 'happiness',
    text: '😊 Homes are happier with a shop and some green space nearby, and happy homes pay up to 15% more rent. Tap 👥 to see what your residents want.',
    ready: (s) => s.player.level >= 2 && s.services.wishes().length > 0,
  },
  {
    id: 'finances',
    text: '📊 Tap your 🪙 coins for the financial report: profit month by month, where the money comes from, and your top earners.',
    ready: (s) => s.player.level >= 3 && s.clock.monthIndex >= 1,
  },
  {
    id: 'events',
    text: '🎉 Events are open! Each season has a festival with a prize you can only win there, and there are new challenges every Monday. Look in 📜 Quests → Events.',
    ready: (s) => s.townEvents.unlocked,
  },
  {
    id: 'tourism',
    text: '🧳 Visitors come by bus, boat, train or plane to your parks, beach and landmarks, and each spends 🪙 2 a month. Tap 👥 to see whether to build more transport or more attractions.',
    ready: (s) => s.tourism.report().arrivals > 0 || s.tourism.report().room > 0,
  },
  {
    id: 'factories',
    text: '🏭 Factories are unlocked: a Cannery turns goods into 🫙 preserves for a Deli, which sells them for more. Find them in Build → Industry.',
    ready: (s) => s.player.level >= 12,
  },
  {
    id: 'apartments',
    text: '🏢 Apartment buildings want a 🏥 hospital and a 👮 police station nearby, as well as shops, a park and a school. Tap one to see what it\'s missing.',
    ready: (s) => [...s.city.all()].some((b) => (b.type.residents ?? 0) >= APARTMENT_SIZE),
  },
]

export class Tips {
  private seen = new Set<string>()
  private state: GameState
  private events = new Emitter<void>()

  constructor(state: GameState) {
    this.state = state
  }

  onChange(listener: () => void) {
    this.events.on(listener)
  }

  // The tip to show now, if any: never during the tutorial, or with tips off.
  current(): Tip | null {
    if (!this.state.settings.values.tips || this.state.tutorial.current) return null
    return TIPS.find((t) => !this.seen.has(t.id) && t.ready(this.state)) ?? null
  }

  dismiss(id: string) {
    if (this.seen.has(id)) return
    this.seen.add(id)
    this.events.emit()
  }

  toSave(): string[] {
    return [...this.seen]
  }

  load(saved: string[] | undefined) {
    this.seen = new Set(saved ?? [])
  }
}
