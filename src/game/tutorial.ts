import type { City, CityEvent } from './City'

// A short guided start for a brand-new town: each step asks for one thing,
// and is done when the game sees you do it. It can be skipped at any time,
// and its progress is saved, so it never repeats.

export interface TutorialStep {
  id: string
  text: string
  // Done when this City event happens, or (for UI steps) when the UI reports the step's id.
  doneWhen?: (e: CityEvent) => boolean
}

export const TUTORIAL: TutorialStep[] = [
  {
    id: 'collect',
    text: '👋 Welcome to Hearthvale! Tap the 🪙 over your Cottage to collect the rent.',
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
    id: 'build',
    text: 'Tap 🔨 Build, choose a Cottage, tap the map, then ✓ to buy it.',
    doneWhen: (e) => e.kind === 'added' && e.paid > 0 && e.building.type.category === 'home',
  },
  {
    id: 'quests',
    text: 'Tap 📜 Quests to see your goals and their rewards.',
  },
  {
    id: 'done',
    text: "That's the basics! Tap 🪙 in the top bar for your taxes and 👥 for town services. Enjoy your town.",
  },
]

export interface TutorialSave {
  step: number // index into TUTORIAL; TUTORIAL.length when finished
  skipped: boolean
}

export class Tutorial {
  step = 0
  skipped = false
  private listeners: (() => void)[] = []

  constructor(city: City) {
    city.onChange((e) => {
      if (this.current?.doneWhen?.(e)) this.advance()
    })
  }

  onChange(listener: () => void) {
    this.listeners.push(listener)
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
    this.emit()
  }

  private emit() {
    for (const listener of this.listeners) listener()
  }
}
