import * as THREE from 'three'
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
import { CropPicker } from '../ui/CropPicker'
import { Hud } from '../ui/Hud'
import { LandPanel } from '../ui/LandPanel'
import { LevelUpPanel } from '../ui/LevelUpPanel'
import { TaxPanel } from '../ui/TaxPanel'
import { Builder } from './Builder'
import { BUILDINGS_BY_ID } from './buildings'
import { CameraController } from './CameraController'
import { City } from './City'
import { CityView } from './CityView'
import { CROPS_BY_ID } from './crops'
import { GameClock, MONTH_NAMES } from './GameClock'
import { IncomeView } from './IncomeView'
import { LandView } from './LandView'
import { Player } from './Player'
import { AutoSaver, clearSave, readSave } from './save'
import { Taxes } from './Taxes'

// How many world units of the map fit vertically on screen at zoom 1.
const VIEW_SIZE = 24
// Where the sun sits relative to the point the camera looks at.
const SUN_OFFSET = new THREE.Vector3(15, 25, 10)

// Creates every piece of the game, wires them together and runs the frame loop.
// The pieces don't know about each other beyond what's passed in here, so this
// file is the map of how the game fits together (see docs/ARCHITECTURE.md).
export class Game {
  private container: HTMLElement
  private renderer: THREE.WebGLRenderer
  // Draws HTML labels (bubbles, pop-ups) at 3D positions, on top of the canvas.
  private labelRenderer = new CSS2DRenderer()
  private scene = new THREE.Scene()
  private camera: THREE.OrthographicCamera
  private controls: CameraController
  private sun = new THREE.DirectionalLight('#fff4e0', 2)

  // Game state: the town, the player's progress, the calendar and the tax books.
  private city = new City()
  private player = new Player(this.city)
  private clock: GameClock
  private taxes: Taxes

  // Views and UI that react to the state.
  private cityView: CityView
  private incomeView: IncomeView
  private hud: Hud
  private saver: AutoSaver
  private lastFrame = performance.now()

  constructor(container: HTMLElement) {
    this.container = container

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    container.appendChild(this.renderer.domElement)
    this.labelRenderer.domElement.className = 'labels'
    container.appendChild(this.labelRenderer.domElement)

    this.scene.background = new THREE.Color('#9fd4f0')

    // An orthographic camera has no perspective: far things are not smaller.
    // CameraController places it looking down at an angle from a corner,
    // which gives the classic isometric look.
    this.camera = new THREE.OrthographicCamera()
    this.controls = new CameraController(this.camera, this.renderer.domElement)

    this.addLights()

    // In development, ?speed=60 makes a game month last one second.
    const speed = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('speed')) || 1 : 1
    this.clock = new GameClock(speed)

    // Everything that listens to City must exist before the town is loaded,
    // or it misses the 'added' events.
    const landView = new LandView(this.scene, this.city)
    this.cityView = new CityView(this.scene, this.city)
    this.taxes = new Taxes(this.city, this.clock)
    const builder = new Builder(this.scene, this.city, this.player, this.cityView, this.controls, this.renderer.domElement)
    this.incomeView = new IncomeView(this.scene, this.city, this.cityView, (b) => builder.tap(b))
    builder.onHoverBuilding = (b) => this.incomeView.setHovered(b)

    const taxPanel = new TaxPanel(container, this.city, this.taxes, this.clock)
    this.hud = new Hud(container, builder, this.city, this.player, {
      onOpenTaxes: () => taxPanel.open(),
      onNewTown: () => this.newTown(),
    })
    this.showTaxEvents(taxPanel)
    const cropPicker = new CropPicker(container, this.city, this.player, (message) => this.hud.toast(message))
    builder.onPlantRequest = (plot) => cropPicker.open(plot)
    this.showPlayerEvents(new LevelUpPanel(container))
    const landPanel = new LandPanel(container, this.city, this.player, (message) => this.hud.toast(message))
    landView.onLotClick = (lot) => landPanel.open(lot)

    this.saver = new AutoSaver(() => ({
      city: this.city.toSave(),
      clock: { playedMs: this.clock.playedMs },
      taxes: this.taxes.toSave(),
      player: this.player.toSave(),
    }))
    this.loadOrSeed()
    // Save shortly after anything changes.
    this.city.onChange(() => this.saver.requestSave())
    this.taxes.onChange(() => this.saver.requestSave())
    this.player.onChange(() => this.saver.requestSave())

    window.addEventListener('resize', () => this.resize())
    this.resize()
  }

  start() {
    this.renderer.setAnimationLoop(() => this.tick())
  }

  // Runs once per frame.
  private tick() {
    const frameTime = performance.now()
    const dt = frameTime - this.lastFrame
    this.lastFrame = frameTime

    for (const month of this.clock.advance(dt)) this.taxes.endOfMonth(month)
    this.followSun()

    const now = Date.now()
    this.cityView.update(now)
    this.incomeView.update(now)
    this.hud.update(this.clock, now)
    this.renderer.render(this.scene, this.camera)
    this.labelRenderer.render(this.scene, this.camera)
  }

  private loadOrSeed() {
    const save = readSave()
    if (save) {
      // Order matters: the clock first (Taxes reads it), then the town, then
      // the tax books, which replace the records City's 'added' events created.
      this.clock.playedMs = save.clock.playedMs
      this.city.load(save.city)
      this.taxes.load(save.taxes)
      if (save.player) this.player.load(save.player)
      return
    }
    // A small starting town so a new game isn't an empty field.
    // (Tiles 20–39 are the starting land in the middle of the world.)
    const start: [string, number, number][] = [
      ['cottage', 29, 29],
      ['farm-plot', 32, 29],
      ['oak-tree', 28, 32],
      ['oak-tree', 31, 32],
      ['oak-tree', 27, 28],
    ]
    for (const [id, x, z] of start) this.city.place(BUILDINGS_BY_ID.get(id)!, { x, z }, { free: true })
    // Strawberries already 40 s in on the starting plot, so the first harvest comes quickly.
    const plot = this.city.buildingAt({ x: 32, z: 29 })!
    this.city.plant(plot.id, CROPS_BY_ID.get('strawberries')!, { now: Date.now() - 40_000, free: true })
  }

  private newTown() {
    if (!confirm('Start a new town? Your current town will be deleted.')) return
    this.saver.disable()
    clearSave()
    location.reload()
  }

  private showPlayerEvents(levelUpPanel: LevelUpPanel) {
    this.player.onChange((event) => {
      if (event.kind === 'xp' && event.building) this.incomeView.popup(event.building, `+${event.amount} ⭐`, 'xp')
      if (event.kind === 'levelUp') levelUpPanel.show(event)
    })
  }

  // Turn tax events into pop-ups, messages and the Tax Day report.
  private showTaxEvents(taxPanel: TaxPanel) {
    this.taxes.onChange((event) => {
      switch (event.kind) {
        case 'salesTax':
          this.incomeView.popup(event.building, `+${event.amount} sales tax (held)`, 'note')
          break
        case 'remitted': {
          const lastMonth = MONTH_NAMES[event.quarter * 3 - 1]
          this.hud.toast(`Quarter ${event.quarter} sales tax of 🪙 ${event.amount} sent to the state (end of ${lastMonth})`)
          break
        }
        case 'penalty':
          this.hud.toast(`Late tax penalty: 🪙 ${event.amount}`, 'warn')
          break
        case 'taxDay':
          taxPanel.showTaxDay(event.taxReturn)
          break
      }
    })
  }

  private resize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    const aspect = w / h
    this.camera.left = (-VIEW_SIZE * aspect) / 2
    this.camera.right = (VIEW_SIZE * aspect) / 2
    this.camera.top = VIEW_SIZE / 2
    this.camera.bottom = -VIEW_SIZE / 2
    this.camera.near = -100
    this.camera.far = 200
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
    this.labelRenderer.setSize(w, h)
  }

  private addLights() {
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#6b8e4e', 1.2))

    // Shadows are drawn into a square texture covering the sun's "shadow
    // camera" box. Covering the whole 60×60 world would make them blurry, so
    // the box covers about what's on screen and follows the view (followSun).
    const sun = this.sun
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    const s = 24
    Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s })
    this.scene.add(sun, sun.target)
    this.followSun()
  }

  // Keep the sun at the same angle to whatever the camera is looking at.
  private followSun() {
    const target = this.controls.target
    this.sun.target.position.copy(target)
    this.sun.position.copy(target).add(SUN_OFFSET)
  }
}
