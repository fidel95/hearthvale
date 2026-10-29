import { describe, expect, it } from 'vitest'
import { BUILDINGS_BY_ID } from './buildings'
import { monthlyDepreciation } from './taxRules'
import { COUNTY_SUPPLY, incomeMultiplier, serviceReport } from './utilityRules'

const b = (id: string) => BUILDINGS_BY_ID.get(id)!

describe('serviceReport', () => {
  it('adds up residents, demand, supply and running costs', () => {
    const r = serviceReport([b('cottage'), b('cottage'), b('bakery'), b('water-tower')])
    expect(r.population).toBe(4)
    expect(r.utilities.water).toEqual({ supply: COUNTY_SUPPLY.water + 20, demand: 6, level: 1 })
    expect(r.utilities.power).toEqual({ supply: 8, demand: 7, level: 1 })
    expect(r.upkeep).toBe(15)
  })

  it('reports the share of demand met when supply falls short', () => {
    // 5 cottages need 10 power; the county supplies 8.
    const r = serviceReport(Array(5).fill(b('cottage')))
    expect(r.utilities.power.level).toBeCloseTo(0.8)
  })

  it('is fully served when nothing needs anything', () => {
    expect(serviceReport([]).utilities.trash.level).toBe(1)
  })
})

describe('incomeMultiplier', () => {
  const town = (ids: string[]) => serviceReport(ids.map(b))

  it('pays in full when every utility keeps up', () => {
    expect(incomeMultiplier(town(['cottage']), 'home')).toBe(1)
  })

  it('scales homes and shops with water and power, and trims up to a quarter for trash', () => {
    const r = town(Array(5).fill('cottage')) // 10 of everything needed, 8 supplied: 80% each
    expect(incomeMultiplier(r, 'home')).toBeCloseTo(0.8 * 0.8 * (0.75 + 0.25 * 0.8))
    expect(incomeMultiplier(r, 'farm')).toBeCloseTo(0.8) // farms only need water
    expect(incomeMultiplier(r, 'decoration')).toBe(1)
  })
})

describe('utility depreciation', () => {
  it('uses each plant’s own recovery period', () => {
    expect(monthlyDepreciation(1200, b('solar-farm'))).toBeCloseTo(1200 / 60) // 5 years
    expect(monthlyDepreciation(250, b('water-tower'))).toBeCloseTo(250 / 300) // 25 years
  })
})
