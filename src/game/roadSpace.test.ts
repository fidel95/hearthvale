import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { PRIORITY, RoadSpace } from './roadSpace'

// A vehicle at (x, z) heading along +x (0), +z (−π/2), −x (π) or −z (π/2).
function vehicle(space: RoadSpace, x: number, z: number, heading: number, halfLength = 0.2, priority = PRIORITY.car) {
  const scene = new THREE.Scene()
  const object = new THREE.Object3D()
  object.position.set(x, 0, z)
  object.rotation.y = heading
  scene.add(object)
  space.add(object, halfLength, priority)
  return object
}

describe('Room on the roads', () => {
  it('a car waits close behind another going the same way, not far behind', () => {
    const space = new RoadSpace()
    const back = vehicle(space, 0, 0, 0)
    const front = vehicle(space, 0.45, 0, 0)
    expect(space.blocked(back)).toBe(true)
    expect(space.blocked(front)).toBe(false) // the one behind doesn't hold it up
    front.position.x = 1.2
    expect(space.blocked(back)).toBe(false)
  })

  it('oncoming traffic in the other lane is no obstacle', () => {
    const space = new RoadSpace()
    const a = vehicle(space, 0, 0.17, 0)
    vehicle(space, 0.4, -0.17, Math.PI)
    expect(space.blocked(a)).toBe(false)
  })

  it('a bus in front holds up a car by its whole length', () => {
    const space = new RoadSpace()
    const car = vehicle(space, 0, 0, 0)
    const bus = vehicle(space, 0.7, 0, 0, 0.42, PRIORITY.heavy)
    expect(space.blocked(car)).toBe(true) // a car this far behind another car would go on
    bus.position.x = 0.8
    expect(space.blocked(car)).toBe(false)
  })

  it('crossing in a junction, one goes first: the more important, else the one there first', () => {
    const space = new RoadSpace()
    const car = vehicle(space, 0, 0, 0)
    const other = vehicle(space, 0.25, -0.25, -Math.PI / 2) // heading +z, across the first one's path
    // Each is in the other's way; the earlier car goes, so there's no jam.
    expect(space.blocked(car)).toBe(false)
    expect(space.blocked(other)).toBe(true)
    const space2 = new RoadSpace()
    const car2 = vehicle(space2, 0, 0, 0)
    const ambulance = vehicle(space2, 0.3, -0.1, -Math.PI / 2, 0.28, PRIORITY.emergency)
    expect(space2.blocked(ambulance)).toBe(false)
    expect(space2.blocked(car2)).toBe(true)
  })

  it('knows when a spot is taken', () => {
    const space = new RoadSpace()
    vehicle(space, 5, 5, 0)
    expect(space.occupied(5.3, 5, 0.6)).toBe(true)
    expect(space.occupied(8, 5, 0.6)).toBe(false)
  })
})
