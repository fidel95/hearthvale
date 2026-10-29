import { materialsText } from '../game/items'
import type { Player } from '../game/Player'
import { unlocksAt, xpForLevel } from '../game/progression'
import { ACHIEVEMENTS, ACHIEVEMENT_XP, type Quests, type Reward } from '../game/quests'
import { coins, el } from './dom'
import { Sheet, button } from './Sheet'

// Quests and progression: active quests with their tasks and rewards (and
// what's coming next), your level and what the next levels unlock,
// achievements, and quests you've finished.

const TABS = ['Quests', 'Progress', 'Achievements', 'Done'] as const
type Tab = (typeof TABS)[number]

function rewardText(r: Reward): string {
  return [r.coins ? coins(r.coins) : '', r.xp ? `⭐ ${r.xp}` : '', r.materials ? materialsText(r.materials) : ''].filter(Boolean).join(' · ')
}

function bar(share: number): HTMLElement {
  const track = el('div', 'progress')
  const fill = el('div', 'progress-fill')
  fill.style.width = `${Math.min(1, share) * 100}%`
  track.append(fill)
  return track
}

export class QuestsPanel {
  private sheet: Sheet
  private tabs = el('div', 'catalog-tabs')
  private content = el('div', '')
  private tab: Tab = 'Quests'
  private quests: Quests
  private player: Player

  constructor(container: HTMLElement, quests: Quests, player: Player) {
    this.quests = quests
    this.player = player
    this.sheet = new Sheet(container, '📜 Quests')
    for (const tab of TABS) {
      const b = el('button', 'catalog-tab', tab)
      b.addEventListener('click', () => {
        this.tab = tab
        this.render()
      })
      this.tabs.append(b)
    }
    this.sheet.body.append(this.tabs, this.content)
    quests.onChange(() => this.sheet.isOpen && this.render())
    player.onChange(() => this.sheet.isOpen && this.render())
  }

  open(tab?: Tab) {
    if (tab) this.tab = tab
    this.render()
    this.sheet.open()
  }

  private render() {
    for (const b of this.tabs.children) b.classList.toggle('active', b.textContent === this.tab)
    const parts: HTMLElement[] = []
    switch (this.tab) {
      case 'Quests': {
        for (const q of this.quests.activeQuests()) {
          const card = el('section', 'quest')
          card.append(el('strong', '', q.title), el('p', 'muted', q.intro))
          for (const t of q.tasks) {
            const p = this.quests.progress(q, t)
            const row = el('div', 'quest-task')
            row.append(el('span', p >= t.count ? 'done' : '', `${p >= t.count ? '✅' : '◻️'} ${t.label}`), el('span', 'muted', `${p.toLocaleString()}/${t.count.toLocaleString()}`))
            card.append(row, bar(p / t.count))
          }
          const done = this.quests.isDone(q)
          const claim = button(done ? `Claim ${rewardText(q.reward)}` : `Reward: ${rewardText(q.reward)}`, () => this.quests.claim(q))
          claim.disabled = !done
          card.append(claim)
          parts.push(card)
        }
        const next = this.quests.upcoming().slice(0, 4)
        if (next.length) {
          const list = el('section', 'detail-section')
          list.append(el('h3', '', 'Up next'))
          for (const { quest, waitingFor } of next) list.append(el('p', '', `🔒 ${quest.title} · ${waitingFor}`))
          parts.push(list)
        }
        if (this.quests.activeQuests().length === 0 && next.length === 0) parts.push(el('p', 'muted', 'Every quest is done. Well played!'))
        break
      }
      case 'Progress': {
        const level = this.player.level
        const from = xpForLevel(level)
        const to = xpForLevel(level + 1)
        parts.push(
          el('p', 'detail-status', `⭐ Level ${level} · ${this.player.xp.toLocaleString()} XP`),
          bar(this.player.levelProgress),
          el('p', 'muted', `${(to - this.player.xp).toLocaleString()} XP to level ${level + 1} (${(to - from).toLocaleString()} XP for this level).`),
        )
        // What the next few levels unlock.
        for (let l = level + 1; l <= level + 4; l++) {
          const { buildings, crops } = unlocksAt(l)
          const names = [...buildings.map((b) => b.name), ...crops.map((c) => `${c.emoji} ${c.name}`)]
          if (!names.length) continue
          const s = el('section', 'detail-section')
          s.append(el('h3', '', `Level ${l} unlocks`), el('p', '', names.join(' · ')))
          parts.push(s)
        }
        break
      }
      case 'Achievements': {
        for (const a of ACHIEVEMENTS) {
          const tier = this.quests.tierOf(a)
          const value = this.quests.stat(a.stat)
          const goal = a.tiers[Math.min(tier, 2)]
          const row = el('section', 'achievement')
          row.append(
            el('span', 'achievement-icon', a.icon),
            el('strong', '', a.name),
            el('span', 'achievement-stars', '★'.repeat(tier) + '☆'.repeat(3 - tier)),
          )
          const detail = tier < 3 ? `${value.toLocaleString()}/${goal.toLocaleString()} for the next star (⭐ ${ACHIEVEMENT_XP[tier]} XP)` : `${value.toLocaleString()} · all stars earned`
          row.append(el('span', 'muted achievement-detail', detail), bar(tier < 3 ? value / goal : 1))
          parts.push(row)
        }
        break
      }
      case 'Done': {
        const done = this.quests.claimedQuests()
        if (!done.length) parts.push(el('p', 'muted', 'No quests finished yet.'))
        for (const q of done) parts.push(el('p', '', `✅ ${q.title} · ${rewardText(q.reward)}`))
        break
      }
    }
    this.content.replaceChildren(...parts)
  }
}
