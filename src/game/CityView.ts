import * as THREE from 'three'
import { sizeOf, type City, type PlacedBuilding } from './City'
import { cropState } from './crops'
import { footprintCenter } from './grid'
import { createBuildingObject, createConstructionSite, createCropObject, cropLookFor, disposeCropObject } from './models'

// Keeps the 3D scene in sync with the City. It only reacts to City events;
// it never decides anything about the game itself.
export class CityView {
  private objects = new Map<number, THREE.Object3D>()
  private tops = new Map<number, number>() // cached results of topOf
  // Farm plots: the crop model on each one, and which look it was built for.
  private crops = new Map<number, { key: string; object: THREE.Object3D }>()
  private scene: THREE.Scene
  private city: City

  constructor(scene: THREE.Scene, city: City) {
    this.scene = scene
    this.city = city
    city.onChange((event) => {
      switch (event.kind) {
        case 'added':
        case 'restored':
          this.create(event.building)
          break
        case 'finished': // the construction site becomes the real building
        case 'upgraded': // it grows a little
          this.destroy(event.building.id)
          this.create(event.building)
          break
        case 'moved':
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
    for (const b of this.city.all()) {
      if (b.type.category !== 'farm') continue
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

  private create(b: PlacedBuilding) {
    // Roads are drawn together by RoadView; here they only get an empty placeholder.
    const obj =
      b.type.category === 'road' ? new THREE.Group() : b.construction ? createConstructionSite(b.type) : createBuildingObject(b.type)
    // Upgraded buildings stand a little taller: 8% per level.
    obj.scale.setScalar(1 + 0.08 * (b.level - 1))
    this.objects.set(b.id, obj)
    this.scene.add(obj)
    this.position(b)
  }

  private destroy(id: number) {
    const obj = this.objects.get(id)
    if (obj) this.scene.remove(obj)
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
  }
}
