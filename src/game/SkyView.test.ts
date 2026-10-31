import { describe, expect, it } from 'vitest'
import { ufoGift } from './SkyView'

describe('the UFO', () => {
  it('leaves a bigger gift for a bigger town', () => {
    expect(ufoGift(1).coins).toBeGreaterThan(0)
    expect(ufoGift(20).coins).toBeGreaterThan(ufoGift(10).coins)
    expect(ufoGift(20).xp).toBeGreaterThan(ufoGift(10).xp)
  })
})
