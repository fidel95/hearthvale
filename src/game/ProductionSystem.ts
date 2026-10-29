import type { City, CityEvent, PlacedBuilding } from './City'
import { levelFactor } from './construction'
import { cropState, type CropType } from './crops'
import { isPlot } from './buildings'
import type { Economy } from './Economy'

// Everything buildings produce over time: collecting income, planting and
// harvesting crops, restocking shops, finishing construction and upgrading.
// Production runs on timestamps (readyAt, plantedAt, construction.endsAt),
// so nothing ticks: each action checks the time it's given.
// (What state a building is in, for the interface, is production.ts.)

export class ProductionSystem {
  private city: City
  private economy: Economy
  private emit: (event: CityEvent) => void

  constructor(city: City, economy: Economy, emit: (event: CityEvent) => void) {
    this.city = city
    this.economy = economy
    this.emit = emit
  }

  isReady(building: PlacedBuilding, now: number): boolean {
    return building.type.income !== undefined && !building.construction && now >= building.readyAt
  }

  // The construction timer has run out: it can be finished.
  constructionDone(building: PlacedBuilding, now: number): boolean {
    return building.construction !== null && now >= building.construction.endsAt
  }

  // What collecting from this building pays right now (levels, utilities, location).
  payout(building: PlacedBuilding): number {
    const coins = (building.type.income?.coins ?? 0) * levelFactor(building.level)
    return Math.round(coins * this.city.incomeMultiplier(building))
  }

  // What a crop on this plot sells for at the market right now (less without enough water).
  harvestValue(plot: PlacedBuilding, crop: CropType): number {
    return Math.round(crop.sellPrice * this.city.incomeMultiplier(plot))
  }

  // Shops sell from their own shelves; everything else always has "stock".
  hasStock(building: PlacedBuilding): boolean {
    return building.stock >= (building.type.goodsPerSale ?? 0)
  }

  // How many goods a shop's shelves hold (more at higher levels).
  stockCapacity(building: PlacedBuilding): number {
    return Math.round((building.type.stockCapacity ?? 0) * levelFactor(building.level))
  }

  // Collect a building's income if it's ready, working (built, connected) and,
  // for a shop, stocked. Returns the coins earned (0 if not).
  collect(id: number, now: number): number {
    const building = this.city.get(id)
    if (!building || !building.type.income || !this.isReady(building, now) || !this.hasStock(building)) return 0
    if (!this.city.isOperating(building)) return 0 // e.g. a shop with no road

    const amount = this.payout(building)
    const goodsUsed = building.type.goodsPerSale ?? 0
    // The next timer starts when you collect, not when it became ready,
    // so leaving money uncollected doesn't stack up extra payouts.
    building.readyAt = now + building.type.income.seconds * 1000
    building.lastCollectedAt = now
    building.stock -= goodsUsed
    this.emit({ kind: 'collected', building, amount, goodsUsed })
    this.economy.adjust(amount)
    return amount
  }

  // Fill a shop's shelves from town storage, as far as both allow. Returns the units moved.
  restock(id: number): number {
    const b = this.city.get(id)
    if (!b || !b.type.goodsPerSale || !this.city.isBuilt(b)) return 0
    const units = Math.min(this.stockCapacity(b) - b.stock, this.economy.goods)
    if (units <= 0) return 0
    b.stock += units
    this.emit({ kind: 'restocked', building: b, units })
    this.economy.changeGoods(-units)
    return units
  }

  // Plant a crop on an empty farm plot, paying for the seeds.
  // free: true skips the cost, for the starting town.
  plant(id: number, crop: CropType, { now = Date.now(), free = false } = {}): boolean {
    const plot = this.city.get(id)
    if (!plot || !isPlot(plot.type) || cropState(plot.crop, now).stage !== 'empty') return false
    if (!free && !this.economy.canAfford(crop.seedCost)) return false

    plot.crop = { cropId: crop.id, plantedAt: now }
    const cost = free ? 0 : crop.seedCost
    this.emit({ kind: 'planted', building: plot, crop, cost })
    this.economy.adjust(-cost)
    return true
  }

  // Harvest a ripe crop. If the town has shops, the harvest goes into storage
  // as goods for them to sell, and whatever doesn't fit is sold at the market.
  // With no shops it's all sold. Returns the coins earned (0 if not ripe, or
  // if it all went into storage).
  harvest(id: number, now: number): number {
    const plot = this.city.get(id)
    if (!plot) return 0
    const state = cropState(plot.crop, now)
    if (state.stage !== 'ripe') return 0

    plot.crop = null
    const goods = Math.round(state.crop.goods * this.city.incomeMultiplier(plot)) // less without enough water
    const hasShops = [...this.city.all()].some((b) => b.type.goodsPerSale && this.city.isBuilt(b))
    const stored = Math.min(goods, hasShops ? this.economy.room() : 0)
    const amount = goods > 0 ? Math.round((this.harvestValue(plot, state.crop) * (goods - stored)) / goods) : 0
    this.emit({ kind: 'harvested', building: plot, crop: state.crop, goods: stored, amount })
    this.economy.changeGoods(stored)
    this.economy.adjust(amount)
    return amount
  }

  // Clear a withered crop so the plot can be planted again. The seeds are lost.
  clearPlot(id: number, now: number): boolean {
    const plot = this.city.get(id)
    if (!plot) return false
    const state = cropState(plot.crop, now)
    if (state.stage !== 'withered') return false
    plot.crop = null
    this.emit({ kind: 'cleared', building: plot, crop: state.crop })
    return true
  }

  // Finish construction (projects.ts checks and uses the materials first).
  finish(id: number, now: number, materialsCost = 0): boolean {
    const b = this.city.get(id)
    if (!b || !this.constructionDone(b, now)) return false
    b.construction = null
    if (b.type.income) b.readyAt = now + b.type.income.seconds * 1000
    this.emit({ kind: 'finished', building: b, materialsCost })
    return true
  }

  // Raise a building's level (projects.ts checks level and materials first).
  upgrade(id: number, coins: number, materialsCost = 0): boolean {
    const b = this.city.get(id)
    if (!b || !this.city.isBuilt(b) || !this.economy.canAfford(coins)) return false
    b.level++
    this.emit({ kind: 'upgraded', building: b, cost: coins + materialsCost })
    this.economy.adjust(-coins)
    return true
  }
}
