import * as THREE from 'three'
import type { City, PlacedBuilding } from './City'
import { cropState } from './crops'
import { footprintCenter } from './grid'
import { createBuildingObject, createCropObject, cropLookFor, disposeCropObject } from './models'

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
        case 'added': {
          // Roads are drawn together by RoadView; here they only get an empty placeholder.
          const obj = event.building.type.category === 'road' ? new THREE.Group() : createBuildingObject(event.building.type)
          this.objects.set(event.building.id, obj)
          this.scene.add(obj)
          this.position(event.building)
          break
        }
        case 'moved':
          this.position(event.building)
          break
        case 'removed':
          this.scene.remove(this.objects.get(event.building.id)!)
          this.objects.delete(event.building.id)
          this.tops.delete(event.building.id)
          this.removeCrop(event.building.id)
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
      const object = createCropObject(state.crop, look, b.type.size)
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

  private removeCrop(id: number) {
    const crop = this.crops.get(id)
    if (!crop) return
    crop.object.removeFromParent()
    disposeCropObject(crop.object)
    this.crops.delete(id)
  }

  private position(b: PlacedBuilding) {
    this.objects.get(b.id)!.position.copy(footprintCenter(b.tile, b.type.size))
  }
}
