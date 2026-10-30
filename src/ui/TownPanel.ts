import { BUILDING_TYPES } from '../game/buildings'
import type { City } from '../game/City'
import type { Services } from '../game/Services'
import { MAX_LOCATION_BONUS } from '../game/communityRules'
import { BASE_POPULATION_CAPACITY, COUNTY_SUPPLY, UTILITIES, UTILITY_INFO, incomeMultiplier } from '../game/utilityRules'
import { coins, el, percent } from './dom'
import type { TourismReport } from '../game/Tourism'
import { Sheet, button } from './Sheet'

// The Town window: population, how well water, electricity and trash pickup
// keep up with demand, what that does to income, and what the utilities cost
// to run.
export class TownPanel {
  private sheet: Sheet
  private city: City
  private services: Services

  // Opens the build menu at a tab, for "Build one" on residents' wishes.
  onBuild?: (tab: string) => void
  // This month's tourism numbers (Tourism.ts); Game sets it.
  tourism?: () => TourismReport

  constructor(container: HTMLElement, city: City, services: Services) {
    this.city = city
    this.services = services
    this.sheet = new Sheet(container, '🏘️ Town services')
    services.onChange(() => this.sheet.isOpen && this.render())
  }

  open() {
    this.render()
    this.sheet.open()
  }

  private render() {
    const report = this.services.report
    // The city rating, part by part, each with what would raise it.
    const rating = this.services.rating()
    const ratingSection = el('section', 'tax-section')
    ratingSection.append(el('h3', '', `😊 City rating: ${rating.total} / 100`))
    for (const p of rating.parts) {
      const row = el('div', 'rating-row')
      const track = el('div', 'bracket-track')
      const fill = el('div', `bracket-fill${p.points < p.max ? ' partial' : ''}`)
      fill.style.width = `${(p.points / p.max) * 100}%`
      track.append(fill)
      row.append(el('span', '', p.label), track, el('span', 'muted', `${p.points}/${p.max}`))
      ratingSection.append(row)
      if (p.points < p.max) ratingSection.append(el('p', 'muted rating-hint', `↑ ${p.hint}`))
    }
    ratingSection.append(el('p', 'muted', 'Landmarks need a minimum rating to be built. Nothing else depends on it, so a low rating never costs you anything.'))
    const bonus = this.services.townBonus()

    // What residents want: their unmet needs, most wanted first.
    const wishes = this.services.wishes()
    const wishSection = el('section', 'tax-section')
    wishSection.append(el('h3', '', `🏘️ Residents' happiness: ${Math.round(this.services.averageHappiness() * 100)}%`))
    if (wishes.length === 0) wishSection.append(el('p', 'muted', 'Every home has what it needs nearby. Happy homes pay up to 15% more rent.'))
    for (const { need, homes } of wishes) {
      const row = el('div', 'wish-row')
      const build = button('Build one', () => this.onBuild?.(need.tab), 'panel-button secondary')
      row.append(el('span', '', `${need.icon} ${homes} home${homes === 1 ? '' : 's'} want${homes === 1 ? 's' : ''} ${need.hint}`), build)
      wishSection.append(row)
    }
    if (wishes.length) wishSection.append(el('p', 'muted', 'A home with every need met pays up to 15% more rent.'))

    // Tourism: arrivals vs. room at attractions, and what visitors spend.
    const tourism = this.tourism?.()
    const tourSection = el('section', 'tax-section')
    if (tourism) {
      tourSection.append(el('h3', '', `🧳 Tourism: ${tourism.visitors} visitors a month · 🪙 ${tourism.income}/month`))
      tourSection.append(
        el('p', '', `🚉 Transport brings ${tourism.arrivals} a month · 🎡 attractions have room for ${tourism.room}`),
        el(
          'p',
          'muted',
          tourism.arrivals === 0 && tourism.room === 0
            ? 'Visitors come by bus, boat, train or plane, to parks, the beach, the ski resort and landmarks. Each spends 🪙 2 a month (taxable).'
            : tourism.arrivals < tourism.room
              ? '↑ More visitors could come: build bus stops, a dock, the train station or the airport.'
              : tourism.room < tourism.arrivals
                ? '↑ More visitors arrive than there\'s room for: build parks, a beach, Central Park, the ski resort or landmarks.'
                : 'Arrivals and attractions are in balance.',
        ),
      )
    }

    const parts: HTMLElement[] = [
      el('p', 'town-population', `👥 ${report.population} residents · room for ${report.capacity}`),
      wishSection,
      ...(tourism ? [tourSection] : []),
      ratingSection,
      ...(bonus > 0 ? [el('p', '', `🏛️ Landmarks add +${percent(bonus)} to all rent and sales.`)] : []),
      el('p', 'muted', `Every town has room for ${BASE_POPULATION_CAPACITY} residents. Parks, fire stations and schools make room for more; new homes and upgrades need room to fit.`),
    ]

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
    this.sheet.body.replaceChildren(...parts)
  }
}
