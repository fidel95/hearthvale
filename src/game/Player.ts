import { Emitter } from './events'
import type { BuildingType } from './buildings'
import type { City, PlacedBuilding } from './City'
import type { CropType } from './crops'
import {
  CURVE,
  ENERGY_REGEN_MS,
  buildXp,
  collectXp,
  convertOldXp,
  levelForXp,
  levelReward,
  maxEnergy,
  unlocksAt,
  xpForLevel,
} from './progression'

// The player's progress: XP, level and energy. It watches City for the things
// that earn XP or use energy, the same way Taxes watches it for income, so
// neither City nor the input code has to know these rules exist.
// The numbers live in progression.ts.

export interface PlayerSave {
  xp: number
  energy: number
  energyAt: number
  rewardedLevel?: number // the highest level whose reward was paid (older saves lack it)
  curve?: number // which XP curve xp is on (progression.ts CURVE; older saves: the first)
}

export type PlayerEvent =
  // building is set when the XP came from something on the map, for the "+2 ⭐" pop-up.
  | { kind: 'xp'; amount: number; building?: PlacedBuilding }
  | { kind: 'levelUp'; level: number; reward: number; maxEnergy: number; buildings: BuildingType[]; crops: CropType[] }
  | { kind: 'energy' }

export class Player {
  private _xp = 0
  // The highest level whose reward has been paid, so no level pays twice
  // (whatever happens to XP or saves).
  private rewardedLevel = 1
  // Energy is stored like crops are: a value and the time it was true. The
  // current energy is worked out from those (see energy()), so it refills
  // while the game is closed with nothing ticking.
  private storedEnergy = maxEnergy(1)
  private energyAt = 0
  private city: City
  private now: () => number
  private events = new Emitter<PlayerEvent>()

  // now is injectable so tests can control time; the game uses the real clock.
  constructor(city: City, now: () => number = Date.now) {
    this.city = city
    this.now = now
    city.onChange((event) => {
      const now = this.now()
      switch (event.kind) {
        case 'added':
          this.addXp(buildXp(event.paid, event.building.type.xpReward), now, event.building)
          break
        case 'collected':
          this.spendEnergy(now)
          this.addXp(collectXp(event.amount), now, event.building)
          break
        case 'harvested':
          this.spendEnergy(now)
          this.addXp(event.crop.xp, now, event.building)
          break
        case 'planted':
          // Free starter crops don't use energy.
          if (event.cost > 0) this.spendEnergy(now)
          break
        case 'cleared':
          this.spendEnergy(now)
          break
        case 'finished': // finishing construction: a bigger building, more XP
          this.addXp(Math.max(2, Math.floor(event.building.type.cost / 50)), now, event.building)
          break
        case 'upgraded':
          this.addXp(buildXp(event.cost), now, event.building)
          break
        case 'made': // collecting a factory batch
          this.spendEnergy(now)
          this.addXp(Math.max(2, event.units), now, event.building)
          break
        case 'goodsIn': // unloading a ship
          this.spendEnergy(now)
          this.addXp(Math.max(1, Math.floor(event.units / 20)), now)
          break
      }
    })
  }

  onChange(listener: (event: PlayerEvent) => void) {
    this.events.on(listener)
  }

  get xp() {
    return this._xp
  }

  get level() {
    return levelForXp(this._xp)
  }

  // How far through the current level, from 0 to 1, for the XP bar.
  get levelProgress() {
    const from = xpForLevel(this.level)
    return (this._xp - from) / (xpForLevel(this.level + 1) - from)
  }

  get maxEnergy() {
    return maxEnergy(this.level)
  }

  // Energy right now: what was stored plus one for every full regen period
  // since, up to the maximum.
  energy(now: number): number {
    if (this.storedEnergy >= this.maxEnergy) return this.storedEnergy
    const regained = Math.floor((now - this.energyAt) / ENERGY_REGEN_MS)
    return Math.min(this.maxEnergy, this.storedEnergy + regained)
  }

  // When the next point of energy arrives, or null when full.
  nextEnergyAt(now: number): number | null {
    if (this.energy(now) >= this.maxEnergy) return null
    const regained = Math.floor((now - this.energyAt) / ENERGY_REGEN_MS)
    return this.energyAt + (regained + 1) * ENERGY_REGEN_MS
  }

  hasEnergy(now: number): boolean {
    return this.energy(now) > 0
  }

  // Input code checks hasEnergy() before acting; this is called once the
  // action really happened (from the City event).
  private spendEnergy(now: number) {
    const current = this.energy(now)
    if (current <= 0) return
    if (current >= this.maxEnergy) {
      // Full: the regen clock starts now.
      this.energyAt = now
    } else {
      // Keep the progress toward the next point: move the clock forward only
      // by the whole periods we just counted into storedEnergy.
      this.energyAt += Math.floor((now - this.energyAt) / ENERGY_REGEN_MS) * ENERGY_REGEN_MS
    }
    this.storedEnergy = current - 1
    this.emit({ kind: 'energy' })
  }

  // XP and energy given as rewards (collections, quests).
  grantXp(amount: number) {
    this.addXp(amount, this.now())
  }

  // Admin tools: jump to a level, up (with each level's reward, as if
  // earned) or down (to the start of that level; rewards aren't paid twice).
  setLevel(level: number) {
    if (level > this.level) this.grantXp(xpForLevel(level) - this._xp)
    else if (level < this.level) {
      this._xp = xpForLevel(level)
      this.emit({ kind: 'xp', amount: 0 })
      this.emit({ kind: 'energy' })
    }
  }

  // Bonus energy can go above the maximum; it just won't refill past it.
  grantEnergy(amount: number) {
    const now = this.now()
    const current = this.energy(now)
    if (current >= this.maxEnergy) this.energyAt = now
    else this.energyAt += Math.floor((now - this.energyAt) / ENERGY_REGEN_MS) * ENERGY_REGEN_MS
    this.storedEnergy = current + amount
    this.emit({ kind: 'energy' })
  }

  private addXp(amount: number, now: number, building?: PlacedBuilding) {
    if (amount <= 0) return
    const before = this.level
    this._xp += amount
    this.emit({ kind: 'xp', amount, building })
    // A big harvest can jump more than one level; reward each one.
    for (let level = before + 1; level <= this.level; level++) this.levelUp(level, now)
  }

  private levelUp(level: number, now: number) {
    if (level <= this.rewardedLevel) return
    this.rewardedLevel = level
    // A new level refills energy to the new, higher maximum.
    this.storedEnergy = maxEnergy(level)
    this.energyAt = now
    const reward = levelReward(level)
    this.city.economy.award(reward, `Level ${level} reward`)
    this.emit({ kind: 'levelUp', level, reward, maxEnergy: maxEnergy(level), ...unlocksAt(level) })
    this.emit({ kind: 'energy' })
  }

  toSave(): PlayerSave {
    return { xp: this._xp, energy: this.storedEnergy, energyAt: this.energyAt, rewardedLevel: this.rewardedLevel, curve: CURVE }
  }

  load(save: PlayerSave) {
    // A save from before the steeper curve keeps its level and progress through it.
    this._xp = save.curve === CURVE ? save.xp : convertOldXp(save.xp)
    this.storedEnergy = save.energy
    this.energyAt = save.energyAt
    // Older saves: every level reached so far was already rewarded.
    this.rewardedLevel = save.rewardedLevel ?? levelForXp(this._xp)
    this.emit({ kind: 'energy' })
  }

  private emit(event: PlayerEvent) {
    this.events.emit(event)
  }
}
