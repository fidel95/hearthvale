import type * as THREE from 'three'
import type { City } from './City'
import { worldToTile, tileToWorld, type Tile } from './grid'

// Road bridges over the railway. Draw a road across the track (or track
// across a road) and that tile becomes a Road Bridge: one tile that is both
// road and railway. The road rises over it on a deck BRIDGE_HEIGHT up, from
// ramps on the road either side (over two tiles where there's room), and
// trains run underneath.
//
// roadLift says how far the road is raised at any spot, so everything on
// the road (RoadView drawing it, cars, buses and people on it) goes up and
// over together.

export const OVERPASS = 'overpass'
export const BRIDGE_HEIGHT = 0.68 // room for a train (the tallest is about 0.57) under the deck

export function isOverpass(city: City, tile: Tile): boolean {
  return city.buildingAt(tile)?.type.id === OVERPASS
}

// Which way the road runs over a bridge: along x if there's road to either
// side along x (else along z, as it's the track that runs along x).
export function bridgeAlongX(city: City, tile: Tile): boolean {
  const road = (dx: number, dz: number) => {
    const t = { x: tile.x + dx, z: tile.z + dz }
    return city.isRoad(t) && !city.isRail(t)
  }
  if (road(1, 0) || road(-1, 0)) return true
  if (road(0, 1) || road(0, -1)) return false
  return !(city.isRail({ x: tile.x + 1, z: tile.z }) || city.isRail({ x: tile.x - 1, z: tile.z }))
}

const STEPS = [
  { dx: 1, dz: 0 },
  { dx: -1, dz: 0 },
  { dx: 0, dz: 1 },
  { dx: 0, dz: -1 },
]

// How long the ramp up to a bridge is on one side (out: the step away from
// it): two tiles where there's straight road for it, else one.
function rampLength(city: City, bridge: Tile, out: { dx: number; dz: number }): number {
  const plain = (k: number) => {
    const t = { x: bridge.x + out.dx * k, z: bridge.z + out.dz * k }
    return city.isRoad(t) && !isOverpass(city, t)
  }
  return plain(1) && plain(2) ? 2 : 1
}

// How far the road is raised on this tile at (x, z): the full height on a
// bridge, and on the road leading up to one (in line with its road) a ramp,
// rising evenly over one or two tiles. A road tile between two bridges stays up.
export function liftOnTile(city: City, tile: Tile, x: number, z: number): number {
  if (!city.isRoad(tile)) return 0
  if (isOverpass(city, tile)) return BRIDGE_HEIGHT
  const c = tileToWorld(tile)
  let lift = 0
  let besideBridges = 0
  for (const d of STEPS) {
    const toward = (x - c.x) * d.dx + (z - c.z) * d.dz // −0.5 at the side away, 0.5 at the side toward d
    for (const k of [1, 2]) {
      const bridge = { x: tile.x + d.dx * k, z: tile.z + d.dz * k }
      if (!isOverpass(city, bridge) || bridgeAlongX(city, bridge) !== (d.dx !== 0)) continue
      if (k === 2 && (isOverpass(city, { x: tile.x + d.dx, z: tile.z + d.dz }) || !city.isRoad({ x: tile.x + d.dx, z: tile.z + d.dz }))) continue
      const length = rampLength(city, bridge, { dx: -d.dx, dz: -d.dz })
      if (k > length) continue
      if (k === 1) besideBridges++
      const away = k - 0.5 - toward // how far this spot is from the bridge's edge, in tiles
      lift = Math.max(lift, BRIDGE_HEIGHT * Math.min(1, Math.max(0, 1 - away / length)))
    }
  }
  return besideBridges > 1 ? BRIDGE_HEIGHT : lift
}

// How far the road is raised at a world spot.
export function roadLift(city: City, x: number, z: number): number {
  const tile = worldToTile({ x, z } as THREE.Vector3)
  return tile ? liftOnTile(city, tile, x, z) : 0
}

// Raise a vehicle onto the road, tipped nose up or down on a ramp. Vehicles
// face +x when not turned (rotation.y is their heading).
export function liftVehicle(city: City, object: THREE.Object3D) {
  const p = object.position
  const h = object.rotation.y
  const fx = Math.cos(h) * 0.15
  const fz = -Math.sin(h) * 0.15
  p.y = roadLift(city, p.x, p.z)
  const slope = (roadLift(city, p.x + fx, p.z + fz) - roadLift(city, p.x - fx, p.z - fz)) / 0.3
  object.rotation.order = 'YZX'
  object.rotation.z = Math.atan(slope)
}
