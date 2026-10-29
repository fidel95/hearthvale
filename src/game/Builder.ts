import * as THREE from 'three'
import type { BuildingType } from './buildings'
import type { CameraController } from './CameraController'
import { duration, outOfEnergyMessage } from '../ui/dom'
import type { City, PlacedBuilding } from './City'
import type { CityView } from './CityView'
import { cropState } from './crops'
import { footprintCenter, worldToTile, type Tile } from './grid'
import { createBuildingObject } from './models'
import type { Player } from './Player'

// What a click on the map currently does.
export type Mode =
  | { kind: 'select' }
  | { kind: 'build'; type: BuildingType }
  | { kind: 'move'; carrying: PlacedBuilding | null }
  | { kind: 'demolish' }

const COLORS = { hover: '#ffffff', ok: '#4ade80', blocked: '#ef4444' }

// The pointer's tile should sit near the middle of a big footprint, not at its
// corner, so shift the footprint back by half its size.
function anchorFor(type: BuildingType, tile: Tile): Tile {
  return { x: tile.x - Math.floor(type.size.x / 2), z: tile.z - Math.floor(type.size.z / 2) }
}

// Handles building, moving and demolishing: the ghost preview, the colored
// footprint under the pointer, and turning clicks into City changes.
export class Builder {
  mode: Mode = { kind: 'select' }
  onModeChange?: (mode: Mode) => void
  onHoverBuilding?: (building: PlacedBuilding | null) => void
  // Short messages for the player, e.g. why a click did nothing.
  onNotice?: (message: string) => void
  // An empty farm plot was tapped: show the seeds to choose from.
  onPlantRequest?: (plot: PlacedBuilding) => void

  private scene: THREE.Scene
  private city: City
  private player: Player
  private cityView: CityView
  private controls: CameraController
  private hoverTile: Tile | null = null
  private footprint: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  private ghost: THREE.Group | null = null
  // While placing a community building: the area its bonus reaches.
  private area: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  // The last tile painted in a road drag, to fill in tiles a fast drag skips over.
  private lastPainted: Tile | null = null
  // One shared see-through material for the ghost; we just recolor it.
  private ghostMaterial = new THREE.MeshLambertMaterial({ transparent: true, opacity: 0.6 })

  constructor(
    scene: THREE.Scene,
    city: City,
    player: Player,
    cityView: CityView,
    controls: CameraController,
    canvas: HTMLCanvasElement,
  ) {
    this.scene = scene
    this.city = city
    this.player = player
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

    canvas.addEventListener('pointermove', (e) => this.updateHover(e.clientX, e.clientY))
    canvas.addEventListener('pointerleave', () => {
      this.hoverTile = null
      this.refresh()
    })
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault() // right-click cancels instead of opening the browser menu
      this.setMode({ kind: 'select' })
    })
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.setMode({ kind: 'select' })
    })
    controls.onClick = (x, y) => this.onClick(x, y)
  }

  setMode(mode: Mode) {
    // Clean up the old mode: drop the ghost and un-hide anything we were carrying.
    if (this.ghost) this.scene.remove(this.ghost)
    this.ghost = null
    if (this.mode.kind === 'move' && this.mode.carrying) this.cityView.setVisible(this.mode.carrying.id, true)

    this.mode = mode
    const type = this.placingType()
    if (type) {
      this.ghost = createBuildingObject(type, this.ghostMaterial)
      this.scene.add(this.ghost)
    }
    if (mode.kind === 'move' && mode.carrying) this.cityView.setVisible(mode.carrying.id, false)
    // Roads are drawn by dragging; everything else drags the camera.
    this.controls.paint = mode.kind === 'build' && mode.type.category === 'road' ? (x, y, first) => this.paintRoad(x, y, first) : null

    this.refresh()
    this.onModeChange?.(mode)
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
    if (building.type.category !== 'farm') {
      if (this.city.isReady(building, now) && !outOfEnergy()) this.city.collect(building.id, now)
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
        this.city.harvest(building.id, now)
        break
      case 'withered':
        this.city.clearPlot(building.id, now)
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
      if (!this.city.canAfford(type)) {
        if (first) this.onNotice?.(`Not enough coins for a ${type.name}`)
        break
      }
      this.city.place(type, t)
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
      const ready = this.city.isReady(b, now) || cropState(b.crop, now).stage === 'ripe'
      if (!ready) continue
      if (!this.player.hasEnergy(now)) return { actions, coins, outOfEnergy: true }
      coins += b.type.category === 'farm' ? this.city.harvest(b.id, now) : this.city.collect(b.id, now)
      actions++
    }
    return { actions, coins, outOfEnergy: false }
  }

  // The building type following the pointer, if any.
  private placingType(): BuildingType | null {
    if (this.mode.kind === 'build') return this.mode.type
    if (this.mode.kind === 'move' && this.mode.carrying) return this.mode.carrying.type
    return null
  }

  private updateHover(clientX: number, clientY: number) {
    const point = this.controls.groundPointAt(clientX, clientY)
    this.hoverTile = point && worldToTile(point)
    this.refresh()
  }

  private onClick(clientX: number, clientY: number) {
    // Touch screens have no hover, so work out the tile from the tap itself.
    this.updateHover(clientX, clientY)
    const tile = this.hoverTile
    if (!tile) return
    const mode = this.mode

    switch (mode.kind) {
      case 'select': {
        const clicked = this.city.buildingAt(tile)
        if (clicked) this.tap(clicked)
        break
      }
      case 'build':
        // Stay in build mode so you can place several in a row.
        if (!this.player.isUnlocked(mode.type)) this.onNotice?.(`${mode.type.name} unlocks at level ${mode.type.unlockLevel}`)
        else if (!this.city.canAfford(mode.type)) this.onNotice?.(`Not enough coins for a ${mode.type.name}`)
        else if (!this.city.place(mode.type, anchorFor(mode.type, tile))) this.onNotice?.("It doesn't fit there")
        break
      case 'move':
        if (!mode.carrying) {
          const picked = this.city.buildingAt(tile)
          if (picked) this.setMode({ kind: 'move', carrying: picked })
        } else if (this.city.move(mode.carrying.id, anchorFor(mode.carrying.type, tile))) {
          this.setMode({ kind: 'move', carrying: null })
        } else {
          this.onNotice?.("It doesn't fit there")
        }
        break
      case 'demolish': {
        const target = this.city.buildingAt(tile)
        if (target) this.city.remove(target.id)
        break
      }
    }
    this.refresh()
  }

  // Redraw the footprint and ghost for the current mode and hovered tile.
  private refresh() {
    this.footprint.visible = false
    this.area.visible = false
    if (this.ghost) this.ghost.visible = false
    const tile = this.hoverTile
    // The info card only shows in select mode, so it doesn't get in the way while building.
    this.onHoverBuilding?.(tile && this.mode.kind === 'select' ? (this.city.buildingAt(tile) ?? null) : null)
    if (!tile) return

    const type = this.placingType()
    if (type) {
      const anchor = anchorFor(type, tile)
      const ignoreId = this.mode.kind === 'move' ? this.mode.carrying?.id : undefined
      // Moving is free; building new needs the coins.
      const affordable = this.mode.kind === 'move' || this.city.canAfford(type)
      const color = affordable && this.city.canPlace(type, anchor, ignoreId) ? COLORS.ok : COLORS.blocked
      this.showFootprint(anchor, type.size, color)
      this.ghostMaterial.color.set(color)
      this.ghost!.position.copy(footprintCenter(anchor, type.size))
      this.ghost!.visible = true
      if (type.amenity) {
        // Show the reach: the footprint grown by the radius on every side.
        const r = type.amenity.radius
        this.area.position.copy(footprintCenter(anchor, type.size)).setY(0.015)
        this.area.scale.set(type.size.x + 2 * r, 1, type.size.z + 2 * r)
        this.area.visible = true
      }
      return
    }

    // Not placing anything: highlight the building under the pointer, or just the tile.
    const hovered = this.city.buildingAt(tile)
    if (hovered && this.mode.kind === 'demolish') this.showFootprint(hovered.tile, hovered.type.size, COLORS.blocked)
    else if (hovered && this.mode.kind === 'move') this.showFootprint(hovered.tile, hovered.type.size, COLORS.ok)
    else this.showFootprint(tile, { x: 1, z: 1 }, COLORS.hover)
  }

  private showFootprint(tile: Tile, size: { x: number; z: number }, color: string) {
    this.footprint.position.copy(footprintCenter(tile, size))
    this.footprint.position.y = 0.02
    this.footprint.scale.set(size.x, 1, size.z)
    this.footprint.material.color.set(color)
    this.footprint.visible = true
  }
}
