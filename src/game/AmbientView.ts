import * as THREE from 'three'
import type { City } from './City'
import { sizeOf } from './City'
import type { CityView } from './CityView'
import type { EffectsView } from './EffectsView'
import { footprintCenter } from './grid'

// Background life that makes the town feel lived-in, for looks only:
// soft shadows of clouds drifting across the land, flocks of birds flapping past,
// smoke curling from chimneys, and dust at building sites. (Swaying trees are
// the scenery's own; Game calls it.) All of it stops with Reduce motion.

const CLOUD_HEIGHT = 0.02 // the shadows lie just above the ground
const CLOUD_SPEED = 0.7
const AREA = 45 // clouds drift through a square this far from the view's center

// A cloud's shadow: soft, faint patches lying on the ground (a few round
// blobs that blend together), drifting along. Drawn as decals rather than
// real shadows, so they're gentle and never hide anything.
let shadowTexture: THREE.Texture | null = null
function softBlob(): THREE.Texture {
  if (shadowTexture) return shadowTexture
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(20, 40, 30, 1)')
  g.addColorStop(0.6, 'rgba(20, 40, 30, 0.6)')
  g.addColorStop(1, 'rgba(20, 40, 30, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  shadowTexture = new THREE.CanvasTexture(canvas)
  return shadowTexture
}

function makeCloud(): THREE.Group {
  const material = new THREE.MeshBasicMaterial({ map: softBlob(), transparent: true, opacity: 0.13, depthWrite: false })
  const cloud = new THREE.Group()
  const puffs = 4 + Math.floor(Math.random() * 4)
  for (let i = 0; i < puffs; i++) {
    const size = 4 + Math.random() * 4
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 0.8).rotateX(-Math.PI / 2), material)
    m.position.set((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 4)
    m.renderOrder = 1
    cloud.add(m)
  }
  return cloud
}

interface Bird {
  root: THREE.Group
  wings: [THREE.Object3D, THREE.Object3D]
  phase: number
}
interface Flock {
  birds: Bird[]
  position: THREE.Vector3
  heading: THREE.Vector3
  travelled: number
}

function makeBird(): Bird {
  const material = new THREE.MeshLambertMaterial({ color: '#3b3f46', side: THREE.DoubleSide })
  const root = new THREE.Group()
  root.add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4).scale(1.8, 0.8, 0.8), material))
  const wing = (side: number) => {
    const pivot = new THREE.Group()
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.22).rotateX(Math.PI / 2).translate(0, 0, side * 0.11), material)
    pivot.add(w)
    root.add(pivot)
    return pivot
  }
  return { root, wings: [wing(-1), wing(1)], phase: Math.random() * 6 }
}

export class AmbientView {
  enabled = true
  private scene: THREE.Scene
  private city: City
  private cityView: CityView
  private effects: EffectsView
  private center: () => THREE.Vector3
  private clouds: THREE.Group[] = []
  private flocks: Flock[] = []
  private untilFlock = 8
  private untilSmoke = 0
  private untilDust = 0

  constructor(scene: THREE.Scene, city: City, cityView: CityView, effects: EffectsView, center: () => THREE.Vector3) {
    this.scene = scene
    this.city = city
    this.cityView = cityView
    this.effects = effects
    this.center = center
    for (let i = 0; i < 7; i++) {
      const cloud = makeCloud()
      cloud.position.set((Math.random() - 0.5) * 2 * AREA, CLOUD_HEIGHT, (Math.random() - 0.5) * 2 * AREA)
      this.clouds.push(cloud)
      scene.add(cloud)
    }
  }

  update(dt: number) {
    for (const c of this.clouds) c.visible = this.enabled
    if (!this.enabled) {
      for (const f of this.flocks) for (const b of f.birds) this.scene.remove(b.root)
      this.flocks = []
      return
    }
    this.driftClouds(dt)
    this.flyBirds(dt)
    this.chimneys(dt)
  }

  private driftClouds(dt: number) {
    const c = this.center()
    for (const cloud of this.clouds) {
      cloud.position.x += CLOUD_SPEED * dt
      cloud.position.z += CLOUD_SPEED * 0.4 * dt
      // Wrap round to the other side of the view.
      if (cloud.position.x > c.x + AREA) cloud.position.x -= 2 * AREA
      if (cloud.position.z > c.z + AREA) cloud.position.z -= 2 * AREA
      if (cloud.position.x < c.x - AREA) cloud.position.x += 2 * AREA
      if (cloud.position.z < c.z - AREA) cloud.position.z += 2 * AREA
    }
  }

  // Now and then a flock flies over in a V, flapping.
  private flyBirds(dt: number) {
    this.untilFlock -= dt
    if (this.untilFlock <= 0) {
      this.untilFlock = 25 + Math.random() * 30
      const angle = Math.random() * Math.PI * 2
      const heading = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle))
      const start = this.center().clone().addScaledVector(heading, -26).setY(5 + Math.random() * 2)
      const birds = Array.from({ length: 5 + Math.floor(Math.random() * 3) }, makeBird)
      for (const b of birds) this.scene.add(b.root)
      this.flocks.push({ birds, position: start, heading, travelled: 0 })
    }
    for (const flock of [...this.flocks]) {
      flock.position.addScaledVector(flock.heading, dt * 2.4)
      flock.travelled += dt * 2.4
      const side = new THREE.Vector3(-flock.heading.z, 0, flock.heading.x)
      flock.birds.forEach((b, i) => {
        // A V: the leader in front, the rest staggered back on alternate sides.
        const rank = Math.ceil(i / 2)
        const offset = side.clone().multiplyScalar((i % 2 === 0 ? 1 : -1) * rank * 0.45).addScaledVector(flock.heading, -rank * 0.45)
        b.phase += dt * 11
        b.root.position.copy(flock.position).add(offset).setY(flock.position.y + Math.sin(b.phase * 0.3) * 0.08)
        b.root.rotation.y = Math.atan2(-flock.heading.z, flock.heading.x)
        b.wings[0].rotation.x = Math.sin(b.phase) * 0.7
        b.wings[1].rotation.x = -Math.sin(b.phase) * 0.7
      })
      if (flock.travelled > 52) {
        for (const b of flock.birds) this.scene.remove(b.root)
        this.flocks.splice(this.flocks.indexOf(flock), 1)
      }
    }
  }

  // Smoke from homes' chimneys, and dust where something's being built.
  private chimneys(dt: number) {
    this.untilSmoke -= dt
    this.untilDust -= dt
    const all = [...this.city.all()]
    if (this.untilSmoke <= 0) {
      this.untilSmoke = 0.5
      const homes = all.filter((b) => b.type.category === 'home' && this.city.isOperating(b))
      if (homes.length > 0) {
        const home = homes[Math.floor(Math.random() * homes.length)]
        const top = this.cityView.topOf(home.id)
        const size = sizeOf(home)
        this.effects.smoke(footprintCenter(home.tile, size).add(new THREE.Vector3(-size.x * 0.2, top - 0.05, -size.z * 0.15)))
      }
    }
    if (this.untilDust <= 0) {
      this.untilDust = 2.5
      for (const site of all.filter((b) => b.construction)) {
        const size = sizeOf(site)
        if (Math.random() < 0.6) this.effects.dust(footprintCenter(site.tile, size).setY(0.05), { x: size.x * 0.4, z: size.z * 0.4 })
      }
    }
  }
}
