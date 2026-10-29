import * as THREE from 'three'
import type { BuildingType } from './buildings'
import type { CameraController } from './CameraController'
import type { City, PlacedBuilding } from './City'
import type { CityView } from './CityView'
import { footprintCenter, worldToTile, type Tile } from './grid'
import { createBuildingObject } from './models'

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

  private scene: THREE.Scene
  private city: City
  private cityView: CityView
  private controls: CameraController
  private hoverTile: Tile | null = null
  private footprint: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  private ghost: THREE.Group | null = null
  // One shared see-through material for the ghost; we just recolor it.
  private ghostMaterial = new THREE.MeshLambertMaterial({ transparent: true, opacity: 0.6 })

  constructor(scene: THREE.Scene, city: City, cityView: CityView, controls: CameraController, canvas: HTMLCanvasElement) {
    this.scene = scene
    this.city = city
    this.cityView = cityView
    this.controls = controls

    this.footprint = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), // lay it flat once, so scaling x/z is simple
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.45, depthWrite: false }),
    )
    this.footprint.visible = false
    scene.add(this.footprint)

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

    this.refresh()
    this.onModeChange?.(mode)
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
        if (clicked) this.city.collect(clicked.id, Date.now())
        break
      }
      case 'build':
        // Stay in build mode so you can place several in a row.
        this.city.place(mode.type, anchorFor(mode.type, tile))
        break
      case 'move':
        if (!mode.carrying) {
          const picked = this.city.buildingAt(tile)
          if (picked) this.setMode({ kind: 'move', carrying: picked })
        } else if (this.city.move(mode.carrying.id, anchorFor(mode.carrying.type, tile))) {
          this.setMode({ kind: 'move', carrying: null })
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
