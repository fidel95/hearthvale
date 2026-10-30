import { describe, it } from 'vitest'
import { BUILDING_TYPES, footprint, isPlot, isTrack, type Rotation } from '../game/buildings'
import type { PlacedBuilding } from '../game/City'
import { CROP_TYPES } from '../game/crops'
import { GameState } from '../game/GameState'
import { footprintTiles, GRID_SIZE, lotNeighbors, lotOf } from '../game/grid'
import { MATERIAL_IDS } from '../game/items'
import { seededRandom } from '../game/neighborData'
import { buyLand, finishConstruction, upgradeBuilding } from '../game/projects'
import { SaveSystem } from '../game/SaveSystem'
import { SHIPMENT_OPTIONS } from '../game/Docks'
import { NEIGHBORS } from '../game/neighborData'

declare const process: { env: Record<string, string | undefined> }

// The audit's simulation: thousands of random actions, the way a curious
// player might try anything in any order, on a real game. After every step
// it checks the things that must always be true. A failure prints the seed
// and step, so it can be replayed exactly.

const STEPS = 3000
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1)

function check(state: GameState, where: string) {
  const { city, player } = state
  const fail = (what: string) => {
    throw new Error(`${where}: ${what}`)
  }
  if (!(city.coins >= 0) || !Number.isFinite(city.coins)) fail(`coins ${city.coins}`)
  if (!(city.debt >= 0) || !Number.isFinite(city.debt)) fail(`debt ${city.debt}`)
  if (!(city.goods >= 0) || !Number.isFinite(city.goods)) fail(`goods ${city.goods}`)
  for (const [id, n] of Object.entries(city.products)) if (!(n >= 0) || !Number.isInteger(n)) fail(`${id} ${n}`)
  if (!Number.isFinite(player.xp) || player.xp < 0) fail(`xp ${player.xp}`)
  for (const id of MATERIAL_IDS) if (!(state.inventory.count(id) >= 0)) fail(`${id} ${state.inventory.count(id)}`)
  // The map: every tile of every building says it's that building, and no
  // two buildings share a tile.
  const claimed = new Map<string, number>()
  for (const b of city.all()) {
    if (!Number.isFinite(b.readyAt)) fail(`${b.type.id} readyAt ${b.readyAt}`)
    if (b.stock < 0) fail(`${b.type.id} stock ${b.stock}`)
    for (const t of footprintTiles(b.tile, footprint(b.type, b.rotation))) {
      const key = `${t.x},${t.z}`
      if (claimed.has(key)) fail(`tile ${key} claimed by two buildings`)
      claimed.set(key, b.id)
      if (city.buildingAt(t) !== b) fail(`tile ${key} doesn't point at its ${b.type.id}`)
      if (!city.ownsTile(t)) fail(`${b.type.id} on land the town doesn't own`)
    }
  }
  const ledger = state.taxes.toSave().ledger as unknown as Record<string, unknown>
  for (const [k, v] of Object.entries(ledger)) if (typeof v === 'number' && !Number.isFinite(v)) fail(`ledger.${k} ${v}`)
}

// Where two plain-JSON values differ, as "path: before → after".
function differences(a: unknown, b: unknown, path = ''): string[] {
  if (JSON.stringify(a) === JSON.stringify(b)) return []
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return [`${path}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`]
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  return [...keys].flatMap((k) => differences((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`))
}

function roundTrip(state: GameState, where: string): GameState {
  const saved = JSON.parse(JSON.stringify(new SaveSystem(state).toSave()))
  const loaded = new GameState()
  new SaveSystem(loaded).load(saved)
  const again = JSON.parse(JSON.stringify(new SaveSystem(loaded).toSave()))
  const changed = differences(saved, again)
  if (changed.length) throw new Error(`${where}: save → load → save changed: ${changed.slice(0, 6).join('; ')}`)
  return loaded
}

describe('Simulation: random play keeps the game consistent', () => {
  for (const seed of SEEDS) {
    it(`seed ${seed}`, () => {
      const random = seededRandom(seed)
      const pick = <T,>(list: T[]): T | undefined => (list.length ? list[Math.floor(random() * list.length)] : undefined)
      let state = new GameState()
      state.seedNewTown(0)
      let now = 1_000_000
      let month = 0
      const all = () => [...state.city.all()]
      // Mostly on (or near) the town's own land, where things can actually go.
      const randomTile = () => {
        const lot = pick([...state.city.ownedLots()].map((l) => l.lot))!
        return random() < 0.85 ? { x: lot.x * 10 + Math.floor(random() * 10), z: lot.z * 10 + Math.floor(random() * 10) } : { x: Math.floor(random() * GRID_SIZE), z: Math.floor(random() * GRID_SIZE) }
      }

      for (let step = 0; step < STEPS; step++) {
        const where = `seed ${seed}, step ${step}`
        now += Math.floor(random() * 40_000)
        const roll = random()
        const b: PlacedBuilding | undefined = pick(all())
        try {
          if (roll < 0.18) {
            // Build something affordable and unlocked somewhere it fits.
            const type = pick(BUILDING_TYPES.filter((t) => state.unlocks.isUnlocked(t)))!
            const spot = { tile: randomTile(), rotation: Math.floor(random() * 4) as Rotation }
            if (state.placement.check(type, spot).ok) state.city.place(type, spot.tile, { now, rotation: spot.rotation })
          } else if (roll < 0.36 && b) {
            if (isPlot(b.type)) {
              state.city.production.plant(b.id, pick(CROP_TYPES.filter((c) => state.unlocks.isUnlocked(c)))!, { now })
              state.city.production.harvest(b.id, now)
              state.city.production.clearPlot(b.id, now)
            } else {
              state.city.production.restock(b.id)
              state.city.production.collect(b.id, now)
              state.city.production.runFactories(now)
              state.city.production.collectBatch(b.id, now)
            }
          } else if (roll < 0.42 && b) {
            finishConstruction(state.city, state.inventory, b, now)
            upgradeBuilding(state.city, state.inventory, state.player, b, (n) => state.services.roomFor(n))
          } else if (roll < 0.47 && b) {
            state.city.move(b.id, randomTile(), Math.floor(random() * 4) as Rotation)
          } else if (roll < 0.5 && b && !isTrack(b.type)) {
            state.city.store(b.id)
          } else if (roll < 0.53) {
            const stored = pick([...state.city.storedBuildings()])
            if (stored) state.city.restore(stored.id, randomTile(), now, Math.floor(random() * 4) as Rotation)
          } else if (roll < 0.56 && b) {
            state.city.remove(b.id)
          } else if (roll < 0.6) {
            // Buy land next to the town.
            const owned = [...state.city.ownedLots()].map((l) => l.lot)
            const lot = pick(owned.flatMap(lotNeighbors).filter((l) => state.city.canBuyLot(l)))
            if (lot) buyLand(state.city, state.inventory, state.player, lot, random() < 0.5 ? state.quests : undefined)
            void lotOf
          } else if (roll < 0.66) {
            for (const id of MATERIAL_IDS) state.inventory.buy({ [id]: 2 })
          } else if (roll < 0.7) {
            for (const q of state.quests.activeQuests()) state.quests.claim(q)
          } else if (roll < 0.74) {
            const kind = pick(['tornado', 'lightning', 'flood', 'tsunami'] as const)!
            state.disasters.strike(kind, all().map((x) => x.tile), 0.4, now)
          } else if (roll < 0.8 && b) {
            state.disasters.repair(b.id)
          } else if (roll < 0.83) {
            state.army.holdParade(now)
          } else if (roll < 0.9) {
            // A month goes by: running costs, then the tax books (and a return after December).
            state.services.endOfMonth()
            state.taxes.endOfMonth(month++)
          } else if (roll < 0.92) {
            // Ships, neighbors and admin powers.
            const dock = pick(all().filter((x) => x.type.id === 'dock'))
            if (dock) {
              state.docks.order(dock, pick(SHIPMENT_OPTIONS)!, now)
              state.docks.unload(dock, now + 600_000)
            }
            const n = pick(NEIGHBORS)!
            state.neighbors.help(n, `spot-${Math.floor(random() * 5)}`, now)
            state.neighbors.claimGift(n, now)
            state.neighbors.fulfill(n, now)
            state.placement.freeBuild = random() < 0.3
          } else if (roll < 0.96) {
            state.player.grantXp(Math.floor(random() * 60))
            state.city.economy.adjust(Math.floor(random() * 400))
          } else {
            state = roundTrip(state, where)
          }
          check(state, where)
        } catch (err) {
          throw new Error(`${where} (roll ${roll.toFixed(3)}): ${(err as Error).message}`)
        }
      }
      roundTrip(state, `seed ${seed}, end`)
      if (process.env.SIM_STATS) {
        const kinds = new Set(all().map((x) => x.type.category))
        console.log(`seed ${seed}: ${all().length} buildings (${[...kinds].join(',')}), level ${state.player.level}, lots ${[...state.city.ownedLots()].length}, months ${month}, damaged ${all().filter((x) => x.damaged).length}, coins ${state.city.coins}, debt ${state.city.debt}`)
      }
    })
  }
})
