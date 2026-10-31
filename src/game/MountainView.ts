import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { GRID_SIZE } from './grid'
import { seededRandom } from './neighborData'
import { PEAKS } from './terrain'

// Mountains: a range of snow-capped peaks beyond the edge of the world along
// the back (north and west, the far side from the camera), and the Highlands'
// peaks inside it (terrain.ts), with a wide stretch of countryside under it
// all. Built once; never changes.

const HALF = GRID_SIZE / 2

// Returns a way to set how snowy the countryside is (0 to 1), for snow mode.
export function addMountains(scene: THREE.Scene): { setSnow: (amount: number) => void } {
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
  // The Highlands' peaks, inside the world (terrain.ts): each a main cone
  // over its rock tiles, a lower shoulder or two, and snow on the tall ones.
  for (const p of PEAKS) {
    const x = p.x - HALF
    const z = p.z - HALF
    const turn = rand() * Math.PI
    // Broad flanks, then a steeper summit on top of them (terrain.ts mountainHeight).
    const base = p.radius + 0.4
    const flank = p.height * 0.5
    const waist = base * 0.48
    rock.push(new THREE.CylinderGeometry(waist, base, flank, 7).rotateY(turn).translate(x, flank / 2 - 0.1, z))
    rock.push(new THREE.ConeGeometry(waist, p.height - flank, 7).rotateY(turn).translate(x, flank + (p.height - flank) / 2 - 0.1, z))
    if (p.height >= 8) {
      const cap = 0.55 // of the summit
      const h = (p.height - flank) * cap
      snow.push(new THREE.ConeGeometry(waist * cap * 1.06, h, 7).rotateY(turn).translate(x, p.height - h / 2 - 0.08, z))
    }
    // Lower shoulders, and grassy foothills round the foot.
    for (let i = 0; i < 2; i++) {
      const a = turn + i * 2.6 + rand()
      const h = p.height * (0.35 + rand() * 0.12)
      const r = p.radius * 0.5
      const d = p.radius - r * 0.7
      rock.push(new THREE.ConeGeometry(r, h, 6).rotateY(a).translate(x + Math.cos(a) * d, h / 2 - 0.1, z + Math.sin(a) * d))
    }
    for (let i = 0; i < 3; i++) {
      const a = turn + i * 2.1 + rand() * 0.8
      const h = 0.9 + rand() * 0.6
      const r = 1.3 + rand() * 0.5
      const d = p.radius - 0.6
      green.push(new THREE.ConeGeometry(r, h, 7).translate(x + Math.cos(a) * d, h / 2 - 0.15, z + Math.sin(a) * d))
    }
  }

  // Close behind the edge of the world, so they rise just past the far lots.
  for (let x = -HALF - 10; x < HALF + 30; x += 6 + rand() * 4) peak(x, -HALF - 8 - rand() * 6)
  for (let z = -HALF; z < HALF - 4; z += 6 + rand() * 4) peak(-HALF - 8 - rand() * 6, z)

  const materials: THREE.MeshStandardMaterial[] = []
  for (const [parts, color] of [
    [rock, '#7e8c84'],
    [snow, '#f7fbff'],
    [green, '#5f9c55'],
  ] as const) {
    const material = new THREE.MeshStandardMaterial({ color, flatShading: true })
    materials.push(material)
    const mesh = new THREE.Mesh(mergeGeometries(parts), material)
    mesh.receiveShadow = true
    mesh.castShadow = true
    for (const g of parts) g.dispose()
    scene.add(mesh)
  }
  const white = new THREE.Color('#f4f8fb')
  return {
    setSnow(amount: number) {
      ;(land.material as THREE.MeshStandardMaterial).color.set('#a2d488').lerp(white, amount * 0.9)
      materials[2].color.set('#5f9c55').lerp(white, amount * 0.75)
      materials[0].color.set('#7e8c84').lerp(white, amount * 0.35)
    },
  }
}
