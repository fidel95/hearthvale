import { BUILDINGS_BY_ID } from '../game/buildings'
import { EVENTS_UNLOCK_LEVEL, weekBonus, type Goal } from '../game/eventData'
import { materialsText } from '../game/items'
import type { TownEvents, Which } from '../game/TownEvents'
import { thumbnail } from './thumbnails'
import type { Player } from '../game/Player'
import { NEARBY_COLLECT_LEVEL, collectReach, unlocksAt, xpForLevel } from '../game/progression'
import { MASTERIES, MASTERY_XP, MILESTONES, TOWN_TITLES, milestoneGoal, milestoneReward, type Goals } from '../game/goals'
import { ACHIEVEMENTS, ACHIEVEMENT_XP, type Quests, type Reward } from '../game/quests'
import { coins, el } from './dom'
import { Sheet, button } from './Sheet'

// Quests and progression: active quests with their tasks and rewards (and
// what's coming next), your level and what the next levels unlock,
// achievements, and quests you've finished.

const TABS = ['Quests', 'Goals', 'Events', 'Progress', 'Achievements', 'Done'] as const
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
  private goals: Goals

  constructor(container: HTMLElement, quests: Quests, player: Player, events: TownEvents, goals: Goals) {
    this.goals = goals
    goals.onChange(() => this.sheet.isOpen && this.render())
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
      case 'Goals':
        parts.push(...this.renderGoals())
        break
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
        const reach = collectReach(level)
        parts.push(
          el(
            'p',
            'muted',
            reach > 0
              ? `🧺 Collecting also collects everything ready within ${reach} tiles${collectReach(level + 3) > reach ? ` (${reach + 1} from level ${level + 3 - ((level - NEARBY_COLLECT_LEVEL) % 3)})` : ''}.`
              : `🧺 From level ${NEARBY_COLLECT_LEVEL}, collecting from one building also collects everything ready around it.`,
          ),
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
  // The town's title, its milestones, and mastery stars for everything
  // unlocked so far (unfinished ones first).
  private renderGoals(): HTMLElement[] {
    const parts: HTMLElement[] = []
    const population = this.goals.value(MILESTONES[0])
    const next = TOWN_TITLES.find(([from]) => from > population)
    parts.push(
      el('p', 'detail-status', `🏘️ ${this.goals.title()} of ${population.toLocaleString()}`),
      el('p', 'muted', next ? `Grows into a ${next[1]} at ${next[0].toLocaleString()} people.` : 'The biggest kind of town there is.'),
    )
    for (const kind of MILESTONES) {
      const step = this.goals.stepOf(kind)
      const goal = milestoneGoal(kind, step)
      const value = this.goals.value(kind)
      const row = el('section', 'achievement')
      row.append(el('span', 'achievement-icon', kind.icon), el('strong', '', kind.label), el('span', 'achievement-stars', `#${step + 1}`))
      row.append(el('span', 'muted achievement-detail', `${value.toLocaleString()}/${goal.toLocaleString()} · ${rewardText(milestoneReward(step))}`), bar(value / goal))
      parts.push(row)
    }
    parts.push(el('h3', 'goals-heading', 'Mastery'), el('p', 'muted', 'Collect from each kind of building, and harvest each crop, to earn its three stars.'))
    const level = this.player.level
    const open = MASTERIES.filter((m) => (m.building ? m.building.unlockLevel : 1) <= level || this.goals.countOf(m) > 0)
    // Unfinished first, the ones furthest along at the top.
    const sorted = [...open].sort((a, b) => Number(this.goals.starsOf(a) === 3) - Number(this.goals.starsOf(b) === 3) || this.goals.countOf(b) - this.goals.countOf(a))
    for (const m of sorted) {
      const stars = this.goals.starsOf(m)
      const count = this.goals.countOf(m)
      const row = el('section', 'achievement')
      const icon = el('span', 'achievement-icon', m.icon)
      if (m.building) {
        const img = el('img', 'goal-thumb') as HTMLImageElement
        img.alt = ''
        thumbnail(m.building).then((url) => (img.src = url))
        icon.append(img)
      }
      row.append(icon, el('strong', '', m.name), el('span', 'achievement-stars', '★'.repeat(stars) + '☆'.repeat(3 - stars)))
      const detail = stars < 3 ? `${count}/${m.goals[stars]} for the next star · ${rewardText({ coins: m.coins[stars], xp: MASTERY_XP[stars] })}` : `${count} · mastered`
      row.append(el('span', 'muted achievement-detail', detail), bar(stars < 3 ? count / m.goals[stars] : 1))
      parts.push(row)
    }
    return parts
  }

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
