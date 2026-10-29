import type { Tutorial } from '../game/tutorial'
import { el } from './dom'

// The tutorial's card: one instruction at a time, just above the toolbar,
// with a way to skip the rest.
export class Coach {
  private card = el('div', 'coach')
  private text = el('p', '')
  private next = el('button', 'panel-button', 'Got it')

  constructor(container: HTMLElement, tutorial: Tutorial) {
    const skip = el('button', 'coach-skip', 'Skip tutorial')
    skip.addEventListener('click', () => tutorial.skip())
    this.next.addEventListener('click', () => tutorial.complete('done'))
    const buttons = el('div', 'coach-buttons')
    buttons.append(skip, this.next)
    this.card.append(this.text, buttons)
    container.append(this.card)
    const show = () => {
      const step = tutorial.current
      this.card.hidden = step === null
      if (!step) return
      this.text.textContent = step.text
      this.next.hidden = step.id !== 'done' // the last step has nothing to do but read
    }
    tutorial.onChange(show)
    show()
  }
}
