import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { GRID_SIZE } from './grid'
import { seededRandom } from './neighborData'

// Scenery beyond the edge of the world: a wide stretch of countryside, and a
// range of snow-capped mountains along the back (north and west), which is
// the far side from the camera. Built once; never changes.

const HALF = GRID_SIZE / 2

export function addMountains(scene: THREE.Scene) {
  // Land all around, under the world (the sea covers it to the south).
  const land = new THREE.Mesh(new THREE.PlaneGeometry(260, 260).rotateX(-Math.PI / 2).translate(0, -0.02, 0), new THREE.MeshStandardMaterial({ color: '#a2d488' }))
  land.receiveShadow = true
  scene.add(land)

  const rand = seededRandom(7)
  const rock: THREE.BufferGeometry[] = []
  const snow: THREE.BufferGeometry[] = []
  const green: THREE.BufferGeometry[] = []
  const peak = (x: number, z: number) => {
    const height = 7 + rand() * 6
    const radius = height * (0.55 + rand() * 0.2)
    const turn = rand() * Math.PI
    rock.push(new THREE.ConeGeometry(radius, height, 6).rotateY(turn).translate(x, height / 2 - 0.5, z))
    // The snowcap: the top part of the same cone, a touch larger so it sits on top.
    const cap = 0.45 + rand() * 0.12
    snow.push(new THREE.ConeGeometry(radius * cap * 1.04, height * cap, 6).rotateY(turn).translate(x, height - (height * cap) / 2 - 0.45, z))
    // Wooded foothills in front.
    const hill = 2 + rand() * 2
    green.push(new THREE.ConeGeometry(hill * 1.6, hill, 7).translate(x + (rand() - 0.5) * 6, hill / 2 - 0.3, z + 4 + rand() * 2))
  }
  // Close behind the edge of the world, so they rise just past the far lots.
  for (let x = -HALF - 10; x < HALF + 30; x += 6 + rand() * 4) peak(x, -HALF - 8 - rand() * 6)
  for (let z = -HALF; z < HALF - 4; z += 6 + rand() * 4) peak(-HALF - 8 - rand() * 6, z)

  for (const [parts, color] of [
    [rock, '#7e8c84'],
    [snow, '#f7fbff'],
    [green, '#5f9c55'],
  ] as const) {
    const mesh = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({ color, flatShading: true }))
    mesh.receiveShadow = true
    for (const g of parts) g.dispose()
    scene.add(mesh)
  }
}
