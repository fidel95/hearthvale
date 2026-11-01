import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { RoadStyle } from './buildings'
import type { City } from './City'
import { roadMask } from './communityRules'
import { tileToWorld } from './grid'
import { loadMeshParts } from './models'
import { isRiver } from './terrain'
import { BRIDGE_HEIGHT, OVERPASS, bridgeAlongX, liftOnTile } from './bridges'

// Draws every road as one network. Each road tile's shape (straight, corner,
// T, crossroads, dead end) comes from which neighbors are roads too: see
// roadMask in communityRules.ts. Every kind of road joins up with every
// other; each tile is drawn in its own kind's look:
//
// - Road: asphalt with lane markings, zebra crossings at junctions,
//   sidewalks with a curb, and a street lamp every few tiles.
// - Dirt Road: packed earth with wheel ruts and no sidewalks or lamps.
// - Cobblestone Street: brick paving and old-style lanterns.
// - Over the river, any of them is a bridge: stone edges and railings along
//   each side that looks out over the water.
// - Avenue: in the colors of Kenney's Modular Road Kit, with a raised
//   median down the middle carrying the kit's double street lamps.
// - A Road Bridge over the railway (bridges.ts): the road on a deck up on
//   four piers, with railings, and the road tiles either side ramped up to it
//   (built up as embankments).
//
// All the pieces are merged into one mesh per color, so a town with hundreds
// of road tiles still costs only a few draw calls; the avenue lamps are drawn
// all at once (instancing).

// Sidewalks run along every edge with no road beyond it; people walk on them
// (PeopleView) and cars keep to their lane inside them (TrafficView).
export const SIDEWALK = 0.16

interface Look {
  surface: string
  top: number // the surface's height
  curb: string | null // the raised sidewalk (none: a dirt road has a low verge)
  edge: string // where the sidewalk meets the road (the verge, on a dirt road)
  paint: string | null // lane markings and zebra crossings
  lamp: 'classic' | 'lantern' | 'kit' | null
}

const LOOKS: Record<RoadStyle, Look> = {
  asphalt: { surface: '#5d6168', top: 0.03, curb: '#d8d4cb', edge: '#a9a397', paint: '#f2f2f2', lamp: 'classic' },
  dirt: { surface: '#9a7650', top: 0.015, curb: null, edge: '#7d5f3f', paint: null, lamp: null },
  cobble: { surface: '#8d7f70', top: 0.03, curb: '#cbbfa8', edge: '#a39680', paint: null, lamp: 'lantern' },
  avenue: { surface: '#6f7689', top: 0.03, curb: '#c2c2cd', edge: '#505565', paint: '#d8dcea', lamp: 'kit' },
}
const RUTS = '#b08e64' // a dirt road's wheel tracks
const JOINTS = '#76695b' // between a cobbled street's bricks
const MEDIAN = '#c2c2cd'
const POST = '#3b3f46'
const BRIDGE = { stone: '#b9b2a4', rail: '#f2efe6' }
const GLOW = { classic: '#fff1c4', lantern: '#ffd89a' }

// The four directions in mask order, as unit steps.
const DIRECTIONS = [
  { bit: 1, dx: 0, dz: -1 },
  { bit: 2, dx: 1, dz: 0 },
  { bit: 4, dx: 0, dz: 1 },
  { bit: 8, dx: -1, dz: 0 },
]

const LAMP_URL = `${import.meta.env.BASE_URL}models/roads/lamps.glb`

export class RoadView {
  private scene: THREE.Scene
  private city: City
  private meshes: THREE.Mesh[] = []
  private dirty = true
  private materials = new Map<string, THREE.MeshStandardMaterial>()
  // The kit's double street lamp: its parts (one per material), once loaded.
  private lampParts: { geometry: THREE.BufferGeometry; material: THREE.Material }[] | null = null

  constructor(scene: THREE.Scene, city: City) {
    this.scene = scene
    this.city = city
    city.onChange((event) => {
      if ((event.kind === 'added' || event.kind === 'removed' || event.kind === 'moved') && event.building.type.category === 'road') {
        // Rebuild once per frame at most: dragging out a road adds many tiles quickly.
        this.dirty = true
      }
    })
    loadMeshParts(LAMP_URL, 'light_curvedDouble')
      .then((parts) => {
        // The lamp heads glow.
        this.lampParts = parts.map(({ geometry, material }) => {
          const m = (material as THREE.MeshStandardMaterial).clone()
          if (m.name.startsWith('light')) (m.emissive = new THREE.Color('#fff1c4')), (m.emissiveIntensity = 0.6)
          return { geometry, material: m }
        })
        this.dirty = true
      })
      .catch((err) => console.warn("Couldn't load the avenue lamps; avenues go without", err))
  }

  private material(color: string): THREE.MeshStandardMaterial {
    let m = this.materials.get(color)
    if (!m) {
      const glow = color === GLOW.classic || color === GLOW.lantern
      m = new THREE.MeshStandardMaterial({ color, ...(glow ? { emissive: color, emissiveIntensity: 0.7 } : {}) })
      this.materials.set(color, m)
    }
    return m
  }

  // Called every frame; only does work after roads changed.
  update() {
    if (!this.dirty) return
    this.dirty = false
    for (const mesh of this.meshes) {
      mesh.removeFromParent()
      if (mesh instanceof THREE.InstancedMesh) mesh.dispose() // the lamp's shapes are shared
      else mesh.geometry.dispose()
    }
    this.meshes = []

    const parts = new Map<string, THREE.BufferGeometry[]>()
    // The pieces of the tile being drawn, to raise onto a bridge or a ramp.
    let tilePieces: THREE.BufferGeometry[] = []
    const add = (color: string, geometry: THREE.BufferGeometry) => {
      const list = parts.get(color) ?? []
      list.push(geometry)
      parts.set(color, list)
      tilePieces.push(geometry)
    }
    const box = (color: string, w: number, h: number, d: number, x: number, y: number, z: number) => add(color, new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z))
    const kitLamps: { x: number; z: number; turn: number }[] = []

    for (const b of this.city.all()) {
      if (b.type.category !== 'road') continue
      tilePieces = []
      const style = b.type.road?.style ?? 'asphalt'
      const look = LOOKS[style]
      const top = look.top
      const c = tileToWorld(b.tile)
      const mask = roadMask(b.tile, this.city.isRoad)
      const links = DIRECTIONS.filter((d) => mask & d.bit)
      const straight = mask === 5 || mask === 10
      box(look.surface, 1, top, 1, c.x, 0, c.z)

      // Avenue: a raised median along a straight stretch, and the kit's double lamp on it.
      if (style === 'avenue' && straight) {
        const alongX = mask === 10
        box(MEDIAN, alongX ? 1 : 0.07, 0.045, alongX ? 0.07 : 1, c.x, top, c.z)
        if ((b.tile.x + b.tile.z) % 2 === 0) kitLamps.push({ x: c.x, z: c.z, turn: alongX ? 0 : Math.PI / 2 })
      }
      // Cobbles: the joints between rows of bricks.
      if (style === 'cobble') {
        for (const at of [-0.25, 0, 0.25]) {
          box(JOINTS, 1, 0.004, 0.014, c.x, top, c.z + at)
          box(JOINTS, 0.014, 0.004, 1, c.x + at + 0.125, top, c.z)
        }
      }

      for (const d of DIRECTIONS) {
        if (mask & d.bit) {
          if (style === 'dirt') {
            // Two wheel ruts from the middle out to each connected side.
            for (const off of [-0.16, 0.16]) {
              const w = d.dx !== 0 ? 0.5 : 0.07
              const depth = d.dz !== 0 ? 0.5 : 0.07
              box(RUTS, w, 0.004, depth, c.x + d.dx * 0.25 + (d.dz !== 0 ? off : 0), top, c.z + d.dz * 0.25 + (d.dx !== 0 ? off : 0))
            }
          } else if (look.paint && links.length <= 2 && !(style === 'avenue' && straight)) {
            // Lane markings toward each connected neighbor.
            for (const along of [0.18, 0.42]) {
              const w = d.dx !== 0 ? 0.16 : 0.05
              const depth = d.dz !== 0 ? 0.16 : 0.05
              box(look.paint, w, 0.005, depth, c.x + d.dx * along, top, c.z + d.dz * along)
            }
          } else if (look.paint && links.length > 2) {
            // A zebra crossing over each road that meets the junction.
            for (let i = 0; i < 5; i++) {
              const across = -0.32 + i * 0.16
              const w = d.dx !== 0 ? 0.16 : 0.08
              const depth = d.dz !== 0 ? 0.16 : 0.08
              box(look.paint, w, 0.005, depth, c.x + d.dx * 0.38 + (d.dz !== 0 ? across : 0), top, c.z + d.dz * 0.38 + (d.dx !== 0 ? across : 0))
            }
          }
        } else if (look.curb) {
          // A raised sidewalk along each side with no road beyond it, with a
          // darker edge where it meets the road.
          const w = d.dx !== 0 ? SIDEWALK : 1
          const depth = d.dz !== 0 ? SIDEWALK : 1
          box(look.curb, w, 0.05, depth, c.x + d.dx * (0.5 - SIDEWALK / 2), 0, c.z + d.dz * (0.5 - SIDEWALK / 2))
          const edge = 0.5 - SIDEWALK - (style === 'avenue' ? 0.03 : 0)
          const thick = style === 'avenue' ? 0.06 : 0.025 // the kit's dark band along the curb
          box(look.edge, d.dx !== 0 ? thick : 1, style === 'avenue' ? top + 0.004 : 0.055, d.dz !== 0 ? thick : 1, c.x + d.dx * edge, 0, c.z + d.dz * edge)
        } else {
          // A dirt road's grassy verge.
          box(look.edge, d.dx !== 0 ? 0.08 : 1, top + 0.003, d.dz !== 0 ? 0.08 : 1, c.x + d.dx * 0.46, 0, c.z + d.dz * 0.46)
        }
      }

      // A bridge: along each side over open water, a stone edge and a railing.
      if (isRiver(b.tile)) {
        for (const d of DIRECTIONS) {
          if (mask & d.bit || !isRiver({ x: b.tile.x + d.dx, z: b.tile.z + d.dz })) continue
          const alongX = d.dz !== 0
          const x = c.x + d.dx * 0.48
          const z = c.z + d.dz * 0.48
          box(BRIDGE.stone, alongX ? 1 : 0.07, 0.07, alongX ? 0.07 : 1, c.x + d.dx * 0.5, 0, c.z + d.dz * 0.5)
          box(BRIDGE.rail, alongX ? 1 : 0.025, 0.025, alongX ? 0.025 : 1, x, 0.17, z)
          for (const along of [-0.4, 0, 0.4]) box(BRIDGE.rail, 0.025, 0.12, 0.025, x + (alongX ? along : 0), 0.05, z + (alongX ? 0 : along))
        }
      }

      // Lamps on the sidewalk of a straight stretch: street lamps every three
      // tiles on a road, lanterns every other tile on a cobbled street.
      const side = DIRECTIONS.find((d) => !(mask & d.bit))
      if (straight && side && look.lamp === 'classic' && (b.tile.x + b.tile.z) % 3 === 0) {
        const x = c.x + side.dx * 0.47
        const z = c.z + side.dz * 0.47
        add(POST, new THREE.CylinderGeometry(0.018, 0.024, 0.62, 6).translate(x, 0.31, z))
        add(POST, new THREE.BoxGeometry(0.14, 0.02, 0.03).translate(x - side.dx * 0.06, 0.62, z - side.dz * 0.06))
        add(GLOW.classic, new THREE.SphereGeometry(0.035, 8, 6).translate(x - side.dx * 0.12, 0.6, z - side.dz * 0.12))
      }
      if (straight && side && look.lamp === 'lantern' && (b.tile.x + b.tile.z) % 2 === 0) {
        const x = c.x + side.dx * 0.46
        const z = c.z + side.dz * 0.46
        add(POST, new THREE.CylinderGeometry(0.014, 0.02, 0.42, 6).translate(x, 0.21, z))
        add(POST, new THREE.CylinderGeometry(0.05, 0.035, 0.03, 4).rotateY(Math.PI / 4).translate(x, 0.53, z)) // its cap
        add(GLOW.lantern, new THREE.BoxGeometry(0.06, 0.09, 0.06).translate(x, 0.465, z))
      }

      // A road bridge: the deck's underside, and railings along the sides
      // over the track; then the whole tile goes up onto it.
      const bridge = b.type.id === OVERPASS
      if (bridge) {
        const alongX = bridgeAlongX(this.city, b.tile)
        box(BRIDGE.stone, 1, 0.07, 1, c.x, -0.07, c.z)
        for (const side of [-1, 1]) {
          const x = c.x + (alongX ? 0 : side * 0.48)
          const z = c.z + (alongX ? side * 0.48 : 0)
          box(BRIDGE.rail, alongX ? 1 : 0.025, 0.025, alongX ? 0.025 : 1, x, 0.17, z)
          for (const along of [-0.4, 0, 0.4]) box(BRIDGE.rail, 0.025, 0.12, 0.025, x + (alongX ? along : 0), 0.05, z + (alongX ? 0 : along))
        }
      }
      // Raise it: the whole deck on a bridge; on a ramp, just the tops, so
      // what's under them fills in like an embankment.
      for (const g of tilePieces) {
        const pos = g.getAttribute('position')
        for (let i = 0; i < pos.count; i++) {
          if (!bridge && pos.getY(i) < 0.0005) continue
          pos.setY(i, pos.getY(i) + liftOnTile(this.city, b.tile, pos.getX(i), pos.getZ(i)))
        }
      }
      // Its piers, at the corners clear of the track.
      if (bridge) {
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(BRIDGE.stone, 0.09, BRIDGE_HEIGHT - 0.07, 0.09, c.x + sx * 0.4, 0, c.z + sz * 0.4)
      }
    }

    for (const [color, list] of parts) {
      const mesh = new THREE.Mesh(mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g))), this.material(color))
      mesh.receiveShadow = true
      mesh.castShadow = color === POST
      for (const g of list) g.dispose()
      this.meshes.push(mesh)
      this.scene.add(mesh)
    }

    if (this.lampParts && kitLamps.length > 0) {
      const m = new THREE.Matrix4()
      const q = new THREE.Quaternion()
      const one = new THREE.Vector3(1, 1, 1)
      for (const { geometry, material } of this.lampParts) {
        const lamps = new THREE.InstancedMesh(geometry, material, kitLamps.length)
        kitLamps.forEach((l, i) => lamps.setMatrixAt(i, m.compose(new THREE.Vector3(l.x, 0.075, l.z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), l.turn), one)))
        lamps.castShadow = true
        this.meshes.push(lamps)
        this.scene.add(lamps)
      }
    }
  }
}
