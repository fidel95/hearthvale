import { BUILDING_TYPES } from '../game/buildings'
import type { City } from '../game/City'
import type { Services } from '../game/Services'
import { MAX_LOCATION_BONUS } from '../game/communityRules'
import { COUNTY_SUPPLY, UTILITIES, UTILITY_INFO, incomeMultiplier } from '../game/utilityRules'
import { coins, el, percent } from './dom'

// The Town window: population, how well water, electricity and trash pickup
// keep up with demand, what that does to income, and what the utilities cost
// to run.
export class TownPanel {
  private overlay = el('div', 'overlay')
  private body = el('div', 'panel-body')
  private city: City
  private services: Services
  private isOpen = false

  constructor(container: HTMLElement, city: City, services: Services) {
    this.city = city
    this.services = services

    const card = el('div', 'panel')
    const header = el('div', 'panel-header')
    const close = el('button', 'panel-close', '✕')
    close.setAttribute('aria-label', 'Close')
    close.addEventListener('click', () => this.close())
    header.append(el('h2', '', '🏘️ Town services'), close)
    card.append(header, this.body)
    this.overlay.append(card)
    this.overlay.hidden = true
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close()
    })
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close()
    })
    container.append(this.overlay)
    services.onChange(() => this.isOpen && this.render())
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

  private render() {
    const report = this.services.report
    const parts: HTMLElement[] = [el('p', 'town-population', `👥 ${report.population} residents`)]

    // Count utility buildings by type, for the "where it comes from" lines.
    const plants = new Map<string, number>()
    for (const b of this.city.all()) if (b.type.supplies) plants.set(b.type.id, (plants.get(b.type.id) ?? 0) + 1)

    for (const u of UTILITIES) {
      const info = UTILITY_INFO[u]
      const { supply, demand, level } = report.utilities[u]
      const section = el('section', 'tax-section')
      section.append(el('h3', '', `${info.icon} ${info.name}`))

      const track = el('div', 'bracket-track')
      const fill = el('div', `bracket-fill${level < 1 ? ' short' : ''}`)
      fill.style.width = `${Math.min(100, (demand / Math.max(supply, 1)) * 100)}%`
      track.append(fill)
      section.append(track)

      const sources = [`county ${COUNTY_SUPPLY[u]}`]
      for (const type of BUILDING_TYPES) {
        const count = plants.get(type.id)
        if (count && type.supplies?.utility === u) sources.push(`${count} × ${type.name} ${count * type.supplies.amount}`)
      }
      section.append(
        el('p', '', `Using ${demand} of ${supply} (${sources.join(' + ')})`),
        el(
          'p',
          level < 1 ? 'warning' : 'muted',
          level < 1
            ? `Short by ${demand - supply}: only ${percent(level)} of demand is met. Build a ${info.builds}.`
            : `${supply - demand} to spare.`,
        ),
      )
      parts.push(section)
    }

    const effect = el('section', 'tax-section')
    effect.append(
      el('h3', '', 'Effect on income'),
      el('p', '', `Homes and shops earn ${percent(incomeMultiplier(report, 'home'))} of their full amount.`),
      el('p', '', `Farms earn ${percent(incomeMultiplier(report, 'farm'))} of their full harvest.`),
      el(
        'p',
        'muted',
        "Homes and shops can't run without water and power, so their income scales with both. Uncollected trash makes the town less pleasant: up to a quarter less. Farms only need water, for irrigation.",
      ),
    )
    // Location: how parks, schools, fire stations and roads lift homes and shops.
    const earners = [...this.city.all()].filter((b) => b.type.category === 'home' || b.type.category === 'business')
    const boosted = earners.filter((b) => this.services.bonus(b).total > 0)
    const average = earners.length > 0 ? earners.reduce((sum, b) => sum + this.services.bonus(b).total, 0) / earners.length : 0
    const community = el('section', 'tax-section')
    community.append(
      el('h3', '', '🏫 Community'),
      el('p', '', `${boosted.length} of ${earners.length} homes and shops get a location bonus, +${percent(average)} on average.`),
      el(
        'p',
        'muted',
        `Parks, fire stations and schools raise the income of homes and shops nearby, and so does being beside a road. Like real property, a better location also means a higher assessed value, so property tax goes up too. Bonuses stack up to +${percent(MAX_LOCATION_BONUS)}.`,
      ),
    )
    parts.push(community)

    const running = el('section', 'tax-section')
    running.append(
      el('h3', '', 'Running costs'),
      el('p', '', `${coins(report.upkeep)} every month, ${coins(report.upkeep * 12)} a year.`),
      el(
        'p',
        'muted',
        "Utility and community buildings are paid for at the end of each month, like a real town's bills. Running costs are a business expense, so they're deducted from your taxable income. Compare the Power Plant (cheap to build, fuel makes it costly to run) with the Solar Farm (costly to build, almost free to run).",
      ),
    )
    parts.push(effect, running)
    this.body.replaceChildren(...parts)
  }
}
