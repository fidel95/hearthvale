import * as THREE from 'three'
import { isPlot, isTrack, type BuildingType } from './buildings'
import { sizeOf, type City } from './City'
import { footprintCenter } from './grid'

// What each building stands on, so it sits in the town instead of floating
// on the grass: a soft shadow on the ground around its base, and a pad (a
// trimmed lawn for homes, paving for shops and public buildings). Drawn as
// two batches for the whole town (instancing), so it costs two draw calls
// however big the town gets.

const LAWN = new THREE.Color('#5aa94a')
const PAVING = new THREE.Color('#d9d2c2')

// Green places (parks, gardens, playing fields, the beach) keep their own ground.
const OPEN_AIR = new Set(['park', 'bigpark', 'garden', 'beach', 'playground', 'sportsfield', 'skiresort', 'mine', 'landfill'])

function padFor(type: BuildingType): THREE.Color | null {
  if (OPEN_AIR.has(type.placeholder.shape)) return null
  switch (type.category) {
    case 'home':
      return LAWN
    case 'business':
    case 'community':
    case 'industry':
    case 'landmark':
    case 'storage':
      return PAVING
    default:
      return null
  }
}

// Things too flat or too small for a shadow of their own.
function castsGroundShadow(type: BuildingType): boolean {
  return !isTrack(type) && !isPlot(type) && type.category !== 'road' && !(type.category === 'decoration' && type.size.x * type.size.z < 2)
}

// A white rounded square on a transparent background, soft-edged if `blur`.
function roundedSquare(blur: number, inset: number, edge?: string): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const g = canvas.getContext('2d')!
  g.filter = blur ? `blur(${blur}px)` : 'none'
  g.fillStyle = '#ffffff'
  g.beginPath()
  g.roundRect(inset, inset, size - 2 * inset, size - 2 * inset, 14)
  g.fill()
  if (edge) {
    // A slightly darker rim: a curb around paving, a clipped edge around a lawn.
    g.filter = 'none'
    g.strokeStyle = edge
    g.lineWidth = 4
    g.stroke()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export class LotView {
  private city: City
  private shadows: THREE.InstancedMesh
  private pads: THREE.InstancedMesh
  private dirty = true
  private capacity = 64

  constructor(scene: THREE.Scene, city: City) {
    this.city = city
    const plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
    const shadowMaterial = new THREE.MeshBasicMaterial({
      color: '#1f3a12',
      alphaMap: roundedSquare(10, 18),
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
    const padMaterial = new THREE.MeshStandardMaterial({
      map: roundedSquare(0, 3, 'rgba(0,0,0,0.18)'),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    })
    this.shadows = new THREE.InstancedMesh(plane, shadowMaterial, this.capacity)
    this.pads = new THREE.InstancedMesh(plane, padMaterial, this.capacity)
    this.pads.receiveShadow = true
    for (const mesh of [this.shadows, this.pads]) {
      mesh.count = 0
      mesh.frustumCulled = false // they span the whole town
    }
    this.shadows.position.y = 0.006
    this.pads.position.y = 0.007
    scene.add(this.shadows, this.pads)
    city.onChange((e) => {
      if (['added', 'removed', 'moved', 'restored', 'stored', 'finished', 'land'].includes(e.kind)) this.dirty = true
    })
  }

  // Called every frame; rebuilds only after the town changed.
  update() {
    if (!this.dirty) return
    this.dirty = false
    const buildings = [...this.city.all()]
    if (buildings.length > this.capacity) this.grow(buildings.length * 2)
    const m = new THREE.Matrix4()
    let shadows = 0
    let pads = 0
    for (const b of buildings) {
      const size = sizeOf(b)
      const center = footprintCenter(b.tile, size)
      if (castsGroundShadow(b.type)) {
        // A little bigger than the footprint, so it shows around the base.
        m.makeScale(size.x + 0.35, 1, size.z + 0.35).setPosition(center.x, 0, center.z)
        this.shadows.setMatrixAt(shadows++, m)
      }
      const pad = !b.construction && padFor(b.type)
      if (pad) {
        m.makeScale(size.x * 0.96, 1, size.z * 0.96).setPosition(center.x, 0, center.z)
        this.pads.setMatrixAt(pads, m)
        this.pads.setColorAt(pads++, pad)
      }
    }
    this.shadows.count = shadows
    this.pads.count = pads
    this.shadows.instanceMatrix.needsUpdate = true
    this.pads.instanceMatrix.needsUpdate = true
    if (this.pads.instanceColor) this.pads.instanceColor.needsUpdate = true
  }

  // Room for more buildings: new batches with a bigger capacity.
  private grow(capacity: number) {
    this.capacity = capacity
    for (const key of ['shadows', 'pads'] as const) {
      const old = this[key]
      const next = new THREE.InstancedMesh(old.geometry, old.material, capacity)
      next.position.copy(old.position)
      next.receiveShadow = old.receiveShadow
      next.frustumCulled = false
      old.parent!.add(next)
      old.removeFromParent()
      old.dispose()
      this[key] = next
    }
  }
}
