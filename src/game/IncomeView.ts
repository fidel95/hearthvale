import * as THREE from 'three'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { duration } from '../ui/dom'
import type { City, PlacedBuilding } from './City'
import type { CityView } from './CityView'
import { cropState } from './crops'
import { footprintCenter } from './grid'

// Labels floating over buildings: bubbles that say "tap me" (coins to
// collect, crops to harvest, plots to plant), "+15" pop-ups and the hover
// info card. They're HTML elements, not 3D objects: CSS2DRenderer moves each
// one to the screen position of a 3D point every frame, so we get crisp text
// and CSS styling while they still follow the map as it pans.

const POPUP_MS = 1000 // keep in sync with the .popup animation length in style.css
// Crops grow taller than the plot's soil, so farm labels sit at a fixed height above the tallest crop.
const FARM_LABEL_HEIGHT = 0.75

// What a bubble is asking you to do. Each kind has its own look in style.css.
type BubbleKind = 'coins' | 'plant' | 'harvest' | 'withered'

interface Bubble {
  object: CSS2DObject
  key: string // kind + icon, to notice when it needs to change
}

export class IncomeView {
  private scene: THREE.Scene
  private city: City
  private cityView: CityView
  private onTap: (building: PlacedBuilding) => void
  private bubbles = new Map<number, Bubble>()
  private info: CSS2DObject
  private hovered: PlacedBuilding | null = null
  // After collecting, hide the info card briefly so it doesn't cover the "+15" pop-up.
  private hideInfoUntil = 0

  constructor(scene: THREE.Scene, city: City, cityView: CityView, onTap: (building: PlacedBuilding) => void) {
    this.scene = scene
    this.city = city
    this.cityView = cityView
    this.onTap = onTap

    const infoEl = document.createElement('div')
    infoEl.className = 'info-card'
    infoEl.append(document.createElement('strong'), document.createElement('span'))
    this.info = new CSS2DObject(infoEl)
    this.info.center.set(0.5, 1) // anchor the card's bottom-middle to the point
    this.info.visible = false
    scene.add(this.info)

    city.onChange((event) => {
      switch (event.kind) {
        case 'collected':
        case 'harvested':
          this.removeBubble(event.building.id)
          this.popup(event.building, `+${event.amount} 🪙`)
          this.hideInfoUntil = Date.now() + POPUP_MS
          break
        case 'planted':
          this.removeBubble(event.building.id)
          if (event.cost > 0) this.popup(event.building, `−${event.cost} 🪙 seeds`, 'note')
          break
        case 'cleared':
          this.removeBubble(event.building.id)
          this.popup(event.building, `Withered ${event.crop.name.toLowerCase()} cleared`, 'note')
          break
        case 'removed':
          this.removeBubble(event.building.id)
          if (this.hovered?.id === event.building.id) this.setHovered(null)
          break
      }
    })
  }

  setHovered(building: PlacedBuilding | null) {
    this.hovered = building
  }

  // Called every frame.
  update(now: number) {
    for (const building of this.city.all()) {
      const want = this.bubbleFor(building, now)
      const key = want ? `${want.kind}:${want.icon}` : null
      const have = this.bubbles.get(building.id)
      if (have?.key === key) continue
      this.removeBubble(building.id)
      if (want) this.addBubble(building, want.kind, want.icon)
    }
    // Keep bubbles over their buildings (they may have moved) and hide them
    // while a building is being carried.
    for (const [id, bubble] of this.bubbles) {
      const building = this.city.get(id)
      if (!building) continue
      bubble.object.position.copy(this.abovePoint(building))
      bubble.object.visible = this.cityView.isVisible(id)
    }
    this.updateInfo(now)
  }

  // Which bubble a building should show right now, if any.
  private bubbleFor(b: PlacedBuilding, now: number): { kind: BubbleKind; icon: string } | null {
    if (this.city.isReady(b, now)) return { kind: 'coins', icon: '🪙' }
    if (b.type.category !== 'farm') return null
    const state = cropState(b.crop, now)
    switch (state.stage) {
      case 'empty':
        return { kind: 'plant', icon: '🌱' }
      case 'ripe':
        return { kind: 'harvest', icon: state.crop.emoji }
      case 'withered':
        return { kind: 'withered', icon: '🥀' }
      case 'growing':
        return null
    }
  }

  private updateInfo(now: number) {
    const b = this.hovered
    this.info.visible = b !== null && now >= this.hideInfoUntil
    if (!b) return
    this.info.position.copy(this.abovePoint(b))
    // Sit above the bubble instead of covering it.
    this.info.element.classList.toggle('over-bubble', this.bubbles.has(b.id))
    const [title, status] = this.describe(b, now)
    // Only touch the DOM when the text changes; rewriting it every frame is wasteful.
    const [titleEl, lineEl] = this.info.element.children as unknown as [HTMLElement, HTMLElement]
    if (titleEl.textContent !== title) titleEl.textContent = title
    if (lineEl.textContent !== status) lineEl.textContent = status
    lineEl.hidden = status === ''
  }

  // The info card's title and status line.
  private describe(b: PlacedBuilding, now: number): [string, string] {
    if (b.type.category === 'farm') {
      const state = cropState(b.crop, now)
      switch (state.stage) {
        case 'empty':
          return [b.type.name, 'Empty · tap to plant']
        case 'growing':
          return [`${b.type.name} · ${state.crop.name}`, `${state.crop.emoji} ready in ${duration(state.readyAt - now)}`]
        case 'ripe':
          return [
            `${b.type.name} · ${state.crop.name}`,
            `Ripe! Tap to harvest 🪙 ${state.crop.sellPrice} · withers in ${duration(state.witherAt - now)}`,
          ]
        case 'withered':
          return [`${b.type.name} · ${state.crop.name}`, 'Withered · tap to clear']
      }
    }
    if (!b.type.income) return [b.type.name, '']
    const status = this.city.isReady(b, now)
      ? `Ready! Click to collect 🪙 ${b.type.income.coins}`
      : `🪙 ${b.type.income.coins} in ${duration(b.readyAt - now)}`
    return [b.type.name, status]
  }

  private abovePoint(b: PlacedBuilding): THREE.Vector3 {
    const top = b.type.category === 'farm' ? FARM_LABEL_HEIGHT : this.cityView.topOf(b.id) + 0.3
    return footprintCenter(b.tile, b.type.size).setY(top)
  }

  private addBubble(building: PlacedBuilding, kind: BubbleKind, icon: string) {
    // The button stays still and takes the clicks; only the face inside it bobs.
    // (When the clicked element itself was animating, clicks fell through to the canvas.)
    const el = document.createElement('button')
    el.className = `bubble bubble-${kind}`
    const face = document.createElement('span')
    face.className = 'bubble-face'
    face.textContent = icon
    el.append(face)
    el.title = { coins: 'Collect', plant: 'Plant a crop', harvest: 'Harvest', withered: 'Clear the withered crop' }[kind]
    el.addEventListener('click', () => this.onTap(building))

    const object = new CSS2DObject(el)
    object.center.set(0.5, 1)
    this.bubbles.set(building.id, { object, key: `${kind}:${icon}` })
    this.scene.add(object)
  }

  private removeBubble(id: number) {
    // removeFromParent also deletes the HTML element (CSS2DObject listens for it).
    this.bubbles.get(id)?.object.removeFromParent()
    this.bubbles.delete(id)
  }

  // A short message that floats up from a building and fades out.
  // variant 'note' is the smaller dark one, for sales tax, seed costs and the like.
  popup(building: PlacedBuilding, text: string, variant: 'coins' | 'note' = 'coins') {
    const el = document.createElement('div')
    el.className = `popup popup-${variant}`
    el.textContent = text
    const popup = new CSS2DObject(el)
    popup.center.set(0.5, 1)
    popup.position.copy(this.abovePoint(building))
    // The float-up-and-fade is a CSS animation; clean up when it finishes.
    el.addEventListener('animationend', () => popup.removeFromParent())
    this.scene.add(popup)
  }
}
