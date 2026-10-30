import { INCOME_LABELS, SPENDING_LABELS, OPERATING, type Finances, type IncomeSource, type Month, type Spending, type Totals } from '../game/Finances'
import { MONTH_NAMES, type GameClock } from '../game/GameClock'
import { coins, el } from './dom'
import { Sheet, button } from './Sheet'

// The financial report: how the town is doing as a business. Income, running
// costs and profit for the year (this one or last), profit month by month,
// where the money comes from and goes, and the top earners. The Taxes window
// is the same year seen as a tax return.

const signed = (n: number) => `${n < 0 ? '−' : '+'}🪙 ${Math.abs(Math.round(n)).toLocaleString()}`

export class FinancePanel {
  private sheet: Sheet
  private finances: Finances
  private clock: GameClock
  private year: 'this' | 'last' = 'this'
  // Opens the Taxes window (Game sets it).
  onOpenTaxes?: () => void

  constructor(container: HTMLElement, finances: Finances, clock: GameClock) {
    this.finances = finances
    this.clock = clock
    this.sheet = new Sheet(container, '📊 Finances')
    finances.onChange(() => this.sheet.isOpen && this.render())
  }

  open() {
    this.year = 'this'
    this.render()
    this.sheet.open()
  }

  private render() {
    const thisYear = this.clock.year
    const year = this.year === 'this' ? thisYear : thisYear - 1
    const t = this.finances.totals(year)
    const parts: HTMLElement[] = []

    if (thisYear > 1) {
      const tabs = el('div', 'catalog-tabs')
      for (const [which, label] of [['this', `Year ${thisYear} so far`], ['last', `Year ${thisYear - 1}`]] as const) {
        const b = el('button', `catalog-tab${this.year === which ? ' active' : ''}`, label)
        b.addEventListener('click', () => {
          this.year = which
          this.render()
        })
        tabs.append(b)
      }
      parts.push(tabs)
    }

    // The headline numbers.
    const tiles = el('div', 'fin-tiles')
    const tile = (label: string, value: string, kind = '') => {
      const box = el('div', `fin-tile ${kind}`)
      box.append(el('span', 'fin-tile-label', label), el('strong', 'fin-tile-value', value))
      tiles.append(box)
    }
    tile('Income', coins(t.totalIncome))
    tile('Running costs', coins(t.operatingCosts))
    tile('Profit', signed(t.profit), t.profit < 0 ? 'loss' : 'profit')
    tile('Invested', coins(t.invested))
    parts.push(tiles)
    if (this.year === 'this' && thisYear > 1) {
      const last = this.finances.totals(thisYear - 1)
      if (last.profit > 0) parts.push(el('p', 'muted', `Last year's profit: ${signed(last.profit)}. This year so far: ${Math.round((t.profit / last.profit) * 100)}% of it.`))
    }

    // Profit month by month (the last 12 months).
    if (this.year === 'this') parts.push(this.chart(this.finances.recent(12)))

    parts.push(this.breakdown('💰 Where the money comes from', t, 'income'), this.breakdown('💸 Where it goes', t, 'spending'))

    const top = this.finances.topEarners(year)
    const earners = el('section', 'tax-section')
    earners.append(el('h3', '', '⭐ Top earners'))
    if (top.length === 0) earners.append(el('p', 'muted', 'Nothing earned yet this year.'))
    top.forEach(([name, amount], i) => earners.append(this.row(`${i + 1}. ${name}`, coins(amount), amount / top[0][1])))
    parts.push(earners)

    parts.push(
      el('p', 'muted', 'Profit is income minus running costs, seeds, goods bought and taxes. Money invested in buildings, upgrades and land isn\'t a cost: you still have them. Sales tax isn\'t counted: it\'s the county\'s money, passing through.'),
      button('🏛️ The same year as a tax return', () => this.onOpenTaxes?.(), 'panel-button secondary'),
    )
    this.sheet.body.replaceChildren(...parts)
  }

  // Profit for each month: blue above the line, red below. Tap or hover a
  // month for its numbers.
  private chart(months: Month[]): HTMLElement {
    const box = el('section', 'tax-section')
    box.append(el('h3', '', '📈 Profit each month'))
    const totals = months.map((m) => this.finances.monthTotals(m))
    const max = Math.max(1, ...totals.map((t) => t.profit))
    const min = Math.min(0, ...totals.map((t) => t.profit))
    const zero = (max / (max - min)) * 100 // the baseline, % from the top
    const plot = el('div', 'fin-chart')
    const baseline = el('div', 'fin-baseline')
    baseline.style.top = `${zero}%`
    plot.append(baseline)
    const readout = el('p', 'fin-readout muted', 'Tap a month to see its numbers.')
    const describe = (m: Month, t: Totals) =>
      `${MONTH_NAMES[m.index % 12]}, year ${Math.floor(m.index / 12) + 1}: income ${coins(t.totalIncome)} · costs ${coins(t.operatingCosts)} · profit ${signed(t.profit)}`
    months.forEach((m, i) => {
      const t = totals[i]
      const col = el('button', 'fin-col')
      col.setAttribute('aria-label', describe(m, t))
      const bar = el('div', `fin-bar ${t.profit < 0 ? 'loss' : 'profit'}`)
      const h = (Math.abs(t.profit) / (max - min)) * 100
      bar.style.height = `${h}%`
      if (t.profit >= 0) bar.style.bottom = `${100 - zero}%`
      else bar.style.top = `${zero}%`
      col.append(bar, el('span', 'fin-month', MONTH_NAMES[m.index % 12][0]))
      const show = () => {
        readout.textContent = describe(m, t)
        for (const c of plot.querySelectorAll('.fin-col')) c.classList.toggle('active', c === col)
      }
      col.addEventListener('pointerenter', show)
      col.addEventListener('click', show)
      plot.append(col)
    })
    // The latest month's value, labeled directly.
    const latest = totals.at(-1)
    if (latest) readout.textContent = `This month so far: profit ${signed(latest.profit)}. Tap a month to see its numbers.`
    box.append(plot, readout)
    return box
  }

  private breakdown(title: string, t: Totals, which: 'income' | 'spending'): HTMLElement {
    const box = el('section', 'tax-section')
    box.append(el('h3', '', title))
    const entries =
      which === 'income'
        ? (Object.keys(INCOME_LABELS) as IncomeSource[]).map((k) => [INCOME_LABELS[k], t.income[k]] as const)
        : ([...OPERATING, 'invested'] as Spending[]).map((k) => [SPENDING_LABELS[k], t.spending[k]] as const)
    const total = which === 'income' ? t.totalIncome : t.operatingCosts + t.invested
    const shown = entries.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
    if (shown.length === 0) box.append(el('p', 'muted', which === 'income' ? 'No income yet.' : 'Nothing spent yet.'))
    for (const [label, value] of shown) box.append(this.row(label, coins(value), value / Math.max(1, total)))
    return box
  }

  // A labeled amount with a bar for its share.
  private row(label: string, value: string, share: number): HTMLElement {
    const row = el('div', 'fin-row')
    const track = el('div', 'fin-share')
    const fill = el('div', 'fin-share-fill')
    fill.style.width = `${Math.max(2, share * 100)}%`
    track.append(fill)
    row.append(el('span', 'fin-row-label', label), el('span', 'fin-row-value', value), track)
    return row
  }
}
