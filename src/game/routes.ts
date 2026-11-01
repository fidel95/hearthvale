import { inBounds, type Tile } from './grid'

// Route-finding for things that move along roads and track (TrafficView):
// cars wander, buses go from stop to stop, trains run round loops or from end
// to end of the line, soldiers march out and back. Pure functions on tiles, so they can be
// tested without drawing anything.

export type IsTrack = (tile: Tile) => boolean

const STEPS = [
  { x: 0, z: -1 },
  { x: 1, z: 0 },
  { x: 0, z: 1 },
  { x: -1, z: 0 },
]

const same = (a: Tile, b: Tile) => a.x === b.x && a.z === b.z

export function trackNeighbors(tile: Tile, isTrack: IsTrack): Tile[] {
  return STEPS.map((s) => ({ x: tile.x + s.x, z: tile.z + s.z })).filter((t) => inBounds(t) && isTrack(t))
}

// Where a car goes next: on along the road, picking at random at junctions,
// and only turning back at a dead end.
export function nextTile(from: Tile | null, at: Tile, isTrack: IsTrack, random: () => number = Math.random): Tile | null {
  const options = trackNeighbors(at, isTrack)
  const onward = from ? options.filter((t) => !same(t, from)) : options
  const choices = onward.length > 0 ? onward : options
  return choices.length > 0 ? choices[Math.floor(random() * choices.length)] : null
}

// Every tile connected to start, with the shortest way there (breadth-first).
export function reachable(start: Tile, isTrack: IsTrack, limit = 2000): Map<string, Tile[]> {
  const key = (t: Tile) => `${t.x},${t.z}`
  const paths = new Map<string, Tile[]>([[key(start), [start]]])
  const queue = [start]
  while (queue.length > 0 && paths.size < limit) {
    const at = queue.shift()!
    for (const next of trackNeighbors(at, isTrack)) {
      if (paths.has(key(next))) continue
      paths.set(key(next), [...paths.get(key(at))!, next])
      queue.push(next)
    }
  }
  return paths
}

// The way to the far end of the line: the connected tile furthest from start.
export function pathToFarthest(start: Tile, isTrack: IsTrack): Tile[] {
  let best = [start]
  for (const path of reachable(start, isTrack).values()) if (path.length > best.length) best = path
  return best
}

// The shortest way from a to b, not passing through any tile in avoid.
function pathAvoiding(a: Tile, b: Tile, isTrack: IsTrack, avoid: Set<string>): Tile[] | null {
  const key = (t: Tile) => `${t.x},${t.z}`
  const paths = new Map<string, Tile[]>([[key(a), [a]]])
  const queue = [a]
  while (queue.length > 0) {
    const at = queue.shift()!
    if (same(at, b)) return paths.get(key(at))!
    for (const next of trackNeighbors(at, isTrack)) {
      if (paths.has(key(next)) || avoid.has(key(next))) continue
      paths.set(key(next), [...paths.get(key(at))!, next])
      queue.push(next)
    }
  }
  return null
}

// A loop of track through tile at: out by one neighbor and back in by
// another (the biggest such loop), as the tiles from at round to the last
// before it. Null if no loop runs through it.
function loopThrough(at: Tile, isTrack: IsTrack, avoid: Set<string>): Tile[] | null {
  const key = (t: Tile) => `${t.x},${t.z}`
  const ways = trackNeighbors(at, isTrack).filter((t) => !avoid.has(key(t)))
  let best: Tile[] | null = null
  for (let i = 0; i < ways.length; i++) {
    for (let j = i + 1; j < ways.length; j++) {
      const round = pathAvoiding(ways[i], ways[j], isTrack, new Set([...avoid, key(at)]))
      if (round && round.length >= 3 && (!best || round.length + 1 > best.length)) best = [at, ...round]
    }
  }
  return best
}

// A train's run from its station (start), over as much of the line as it
// can. tiles is the run, and station the index in it where the station is.
// - The station on a loop: round and round it (loop; tiles end back at the station).
// - A branch out to a loop: out along the branch, round the loop and back
//   (then the same the other way round).
// - A plain line: from one end to the other, through the station, and back.
export interface TrainRoute {
  tiles: Tile[]
  loop: boolean
  station: number
}

export function trainRoute(start: Tile, isTrack: IsTrack): TrainRoute {
  const key = (t: Tile) => `${t.x},${t.z}`
  const circle = loopThrough(start, isTrack, new Set())
  if (circle) return { tiles: [...circle, start], loop: true, station: 0 }
  // Along the branch from the station to the first junction, if there's a loop there.
  const branch = [start]
  let prev: Tile | null = null
  let at = start
  for (;;) {
    const onward = trackNeighbors(at, isTrack).filter((t) => !prev || !same(t, prev))
    if (onward.length !== 1 || branch.length > 2000) break
    prev = at
    at = onward[0]
    branch.push(at)
  }
  const ring = branch.length > 1 ? loopThrough(at, isTrack, new Set(branch.slice(0, -1).map(key))) : null
  if (ring) return { tiles: [...branch, ...ring.slice(1), ...[...branch].reverse()], loop: false, station: 0 }
  // A line: end to end, through the station if it's on the way.
  const end = pathToFarthest(start, isTrack).at(-1)!
  const across = pathToFarthest(end, isTrack)
  const station = across.findIndex((t) => same(t, start))
  return station >= 0 ? { tiles: across, loop: false, station } : { tiles: pathToFarthest(start, isTrack), loop: false, station: 0 }
}

// ---- Moving along a path

export interface Pose {
  x: number
  z: number
  angle: number // heading, as a rotation about the vertical axis (0 = facing +x)
}

// A path through tile centers (world coordinates), and where something is
// after travelling a distance along it. offset shifts it sideways, to the
// right of its heading (vehicles keep to the right-hand lane).
export class Polyline {
  readonly length: number
  private points: { x: number; z: number }[]
  private cumulative: number[] = [0]

  constructor(points: { x: number; z: number }[]) {
    this.points = points
    for (let i = 1; i < points.length; i++) {
      this.cumulative.push(this.cumulative[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z))
    }
    this.length = this.cumulative[this.cumulative.length - 1]
  }

  at(distance: number, offset = 0): Pose {
    const p = this.points
    if (p.length === 1) return { x: p[0].x, z: p[0].z, angle: 0 }
    const d = Math.max(0, Math.min(this.length, distance))
    let i = 1
    while (i < p.length - 1 && this.cumulative[i] < d) i++
    const a = p[i - 1]
    const b = p[i]
    const segment = this.cumulative[i] - this.cumulative[i - 1] || 1
    const t = (d - this.cumulative[i - 1]) / segment
    const dx = (b.x - a.x) / segment
    const dz = (b.z - a.z) / segment
    // To the right of heading (dx, dz), seen from above, is (−dz, dx).
    return { x: a.x + (b.x - a.x) * t - dz * offset, z: a.z + (b.z - a.z) * t + dx * offset, angle: Math.atan2(-dz, dx) }
  }
}
