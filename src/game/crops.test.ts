import { describe, expect, it } from 'vitest'
import { CROPS_BY_ID, CROP_TYPES, cropState, profitPerMinute } from './crops'

const strawberries = CROPS_BY_ID.get('strawberries')! // grows 60 s, fresh for 180 s

describe('cropState', () => {
  const planted = { cropId: 'strawberries', plantedAt: 1000 }

  it('is empty with nothing planted, or with a crop that no longer exists', () => {
    expect(cropState(null, 0).stage).toBe('empty')
    expect(cropState({ cropId: 'moonfruit', plantedAt: 0 }, 0).stage).toBe('empty')
  })

  it('grows, ripens, then withers, purely from the timestamps', () => {
    const half = cropState(planted, 1000 + 30_000)
    expect(half).toMatchObject({ stage: 'growing', progress: 0.5, readyAt: 61_000 })
    expect(cropState(planted, 60_999).stage).toBe('growing')
    expect(cropState(planted, 61_000)).toMatchObject({ stage: 'ripe', witherAt: 241_000 })
    expect(cropState(planted, 240_999).stage).toBe('ripe')
    expect(cropState(planted, 241_000).stage).toBe('withered')
  })
})

describe('the crop catalog', () => {
  it('always pays back more than the seeds cost', () => {
    for (const crop of CROP_TYPES) expect(crop.sellPrice).toBeGreaterThan(crop.seedCost)
  })

  it('trades speed for convenience: slower crops earn less per minute but stay fresh longer', () => {
    const byTime = [...CROP_TYPES].sort((a, b) => a.growSeconds - b.growSeconds)
    for (let i = 1; i < byTime.length; i++) {
      expect(profitPerMinute(byTime[i])).toBeLessThan(profitPerMinute(byTime[i - 1]))
      expect(byTime[i].freshSeconds).toBeGreaterThan(byTime[i - 1].freshSeconds)
    }
  })

  it('computes profit per minute', () => {
    expect(profitPerMinute(strawberries)).toBe(30) // (40 − 10) / 1 min
  })
})
