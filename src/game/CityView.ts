import * as THREE from 'three'
import { sizeOf, type City, type PlacedBuilding } from './City'
import { cropState } from './crops'
import { footprintCenter } from './grid'
import { isTrack, isPlot } from './buildings'
import { createBuildingObject, createConstructionSite, createCropObject, cropLookFor, disposeBuildingObject, disposeCropObject } from './models'

const POP_MS = 350
const POP_FROM = 0.3 // starting size, as a share of full size

// Keeps the 3D scene in sync with the City. It only reacts to City events;
// it never decides anything about the game itself.
export class CityView {
  private objects = new Map<number, THREE.Object3D>()
  private tops = new Map<number, number>() // cached results of topOf
  // Farm plots: the crop model on each one, and which look it was built for.
  private crops = new Map<number, { key: string; object: THREE.Object3D }>()
  private scene: THREE.Scene
  private city: City
  // Buildings springing into place: when it started (performance.now) and the size to settle at.
  private pops = new Map<number, { start: number; scale: number }>()
  // Set once the saved town has loaded (so loading doesn't pop every building)
  // and turned off by Reduce motion.
  popIn = false
  // Buildings giving a happy squash-and-stretch when collected from.
  private bounces = new Map<number, number>()
  // Cranes swinging round on construction sites.
  private cranes = new Map<number, THREE.Object3D>()

  constructor(scene: THREE.Scene, city: City) {
    this.scene = scene
    this.city = city
    city.onChange((event) => {
      switch (event.kind) {
        case 'added':
        case 'restored':
          this.create(event.building, true)
          break
        case 'finished': // the construction site becomes the real building
        case 'upgraded': // it grows a little
          this.destroy(event.building.id)
          this.create(event.building, true)
          break
        case 'moved':
        case 'damaged': // knocked a little crooked until it's repaired
        case 'repaired':
          this.position(event.building)
          break
        case 'removed':
        case 'stored':
          this.destroy(event.building.id)
          break
      }
    })
  }

  // Called every frame. Crops change look as they grow, ripen and wither,
  // which depends only on the time, so we check each plot's look and rebuild
  // its crop model only when the look actually changes (a few times per crop).
  update(now: number) {
    this.animatePops()
    this.animateBounces()
    for (const jib of this.cranes.values()) jib.rotation.y = Math.sin(performance.now() / 2600 + jib.id) * 1.4
    for (const b of this.city.all()) {
      if (!isPlot(b.type)) continue
      const state = cropState(b.crop, now)
      if (state.stage === 'empty') {
        this.removeCrop(b.id)
        continue
      }
      const look = cropLookFor(state)
      const key = `${state.crop.id}:${look}`
      if (this.crops.get(b.id)?.key === key) continue

      this.removeCrop(b.id)
      const object = createCropObject(state.crop, look, sizeOf(b))
      // A child of the plot, so it moves (and hides) with it.
      this.objects.get(b.id)!.add(object)
      this.crops.set(b.id, { key, object })
    }
  }

  // Used to hide a building while it's being carried during a move.
  setVisible(id: number, visible: boolean) {
    const obj = this.objects.get(id)
    if (obj) obj.visible = visible
  }

  isVisible(id: number): boolean {
    return this.objects.get(id)?.visible ?? false
  }

  // The building a ray hits first (a tap on a tall building's upper floors
  // lands on the ground behind it, so taps check the buildings themselves).
  hit(ray: THREE.Raycaster): { id: number; distance: number } | null {
    let best: { id: number; distance: number } | null = null
    for (const [id, obj] of this.objects) {
      if (!obj.visible) continue
      const first = ray.intersectObject(obj, true).find((h) => shown(h.object))
      if (first && (!best || first.distance < best.distance)) best = { id, distance: first.distance }
    }
    return best
  }

  // Height of the building's top, for placing labels above it. Measuring
  // means walking every mesh, so we remember the answer once the model has
  // loaded. Until then we guess a typical height.
  topOf(id: number): number {
    const cached = this.tops.get(id)
    if (cached !== undefined) return cached
    const obj = this.objects.get(id)
    const box = obj ? new THREE.Box3().setFromObject(obj) : null
    if (!box || box.isEmpty()) return 1.2
    this.tops.set(id, box.max.y)
    return box.max.y
  }

  private create(b: PlacedBuilding, pop = false) {
    // Roads and track are drawn together by RoadView and RailView; here they only get an empty placeholder.
    const obj =
      isTrack(b.type) ? new THREE.Group() : b.construction ? createConstructionSite(b.type) : createBuildingObject(b.type, undefined, b.id)
    // Upgraded buildings stand a little taller: 8% per level.
    const scale = 1 + 0.08 * (b.level - 1)
    obj.scale.setScalar(scale)
    obj.userData.baseScale = scale
    if (pop && this.popIn && !isTrack(b.type)) {
      this.pops.set(b.id, { start: performance.now(), scale })
      obj.scale.setScalar(scale * POP_FROM)
    }
    this.objects.set(b.id, obj)
    const jib = obj.getObjectByName('crane-jib')
    if (jib) this.cranes.set(b.id, jib)
    this.scene.add(obj)
    this.position(b)
  }

  // A quick spring: grow past full size a little, then settle ("ease out back").
  private animatePops() {
    const now = performance.now()
    for (const [id, pop] of this.pops) {
      const obj = this.objects.get(id)
      const t = Math.min(1, (now - pop.start) / POP_MS)
      if (!obj || t >= 1) {
        obj?.scale.setScalar(pop.scale)
        this.pops.delete(id)
        continue
      }
      const s = 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2 + 1 // 0 → overshoots ~10% → 1
      obj.scale.setScalar(pop.scale * (POP_FROM + (1 - POP_FROM) * s))
    }
  }

  // A quick squash and spring back up, as if the building's pleased.
  bounce(id: number) {
    if (this.popIn && !this.pops.has(id)) this.bounces.set(id, performance.now())
  }

  private animateBounces() {
    const now = performance.now()
    for (const [id, start] of this.bounces) {
      const obj = this.objects.get(id)
      const t = (now - start) / 420
      const base = obj?.userData.baseScale ?? 1
      if (!obj || t >= 1) {
        obj?.scale.setScalar(base)
        this.bounces.delete(id)
        continue
      }
      const squash = Math.sin(t * Math.PI * 2) * 0.14 * (1 - t)
      obj.scale.set(base * (1 + squash * 0.5), base * (1 - squash), base * (1 + squash * 0.5))
    }
  }

  private destroy(id: number) {
    this.pops.delete(id)
    this.bounces.delete(id)
    this.cranes.delete(id)
    const obj = this.objects.get(id)
    if (obj) {
      this.scene.remove(obj)
      disposeBuildingObject(obj)
    }
    this.objects.delete(id)
    this.tops.delete(id)
    this.removeCrop(id)
  }

  private removeCrop(id: number) {
    const crop = this.crops.get(id)
    if (!crop) return
    crop.object.removeFromParent()
    disposeCropObject(crop.object)
    this.crops.delete(id)
  }

  private position(b: PlacedBuilding) {
    const obj = this.objects.get(b.id)!
    obj.position.copy(footprintCenter(b.tile, sizeOf(b)))
    // A quarter turn each; the model is centered, so turning it in place fits the turned footprint.
    obj.rotation.y = (-b.rotation * Math.PI) / 2
    obj.rotation.z = b.damaged ? 0.07 : 0
  }
}

// Whether an object and everything it sits in are visible.
export function shown(o: THREE.Object3D | null): boolean {
  for (; o; o = o.parent) if (!o.visible) return false
  return true
}
