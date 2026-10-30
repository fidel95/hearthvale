import { BUILDINGS_BY_ID } from '../game/buildings'
import { EVENTS_UNLOCK_LEVEL, weekBonus, type Goal } from '../game/eventData'
import { materialsText } from '../game/items'
import type { TownEvents, Which } from '../game/TownEvents'
import { thumbnail } from './thumbnails'
import type { Player } from '../game/Player'
import { unlocksAt, xpForLevel } from '../game/progression'
import { ACHIEVEMENTS, ACHIEVEMENT_XP, type Quests, type Reward } from '../game/quests'
import { coins, el } from './dom'
import { Sheet, button } from './Sheet'

// Quests and progression: active quests with their tasks and rewards (and
// what's coming next), your level and what the next levels unlock,
// achievements, and quests you've finished.

const TABS = ['Quests', 'Events', 'Progress', 'Achievements', 'Done'] as const
type Tab = (typeof TABS)[number]

function rewardText(r: { coins?: number; xp?: number; materials?: Reward['materials'] }): string {
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
  private events: TownEvents

  constructor(container: HTMLElement, quests: Quests, player: Player, events: TownEvents) {
    this.quests = quests
    this.player = player
    this.events = events
    events.onChange(() => this.sheet.isOpen && this.render())
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
      case 'Events':
        parts.push(...this.renderEvents())
        break
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

  // This season's festival and this week's challenges.
  private renderEvents(): HTMLElement[] {
    if (!this.events.unlocked) return [el('p', 'muted', `Festivals and weekly challenges start at level ${EVENTS_UNLOCK_LEVEL}.`)]
    const parts: HTMLElement[] = []
    const goals = (which: Which, list: Goal[], claimed: number[], card: HTMLElement) => {
      const reward = this.events.rewardFor(which)
      list.forEach((g, i) => {
        const p = this.events.progress(which, i)
        const done = p >= g.count
        const row = el('div', 'quest-task')
        row.append(el('span', done ? 'done' : '', `${done ? '✅' : '◻️'} ${g.label}`), el('span', 'muted', `${p.toLocaleString()}/${g.count.toLocaleString()}`))
        card.append(row, bar(p / g.count))
        if (claimed.includes(i)) card.append(el('p', 'muted event-claimed', 'Claimed ✓'))
        else if (done) card.append(button(`Claim ${rewardText(reward)}`, () => this.events.claim(which, i)))
      })
    }

    const fest = this.events.festival()
    if (fest) {
      const { festival, period, endsAt } = fest
      const prize = BUILDINGS_BY_ID.get(festival.prize)!
      const card = el('section', 'quest event-card')
      card.append(el('strong', '', `${festival.icon} ${festival.name}`), el('p', 'muted', `${festival.intro} ${timeLeft(endsAt)}.`))
      goals('festival', period.goals, period.claimed, card)
      const prizeRow = el('div', 'event-prize')
      const img = el('img', 'build-thumb')
      img.alt = ''
      thumbnail(prize).then((url) => (img.src = url))
      const text = el('div', '')
      text.append(
        el('strong', '', `🏆 Prize: ${prize.name}`),
        el('p', 'muted', period.bonus ? 'Won! Find it in your Inventory.' : 'Claim every goal to win it: only at this festival. It brightens the neighborhood and draws visitors.'),
      )
      prizeRow.append(img, text)
      card.append(prizeRow)
      if (this.events.bonusReady('festival')) card.append(button(`🏆 Claim the ${prize.name}`, () => this.events.claimBonus('festival')))
      parts.push(card)
    }

    const week = this.events.week()
    if (week) {
      const card = el('section', 'quest event-card')
      card.append(el('strong', '', '📅 Weekly challenges'), el('p', 'muted', `New ones every Monday. ${timeLeft(week.endsAt)}.`))
      goals('week', week.period.goals, week.period.claimed, card)
      const bonus = weekBonus(this.player.level)
      if (this.events.bonusReady('week')) card.append(button(`All three done! Claim ${rewardText(bonus)} · ⚡ ${bonus.energy}`, () => this.events.claimBonus('week')))
      else card.append(el('p', 'muted', week.period.bonus ? 'All three done this week ✓' : `Finish all three for a bonus: ${rewardText(bonus)} · ⚡ ${bonus.energy}`))
      parts.push(card)
    }
    return parts
  }
}

// "3 days left", "5 hours left".
function timeLeft(endsAt: number): string {
  const hours = Math.max(0, (endsAt - Date.now()) / 3_600_000)
  if (hours >= 48) return `${Math.floor(hours / 24)} days left`
  if (hours >= 1) return `${Math.floor(hours)} hour${Math.floor(hours) === 1 ? '' : 's'} left`
  return 'Ends within the hour'
}
