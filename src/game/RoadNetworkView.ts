import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { sizeOf, type City } from './City'
import { footprintCenter, tileToWorld, type Tile } from './grid'
import { reachable } from './routes'

// An overlay showing how the roads connect: each separate road network is
// tinted its own color, and anything that needs a road (or track) but has
// none is marked red. Shown while drawing or removing roads, and whenever
// it's switched on in Settings.

const NETWORK_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899', '#84cc16']

export class RoadNetworkView {
  private city: City
  private group = new THREE.Group()
  private dirty = true
  private shown = false

  constructor(scene: THREE.Scene, city: City) {
    this.city = city
    scene.add(this.group)
    city.onChange((e) => {
      if (['added', 'removed', 'moved', 'finished', 'stored', 'restored'].includes(e.kind)) this.dirty = true
    })
  }

  // How many separate road networks there are (for the hint).
  networks = 0

  setShown(shown: boolean) {
    if (shown !== this.shown) this.dirty = true
    this.shown = shown
    this.group.visible = shown
  }

  update() {
    if (!this.shown || !this.dirty) return
    this.dirty = false
    for (const child of [...this.group.children]) {
      const mesh = child as THREE.Mesh
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
      this.group.remove(mesh)
    }
    // Group the road tiles into connected networks.
    const roads = [...this.city.all()].filter((b) => b.type.category === 'road').map((b) => b.tile)
    const seen = new Set<string>()
    const key = (t: Tile) => `${t.x},${t.z}`
    const networks: Tile[][] = []
    for (const start of roads) {
      if (seen.has(key(start))) continue
      const tiles = [...reachable(start, this.city.isRoad).values()].map((path) => path[path.length - 1])
      for (const t of tiles) seen.add(key(t))
      networks.push(tiles)
    }
    // Biggest network first, so the main road keeps the same color.
    networks.sort((a, b) => b.length - a.length)
    this.networks = networks.length
    networks.forEach((tiles, i) => {
      const squares = tiles.map((t) => {
        const c = tileToWorld(t)
        return new THREE.PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2).translate(c.x, 0.045, c.z)
      })
      this.addMesh(squares, NETWORK_COLORS[i % NETWORK_COLORS.length], 0.45)
    })
    // Anything cut off: red.
    const cut = [...this.city.all()].filter(
      (b) => this.city.isBuilt(b) && ((b.type.requiresRoad && !this.city.hasRoadAccess(b)) || (b.type.requiresRail && !this.city.hasRailAccess(b))),
    )
    const marks = cut.map((b) => {
      const size = sizeOf(b)
      // A little bigger than the footprint, so the red shows round the building.
      return new THREE.PlaneGeometry(size.x + 0.5, size.z + 0.5).rotateX(-Math.PI / 2).translate(0, 0.05, 0).translate(footprintCenter(b.tile, size).x, 0, footprintCenter(b.tile, size).z)
    })
    if (marks.length) this.addMesh(marks, '#ff3b30', 0.7)
  }

  private addMesh(parts: THREE.BufferGeometry[], color: string, opacity: number) {
    const mesh = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }))
    for (const p of parts) p.dispose()
    mesh.renderOrder = 2
    this.group.add(mesh)
  }
}
