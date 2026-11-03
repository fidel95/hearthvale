import { CARGO_ROUTES, STAR_TRIPS, UNLOAD_ENERGY, rewardText, type Cargo } from '../game/Cargo'
import type { City, PlacedBuilding } from '../game/City'
import { coins, el, timeSpan } from './dom'
import { Sheet } from './Sheet'

// The window for sending a cargo plane from the airport: each destination,
// what the trip costs and brings back, and how well you've mastered it.
export class CargoPanel {
  private sheet: Sheet
  private city: City
  private cargo: Cargo
  private onNotice: (message: string) => void

  constructor(container: HTMLElement, city: City, cargo: Cargo, onNotice: (message: string) => void) {
    this.city = city
    this.cargo = cargo
    this.onNotice = onNotice
    this.sheet = new Sheet(container, '✈️ Send a cargo plane')
  }

  open(airport: PlacedBuilding) {
    const room = Math.max(0, this.city.storageCapacity - this.city.goods)
    const list = el('div', 'crop-grid')
    for (const route of CARGO_ROUTES) {
      const stars = this.cargo.stars(route.id)
      const trips = this.cargo.tripsOn(route.id)
      const next = STAR_TRIPS[stars]
      const item = el('button', 'catalog-item')
      if (!this.cargo.routeOpen(route)) {
        item.disabled = true
        item.classList.add('locked')
        item.append(el('span', 'catalog-name', `${route.icon} ${route.name}`), el('span', 'catalog-meta', `🔒 Opens at level ${route.level}`))
        list.append(item)
        continue
      }
      item.append(
        el('span', 'catalog-name', `${route.icon} ${route.name}`),
        el('span', 'catalog-meta', `📦 ${route.units} goods for ${coins(route.cost)}`),
        el('span', 'catalog-meta', `🪙 ${(route.cost / route.units).toFixed(1)} per good · back in ${timeSpan(route.seconds)}`),
        el(
          'span',
          'catalog-meta',
          `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)} ${next ? `${trips}/${next} trips to the next star` : `Mastered · ${trips} trips`}`,
        ),
        el('span', 'catalog-meta', stars >= 3 ? 'Reward collected' : `Third star: ${rewardText(route.reward)}`),
      )
      item.disabled = !this.cargo.canSend(airport, route)
      item.addEventListener('click', () => {
        if (this.cargo.send(airport, route, Date.now())) this.onNotice(`✈️ Cargo plane sent to ${route.name}. Back in ${timeSpan(route.seconds)}.`)
        this.sheet.close()
      })
      list.append(item)
    }
    const runway = this.cargo.needsAirport(airport)
      ? [el('p', 'warning', "✈️ The hangar's planes take off from the Airport's runway: build the Airport to fly cargo from here.")]
      : []
    this.sheet.body.replaceChildren(
      ...runway,
      el('p', '', `Storage: 📦 ${this.city.goods} of ${this.city.storageCapacity} (room for ${room}). Unloading a plane takes ⚡ ${UNLOAD_ENERGY} energy.`),
      list,
      el(
        'p',
        'muted',
        'Fly the same route again and again to earn stars. Paying for a flight is buying inventory, not an expense: the cost is deducted as your shops sell the goods.',
      ),
    )
    this.sheet.open()
  }
}
