import type { SettingsStore } from '../game/settings'
import type { Tips } from '../game/tips'
import { el } from './dom'

// A tip about a newer feature (tips.ts), in the tutorial card's spot and
// style: one at a time, with "Got it" and a way to turn tips off.
export class TipCard {
  private card = el('div', 'coach tip-card')
  private text = el('p', '')

  constructor(container: HTMLElement, tips: Tips, settings: SettingsStore) {
    const off = el('button', 'coach-skip', 'Turn off tips')
    const ok = el('button', 'panel-button', 'Got it')
    const buttons = el('div', 'coach-buttons')
    buttons.append(off, ok)
    this.card.append(this.text, buttons)
    this.card.hidden = true
    container.append(this.card)
    let shown: string | null = null
    const show = () => {
      const tip = tips.current()
      shown = tip?.id ?? null
      this.card.hidden = !tip
      if (tip) this.text.textContent = tip.text
    }
    ok.addEventListener('click', () => shown && tips.dismiss(shown))
    off.addEventListener('click', () => settings.set('tips', false))
    tips.onChange(show)
    settings.onChange(show)
    // Tips become ready as the town changes; checking now and then is enough.
    window.setInterval(show, 2000)
  }
}
