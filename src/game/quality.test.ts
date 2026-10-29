import { describe, expect, it } from 'vitest'
import { QUALITY_LEVELS, QualityGovernor } from './quality'

const run = (q: QualityGovernor, fps: number, seconds: number) => {
  const changes = []
  for (let i = 0; i < fps * seconds; i++) {
    const level = q.frame(1000 / fps)
    if (level) changes.push(level.name)
  }
  return changes
}

describe('QualityGovernor', () => {
  it('keeps full quality when the game runs smoothly', () => {
    expect(run(new QualityGovernor(), 60, 30)).toEqual([])
  })

  it('steps down one level at a time while frames are slow, then stops at the lowest', () => {
    const q = new QualityGovernor()
    expect(run(q, 20, 4)).toEqual(['medium'])
    expect(run(q, 20, 30)).toEqual(['low', 'lowest'])
    expect(q.level).toBe(QUALITY_LEVELS.length - 1)
  })

  it('ignores long pauses like a hidden tab', () => {
    const q = new QualityGovernor()
    for (let i = 0; i < 20; i++) expect(q.frame(5000)).toBeNull()
    expect(q.level).toBe(0)
  })
})
