import { Emitter } from './events'
import type { City, CityEvent } from './City'

// A short guided start for a brand-new town: each step asks for one thing,
// and is done when the game sees you do it. It can be skipped at any time,
// and its progress is saved, so it never repeats.

export interface TutorialStep {
  id: string
  text: string
  // Done when this City event happens, or (for UI steps) when the UI reports the step's id.
  doneWhen?: (e: CityEvent) => boolean
  // Already done some other way? Then it's skipped, so the tutorial never
  // holds you back for doing things in your own order.
  alreadyDone?: (city: City) => boolean
  // Steps that only explain something have a "Got it" button.
  info?: boolean
}

const count = (city: City, test: (category: string) => boolean) => [...city.all()].filter((b) => test(b.type.category)).length

export const TUTORIAL: TutorialStep[] = [
  {
    id: 'camera',
    text: '👋 Welcome to Hearthvale! Drag to look around, and scroll or pinch to zoom. (Arrow keys and + / − work too.)',
  },
  {
    id: 'collect',
    text: 'Tap the 🪙 over your Cottage to collect the rent.',
    doneWhen: (e) => e.kind === 'collected',
  },
  {
    id: 'harvest',
    text: 'Your strawberries are almost ripe. When the 🍓 bubble appears, tap it to harvest.',
    doneWhen: (e) => e.kind === 'harvested',
  },
  {
    id: 'plant',
    text: 'Tap the empty plot (🌱) and plant some more seeds.',
    doneWhen: (e) => e.kind === 'planted' && e.cost > 0,
  },
  {
    id: 'select',
    text: 'Tap a building when it has nothing to collect: a menu opens with Details, Move, Turn and more.',
  },
  {
    id: 'build',
    text: 'Tap 🔨 Build and choose a Cottage. Drag it where you like, then tap ✓ to buy it.',
    doneWhen: (e) => e.kind === 'added' && e.paid > 0 && e.building.type.category === 'home',
    alreadyDone: (city) => count(city, (c) => c === 'home') >= 2,
  },
  {
    id: 'quests',
    text: 'Tap 📜 Quests to see your goals and their rewards.',
  },
  {
    id: 'land',
    text: '🏷️ Signs around your town mark land for sale. From level 8 you can buy the lots next door, for coins and materials.',
    info: true,
  },
  {
    id: 'done',
    text: "That's the basics! Tap 🪙 in the top bar for your taxes and 👥 for town services. ❓ has help any time. Enjoy your town.",
    info: true,
  },
]

export interface TutorialSave {
  step: number // index into TUTORIAL; TUTORIAL.length when finished
  skipped: boolean
}

export class Tutorial {
  step = 0
  skipped = false
  private events = new Emitter<void>()

  private city: City

  constructor(city: City) {
    this.city = city
    city.onChange((e) => {
      if (this.current?.doneWhen?.(e)) this.advance()
    })
  }

  onChange(listener: () => void) {
    this.events.on(listener)
  }

  get current(): TutorialStep | null {
    return this.skipped || this.step >= TUTORIAL.length ? null : TUTORIAL[this.step]
  }

  // For steps the UI completes (opening a screen, pressing "Got it").
  complete(id: string) {
    if (this.current?.id === id) this.advance()
  }

  skip() {
    this.skipped = true
    this.emit()
  }

  toSave(): TutorialSave {
    return { step: this.step, skipped: this.skipped }
  }

  load(save: TutorialSave) {
    this.step = save.step
    this.skipped = save.skipped
    this.emit()
  }

  private advance() {
    this.step++
    while (this.current?.alreadyDone?.(this.city)) this.step++
    this.emit()
  }

  private emit() {
    this.events.emit(undefined)
  }
}
