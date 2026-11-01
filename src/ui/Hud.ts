import type { Builder, Mode } from '../game/Builder'
import type { City } from '../game/City'
import { MONTH_NAMES, type GameClock } from '../game/GameClock'
import type { Player } from '../game/Player'
import type { Services } from '../game/Services'
import { shortIcons } from '../game/utilityRules'
import { PRODUCTS, PRODUCT_IDS } from '../game/products'
import { duration, el } from './dom'

// The HUD is built around the city: a slim bar of stats along the top, a
// toolbar along the bottom, hints and messages under the top bar, and the map
// free in between. Every stat in the top bar is also a button that opens the
// window about it (coins → Taxes, population → Town, level → Quests, …).
// The HUD changes the game only through Builder and callbacks.

function hintFor(mode: Mode): string {
  switch (mode.kind) {
    case 'select':
      return ''
    case 'build':
      return mode.type.category === 'road'
        ? 'Drag to draw the road, then ✓'
        : mode.type.id === 'rail'
          ? 'Drag to draw the track, then ✓'
          : mode.type.drawn
            ? `Drag or tap to draw ${mode.type.name.toLowerCase()}s, then ✓`
            : `Drag the ${mode.type.name} into place, then ✓`
    case 'move':
      return 'Drag it, or tap where it should go'
    case 'restore':
      return `Drag the ${mode.building.type.name} into place, then ✓`
    case 'removeRoads':
      return 'Tap roads or track to pick them, or drag along them'
  }
}

export interface HudCallbacks {
  onOpenBuild: () => void
  onOpenQuests: () => void
  onOpenInventory: () => void
  onOpenCollections: () => void
  onOpenMap: () => void
  onOpenTaxes: () => void
  onOpenFinances: () => void
  onOpenTown: () => void
  onOpenSettings: () => void
  onOpenHelp: () => void
  onRecenter: () => void
  onRotate: () => void
  onOpenAdmin: () => void // shown when admin tools are on (always in development builds)
  onRemoveRoads: () => void // remove the roads picked in removeRoads mode
}

// A top-bar stat: an icon, a value, and an optional extra shown on wider screens.
function chip(icon: string, label: string, onClick: () => void) {
  const button = el('button', 'chip')
  button.setAttribute('aria-label', label)
  button.title = label
  const value = el('span', 'chip-value')
  const extra = el('span', 'chip-extra')
  button.append(el('span', 'chip-icon', icon), value, extra)
  button.addEventListener('click', onClick)
  return { button, value, extra }
}

export class Hud {
  private adminButton: HTMLButtonElement
  private coins
  private goods
  private people
  private energy
  private level
  private date
  private xpBar = el('div', 'chip-bar-fill')
  private monthBar = el('div', 'chip-bar-fill')
  private toasts = el('div', 'toasts')
  private badges = new Map<string, HTMLElement>()
  private toolbar = el('nav', 'toolbar')
  private questBubbles = el('div', 'quest-givers')
  private onOpenQuests: () => void
  private visitBar = el('div', 'visit-bar')
  private visitText = el('div', 'visit-text')
  private visitAvatar = el('span', 'neighbor-avatar')
  private shownMonth = -1
  private player: Player

  constructor(container: HTMLElement, builder: Builder, city: City, player: Player, services: Services, callbacks: HudCallbacks) {
    this.player = player
    this.onOpenQuests = callbacks.onOpenQuests
    const hud = el('div', 'hud')

    // ---- Top bar
    this.coins = chip('🪙', 'Coins and finances', callbacks.onOpenFinances)
    this.goods = chip('📦', 'Goods and inventory', callbacks.onOpenInventory)
    this.people = chip('👥', 'Population and services', callbacks.onOpenTown)
    this.energy = chip('⚡', 'Energy', () => {
      const next = player.nextEnergyAt(Date.now())
      this.toast(
        `Energy: ${player.energy(Date.now())} of ${player.maxEnergy}. Collecting, harvesting, planting and unloading use 1. ${next ? `Next in ${duration(next - Date.now())}.` : 'Full!'}`,
      )
    })
    this.level = chip('⭐', 'Level and quests', callbacks.onOpenQuests)
    this.date = chip('📅', 'Calendar and taxes', callbacks.onOpenTaxes)
    this.date.button.classList.add('chip-date')
    // Each counter's icon sits in a bubble of its own color (style.css).
    this.coins.button.classList.add('chip-coins')
    this.goods.button.classList.add('chip-goods')
    this.people.button.classList.add('chip-people')
    this.energy.button.classList.add('chip-energy')
    this.level.button.classList.add('chip-level')
    const xp = el('div', 'chip-bar')
    xp.append(this.xpBar)
    this.level.button.append(xp)
    const month = el('div', 'chip-bar')
    month.append(this.monthBar)
    this.date.button.append(month)
    // Small icon buttons, each with a label for screen readers and a tooltip.
    const iconButton = (icon: string, label: string, onClick: () => void) => {
      const b = el('button', 'chip chip-settings', icon)
      b.setAttribute('aria-label', label)
      b.title = label
      b.addEventListener('click', onClick)
      return b
    }
    const recenter = iconButton('🎯', 'Back to my town (Home key)', callbacks.onRecenter)
    const rotate = iconButton('🔄', 'Turn the view (Q and E keys, or twist two fingers)', callbacks.onRotate)
    const help = iconButton('❓', 'Help', callbacks.onOpenHelp)
    const settings = iconButton('⚙️', 'Settings', callbacks.onOpenSettings)
    this.adminButton = iconButton('🛠️', 'Admin tools', callbacks.onOpenAdmin)
    this.adminButton.hidden = !import.meta.env.DEV
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Home' && !(e.target instanceof HTMLInputElement)) callbacks.onRecenter()
    })

    const topbar = el('div', 'topbar')
    const stats = el('div', 'topbar-stats')
    stats.append(this.coins.button, this.goods.button, this.people.button, this.energy.button, this.level.button)
    const right = el('div', 'topbar-right')
    right.append(this.date.button, rotate, recenter, help, settings, this.adminButton)
    topbar.append(stats, right)

    // ---- Under the top bar: what the current tool does (with a way out on
    // touch screens, which have no Esc key) and short messages.
    const hint = el('div', 'hint')
    const hintText = el('span', '')
    const placeInfo = el('span', 'hint-info')
    const done = el('button', 'hint-done', 'Done')
    done.addEventListener('click', () => builder.setMode({ kind: 'select' }))
    // While picking roads: remove the ones picked.
    const removeRoads = el('button', 'hint-done hint-danger', '')
    removeRoads.addEventListener('click', callbacks.onRemoveRoads)
    builder.onRoadsPicked = (count) => {
      removeRoads.textContent = `🗑️ Remove ${count}`
      removeRoads.disabled = count === 0
    }
    // Buy what's waiting (a building, or the roads drawn), with the price.
    const buy = el('button', 'hint-done hint-buy', '')
    buy.addEventListener('click', () => builder.confirmPlacement())
    builder.onBuyChanged = (label) => {
      buy.hidden = label === null
      buy.textContent = label ?? ''
    }
    buy.hidden = true
    hint.append(hintText, placeInfo, buy, removeRoads, done)
    builder.onPlacementInfo = (text) => {
      placeInfo.textContent = text ?? ''
      placeInfo.hidden = !text
    }
    hint.hidden = true
    const messages = el('div', 'hud-top')
    messages.append(hint, this.toasts)

    // ---- Bottom toolbar
    const toolbar = this.toolbar
    const tools: [string, string, () => void][] = [
      ['🔨', 'Build', callbacks.onOpenBuild],
      ['📜', 'Quests', callbacks.onOpenQuests],
      ['🎒', 'Inventory', callbacks.onOpenInventory],
      ['🏆', 'Collections', callbacks.onOpenCollections],
      ['🗺️', 'Map', callbacks.onOpenMap],
    ]
    for (const [icon, label, onClick] of tools) {
      const b = el('button', label === 'Build' ? 'tool tool-build' : 'tool')
      b.append(el('span', 'tool-icon', icon), el('span', 'tool-label', label))
      b.addEventListener('click', onClick)
      const badge = el('span', 'tool-badge')
      badge.hidden = true
      b.append(badge)
      this.badges.set(label, badge)
      toolbar.append(b)
    }

    builder.onModeChange((mode) => {
      hintText.textContent = hintFor(mode)
      hint.hidden = mode.kind === 'select'
      removeRoads.hidden = mode.kind !== 'removeRoads'
      done.textContent = mode.kind === 'removeRoads' ? 'Cancel' : 'Done'
    })
    builder.onNotice = (message) => this.toast(message)

    // ---- Keeping the numbers current
    const showCoins = () => {
      this.coins.value.textContent = city.coins.toLocaleString()
      // Unpaid bills show beside the coins, in words as well as red.
      this.coins.extra.textContent = city.debt > 0 ? ` owe ${Math.ceil(city.debt).toLocaleString()}` : ''
      this.coins.button.classList.toggle('bad', city.debt > 0)
    }
    const showGoods = () => {
      // Everything in storage: goods, and products when there are any.
      this.goods.value.textContent = city.inStorage.toLocaleString()
      this.goods.extra.textContent = `/${city.storageCapacity}`
      this.goods.button.classList.toggle('bad', city.inStorage >= city.storageCapacity)
      const made = PRODUCT_IDS.filter((id) => city.products[id] > 0).map((id) => `${PRODUCTS[id].icon} ${city.products[id]}`)
      this.goods.button.title = `📦 ${city.goods} goods${made.length ? ` · ${made.join(' · ')}` : ''} · room for ${city.storageCapacity}`
    }
    const showPeople = () => {
      const r = services.report
      this.people.value.textContent = r.population.toLocaleString()
      const short = shortIcons(r)
      this.people.extra.textContent = `/${r.capacity} · 😊 ${services.rating().total}${short ? ` short ${short}` : ''}`
      this.people.button.classList.toggle('bad', short !== '')
    }
    const showLevel = () => {
      this.level.value.textContent = String(player.level)
      this.level.extra.textContent = `${player.xp.toLocaleString()} XP`
      this.xpBar.style.width = `${player.levelProgress * 100}%`
    }
    city.onChange((e) => {
      if (e.kind === 'debt') {
        showCoins()
        showPeople() // the rating counts unpaid bills
      }
      if (e.kind === 'coins') {
        showCoins()
        this.coins.button.classList.remove('bump')
        void this.coins.button.offsetWidth // force the browser to notice, so the animation restarts
        this.coins.button.classList.add('bump')
      }
      if (e.kind === 'goods' || e.kind === 'products' || e.kind === 'added' || e.kind === 'removed') showGoods()
    })
    services.onChange(showPeople)
    player.onChange(showLevel)
    showCoins()
    showGoods()
    showPeople()
    showLevel()

    // ---- While visiting a neighbor, a bar with who it is and the way home replaces the toolbar.
    const home = el('button', 'panel-button', '🏠 Go home')
    home.addEventListener('click', () => this.onGoHome?.())
    this.visitBar.append(this.visitAvatar, this.visitText, home)
    this.visitBar.hidden = true

    hud.append(topbar, this.questBubbles, messages, toolbar, this.visitBar)
    container.append(hud)
    // Hints and messages go just under the top bar, however many rows it
    // wraps onto (two on a narrow phone).
    // (Measured on screen, so it's right at any interface size.)
    const place = () => hud.style.setProperty('--topbar-bottom', `${topbar.getBoundingClientRect().bottom - hud.getBoundingClientRect().top}px`)
    new ResizeObserver(place).observe(topbar)
    new MutationObserver(place).observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
  }

  // Called every frame; only touches the DOM when something visible changed.
  update(clock: GameClock, now: number) {
    // Energy refills with time, so it's checked every frame rather than on events.
    const energy = this.player.energy(now)
    const next = this.player.nextEnergyAt(now)
    const value = String(energy)
    const extra = `/${this.player.maxEnergy}${next ? ` · ${duration(next - now)}` : ''}`
    if (this.energy.value.textContent !== value) this.energy.value.textContent = value
    if (this.energy.extra.textContent !== extra) this.energy.extra.textContent = extra
    this.energy.button.classList.toggle('bad', energy === 0)

    if (clock.monthIndex !== this.shownMonth) {
      this.shownMonth = clock.monthIndex
      this.date.value.textContent = `${MONTH_NAMES[clock.month].slice(0, 3)}`
      this.date.extra.textContent = ` · Year ${clock.year}`
    }
    this.monthBar.style.width = `${clock.monthProgress * 100}%`
  }

  onGoHome?: () => void

  // Show the visit bar (or, with null, the toolbar again).
  setVisit(visit: { avatar: string; name: string; town: string; helpsLeft: number } | null) {
    this.toolbar.hidden = visit !== null
    this.questBubbles.hidden = visit !== null
    this.visitBar.hidden = visit === null
    if (!visit) return
    this.visitAvatar.textContent = visit.avatar
    this.visitText.replaceChildren(
      el('strong', '', `${visit.name}'s ${visit.town}`),
      el('span', 'muted', visit.helpsLeft > 0 ? `Tap 🤝 to help · ${visit.helpsLeft} left today` : 'No helps left today: thanks for visiting!'),
    )
  }

  // Down the left side, a bubble for each quest under way: the townsperson
  // who asked, a ring for how far along it is, and a bouncing ✓ when it's
  // ready to claim. Tapping one opens Quests.
  setQuests(quests: { giver: string; title: string; share: number; ready: boolean }[]) {
    this.questBubbles.replaceChildren(
      ...quests.map((q) => {
        const b = el('button', q.ready ? 'quest-giver ready' : 'quest-giver')
        b.setAttribute('aria-label', `${q.title}: ${q.ready ? 'ready to claim' : `${Math.round(q.share * 100)}% done`}`)
        b.title = q.title
        b.style.setProperty('--share', String(q.share))
        b.append(el('span', 'quest-face', q.giver))
        if (q.ready) b.append(el('span', 'quest-ready', '✓'))
        b.addEventListener('click', this.onOpenQuests)
        return b
      }),
    )
  }

  // A small count on a toolbar button (0 hides it).
  setBadge(tool: string, count: number) {
    const badge = this.badges.get(tool)
    if (!badge) return
    badge.hidden = count === 0
    badge.textContent = String(count)
  }

  // A message that shows for a few seconds under the top bar.
  // The top-bar counter that collected coins, XP and goods fly to.
  chip(kind: 'coins' | 'xp' | 'goods'): HTMLElement {
    return (kind === 'coins' ? this.coins : kind === 'goods' ? this.goods : this.level).button
  }

  // The 🛠️ button: shown while admin tools are on, and always in development.
  setAdminVisible(visible: boolean) {
    this.adminButton.hidden = !visible && !import.meta.env.DEV
  }

  toast(message: string, tone: 'info' | 'warn' = 'info') {
    const toast = el('div', `toast toast-${tone}`, message)
    this.toasts.append(toast)
    window.setTimeout(() => toast.remove(), 3500)
  }
}
