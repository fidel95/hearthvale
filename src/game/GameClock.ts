// The in-game calendar. It only runs while you're playing: closing the game
// pauses it (otherwise coming back after a week would mean 800 years of tax
// bills). Income timers use the real clock instead, so rent is waiting for you
// when you return. See docs/ARCHITECTURE.md, "Two kinds of time".

export const MONTH_MS = 60_000 // one in-game month = one minute of play
export const YEAR_MS = 12 * MONTH_MS

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// If the browser stalls (a slow frame, the laptop waking from sleep), don't
// let one giant frame skip months ahead.
const MAX_STEP_MS = 250

export class GameClock {
  playedMs = 0
  // Multiplies how fast the calendar runs. Only changeable in development,
  // via ?speed=60 in the URL, to test a whole year in 12 seconds.
  speed: number

  constructor(speed = 1) {
    this.speed = speed
  }

  // Months since the game started (0 = January of year 1).
  get monthIndex(): number {
    return Math.floor(this.playedMs / MONTH_MS)
  }

  get year(): number {
    return Math.floor(this.monthIndex / 12) + 1
  }

  get month(): number {
    return this.monthIndex % 12
  }

  // 0..1, how far through the current month we are.
  get monthProgress(): number {
    return (this.playedMs % MONTH_MS) / MONTH_MS
  }

  // Move time forward by `realMs` of real time. Returns the month indexes that
  // just finished, oldest first (usually none, sometimes one).
  advance(realMs: number): number[] {
    const before = this.monthIndex
    this.playedMs += Math.min(realMs, MAX_STEP_MS) * this.speed
    const ended: number[] = []
    for (let m = before; m < this.monthIndex; m++) ended.push(m)
    return ended
  }
}
