import { el } from './dom'

// The two kinds of window the game uses:
//
// - A Sheet slides up from the bottom (or in from the right on wide screens)
//   and leaves the city visible and moving above it. Menus and details use
//   it: the interface is built around the city, not on top of it. Only one is
//   open at a time; tapping the map closes it (Game wires that up).
// - A Modal is centered over a dimmed map, for moments that deserve full
//   attention: a level up, Tax Day, welcome back.
//
// Both have a title, a close button, a scrolling body and an optional footer
// for buttons, and both close with Escape.

export class Sheet {
  private static current: Sheet | null = null

  readonly body = el('div', 'sheet-body')
  readonly footer = el('div', 'sheet-footer')
  onClose?: () => void
  private root = el('section', 'sheet')
  private titleEl = el('h2', '')

  constructor(container: HTMLElement, title: string, className = '') {
    if (className) this.root.classList.add(className)
    this.titleEl.textContent = title
    const header = el('div', 'sheet-header')
    const close = el('button', 'sheet-close', '✕')
    close.setAttribute('aria-label', 'Close')
    close.addEventListener('click', () => this.close())
    header.append(this.titleEl, close)
    this.footer.hidden = true
    this.root.append(header, this.body, this.footer)
    this.root.hidden = true
    container.append(this.root)
  }

  get isOpen() {
    return !this.root.hidden
  }

  setTitle(title: string) {
    this.titleEl.textContent = title
  }

  // Footer buttons; pass none to hide the footer.
  setButtons(...buttons: HTMLElement[]) {
    this.footer.replaceChildren(...buttons)
    this.footer.hidden = buttons.length === 0
  }

  open() {
    if (Sheet.current && Sheet.current !== this) Sheet.current.close()
    Sheet.current = this
    this.root.hidden = false
    this.body.scrollTop = 0
  }

  close() {
    if (this.root.hidden) return
    this.root.hidden = true
    if (Sheet.current === this) Sheet.current = null
    this.onClose?.()
  }

  // Close whichever sheet is open. Returns true if one was.
  static closeCurrent(): boolean {
    if (!Sheet.current) return false
    Sheet.current.close()
    return true
  }
}

export class Modal {
  readonly body = el('div', 'panel-body')
  readonly footer = el('div', 'panel-buttons')
  private overlay = el('div', 'overlay')
  private titleEl = el('h2', '')

  constructor(container: HTMLElement, className = '') {
    const card = el('div', `panel ${className}`)
    const header = el('div', 'panel-header')
    header.append(this.titleEl)
    card.append(header, this.body, this.footer)
    this.overlay.append(card)
    this.overlay.hidden = true
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close()
    })
    container.append(this.overlay)
  }

  get isOpen() {
    return !this.overlay.hidden
  }

  show(title: string, ...buttons: HTMLElement[]) {
    this.titleEl.textContent = title
    this.footer.replaceChildren(...buttons)
    this.footer.hidden = buttons.length === 0
    this.overlay.hidden = false
  }

  close() {
    this.overlay.hidden = true
  }
}

// A footer button, e.g. a modal's "Nice!".
export function button(label: string, onClick: () => void, className = 'panel-button'): HTMLButtonElement {
  const b = el('button', className, label)
  b.addEventListener('click', onClick)
  return b
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') Sheet.closeCurrent()
})
