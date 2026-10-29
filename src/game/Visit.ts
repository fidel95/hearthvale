import * as THREE from 'three'
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
import type { CameraController } from './CameraController'
import { City, sizeOf, type PlacedBuilding } from './City'
import { CityView } from './CityView'
import { CROPS_BY_ID, cropState } from './crops'
import { footprintCenter, worldToTile } from './grid'
import { LandView } from './LandView'
import { isSharedGeometry } from './models'
import { HELP_REWARD, dayKey, planTown, type Neighbor } from './neighborData'
import type { Neighbors } from './Neighbors'
import { PeopleView } from './PeopleView'
import { RoadView } from './RoadView'

// A visit to a neighbor's town. It's a whole little world of its own: its own
// scene, its own City (generated from the neighbor's seed by planTown), and the
// same views the game uses for your town, so it looks and moves like a real
// town. Your town carries on untouched; Game just draws this scene instead.
//
// 🤝 bubbles mark what you can help with: rent that's ready, ripe crops,
// withered crops. Each help pays a little and builds friendship (Neighbors).

type HelpKind = 'collect' | 'harvest' | 'clear'
const HELP_ICONS: Record<HelpKind, string> = { collect: '🪙', harvest: '🧺', clear: '🥀' }

export class Visit {
  readonly scene = new THREE.Scene()
  readonly labels = new CSS2DRenderer()
  readonly neighbor: Neighbor
  onChange?: () => void // a help happened (for the HUD)
  onNotice?: (message: string) => void

  private city = new City()
  private cityView: CityView
  private roadView: RoadView
  private landView: LandView
  private peopleView: PeopleView
  private bubbles = new Map<string, CSS2DObject>()
  private neighbors: Neighbors
  private controls: CameraController

  constructor(container: HTMLElement, neighbor: Neighbor, neighbors: Neighbors, controls: CameraController, now = Date.now()) {
    this.neighbor = neighbor
    this.neighbors = neighbors
    this.controls = controls
    this.scene.background = new THREE.Color('#9fd4f0')
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#6b8e4e', 1.2))
    const sun = new THREE.DirectionalLight('#fff4e0', 2)
    sun.position.set(15, 25, 10)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24 })
    this.scene.add(sun, sun.target)

    this.labels.domElement.className = 'labels'
    container.append(this.labels.domElement)

    // Views first, so they hear the town being built.
    this.landView = new LandView(this.scene, this.city, { showSigns: false })
    this.cityView = new CityView(this.scene, this.city)
    this.roadView = new RoadView(this.scene, this.city)
    this.peopleView = new PeopleView(this.scene, this.city)
    this.build(now)
    this.refreshBubbles(now)
  }

  private build(now: number) {
    for (const p of planTown(this.neighbor, this.neighbors.townLevel(this.neighbor), dayKey(now))) {
      const b = this.city.place(p.type, p.tile, { free: true, now, rotation: p.rotation })
      if (!b) continue
      if (p.readySecondsAgo !== undefined) b.readyAt = now - p.readySecondsAgo * 1000
      if (p.crop) this.city.production.plant(b.id, CROPS_BY_ID.get(p.crop.cropId)!, { now: now - p.crop.secondsAgo * 1000, free: true })
    }
  }

  // What a building needs help with right now, if anything.
  private helpFor(b: PlacedBuilding, now: number): HelpKind | null {
    if (b.type.category === 'home' && this.city.production.isReady(b, now)) return 'collect'
    const crop = cropState(b.crop, now).stage
    return crop === 'ripe' ? 'harvest' : crop === 'withered' ? 'clear' : null
  }

  private spotOf(b: PlacedBuilding): string {
    return `${b.tile.x},${b.tile.z}`
  }

  private refreshBubbles(now: number) {
    for (const bubble of this.bubbles.values()) bubble.removeFromParent()
    this.bubbles.clear()
    if (this.neighbors.helpsLeft(this.neighbor, now) <= 0) return
    for (const b of this.city.all()) {
      const kind = this.helpFor(b, now)
      const spot = this.spotOf(b)
      if (!kind || this.neighbors.hasHelped(this.neighbor, spot, now)) continue
      const el = document.createElement('button')
      el.className = 'bubble bubble-help'
      const face = document.createElement('span')
      face.className = 'bubble-face'
      face.textContent = `🤝${HELP_ICONS[kind]}`
      el.append(face)
      el.title = `Help ${this.neighbor.name}`
      el.addEventListener('click', () => this.help(b))
      const bubble = new CSS2DObject(el)
      bubble.center.set(0.5, 1)
      bubble.position.copy(footprintCenter(b.tile, sizeOf(b))).setY(1.6)
      this.bubbles.set(spot, bubble)
      this.scene.add(bubble)
    }
  }

  // A tap on their town: help with the building there, if it needs it.
  click(clientX: number, clientY: number) {
    const point = this.controls.groundPointAt(clientX, clientY)
    const tile = point && worldToTile(point)
    const b = tile && this.city.buildingAt(tile)
    if (b && this.bubbles.has(this.spotOf(b))) this.help(b)
  }

  private help(b: PlacedBuilding) {
    const now = Date.now()
    const kind = this.helpFor(b, now)
    if (!kind) return
    if (!this.neighbors.help(this.neighbor, this.spotOf(b), now)) {
      this.onNotice?.(`You've helped ${this.neighbor.name} all you can today. Come back tomorrow!`)
      return
    }
    // Do it in their town too, so you see the result.
    if (kind === 'harvest') this.city.production.harvest(b.id, now)
    if (kind === 'clear') this.city.production.clearPlot(b.id, now)
    if (kind === 'collect') b.readyAt = now + (b.type.income?.seconds ?? 0) * 1000
    this.popup(b, `+${HELP_REWARD.coins} 🪙 +${HELP_REWARD.xp} ⭐`)
    this.refreshBubbles(now)
    this.onChange?.()
  }

  private popup(b: PlacedBuilding, text: string) {
    const el = document.createElement('div')
    el.className = 'popup popup-coins'
    el.textContent = text
    const popup = new CSS2DObject(el)
    popup.center.set(0.5, 1)
    popup.position.copy(footprintCenter(b.tile, sizeOf(b))).setY(1.2)
    el.addEventListener('animationend', () => popup.removeFromParent())
    this.scene.add(popup)
  }

  // Called every frame instead of drawing your town.
  update(dt: number, seconds: number, now: number) {
    this.cityView.update(now)
    this.roadView.update()
    this.landView.update(seconds)
    this.peopleView.update(dt)
  }

  render(renderer: THREE.WebGLRenderer, camera: THREE.Camera) {
    renderer.render(this.scene, camera)
    this.labels.render(this.scene, camera)
  }

  resize(width: number, height: number) {
    this.labels.setSize(width, height)
  }

  // Leaving: remove the labels layer and free the GPU memory this town used
  // (but not geometry shared with model copies in your own town).
  dispose() {
    this.labels.domElement.remove()
    this.peopleView.setVisible(false)
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh && !isSharedGeometry(o.geometry)) o.geometry.dispose()
    })
  }
}
