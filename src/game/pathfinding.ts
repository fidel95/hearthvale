import type { Tile } from './grid'

// A* pathfinding on the tile grid: the shortest way from one tile to another,
// stepping up, down, left or right, through tiles where `passable` is true.
//
// A* explores tiles in order of (steps so far + a guess of steps left). The
// guess here is the Manhattan distance (|dx| + |dz|), which never
// overestimates on a 4-direction grid, so the first path found is a shortest one.

const key = (t: Tile) => `${t.x},${t.z}`

export function findPath(start: Tile, goal: Tile, passable: (tile: Tile) => boolean, maxVisited = 5000): Tile[] | null {
  if (!passable(goal)) return null
  const guess = (t: Tile) => Math.abs(t.x - goal.x) + Math.abs(t.z - goal.z)

  const open = new MinHeap<Tile>()
  const steps = new Map<string, number>([[key(start), 0]])
  const cameFrom = new Map<string, Tile>()
  open.push(start, guess(start))
  let visited = 0

  while (open.size > 0) {
    const current = open.pop()!
    if (current.x === goal.x && current.z === goal.z) return rebuild(cameFrom, current)
    if (++visited > maxVisited) return null // give up rather than freeze on a huge search

    const here = steps.get(key(current))!
    for (const next of [
      { x: current.x + 1, z: current.z },
      { x: current.x - 1, z: current.z },
      { x: current.x, z: current.z + 1 },
      { x: current.x, z: current.z - 1 },
    ]) {
      if (!passable(next)) continue
      const k = key(next)
      const known = steps.get(k)
      if (known !== undefined && known <= here + 1) continue
      steps.set(k, here + 1)
      cameFrom.set(k, current)
      open.push(next, here + 1 + guess(next))
    }
  }
  return null
}

// Walk the cameFrom links back from the goal to the start.
function rebuild(cameFrom: Map<string, Tile>, end: Tile): Tile[] {
  const path = [end]
  let at: Tile | undefined = end
  while ((at = cameFrom.get(key(at)))) path.push(at)
  return path.reverse()
}

// A binary heap: always hands back the item with the lowest priority, in
// O(log n) per push or pop. (Scanning a plain array for the minimum would be
// O(n) per pop, which adds up over thousands of tiles.)
class MinHeap<T> {
  private items: { item: T; priority: number }[] = []

  get size() {
    return this.items.length
  }

  push(item: T, priority: number) {
    const items = this.items
    items.push({ item, priority })
    let i = items.length - 1
    // Bubble up while smaller than the parent.
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (items[parent].priority <= items[i].priority) break
      ;[items[parent], items[i]] = [items[i], items[parent]]
      i = parent
    }
  }

  pop(): T | undefined {
    const items = this.items
    if (items.length === 0) return undefined
    const top = items[0].item
    const last = items.pop()!
    if (items.length > 0) {
      items[0] = last
      // Sink down while bigger than a child.
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let smallest = i
        if (l < items.length && items[l].priority < items[smallest].priority) smallest = l
        if (r < items.length && items[r].priority < items[smallest].priority) smallest = r
        if (smallest === i) break
        ;[items[smallest], items[i]] = [items[i], items[smallest]]
        i = smallest
      }
    }
    return top
  }
}
