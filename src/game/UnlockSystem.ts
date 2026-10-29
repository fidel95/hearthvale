import { BUILDING_TYPES } from './buildings'
import { CROP_TYPES } from './crops'
import { upgradeCost } from './construction'
import { expansionLevel } from './land'
import { NEIGHBORS_UNLOCK_LEVEL } from './neighborData'
import type { Player } from './Player'

// What's available to the player: which buildings and crops, and which
// features (neighbors, upgrades, land). Every "is this unlocked?" question is
// answered here, from the unlock levels in the data, so the build menu, the
// crop picker, placement and the quests can't disagree.

export type Feature = 'neighbors' | 'upgrades' | 'land'

const anyHome = BUILDING_TYPES.find((t) => t.category === 'home')!

export const FEATURE_LEVELS: Record<Feature, number> = {
  neighbors: NEIGHBORS_UNLOCK_LEVEL,
  upgrades: upgradeCost(anyHome, 2).playerLevel,
  land: expansionLevel(1),
}

export class UnlockSystem {
  private player: Player

  constructor(player: Player) {
    this.player = player
  }

  isUnlocked(item: { unlockLevel: number }): boolean {
    return this.player.level >= item.unlockLevel
  }

  hasFeature(feature: Feature): boolean {
    return this.player.level >= FEATURE_LEVELS[feature]
  }

  // Everything that unlocks at exactly this level.
  at(level: number) {
    return {
      buildings: BUILDING_TYPES.filter((b) => b.unlockLevel === level),
      crops: CROP_TYPES.filter((c) => c.unlockLevel === level),
      features: (Object.keys(FEATURE_LEVELS) as Feature[]).filter((f) => FEATURE_LEVELS[f] === level),
    }
  }
}
