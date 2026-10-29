import * as THREE from 'three'
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
import { BuildMenu } from '../ui/BuildMenu'
import { BuildingPanel, canStore } from '../ui/BuildingPanel'
import { CollectionsPanel } from '../ui/CollectionsPanel'
import { Coach } from '../ui/Coach'
import { CropPicker } from '../ui/CropPicker'
import { InventoryPanel } from '../ui/InventoryPanel'
import { MapPanel } from '../ui/MapPanel'
import { neighborsList } from '../ui/NeighborsList'
import { DebugPanel } from '../ui/DebugPanel'
import { HelpPanel } from '../ui/HelpPanel'
import { SettingsPanel } from '../ui/SettingsPanel'
import { Sound } from '../ui/sound'
import { QuestsPanel } from '../ui/QuestsPanel'
import { el } from '../ui/dom'
import { Modal, Sheet, button } from '../ui/Sheet'
import { DockPanel } from '../ui/DockPanel'
import { Hud } from '../ui/Hud'
import { LandPanel } from '../ui/LandPanel'
import { LevelUpPanel } from '../ui/LevelUpPanel'
import { TownPanel } from '../ui/TownPanel'
import { WelcomeBackPanel } from '../ui/WelcomeBackPanel'
import { TaxPanel } from '../ui/TaxPanel'
import { Builder } from './Builder'
import { CameraController } from './CameraController'
import type { PlacedBuilding } from './City'
import { CityView } from './CityView'
import { ContextMenu } from './ContextMenu'
import { MATERIAL_IDS, materialsText } from './items'
import { finishConstruction, upgradeBuilding, type ProjectResult } from './projects'
import type { Neighbor } from './neighborData'
import { Visit } from './Visit'
import { GRANT, canClaimGrant } from './safetyNet'
import { CROPS_BY_ID } from './crops'
import { MONTH_NAMES } from './GameClock'
import { QualityGovernor, type QualityLevel } from './quality'
import { GameState } from './GameState'
import { SaveSystem } from './SaveSystem'
import { LOT_FOOTPRINT, footprintCenter, lotCorner, tileToWorld, worldToTile, type Lot } from './grid'
import { IncomeView } from './IncomeView'
import { LandView } from './LandView'
import { WELCOME_BACK_AFTER_MS, awaySummary } from './offline'
import { PeopleView } from './PeopleView'
import { RoadView } from './RoadView'
import { ShipView } from './ShipView'
import { AutoSaver } from './save'
import { UTILITY_INFO } from './utilityRules'

// In development, ?speed=60 makes a game month last one second.
function devSpeed(): number {
  return import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('speed')) || 1 : 1
}

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

  // Every game system (GameState.ts), and the save (SaveSystem.ts). The
  // short names below are just for convenience in this file.
  private state = new GameState(devSpeed())
  private saves = new SaveSystem(this.state)
  private city = this.state.city
  private player = this.state.player
  private services = this.state.services
  private docks = this.state.docks
  private inventory = this.state.inventory
  private collections = this.state.collections
  private quests = this.state.quests
  private neighbors = this.state.neighbors
  private unlocks = this.state.unlocks
  private placement = this.state.placement
  private settings = this.state.settings
  private tutorial = this.state.tutorial
  private clock = this.state.clock
  private taxes = this.state.taxes
  private visit: Visit | null = null
  private homeView: THREE.Vector3 | null = null // where the camera was before a visit

  // Views and UI that react to the state.
  private cityView: CityView
  private peopleView: PeopleView
  private roadView: RoadView
  private landView: LandView
  private shipView: ShipView
  private incomeView: IncomeView
  private contextMenu!: ContextMenu
  private buildingPanel!: BuildingPanel
  private hud: Hud
  private saver: AutoSaver
  private lastFrame = performance.now()
  private loaded = false
  private quality = new QualityGovernor()

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

    // Everything that listens to City must exist before the town is loaded,
    // or it misses the 'added' events.
    const landView = new LandView(this.scene, this.city)
    this.landView = landView
    this.shipView = new ShipView(this.scene, this.city, this.docks)
    this.cityView = new CityView(this.scene, this.city)
    this.peopleView = new PeopleView(this.scene, this.city)
    this.roadView = new RoadView(this.scene, this.city)
    const builder = new Builder(this.scene, this.city, this.player, this.docks, this.cityView, this.controls, this.renderer.domElement)
    this.incomeView = new IncomeView(this.scene, this.city, this.cityView, this.services, this.docks, (b) => builder.tap(b))
    builder.onHoverBuilding = (b) => this.incomeView.setHovered(b)

    const taxPanel = new TaxPanel(container, this.city, this.taxes, this.clock)
    const townPanel = new TownPanel(container, this.city, this.services)
    const help = new HelpPanel(container, () => this.tutorial.load({ step: 0, skipped: false }))
    const buildMenu = new BuildMenu(container, this.city, this.player, this.placement, this.unlocks, (type) =>
      builder.setMode({ kind: 'build', type }),
    )
    const notice = (message: string) => this.hud.toast(message)
    const inventoryPanel = new InventoryPanel(container, this.city, this.inventory, (b) => builder.setMode({ kind: 'restore', building: b }), notice)
    const collectionsPanel = new CollectionsPanel(container, this.collections, this.inventory)
    const questsPanel = new QuestsPanel(container, this.quests, this.player)
    const landPanelForMap = (lot: Lot) => this.landPanel?.open(lot)
    const mapPanel: MapPanel = new MapPanel(
      container,
      this.city,
      () => worldToTile(this.controls.target) ?? { x: 30, z: 30 },
      (tile) => this.controls.centerOn(tileToWorld(tile)),
      landPanelForMap,
      () =>
        neighborsList(this.neighbors, {
          visit: (n) => {
            mapPanel.close()
            this.startVisit(container, builder, n)
          },
          claimGift: (n) => {
            const g = this.neighbors.gift(n, Date.now())
            if (this.neighbors.claimGift(n, Date.now())) this.hud.toast(`🎁 ${n.name} sent ${g.amount} ${g.material}. Gifts aren't taxable income.`)
          },
          fulfill: (n) => {
            const thanks = this.neighbors.fulfill(n, Date.now())
            if (thanks) this.hud.toast(`${n.avatar} ${n.name} thanks you with a gift of 🪙 ${thanks}!`)
          },
        }),
    )
    this.neighbors.onChange(() => mapPanel.refresh())
    this.hud = new Hud(container, builder, this.city, this.player, this.services, {
      onOpenBuild: () => {
        builder.setMode({ kind: 'select' })
        buildMenu.open()
      },
      onOpenQuests: () => {
        questsPanel.open()
        this.tutorial.complete('quests')
      },
      onOpenInventory: () => inventoryPanel.open(),
      onOpenCollections: () => collectionsPanel.open(),
      onOpenMap: () => mapPanel.open(),
      onOpenTaxes: () => taxPanel.open(),
      onOpenTown: () => townPanel.open(),
      onOpenSettings: () => this.settingsPanel.open(),
      onOpenHelp: () => help.open(),
      onRecenter: () => this.recenter(),
      onOpenDebug: import.meta.env.DEV ? () => this.debugPanel(container).open() : undefined,
    })
    this.setUpSelection(container, builder)
    new Coach(container, this.tutorial)
    this.controls.onMove = () => this.tutorial.complete('camera')
    this.hud.onGoHome = () => this.endVisit()
    // Apply settings now and whenever they change.
    this.settings.onChange((s) => {
      this.sound.setVolume(s.soundVolume)
      this.sound.setMusic(s.music)
      landView.setGridVisible(s.showGrid)
      landView.calmSea = s.reduceMotion
      this.peopleView.setVisible(s.showPeople)
      builder.confirmPurchases = s.confirmPurchases
      document.body.classList.toggle('reduce-motion', s.reduceMotion)
      this.cityView.popIn = this.loaded && !s.reduceMotion
    })
    this.showTaxEvents(taxPanel)
    const cropPicker = new CropPicker(container, this.city, this.player, (message) => this.hud.toast(message))
    builder.onPlantRequest = (plot) => cropPicker.open(plot)
    this.showPlayerEvents(new LevelUpPanel(container))
    this.showCollectionEvents()
    this.services.onChange((event) => {
      if (event.kind !== 'shortage') return
      const names = event.utilities.map((u) => `${UTILITY_INFO[u].icon} ${UTILITY_INFO[u].name.toLowerCase()}`)
      this.hud.toast(`Not enough ${names.join(', ')}: income drops. Tap Town to see what to build.`, 'warn')
    })
    const landPanel = new LandPanel(container, this.city, this.player, this.inventory, (message) => this.hud.toast(message))
    this.landPanel = landPanel
    landView.onLotClick = (lot) => landPanel.open(lot)
    this.showQuestEvents()
    const dockPanel = new DockPanel(container, this.city, this.docks, (message) => this.hud.toast(message))
    builder.onDockRequest = (dock) => dockPanel.open(dock)

    this.saver = new AutoSaver(() => this.saves.toSave())
    this.settingsPanel = new SettingsPanel(container, this.settings, this.saver, (message, kind) => this.hud.toast(message, kind))
    const { savedAt: leftAt, problem } = this.saves.restoreOrStart()
    // From now on new buildings spring into place (unless motion is reduced).
    this.loaded = true
    this.cityView.popIn = !this.settings.values.reduceMotion
    this.loadProblem = problem
    this.setUpSounds(builder)
    if (this.loadProblem) {
      const notice = new Modal(container)
      notice.body.append(el('p', '', this.loadProblem))
      notice.show('💾 About your save', button('OK', () => notice.close()))
    }
    this.setUpSafetyNet(container)
    this.setUpWelcomeBack(container, builder, leftAt)
    // Save shortly after anything changes.
    this.saves.watch(() => this.saver.requestSave())

    window.addEventListener('resize', () => this.resize())
    this.resize()
  }

  // A new version of the game has downloaded (main.ts). Ask before switching,
  // saving first so nothing is lost.
  offerUpdate(apply: () => void) {
    const modal = new Modal(this.container)
    modal.body.append(el('p', '', 'A new version of Hearthvale is ready. Your town is saved and will be right where you left it.'))
    modal.show(
      '✨ Update ready',
      button('Update now', () => {
        this.saver.saveNow()
        apply()
      }),
      button('Later', () => modal.close(), 'panel-button secondary'),
    )
  }

  start() {
    this.renderer.setAnimationLoop(() => this.tick())
  }

  // Runs once per frame.
  private tick() {
    const frameTime = performance.now()
    const dt = frameTime - this.lastFrame
    this.lastFrame = frameTime
    const quality = this.quality.frame(dt)
    if (quality) this.applyQuality(quality)

    for (const month of this.clock.advance(dt)) {
      // Utility bills first, so December's land on this year's return.
      this.services.endOfMonth()
      this.taxes.endOfMonth(month)
    }
    this.followSun()

    const now = Date.now()
    this.cityView.update(now)
    this.contextMenu.update(now)
    this.buildingPanel.update(now)
    this.roadView.update()
    this.controls.update(Math.min(dt, 100) / 1000)
    const seconds = frameTime / 1000
    this.landView.update(seconds)
    this.shipView.update(Math.min(dt, 100) / 1000, seconds, now)
    // Capped, so a tab coming back from the background doesn't teleport everyone.
    this.peopleView.update(Math.min(dt, 100) / 1000)
    this.incomeView.update(now)
    this.hud.update(this.clock, now)
    // Visiting a neighbor: draw their town instead (yours carries on underneath).
    if (this.visit) {
      this.visit.update(Math.min(dt, 100) / 1000, seconds, now)
      this.visit.render(this.renderer, this.camera)
      return
    }
    this.renderer.render(this.scene, this.camera)
    this.labelRenderer.render(this.scene, this.camera)
  }

  // Returns when the player last left (the save's time), or null for a new town.
  // Show what happened while you were away: when the game opens after a
  // while, and when you come back to a tab that's been hidden for a while.
  private setUpWelcomeBack(container: HTMLElement, builder: Builder, leftAt: number | null) {
    const panel = new WelcomeBackPanel(container, () => {
      const result = builder.collectAll()
      let message = `Collected ${result.actions} for 🪙 ${result.coins}`
      if (result.outOfEnergy) message = result.actions === 0 ? 'Out of energy ⚡' : `${message}. Out of energy for the rest ⚡`
      this.hud.toast(message, result.outOfEnergy ? 'warn' : 'info')
    })
    const welcome = (since: number) => {
      const now = Date.now()
      if (now - since >= WELCOME_BACK_AFTER_MS) panel.show(awaySummary(this.city, this.player, this.docks, since, now))
    }
    if (leftAt !== null) welcome(leftAt)
    let hiddenAt: number | null = null
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now()
      else if (hiddenAt !== null) welcome(hiddenAt)
    })
  }

  // Selecting a building: its context menu on the map, the details sheet,
  // and the actions both offer.
  private setUpSelection(container: HTMLElement, builder: Builder) {
    const confirmRemove = new Modal(container)
    const remove = (b: PlacedBuilding) => {
      // Removing a road can cut shops off: say which, before it happens.
      const cut = b.type.category === 'road' ? this.city.cutOffBy(b) : []
      confirmRemove.body.replaceChildren(
        el('p', '', `Tear down this ${b.type.name}? You get nothing back for it.`),
        ...(cut.length
          ? [el('p', 'warning', `🚧 This road is the only one beside: ${cut.map((c) => c.type.name).join(', ')}. ${cut.length === 1 ? 'It' : 'They'} will stop selling until reconnected.`)]
          : []),
        el('p', 'muted', "No tax deduction either: in the US, a demolished building's leftover cost is added to the land's value instead (IRC §280B)."),
      )
      confirmRemove.show(
        `🗑️ Remove ${b.type.name}?`,
        button('Keep it', () => confirmRemove.close(), 'panel-button secondary'),
        button('Remove', () => {
          confirmRemove.close()
          this.city.remove(b.id)
        }, 'panel-button danger'),
      )
    }
    const move = (b: PlacedBuilding) => {
      Sheet.closeCurrent()
      builder.setMode({ kind: 'move', carrying: b })
    }
    const store = (b: PlacedBuilding) => {
      Sheet.closeCurrent()
      if (this.city.store(b.id)) this.hud.toast(`${b.type.name} is in your Inventory. Place it again any time, free.`)
    }
    // Explain why a finish or upgrade didn't happen.
    const explain = (r: ProjectResult, what: string) => {
      if (r.ok) return
      if (r.reason === 'materials') this.hud.toast(`${what} needs ${materialsText(r.missing)} more. Buy them in Details.`, 'warn')
      if (r.reason === 'coins') this.hud.toast(`Not enough coins to ${what.toLowerCase()}`, 'warn')
      if (r.reason === 'level') this.hud.toast(`Reach a higher level to ${what.toLowerCase()}`, 'warn')
      if (r.reason === 'room') this.hud.toast('No room for more residents: build a Park, Fire Station or School first', 'warn')
    }
    const finish = (b: PlacedBuilding) => {
      const result = finishConstruction(this.city, this.inventory, b, Date.now())
      explain(result, `Finishing the ${b.type.name}`)
      if (!result.ok && result.reason === 'materials') this.buildingPanel.open(b)
    }
    builder.onFinishRequest = finish
    builder.placement = this.placement
    this.docks.speedBonus = () => this.services.shipSpeedBonus()
    this.buildingPanel = new BuildingPanel(
      container,
      {
        city: this.city,
        services: this.services,
        taxes: this.taxes,
        docks: this.docks,
        inventory: this.inventory,
        player: this.player,
        describe: (b, now) => this.incomeView.describe(b, now),
      },
      {
        collect: (b) => builder.tap(b),
        restock: (b) => {
          if (this.city.production.restock(b.id) === 0) this.hud.toast('Nothing to restock: storage is empty or the shelves are full')
        },
        upgrade: (b) => explain(upgradeBuilding(this.city, this.inventory, this.player, b, (n) => this.services.roomFor(n)), 'Upgrade'),
        buyMaterials: (m) => {
          if (!this.inventory.buy(m)) this.hud.toast('Not enough coins for those materials', 'warn')
        },
        move,
        store,
        remove,
      },
    )
    this.contextMenu = new ContextMenu(this.scene, this.cityView, this.incomeView, [
      { icon: 'ℹ️', label: 'Details', run: (b) => this.buildingPanel.open(b) },
      { icon: '✋', label: 'Move', run: move },
      { icon: '⟳', label: 'Turn', run: (b) => builder.turnPlaced(b), when: (b) => b.type.category !== 'road' },
      { icon: '🎒', label: 'Store', run: store, when: (b) => canStore(b, this.city, this.docks) },
      { icon: '🗑️', label: 'Remove', run: remove },
    ])
    builder.onSelect = (b) => {
      this.contextMenu.show(b)
      if (b) this.tutorial.complete('select')
    }
    // A tap on the map while a sheet is open just closes the sheet.
    builder.allowDrag = () => !this.visit
    builder.interceptClick = (x, y) => {
      if (Sheet.closeCurrent()) return true
      if (!this.visit) return false
      this.visit.click(x, y)
      return true
    }
  }

  private settingsPanel!: SettingsPanel
  private loadProblem: string | null = null
  private sound = new Sound()

  private landPanel: LandPanel | null = null

  // Sounds for what happens in the game, and a soft click for buttons.
  private setUpSounds(builder: Builder) {
    this.city.onChange((e) => {
      if (e.kind === 'collected') this.sound.play('collect')
      if (e.kind === 'harvested') this.sound.play('harvest')
      if (e.kind === 'added' && e.paid > 0) this.sound.play('place')
      if (e.kind === 'finished' || e.kind === 'upgraded') this.sound.play('place')
      if (e.kind === 'goodsIn') this.sound.play('ship')
    })
    this.player.onChange((e) => e.kind === 'levelUp' && this.sound.play('levelup'))
    const notice = builder.onNotice
    builder.onNotice = (message) => {
      notice?.(message)
      this.sound.play('error') // builder notices explain why something didn't happen
    }
    document.addEventListener('click', (e) => {
      if (e.target instanceof Element && e.target.closest('button')) this.sound.play('click')
    })
  }

  // Back to the middle of your own land at the normal zoom.
  private recenter() {
    const lots = [...this.city.ownedLots()]
    const middle = lots
      .map(({ lot }) => footprintCenter(lotCorner(lot), LOT_FOOTPRINT))
      .reduce((sum, p) => sum.add(p), new THREE.Vector3())
      .divideScalar(Math.max(1, lots.length))
    this.controls.reset(middle)
  }

  private debug: DebugPanel | null = null

  private debugPanel(container: HTMLElement): DebugPanel {
    this.debug ??= new DebugPanel(container, {
      coins: () => this.city.economy.adjust(1000),
      xp: () => this.player.grantXp(100),
      materials: () => {
        for (const id of MATERIAL_IDS) this.inventory.add(id, 10)
      },
      goods: () => this.city.economy.addGoods(100, 0),
      energy: () => this.player.grantEnergy(this.player.maxEnergy),
      finishTimers: () => {
        const now = Date.now()
        for (const b of this.city.all()) {
          if (b.construction) b.construction.endsAt = now
          if (b.type.income) b.readyAt = now
          if (b.crop) {
            const crop = CROPS_BY_ID.get(b.crop.cropId)
            if (crop) b.crop.plantedAt = now - crop.growSeconds * 1000
          }
        }
        for (const s of this.docks.all()) s.arrivesAt = now
        this.saver.requestSave()
      },
      nextMonth: () => {
        for (const month of this.clock.skipMonth()) {
          this.services.endOfMonth()
          this.taxes.endOfMonth(month)
        }
      },
    })
    return this.debug
  }

  private startVisit(container: HTMLElement, builder: Builder, n: Neighbor) {
    if (this.visit) this.endVisit()
    builder.setMode({ kind: 'select' })
    builder.select(null)
    this.homeView = this.controls.target.clone()
    this.visit = new Visit(container, n, this.neighbors, this.controls)
    this.visit.resize(this.container.clientWidth, this.container.clientHeight)
    this.labelRenderer.domElement.hidden = true
    this.controls.centerOn(new THREE.Vector3(0, 0, 0))
    const showBar = () => this.visit && this.hud.setVisit({ ...n, helpsLeft: this.neighbors.helpsLeft(n, Date.now()) })
    this.visit.onChange = showBar
    this.visit.onNotice = (m) => this.hud.toast(m)
    showBar()
    this.hud.toast(`${n.avatar} ${n.name}: “${n.greeting}”`)
  }

  private endVisit() {
    this.visit?.dispose()
    this.visit = null
    this.labelRenderer.domElement.hidden = false
    if (this.homeView) this.controls.centerOn(this.homeView)
    this.hud.setVisit(null)
  }

  // The safety net (safetyNet.ts): if the town has nothing that earns and
  // can't afford anything that would, offer the county grant.
  private setUpSafetyNet(container: HTMLElement) {
    const modal = new Modal(container)
    let offered = false
    const check = () => {
      const now = Date.now()
      if (!canClaimGrant(this.city, this.state.safetyNet.lastGrantAt, now)) {
        offered = false
        return
      }
      if (offered) return
      offered = true
      modal.body.replaceChildren(
        el('p', '', `Your town has nothing left that earns coins, and not enough to build something that would. The county offers a ${GRANT}-coin grant to get you going again.`),
        el('p', 'muted', 'Grants to a business are taxable income, so it will show on your return like other prizes.'),
      )
      modal.show(
        '🤝 A helping hand',
        button(`Accept 🪙 ${GRANT}`, () => {
          modal.close()
          this.state.safetyNet.lastGrantAt = Date.now()
          this.city.economy.award(GRANT, 'County grant', { payDebt: false })
        }),
      )
    }
    // After the event that caused it has finished, so the town is in its final state.
    this.city.onChange((e) => {
      if (e.kind === 'coins' || e.kind === 'removed' || e.kind === 'stored') queueMicrotask(check)
    })
    check()
  }

  private showQuestEvents() {
    const badge = () => this.hud.setBadge('Quests', this.quests.readyCount())
    this.quests.onChange((e) => {
      if (e.kind === 'questDone') this.hud.toast(`📜 Quest complete: ${e.quest.title}! Claim your reward in Quests.`)
      if (e.kind === 'achievement') this.hud.toast(`${e.achievement.icon} Achievement: ${e.achievement.name} ${'★'.repeat(e.tier)}`)
      badge()
    })
    badge()
  }

  private showCollectionEvents() {
    this.collections.onChange((e) => {
      if (e.kind === 'found') {
        const building = 'building' in e.event ? e.event.building : null
        if (building) this.incomeView.popup(building, `${e.item.icon} ${e.item.name} found!`, 'note')
        else this.hud.toast(`${e.item.icon} Found a ${e.item.name} for your collections!`)
      }
      if (e.kind === 'completed') this.hud.toast(`🏆 ${e.collection.name} complete! Reward collected.`)
    })
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

  // Lower the drawing quality (quality.ts decides when).
  private applyQuality(level: QualityLevel) {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, level.maxPixelRatio))
    this.sun.castShadow = level.shadowMapSize > 0
    if (level.shadowMapSize > 0 && level.shadowMapSize !== this.sun.shadow.mapSize.x) {
      this.sun.shadow.mapSize.set(level.shadowMapSize, level.shadowMapSize)
      this.sun.shadow.map?.dispose()
      this.sun.shadow.map = null // three.js makes a new one at the new size
    }
    this.resize()
    if (import.meta.env.DEV) console.info(`Drawing quality: ${level.name}`)
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
    this.visit?.resize(w, h)
  }

  private addLights() {
    // Sky-blue light from above and warm green bounce from below keep shadows colorful, not gray.
    this.scene.add(new THREE.HemisphereLight('#e8f4ff', '#8fbf6a', 1.3))

    // Shadows are drawn into a square texture covering the sun's "shadow
    // camera" box. Covering the whole 60×60 world would make them blurry, so
    // the box covers about what's on screen and follows the view (followSun).
    const sun = this.sun
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    // Nudge shadow tests off each surface, or surfaces shadow themselves in
    // a speckled pattern ("shadow acne") that grays out their colors.
    sun.shadow.bias = -0.0005
    sun.shadow.normalBias = 0.03
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
