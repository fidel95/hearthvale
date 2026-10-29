import type { AwaySummary } from '../game/offline'
import { coins, duration, el } from './dom'
import { Modal, button } from './Sheet'

// The "Welcome back" window: what happened while you were away, with a
// button to collect everything that's waiting.
export class WelcomeBackPanel {
  private modal: Modal
  private onCollectAll: () => void

  constructor(container: HTMLElement, onCollectAll: () => void) {
    this.onCollectAll = onCollectAll
    this.modal = new Modal(container, 'level-panel')
  }

  show(s: AwaySummary) {
    const lines: string[] = []
    if (s.readyBuildings > 0) lines.push(`🪙 ${s.readyBuildings} building${s.readyBuildings === 1 ? '' : 's'} ready to collect (${coins(s.readyCoins)})`)
    if (s.ripeCrops > 0) lines.push(`🧺 ${s.ripeCrops} crop${s.ripeCrops === 1 ? '' : 's'} ripe (${coins(s.ripeValue)})`)
    if (s.witheredCrops > 0) lines.push(`🥀 ${s.witheredCrops} crop${s.witheredCrops === 1 ? '' : 's'} withered while you were away`)
    if (s.shipsWaiting > 0) lines.push(`🚢 ${s.shipsWaiting} ship${s.shipsWaiting === 1 ? '' : 's'} in port, waiting to unload`)
    if (s.energyGained > 0) lines.push(`⚡ +${s.energyGained} energy`)
    if (lines.length === 0) lines.push('Nothing new yet.')

    const list = el('ul', 'level-list')
    for (const line of lines) list.append(el('li', '', line))
    this.modal.body.replaceChildren(
      el('p', '', `You were away for ${awayText(s.awayMs)}.`),
      list,
      el('p', 'muted', '📅 The calendar waited for you: taxes and utility bills only run while you play.'),
    )
    const waiting = s.readyBuildings + s.ripeCrops
    const later = button('Later', () => this.modal.close(), 'panel-button secondary')
    const collect = button(`Collect all (⚡ ${waiting})`, () => {
      this.modal.close()
      this.onCollectAll()
    })
    if (waiting > 0) this.modal.show('👋 Welcome back!', later, collect)
    else this.modal.show('👋 Welcome back!', later)
  }
}

// "3 days", "5h 20m", "12 min".
function awayText(ms: number): string {
  const days = Math.floor(ms / 86_400_000)
  if (days >= 2) return `${days} days`
  if (ms >= 3_600_000) return duration(ms)
  return `${Math.max(1, Math.round(ms / 60_000))} min`
}
