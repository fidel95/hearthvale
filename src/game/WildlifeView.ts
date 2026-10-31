import * as THREE from 'three'
import type { City } from './City'
import { GRID_SIZE, inBounds, tileToWorld, worldToTile, type Tile } from './grid'
import { turnToward } from './motion'
import { seededRandom } from './neighborData'
import { PEAKS, coastZ, isRiver, isRock, nearMountain } from './terrain'

// Wild animals out in the countryside, for looks: deer grazing in the
// meadows, mountain goats on the Highlands' slopes, rabbits hopping about,
// and eagles circling the tallest peaks. They keep to land that isn't the
// town's (so they move off as the town buys land), wandering near home,
// stopping to graze, and wandering on.

type Kind = 'deer' | 'goat' | 'rabbit'

interface Wild {
  kind: Kind
  root: THREE.Group
  head: THREE.Object3D
  home: THREE.Vector3
  target: THREE.Vector3 | null
  heading: number
  wait: number // seconds left grazing
  hop: number
}

interface Eagle {
  root: THREE.Group
  wings: [THREE.Object3D, THREE.Object3D]
  center: THREE.Vector3
  radius: number
  angle: number
  speed: number
}

const SPEED: Record<Kind, number> = { deer: 0.45, goat: 0.3, rabbit: 0.7 }
const RANGE: Record<Kind, number> = { deer: 3, goat: 2, rabbit: 1.5 }

const materials = new Map<string, THREE.MeshLambertMaterial>()
const material = (color: string) => {
  let m = materials.get(color)
  if (!m) materials.set(color, (m = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide })))
  return m
}

// Each animal is built along +x (its head end), standing on y = 0. One
// model per kind, copied (sharing shapes) for each animal.
const templates = new Map<Kind, THREE.Group>()
function makeAnimal(kind: Kind, antlers: boolean): THREE.Group {
  const key = antlers ? `${kind}+` : kind
  let template = templates.get(key as Kind)
  if (!template) templates.set(key as Kind, (template = buildAnimal(kind, antlers)))
  return template.clone(true)
}

function buildAnimal(kind: Kind, antlers: boolean): THREE.Group {
  const root = new THREE.Group()
  const head = new THREE.Group()
  head.name = 'head'
  const part = (g: THREE.BufferGeometry, color: string, parent: THREE.Object3D = root) => {
    const m = new THREE.Mesh(g, material(color))
    m.castShadow = true
    parent.add(m)
  }
  const legs = (color: string, x: number, z: number, h: number, w: number) => {
    for (const lx of [-x, x]) for (const lz of [-z, z]) part(new THREE.BoxGeometry(w, h, w).translate(lx, h / 2, lz), color)
  }
  switch (kind) {
    case 'deer':
      part(new THREE.BoxGeometry(0.34, 0.15, 0.13).translate(0, 0.27, 0), '#a8693a')
      part(new THREE.BoxGeometry(0.05, 0.06, 0.07).translate(-0.18, 0.3, 0), '#f4efe6') // white tail
      head.position.set(0.17, 0.33, 0)
      part(new THREE.BoxGeometry(0.06, 0.16, 0.06).translate(0, 0.06, 0), '#a8693a', head) // neck
      part(new THREE.BoxGeometry(0.11, 0.07, 0.07).translate(0.04, 0.15, 0), '#a8693a', head)
      part(new THREE.BoxGeometry(0.03, 0.03, 0.04).translate(0.1, 0.14, 0), '#2b2d33', head)
      for (const z of [-0.035, 0.035]) part(new THREE.ConeGeometry(0.018, 0.06, 4).translate(-0.01, 0.21, z * 1.6), '#8a5530', head)
      if (antlers)
        for (const z of [-1, 1]) {
          part(new THREE.BoxGeometry(0.012, 0.12, 0.012).rotateX(z * 0.4).translate(0, 0.26, z * 0.04), '#e8dcc0', head)
          part(new THREE.BoxGeometry(0.05, 0.012, 0.012).translate(0.02, 0.28, z * 0.06), '#e8dcc0', head)
        }
      legs('#8a5530', 0.12, 0.045, 0.2, 0.025)
      break
    case 'goat':
      part(new THREE.BoxGeometry(0.24, 0.13, 0.12).translate(0, 0.19, 0), '#f1ede4')
      head.position.set(0.13, 0.25, 0)
      part(new THREE.BoxGeometry(0.09, 0.07, 0.06).translate(0.03, 0.02, 0), '#f1ede4', head)
      part(new THREE.BoxGeometry(0.02, 0.05, 0.02).translate(0.05, -0.04, 0), '#d8d2c4', head) // beard
      for (const z of [-0.02, 0.02]) part(new THREE.ConeGeometry(0.012, 0.08, 4).rotateZ(0.6).translate(-0.02, 0.08, z), '#4a4038', head)
      legs('#d8d2c4', 0.08, 0.04, 0.13, 0.025)
      break
    case 'rabbit':
      part(new THREE.SphereGeometry(0.05, 7, 5).scale(1.3, 1, 1).translate(0, 0.05, 0), '#9c8a74')
      part(new THREE.SphereGeometry(0.02, 5, 4).translate(-0.065, 0.06, 0), '#f4efe6')
      head.position.set(0.06, 0.08, 0)
      part(new THREE.SphereGeometry(0.032, 6, 5), '#9c8a74', head)
      for (const z of [-0.012, 0.012]) part(new THREE.BoxGeometry(0.012, 0.06, 0.018).translate(-0.005, 0.05, z), '#9c8a74', head)
      break
  }
  root.add(head)
  return root
}

function makeEagle(): { root: THREE.Group; wings: [THREE.Object3D, THREE.Object3D] } {
  const root = new THREE.Group()
  root.add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4).scale(2, 0.8, 0.8), material('#5a3e28')))
  root.add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4).translate(0.16, 0.02, 0), material('#f4f1ea')))
  const wing = (side: number) => {
    const pivot = new THREE.Group()
    pivot.add(new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.5).rotateX(Math.PI / 2).translate(0, 0, side * 0.25), material('#4a3220')))
    root.add(pivot)
    return pivot
  }
  return { root, wings: [wing(-1), wing(1)] }
}

export class WildlifeView {
  private group = new THREE.Group()
  private animals: Wild[] = []
  private eagles: Eagle[] = []
  private city: City

  constructor(scene: THREE.Scene, city: City) {
    this.city = city
    scene.add(this.group)
    this.rebuild()
    city.onChange((e) => e.kind === 'land' && this.rebuild())
    // Eagles over the three tallest peaks.
    for (const p of [...PEAKS].sort((a, b) => b.height - a.height).slice(0, 3)) {
      const { root, wings } = makeEagle()
      this.group.add(root)
      const center = tileToWorld({ x: Math.floor(p.x), z: Math.floor(p.z) }).setY(p.height + 1.5)
      this.eagles.push({ root, wings, center, radius: 2.5 + p.radius * 0.4, angle: p.x, speed: 0.35 })
    }
  }

  setVisible(visible: boolean) {
    this.group.visible = visible
  }

  // Wild land: not the town's, not sea, beach, river or mountain rock.
  private wild = (t: Tile) => inBounds(t) && !this.city.ownsTile(t) && !isRock(t) && !isRiver(t) && t.z < coastZ(t.x) - 2

  // Herds where they were before (the same random numbers each time), on
  // whatever's still wild.
  private rebuild() {
    for (const a of this.animals) this.group.remove(a.root)
    this.animals = []
    const rand = seededRandom(31)
    const spot = (test: (t: Tile) => boolean): Tile | null => {
      for (let i = 0; i < 40; i++) {
        const t = { x: Math.floor(rand() * GRID_SIZE), z: Math.floor(rand() * GRID_SIZE) }
        if (this.wild(t) && test(t)) return t
      }
      return null
    }
    const herd = (kind: Kind, groups: number, size: number, test: (t: Tile) => boolean) => {
      for (let g = 0; g < groups; g++) {
        const at = spot(test)
        if (!at) continue
        for (let i = 0; i < size; i++) {
          const root = makeAnimal(kind, kind === 'deer' && i === 0)
          const home = tileToWorld(at).add(new THREE.Vector3(rand() - 0.5, 0, rand() - 0.5).multiplyScalar(1.5))
          root.position.copy(home)
          root.scale.setScalar(kind === 'rabbit' ? 1 : 1.2)
          this.group.add(root)
          this.animals.push({ kind, root, head: root.getObjectByName('head')!, home, target: null, heading: rand() * 6.3, wait: rand() * 5, hop: rand() * 6 })
        }
      }
    }
    herd('deer', 7, 3, (t) => !nearMountain(t, 2))
    herd('goat', 6, 2, (t) => nearMountain(t, 2.5))
    herd('rabbit', 10, 1, () => true)
  }

  update(dt: number) {
    if (!this.group.visible) return
    for (const a of this.animals) {
      const head = a.head
      if (!a.target) {
        a.wait -= dt
        // Grazing: the head goes down to eat, and up to look around now and then.
        head.rotation.z = THREE.MathUtils.lerp(head.rotation.z, Math.sin(a.wait * 1.3) > -0.3 ? -0.9 : 0, Math.min(1, dt * 3))
        a.root.position.y = 0
        if (a.wait <= 0) {
          const range = RANGE[a.kind]
          const to = a.home.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2 * range, 0, (Math.random() - 0.5) * 2 * range))
          const tile = worldToTile(to)
          if (tile && this.wild(tile)) a.target = to
          else a.wait = 1
        }
        continue
      }
      head.rotation.z = THREE.MathUtils.lerp(head.rotation.z, 0, Math.min(1, dt * 4))
      const to = a.target.clone().sub(a.root.position).setY(0)
      const distance = to.length()
      if (distance < 0.05) {
        a.target = null
        a.wait = 3 + Math.random() * 6
        continue
      }
      a.heading = turnToward(a.heading, Math.atan2(-to.z, to.x), 5, dt)
      a.root.rotation.y = a.heading
      const step = Math.min(distance, SPEED[a.kind] * dt)
      a.root.position.addScaledVector(to.normalize(), step)
      // Rabbits hop; the others walk with a little bob.
      a.hop += dt * (a.kind === 'rabbit' ? 9 : 8)
      a.root.position.y = a.kind === 'rabbit' ? Math.abs(Math.sin(a.hop)) * 0.06 : Math.abs(Math.sin(a.hop)) * 0.012
    }
    for (const e of this.eagles) {
      e.angle += e.speed * dt
      e.root.position.set(e.center.x + Math.cos(e.angle) * e.radius, e.center.y + Math.sin(e.angle * 0.7) * 0.3, e.center.z + Math.sin(e.angle) * e.radius)
      e.root.rotation.set(-0.25, Math.atan2(-Math.cos(e.angle), -Math.sin(e.angle)), 0, 'YXZ') // along the circle, banking into the turn
      // Mostly soaring, with a few slow flaps now and then.
      const flap = Math.sin(e.angle * 3) > 0.7 ? Math.sin(e.angle * 40) * 0.5 : 0.1
      e.wings[0].rotation.x = flap
      e.wings[1].rotation.x = -flap
    }
  }
}
