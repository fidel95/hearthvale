import { DAILY_DAYS, dailyGift, type Daily, type DailyGift } from '../game/daily'
import { coins, el } from './dom'
import { Modal, button } from './Sheet'

// The daily gift window: a 7-day calendar, the days already collected ticked,
// today's gift highlighted, and the big gift on day 7.
export class DailyPanel {
  private modal: Modal
  private daily: Daily
  private level: () => number
  // Called with the gift once it's collected (Game shows the toast).
  onClaimed: ((gift: DailyGift) => void) | null = null

  constructor(container: HTMLElement, daily: Daily, level: () => number) {
    this.daily = daily
    this.level = level
    this.modal = new Modal(container, 'level-panel daily-panel')
  }

  get isOpen() {
    return this.modal.isOpen
  }

  show() {
    const calendar = el('div', 'daily-days')
    const today = this.daily.next
    for (let day = 1; day <= DAILY_DAYS; day++) {
      const gift = dailyGift(day, this.level())
      const done = day < today
      const tile = el('div', `daily-day${done ? ' done' : ''}${day === today ? ' today' : ''}${day === DAILY_DAYS ? ' big' : ''}`)
      tile.append(el('div', 'daily-day-label', `Day ${day}`), el('div', 'daily-day-icon', done ? '✅' : day === DAILY_DAYS ? '🎁' : '🪙'), el('div', 'daily-day-coins', coins(gift.coins)))
      if (gift.energy > 0) tile.append(el('div', 'daily-day-extra', `⚡ +${gift.energy}`))
      calendar.append(tile)
    }
    const gift = dailyGift(today, this.level())
    this.modal.body.replaceChildren(
      el('p', '', today === DAILY_DAYS ? 'Day 7: the big gift!' : `Day ${today} of ${DAILY_DAYS}. Come back tomorrow for a bigger one.`),
      calendar,
      el('p', 'muted', 'Miss a day? No problem: you carry on where you left off.'),
    )
    const extras = [`⭐ ${gift.xp} XP`, gift.energy > 0 ? `⚡ ${gift.energy}` : ''].filter(Boolean).join(' · ')
    const collect = button(`Collect ${coins(gift.coins)} · ${extras}`, () => {
      this.modal.close()
      const claimed = this.daily.claim(new Date())
      if (claimed) this.onClaimed?.(claimed)
    })
    this.modal.show('🎁 Daily gift', collect)
  }
}
