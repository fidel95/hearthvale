import type { BuildingType } from './buildings'
import type { City, PlacedBuilding } from './City'
import type { CropType } from './crops'
import {
  ENERGY_REGEN_MS,
  buildXp,
  collectXp,
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
}

export type PlayerEvent =
  // building is set when the XP came from something on the map, for the "+2 ⭐" pop-up.
  | { kind: 'xp'; amount: number; building?: PlacedBuilding }
  | { kind: 'levelUp'; level: number; reward: number; maxEnergy: number; buildings: BuildingType[]; crops: CropType[] }
  | { kind: 'energy' }

export class Player {
  private _xp = 0
  // Energy is stored like crops are: a value and the time it was true. The
  // current energy is worked out from those (see energy()), so it refills
  // while the game is closed with nothing ticking.
  private storedEnergy = maxEnergy(1)
  private energyAt = 0
  private city: City
  private now: () => number
  private listeners: ((event: PlayerEvent) => void)[] = []

  // now is injectable so tests can control time; the game uses the real clock.
  constructor(city: City, now: () => number = Date.now) {
    this.city = city
    this.now = now
    city.onChange((event) => {
      const now = this.now()
      switch (event.kind) {
        case 'added':
          this.addXp(buildXp(event.paid), now, event.building)
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
      }
    })
  }

  onChange(listener: (event: PlayerEvent) => void) {
    this.listeners.push(listener)
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

  isUnlocked(item: { unlockLevel: number }): boolean {
    return this.level >= item.unlockLevel
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

  private addXp(amount: number, now: number, building?: PlacedBuilding) {
    if (amount <= 0) return
    const before = this.level
    this._xp += amount
    this.emit({ kind: 'xp', amount, building })
    // A big harvest can jump more than one level; reward each one.
    for (let level = before + 1; level <= this.level; level++) this.levelUp(level, now)
  }

  private levelUp(level: number, now: number) {
    // A new level refills energy to the new, higher maximum.
    this.storedEnergy = maxEnergy(level)
    this.energyAt = now
    const reward = levelReward(level)
    this.city.awardCoins(reward, `Level ${level} reward`)
    this.emit({ kind: 'levelUp', level, reward, maxEnergy: maxEnergy(level), ...unlocksAt(level) })
    this.emit({ kind: 'energy' })
  }

  toSave(): PlayerSave {
    return { xp: this._xp, energy: this.storedEnergy, energyAt: this.energyAt }
  }

  load(save: PlayerSave) {
    this._xp = save.xp
    this.storedEnergy = save.energy
    this.energyAt = save.energyAt
    this.emit({ kind: 'energy' })
  }

  private emit(event: PlayerEvent) {
    for (const listener of this.listeners) listener(event)
  }
}
