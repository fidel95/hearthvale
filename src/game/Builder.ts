import * as THREE from 'three'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { footprint, type BuildingType, type Rotation } from './buildings'
import type { CameraController, Carry } from './CameraController'
import { duration, outOfEnergyMessage } from '../ui/dom'
import { sizeOf, type City, type PlacedBuilding } from './City'
import type { CityView } from './CityView'
import { cropState } from './crops'
import type { Docks } from './Docks'
import { footprintCenter, worldToTile, type Tile } from './grid'
import { createBuildingObject } from './models'
import type { PlacementSystem } from './PlacementSystem'
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
  onModeChange?: (mode: Mode) => void
  // While picking roads to remove: how many are picked.
  onRoadsPicked?: (count: number) => void
  onHoverBuilding?: (building: PlacedBuilding | null) => void
  // Short messages for the player, e.g. why a click did nothing.
  onNotice?: (message: string) => void
  // An empty farm plot was tapped: show the seeds to choose from.
  onPlantRequest?: (plot: PlacedBuilding) => void
  // An idle dock was tapped: show the shipments to order.
  onDockRequest?: (dock: PlacedBuilding) => void
  // A construction site whose timer is done was tapped: finish it.
  onFinishRequest?: (building: PlacedBuilding) => void
  // The selected building changed (null: nothing selected).
  onSelect?: (building: PlacedBuilding | null) => void
  // Asked first on every map tap; return true to swallow the tap (Game uses
  // it so a tap on the map just closes an open sheet).
  interceptClick?: (clientX: number, clientY: number) => boolean
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
  private pending: Tile | null = null
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
    no.addEventListener('click', () => this.setPending(null))
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

  setMode(mode: Mode) {
    // Clean up the old mode: cancel any building waiting for ✓ (first, while
    // the old mode's ghost still exists), drop the ghost and un-hide anything
    // we were carrying.
    this.setPending(null)
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
      mode.kind === 'build' && mode.type.category === 'road'
        ? (x, y, first) => this.paintRoad(x, y, first)
        : mode.kind === 'removeRoads'
          ? (x, y, first) => this.dragPick(x, y, first)
          : null
    this.showPicked()

    this.refresh()
    this.onModeChange?.(mode)
  }

  // Turn the building being placed or moved a quarter turn.
  turn() {
    if (!this.placingType()) return
    this.rotation = ((this.rotation + 1) % 4) as Rotation
    // A building waiting for ✓ turns where it stands, if it still fits.
    if (this.pending) this.setPending(this.pending)
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
    if (b.construction) return this.city.production.constructionDone(b, now)
    if (b.type.requiresRoad && !this.city.hasRoadAccess(b)) return false
    if (b.type.goodsPerSale && this.city.production.isReady(b, now) && !this.city.production.hasStock(b)) return this.city.goods > 0
    if (b.type.category === 'farm') return cropState(b.crop, now).stage !== 'growing'
    if (b.type.category === 'port') return this.docks.state(b, now).stage !== 'sailing'
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
    if (building.construction) {
      if (this.city.production.constructionDone(building, now)) this.onFinishRequest?.(building)
      else this.onNotice?.(`🚧 ${building.type.name} will be ready to finish in ${duration(building.construction.endsAt - now)}`)
      return
    }
    if (building.type.requiresRoad && !this.city.hasRoadAccess(building)) {
      this.onNotice?.(`${building.type.name} has no road access. Build a road touching one of its sides.`)
      return
    }
    if (building.type.category === 'port') {
      const state = this.docks.state(building, now)
      if (state.stage === 'idle') this.onDockRequest?.(building)
      else if (state.stage === 'sailing') this.onNotice?.(`🚢 Ship arriving in ${duration(state.shipment.arrivesAt - now)}`)
      else if (!outOfEnergy() && this.docks.unload(building, now) === 0) this.onNotice?.('Storage is full. Sell goods at your shops, or build a Barn or Warehouse.')
      return
    }
    if (building.type.category !== 'farm') {
      if (!this.city.production.isReady(building, now)) return
      if (!this.city.production.hasStock(building)) {
        // Out of stock: fill the shelves from town storage, if there's anything there.
        if (this.city.production.restock(building.id) === 0) {
          this.onNotice?.(`${building.type.name} needs goods to sell, and storage is empty. Harvest crops, or order a shipment at a Dock.`)
        }
        return
      }
      if (!outOfEnergy()) this.city.production.collect(building.id, now)
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
      if (!this.city.canPlace(type, t)) continue
      if (!this.placement.freeBuild && !this.city.canAfford(type)) {
        if (first) this.onNotice?.(`Not enough coins for a ${type.name}`)
        break
      }
      this.city.place(type, t, { free: this.placement.freeBuild })
    }
    this.lastPainted = tile
    this.hoverTile = tile
    this.refresh()
  }

  // Collect every ready building and harvest every ripe crop, one energy
  // each, until everything's done or energy runs out.
  collectAll(): { actions: number; coins: number; outOfEnergy: boolean } {
    const now = Date.now()
    let actions = 0
    let coins = 0
    for (const b of this.city.all()) {
      const ready = (this.city.production.isReady(b, now) && this.city.production.hasStock(b)) || cropState(b.crop, now).stage === 'ripe'
      if (!ready) continue
      if (!this.player.hasEnergy(now)) return { actions, coins, outOfEnergy: true }
      coins += b.type.category === 'farm' ? this.city.production.harvest(b.id, now) : this.city.production.collect(b.id, now)
      actions++
    }
    return { actions, coins, outOfEnergy: false }
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
    return b && b.type.category === 'road' ? b : null
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
        const clicked = this.city.buildingAt(tile)
        if (clicked && clicked !== this.selected && this.hasQuickAction(clicked, Date.now())) this.tap(clicked)
        else this.select(clicked && clicked !== this.selected ? clicked : null)
        break
      }
      case 'build': {
        // Two steps: tap to put the building down, then ✓ to buy it (or tap
        // somewhere else to try another spot). Roads skip this: they're drawn.
        const anchor = anchorFor(mode.type, tile, this.rotation)
        const check = this.placement.check(mode.type, { tile: anchor, rotation: this.rotation })
        if (!check.ok) this.onNotice?.(check.problems[0])
        else if (mode.type.category === 'road' || !this.confirmPurchases) this.city.place(mode.type, anchor, { rotation: this.rotation, free: this.placement.freeBuild })
        else this.setPending(anchor)
        break
      }
      case 'restore': {
        const anchor = anchorFor(mode.building.type, tile, this.rotation)
        const check = this.placement.check(mode.building.type, { tile: anchor, rotation: this.rotation }, { free: true })
        if (check.ok) this.setPending(anchor)
        else this.onNotice?.(check.problems[0])
        break
      }
      case 'removeRoads': {
        const road = this.city.buildingAt(tile)
        if (road?.type.category === 'road') this.togglePick(road)
        else if (road) this.onNotice?.('Only roads can be picked here. Tap a road, or drag along several.')
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
    if (this.mode.kind !== 'build' || !this.pending) return
    if (!this.city.place(this.mode.type, this.pending, { rotation: this.rotation, free: this.placement.freeBuild })) {
      this.onNotice?.(this.city.canAfford(this.mode.type) ? "It doesn't fit there" : `Not enough coins for a ${this.mode.type.name}`)
    }
    this.setPending(null)
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
      // Moving and restoring are free; building new is checked in full.
      const check = this.placement.check(type, { tile: anchor, rotation: this.rotation, ignoreId }, { free: this.mode.kind !== 'build' })
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
