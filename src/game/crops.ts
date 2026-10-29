// The crop catalog and the rules for how a planted crop changes over time.
// Like buildings.ts, crops are plain data: adding a crop means adding an entry.

export type PlantShape = 'bush' | 'stalk' | 'cob' | 'vine' | 'flower'

export interface CropType {
  id: string
  name: string
  emoji: string
  seedCost: number // paid when planting
  growSeconds: number // planting → ripe
  sellPrice: number // coins for the harvest
  // How long it stays ripe before it withers and the harvest is lost.
  freshSeconds: number
  // How to draw it (see createCropObject in models.ts).
  look: { shape: PlantShape; leaf: string; fruit: string; height: number; perTile: 1 | 2 }
}

const MINUTE = 60
const HOUR = 60 * MINUTE

// Quick crops pay best per minute but need you to keep coming back; slow ones
// pay less per minute but can be left overnight. The same trade-off as
// short- and long-timer crops in the genre's classics.
export const CROP_TYPES: CropType[] = [
  {
    id: 'strawberries',
    name: 'Strawberries',
    emoji: '🍓',
    seedCost: 10,
    growSeconds: 1 * MINUTE,
    sellPrice: 40,
    freshSeconds: 3 * MINUTE,
    look: { shape: 'bush', leaf: '#3f8f3a', fruit: '#e0383e', height: 0.2, perTile: 2 },
  },
  {
    id: 'wheat',
    name: 'Wheat',
    emoji: '🌾',
    seedCost: 15,
    growSeconds: 5 * MINUTE,
    sellPrice: 120,
    freshSeconds: 15 * MINUTE,
    look: { shape: 'stalk', leaf: '#7fb34a', fruit: '#e8c75a', height: 0.4, perTile: 2 },
  },
  {
    id: 'pumpkins',
    name: 'Pumpkins',
    emoji: '🎃',
    seedCost: 30,
    growSeconds: 20 * MINUTE,
    sellPrice: 360,
    freshSeconds: 1 * HOUR,
    look: { shape: 'vine', leaf: '#4f9a3c', fruit: '#e9822f', height: 0.25, perTile: 1 },
  },
  {
    id: 'corn',
    name: 'Corn',
    emoji: '🌽',
    seedCost: 40,
    growSeconds: 1 * HOUR,
    sellPrice: 750,
    freshSeconds: 3 * HOUR,
    look: { shape: 'cob', leaf: '#4f9a3c', fruit: '#f2d23c', height: 0.6, perTile: 2 },
  },
  {
    id: 'sunflowers',
    name: 'Sunflowers',
    emoji: '🌻',
    seedCost: 60,
    growSeconds: 4 * HOUR,
    sellPrice: 2000,
    freshSeconds: 8 * HOUR,
    look: { shape: 'flower', leaf: '#4f9a3c', fruit: '#f5c518', height: 0.55, perTile: 2 },
  },
  {
    id: 'potatoes',
    name: 'Potatoes',
    emoji: '🥔',
    seedCost: 80,
    growSeconds: 8 * HOUR,
    sellPrice: 3000,
    freshSeconds: 16 * HOUR,
    look: { shape: 'bush', leaf: '#5d9e45', fruit: '#c79a5b', height: 0.18, perTile: 2 },
  },
]

export const CROPS_BY_ID = new Map(CROP_TYPES.map((c) => [c.id, c]))

// What's growing on a plot, as saved: which crop and when it went in.
// Like income timers, it's a Date.now() timestamp, so crops keep growing
// (and can wither) while the game is closed.
export interface PlantedCrop {
  cropId: string
  plantedAt: number
}

// A plot is a small state machine: empty → growing → ripe → withered.
// We never store the stage. It's worked out from the timestamp whenever it's
// needed, so there's nothing to update every frame and nothing to get out of sync.
export type CropState =
  | { stage: 'empty' }
  | { stage: 'growing'; crop: CropType; progress: number; readyAt: number }
  | { stage: 'ripe'; crop: CropType; witherAt: number }
  | { stage: 'withered'; crop: CropType }

export function cropState(planted: PlantedCrop | null, now: number): CropState {
  const crop = planted && CROPS_BY_ID.get(planted.cropId)
  if (!planted || !crop) return { stage: 'empty' }
  const readyAt = planted.plantedAt + crop.growSeconds * 1000
  const witherAt = readyAt + crop.freshSeconds * 1000
  if (now < readyAt) {
    const progress = (now - planted.plantedAt) / (crop.growSeconds * 1000)
    return { stage: 'growing', crop, progress: Math.max(0, progress), readyAt }
  }
  if (now < witherAt) return { stage: 'ripe', crop, witherAt }
  return { stage: 'withered', crop }
}

// Profit per minute of growing: the number the crop picker shows to compare crops.
export function profitPerMinute(crop: CropType): number {
  return (crop.sellPrice - crop.seedCost) / (crop.growSeconds / MINUTE)
}
