import * as THREE from 'three'
import { GRID_SIZE } from './grid'

// Where the camera sits relative to the ground point it looks at.
// Equal X, Y and Z = looking down diagonally from a corner = isometric.
const OFFSET = new THREE.Vector3(20, 20, 20)

const MIN_ZOOM = 0.6
const MAX_ZOOM = 3
// How far (in pixels) the pointer must move before a press counts as a drag.
// Below this it's a click, so tiny hand jitters don't swallow clicks.
const DRAG_THRESHOLD = 5

export class CameraController {
  // The ground point at the center of the screen. Panning moves this.
  readonly target = new THREE.Vector3()

  // Called when the user clicks (presses and releases without dragging).
  onClick?: (clientX: number, clientY: number) => void

  private camera: THREE.OrthographicCamera
  private canvas: HTMLCanvasElement
  private raycaster = new THREE.Raycaster()
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0) // the y = 0 plane
  private pointerDown: { x: number; y: number } | null = null
  private grabPoint: THREE.Vector3 | null = null
  private dragging = false

  constructor(camera: THREE.OrthographicCamera, canvas: HTMLCanvasElement) {
    this.camera = camera
    this.canvas = canvas

    canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e))
    canvas.addEventListener('pointermove', (e) => this.onPointerMove(e))
    canvas.addEventListener('pointerup', (e) => this.onPointerUp(e))
    // passive: false lets us call preventDefault so the page itself doesn't scroll
    canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false })

    this.apply()
  }

  // Which point on the ground is under this screen position?
  // We shoot a ray from the camera through the pixel and see where it hits y = 0.
  groundPointAt(clientX: number, clientY: number): THREE.Vector3 | null {
    const rect = this.canvas.getBoundingClientRect()
    // Raycaster wants "normalized device coordinates": -1..1 across the screen,
    // with +Y pointing up (screen pixels have +Y pointing down, hence the minus).
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(ndc, this.camera)
    return this.raycaster.ray.intersectPlane(this.groundPlane, new THREE.Vector3())
  }

  private onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return // left mouse button, or a finger
    this.canvas.setPointerCapture(e.pointerId) // keep getting events if the pointer leaves the canvas
    this.pointerDown = { x: e.clientX, y: e.clientY }
    this.grabPoint = this.groundPointAt(e.clientX, e.clientY)
    this.dragging = false
  }

  private onPointerMove(e: PointerEvent) {
    if (!this.pointerDown || !this.grabPoint) return

    const moved = Math.hypot(e.clientX - this.pointerDown.x, e.clientY - this.pointerDown.y)
    if (!this.dragging && moved < DRAG_THRESHOLD) return
    this.dragging = true
    this.canvas.style.cursor = 'grabbing'

    // "Grab the ground": whatever ground point was under the pointer at the start
    // of the drag should stay under the pointer. Find where the pointer is now and
    // shift the camera by the difference.
    const now = this.groundPointAt(e.clientX, e.clientY)
    if (!now) return
    this.target.add(this.grabPoint.clone().sub(now))
    this.apply()
  }

  private onPointerUp(e: PointerEvent) {
    if (!this.pointerDown) return
    if (!this.dragging) this.onClick?.(e.clientX, e.clientY)
    this.pointerDown = null
    this.grabPoint = null
    this.dragging = false
    this.canvas.style.cursor = ''
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault()

    // Zoom toward the cursor: remember the ground point under it, zoom,
    // then pan so that same point is back under the cursor.
    const before = this.groundPointAt(e.clientX, e.clientY)

    // Multiplying (instead of adding) makes each scroll step feel the same
    // whether you're zoomed in or out.
    const zoom = this.camera.zoom * Math.exp(-e.deltaY * 0.001)
    this.camera.zoom = THREE.MathUtils.clamp(zoom, MIN_ZOOM, MAX_ZOOM)
    this.camera.updateProjectionMatrix()

    const after = this.groundPointAt(e.clientX, e.clientY)
    if (before && after) this.target.add(before.sub(after))
    this.apply()
  }

  // Keep the view over the map, then move the camera to match the target.
  private apply() {
    const half = GRID_SIZE / 2
    this.target.x = THREE.MathUtils.clamp(this.target.x, -half, half)
    this.target.z = THREE.MathUtils.clamp(this.target.z, -half, half)

    this.camera.position.copy(this.target).add(OFFSET)
    this.camera.lookAt(this.target)
    // three.js normally refreshes this during render. We raycast between
    // renders, so refresh it now or the next ray uses the old camera position.
    this.camera.updateMatrixWorld()
  }
}
