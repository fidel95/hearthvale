import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { City } from './City'
import { roadMask } from './communityRules'
import { tileToWorld } from './grid'

// Draws all railway track as one network, like RoadView does for roads: a
// gravel bed, wooden sleepers and two steel rails. Each tile runs a half
// length of track from its center toward every neighboring track tile, so
// straights, curves and junctions all join up. Merged into one mesh per
// material, it costs three draw calls however much track there is.

const COLORS = { gravel: '#a39a8c', sleeper: '#7a5233', steel: '#c4ccd6' }
const DIRECTIONS = [
  { bit: 1, dx: 0, dz: -1 },
  { bit: 2, dx: 1, dz: 0 },
  { bit: 4, dx: 0, dz: 1 },
  { bit: 8, dx: -1, dz: 0 },
]
const GAUGE = 0.13 // half the distance between the rails

export class RailView {
  private scene: THREE.Scene
  private city: City
  private meshes: THREE.Mesh[] = []
  private dirty = true
  private materials = Object.fromEntries(
    Object.entries(COLORS).map(([k, c]) => [k, new THREE.MeshStandardMaterial({ color: c, metalness: k === 'steel' ? 0.4 : 0 })]),
  ) as Record<keyof typeof COLORS, THREE.MeshStandardMaterial>

  constructor(scene: THREE.Scene, city: City) {
    this.scene = scene
    this.city = city
    city.onChange((event) => {
      if ((event.kind === 'added' || event.kind === 'removed' || event.kind === 'moved') && event.building.type.id === 'rail') this.dirty = true
    })
  }

  // Called every frame; only does work after track changed.
  update() {
    if (!this.dirty) return
    this.dirty = false
    for (const mesh of this.meshes) {
      mesh.removeFromParent()
      mesh.geometry.dispose()
    }
    this.meshes = []

    const parts: Record<keyof typeof COLORS, THREE.BufferGeometry[]> = { gravel: [], sleeper: [], steel: [] }
    const box = (kind: keyof typeof COLORS, w: number, h: number, d: number, x: number, y: number, z: number) =>
      parts[kind].push(new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z))

    for (const b of this.city.all()) {
      if (b.type.id !== 'rail') continue
      const c = tileToWorld(b.tile)
      const mask = roadMask(b.tile, this.city.isRail)
      // A lone tile, or the end of a line, still shows a short straight piece.
      const links = DIRECTIONS.filter((d) => mask & d.bit)
      const arms = links.length === 0 ? [DIRECTIONS[1], DIRECTIONS[3]] : links.length === 1 ? [links[0], DIRECTIONS[(DIRECTIONS.indexOf(links[0]) + 2) % 4]] : links
      box('gravel', 0.42, 0.03, 0.42, c.x, 0, c.z)
      for (const d of arms) {
        const along = d.dx !== 0 // runs east-west
        const mid = { x: c.x + d.dx * 0.25, z: c.z + d.dz * 0.25 }
        box('gravel', along ? 0.5 : 0.42, 0.03, along ? 0.42 : 0.5, mid.x, 0, mid.z)
        for (const t of [0.12, 0.37]) {
          const s = { x: c.x + d.dx * t, z: c.z + d.dz * t }
          box('sleeper', along ? 0.07 : 0.38, 0.025, along ? 0.38 : 0.07, s.x, 0.03, s.z)
        }
        for (const side of [-GAUGE, GAUGE]) {
          box('steel', along ? 0.5 : 0.03, 0.03, along ? 0.03 : 0.5, mid.x + (along ? 0 : side), 0.055, mid.z + (along ? side : 0))
        }
      }
    }

    for (const kind of Object.keys(parts) as (keyof typeof COLORS)[]) {
      if (parts[kind].length === 0) continue
      const mesh = new THREE.Mesh(mergeGeometries(parts[kind]), this.materials[kind])
      mesh.receiveShadow = true
      mesh.castShadow = kind !== 'gravel'
      for (const g of parts[kind]) g.dispose()
      this.meshes.push(mesh)
      this.scene.add(mesh)
    }
  }
}
