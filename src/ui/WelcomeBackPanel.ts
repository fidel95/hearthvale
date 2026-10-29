import type { AwaySummary } from '../game/offline'
import { coins, duration, el } from './dom'

// The "Welcome back" window: what happened while you were away, with a
// button to collect everything that's waiting.
export class WelcomeBackPanel {
  private overlay = el('div', 'overlay')
  private body = el('div', 'panel-body')
  private collect = el('button', 'panel-button')
  private onCollectAll: () => void

  constructor(container: HTMLElement, onCollectAll: () => void) {
    this.onCollectAll = onCollectAll
    const card = el('div', 'panel level-panel')
    const header = el('div', 'panel-header')
    header.append(el('h2', '', '👋 Welcome back!'))
    const later = el('button', 'panel-button secondary', 'Later')
    later.addEventListener('click', () => this.close())
    this.collect.addEventListener('click', () => {
      this.close()
      this.onCollectAll()
    })
    const buttons = el('div', 'panel-buttons')
    buttons.append(later, this.collect)
    card.append(header, this.body, buttons)
    this.overlay.append(card)
    this.overlay.hidden = true
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close()
    })
    container.append(this.overlay)
  }

  show(s: AwaySummary) {
    const lines: string[] = []
    if (s.readyBuildings > 0) lines.push(`🪙 ${s.readyBuildings} building${s.readyBuildings === 1 ? '' : 's'} ready to collect (${coins(s.readyCoins)})`)
    if (s.ripeCrops > 0) lines.push(`🧺 ${s.ripeCrops} crop${s.ripeCrops === 1 ? '' : 's'} ripe (${coins(s.ripeValue)})`)
    if (s.witheredCrops > 0) lines.push(`🥀 ${s.witheredCrops} crop${s.witheredCrops === 1 ? '' : 's'} withered while you were away`)
    if (s.energyGained > 0) lines.push(`⚡ +${s.energyGained} energy`)
    if (lines.length === 0) lines.push('Nothing new yet.')

    const list = el('ul', 'level-list')
    for (const line of lines) list.append(el('li', '', line))
    this.body.replaceChildren(
      el('p', '', `You were away for ${awayText(s.awayMs)}.`),
      list,
      el('p', 'muted', '📅 The calendar waited for you: taxes and utility bills only run while you play.'),
    )
    const waiting = s.readyBuildings + s.ripeCrops
    this.collect.hidden = waiting === 0
    this.collect.textContent = `Collect all (⚡ ${waiting})`
    this.overlay.hidden = false
  }

  close() {
    this.overlay.hidden = true
  }
}

// "3 days", "5h 20m", "12 min".
function awayText(ms: number): string {
  const days = Math.floor(ms / 86_400_000)
  if (days >= 2) return `${days} days`
  if (ms >= 3_600_000) return duration(ms)
  return `${Math.max(1, Math.round(ms / 60_000))} min`
}
