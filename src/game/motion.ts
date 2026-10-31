// Easing for things moving about town, so they round corners and turn
// smoothly instead of snapping from one heading (or lane) to the next.

// How much of the gap to close this frame to close most of it in about
// 1/rate seconds, at any frame rate.
export function easeShare(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt)
}

// From one heading toward another (radians), the short way round.
export function turnToward(current: number, target: number, rate: number, dt: number): number {
  const gap = Math.atan2(Math.sin(target - current), Math.cos(target - current))
  return current + gap * easeShare(rate, dt)
}
