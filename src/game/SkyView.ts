import * as THREE from 'three'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import type { City } from './City'
import { sizeOf } from './City'
import { footprintCenter } from './grid'

// Things in the sky now and then: hot air balloons drifting over town, and,
// rarely, a UFO that comes to hover over one of your buildings. Tap the UFO
// before it leaves and its visitors leave a gift (ufoGift). Balloons are for
// looks and stop with Reduce motion; the UFO still comes, but holds still.

// What tapping the UFO gives, at a player level.
export function ufoGift(level: number): { coins: number; xp: number } {
  return { coins: 40 * level, xp: 10 + 2 * level }
}

const UFO_EVERY = [360, 600] // seconds of game time between visits, at random in this range
const UFO_STAYS = 35 // seconds hovering before it gives up and leaves
const BALLOON_EVERY = [70, 140]

const BALLOON_COLORS = [
  ['#e0453a', '#f7d046'],
  ['#3a6fb0', '#f4f6f8'],
  ['#6cc04a', '#f7d046'],
  ['#9b59b6', '#f39c12'],
]

function makeBalloon(): THREE.Group {
  const root = new THREE.Group()
  const [a, b] = BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)]
  // The envelope: eight panels in two colors, taller than it is wide.
  for (let i = 0; i < 8; i++) {
    const panel = new THREE.SphereGeometry(0.7, 3, 12, (i * Math.PI) / 4, Math.PI / 4).scale(1, 1.2, 1)
    root.add(new THREE.Mesh(panel, new THREE.MeshLambertMaterial({ color: i % 2 ? a : b })))
  }
  root.add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.12, 0.3, 8).translate(0, -0.95, 0), new THREE.MeshLambertMaterial({ color: a })))
  root.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.22).translate(0, -1.45, 0), new THREE.MeshLambertMaterial({ color: '#8a5a36' })))
  const rope = new THREE.MeshLambertMaterial({ color: '#3b3f46' })
  for (const [x, z] of [[-0.1, -0.1], [0.1, -0.1], [-0.1, 0.1], [0.1, 0.1]]) {
    root.add(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.42, 3).translate(x, -1.18, z), rope))
  }
  root.traverse((o) => o instanceof THREE.Mesh && (o.castShadow = true))
  return root
}

function makeUfo(): { root: THREE.Group; beam: THREE.Mesh; lights: THREE.Mesh[] } {
  const root = new THREE.Group()
  const hull = new THREE.MeshStandardMaterial({ color: '#b8c2cc', metalness: 0.6, roughness: 0.3 })
  root.add(new THREE.Mesh(new THREE.SphereGeometry(0.9, 18, 8).scale(1, 0.22, 1), hull))
  root.add(new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.12, 0), new THREE.MeshStandardMaterial({ color: '#8fe3c8', transparent: true, opacity: 0.8 })))
  const lights: THREE.Mesh[] = []
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffe27a' }))
    light.position.set(Math.cos(a) * 0.78, -0.04, Math.sin(a) * 0.78)
    root.add(light)
    lights.push(light)
  }
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(0.9, 4, 16, 1, true).translate(0, -2, 0),
    new THREE.MeshBasicMaterial({ color: '#b8ffe0', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
  )
  root.add(beam)
  return { root, beam, lights }
}

interface Balloon {
  root: THREE.Group
  heading: THREE.Vector3
  travelled: number
  bob: number
}

const between = ([a, b]: number[]) => a + Math.random() * (b - a)

export class SkyView {
  enabled = true
  // Called when the UFO is tapped (Game pays the gift).
  onUfoTapped: (() => void) | null = null
  private scene: THREE.Scene
  private city: City
  private center: () => THREE.Vector3
  private balloons: Balloon[] = []
  private untilBalloon = between([15, 40])
  private untilUfo = between([90, 200]) // the first visit comes sooner
  private ufo: (ReturnType<typeof makeUfo> & { label: CSS2DObject; over: THREE.Vector3; t: number; leaving: number }) | null = null

  // ufoSoon: the first UFO comes in a few seconds (for browser checks in development).
  constructor(scene: THREE.Scene, city: City, center: () => THREE.Vector3, ufoSoon = false) {
    if (ufoSoon) this.untilUfo = 3
    this.scene = scene
    this.city = city
    this.center = center
  }

  update(dt: number) {
    this.flyBalloons(dt)
    this.flyUfo(dt)
  }

  private flyBalloons(dt: number) {
    if (!this.enabled) {
      for (const b of this.balloons) this.scene.remove(b.root)
      this.balloons = []
      return
    }
    this.untilBalloon -= dt
    if (this.untilBalloon <= 0) {
      this.untilBalloon = between(BALLOON_EVERY)
      const angle = Math.random() * Math.PI * 2
      const heading = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle))
      const side = new THREE.Vector3(-heading.z, 0, heading.x).multiplyScalar((Math.random() - 0.5) * 16)
      const root = makeBalloon()
      root.position.copy(this.center()).addScaledVector(heading, -30).add(side).setY(6 + Math.random() * 3)
      this.scene.add(root)
      this.balloons.push({ root, heading, travelled: 0, bob: Math.random() * 6 })
    }
    for (const b of [...this.balloons]) {
      const step = dt * 0.8
      b.travelled += step
      b.bob += dt
      b.root.position.addScaledVector(b.heading, step)
      b.root.position.y += Math.sin(b.bob * 0.6) * dt * 0.15
      b.root.rotation.y += dt * 0.05
      if (b.travelled > 60) {
        this.scene.remove(b.root)
        this.balloons.splice(this.balloons.indexOf(b), 1)
      }
    }
  }

  private flyUfo(dt: number) {
    const ufo = this.ufo
    if (!ufo) {
      this.untilUfo -= dt
      if (this.untilUfo <= 0) this.arrive()
      return
    }
    ufo.t += dt
    const still = !this.enabled
    for (const [i, light] of ufo.lights.entries()) light.visible = still || Math.floor(ufo.t * 6 + i) % 2 === 0
    if (!still) ufo.root.rotation.y += dt * 1.5
    ;(ufo.beam.material as THREE.MeshBasicMaterial).opacity = ufo.leaving > 0 ? 0 : 0.16 + Math.sin(ufo.t * 4) * 0.06
    if (ufo.leaving > 0) {
      // Off it goes, up and away.
      ufo.leaving += dt
      ufo.root.position.y += dt * (2 + ufo.leaving * 8)
      ufo.root.position.x += dt * ufo.leaving * 6
      if (ufo.leaving > 3) this.depart()
      return
    }
    // Swooping in, then hovering with a gentle wobble.
    const hover = ufo.over.clone().setY(ufo.over.y + 3.2 + Math.sin(ufo.t * 1.7) * 0.15)
    const arriving = Math.min(1, ufo.t / 3)
    ufo.root.position.lerpVectors(hover.clone().add(new THREE.Vector3(-20, 14, -20)), hover, 1 - (1 - arriving) ** 3)
    ufo.beam.visible = arriving >= 1
    ufo.label.visible = arriving >= 1
    if (ufo.t > UFO_STAYS) this.leave()
  }

  // Come to hover over one of the town's buildings (not roads or decorations).
  private arrive() {
    this.untilUfo = between(UFO_EVERY)
    const choices = [...this.city.all()].filter((b) => b.type.income && this.city.isBuilt(b))
    if (!choices.length) return
    const b = choices[Math.floor(Math.random() * choices.length)]
    const over = footprintCenter(b.tile, sizeOf(b))
    const parts = makeUfo()
    const button = document.createElement('button')
    button.className = 'sky-gift'
    button.textContent = '🛸'
    button.setAttribute('aria-label', 'A UFO! Tap it for a gift')
    button.title = 'A UFO! Tap it for a gift'
    button.addEventListener('click', (e) => {
      e.stopPropagation()
      if (!this.ufo || this.ufo.leaving > 0) return
      this.onUfoTapped?.()
      this.leave()
    })
    // The button pulses (a CSS transform), so it sits in a holder that the label renderer moves.
    const holder = document.createElement('div')
    holder.className = 'sky-gift-holder'
    holder.append(button)
    const label = new CSS2DObject(holder)
    label.position.set(0, 0.9, 0)
    label.visible = false
    parts.root.add(label)
    parts.root.position.copy(over).add(new THREE.Vector3(-20, 17, -20))
    this.scene.add(parts.root)
    this.ufo = { ...parts, label, over, t: 0, leaving: 0 }
  }

  private leave() {
    if (!this.ufo) return
    this.ufo.leaving = 0.01
    this.ufo.label.visible = false
    this.ufo.label.element.remove()
  }

  private depart() {
    if (!this.ufo) return
    this.ufo.label.element.remove()
    this.ufo.root.removeFromParent()
    this.ufo = null
  }
}
