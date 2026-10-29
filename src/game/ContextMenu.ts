import * as THREE from 'three'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import type { PlacedBuilding } from './City'
import type { CityView } from './CityView'
import { footprintCenter } from './grid'
import type { IncomeView } from './IncomeView'

// The small menu that floats above a selected building: its name, what it's
// doing right now, and buttons for what you can do with it. It's an HTML
// label in the 3D scene (like the bubbles), so it stays above the building as
// the map pans, and the city stays visible around it.

export interface ContextActions {
  label: string
  icon: string
  run: (building: PlacedBuilding) => void
  // Hide the action for buildings it doesn't apply to.
  when?: (building: PlacedBuilding) => boolean
}

export class ContextMenu {
  private label: CSS2DObject
  private title = document.createElement('strong')
  private status = document.createElement('span')
  private buttons = document.createElement('div')
  private building: PlacedBuilding | null = null
  private actions: ContextActions[]
  private cityView: CityView
  private incomeView: IncomeView

  constructor(scene: THREE.Scene, cityView: CityView, incomeView: IncomeView, actions: ContextActions[]) {
    this.cityView = cityView
    this.incomeView = incomeView
    this.actions = actions
    const el = document.createElement('div')
    el.className = 'context-menu'
    this.buttons.className = 'context-buttons'
    el.append(this.title, this.status, this.buttons)
    this.label = new CSS2DObject(el)
    this.label.center.set(0.5, 1)
    this.label.visible = false
    scene.add(this.label)
  }

  show(building: PlacedBuilding | null) {
    this.building = building
    this.label.visible = building !== null
    if (!building) return
    this.buttons.replaceChildren(
      ...this.actions
        .filter((a) => !a.when || a.when(building))
        .map((a) => {
          const b = document.createElement('button')
          b.append(a.icon, document.createElement('br'), a.label)
          b.addEventListener('click', () => a.run(building))
          return b
        }),
    )
    this.update(Date.now())
  }

  // Called every frame: follow the building and keep the status current.
  update(now: number) {
    const b = this.building
    if (!b) return
    this.label.position.copy(footprintCenter(b.tile, b.type.size)).setY(this.cityView.topOf(b.id) + 0.3)
    const [title, status] = this.incomeView.describe(b, now)
    if (this.title.textContent !== title) this.title.textContent = title
    if (this.status.textContent !== status) this.status.textContent = status
    this.status.hidden = status === ''
  }
}
