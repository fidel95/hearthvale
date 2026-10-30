import * as THREE from 'three'

// Little particle effects that make things feel alive: dust when a building
// lands, sparkles when one's finished, chimney smoke, confetti and
// fireworks. Each particle is a tiny mesh with a velocity, a lifetime, and a
// size and opacity that change as it ages. Kept to a fixed number at once so
// a busy town can't slow a phone down; with Reduce motion there are none.

const MAX = 260
const shapes = {
  puff: new THREE.IcosahedronGeometry(0.1, 0),
  spark: new THREE.OctahedronGeometry(0.05, 0),
  flake: new THREE.PlaneGeometry(0.06, 0.04),
}

interface Particle {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial | THREE.MeshLambertMaterial>
  velocity: THREE.Vector3
  gravity: number
  drag: number
  age: number
  life: number
  grow: number // how much bigger it gets over its life
  spin: number
  baseScale: number
  alpha: number // starting opacity
}

export class EffectsView {
  enabled = true
  private scene: THREE.Scene
  private particles: Particle[] = []

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  private spawn(
    shape: keyof typeof shapes,
    color: string,
    at: THREE.Vector3,
    velocity: THREE.Vector3,
    { life = 1, gravity = 0, drag = 0, grow = 0, scale = 1, glow = false, spin = 0, alpha = 1, soft = false } = {},
  ) {
    if (!this.enabled) return
    if (this.particles.length >= MAX) this.remove(this.particles[0])
    // Glowing sparks and soft puffs (dust, smoke) ignore the light; solid bits are lit.
    const material = glow || soft
      ? new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: !soft })
      : new THREE.MeshLambertMaterial({ color, transparent: true })
    if (shape === 'flake') material.side = THREE.DoubleSide
    const mesh = new THREE.Mesh(shapes[shape], material)
    mesh.position.copy(at)
    mesh.scale.setScalar(scale)
    mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6)
    this.scene.add(mesh)
    material.opacity = alpha
    this.particles.push({ mesh, velocity, gravity, drag, age: 0, life, grow, spin, baseScale: scale, alpha })
  }

  update(dt: number) {
    for (const p of [...this.particles]) {
      p.age += dt
      if (p.age >= p.life) {
        this.remove(p)
        continue
      }
      p.velocity.y -= p.gravity * dt
      p.velocity.multiplyScalar(1 - Math.min(1, p.drag * dt))
      p.mesh.position.addScaledVector(p.velocity, dt)
      const u = p.age / p.life
      p.mesh.scale.setScalar(p.baseScale * (1 + p.grow * u))
      p.mesh.material.opacity = p.alpha * (u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4)
      if (p.spin) {
        p.mesh.rotation.x += p.spin * dt
        p.mesh.rotation.y += p.spin * dt * 0.7
      }
    }
  }

  private remove(p: Particle) {
    this.scene.remove(p.mesh)
    p.mesh.material.dispose()
    this.particles.splice(this.particles.indexOf(p), 1)
  }

  // ---- The effects

  // A ring of dust round a footprint, as a building lands.
  dust(center: THREE.Vector3, size: { x: number; z: number }) {
    const n = Math.round(8 + (size.x + size.z) * 3)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const edge = new THREE.Vector3(Math.cos(a) * size.x * 0.5, 0.05, Math.sin(a) * size.z * 0.5)
      this.spawn('puff', '#f3ead8', center.clone().add(edge), edge.clone().normalize().multiplyScalar(0.9).setY(0.35), {
        life: 0.8 + Math.random() * 0.4,
        drag: 2.5,
        grow: 2.2,
        scale: 0.8 + Math.random() * 0.5,
        soft: true,
        alpha: 0.55,
      })
    }
  }

  // Glittering sparkles shooting up and falling, for something new or finished.
  sparkle(at: THREE.Vector3, count = 14) {
    const colors = ['#ffe680', '#ffffff', '#ffd23f', '#9fe8ff']
    for (let i = 0; i < count; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 1.6, 1.6 + Math.random() * 1.4, (Math.random() - 0.5) * 1.6)
      this.spawn('spark', colors[i % colors.length], at.clone(), v, { life: 0.9 + Math.random() * 0.5, gravity: 3, glow: true, spin: 8, scale: 1.2 })
    }
  }

  // A puff of chimney smoke, drifting up and away.
  smoke(at: THREE.Vector3) {
    this.spawn('puff', '#f2f2f2', at.clone(), new THREE.Vector3(0.12 + Math.random() * 0.1, 0.45, 0.05), { life: 2.6, grow: 2.4, scale: 0.55, soft: true, alpha: 0.7 })
  }

  // Confetti: little paper squares tumbling down.
  confetti(at: THREE.Vector3, count = 30) {
    const colors = ['#ff5c8a', '#2f7fe0', '#ffd23f', '#3fae6b', '#ff7043', '#b46cf0']
    for (let i = 0; i < count; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 2.4, 2.4 + Math.random() * 1.6, (Math.random() - 0.5) * 2.4)
      this.spawn('flake', colors[i % colors.length], at.clone(), v, { life: 2.2, gravity: 2.4, drag: 1.4, spin: 9, scale: 1.4 })
    }
  }

  // A firework: a rocket's burst of glowing sparks high over the town.
  firework(at: THREE.Vector3) {
    const color = ['#ff5c8a', '#ffd23f', '#4fc3f7', '#b46cf0', '#7ee081'][Math.floor(Math.random() * 5)]
    for (let i = 0; i < 40; i++) {
      // Points spread evenly over a sphere.
      const y = 1 - (i / 39) * 2
      const r = Math.sqrt(1 - y * y)
      const a = i * 2.4
      const v = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r).multiplyScalar(2.6)
      this.spawn('spark', color, at.clone(), v, { life: 1.4, gravity: 1.2, drag: 1.2, glow: true, scale: 1.6 })
    }
  }
}
