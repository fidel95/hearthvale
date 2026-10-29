import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { City } from './City'
import { roadMask } from './communityRules'
import { tileToWorld } from './grid'

// Draws every road as one network. Each road tile's shape (straight, corner,
// T, crossroads, dead end) comes from which neighbors are roads too: see
// roadMask in communityRules.ts. All the pieces are merged into one mesh per
// color, so a town with hundreds of road tiles still costs only three draw calls.

const COLORS = { asphalt: '#5d6168', curb: '#d8d4cb', paint: '#f2f2f2' }
// Sidewalks run along every edge with no road beyond it; people walk on them
// (PeopleView) and cars keep to their lane inside them (TrafficView).
export const SIDEWALK = 0.16
const ROAD_TOP = 0.03

// The four directions in mask order, as unit steps.
const DIRECTIONS = [
  { bit: 1, dx: 0, dz: -1 },
  { bit: 2, dx: 1, dz: 0 },
  { bit: 4, dx: 0, dz: 1 },
  { bit: 8, dx: -1, dz: 0 },
]

export class RoadView {
  private scene: THREE.Scene
  private city: City
  private meshes: THREE.Mesh[] = []
  private dirty = true
  private materials = Object.fromEntries(
    Object.entries(COLORS).map(([k, c]) => [k, new THREE.MeshStandardMaterial({ color: c })]),
  ) as Record<keyof typeof COLORS, THREE.MeshStandardMaterial>

  constructor(scene: THREE.Scene, city: City) {
    this.scene = scene
    this.city = city
    city.onChange((event) => {
      if ((event.kind === 'added' || event.kind === 'removed' || event.kind === 'moved') && event.building.type.category === 'road') {
        // Rebuild once per frame at most: dragging out a road adds many tiles quickly.
        this.dirty = true
      }
    })
  }

  // Called every frame; only does work after roads changed.
  update() {
    if (!this.dirty) return
    this.dirty = false
    for (const mesh of this.meshes) {
      mesh.removeFromParent()
      mesh.geometry.dispose()
    }
    this.meshes = []

    const parts: Record<keyof typeof COLORS, THREE.BufferGeometry[]> = { asphalt: [], curb: [], paint: [] }
    const box = (kind: keyof typeof COLORS, w: number, h: number, d: number, x: number, y: number, z: number) =>
      parts[kind].push(new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z))

    for (const b of this.city.all()) {
      if (b.type.category !== 'road') continue
      const c = tileToWorld(b.tile)
      const mask = roadMask(b.tile, this.city.isRoad)
      const links = DIRECTIONS.filter((d) => mask & d.bit)
      box('asphalt', 1, ROAD_TOP, 1, c.x, 0, c.z)

      for (const d of DIRECTIONS) {
        if (mask & d.bit) {
          // Lane markings toward each connected neighbor, except at junctions.
          if (links.length <= 2) {
            for (const along of [0.18, 0.42]) {
              const w = d.dx !== 0 ? 0.16 : 0.05
              const depth = d.dz !== 0 ? 0.16 : 0.05
              box('paint', w, 0.005, depth, c.x + d.dx * along, ROAD_TOP, c.z + d.dz * along)
            }
          }
        } else {
          // A raised sidewalk along each side with no road beyond it.
          const w = d.dx !== 0 ? SIDEWALK : 1
          const depth = d.dz !== 0 ? SIDEWALK : 1
          box('curb', w, 0.05, depth, c.x + d.dx * (0.5 - SIDEWALK / 2), 0, c.z + d.dz * (0.5 - SIDEWALK / 2))
        }
      }
    }

    for (const kind of Object.keys(parts) as (keyof typeof COLORS)[]) {
      if (parts[kind].length === 0) continue
      const mesh = new THREE.Mesh(mergeGeometries(parts[kind]), this.materials[kind])
      mesh.receiveShadow = true
      for (const g of parts[kind]) g.dispose()
      this.meshes.push(mesh)
      this.scene.add(mesh)
    }
  }
}
