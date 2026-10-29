import * as THREE from 'three'

// Rain showers, for looks: every few minutes it clouds over and rains for a
// while. The rain fades in and out; while it's raining the light dims, the
// sky turns gray, walkers open umbrellas and the beach empties (Game passes
// that on). Nothing in the game depends on it.

const DROPS = 1400
const AREA = 26 // half-width of the box of rain around the view
const HEIGHT = 16
const FALL = 16 // world units per second
const SKY = { clear: new THREE.Color('#9fd4f0'), rain: new THREE.Color('#8b9aa6'), winter: new THREE.Color('#c9d8e4') }
const FLAKES = 900
const SNOW_FALL = 1.6

export class WeatherView {
  // 0 (dry) to 1 (pouring), easing between the two.
  intensity = 0
  enabled = true
  showDrops = true // off with Reduce motion: the sky still dims, but nothing falls
  // Called when rain starts (true) or stops (false).
  onChange?: (raining: boolean) => void
  // Snow mode: showers fall as snow, with light flurries in between, and snow
  // settles on the ground. snowCover eases toward 1 while it's on (Game
  // passes it to the land, trees and hills).
  snow = false
  snowCover = 0
  private forced = false // a storm someone asked for (DisasterView)
  private flakes: THREE.Points
  private flakeData: Float32Array

  private scene: THREE.Scene
  private center: () => THREE.Vector3
  private lights: { light: THREE.Light; base: number }[]
  private rain: THREE.LineSegments
  private drops: Float32Array
  private raining = false
  private untilChange = 70 + Math.random() * 60 // first shower after a minute or two

  constructor(scene: THREE.Scene, center: () => THREE.Vector3, lights: THREE.Light[]) {
    this.scene = scene
    this.center = center
    this.lights = lights.map((light) => ({ light, base: light.intensity }))
    this.drops = new Float32Array(DROPS * 6)
    for (let i = 0; i < DROPS; i++) this.resetDrop(i, Math.random() * HEIGHT)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(this.drops, 3))
    this.rain = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: '#dbe9f5', transparent: true, opacity: 0 }))
    this.rain.frustumCulled = false
    this.rain.visible = false
    scene.add(this.rain)
    this.flakeData = new Float32Array(FLAKES * 3)
    for (let i = 0; i < FLAKES; i++) this.flakeData.set([(Math.random() - 0.5) * 2 * AREA, Math.random() * HEIGHT, (Math.random() - 0.5) * 2 * AREA], i * 3)
    const flakeGeometry = new THREE.BufferGeometry()
    flakeGeometry.setAttribute('position', new THREE.BufferAttribute(this.flakeData, 3))
    this.flakes = new THREE.Points(flakeGeometry, new THREE.PointsMaterial({ color: '#ffffff', size: 0.2, transparent: true, opacity: 0 }))
    this.flakes.frustumCulled = false
    this.flakes.visible = false
    scene.add(this.flakes)
  }

  // A storm for as long as a disaster needs one (rain, or snow in snow mode).
  setStorm(on: boolean) {
    if (on === this.forced) return
    this.forced = on
    const before = this.raining
    this.raining = on || this.raining
    if (!on) this.untilChange = Math.min(this.untilChange, 5)
    if (this.raining !== before) this.onChange?.(this.raining)
  }

  get isRaining() {
    return this.raining
  }

  // Start or stop the rain now (Admin tools).
  toggle() {
    this.raining = !this.raining
    this.untilChange = this.raining ? 60 : 150 + Math.random() * 180
    this.onChange?.(this.raining)
  }

  update(dt: number) {
    // The schedule: dry for a few minutes, then a shower of a minute or so.
    this.untilChange -= dt
    if (this.untilChange <= 0 && !this.forced) {
      this.raining = !this.raining && this.enabled
      this.untilChange = this.raining ? 40 + Math.random() * 50 : 150 + Math.random() * 180
      this.onChange?.(this.raining)
    }
    if (!this.enabled && this.raining && !this.forced) {
      this.raining = false
      this.onChange?.(false)
    }
    // In snow mode there are always a few flurries.
    const target = this.raining ? 1 : this.snow ? 0.3 : 0
    this.intensity += Math.sign(target - this.intensity) * Math.min(Math.abs(target - this.intensity), dt / 4)
    const cover = this.snow ? 1 : 0
    this.snowCover += Math.sign(cover - this.snowCover) * Math.min(Math.abs(cover - this.snowCover), dt / 5)

    for (const { light, base } of this.lights) light.intensity = base * (1 - (this.snow ? 0.2 : 0.4) * this.intensity)
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.copy(SKY.clear).lerp(SKY.winter, this.snowCover * 0.7).lerp(SKY.rain, this.intensity * (this.snow ? 0.4 : 1))
    }

    this.flakes.visible = this.snow && this.intensity > 0.01 && this.showDrops
    if (this.flakes.visible) this.fallSnow(dt)
    this.rain.visible = !this.snow && this.intensity > 0.01 && this.showDrops
    if (!this.rain.visible) return
    ;(this.rain.material as THREE.LineBasicMaterial).opacity = 0.55 * this.intensity
    this.rain.position.copy(this.center()).setY(0)
    for (let i = 0; i < DROPS; i++) {
      const o = i * 6
      const y = this.drops[o + 1] - FALL * dt
      if (y < 0) this.resetDrop(i, HEIGHT)
      else {
        this.drops[o + 1] = y
        this.drops[o + 4] = y - 0.45
      }
    }
    this.rain.geometry.attributes.position.needsUpdate = true
  }

  // Snowflakes drift down slowly, swaying, and start again at the top.
  private fallSnow(dt: number) {
    ;(this.flakes.material as THREE.PointsMaterial).opacity = 0.95 * Math.min(1, this.intensity * 1.6)
    this.flakes.position.copy(this.center()).setY(0)
    const t = performance.now() / 1000
    for (let i = 0; i < FLAKES; i++) {
      const o = i * 3
      let y = this.flakeData[o + 1] - SNOW_FALL * dt * (0.7 + (i % 5) * 0.1)
      if (y < 0) y += HEIGHT
      this.flakeData[o + 1] = y
      this.flakeData[o] += Math.sin(t * 0.8 + i) * dt * 0.3
    }
    this.flakes.geometry.attributes.position.needsUpdate = true
  }

  private resetDrop(i: number, y: number) {
    const o = i * 6
    const x = (Math.random() - 0.5) * 2 * AREA
    const z = (Math.random() - 0.5) * 2 * AREA
    // Each drop is a short streak, slanting a little in the wind.
    this.drops.set([x, y, z, x + 0.06, y - 0.45, z + 0.03], o)
  }
}
