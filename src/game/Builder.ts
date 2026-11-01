import * as THREE from 'three'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { footprint, type BuildingType, type Rotation, isDrawn, isTrack, isPlot, OVERPASS_TYPE } from './buildings'
import type { CameraController, Carry } from './CameraController'
import { duration, outOfEnergyMessage } from '../ui/dom'
import { sizeOf, type City, type PlacedBuilding } from './City'
import type { CityView } from './CityView'
import { cropState } from './crops'
import type { Docks } from './Docks'
import { footprintCenter, footprintTiles, lotOf, tileToWorld, worldToTile, type Lot, type Tile } from './grid'
import { createBuildingObject } from './models'
import type { PlacementCheck, PlacementSystem } from './PlacementSystem'
import { TileCells, type Cell } from './TileCells'
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

const COLORS = { hover: '#ffffff', ok: '#4ade80', warn: '#facc15', blocked: '#ef4444' }
// How far (in tiles) to look for an empty spot to put a new building down.
const SEARCH_RADIUS = 10

// The pointer's tile should sit near the middle of a big footprint, not at its
// corner, so shift the footprint back by half its size.
function anchorFor(type: BuildingType, tile: Tile, rotation: Rotation): Tile {
  const size = footprint(type, rotation)
  return { x: tile.x - Math.floor(size.x / 2), z: tile.z - Math.floor(size.z / 2) }
}

// Handles taps on the map: collecting and tending buildings, selecting one
// for its context menu, placing new buildings and moving them.
//
// Placing is two steps, so nothing lands where you didn't mean it to:
// - A building appears straight away on the nearest empty spot, as a
//   see-through copy standing on colored tiles (green where a tile is free,
//   red where it isn't). Drag it (or tap a spot) to move it, ⟳ to turn it,
//   then ✓ to buy it, and the next one is ready beside it.
// - Roads, track, paths, hedges and flower beds are drawn: drag along the
//   tiles (back over them to undo), tap single tiles in or out, and ✓ builds
//   the lot.
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
  // Settings: when false, a tap buys and places right away (and a drawn
  // road is built as soon as you let go), without the ✓ step.
  confirmPurchases = true
  // Every placement rule (unlocks, coins, room, rating, fit, roads). Game sets it.
  placement!: PlacementSystem
  private cityView: CityView
  private controls: CameraController
  private hoverTile: Tile | null = null
  private footprint: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  private ghost: THREE.Group | null = null
  // The tiles under whatever's being placed, each green or red.
  private cells: TileCells
  // While placing a community building: the area its bonus reaches.
  private area: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  private tileMenu: CSS2DObject
  private menuTile: Tile | null = null
  // Building new (or putting a stored one back): where its corner is, waiting
  // for ✓. It's dragged or tapped about until then.
  private draft: Tile | null = null
  // Drawing roads (or track, paths...): the tiles drawn so far, in order,
  // waiting for ✓. strokeFrom: where the drag in progress began in the list
  // (dragging back over its own tiles takes them off again).
  private plan: Tile[] = []
  private strokeFrom = 0
  private painting = false
  // The last tile of a drag, to fill in tiles a fast drag skips over.
  private lastPainted: Tile | null = null
  // The Buy button's label (null: no button), e.g. "✓ Buy · 🪙 100".
  onBuyChanged?: (label: string | null) => void
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
  private turnButton: HTMLButtonElement
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
    this.cells = new TileCells(scene)
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
    no.addEventListener('click', () => this.cancel())
    const turn = document.createElement('button')
    turn.className = 'place-turn'
    turn.textContent = '⟳'
    turn.title = 'Turn (R)'
    turn.addEventListener('click', () => this.turn())
    confirmEl.append(no, turn, yes)
    this.turnButton = turn
    this.confirm = new CSS2DObject(confirmEl)
    this.confirm.center.set(0.5, 1)
    this.confirm.visible = false
    scene.add(this.confirm)

    canvas.addEventListener('pointermove', (e) => this.updateHover(e.clientX, e.clientY))
    canvas.addEventListener('pointerleave', () => {
      this.hoverTile = null
      this.refresh()
    })
    // Letting go ends a drag drawing roads (the camera says when one starts).
    const endStroke = () => {
      if (!this.painting) return
      this.painting = false
      if (!this.confirmPurchases) this.confirmPlacement()
      this.refresh()
    }
    canvas.addEventListener('pointerup', endStroke)
    canvas.addEventListener('pointercancel', endStroke)
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault() // right-click cancels instead of opening the browser menu
      if (this.dragOffset) return // some phones send this on a long press: that's a pick-up
      this.setMode({ kind: 'select' })
    })
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.setMode({ kind: 'select' })
      if (e.key === 'r' || e.key === 'R') this.turn()
      if (e.key === 'Enter' && this.mode.kind !== 'select' && !(e.target instanceof HTMLButtonElement || e.target instanceof HTMLInputElement)) this.confirmPlacement()
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
    // Clean up the old mode: drop whatever was waiting for ✓ and the ghost,
    // and un-hide anything we were carrying.
    this.draft = null
    this.plan = []
    this.painting = false
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
    // A new building appears at once, on the nearest empty spot to the middle of the screen.
    if (type && mode.kind !== 'move' && !isDrawn(type)) this.draft = this.nearestFit(type, worldToTile(this.controls.target) ?? { x: 0, z: 0 })
    // Roads (and paths, hedges and flower beds) are drawn by dragging, and
    // roads picked for removal by dragging; everything else drags the camera.
    this.controls.paint =
      mode.kind === 'build' && isDrawn(mode.type)
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
    this.refresh() // a building waiting for ✓ turns where it stands
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

  // One step of a drag drawing road (or a path, hedge or flower bed): add
  // every tile from the last one to this one (a fast drag can jump several
  // tiles between pointer events). Nothing's built until ✓.
  private paintRoad(clientX: number, clientY: number, first: boolean) {
    if (this.mode.kind !== 'build') return
    const point = this.controls.groundPointAt(clientX, clientY)
    const tile = point && worldToTile(point)
    if (!tile) return
    if (first) {
      this.lastPainted = null
      this.strokeFrom = this.plan.length
      this.painting = true
    }
    const from = this.lastPainted ?? tile
    // Step one tile at a time along x, then along z.
    let { x, z } = from
    this.draw({ x, z })
    while (x !== tile.x) this.draw({ x: (x += Math.sign(tile.x - x)), z })
    while (z !== tile.z) this.draw({ x, z: (z += Math.sign(tile.z - z)) })
    this.lastPainted = tile
    this.hoverTile = tile
    this.refresh()
  }

  // Add a tile to the drag being drawn. Back onto one of its own tiles, and
  // everything drawn after that comes off again; tiles from an earlier drag stay.
  private draw(tile: Tile) {
    const at = this.plan.findIndex((t) => t.x === tile.x && t.z === tile.z)
    if (at >= this.strokeFrom) this.plan.length = at + 1
    else if (at < 0) this.plan.push(tile)
  }

  // What laying road (or track, a path...) here would do: put it down
  // (`replace`: swapping out the road or track there), 'there' if it already
  // is, or null if it can't go here.
  private layAs(type: BuildingType, t: Tile): { placing: BuildingType; replace?: PlacedBuilding } | 'there' | null {
    const other = this.city.buildingAt(t)
    if (!other) return this.city.canPlace(type, t) ? { placing: type } : null
    if (other.type === type || other.type.id === OVERPASS_TYPE.id) return 'there'
    // A road across the track, or track across a road, makes a road bridge (bridges.ts).
    if ((type.category === 'road' && other.type.id === 'rail') || (type.id === 'rail' && other.type.category === 'road')) return { placing: OVERPASS_TYPE, replace: other }
    // Drawing one kind of road over another swaps it (a dirt road paved into an avenue, say).
    if (type.category === 'road' && other.type.category === 'road') return { placing: type, replace: other }
    return null
  }

  // Lay road (or track, a path, a hedge...) on each of these tiles that'll
  // take it, until the coins run out. Returns how many it laid.
  private lay(type: BuildingType, tiles: Tile[]): number {
    let laid = 0
    for (const t of tiles) {
      const as = this.layAs(type, t)
      if (!as || as === 'there') continue
      if (!this.placement.freeBuild && !this.city.canAfford(as.placing)) {
        this.onNotice?.(`Not enough coins for a ${as.placing.name}${laid ? ` (built ${laid})` : ''}`)
        break
      }
      if (as.replace) this.city.remove(as.replace.id)
      if (this.city.place(as.placing, t, { free: this.placement.freeBuild, basis: this.placement.freeBuild ? 0 : as.placing.cost })) laid++
    }
    return laid
  }

  // The drawn tiles that would be built, and what they'd cost together.
  private planCost(type: BuildingType): { tiles: Tile[]; cost: number } {
    const tiles: Tile[] = []
    let cost = 0
    for (const t of this.plan) {
      const as = this.layAs(type, t)
      if (!as || as === 'there') continue
      tiles.push(t)
      cost += as.placing.cost
    }
    return { tiles, cost: this.placement.freeBuild ? 0 : cost }
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
  // that starts on the selected one, or on a new one waiting for ✓. Anywhere
  // else, dragging pans the map.
  private grab(clientX: number, clientY: number, held: boolean): Carry | null {
    if (this.draft && this.onDraft(clientX, clientY)) return this.carryDraft(clientX, clientY)
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

  // Is this screen spot on the building waiting for ✓: its see-through copy,
  // or the ground within a tile of it (fingers are wide)?
  private onDraft(clientX: number, clientY: number): boolean {
    const type = this.placingType()
    if (!this.draft || !type) return false
    if (this.ghost && this.controls.rayAt(clientX, clientY).intersectObject(this.ghost, true).length > 0) return true
    const point = this.controls.groundPointAt(clientX, clientY)
    const tile = point && worldToTile(point)
    if (!tile) return false
    const size = footprint(type, this.rotation)
    return tile.x >= this.draft.x - 1 && tile.x <= this.draft.x + size.x && tile.z >= this.draft.z - 1 && tile.z <= this.draft.z + size.z
  }

  // Drag the building waiting for ✓ about. It keeps the same spot under the
  // finger, and stays where it's let go (still waiting for ✓).
  private carryDraft(clientX: number, clientY: number): Carry | null {
    const tileAt = (x: number, y: number) => {
      const point = this.controls.groundPointAt(x, y)
      return point && worldToTile(point)
    }
    const start = tileAt(clientX, clientY)
    const from = this.draft
    if (!start || !from) return null
    const follow = (x: number, y: number) => {
      const tile = tileAt(x, y)
      if (!tile) return
      this.draft = { x: from.x + tile.x - start.x, z: from.z + tile.z - start.z }
      this.refresh()
    }
    return {
      move: follow,
      drop: (x, y) => {
        follow(x, y)
        navigator.vibrate?.(10)
      },
      cancel: () => {
        this.draft = from
        this.refresh()
      },
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
      case 'restore':
        // Tap a spot: the building goes there, waiting for ✓.
        this.draft = anchorFor(mode.building.type, tile, this.rotation)
        break
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

  // A tap in build mode. A building moves there, waiting for ✓ (or, with
  // the ✓ step turned off in Settings, is bought there and then). A drawn
  // tile is added to the plan, or taken off it if it was on it already. Also
  // used by "Build here" on an empty tile.
  private buildAt(type: BuildingType, tile: Tile) {
    if (isDrawn(type)) {
      if (!this.confirmPurchases) {
        if (this.lay(type, [tile]) === 0 && this.layAs(type, tile) !== 'there') {
          const check = this.placement.check(type, { tile, rotation: 0 })
          if (!check.ok) this.onNotice?.(check.problems[0])
        }
        return
      }
      const at = this.plan.findIndex((t) => t.x === tile.x && t.z === tile.z)
      if (at >= 0) this.plan.splice(at, 1)
      else if (this.layAs(type, tile) === null) this.onNotice?.(this.placement.check(type, { tile, rotation: 0 }).problems[0] ?? "It can't go there")
      else this.plan.push(tile)
      return
    }
    this.draft = anchorFor(type, tile, this.rotation)
    if (!this.confirmPurchases) this.confirmPlacement()
  }

  // "Build here": start building this type on the tapped tile (or, if it
  // doesn't fit there, the nearest spot it does).
  startBuildAt(type: BuildingType, tile: Tile) {
    this.setMode({ kind: 'build', type })
    if (isDrawn(type)) this.buildAt(type, tile)
    else this.draft = this.nearestFit(type, tile)
    this.refresh()
  }

  // The nearest spot to a tile where this building fits (as turned now), for
  // its corner; just centered on the tile if there's none near.
  private nearestFit(type: BuildingType, around: Tile, ignoreId?: number): Tile {
    const tries: Tile[] = []
    for (let dx = -SEARCH_RADIUS; dx <= SEARCH_RADIUS; dx++) {
      for (let dz = -SEARCH_RADIUS; dz <= SEARCH_RADIUS; dz++) tries.push({ x: around.x + dx, z: around.z + dz })
    }
    const away = (t: Tile) => Math.hypot(t.x - around.x, t.z - around.z)
    tries.sort((a, b) => away(a) - away(b))
    for (const t of tries) {
      const anchor = anchorFor(type, t, this.rotation)
      if (this.city.canPlace(type, anchor, ignoreId, this.rotation)) return anchor
    }
    return anchorFor(type, around, this.rotation)
  }

  // Whether the building waiting for ✓ can go where it is, with every reason.
  // Moving and restoring are free; building new is checked in full.
  private draftCheck(type: BuildingType, anchor: Tile): PlacementCheck {
    const ignoreId = this.mode.kind === 'move' ? this.mode.carrying.id : undefined
    return this.placement.check(type, { tile: anchor, rotation: this.rotation, ignoreId }, { free: this.mode.kind !== 'build' })
  }

  // ✓ (or the Buy button, or Enter): buy the building waiting there, or
  // build every road tile drawn. Stay in build mode to carry on: the next
  // building appears on the nearest empty spot beside the last.
  confirmPlacement() {
    const mode = this.mode
    if (mode.kind === 'restore' && this.draft) {
      const b = mode.building
      const check = this.draftCheck(b.type, this.draft)
      if (!check.ok) this.onNotice?.(check.problems[0])
      else if (this.city.restore(b.id, this.draft, Date.now(), this.rotation)) {
        this.setMode({ kind: 'select' })
        this.select(b)
      }
      return
    }
    if (mode.kind !== 'build') return
    const type = mode.type
    if (isDrawn(type)) {
      const { tiles } = this.planCost(type)
      if (tiles.length === 0) {
        if (this.plan.length > 0) this.onNotice?.('None of those tiles can take it')
        return
      }
      this.lay(type, tiles)
      this.plan = []
      this.refresh()
      return
    }
    if (!this.draft) return
    const check = this.draftCheck(type, this.draft)
    if (!check.ok) {
      this.onNotice?.(check.problems[0])
      return
    }
    const placed = this.city.place(type, this.draft, { rotation: this.rotation, free: this.placement.freeBuild, basis: this.placement.freeBuild ? 0 : type.cost })
    if (!placed) return
    if (type.unique) {
      this.setMode({ kind: 'select' })
      return
    }
    this.draft = this.nearestFit(type, footprintCenterTile(this.draft, footprint(type, this.rotation)))
    this.refresh()
  }

  // ✕: rub out the drawn tiles, or stop building.
  private cancel() {
    if (this.plan.length > 0) {
      this.plan = []
      this.refresh()
    } else this.setMode({ kind: 'select' })
  }

  // Redraw the footprint, ghost and ✓ for the current mode and hovered tile.
  private refresh() {
    this.footprint.visible = false
    this.area.visible = false
    this.cells.clear()
    if (this.ghost) this.ghost.visible = false
    this.confirm.visible = false
    this.selection.visible = this.selected !== null
    if (this.selected) {
      const size = sizeOf(this.selected)
      this.selection.position.copy(footprintCenter(this.selected.tile, size)).setY(0.025)
      this.selection.scale.set(size.x + 0.3, 1, size.z + 0.3)
    }
    const tile = this.hoverTile
    // The info card only shows in select mode with nothing selected, so it doesn't get in the way.
    this.onHoverBuilding?.(tile && this.mode.kind === 'select' && !this.selected ? (this.city.buildingAt(tile) ?? null) : null)
    const type = this.placingType()

    if (this.mode.kind === 'build' && isDrawn(this.mode.type)) {
      this.showPlan(this.mode.type)
      if (tile && !this.painting && this.plan.length === 0) this.showFootprint(tile, { x: 1, z: 1 }, COLORS.hover)
      return
    }
    // A new (or stored) building waiting for ✓ stays put; one being moved follows the pointer.
    const anchor = this.mode.kind === 'move' ? tile && type && this.anchorAt(type, tile) : this.draft
    if (type && anchor) {
      this.showBuilding(type, anchor)
      return
    }
    this.onBuyChanged?.(null)
    this.onPlacementInfo?.(type ? 'Tap where it should go' : null)
    // Not placing anything: highlight the tile under the pointer.
    if (tile && !type) this.showFootprint(tile, { x: 1, z: 1 }, COLORS.hover)
  }

  // A building about to be placed: its see-through copy on its tiles (each
  // green, or red where something's in the way), its reach if it has one, and
  // what's wrong in words (color alone isn't enough for everyone).
  private showBuilding(type: BuildingType, anchor: Tile) {
    const size = footprint(type, this.rotation)
    const ignoreId = this.mode.kind === 'move' ? this.mode.carrying.id : undefined
    const check = this.draftCheck(type, anchor)
    const tiles = footprintTiles(anchor, size)
    const free = tiles.map((t) => this.city.tileFree(type, t, ignoreId))
    const blocked = free.includes(false)
    const fine = check.ok ? (check.warnings.length ? COLORS.warn : COLORS.ok) : blocked ? COLORS.ok : COLORS.blocked
    this.cells.show(tiles.map((t, i): Cell => ({ tile: t, color: free[i] ? fine : COLORS.blocked })))
    this.onPlacementInfo?.(!check.ok ? `✗ ${check.problems[0]}` : check.warnings.length ? `⚠ Fits, but ${check.warnings[0].toLowerCase()}` : '✓ Fits here')
    this.ghostMaterial.color.set(check.ok ? COLORS.ok : COLORS.blocked)
    const center = footprintCenter(anchor, size)
    this.ghost!.position.copy(center)
    this.ghost!.rotation.y = (-this.rotation * Math.PI) / 2
    this.ghost!.visible = true
    if (type.amenity) {
      // Show the reach: the footprint grown by the radius on every side.
      const r = type.amenity.radius
      this.area.position.copy(center).setY(0.015)
      this.area.scale.set(size.x + 2 * r, 1, size.z + 2 * r)
      this.area.visible = true
    }
    if (this.mode.kind === 'move') {
      this.onBuyChanged?.(null)
      return
    }
    this.turnButton.hidden = false
    this.confirm.visible = true
    this.confirm.position.copy(center).setY(Math.max(size.x, size.z) * 0.6 + 0.6)
    const costsNothing = this.mode.kind === 'restore' || this.placement.freeBuild
    this.onBuyChanged?.(costsNothing ? '✓ Place' : `✓ Buy · 🪙 ${type.cost.toLocaleString()}`)
  }

  // Road (or track, path...) drawn so far: green tiles to build, white where
  // it's there already, red where it can't go, and ✓ over the last tile.
  private showPlan(type: BuildingType) {
    if (this.plan.length === 0) {
      this.onBuyChanged?.(null)
      this.onPlacementInfo?.(null)
      return
    }
    const cells = this.plan.map((t): Cell => {
      const as = this.layAs(type, t)
      return { tile: t, color: as === null ? COLORS.blocked : as === 'there' ? COLORS.hover : COLORS.ok }
    })
    this.cells.show(cells)
    const { tiles, cost } = this.planCost(type)
    const blocked = cells.filter((c) => c.color === COLORS.blocked).length
    const short = cost - this.city.coins
    this.onPlacementInfo?.(
      short > 0 && !this.placement.freeBuild
        ? `✗ Need 🪙 ${short.toLocaleString()} more for all ${tiles.length}`
        : blocked > 0
          ? `⚠ ${blocked} red tile${blocked > 1 ? 's' : ''} can't take it`
          : `${tiles.length} to build`,
    )
    this.onBuyChanged?.(tiles.length === 0 ? null : this.placement.freeBuild ? `✓ Build ${tiles.length}` : `✓ Build ${tiles.length} · 🪙 ${cost.toLocaleString()}`)
    if (this.painting) return
    const last = this.plan.at(-1)!
    this.turnButton.hidden = true // roads don't turn
    this.confirm.visible = true
    this.confirm.position.copy(tileToWorld(last)).setY(0.7)
  }

  private showFootprint(tile: Tile, size: { x: number; z: number }, color: string) {
    this.footprint.position.copy(footprintCenter(tile, size))
    this.footprint.position.y = 0.02
    this.footprint.scale.set(size.x, 1, size.z)
    this.footprint.material.color.set(color)
    this.footprint.visible = true
  }
}

// The tile in the middle of a footprint (for looking around it).
function footprintCenterTile(tile: Tile, size: { x: number; z: number }): Tile {
  return { x: tile.x + Math.floor(size.x / 2), z: tile.z + Math.floor(size.z / 2) }
}
