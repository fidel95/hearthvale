import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { City } from './City'
import { roadMask } from './communityRules'
import { tileToWorld } from './grid'

// Draws every road as one network. Each road tile's shape (straight, corner,
// T, crossroads, dead end) comes from which neighbors are roads too: see
// roadMask in communityRules.ts. All the pieces are merged into one mesh per
// color, so a town with hundreds of road tiles still costs only a few draw calls.
// Junctions get zebra crossings, sidewalks a curb edge, and every few tiles
// a street lamp stands on the sidewalk.

const COLORS = { asphalt: '#5d6168', curb: '#d8d4cb', curbEdge: '#a9a397', paint: '#f2f2f2', lampPost: '#3b3f46', lampLight: '#fff1c4' }
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
    Object.entries(COLORS).map(([k, c]) => [k, new THREE.MeshStandardMaterial({ color: c, ...(k === 'lampLight' ? { emissive: c, emissiveIntensity: 0.7 } : {}) })]),
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

    const parts: Record<keyof typeof COLORS, THREE.BufferGeometry[]> = { asphalt: [], curb: [], curbEdge: [], paint: [], lampPost: [], lampLight: [] }
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
          if (links.length <= 2) {
            // Lane markings toward each connected neighbor.
            for (const along of [0.18, 0.42]) {
              const w = d.dx !== 0 ? 0.16 : 0.05
              const depth = d.dz !== 0 ? 0.16 : 0.05
              box('paint', w, 0.005, depth, c.x + d.dx * along, ROAD_TOP, c.z + d.dz * along)
            }
          } else {
            // A zebra crossing over each road that meets the junction.
            for (let i = 0; i < 5; i++) {
              const across = -0.32 + i * 0.16
              const w = d.dx !== 0 ? 0.16 : 0.08
              const depth = d.dz !== 0 ? 0.16 : 0.08
              box('paint', w, 0.005, depth, c.x + d.dx * 0.38 + (d.dz !== 0 ? across : 0), ROAD_TOP, c.z + d.dz * 0.38 + (d.dx !== 0 ? across : 0))
            }
          }
        } else {
          // A raised sidewalk along each side with no road beyond it, with a
          // darker curb where it meets the road.
          const w = d.dx !== 0 ? SIDEWALK : 1
          const depth = d.dz !== 0 ? SIDEWALK : 1
          box('curb', w, 0.05, depth, c.x + d.dx * (0.5 - SIDEWALK / 2), 0, c.z + d.dz * (0.5 - SIDEWALK / 2))
          const edge = 0.5 - SIDEWALK
          box('curbEdge', d.dx !== 0 ? 0.025 : 1, 0.055, d.dz !== 0 ? 0.025 : 1, c.x + d.dx * edge, 0, c.z + d.dz * edge)
        }
      }
      // A street lamp every few tiles along a straight road, on a sidewalk.
      const straight = links.length === 2 && (mask === 5 || mask === 10)
      const side = DIRECTIONS.find((d) => !(mask & d.bit))
      if (straight && side && (b.tile.x + b.tile.z) % 3 === 0) {
        const out = 0.5 - 0.03
        const x = c.x + side.dx * out
        const z = c.z + side.dz * out
        parts.lampPost.push(new THREE.CylinderGeometry(0.018, 0.024, 0.62, 6).translate(x, 0.31, z))
        parts.lampPost.push(new THREE.BoxGeometry(0.14, 0.02, 0.03).translate(x - side.dx * 0.06, 0.62, z - side.dz * 0.06).rotateY(0))
        parts.lampLight.push(new THREE.SphereGeometry(0.035, 8, 6).translate(x - side.dx * 0.12, 0.6, z - side.dz * 0.12))
      }
    }

    for (const kind of Object.keys(parts) as (keyof typeof COLORS)[]) {
      if (parts[kind].length === 0) continue
      const mesh = new THREE.Mesh(mergeGeometries(parts[kind].map((g) => (g.index ? g.toNonIndexed() : g))), this.materials[kind])
      mesh.receiveShadow = true
      mesh.castShadow = kind === 'lampPost'
      for (const g of parts[kind]) g.dispose()
      this.meshes.push(mesh)
      this.scene.add(mesh)
    }
  }
}
