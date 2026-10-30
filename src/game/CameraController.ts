import * as THREE from 'three'
import { GRID_SIZE } from './grid'

// Where the camera sits relative to the ground point it looks at.
// Equal X, Y and Z = looking down diagonally from a corner = isometric.
const OFFSET = new THREE.Vector3(20, 20, 20)

const MIN_ZOOM = 0.4 // far enough out to see the whole 60×60 world
const MAX_ZOOM = 3
// How far (in pixels) the pointer must move before a press counts as a drag.
// Below this it's a click, so tiny hand jitters don't swallow clicks.
const DRAG_THRESHOLD = 5
// How long a press must stay still to pick something up.
const LONG_PRESS_MS = 400
// Carrying something near the screen's edge scrolls the map that way.
const EDGE_PX = 48
const EDGE_SPEED = 14 // world units per second at zoom 1

type ScreenPoint = { x: number; y: number }

// Something being carried by a drag (a building being moved), instead of panning.
export interface Carry {
  move(clientX: number, clientY: number): void
  drop(clientX: number, clientY: number): void
  cancel(): void
}

// Pans and zooms the camera with mouse (drag + wheel) or touch (drag + pinch),
// and reports clicks/taps that weren't part of a drag.
export class CameraController {
  // The ground point at the center of the screen. Panning moves this.
  readonly target = new THREE.Vector3()

  // Called when the user clicks or taps (presses and releases without dragging).
  onClick?: (clientX: number, clientY: number) => void
  // Called when the view pans or zooms (the tutorial watches for it).
  onMove?: () => void
  // When set, a one-finger drag paints (e.g. roads) instead of panning:
  // called with each pointer position, first = true at the start of a drag.
  // Pinching still zooms.
  paint: ((clientX: number, clientY: number, first: boolean) => void) | null = null
  // Asked when a one-finger drag starts (held = false) or a press is held still
  // (held = true): return a Carry to move something instead of panning.
  grab?: (clientX: number, clientY: number, held: boolean) => Carry | null

  private camera: THREE.OrthographicCamera
  private canvas: HTMLCanvasElement
  private raycaster = new THREE.Raycaster()
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0) // the y = 0 plane

  // Every finger (or the mouse) currently pressed on the canvas.
  private pointers = new Map<number, ScreenPoint>()
  // The current press-move-release gesture, from first press to last release.
  private gesture: { start: ScreenPoint; moved: boolean; multiTouch: boolean } | null = null
  // The ground point that should stay under the pointer (or between two fingers).
  private grabPoint: THREE.Vector3 | null = null
  private pinchStart: { distance: number; zoom: number } | null = null
  private carry: Carry | null = null
  // Flick the map and it glides on, slowing to a stop (off with Reduce motion).
  inertia = true
  private velocity = new THREE.Vector3()
  private lastPan: { target: THREE.Vector3; time: number } | null = null
  private carryPoint: ScreenPoint | null = null
  private holdTimer: number | undefined

  constructor(camera: THREE.OrthographicCamera, canvas: HTMLCanvasElement) {
    this.camera = camera
    this.canvas = canvas

    canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e))
    canvas.addEventListener('pointermove', (e) => this.onPointerMove(e))
    canvas.addEventListener('pointerup', (e) => this.onPointerUp(e, true))
    // The browser cancels a touch when, say, a notification takes over the screen.
    canvas.addEventListener('pointercancel', (e) => this.onPointerUp(e, false))
    // passive: false lets us call preventDefault so the page itself doesn't scroll
    canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false })
    // Keyboard: arrows or WASD pan, + and − zoom (unless typing in a field).
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const step = 2 / this.camera.zoom
      // Screen directions on the isometric map: "up" is toward −x −z.
      const moves: Record<string, [number, number]> = {
        ArrowUp: [-step, -step], w: [-step, -step],
        ArrowDown: [step, step], s: [step, step],
        ArrowLeft: [-step, step], a: [-step, step],
        ArrowRight: [step, -step], d: [step, -step],
      }
      const move = moves[e.key]
      if (move) {
        this.target.x += move[0] * 0.7
        this.target.z += move[1] * 0.7
        this.apply()
        this.onMove?.()
        e.preventDefault()
      } else if (e.key === '+' || e.key === '=') this.setZoom(this.camera.zoom * 1.15)
      else if (e.key === '-' || e.key === '_') this.setZoom(this.camera.zoom / 1.15)
    })

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
    if (e.pointerType === 'mouse' && e.button !== 0) return // left button only; right-click is "cancel"
    this.canvas.setPointerCapture(e.pointerId) // keep getting events if the pointer leaves the canvas
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (this.pointers.size === 1) {
      this.velocity.set(0, 0, 0) // touching the map stops any glide
      const start = { x: e.clientX, y: e.clientY }
      this.gesture = { start, moved: false, multiTouch: false }
      this.grabPoint = this.groundPointAt(e.clientX, e.clientY)
      // Held still long enough: maybe pick up what's under the finger.
      this.holdTimer = window.setTimeout(() => {
        if (!this.gesture || this.gesture.moved || this.pointers.size !== 1 || this.paint) return
        this.startCarry(this.grab?.(start.x, start.y, true) ?? null, start)
        if (this.carry) navigator.vibrate?.(15)
      }, LONG_PRESS_MS)
    } else if (this.gesture) {
      // A second finger landed: this gesture is now a pinch, never a tap.
      window.clearTimeout(this.holdTimer)
      this.carry?.cancel()
      this.carry = null
      this.gesture.multiTouch = true
      this.startPinch()
    }
  }

  private onPointerMove(e: PointerEvent) {
    if (!this.pointers.has(e.pointerId) || !this.gesture) return
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (this.pinchStart) {
      const [a, b] = [...this.pointers.values()]
      const zoom = this.pinchStart.zoom * (distance(a, b) / this.pinchStart.distance)
      this.setZoom(zoom)
      const mid = midpoint(a, b)
      this.keepGrabPointUnder(mid.x, mid.y)
      return
    }

    if (this.carry) {
      this.carryPoint = { x: e.clientX, y: e.clientY }
      this.carry.move(e.clientX, e.clientY)
      return
    }
    const moved = Math.hypot(e.clientX - this.gesture.start.x, e.clientY - this.gesture.start.y)
    if (!this.gesture.moved && moved < DRAG_THRESHOLD) return
    const starting = !this.gesture.moved
    this.gesture.moved = true
    window.clearTimeout(this.holdTimer)
    if (starting && !this.paint && !this.gesture.multiTouch) {
      // A drag that starts on something draggable carries it instead of panning.
      this.startCarry(this.grab?.(this.gesture.start.x, this.gesture.start.y, false) ?? null, { x: e.clientX, y: e.clientY })
      if (this.carry) return
    }
    if (this.paint && !this.gesture.multiTouch) {
      // Paint from where the drag began, so the first tile isn't skipped.
      if (starting) this.paint(this.gesture.start.x, this.gesture.start.y, true)
      this.paint(e.clientX, e.clientY, false)
      return
    }
    this.canvas.style.cursor = 'grabbing'
    this.keepGrabPointUnder(e.clientX, e.clientY)
  }

  private onPointerUp(e: PointerEvent, released: boolean) {
    if (!this.pointers.delete(e.pointerId)) return
    window.clearTimeout(this.holdTimer)
    if (this.carry && this.pointers.size === 0) {
      if (released) this.carry.drop(e.clientX, e.clientY)
      else this.carry.cancel()
      this.carry = null
      this.carryPoint = null
      this.gesture = null
      this.grabPoint = null
      this.canvas.style.cursor = ''
      return
    }

    if (this.pointers.size === 1) {
      // Lifted one finger of a pinch: carry on dragging with the other one.
      this.pinchStart = null
      const [rest] = [...this.pointers.values()]
      this.grabPoint = this.groundPointAt(rest.x, rest.y)
      if (this.gesture) this.gesture.moved = true
      return
    }
    if (this.pointers.size > 0) return

    const g = this.gesture
    if (released && g && !g.moved && !g.multiTouch) this.onClick?.(e.clientX, e.clientY)
    // A pan that was still moving when let go keeps gliding; one that had stopped doesn't.
    const stillMoving = this.lastPan && performance.now() - this.lastPan.time < 80
    if (!(released && g?.moved && !this.pinchStart && !this.paint && stillMoving && this.inertia)) this.velocity.set(0, 0, 0)
    this.lastPan = null
    this.gesture = null
    this.grabPoint = null
    this.pinchStart = null
    this.canvas.style.cursor = ''
  }

  private startCarry(carry: Carry | null, at: ScreenPoint) {
    if (!carry || !this.gesture) return
    this.carry = carry
    this.carryPoint = at
    this.gesture.moved = true // never a tap now
    this.canvas.style.cursor = 'grabbing'
    carry.move(at.x, at.y)
  }

  // Called every frame: while carrying something near the screen's edge,
  // scroll the map that way so it can go anywhere.
  update(dtSeconds: number) {
    if (!this.gesture && this.velocity.lengthSq() > 0.0004) {
      this.target.addScaledVector(this.velocity, dtSeconds)
      this.velocity.multiplyScalar(Math.exp(-dtSeconds * 4))
      this.apply()
    }
    if (!this.carry || !this.carryPoint) return
    const rect = this.canvas.getBoundingClientRect()
    const { x, y } = this.carryPoint
    const push = (distance: number) => Math.max(0, 1 - distance / EDGE_PX)
    const right = push(rect.right - x) - push(x - rect.left)
    const down = push(rect.bottom - y) - push(y - rect.top)
    if (right === 0 && down === 0) return
    // Screen right is world (+x, −z); screen down is (+x, +z) on this isometric view.
    const step = (EDGE_SPEED * dtSeconds) / this.camera.zoom / Math.SQRT2
    this.target.x += (right + down) * step
    this.target.z += (down - right) * step
    this.apply()
    this.carry.move(x, y)
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault()
    // Zoom toward the cursor: remember the ground point under it, zoom,
    // then pan so that same point is back under the cursor.
    this.grabPoint = this.groundPointAt(e.clientX, e.clientY)
    // Multiplying (instead of adding) makes each scroll step feel the same
    // whether you're zoomed in or out.
    this.setZoom(this.camera.zoom * Math.exp(-e.deltaY * 0.001))
    this.keepGrabPointUnder(e.clientX, e.clientY)
    if (!this.gesture) this.grabPoint = null
  }

  private startPinch() {
    const [a, b] = [...this.pointers.values()]
    this.pinchStart = { distance: Math.max(1, distance(a, b)), zoom: this.camera.zoom }
    const mid = midpoint(a, b)
    this.grabPoint = this.groundPointAt(mid.x, mid.y)
  }

  // "Grab the ground": whatever ground point was under the pointer when the
  // gesture began should stay under it. Find what's there now and shift the
  // camera by the difference. Zooming uses the same trick around the cursor.
  private keepGrabPointUnder(clientX: number, clientY: number) {
    if (!this.grabPoint) return
    const now = this.groundPointAt(clientX, clientY)
    if (!now) return
    this.target.add(this.grabPoint.clone().sub(now))
    // Remember how fast the map is moving, for the glide after letting go.
    const time = performance.now()
    if (this.lastPan && time > this.lastPan.time) {
      const v = this.target.clone().sub(this.lastPan.target).divideScalar((time - this.lastPan.time) / 1000)
      this.velocity.lerp(v, 0.5)
    }
    this.lastPan = { target: this.target.clone(), time }
    this.apply()
    this.onMove?.()
  }

  // Back to the default zoom, looking at a point (the recenter button).
  reset(point: THREE.Vector3) {
    this.camera.zoom = 1
    this.camera.updateProjectionMatrix()
    this.centerOn(point)
  }

  // Jump the view to look at a point on the ground.
  centerOn(point: THREE.Vector3) {
    this.target.set(point.x, 0, point.z)
    this.apply()
  }

  private setZoom(zoom: number) {
    this.camera.zoom = THREE.MathUtils.clamp(zoom, MIN_ZOOM, MAX_ZOOM)
    this.camera.updateProjectionMatrix()
    this.onMove?.()
  }

  // Keep the view over the world, then move the camera to match the target.
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

function distance(a: ScreenPoint, b: ScreenPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function midpoint(a: ScreenPoint, b: ScreenPoint): ScreenPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}
