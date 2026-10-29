import type { City } from '../game/City'
import { MONTH_NAMES, type GameClock } from '../game/GameClock'
import type { TaxReturn, Taxes } from '../game/Taxes'
import {
  CAP_RATE,
  LATE_PENALTY_PER_MONTH,
  OPERATING_EXPENSE_RATIO,
  PROPERTY_TAX_RATE,
  SALES_TAX_RATE,
} from '../game/taxRules'
import { coins, el, percent } from './dom'

// The Taxes window: this year's books so far, an estimate of the income tax
// with a bracket-by-bracket breakdown, sales tax being held, property values,
// last year's return and a short explainer. Also the Tax Day report that pops
// up when the year's return is filed.
//
// It's written to teach: each number is labeled the way it would be on a real
// tax form, and the explainer says where each rule comes from.

type Row = [label: string, value: string, kind?: 'total' | 'minus' | 'muted']

function table(rows: Row[]): HTMLTableElement {
  const t = el('table', 'tax-table')
  for (const [label, value, kind] of rows) {
    const tr = el('tr', kind ?? '')
    tr.append(el('td', '', label), el('td', 'num', value))
    t.append(tr)
  }
  return t
}

function section(title: string, ...children: (Node | string)[]): HTMLElement {
  const s = el('section', 'tax-section')
  s.append(el('h3', '', title), ...children)
  return s
}

function returnRows(r: TaxReturn): Row[] {
  const rows: Row[] = [
    ['Rent from homes', coins(r.rentIncome)],
    ['Sales from shops', coins(r.salesIncome)],
    ['Crop sales from farms', coins(r.farmIncome)],
  ]
  if (r.otherIncome > 0) rows.push(['Prizes (level-up rewards)', coins(r.otherIncome)])
  rows.push(
    ['Gross income', coins(r.grossIncome), 'total'],
    ['− Seeds (farm expenses)', coins(r.farmExpenses), 'minus'],
    ['− Running costs (utilities, community)', coins(r.operatingExpenses), 'minus'],
    ['− Property tax', coins(r.propertyTax), 'minus'],
    ['− Depreciation', coins(r.depreciation), 'minus'],
    ['− Standard deduction', coins(r.standardDeduction), 'minus'],
    ['Taxable income', coins(r.taxableIncome), 'total'],
  )
  return rows
}

// One bar per bracket the income reaches, showing how much income landed in it.
function bracketChart(r: TaxReturn): HTMLElement {
  const wrap = el('div', 'brackets')
  if (r.slices.length === 0) {
    wrap.append(el('p', 'muted', 'No taxable income yet, so no income tax. The standard deduction covers it.'))
    return wrap
  }
  for (const s of r.slices) {
    const row = el('div', 'bracket')
    const label = el('span', 'bracket-rate', percent(s.rate))
    const track = el('div', 'bracket-track')
    const fill = el('div', 'bracket-fill')
    // How full this bracket is (the last one is open-ended).
    const width = Number.isFinite(s.to) ? (s.taxed / (s.to - s.from)) * 100 : 100
    fill.style.width = `${Math.max(2, width)}%`
    track.append(fill)
    const detail = el('span', 'bracket-detail', `${coins(s.taxed)} → ${coins(s.tax)}`)
    row.append(label, track, detail)
    wrap.append(row)
  }
  return wrap
}

export class TaxPanel {
  private overlay = el('div', 'overlay')
  private card = el('div', 'panel')
  private body = el('div', 'panel-body')
  private title = el('h2', '')
  private city: City
  private taxes: Taxes
  private clock: GameClock
  private isOpen = false

  constructor(container: HTMLElement, city: City, taxes: Taxes, clock: GameClock) {
    this.city = city
    this.taxes = taxes
    this.clock = clock

    const header = el('div', 'panel-header')
    const close = el('button', 'panel-close', '✕')
    close.setAttribute('aria-label', 'Close')
    close.addEventListener('click', () => this.close())
    header.append(this.title, close)
    this.card.append(header, this.body)
    this.overlay.append(this.card)
    this.overlay.hidden = true
    // Clicking the dimmed background closes the panel.
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close()
    })
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close()
    })
    container.append(this.overlay)

    // Keep the numbers live while the panel is open.
    taxes.onChange(() => this.isOpen && this.render())
    city.onChange((e) => e.kind === 'coins' && this.isOpen && this.render())
  }

  open() {
    this.isOpen = true
    this.render()
    this.overlay.hidden = false
  }

  close() {
    this.isOpen = false
    this.overlay.hidden = true
  }

  // The yearly report shown on Tax Day.
  showTaxDay(r: TaxReturn) {
    this.isOpen = false // it's a report, not the live panel
    this.title.textContent = `📬 Tax Day: Year ${r.year}`
    this.body.replaceChildren(
      el('p', '', 'The tax year is over. Here is the return your accountant filed:'),
      table([
        ...returnRows(r),
        ['Income tax', coins(r.incomeTax)],
        ['Property tax', coins(r.propertyTax)],
        ['Paid today', coins(r.amountDue), 'total'],
        ['Sales tax passed on during the year', coins(r.salesTaxRemitted), 'muted'],
      ]),
      el(
        'p',
        'muted',
        r.incomeTax > 0
          ? `Your top bracket was ${percent(r.marginalRate)}, but your income tax was only ${percent(r.effectiveRate)} of your gross income. That gap is how marginal brackets work: each rate only applies to the slice of income inside its bracket.`
          : 'Your deductions covered all of your income, so there was no income tax this year. Property tax is still due: it depends on what your buildings are worth, not on what you earned.',
      ),
      ...(this.city.coins < 0 ? [this.debtWarning()] : []),
    )
    this.overlay.hidden = false
  }

  private render() {
    const r = this.taxes.estimate()
    const monthsLeft = 11 - this.clock.month
    this.title.textContent = `Taxes · Year ${this.clock.year}, ${MONTH_NAMES[this.clock.month]}`

    const nextQuarterEnd = MONTH_NAMES[Math.floor(this.clock.month / 3) * 3 + 2]
    const properties = this.taxes.properties().sort((a, b) => b.annualTax - a.annualTax)
    const land = this.taxes.land()
    const totalPropertyTax = properties.reduce((sum, p) => sum + p.annualTax, 0) + land.annualTax

    const parts: HTMLElement[] = []
    if (this.city.coins < 0) parts.push(this.debtWarning())

    parts.push(
      section(
        'This year so far',
        table(returnRows(r)),
        el(
          'p',
          'muted',
          `Tax Day is at the end of December (${monthsLeft === 0 ? 'this month' : `in ${monthsLeft} month${monthsLeft === 1 ? '' : 's'}`}). You'll pay the income tax and property tax then.`,
        ),
      ),
      section(
        'Income tax (estimate)',
        bracketChart(r),
        table([
          ['Estimated income tax', coins(r.incomeTax), 'total'],
          ['Marginal rate (on your next coin)', percent(r.marginalRate)],
          ['Effective rate (of gross income)', percent(r.effectiveRate)],
        ]),
      ),
      section(
        'Sales tax',
        table([
          ['Collected from customers this year', coins(this.taxes.ledger.salesTaxCollected)],
          ['Sent to the state this year', coins(this.taxes.ledger.salesTaxRemitted)],
          ['Holding now', coins(this.taxes.salesTaxHeld), 'total'],
        ]),
        el(
          'p',
          'muted',
          `Shoppers pay ${percent(SALES_TAX_RATE)} on top of every sale. It sits in your coins, but it isn't yours: it goes to the state at the end of ${nextQuarterEnd}.`,
        ),
      ),
      section(
        'Property tax',
        table([
          ...properties
            .slice(0, 6)
            .map((p): Row => [p.building.type.name, `${coins(p.value)} value · ${coins(p.annualTax)}/yr`, 'muted']),
          ...(properties.length > 6 ? [[`…and ${properties.length - 6} more`, '', 'muted'] as Row] : []),
          [`Land (${land.lots} lots)`, `${coins(land.value)} value · ${coins(land.annualTax)}/yr`, 'muted'],
          ['Total per year', coins(totalPropertyTax), 'total'],
        ]),
      ),
    )

    if (this.taxes.lastReturn) {
      const last = this.taxes.lastReturn
      parts.push(
        section(
          `Last year's return (Year ${last.year})`,
          table([
            ['Gross income', coins(last.grossIncome)],
            ['Taxable income', coins(last.taxableIncome)],
            ['Income tax', coins(last.incomeTax)],
            ['Property tax', coins(last.propertyTax)],
            ['Sales tax passed on', coins(last.salesTaxRemitted)],
            ['Late penalties', coins(last.penalties)],
          ]),
        ),
      )
    }

    parts.push(this.explainer())
    this.body.replaceChildren(...parts)
  }

  private debtWarning(): HTMLElement {
    return el(
      'p',
      'warning',
      `You owe ${coins(-this.city.coins)} in back taxes. A ${percent(LATE_PENALTY_PER_MONTH)} late penalty is added every month until it's paid. Collect rent to pay it off. You can't build while in debt.`,
    )
  }

  private explainer(): HTMLElement {
    const details = el('details', 'tax-section explainer')
    details.append(el('summary', '', 'How taxes work in Hearthvale'))
    const points: [string, string][] = [
      [
        'Income tax',
        "Uses the real 2024 US federal brackets for a single filer, with dollar amounts divided by 10. Each rate only applies to the income inside its bracket, so moving into a higher bracket never lowers your take-home pay.",
      ],
      [
        'Deductions',
        "Before brackets apply you subtract the standard deduction, the property tax you paid, depreciation, what you spent on seeds and the cost of running utilities. Demolishing a building is not deductible: US law adds its leftover cost to the land's value instead.",
      ],
      [
        'Depreciation',
        "Buildings wear out, so the cost of each one is deducted a little each month: homes over 27.5 years, shops over 39, decorations over 15 (real US MACRS periods). Land (farm fields) can't be depreciated. The month you build counts as half (the mid-month convention).",
      ],
      [
        'Property tax',
        `${percent(PROPERTY_TAX_RATE)} of each building's assessed value per year, and of what your land cost. Land is taxed but never depreciated: it doesn't wear out. Assessors value income property by what it earns: (yearly income × ${percent(1 - OPERATING_EXPENSE_RATIO)} left after running costs) ÷ a ${percent(CAP_RATE)} cap rate. So a building is worth far more than you paid for it, just like real property appreciating.`,
      ],
      [
        'Sales tax',
        `${percent(SALES_TAX_RATE)} added to every sale at your shops. You collect it for the state and hand it over every quarter (end of March, June, September, December). Spending it is borrowing from the taxman.`,
      ],
      [
        'Farms',
        "Crop sales are farm income (Schedule F in the US). Seeds are a farm expense, deducted in the year you buy them (the cash method most farmers use). Crops are sold wholesale, so there's no sales tax on them. A crop that withers gives no extra deduction: its seeds were already deducted.",
      ],
      [
        'Utilities',
        "Water towers, power plants and recycling centers cost money every month to run. Those running costs are ordinary business expenses, deducted in full the year you pay them. The plants themselves are depreciated over their real US classes: water 25 years, power plants 20, recycling 7, solar just 5 (a deliberate incentive).",
      ],
      [
        'Prizes',
        'Level-up rewards are prize money, and prizes and awards are taxable income in the US (IRC §74), so they count toward your gross income.',
      ],
      [
        'Paying late',
        `If a tax bill takes your coins below zero, you're in debt and pay a ${percent(LATE_PENALTY_PER_MONTH)} penalty each month, like the IRS failure-to-pay penalty.`,
      ],
    ]
    for (const [term, text] of points) {
      const p = el('p', '')
      p.append(el('strong', '', `${term}. `), text)
      details.append(p)
    }
    details.append(el('p', 'muted', 'More detail, worked examples and what the game simplifies: docs/TAXES.md'))
    return details
  }
}
