import type { Player } from '../game/Player'

// Tiny helpers for building UI with plain DOM calls. Setting textContent
// (never innerHTML) means text is always shown as text, never run as HTML.

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = '') {
  const node = document.createElement(tag)
  node.className = className
  node.textContent = text
  return node
}

export function coins(amount: number): string {
  return `🪙 ${Math.round(amount).toLocaleString()}`
}

export function percent(rate: number): string {
  return `${(rate * 100).toFixed(1).replace(/\.0$/, '')}%`
}

// A countdown: "4:05" under an hour, "2h 05m" above.
export function duration(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${m}:${String(s).padStart(2, '0')}`
}

// A length of time in words, for catalogs: "5 min", "8 h".
export function timeSpan(seconds: number): string {
  return seconds < 3600 ? `${Math.round(seconds / 60)} min` : `${Math.round(seconds / 3600)} h`
}

// Shown when a tap needs energy and there's none left.
export function outOfEnergyMessage(player: Player, now: number): string {
  const next = player.nextEnergyAt(now)
  return `Out of energy ⚡ Next one in ${duration((next ?? now) - now)}`
}
