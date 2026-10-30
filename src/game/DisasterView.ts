import * as THREE from 'three'
import type { City, PlacedBuilding } from './City'
import { DISASTER_INFO, FLOOD_REACH, TSUNAMI_REACH, type DisasterKind, type Disasters } from './Disasters'
import { GRID_SIZE, tileToWorld, worldToTile, type Tile } from './grid'
import { coastZ } from './terrain'

// What disasters look like, and when they happen. Every 6 to 12 minutes
// (if they're switched on) one of them strikes:
//
// - Lightning: a jagged bolt and a flash, then thunder; it can damage what it
//   hits. Bolts also flash now and then during ordinary rain showers.
// - Tornado: a spinning funnel with debris that crosses the town; what it
//   passes over may be damaged.
// - Flood: the sea rises over the low land by the coast, then recedes.
// - Tsunami: a siren, then a wave rolls in from the sea, floods the shore and
//   drains away.
//
// The damage itself is Disasters.ts. This file draws, times and narrates.

export interface DisasterHooks {
  notice: (message: string, warn?: boolean) => void
  flash: () => void // light up the screen for a moment
  thunder: () => void
  siren: () => void
  setStorm: (on: boolean) => void // ask the weather for a storm (rain) while it lasts
}

const LOW = 0.06 // the sea's surface
const up = new THREE.Vector3(0, 1, 0)

interface Tornado {
  kind: 'tornado'
  funnel: THREE.Group
  rings: THREE.Mesh[]
  debris: THREE.Mesh[]
  from: THREE.Vector3
  to: THREE.Vector3
  t: number
  seconds: number
  rolled: Set<number> // buildings it has already had its chance at
}
interface Water {
  kind: 'flood' | 'tsunami'
  t: number
  sheet: THREE.Mesh
  wave: THREE.InstancedMesh | null
  foam: THREE.InstancedMesh | null
  struck: boolean
}

export class DisasterView {
  enabled = true
  private scene: THREE.Scene
  private city: City
  private disasters: Disasters
  private hooks: DisasterHooks
  private active: Tornado | Water | null = null
  private untilNext = 240 + Math.random() * 240 // the first after 4 to 8 minutes
  private bolt: THREE.LineSegments | null = null
  private boltTime = 0
  private stormBolts = 0 // a lightning storm: this many bolts to come
  private untilBolt = 0
  raining = false // set by Game: ordinary showers bring the odd bolt too

  constructor(scene: THREE.Scene, city: City, disasters: Disasters, hooks: DisasterHooks) {
    this.scene = scene
    this.city = city
    this.disasters = disasters
    this.hooks = hooks
  }

  // Start one now (Admin tools), or pick at random when it's time.
  trigger(kind: DisasterKind) {
    if (this.active && kind !== 'lightning') return
    switch (kind) {
      case 'lightning':
        this.hooks.notice(`${DISASTER_INFO.lightning.icon} A thunderstorm rolls in!`, true)
        this.hooks.setStorm(true)
        this.stormBolts = 6
        this.untilBolt = 1
        break
      case 'tornado':
        this.startTornado()
        break
      case 'flood':
      case 'tsunami':
        this.startWater(kind)
        break
    }
  }

  update(dt: number) {
    if (this.enabled && !this.active && this.stormBolts === 0) {
      this.untilNext -= dt
      if (this.untilNext <= 0) {
        this.untilNext = 360 + Math.random() * 360
        const roll = Math.random()
        this.trigger(roll < 0.35 ? 'tornado' : roll < 0.6 ? 'lightning' : roll < 0.85 ? 'flood' : 'tsunami')
      }
    }
    this.lightning(dt)
    if (this.active?.kind === 'tornado') this.runTornado(this.active, dt)
    else if (this.active) this.runWater(this.active, dt)
  }

  // ---- Lightning

  private lightning(dt: number) {
    if (this.bolt) {
      this.boltTime -= dt
      if (this.boltTime <= 0) {
        this.scene.remove(this.bolt)
        this.bolt.geometry.dispose()
        this.bolt = null
      }
    }
    const storm = this.stormBolts > 0
    if (!storm && !this.raining) return
    this.untilBolt -= dt
    if (this.untilBolt > 0) return
    this.untilBolt = storm ? 2 + Math.random() * 3 : 10 + Math.random() * 20
    // Strikes go for tall things: homes, shops and civic buildings.
    const tall = [...this.city.all()].filter((b) => ['home', 'business', 'community', 'landmark'].includes(b.type.category))
    const target = tall.length > 0 && Math.random() < 0.7 ? tall[Math.floor(Math.random() * tall.length)] : null
    const point = target ? tileToWorld(target.tile) : tileToWorld({ x: 15 + Math.floor(Math.random() * 30), z: 15 + Math.floor(Math.random() * 30) })
    this.drawBolt(point)
    this.hooks.flash()
    this.hooks.thunder()
    if (target && this.enabled) {
      const hit = this.disasters.strike('lightning', [target.tile], storm ? 0.45 : 0.15)
      if (hit.length) this.hooks.notice(`⚡ Lightning struck the ${hit[0].type.name}! Tap it to repair.`, true)
    }
    if (storm) {
      this.stormBolts--
      if (this.stormBolts === 0) this.hooks.setStorm(false)
    }
  }

  // A jagged line from the clouds down to the ground.
  private drawBolt(to: THREE.Vector3) {
    const points: THREE.Vector3[] = []
    let p = to.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 14, (Math.random() - 0.5) * 3))
    while (p.y > 0.4) {
      const next = p.clone().lerp(to, 0.18).add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0, (Math.random() - 0.5) * 0.8))
      next.y = p.y - 1.2 - Math.random()
      points.push(p, next)
      p = next
    }
    points.push(p, to.clone().setY(0.6))
    this.bolt = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: '#fffbe0' }))
    this.boltTime = 0.25
    this.scene.add(this.bolt)
  }

  // ---- Tornado

  private startTornado() {
    // From outside one side of the town, through the middle, out the other side.
    const lots = [...this.city.ownedLots()]
    const center = new THREE.Vector3()
    for (const { lot } of lots) center.add(tileToWorld({ x: lot.x * 10 + 5, z: lot.z * 10 + 5 }))
    center.divideScalar(Math.max(1, lots.length))
    const angle = Math.random() * Math.PI * 2
    const across = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle))
    const sideways = new THREE.Vector3(-across.z, 0, across.x).multiplyScalar((Math.random() - 0.5) * 6)
    const from = center.clone().add(sideways).addScaledVector(across, -16)
    const to = center.clone().add(sideways).addScaledVector(across, 16)

    const funnel = new THREE.Group()
    const rings: THREE.Mesh[] = []
    const cloud = new THREE.MeshLambertMaterial({ color: '#8a8f96', transparent: true, opacity: 0.72, side: THREE.DoubleSide })
    for (let i = 0; i < 9; i++) {
      // Each ring a little wider than the one below, so the funnel flares.
      const r = 0.25 + i * i * 0.035
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.15, r, 0.55, 12, 1, true), cloud)
      ring.position.y = 0.3 + i * 0.5
      funnel.add(ring)
      rings.push(ring)
    }
    const debris: THREE.Mesh[] = []
    for (let i = 0; i < 24; i++) {
      const bit = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.12), new THREE.MeshLambertMaterial({ color: ['#7a5233', '#5d6168', '#3f8f3a', '#b8a07a'][i % 4] }))
      bit.userData = { r: 0.4 + Math.random() * 1.2, h: Math.random() * 3.5, speed: 3 + Math.random() * 3, a: Math.random() * 6.28 }
      funnel.add(bit)
      debris.push(bit)
    }
    funnel.position.copy(from)
    this.scene.add(funnel)
    this.active = { kind: 'tornado', funnel, rings, debris, from, to, t: 0, seconds: 26, rolled: new Set() }
    this.hooks.siren()
    this.hooks.setStorm(true)
    this.hooks.notice(`${DISASTER_INFO.tornado.icon} ${DISASTER_INFO.tornado.warning}`, true)
  }

  private runTornado(t: Tornado, dt: number) {
    t.t += dt
    const u = t.t / t.seconds
    const wobble = new THREE.Vector3(Math.sin(t.t * 1.3) * 0.8, 0, Math.cos(t.t * 0.9) * 0.8)
    t.funnel.position.copy(t.from).lerp(t.to, u).add(wobble)
    t.rings.forEach((ring, i) => {
      ring.rotation.y += dt * (6 - i * 0.3)
      ring.position.x = Math.sin(t.t * 2 + i * 0.5) * 0.06 * i
    })
    for (const bit of t.debris) {
      const d = bit.userData as { r: number; h: number; speed: number; a: number }
      d.a += dt * d.speed
      bit.position.set(Math.cos(d.a) * d.r, d.h + Math.sin(d.a * 2) * 0.2, Math.sin(d.a) * d.r)
      bit.rotation.x += dt * 5
      bit.rotation.y += dt * 4
    }
    // Everything it passes over gets one chance of being damaged.
    if (this.enabled) {
      const tile = worldToTile(t.funnel.position)
      if (tile) {
        const near: Tile[] = []
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) near.push({ x: tile.x + dx, z: tile.z + dz })
        const fresh = this.disasters.buildingsOn(near).filter((b) => !t.rolled.has(b.id))
        for (const b of fresh) t.rolled.add(b.id)
        this.report(this.disasters.strike('tornado', fresh.map((b) => b.tile), 0.55), false)
      }
    }
    if (u >= 1) {
      this.scene.remove(t.funnel)
      t.funnel.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose()
          ;(o.material as THREE.Material).dispose()
        }
      })
      this.active = null
      this.hooks.setStorm(false)
      this.hooks.notice('🌪️ The tornado has passed.')
    }
  }

  // ---- Floods and tsunamis

  private startWater(kind: 'flood' | 'tsunami') {
    const reach = kind === 'flood' ? FLOOD_REACH : TSUNAMI_REACH
    // A sheet of water over the land within `reach` of the shore, one strip a column.
    const strips: number[] = []
    const index: number[] = []
    for (let x = 0; x < GRID_SIZE; x++) {
      const shore = coastZ(x)
      const a = tileToWorld({ x, z: shore - reach })
      const b = tileToWorld({ x, z: shore })
      const base = strips.length / 3
      for (const [px, pz] of [[a.x - 0.5, a.z - 0.5], [a.x + 0.5, a.z - 0.5], [b.x - 0.5, b.z + 0.5], [b.x + 0.5, b.z + 0.5]]) strips.push(px, 0, pz)
      index.push(base, base + 2, base + 1, base + 1, base + 2, base + 3)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(strips, 3))
    geometry.setIndex(index)
    geometry.computeVertexNormals()
    const sheet = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#3b9fd8', transparent: true, opacity: 0, roughness: 0.3 }))
    sheet.position.y = -0.1
    this.scene.add(sheet)
    let wave: THREE.InstancedMesh | null = null
    let foam: THREE.InstancedMesh | null = null
    if (kind === 'tsunami') {
      wave = new THREE.InstancedMesh(new THREE.BoxGeometry(1.02, 1, 1.2), new THREE.MeshStandardMaterial({ color: '#2f8fd0', transparent: true, opacity: 0.9 }), GRID_SIZE)
      foam = new THREE.InstancedMesh(new THREE.BoxGeometry(1.02, 0.18, 0.6), new THREE.MeshStandardMaterial({ color: '#f4fbff' }), GRID_SIZE)
      wave.visible = foam.visible = false
      this.scene.add(wave, foam)
      this.hooks.siren()
    }
    this.hooks.setStorm(true)
    this.hooks.notice(`${DISASTER_INFO[kind].icon} ${DISASTER_INFO[kind].warning}`, true)
    this.active = { kind, t: 0, sheet, wave, foam, struck: false }
  }

  private runWater(w: Water, dt: number) {
    w.t += dt
    const tsunami = w.kind === 'tsunami'
    // Timeline (seconds): tsunami: 4 of warning, 6 of the wave rolling in;
    // then the water stands a while and drains away.
    const arrive = tsunami ? 10 : 6
    const hold = arrive + (tsunami ? 6 : 10)
    const gone = hold + 8
    let level: number
    if (w.t < arrive) level = tsunami ? 0 : w.t / arrive
    else if (w.t < hold) level = 1
    else level = Math.max(0, 1 - (w.t - hold) / (gone - hold))
    w.sheet.position.y = -0.1 + (LOW + 0.04 + 0.1) * level
    ;(w.sheet.material as THREE.MeshStandardMaterial).opacity = 0.85 * Math.min(1, level * 2)

    if (tsunami && w.wave && w.foam) {
      // The wave: a wall of water moving from out at sea up past the shore.
      const u = (w.t - 4) / 6
      w.wave.visible = w.foam.visible = u > 0 && u < 1.15
      if (w.wave.visible) {
        const offset = 8 - u * (8 + TSUNAMI_REACH)
        const height = 1.4 * Math.sin(Math.min(1, u) * Math.PI * 0.9 + 0.2)
        const m = new THREE.Matrix4()
        for (let x = 0; x < GRID_SIZE; x++) {
          const c = tileToWorld({ x, z: coastZ(x) })
          m.compose(new THREE.Vector3(c.x, height / 2, c.z + offset), new THREE.Quaternion(), new THREE.Vector3(1, height, 1))
          w.wave.setMatrixAt(x, m)
          m.compose(new THREE.Vector3(c.x, height, c.z + offset - 0.3), new THREE.Quaternion().setFromAxisAngle(up, 0), new THREE.Vector3(1, 1, 1))
          w.foam.setMatrixAt(x, m)
        }
        w.wave.instanceMatrix.needsUpdate = w.foam.instanceMatrix.needsUpdate = true
      }
    }
    if (!w.struck && w.t >= arrive) {
      w.struck = true
      if (this.enabled) {
        const reach = tsunami ? TSUNAMI_REACH : FLOOD_REACH
        this.report(this.disasters.strike(w.kind, this.disasters.lowLand(reach), tsunami ? 0.7 : 0.45), true)
      }
    }
    if (w.t >= gone) {
      this.scene.remove(w.sheet)
      w.sheet.geometry.dispose()
      ;(w.sheet.material as THREE.Material).dispose()
      for (const m of [w.wave, w.foam]) {
        if (!m) continue
        this.scene.remove(m)
        m.geometry.dispose()
        ;(m.material as THREE.Material).dispose()
        m.dispose()
      }
      this.active = null
      this.hooks.setStorm(false)
      this.hooks.notice(w.kind === 'flood' ? '🌊 The flood water has drained away.' : '🌊 The wave has drained back to the sea.')
    }
  }

  private report(hit: PlacedBuilding[], always: boolean) {
    if (hit.length > 0) this.hooks.notice(`🔧 ${hit.length === 1 ? `The ${hit[0].type.name} was` : `${hit.length} buildings were`} damaged. Tap to repair.`, true)
    else if (always) this.hooks.notice('Nothing was damaged this time.')
  }
}
