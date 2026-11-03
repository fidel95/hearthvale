import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { sizeOf, type City } from './City'
import { GRID_SIZE } from './grid'
import { seededRandom } from './neighborData'
import { PEAKS } from './terrain'

// Mountains: a range of snow-capped peaks beyond the edge of the world along
// the back (north and west, the far side from the usual view), and the
// Highlands' peaks inside it (terrain.ts), with a wide stretch of countryside
// under it all. Built once; never changes, except that a peak standing between
// the camera and what you're looking at turns see-through (the view can be
// turned to look from any side).
//
// The grassy foothills round a peak's foot lie over land you can build on, so
// they give way: a foothill that a building, a construction site or a road
// stands on is levelled (and comes back if it's torn down).

const HALF = GRID_SIZE / 2

// What each part of a peak is made of, and its color with no snow and how far
// it turns white under snow.
const ROCK = 0
const SNOW = 1
const GREEN = 2
const COLORS = ['#7e8c84', '#f7fbff', '#5f9c55']
const SNOWED = [0.35, 0, 0.75]
const SEE_THROUGH = 0.28 // opacity of a peak in the way

// A grassy foothill: a cone in the peak's mesh, where it stands (in tiles),
// which of the mesh's vertices are its own, and whether it's levelled now.
interface Foothill {
  x: number
  z: number
  r: number // radius at the foot
  h: number
  start: number
  count: number
  levelled: boolean
}

interface Peak {
  foothills: Foothill[]
  groundY: Float32Array // each vertex's height as built, to bring a foothill back
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
  kinds: Uint8Array // per vertex: ROCK, SNOW or GREEN
  base: THREE.Vector3
  top: THREE.Vector3
  radius: number
  opacity: number
}

export class MountainView {
  private land: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>
  private peaks: Peak[] = []

  constructor(scene: THREE.Scene, city?: City) {
    // Land all around, under the world (the sea covers it to the south).
    this.land = new THREE.Mesh(new THREE.PlaneGeometry(260, 260).rotateX(-Math.PI / 2).translate(0, -0.02, 0), new THREE.MeshStandardMaterial({ color: '#a2d488' }))
    this.land.receiveShadow = true
    scene.add(this.land)

    const rand = seededRandom(7)
    // The Highlands' peaks, inside the world (terrain.ts): each a main cone
    // over its rock tiles, a lower shoulder or two, and snow on the tall ones.
    for (const p of PEAKS) {
      const parts: [THREE.BufferGeometry, number][] = []
      const hills: { part: number; x: number; z: number; r: number; h: number }[] = []
      const x = p.x - HALF
      const z = p.z - HALF
      const turn = rand() * Math.PI
      // Broad flanks, then a steeper summit on top of them (terrain.ts mountainHeight).
      const base = p.radius + 0.4
      const flank = p.height * 0.5
      const waist = base * 0.48
      parts.push([new THREE.CylinderGeometry(waist, base, flank, 7).rotateY(turn).translate(x, flank / 2 - 0.1, z), ROCK])
      parts.push([new THREE.ConeGeometry(waist, p.height - flank, 7).rotateY(turn).translate(x, flank + (p.height - flank) / 2 - 0.1, z), ROCK])
      if (p.height >= 8) {
        const cap = 0.55 // of the summit
        const h = (p.height - flank) * cap
        parts.push([new THREE.ConeGeometry(waist * cap * 1.06, h, 7).rotateY(turn).translate(x, p.height - h / 2 - 0.08, z), SNOW])
      }
      // Lower shoulders, and grassy foothills round the foot.
      for (let i = 0; i < 2; i++) {
        const a = turn + i * 2.6 + rand()
        const h = p.height * (0.35 + rand() * 0.12)
        const r = p.radius * 0.5
        const d = p.radius - r * 0.7
        parts.push([new THREE.ConeGeometry(r, h, 6).rotateY(a).translate(x + Math.cos(a) * d, h / 2 - 0.1, z + Math.sin(a) * d), ROCK])
      }
      for (let i = 0; i < 3; i++) {
        const a = turn + i * 2.1 + rand() * 0.8
        const h = 0.9 + rand() * 0.6
        const r = 1.3 + rand() * 0.5
        const d = p.radius - 0.6
        hills.push({ part: parts.length, x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d, r, h })
        parts.push([new THREE.ConeGeometry(r, h, 7).translate(x + Math.cos(a) * d, h / 2 - 0.15, z + Math.sin(a) * d), GREEN])
      }
      this.add(scene, parts, new THREE.Vector3(x, 0, z), p.height, base, hills)
    }

    // Close behind the edge of the world, so they rise just past the far lots.
    const peak = (x: number, z: number) => {
      const height = 7 + rand() * 6
      const radius = height * (0.55 + rand() * 0.2)
      const turn = rand() * Math.PI
      const parts: [THREE.BufferGeometry, number][] = []
      parts.push([new THREE.ConeGeometry(radius, height, 6).rotateY(turn).translate(x, height / 2 - 0.5, z), ROCK])
      // The snowcap: the top part of the same cone, a touch larger so it sits on top.
      const cap = 0.45 + rand() * 0.12
      parts.push([new THREE.ConeGeometry(radius * cap * 1.04, height * cap, 6).rotateY(turn).translate(x, height - (height * cap) / 2 - 0.45, z), SNOW])
      // Wooded foothills in front.
      const hill = 2 + rand() * 2
      parts.push([new THREE.ConeGeometry(hill * 1.6, hill, 7).translate(x + (rand() - 0.5) * 6, hill / 2 - 0.3, z + 4 + rand() * 2), GREEN])
      this.add(scene, parts, new THREE.Vector3(x, 0, z), height, radius)
    }
    for (let x = -HALF - 10; x < HALF + 30; x += 6 + rand() * 4) peak(x, -HALF - 8 - rand() * 6)
    for (let z = -HALF; z < HALF - 4; z += 6 + rand() * 4) peak(-HALF - 8 - rand() * 6, z)
    this.setSnow(0)
    if (city) {
      // Whenever the town's buildings change (once a frame at most), and now.
      let stale = true
      city.onChange((e) => {
        if (['added', 'removed', 'moved', 'stored', 'restored'].includes(e.kind)) stale = true
      })
      this.refresh = () => {
        if (!stale) return
        stale = false
        this.clearFoothills(city)
      }
      this.refresh()
    }
  }

  private refresh: () => void = () => {}

  // One mesh per peak, colored by its vertices, so each can turn see-through on its own.
  private add(
    scene: THREE.Scene,
    parts: [THREE.BufferGeometry, number][],
    base: THREE.Vector3,
    height: number,
    radius: number,
    hills: { part: number; x: number; z: number; r: number; h: number }[] = [],
  ) {
    const kinds: number[] = []
    const starts: number[] = [] // where each part's vertices begin in the merged mesh
    for (const [g, kind] of parts) {
      starts.push(kinds.length)
      for (let i = 0; i < g.attributes.position.count; i++) kinds.push(kind)
    }
    const foothills = hills.map((f) => ({ x: f.x, z: f.z, r: f.r, h: f.h, start: starts[f.part], count: parts[f.part][0].attributes.position.count, levelled: false }))
    const geometry = mergeGeometries(parts.map(([g]) => g))
    for (const [g] of parts) g.dispose()
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(kinds.length * 3), 3))
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true }))
    mesh.receiveShadow = true
    mesh.castShadow = true
    scene.add(mesh)
    const positions = geometry.attributes.position
    const groundY = new Float32Array(positions.count)
    for (let i = 0; i < positions.count; i++) groundY[i] = positions.getY(i)
    this.peaks.push({ mesh, kinds: Uint8Array.from(kinds), base, top: base.clone().setY(height), radius, opacity: 1, foothills, groundY })
  }

  // Level the foothills that anything stands on, and bring back the ones
  // that are clear again. A foothill's grass is only in the way where it
  // rises above about a hand's width, so that's the part that counts.
  private clearFoothills(city: City) {
    const spots = [...city.all()].map((b) => {
      const size = sizeOf(b)
      return { x: b.tile.x, z: b.tile.z, w: size.x, d: size.z }
    })
    for (const peak of this.peaks) {
      let changed = false
      for (const f of peak.foothills) {
        const reach = f.r * (1 - 0.08 / f.h)
        const covered = spots.some((s) => {
          const dx = Math.max(s.x - f.x, 0, f.x - (s.x + s.w))
          const dz = Math.max(s.z - f.z, 0, f.z - (s.z + s.d))
          return Math.hypot(dx, dz) < reach
        })
        if (covered === f.levelled) continue
        f.levelled = covered
        changed = true
        const positions = peak.mesh.geometry.attributes.position
        for (let i = f.start; i < f.start + f.count; i++) positions.setY(i, covered ? -2 : peak.groundY[i])
      }
      if (changed) peak.mesh.geometry.attributes.position.needsUpdate = true
    }
  }

  // How snowy the countryside is (0 to 1), for snow mode.
  setSnow(amount: number) {
    const white = new THREE.Color('#f4f8fb')
    this.land.material.color.set('#a2d488').lerp(white, amount * 0.9)
    const colors = COLORS.map((c, kind) => new THREE.Color(c).lerp(white, amount * SNOWED[kind]))
    for (const p of this.peaks) {
      const attribute = p.mesh.geometry.attributes.color as THREE.BufferAttribute
      p.kinds.forEach((kind, i) => attribute.setXYZ(i, colors[kind].r, colors[kind].g, colors[kind].b))
      attribute.needsUpdate = true
    }
  }

  // Every frame: fade the peaks that stand in front of the middle of the view.
  update(camera: THREE.OrthographicCamera, target: THREE.Vector3, dt: number) {
    this.refresh()
    const view = camera.matrixWorldInverse
    const middle = target.clone().applyMatrix4(view)
    // Around the middle of the screen: a third of the way out to each side.
    const margin = (camera.top - camera.bottom) / camera.zoom / 6
    const at = new THREE.Vector3()
    for (const p of this.peaks) {
      const base = at.copy(p.base).applyMatrix4(view)
      const [bx, by, bz] = [base.x, base.y, base.z]
      const topY = at.copy(p.top).applyMatrix4(view).y
      // In front of the middle (nearer the camera), not the mountain being
      // looked at itself, and covering the middle of the screen.
      const inWay =
        bz > middle.z + 1 &&
        Math.hypot(p.base.x - target.x, p.base.z - target.z) > p.radius &&
        Math.abs(bx - middle.x) < p.radius + margin &&
        middle.y > by - p.radius * 0.6 - margin &&
        middle.y < topY + margin
      const goal = inWay ? SEE_THROUGH : 1
      if (p.opacity === goal) continue
      p.opacity = Math.abs(goal - p.opacity) < 0.01 ? goal : p.opacity + (goal - p.opacity) * Math.min(1, dt * 6)
      const material = p.mesh.material
      const clear = p.opacity < 1
      if (material.transparent !== clear) {
        material.transparent = clear
        material.depthWrite = !clear
        material.needsUpdate = true
      }
      material.opacity = p.opacity
    }
  }
}
