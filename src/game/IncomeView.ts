import * as THREE from 'three'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import type { City, PlacedBuilding } from './City'
import type { CityView } from './CityView'
import { footprintCenter } from './grid'

// Labels floating over buildings: "collect" bubbles, "+15" pop-ups and the
// hover info card. They're HTML elements, not 3D objects: CSS2DRenderer
// moves each one to the screen position of a 3D point every frame, so we get
// crisp text and CSS styling while they still follow the map as it pans.

const POPUP_MS = 1000 // keep in sync with the .popup animation length in style.css

function formatTime(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = String(total % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

export class IncomeView {
  private scene: THREE.Scene
  private city: City
  private cityView: CityView
  private bubbles = new Map<number, CSS2DObject>()
  private info: CSS2DObject
  private hovered: PlacedBuilding | null = null
  // After collecting, hide the info card briefly so it doesn't cover the "+15" pop-up.
  private hideInfoUntil = 0

  constructor(scene: THREE.Scene, city: City, cityView: CityView) {
    this.scene = scene
    this.city = city
    this.cityView = cityView

    const infoEl = document.createElement('div')
    infoEl.className = 'info-card'
    this.info = new CSS2DObject(infoEl)
    this.info.center.set(0.5, 1) // anchor the card's bottom-middle to the point
    this.info.visible = false
    scene.add(this.info)

    city.onChange((event) => {
      if (event.kind === 'collected') {
        this.removeBubble(event.building.id)
        this.popup(event.building, `+${event.amount} 🪙`)
        this.hideInfoUntil = Date.now() + POPUP_MS
      }
      if (event.kind === 'removed') {
        this.removeBubble(event.building.id)
        if (this.hovered?.id === event.building.id) this.setHovered(null)
      }
    })
  }

  setHovered(building: PlacedBuilding | null) {
    this.hovered = building
  }

  // Called every frame.
  update(now: number) {
    for (const building of this.city.all()) {
      const ready = this.city.isReady(building, now)
      const bubble = this.bubbles.get(building.id)
      if (ready && !bubble) this.addBubble(building)
      if (!ready && bubble) this.removeBubble(building.id)
    }
    // Keep bubbles over their buildings (they may have moved) and hide them
    // while a building is being carried.
    for (const [id, bubble] of this.bubbles) {
      const building = this.city.get(id)
      if (!building) continue
      bubble.position.copy(this.abovePoint(building))
      bubble.visible = this.cityView.isVisible(id)
    }
    this.updateInfo(now)
  }

  private updateInfo(now: number) {
    const b = this.hovered
    this.info.visible = b !== null && now >= this.hideInfoUntil
    if (!b) return
    this.info.position.copy(this.abovePoint(b))
    const ready = this.city.isReady(b, now)
    // Sit above the collect bubble instead of covering it.
    this.info.element.classList.toggle('over-bubble', ready)
    let status = ''
    if (b.type.income) {
      status = ready
        ? `Ready! Click to collect 🪙 ${b.type.income.coins}`
        : `🪙 ${b.type.income.coins} in ${formatTime(b.readyAt - now)}`
    }
    const el = this.info.element
    // Only touch the DOM when the text changes; rewriting it every frame is wasteful.
    const html = `<strong>${b.type.name}</strong>${status ? `<span>${status}</span>` : ''}`
    if (el.innerHTML !== html) el.innerHTML = html
  }

  private abovePoint(b: PlacedBuilding): THREE.Vector3 {
    return footprintCenter(b.tile, b.type.size).setY(this.cityView.topOf(b.id) + 0.3)
  }

  private addBubble(building: PlacedBuilding) {
    // The button stays still and takes the clicks; only the face inside it bobs.
    // (When the clicked element itself was animating, clicks fell through to the canvas.)
    const el = document.createElement('button')
    el.className = 'bubble'
    const face = document.createElement('span')
    face.className = 'bubble-face'
    face.textContent = '🪙'
    el.append(face)
    el.title = `Collect from ${building.type.name}`
    el.addEventListener('click', () => this.city.collect(building.id, Date.now()))

    const bubble = new CSS2DObject(el)
    bubble.center.set(0.5, 1)
    this.bubbles.set(building.id, bubble)
    this.scene.add(bubble)
  }

  private removeBubble(id: number) {
    // removeFromParent also deletes the HTML element (CSS2DObject listens for it).
    this.bubbles.get(id)?.removeFromParent()
    this.bubbles.delete(id)
  }

  private popup(building: PlacedBuilding, text: string) {
    const el = document.createElement('div')
    el.className = 'popup'
    el.textContent = text
    const popup = new CSS2DObject(el)
    popup.center.set(0.5, 1)
    popup.position.copy(this.abovePoint(building))
    // The float-up-and-fade is a CSS animation; clean up when it finishes.
    el.addEventListener('animationend', () => popup.removeFromParent())
    this.scene.add(popup)
  }
}
