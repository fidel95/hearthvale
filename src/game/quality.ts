// Keeps the game smooth on slower phones by lowering the drawing quality when
// frames take too long. It watches the frame rate over a few seconds and
// steps down a level at a time: first fewer pixels on high-density screens,
// then softer shadows, then no shadows. It never steps back up during a
// session, so the picture doesn't keep changing.

export interface QualityLevel {
  name: string
  maxPixelRatio: number // drawing resolution, capped at the screen's own
  shadowMapSize: number // 0: no shadows
}

export const QUALITY_LEVELS: QualityLevel[] = [
  { name: 'high', maxPixelRatio: 2, shadowMapSize: 2048 },
  { name: 'medium', maxPixelRatio: 1.5, shadowMapSize: 2048 },
  { name: 'low', maxPixelRatio: 1, shadowMapSize: 1024 },
  { name: 'lowest', maxPixelRatio: 1, shadowMapSize: 0 },
]

const WINDOW_MS = 4000 // how long to watch before judging
const MIN_FPS = 40 // below this on average, step down
const IGNORE_FRAME_MS = 250 // longer gaps are pauses (a hidden tab, a dialog), not slowness

export class QualityGovernor {
  level = 0
  private elapsed = 0
  private frames = 0

  // Call once per frame with how long it took. Returns the new level when it
  // should change, otherwise null.
  frame(dtMs: number): QualityLevel | null {
    if (dtMs > IGNORE_FRAME_MS || this.level === QUALITY_LEVELS.length - 1) return null
    this.elapsed += dtMs
    this.frames++
    if (this.elapsed < WINDOW_MS) return null
    const fps = (this.frames * 1000) / this.elapsed
    this.elapsed = 0
    this.frames = 0
    if (fps >= MIN_FPS) return null
    this.level++
    return QUALITY_LEVELS[this.level]
  }
}
