import * as THREE from 'three'
import type { BuildingType } from '../game/buildings'
import { createBuildingObject } from '../game/models'

// Pictures of buildings for the build menu, drawn by three.js itself: one
// small offscreen renderer draws each building once, from the same isometric
// angle as the game, and keeps the image as a data URL. So the menu always
// matches the real models, and adding a building needs no new artwork.

const WIDTH = 160
const HEIGHT = 120

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene
const cache = new Map<string, Promise<string>>()

function setUp() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(WIDTH, HEIGHT)
  scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight('#ffffff', '#6b8e4e', 1.4))
  const sun = new THREE.DirectionalLight('#fff4e0', 2)
  sun.position.set(15, 25, 10)
  scene.add(sun)
}

export function thumbnail(type: BuildingType): Promise<string> {
  let url = cache.get(type.id)
  if (!url) {
    url = draw(type)
    cache.set(type.id, url)
  }
  return url
}

async function draw(type: BuildingType): Promise<string> {
  if (!renderer) setUp()
  const object = createBuildingObject(type)
  await object.userData.ready

  // Frame the object: an orthographic camera looking from the game's angle,
  // sized to the object's bounding sphere so big and small buildings both fill the picture.
  const sphere = new THREE.Box3().setFromObject(object).getBoundingSphere(new THREE.Sphere())
  const r = Math.max(sphere.radius, 0.5)
  const aspect = WIDTH / HEIGHT
  const camera = new THREE.OrthographicCamera(-r * aspect, r * aspect, r, -r, -100, 100)
  camera.position.copy(sphere.center).add(new THREE.Vector3(1, 1, 1))
  camera.lookAt(sphere.center)

  scene.add(object)
  renderer!.render(scene, camera)
  scene.remove(object)
  return renderer!.domElement.toDataURL('image/png')
}
