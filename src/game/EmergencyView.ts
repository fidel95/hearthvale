import * as THREE from 'three'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import type { City, PlacedBuilding } from './City'
import { sizeOf } from './City'
import type { CityView } from './CityView'
import { edgeTiles } from './communityRules'
import type { Disasters } from './Disasters'
import { footprintCenter, tileToWorld, type Tile } from './grid'
import { findPath } from './pathfinding'
import { Polyline } from './routes'
import { PRIORITY, type RoadSpace } from './roadSpace'
import { makeKitCar } from './TrafficView'

// Fires, and the emergency services that answer them.
//
// - Now and then (with disasters on) a fire breaks out in a building: flames
//   and smoke on its roof, and a 🔥 button. The town's fire station sends a
//   fire engine, lights flashing, which drives there by road and hoses the
//   fire out; the police and an ambulance come too, if the town has them.
//   With no fire engine on the way, tap the 🔥 to put it out yourself; left
//   to burn, the building is damaged (Disasters.ts) and needs a repair.
// - Between fires, ambulances and police cars go out on calls: to a home or a
//   shop and back, lights flashing. Just for looks.
//
// Responders drive on the roads (and go through red lights).

const FIRE_EVERY = [300, 600] // seconds between fires
const FIRE_BURNS = 45 // seconds before an unattended fire damages the building
const HOSING = 6 // seconds of hosing to put it out
const CALL_EVERY = [50, 110] // seconds between ordinary calls
const SPEED = 2.6 // tiles per second
const LANE = 0.17
const AT_SCENE = 8 // seconds an ambulance or police car stays on a call

type Service = 'firetruck' | 'police' | 'ambulance'
const STATIONS: Record<Service, string> = { firetruck: 'fire-station', police: 'police-station', ambulance: 'hospital' }
const BEACONS: Record<Service, [string, string]> = { firetruck: ['#ff3b30', '#ff3b30'], police: ['#ff3b30', '#2f6bff'], ambulance: ['#ff3b30', '#ffffff'] }

interface Responder {
  service: Service
  object: THREE.Group
  beacons: THREE.Mesh[]
  line: Polyline
  s: number
  state: 'going' | 'there' | 'returning'
  wait: number // seconds left at the scene
  forFire: boolean // at a fire, it stays until the fire's out
}

interface Fire {
  building: PlacedBuilding
  flames: THREE.Group
  smoke: THREE.Mesh[]
  label: CSS2DObject
  top: number
  t: number
  helped: boolean // a fire engine is on its way, so it won't do damage
  hosing: number // seconds of hosing so far
}

const between = ([a, b]: number[]) => a + Math.random() * (b - a)
const center = (t: Tile) => {
  const c = tileToWorld(t)
  return { x: c.x, z: c.z }
}

export class EmergencyView {
  enabled = true
  // Told about what happens (Game shows a toast).
  onNotice: ((message: string, warn?: boolean) => void) | null = null
  // The player put a fire out themselves.
  onPutOut: (() => void) | null = null
  onSiren: (() => void) | null = null
  private scene: THREE.Scene
  private city: City
  private cityView: CityView
  private disasters: Disasters
  private fire: Fire | null = null
  private responders: Responder[] = []
  private untilFire = between(FIRE_EVERY)
  private untilCall = between(CALL_EVERY)
  private time = 0
  private spray: THREE.Mesh[] = []

  // fireSoon: the first fire in a few seconds (for browser checks in development).
  private space: RoadSpace

  constructor(scene: THREE.Scene, city: City, cityView: CityView, disasters: Disasters, space: RoadSpace, fireSoon = false) {
    this.scene = scene
    this.space = space
    this.city = city
    this.cityView = cityView
    this.disasters = disasters
    if (fireSoon) this.untilFire = 3
    const drop = new THREE.SphereGeometry(0.035, 6, 4)
    const water = new THREE.MeshBasicMaterial({ color: '#9fdcff', transparent: true, opacity: 0.85 })
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(drop, water)
      m.visible = false
      scene.add(m)
      this.spray.push(m)
    }
  }

  update(dt: number) {
    this.time += dt
    if (this.enabled && !this.fire) {
      this.untilFire -= dt
      if (this.untilFire <= 0) {
        this.untilFire = between(FIRE_EVERY)
        this.startFire()
      }
    }
    this.untilCall -= dt
    if (this.untilCall <= 0) {
      this.untilCall = between(CALL_EVERY)
      this.startCall()
    }
    if (this.fire) this.burn(this.fire, dt)
    for (const r of [...this.responders]) this.drive(r, dt)
  }

  // ---- Fires

  private startFire() {
    const choices = [...this.city.all()].filter(
      (b) => ['home', 'business', 'industry', 'community'].includes(b.type.category) && this.city.isBuilt(b) && !b.damaged,
    )
    if (choices.length === 0) return
    const building = choices[Math.floor(Math.random() * choices.length)]
    const top = Math.max(0.3, this.cityView.topOf(building.id))
    const at = footprintCenter(building.tile, sizeOf(building))
    const flames = new THREE.Group()
    flames.position.set(at.x, top, at.z)
    const size = Math.min(sizeOf(building).x, sizeOf(building).z)
    for (let i = 0; i < 6; i++) {
      const color = i % 3 === 0 ? '#ffd23f' : i % 3 === 1 ? '#ff8a1f' : '#ff4b2a'
      const h = (0.5 + Math.random() * 0.35) * (0.7 + size * 0.15)
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.13 + Math.random() * 0.08, h, 6).translate(0, h / 2, 0), new THREE.MeshBasicMaterial({ color }))
      const a = (i / 6) * Math.PI * 2
      flame.position.set(Math.cos(a) * 0.18 * size, 0, Math.sin(a) * 0.18 * size)
      flames.add(flame)
    }
    const puff = new THREE.SphereGeometry(0.16, 7, 5)
    const smoke = Array.from({ length: 10 }, () => {
      const m = new THREE.Mesh(puff, new THREE.MeshLambertMaterial({ color: '#4a4a50', transparent: true, opacity: 0.7, depthWrite: false }))
      flames.add(m)
      return m
    })
    const button = document.createElement('button')
    button.className = 'sky-gift'
    button.textContent = '🔥'
    button.title = button.ariaLabel = 'Fire! Tap to put it out'
    button.addEventListener('click', (e) => {
      e.stopPropagation()
      if (this.fire?.building === building) {
        this.endFire()
        this.onPutOut?.()
      }
    })
    const holder = document.createElement('div')
    holder.className = 'sky-gift-holder'
    holder.append(button)
    const label = new CSS2DObject(holder)
    label.position.set(0, 1.1, 0)
    flames.add(label)
    this.scene.add(flames)
    this.fire = { building, flames, smoke, label, top, t: 0, helped: false, hosing: 0 }
    const engine = this.dispatch('firetruck', building)
    this.dispatch('police', building)
    this.dispatch('ambulance', building)
    this.onSiren?.()
    if (engine) {
      this.fire.helped = true
      this.onNotice?.(`🔥 Fire at the ${building.type.name}! The fire brigade is on its way 🚒`, true)
    } else {
      const station = [...this.city.all()].some((b) => b.type.id === STATIONS.firetruck && this.city.isOperating(b))
      this.onNotice?.(`🔥 Fire at the ${building.type.name}! Tap 🔥 to put it out (${station ? 'no road leads there for the fire engine' : 'a Fire Station would send an engine'}).`, true)
    }
  }

  private burn(fire: Fire, dt: number) {
    fire.t += dt
    if (!this.city.get(fire.building.id)) return this.endFire() // moved or removed
    // Flickering flames, and smoke drifting up.
    fire.flames.children.forEach((child, i) => {
      if (!(child instanceof THREE.Mesh) || fire.smoke.includes(child)) return
      const k = 0.75 + 0.35 * Math.abs(Math.sin(this.time * (7 + i) + i))
      child.scale.set(1, k * (1 - Math.min(0.8, fire.hosing / HOSING)), 1)
    })
    fire.smoke.forEach((m, i) => {
      const life = (this.time * 0.35 + i / fire.smoke.length) % 1
      m.position.set(Math.sin(i * 2.1) * 0.15 + life * 0.5, 0.5 + life * 2, Math.cos(i * 2.1) * 0.15)
      m.scale.setScalar(0.7 + life * 1.8)
      ;(m.material as THREE.MeshLambertMaterial).opacity = 0.7 * (1 - life)
    })
    if (!fire.helped && fire.t > FIRE_BURNS) {
      const hit = this.disasters.strike('fire', [fire.building.tile], 1)
      this.onNotice?.(hit.length ? `🔥 The fire damaged the ${fire.building.type.name}. Tap it to repair.` : '🔥 The fire burned out.', true)
      this.endFire()
    }
  }

  private endFire() {
    const fire = this.fire
    if (!fire) return
    this.fire = null
    fire.label.element.remove()
    fire.flames.removeFromParent()
    for (const m of this.spray) m.visible = false
    // Everyone who came heads home.
    for (const r of this.responders) if (r.forFire && r.state !== 'returning') this.leave(r)
  }

  // ---- Responders

  // Send a vehicle from the nearest station that can reach the building by road.
  private dispatch(service: Service, to: PlacedBuilding, forFire = true): Responder | null {
    const goal = edgeTiles(to).find(this.city.isRoad)
    if (!goal) return null
    let best: Tile[] | null = null
    for (const station of this.city.all()) {
      if (station.type.id !== STATIONS[service] || !this.city.isOperating(station)) continue
      const start = edgeTiles(station).find(this.city.isRoad)
      const path = start && findPath(start, goal, this.city.isRoad)
      if (path && (!best || path.length < best.length)) best = path
    }
    if (!best) return null
    const object = makeKitCar(service)
    const beacons = BEACONS[service].map((color, i) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.05), new THREE.MeshBasicMaterial({ color }))
      m.position.set(0, 0.24, i ? 0.05 : -0.05)
      object.add(m)
      return m
    })
    this.scene.add(object)
    const line = new Polyline((best.length > 1 ? best : [best[0], best[0]]).map(center))
    const start = line.at(0, LANE)
    object.position.set(start.x, 0, start.z)
    object.rotation.y = start.angle
    // It shares the road (and waits for what's in front), but has right of way.
    this.space.add(object, 0.28, PRIORITY.emergency)
    const r: Responder = { service, object, beacons, line, s: 0, state: 'going', wait: AT_SCENE, forFire }
    this.responders.push(r)
    return r
  }

  // An ordinary call: an ambulance to a home, or the police to a shop.
  private startCall() {
    const service: Service = Math.random() < 0.5 ? 'ambulance' : 'police'
    if (this.responders.some((r) => r.service === service)) return
    const kind = service === 'ambulance' ? 'home' : 'business'
    const places = [...this.city.all()].filter((b) => b.type.category === kind && this.city.isBuilt(b))
    if (places.length === 0) return
    this.dispatch(service, places[Math.floor(Math.random() * places.length)], false)
  }

  // Back the way it came, from wherever it's got to.
  private leave(r: Responder) {
    const back: { x: number; z: number }[] = []
    for (let d = r.s; d > 0; d -= 0.25) back.push(r.line.at(d))
    back.push(r.line.at(0))
    if (back.length < 2) back.push(r.line.at(0))
    r.state = 'returning'
    r.s = 0
    r.line = new Polyline(back)
  }

  private drive(r: Responder, dt: number) {
    // Beacons flash in turn.
    const on = Math.floor(this.time * 5) % 2 === 0
    r.beacons[0].visible = on
    r.beacons[1].visible = !on
    if (r.state === 'there') {
      if (r.service === 'firetruck' && this.fire) this.hose(r, this.fire, dt)
      else if (!r.forFire && (r.wait -= dt) <= 0) this.leave(r)
    } else if (!this.space.blocked(r.object)) {
      r.s += SPEED * dt
      if (r.s >= r.line.length) {
        if (r.state === 'returning') {
          r.object.removeFromParent()
          this.space.remove(r.object)
          this.responders.splice(this.responders.indexOf(r), 1)
          return
        }
        r.s = r.line.length
        r.state = 'there'
        // Arriving at a fire that's already out: back home.
        if (r.forFire && !this.fire) this.leave(r)
      }
    }
    const pose = r.line.at(r.s, LANE)
    r.object.position.set(pose.x, 0, pose.z)
    r.object.rotation.y = pose.angle
  }

  // Water arcing from the engine onto the flames.
  private hose(r: Responder, fire: Fire, dt: number) {
    fire.hosing += dt
    const from = r.object.position.clone().setY(0.25)
    const to = fire.flames.position.clone().setY(fire.top + 0.15)
    const lift = 0.6 + from.distanceTo(to) * 0.25
    this.spray.forEach((m, i) => {
      const u = (this.time * 1.4 + i / this.spray.length) % 1
      m.visible = true
      m.position.lerpVectors(from, to, u)
      m.position.y += Math.sin(u * Math.PI) * lift
    })
    if (fire.hosing >= HOSING) {
      this.onNotice?.(`🚒 The fire brigade put out the fire at the ${fire.building.type.name}!`)
      this.endFire()
    }
  }

  setVisible(visible: boolean) {
    for (const r of this.responders) r.object.visible = visible
  }
}
