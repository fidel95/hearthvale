import * as THREE from 'three'
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
import { Hud } from '../ui/Hud'
import { Builder } from './Builder'
import { BUILDINGS_BY_ID } from './buildings'
import { CameraController } from './CameraController'
import { City } from './City'
import { CityView } from './CityView'
import { GRID_SIZE } from './grid'
import { IncomeView } from './IncomeView'

// How many world units of the map fit vertically on screen at zoom 1.
const VIEW_SIZE = 24

export class Game {
  private renderer: THREE.WebGLRenderer
  // Draws HTML labels (bubbles, pop-ups) at 3D positions, on top of the canvas.
  private labelRenderer = new CSS2DRenderer()
  private incomeView: IncomeView
  private scene = new THREE.Scene()
  private camera: THREE.OrthographicCamera
  private controls: CameraController
  private container: HTMLElement
  private city = new City()

  constructor(container: HTMLElement) {
    this.container = container

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    container.appendChild(this.renderer.domElement)
    this.labelRenderer.domElement.className = 'labels'
    container.appendChild(this.labelRenderer.domElement)

    this.scene.background = new THREE.Color('#9fd4f0')

    // An orthographic camera has no perspective: far things are not smaller.
    // CameraController places it looking down at an angle from a corner,
    // which gives the classic isometric look.
    this.camera = new THREE.OrthographicCamera()
    this.controls = new CameraController(this.camera, this.renderer.domElement)

    this.addLights()
    this.addGround()

    // CityView must exist before anything is placed, or it misses the 'added' events.
    const cityView = new CityView(this.scene, this.city)
    const builder = new Builder(this.scene, this.city, cityView, this.controls, this.renderer.domElement)
    this.incomeView = new IncomeView(this.scene, this.city, cityView)
    builder.onHoverBuilding = (b) => this.incomeView.setHovered(b)
    new Hud(container, builder, this.city)
    this.seedCity()

    window.addEventListener('resize', () => this.resize())
    this.resize()
  }

  start() {
    this.renderer.setAnimationLoop(() => this.tick())
  }

  // Runs once per frame.
  private tick() {
    this.incomeView.update(Date.now())
    this.renderer.render(this.scene, this.camera)
    this.labelRenderer.render(this.scene, this.camera)
  }

  private resize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    const aspect = w / h
    this.camera.left = (-VIEW_SIZE * aspect) / 2
    this.camera.right = (VIEW_SIZE * aspect) / 2
    this.camera.top = VIEW_SIZE / 2
    this.camera.bottom = -VIEW_SIZE / 2
    this.camera.near = -100
    this.camera.far = 200
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
    this.labelRenderer.setSize(w, h)
  }

  // A small starting town so the map isn't empty. Stage 6 replaces this with save data.
  private seedCity() {
    const start: [string, number, number][] = [
      ['cottage', 9, 9],
      ['wheat-field', 12, 9],
      ['oak-tree', 8, 12],
      ['oak-tree', 11, 12],
      ['oak-tree', 7, 8],
    ]
    for (const [id, x, z] of start) this.city.place(BUILDINGS_BY_ID.get(id)!, { x, z }, { free: true })
  }

  private addLights() {
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#6b8e4e', 1.2))

    const sun = new THREE.DirectionalLight('#fff4e0', 2)
    sun.position.set(15, 25, 10)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    const s = GRID_SIZE / 2 + 2
    Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s })
    this.scene.add(sun)
  }

  private addGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE),
      new THREE.MeshStandardMaterial({ color: '#7cc46a' }),
    )
    ground.rotation.x = -Math.PI / 2 // planes start vertical; lay it flat
    ground.receiveShadow = true
    this.scene.add(ground)

    const grid = new THREE.GridHelper(GRID_SIZE, GRID_SIZE, '#5a9a4c', '#5a9a4c')
    grid.position.y = 0.01 // just above the grass so it doesn't flicker
    this.scene.add(grid)
  }
}
