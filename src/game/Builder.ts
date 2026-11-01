import * as THREE from 'three'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { footprint, type BuildingType, type Rotation, isTrack, isPlot } from './buildings'
import type { CameraController, Carry } from './CameraController'
import { duration, outOfEnergyMessage } from '../ui/dom'
import { sizeOf, type City, type PlacedBuilding } from './City'
import type { CityView } from './CityView'
import { cropState } from './crops'
import type { Docks } from './Docks'
import { footprintCenter, footprintTiles, lotOf, worldToTile, type Lot, type Tile } from './grid'
import { createBuildingObject } from './models'
import type { PlacementSystem, Spot } from './PlacementSystem'
import { PRODUCTS, inputsText, soldBy } from './products'
import { MARKET_ID } from './market'
import { collectReach } from './progression'
import type { Player } from './Player'

// What a click on the map currently does.
export type Mode =
  | { kind: 'select' }
  | { kind: 'build'; type: BuildingType }
  | { kind: 'move'; carrying: PlacedBuilding }
  | { kind: 'restore'; building: PlacedBuilding } // placing a stored building back
  | { kind: 'removeRoads'; picked: Set<number> } // picking road tiles to remove together

const COLORS = { hover: '#ffffff', ok: '#4ade80', blocked: '#ef4444' }

// The pointer's tile should sit near the middle of a big footprint, not at its
// corner, so shift the footprint back by half its size.
function anchorFor(type: BuildingType, tile: Tile, rotation: Rotation): Tile {
  const size = footprint(type, rotation)
  return { x: tile.x - Math.floor(size.x / 2), z: tile.z - Math.floor(size.z / 2) }
}

// Handles taps on the map: collecting and tending buildings, selecting one
// for its context menu, placing new buildings (a ghost preview, then ✓ to buy)
// and moving them. Shows the colored footprint under the pointer.
export class Builder {
  mode: Mode = { kind: 'select' }
  private modeListeners: ((mode: Mode) => void)[] = []

  // Called whenever the mode changes (the HUD's hint bar, the tile grid).
  onModeChange(listener: (mode: Mode) => void) {
    this.modeListeners.push(listener)
  }
  // While picking roads to remove: how many are picked.
  onRoadsPicked?: (count: number) => void
  onHoverBuilding?: (building: PlacedBuilding | null) => void
  // Short messages for the player, e.g. why a click did nothing.
  onNotice?: (message: string) => void
  // An empty farm plot was tapped: show the seeds to choose from.
  onPlantRequest?: (plot: PlacedBuilding) => void
  // An idle dock was tapped: show the shipments to order.
  onDockRequest?: (dock: PlacedBuilding) => void
  onMarketRequest?: () => void
  // Is a tree, rock or bush growing on this tile (wilds.ts)? Tapping one clears it.
  wildAt?: (tile: Tile) => boolean
  onWildTap?: (tile: Tile) => void
  // Tapping an empty tile of your land offers "Build here" (Game opens the
  // build menu); tapping land you could buy offers it.
  onBuildHere?: (tile: Tile) => void
  onLotRequest?: (lot: Lot) => void
  // Tapping a damaged building asks to repair it (Game does it, with Disasters).
  onRepairRequest?: (building: PlacedBuilding) => void
  // A construction site whose timer is done was tapped: finish it.
  onFinishRequest?: (building: PlacedBuilding) => void
  // The selected building changed (null: nothing selected).
  onSelect?: (building: PlacedBuilding | null) => void
  // Asked first on every map tap; return true to swallow the tap (Game uses
  // it so a tap on the map just closes an open sheet).
  interceptClick?: (clientX: number, clientY: number) => boolean
  // The building drawn under a screen position, if any (else the tile under it counts).
  pickAt?: (clientX: number, clientY: number) => PlacedBuilding | null
  // Whether buildings can be dragged right now (not while visiting a neighbor).
  allowDrag: () => boolean = () => true

  // The building whose context menu is showing.
  selected: PlacedBuilding | null = null

  private scene: THREE.Scene
  private city: City
  private player: Player
  private docks: Docks
  // Whether the spot under the pointer works, in words (not just green or red).
  onPlacementInfo?: (text: string | null) => void
  // Settings: when false, a tap buys and places right away, without the ✓ step.
  confirmPurchases = true
  // Every placement rule (unlocks, coins, room, rating, fit, roads). Game sets it.
  placement!: PlacementSystem
  private cityView: CityView
  private controls: CameraController
  private hoverTile: Tile | null = null
  private footprint: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  private ghost: THREE.Group | null = null
  // While placing a community building: the area its bonus reaches.
  private area: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  // The last tile painted in a road drag, to fill in tiles a fast drag skips over.
  private lastPainted: Tile | null = null
  // Where a new building would go, waiting for ✓ (buy) or ✗ (cancel).
  private tileMenu: CSS2DObject
  private menuTile: Tile | null = null
  private pending: Tile | null = null // restoring: the spot waiting for ✓
  // Building new: every spot picked so far, each with its own see-through
  // copy of the building, all bought together with one ✓.
  private spots: { tile: Tile; rotation: Rotation; ghost: THREE.Group }[] = []
  private spotMaterial = new THREE.MeshLambertMaterial({ color: '#4ade80', transparent: true, opacity: 0.55 })
  // How many spots are picked and what they cost together (for the Buy button).
  onSpotsChanged?: (count: number, totalCost: number) => void
  // Roads picked for removal are marked in red.
  private pickedMarks = new THREE.Group()
  private pickedMaterial = new THREE.MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.55, depthWrite: false })
  private dragUnpicks = false
  // While dragging a building: where its corner is relative to the tile under
  // the finger, so the spot you grabbed stays under your finger.
  private dragOffset: Tile | null = null
  // How the building being placed or moved is turned (⟳ or the R key).
  private rotation: Rotation = 0
  private confirm: CSS2DObject
  // An outline around the selected building.
  private selection: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  // One shared see-through material for the ghost; we just recolor it.
  private ghostMaterial = new THREE.MeshLambertMaterial({ transparent: true, opacity: 0.6 })

  constructor(
    scene: THREE.Scene,
    city: City,
    player: Player,
    docks: Docks,
    cityView: CityView,
    controls: CameraController,
    canvas: HTMLCanvasElement,
  ) {
    this.scene = scene
    this.city = city
    this.player = player
    this.docks = docks
    this.cityView = cityView
    this.controls = controls

    this.footprint = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), // lay it flat once, so scaling x/z is simple
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.45, depthWrite: false }),
    )
    this.footprint.visible = false
    scene.add(this.footprint)
    this.area = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#5aa0e0', transparent: true, opacity: 0.18, depthWrite: false }),
    )
    this.area.visible = false
    scene.add(this.area)
    this.selection = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#ffd84d', transparent: true, opacity: 0.5, depthWrite: false }),
    )
    this.selection.visible = false
    scene.add(this.selection)
    scene.add(this.pickedMarks)

    // The ✓ / ✗ buttons shown over a building waiting to be bought.
    // The little "Build here" button over an empty tile you tapped.
    const tileEl = document.createElement('div')
    tileEl.className = 'place-confirm'
    const here = document.createElement('button')
    here.className = 'tile-build'
    here.textContent = '🔨 Build here'
    here.addEventListener('click', () => {
      const tile = this.menuTile
      this.showTileMenu(null)
      if (tile) this.onBuildHere?.(tile)
    })
    tileEl.append(here)
    this.tileMenu = new CSS2DObject(tileEl)
    this.tileMenu.center.set(0.5, 1)
    this.tileMenu.visible = false
    scene.add(this.tileMenu)

    const confirmEl = document.createElement('div')
    confirmEl.className = 'place-confirm'
    const yes = document.createElement('button')
    yes.className = 'place-yes'
    yes.textContent = '✓'
    yes.title = 'Buy and place'
    yes.addEventListener('click', () => this.confirmPlacement())
    const no = document.createElement('button')
    no.className = 'place-no'
    no.textContent = '✕'
    no.title = 'Cancel'
    no.addEventListener('click', () => {
      this.setPending(null)
      this.clearSpots()
      this.showSpots()
    })
    const turn = document.createElement('button')
    turn.className = 'place-turn'
    turn.textContent = '⟳'
    turn.title = 'Turn (R)'
    turn.addEventListener('click', () => this.turn())
    confirmEl.append(no, turn, yes)
    this.confirm = new CSS2DObject(confirmEl)
    this.confirm.center.set(0.5, 1)
    this.confirm.visible = false
    scene.add(this.confirm)

    canvas.addEventListener('pointermove', (e) => this.updateHover(e.clientX, e.clientY))
    canvas.addEventListener('pointerleave', () => {
      this.hoverTile = null
      this.refresh()
    })
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault() // right-click cancels instead of opening the browser menu
      if (this.dragOffset) return // some phones send this on a long press: that's a pick-up
      this.setMode({ kind: 'select' })
    })
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.setMode({ kind: 'select' })
      if (e.key === 'r' || e.key === 'R') this.turn()
    })
    controls.onClick = (x, y) => this.onClick(x, y)
    controls.grab = (x, y, held) => this.grab(x, y, held)
    city.onChange((e) => {
      if ((e.kind === 'removed' || e.kind === 'stored') && this.selected?.id === e.building.id) this.select(null)
      if (e.kind === 'moved' && this.selected?.id === e.building.id) this.refresh()
    })
  }

  private showTileMenu(tile: Tile | null) {
    this.menuTile = tile
    this.tileMenu.visible = tile !== null
    if (tile) this.tileMenu.position.copy(footprintCenter(tile, { x: 1, z: 1 })).setY(0.35)
    if (tile) this.showFootprint(tile, { x: 1, z: 1 }, COLORS.hover)
  }

  setMode(mode: Mode) {
    this.showTileMenu(null)
    // Clean up the old mode: cancel any building waiting for ✓ (first, while
    // the old mode's ghost still exists), drop the ghost and un-hide anything
    // we were carrying.
    this.setPending(null)
    this.clearSpots()
    if (this.ghost) this.scene.remove(this.ghost)
    this.ghost = null
    if (this.mode.kind === 'move') this.cityView.setVisible(this.mode.carrying.id, true)
    if (mode.kind !== 'select') this.select(null)

    this.mode = mode
    const type = this.placingType()
    if (type) {
      this.ghost = createBuildingObject(type, this.ghostMaterial)
      this.scene.add(this.ghost)
    }
    // A moved building keeps its turn; new ones start facing the default way.
    this.rotation = mode.kind === 'move' ? mode.carrying.rotation : 0
    if (mode.kind === 'move') this.cityView.setVisible(mode.carrying.id, false)
    // Roads are drawn by dragging, and picked for removal by dragging;
    // everything else drags the camera.
    this.controls.paint =
      mode.kind === 'build' && isTrack(mode.type)
        ? (x, y, first) => this.paintRoad(x, y, first)
        : mode.kind === 'removeRoads'
          ? (x, y, first) => this.dragPick(x, y, first)
          : null
    this.showPicked()

    this.refresh()
    for (const listener of this.modeListeners) listener(mode)
  }

  // Turn the building being placed or moved a quarter turn.
  turn() {
    if (!this.placingType()) return
    this.rotation = ((this.rotation + 1) % 4) as Rotation
    // A building waiting for ✓ turns where it stands, if it still fits.
    if (this.pending) this.setPending(this.pending)
    // So does the last spot picked, if it still fits among the others.
    const last = this.spots.at(-1)
    if (last && this.mode.kind === 'build') {
      const turned = this.spots.map((s) => ({ tile: s.tile, rotation: s === last ? this.rotation : s.rotation }))
      if (this.placement.checkMany(this.mode.type, turned).ok) {
        last.rotation = this.rotation
        this.showSpots()
      }
    }
    this.refresh()
  }

  // Turn a placed building in place, if it fits turned.
  turnPlaced(b: PlacedBuilding) {
    if (!this.city.move(b.id, b.tile, ((b.rotation + 1) % 4) as Rotation)) this.onNotice?.("There isn't room to turn it here")
  }

  select(building: PlacedBuilding | null) {
    if (this.selected === building) return
    this.selected = building
    this.onSelect?.(building)
    this.refresh()
  }

  // Does tapping this building do something right away (collect, harvest,
  // plant, unload)? If not, a tap selects it instead.
  hasQuickAction(b: PlacedBuilding, now: number): boolean {
    if (b.damaged) return true
    if (b.construction) return this.city.production.constructionDone(b, now)
    if (b.type.requiresRoad && !this.city.hasRoadAccess(b)) return false
    if (b.type.factory) return this.city.production.factoryState(b, now) === 'done'
    if (b.type.goodsPerSale && this.city.production.isReady(b, now) && !this.city.production.hasStock(b)) return this.city.production.supplyFor(b) > 0
    if (isPlot(b.type)) return cropState(b.crop, now).stage !== 'growing'
    if (b.type.category === 'port') return this.docks.state(b, now).stage !== 'sailing'
    if (b.type.id === MARKET_ID) return true
    return this.city.production.isReady(b, now) && this.city.production.hasStock(b)
  }

  // What tapping a building does when no tool is selected (also used by the
  // bubbles over buildings): collect income, or tend a farm plot depending on
  // what's growing on it.
  // Collecting, harvesting and clearing use energy (planting does too, in the
  // crop picker); the Player takes it when the City reports the action.
  tap(building: PlacedBuilding) {
    const now = Date.now()
    const outOfEnergy = () => {
      if (this.player.hasEnergy(now)) return false
      this.onNotice?.(outOfEnergyMessage(this.player, now))
      return true
    }
    if (building.damaged) {
      this.onRepairRequest?.(building)
      return
    }
    if (building.construction) {
      if (this.city.production.constructionDone(building, now)) this.onFinishRequest?.(building)
      else this.onNotice?.(`🚧 ${building.type.name} will be ready to finish in ${duration(building.construction.endsAt - now)}`)
      return
    }
    if (building.type.requiresRoad && !this.city.hasRoadAccess(building)) {
      this.onNotice?.(`${building.type.name} has no road access. Build a road touching one of its sides.`)
      return
    }
    if (building.type.id === MARKET_ID) {
      this.onMarketRequest?.()
      return
    }
    if (building.type.category === 'port') {
      const state = this.docks.state(building, now)
      if (state.stage === 'idle') this.onDockRequest?.(building)
      else if (state.stage === 'sailing') this.onNotice?.(`🚢 Ship arriving in ${duration(state.shipment.arrivesAt - now)}`)
      else if (!outOfEnergy() && this.docks.unload(building, now) === 0) this.onNotice?.('Storage is full. Sell goods at your shops, or build a Barn or Warehouse.')
      return
    }
    const f = building.type.factory
    if (f) {
      const state = this.city.production.factoryState(building, now)
      const product = PRODUCTS[f.product]
      if (state === 'working') this.onNotice?.(`🏭 ${product.icon} ${building.stock} ${product.name.toLowerCase()} ready in ${duration(building.readyAt - now)}`)
      else if (state === 'idle')
        this.onNotice?.(
          f.recipe
            ? `${building.type.name} needs ${inputsText(f)} to start a batch. Collect them from your farm.`
            : `🏭 ${building.type.name} needs 📦 ${f.input} goods to start a batch (storage has ${this.city.goods}). Harvest crops, or order a shipment.`,
        )
      else if (!outOfEnergy() && this.city.production.collectBatch(building.id, now) === 0) this.onNotice?.('Storage is full. Sell products at your shops, or build a Barn or Warehouse.')
      return
    }
    if (!isPlot(building.type)) {
      if (!this.city.production.isReady(building, now)) return
      if (!this.city.production.hasStock(building)) {
        // Out of stock: fill the shelves from town storage, if there's anything there.
        if (this.city.production.restock(building.id) === 0) {
          const sold = soldBy(building.type)
          this.onNotice?.(
            building.type.sells
              ? `${building.type.name} sells ${sold.icon} ${sold.name.toLowerCase()}, and storage has none. Make them at a factory (${sold.goodsEach} goods each).`
              : `${building.type.name} needs goods to sell, and storage is empty. Harvest crops, or order a shipment at a Dock.`,
          )
        }
        return
      }
      if (!outOfEnergy() && this.city.production.collect(building.id, now) > 0) this.collectAround(building, now)
      return
    }
    const state = cropState(building.crop, now)
    if ((state.stage === 'ripe' || state.stage === 'withered') && outOfEnergy()) return
    switch (state.stage) {
      case 'empty':
        this.onPlantRequest?.(building)
        break
      case 'growing':
        this.onNotice?.(`${state.crop.emoji} ${state.crop.name} will be ready in ${duration(state.readyAt - now)}`)
        break
      case 'ripe':
        this.city.production.harvest(building.id, now)
        this.collectAround(building, now)
        break
      case 'withered':
        this.city.production.clearPlot(building.id, now)
        break
    }
  }

  // One step of a road drag: place road on every tile from the last one painted
  // to this one (a fast drag can jump several tiles between pointer events).
  private paintRoad(clientX: number, clientY: number, first: boolean) {
    if (this.mode.kind !== 'build') return
    const type = this.mode.type
    const point = this.controls.groundPointAt(clientX, clientY)
    const tile = point && worldToTile(point)
    if (!tile) return
    if (first) this.lastPainted = null
    const from = this.lastPainted ?? tile
    // Step one tile at a time along x, then along z.
    const steps: Tile[] = []
    let { x, z } = from
    steps.push({ x, z })
    while (x !== tile.x) steps.push({ x: (x += Math.sign(tile.x - x)), z })
    while (z !== tile.z) steps.push({ x, z: (z += Math.sign(tile.z - z)) })
    for (const t of steps) {
      // Drawing one kind of road over another swaps it (a dirt road paved into an avenue, say).
      const other = this.city.buildingAt(t)
      const swap = other && type.category === 'road' && other.type.category === 'road' && other.type !== type
      if (!swap && !this.city.canPlace(type, t)) continue
      if (!this.placement.freeBuild && !this.city.canAfford(type)) {
        if (first) this.onNotice?.(`Not enough coins for a ${type.name}`)
        break
      }
      if (swap) this.city.remove(other.id)
      this.city.place(type, t, { free: this.placement.freeBuild, basis: this.placement.freeBuild ? 0 : type.cost })
    }
    this.lastPainted = tile
    this.hoverTile = tile
    this.refresh()
  }

  // Is there income to collect here, or a ripe crop to harvest?
  private collectable(b: PlacedBuilding, now: number): boolean {
    return (this.city.production.isReady(b, now) && this.city.production.hasStock(b)) || cropState(b.crop, now).stage === 'ripe'
  }

  private collectOne(b: PlacedBuilding, now: number): number {
    return isPlot(b.type) ? this.city.production.harvest(b.id, now) : this.city.production.collect(b.id, now)
  }

  // Collect every ready building and harvest every ripe crop, one energy
  // each, until everything's done or energy runs out.
  collectAll(): { actions: number; coins: number; outOfEnergy: boolean } {
    const now = Date.now()
    let actions = 0
    let coins = 0
    for (const b of this.city.all()) {
      if (!this.collectable(b, now)) continue
      if (!this.player.hasEnergy(now)) return { actions, coins, outOfEnergy: true }
      coins += this.collectOne(b, now)
      actions++
    }
    return { actions, coins, outOfEnergy: false }
  }

  // From level 10: after collecting from a building, collect whatever else is
  // ready within reach of it too (progression.ts collectReach), one energy each.
  private collectAround(center: PlacedBuilding, now: number) {
    const reach = collectReach(this.player.level)
    if (reach === 0) return
    const size = sizeOf(center)
    let count = 0
    for (const b of this.city.all()) {
      if (b === center || !this.collectable(b, now)) continue
      const s = sizeOf(b)
      const gapX = Math.max(0, b.tile.x - (center.tile.x + size.x - 1), center.tile.x - (b.tile.x + s.x - 1))
      const gapZ = Math.max(0, b.tile.z - (center.tile.z + size.z - 1), center.tile.z - (b.tile.z + s.z - 1))
      if (Math.max(gapX, gapZ) > reach) continue
      if (!this.player.hasEnergy(now)) break
      this.collectOne(b, now)
      if (!this.collectable(b, now)) count++
    }
    if (count > 0) this.onNotice?.(`🧺 Collected ${count} more nearby`)
  }

  // The building type following the pointer, if any.
  private placingType(): BuildingType | null {
    if (this.mode.kind === 'build') return this.mode.type
    if (this.mode.kind === 'move') return this.mode.carrying.type
    if (this.mode.kind === 'restore') return this.mode.building.type
    return null
  }

  // Pick up a building to drag it: a press held on any building, or a drag
  // that starts on the selected one. Anywhere else, dragging pans the map.
  private grab(clientX: number, clientY: number, held: boolean): Carry | null {
    if (this.mode.kind !== 'select' || !this.allowDrag()) return null
    const point = this.controls.groundPointAt(clientX, clientY)
    const tile = point && worldToTile(point)
    const b = tile ? this.city.buildingAt(tile) : undefined
    if (!tile || !b || (!held && b !== this.selected)) return null
    this.setMode({ kind: 'move', carrying: b })
    this.dragOffset = { x: b.tile.x - tile.x, z: b.tile.z - tile.z }
    const finish = () => {
      this.dragOffset = null
      this.setMode({ kind: 'select' })
      this.select(b)
    }
    return {
      move: (x, y) => this.updateHover(x, y),
      drop: (x, y) => {
        this.updateHover(x, y)
        const to = this.hoverTile && this.anchorAt(b.type, this.hoverTile)
        const rotation = this.rotation
        finish()
        if (!to || (to.x === b.tile.x && to.z === b.tile.z && rotation === b.rotation)) return
        if (!this.city.move(b.id, to, rotation)) this.onNotice?.("It doesn't fit there, so it stayed put")
      },
      cancel: finish,
    }
  }

  // Where a building's corner goes for the tile under the pointer: centered on
  // it, or, while dragging, keeping the spot that was grabbed under the pointer.
  private anchorAt(type: BuildingType, tile: Tile): Tile {
    return this.dragOffset ? { x: tile.x + this.dragOffset.x, z: tile.z + this.dragOffset.z } : anchorFor(type, tile, this.rotation)
  }

  // ---- Picking roads to remove

  // The roads picked so far (still on the map).
  pickedRoads(): PlacedBuilding[] {
    if (this.mode.kind !== 'removeRoads') return []
    return [...this.mode.picked].map((id) => this.city.get(id)).filter((b): b is PlacedBuilding => b !== undefined)
  }

  private roadAt(clientX: number, clientY: number): PlacedBuilding | null {
    const point = this.controls.groundPointAt(clientX, clientY)
    const tile = point && worldToTile(point)
    const b = tile ? this.city.buildingAt(tile) : undefined
    return b && isTrack(b.type) ? b : null
  }

  private togglePick(road: PlacedBuilding) {
    if (this.mode.kind !== 'removeRoads') return
    if (this.mode.picked.has(road.id)) this.mode.picked.delete(road.id)
    else this.mode.picked.add(road.id)
    this.showPicked()
  }

  // Dragging picks every road it passes over; a drag that starts on a
  // picked road un-picks instead, so a stretch can be taken back the same way.
  private dragPick(clientX: number, clientY: number, first: boolean) {
    if (this.mode.kind !== 'removeRoads') return
    const road = this.roadAt(clientX, clientY)
    if (first) this.dragUnpicks = road !== null && this.mode.picked.has(road.id)
    if (!road) return
    if (this.dragUnpicks) this.mode.picked.delete(road.id)
    else this.mode.picked.add(road.id)
    this.showPicked()
  }

  // A red square on every picked road.
  private showPicked() {
    const roads = this.pickedRoads()
    while (this.pickedMarks.children.length > roads.length) this.pickedMarks.remove(this.pickedMarks.children[0])
    while (this.pickedMarks.children.length < roads.length) this.pickedMarks.add(new THREE.Mesh(this.selection.geometry, this.pickedMaterial))
    roads.forEach((r, i) => this.pickedMarks.children[i].position.copy(footprintCenter(r.tile, { x: 1, z: 1 })).setY(0.04))
    this.onRoadsPicked?.(roads.length)
  }

  private updateHover(clientX: number, clientY: number) {
    const point = this.controls.groundPointAt(clientX, clientY)
    this.hoverTile = point && worldToTile(point)
    this.refresh()
  }

  private onClick(clientX: number, clientY: number) {
    if (this.interceptClick?.(clientX, clientY)) return
    // Touch screens have no hover, so work out the tile from the tap itself.
    this.updateHover(clientX, clientY)
    const tile = this.hoverTile
    if (!tile) return
    const mode = this.mode

    switch (mode.kind) {
      case 'select': {
        const clicked = this.pickAt?.(clientX, clientY) ?? this.city.buildingAt(tile)
        const menuWasHere = this.tileMenu.visible && this.menuTile?.x === tile.x && this.menuTile?.z === tile.z
        this.showTileMenu(null)
        if (clicked && clicked !== this.selected && this.hasQuickAction(clicked, Date.now())) this.tap(clicked)
        else if (clicked || this.selected) this.select(clicked && clicked !== this.selected ? clicked : null)
        else if (this.wildAt?.(tile)) this.onWildTap?.(tile)
        // An empty tile: on your land, offer to build there; next to it, offer the land.
        else if (this.city.ownsTile(tile) && !menuWasHere) this.showTileMenu(tile)
        else if (!this.city.ownsTile(tile) && this.city.canBuyLot(lotOf(tile))) this.onLotRequest?.(lotOf(tile))
        break
      }
      case 'build':
        this.buildAt(mode.type, tile)
        break
      case 'restore': {
        const anchor = anchorFor(mode.building.type, tile, this.rotation)
        const check = this.placement.check(mode.building.type, { tile: anchor, rotation: this.rotation }, { free: true })
        if (check.ok) this.setPending(anchor)
        else this.onNotice?.(check.problems[0])
        break
      }
      case 'removeRoads': {
        const road = this.city.buildingAt(tile)
        if (road && isTrack(road.type)) this.togglePick(road)
        else if (road) this.onNotice?.('Only roads and track can be picked here. Tap one, or drag along several.')
        break
      }
      case 'move': {
        const moved = mode.carrying
        if (this.city.move(moved.id, this.anchorAt(moved.type, tile), this.rotation)) {
          this.setMode({ kind: 'select' })
          this.select(moved)
        } else {
          this.onNotice?.("It doesn't fit there")
        }
        break
      }
    }
    this.refresh()
  }

  private setPending(tile: Tile | null) {
    this.pending = tile
    this.confirm.visible = tile !== null
    const type = this.placingType()
    if (tile && type) {
      const size = footprint(type, this.rotation)
      this.confirm.position.copy(footprintCenter(tile, size)).setY(Math.max(size.x, size.z) * 0.6 + 0.6)
    }
    this.refresh()
  }

  // A tap in build mode: two steps, tap to put the building down, then ✓ to
  // buy it (several spots can be picked first). Roads and track skip this:
  // they're drawn. (Also used by "Build here" on an empty tile.)
  private buildAt(type: BuildingType, tile: Tile) {
    const anchor = anchorFor(type, tile, this.rotation)
    if (isTrack(type) || !this.confirmPurchases) {
      const check = this.placement.check(type, { tile: anchor, rotation: this.rotation })
      if (!check.ok) this.onNotice?.(check.problems[0])
      else this.city.place(type, anchor, { rotation: this.rotation, free: this.placement.freeBuild, basis: this.placement.freeBuild ? 0 : type.cost })
      return
    }
    // Tapping a picked spot takes it back; anywhere else picks one more.
    const at = this.spots.findIndex((s) => footprintTiles(s.tile, footprint(type, s.rotation)).some((t) => t.x === tile.x && t.z === tile.z))
    if (at >= 0) {
      this.scene.remove(this.spots[at].ghost)
      this.spots.splice(at, 1)
    } else {
      const check = this.placement.checkMany(type, [...this.spotList(), { tile: anchor, rotation: this.rotation }])
      if (!check.ok) this.onNotice?.(check.problems[0])
      else this.addSpot(anchor, this.rotation)
    }
    this.showSpots()
  }

  // "Build here": start building this type with the tapped tile as the first spot.
  startBuildAt(type: BuildingType, tile: Tile) {
    this.setMode({ kind: 'build', type })
    if (!isTrack(type)) this.buildAt(type, tile)
  }

  // ✓: buy the building waiting at the pending spot. Stay in build mode, so
  // you can place another of the same.
  private confirmPlacement() {
    if (this.mode.kind === 'restore' && this.pending) {
      const b = this.mode.building
      if (this.city.restore(b.id, this.pending, Date.now(), this.rotation)) {
        this.setMode({ kind: 'select' })
        this.select(b)
      }
      return
    }
    this.buySpots()
  }

  // ✓ (or the Buy button): buy every picked spot. Everything was checked
  // together when each spot was picked; it's checked once more in case the
  // town changed since (coins spent elsewhere, say). Stay in build mode, so
  // you can carry on placing more.
  buySpots() {
    if (this.mode.kind !== 'build' || this.spots.length === 0) return
    const type = this.mode.type
    const check = this.placement.checkMany(type, this.spotList())
    if (!check.ok) {
      this.onNotice?.(check.problems[0])
      return
    }
    for (const s of this.spots) this.city.place(type, s.tile, { rotation: s.rotation, free: this.placement.freeBuild, basis: this.placement.freeBuild ? 0 : type.cost })
    this.clearSpots()
    this.showSpots()
  }

  private spotList(): Spot[] {
    return this.spots.map((s) => ({ tile: s.tile, rotation: s.rotation }))
  }

  private addSpot(tile: Tile, rotation: Rotation) {
    if (this.mode.kind !== 'build') return
    const ghost = createBuildingObject(this.mode.type, this.spotMaterial)
    this.scene.add(ghost)
    this.spots.push({ tile, rotation, ghost })
  }

  private clearSpots() {
    for (const s of this.spots) this.scene.remove(s.ghost)
    this.spots = []
    this.onSpotsChanged?.(0, 0) // the Buy button goes too
  }

  // Put each spot's ghost in place, the ✓ over the last one, and tell the HUD.
  private showSpots() {
    const type = this.mode.kind === 'build' ? this.mode.type : null
    for (const s of this.spots) {
      const size = footprint(type!, s.rotation)
      s.ghost.position.copy(footprintCenter(s.tile, size))
      s.ghost.rotation.y = (-s.rotation * Math.PI) / 2
    }
    const last = this.spots.at(-1)
    if (this.mode.kind !== 'restore') this.confirm.visible = last !== undefined
    if (last && type) {
      const size = footprint(type, last.rotation)
      this.confirm.position.copy(footprintCenter(last.tile, size)).setY(Math.max(size.x, size.z) * 0.6 + 0.6)
    }
    this.onSpotsChanged?.(this.spots.length, (type?.cost ?? 0) * this.spots.length)
    this.refresh()
  }

  // Redraw the footprint and ghost for the current mode and hovered tile.
  private refresh() {
    this.footprint.visible = false
    this.area.visible = false
    if (this.ghost) this.ghost.visible = false
    this.selection.visible = this.selected !== null
    if (this.selected) {
      const size = sizeOf(this.selected)
      this.selection.position.copy(footprintCenter(this.selected.tile, size)).setY(0.025)
      this.selection.scale.set(size.x + 0.3, 1, size.z + 0.3)
    }
    // A building waiting for ✓ stays put; otherwise placing follows the pointer.
    const tile = this.pending ?? this.hoverTile
    // The info card only shows in select mode with nothing selected, so it doesn't get in the way.
    this.onHoverBuilding?.(tile && this.mode.kind === 'select' && !this.selected ? (this.city.buildingAt(tile) ?? null) : null)
    if (!tile) return

    const type = this.placingType()
    if (type) {
      const size = footprint(type, this.rotation)
      const anchor = this.pending ?? this.anchorAt(type, tile)
      const ignoreId = this.mode.kind === 'move' ? this.mode.carrying.id : undefined
      // Moving and restoring are free; building new is checked in full,
      // together with any spots already picked.
      const spot = { tile: anchor, rotation: this.rotation, ignoreId }
      const check =
        this.mode.kind === 'build' && this.spots.length > 0
          ? this.placement.checkMany(type, [...this.spotList(), spot])
          : this.placement.check(type, spot, { free: this.mode.kind !== 'build' })
      // Over a picked spot: tapping takes it back, so don't draw a second ghost there.
      if (this.spots.some((s) => s.tile.x === anchor.x && s.tile.z === anchor.z)) {
        this.onPlacementInfo?.('Tap again to take this one back')
        return
      }
      const color = check.ok ? COLORS.ok : COLORS.blocked
      // Say it in words too: color alone isn't enough for everyone.
      this.onPlacementInfo?.(!check.ok ? `✗ ${check.problems[0]}` : check.warnings.length ? `⚠ Fits, but ${check.warnings[0].toLowerCase()}` : '✓ Fits here')
      this.showFootprint(anchor, size, color)
      this.ghostMaterial.color.set(color)
      this.ghost!.position.copy(footprintCenter(anchor, size))
      this.ghost!.rotation.y = (-this.rotation * Math.PI) / 2
      this.ghost!.visible = true
      if (type.amenity) {
        // Show the reach: the footprint grown by the radius on every side.
        const r = type.amenity.radius
        this.area.position.copy(footprintCenter(anchor, size)).setY(0.015)
        this.area.scale.set(size.x + 2 * r, 1, size.z + 2 * r)
        this.area.visible = true
      }
      return
    }

    this.onPlacementInfo?.(null)
    // Not placing anything: highlight the tile under the pointer.
    this.showFootprint(tile, { x: 1, z: 1 }, COLORS.hover)
  }

  private showFootprint(tile: Tile, size: { x: number; z: number }, color: string) {
    this.footprint.position.copy(footprintCenter(tile, size))
    this.footprint.position.y = 0.02
    this.footprint.scale.set(size.x, 1, size.z)
    this.footprint.material.color.set(color)
    this.footprint.visible = true
  }
}
