import type * as THREE from 'three'

// Room on the roads: everything that drives on them (cars, buses, trucks,
// fire engines, police cars, ambulances, the tractor) is listed here, and
// before moving on each asks whether the way ahead is clear, so nothing ever
// drives through anything else. Purely for looks, like the views that use it.
//
// "Ahead" is along the vehicle's own heading (rotation.y; models face +x),
// and "in the way" means overlapping its lane, allowing for the other's
// length if it's crossing. When two block each other (crossing in a
// junction), the more important one goes first: emergencies, then buses and
// trucks, then cars; between equals, whoever was there first.

const MARGIN = 0.1 // the gap kept to whatever's in front
const HALF_WIDTH = 0.1 // half a vehicle's width

export interface Mover {
  object: THREE.Object3D
  halfLength: number
  priority: number // higher goes first when two block each other
  order: number // when it joined (earlier goes first between equals)
}

export const PRIORITY = { car: 0, heavy: 1, emergency: 2 }

export class RoadSpace {
  private movers = new Map<THREE.Object3D, Mover>()
  private joined = 0

  add(object: THREE.Object3D, halfLength: number, priority = PRIORITY.car) {
    this.movers.set(object, { object, halfLength, priority, order: this.joined++ })
  }

  remove(object: THREE.Object3D) {
    this.movers.delete(object)
  }

  // Is anything within r of this spot (somewhere to put a new vehicle)?
  occupied(x: number, z: number, r: number): boolean {
    for (const m of this.movers.values()) if (m.object.parent && Math.hypot(m.object.position.x - x, m.object.position.z - z) < r + m.halfLength) return true
    return false
  }

  // Is something in the way within `look` (beyond the two vehicles' own
  // half lengths and a margin) ahead of this one? heading: the way it's
  // about to go, if not the way it faces (turning round).
  blocked(object: THREE.Object3D, look = 0, heading = object.rotation.y): boolean {
    const me = this.movers.get(object)
    if (!me) return false
    for (const other of this.movers.values()) {
      if (other === me || !other.object.parent || !other.object.visible) continue
      if (!this.inWay(me, other, look, heading)) continue
      // Both in each other's way: the more important (or earlier) one goes.
      if (this.inWay(other, me, 0) && (other.priority < me.priority || (other.priority === me.priority && other.order > me.order))) continue
      return true
    }
    return false
  }

  // Is b in a's way?
  private inWay(a: Mover, b: Mover, look: number, heading = a.object.rotation.y): boolean {
    const p = a.object.position
    const q = b.object.position
    const dx = q.x - p.x
    const dz = q.z - p.z
    const reach = a.halfLength + b.halfLength + MARGIN + look
    if (Math.abs(dx) > reach + 1 || Math.abs(dz) > reach + 1) return false
    const fx = Math.cos(heading)
    const fz = -Math.sin(heading)
    const ahead = dx * fx + dz * fz
    if (ahead <= 0) return false
    // How b lies across a's path: along it (following), or across (crossing).
    const gx = Math.cos(b.object.rotation.y)
    const gz = -Math.sin(b.object.rotation.y)
    const along = Math.abs(fx * gx + fz * gz)
    const across = Math.sqrt(Math.max(0, 1 - along * along))
    const side = Math.abs(dx * fz - dz * fx)
    const bLength = b.halfLength * along + HALF_WIDTH * across // b's reach toward a
    const bWidth = b.halfLength * across + HALF_WIDTH * along // b's reach across a's path
    return ahead < a.halfLength + bLength + MARGIN + look && side < HALF_WIDTH + bWidth
  }
}
