import { BUILDING_TYPES } from '../game/buildings'
import type { Builder, Mode } from '../game/Builder'
import type { City } from '../game/City'

// The HTML overlay on top of the canvas: coin counter, tool buttons, the build
// catalog and a hint line. It changes the game only through Builder, and
// reads from City.

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = '') {
  const node = document.createElement(tag)
  node.className = className
  node.textContent = text
  return node
}

function hintFor(mode: Mode): string {
  switch (mode.kind) {
    case 'select':
      return ''
    case 'build':
      return `Placing ${mode.type.name} · click to place · Esc to stop`
    case 'move':
      return mode.carrying ? 'Click to drop it · Esc to cancel' : 'Click a building to move it · Esc to stop'
    case 'demolish':
      return 'Click a building to demolish it · Esc to stop'
  }
}

export class Hud {
  constructor(container: HTMLElement, builder: Builder, city: City) {
    const hud = el('div', 'hud')
    const coins = el('div', 'coins')
    const catalogItems: [HTMLButtonElement, number][] = []
    const hint = el('div', 'hint')
    const catalog = el('div', 'catalog')
    const bar = el('div', 'toolbar')
    catalog.hidden = true

    for (const type of BUILDING_TYPES) {
      const item = el('button', 'catalog-item')
      item.append(
        el('span', 'catalog-name', type.name),
        el('span', 'catalog-meta', `${type.size.x}×${type.size.z} · 🪙 ${type.cost}`),
      )
      item.addEventListener('click', () => {
        catalog.hidden = true
        builder.setMode({ kind: 'build', type })
      })
      catalog.append(item)
      catalogItems.push([item, type.cost])
    }

    const buttons = {
      build: el('button', 'tool', 'Build'),
      move: el('button', 'tool', 'Move'),
      demolish: el('button', 'tool', 'Demolish'),
    }
    buttons.build.addEventListener('click', () => (catalog.hidden = !catalog.hidden))
    buttons.move.addEventListener('click', () => {
      catalog.hidden = true
      builder.setMode(builder.mode.kind === 'move' ? { kind: 'select' } : { kind: 'move', carrying: null })
    })
    buttons.demolish.addEventListener('click', () => {
      catalog.hidden = true
      builder.setMode(builder.mode.kind === 'demolish' ? { kind: 'select' } : { kind: 'demolish' })
    })
    bar.append(buttons.build, buttons.move, buttons.demolish)

    builder.onModeChange = (mode) => {
      hint.textContent = hintFor(mode)
      hint.hidden = mode.kind === 'select'
      for (const [kind, button] of Object.entries(buttons)) {
        button.classList.toggle('active', kind === mode.kind)
      }
    }
    hint.hidden = true

    const bottom = el('div', 'hud-bottom')
    bottom.append(catalog, bar)
    // Grey out what you can't afford, and bump the counter when coins change.
    const showCoins = () => {
      coins.textContent = `🪙 ${city.coins.toLocaleString()}`
      for (const [item, cost] of catalogItems) item.disabled = city.coins < cost
    }
    city.onChange((event) => {
      if (event.kind !== 'coins') return
      showCoins()
      coins.classList.remove('bump')
      void coins.offsetWidth // force the browser to notice the removal, so the animation restarts
      coins.classList.add('bump')
    })
    showCoins()

    hud.append(coins, hint, bottom)
    container.append(hud)
  }
}
