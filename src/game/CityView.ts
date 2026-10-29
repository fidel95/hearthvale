import * as THREE from 'three'
import type { City, PlacedBuilding } from './City'
import { footprintCenter } from './grid'
import { createBuildingObject } from './models'

// Keeps the 3D scene in sync with the City. It only reacts to City events;
// it never decides anything about the game itself.
export class CityView {
  private objects = new Map<number, THREE.Object3D>()
  private scene: THREE.Scene

  constructor(scene: THREE.Scene, city: City) {
    this.scene = scene
    city.onChange((event) => {
      switch (event.kind) {
        case 'added': {
          const obj = createBuildingObject(event.building.type)
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
          break
      }
    })
  }

  // Used to hide a building while it's being carried during a move.
  setVisible(id: number, visible: boolean) {
    const obj = this.objects.get(id)
    if (obj) obj.visible = visible
  }

  isVisible(id: number): boolean {
    return this.objects.get(id)?.visible ?? false
  }

  // Height of the building's top, for placing labels above it.
  // Falls back to a typical height if the model hasn't loaded yet.
  topOf(id: number): number {
    const obj = this.objects.get(id)
    const box = obj ? new THREE.Box3().setFromObject(obj) : null
    return box && !box.isEmpty() ? box.max.y : 1.2
  }

  private position(b: PlacedBuilding) {
    this.objects.get(b.id)!.position.copy(footprintCenter(b.tile, b.type.size))
  }
}
