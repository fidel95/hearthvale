import type { City, CityEvent, PlacedBuilding } from './City'
import { levelFactor } from './construction'
import { cropState, type CropType } from './crops'
import { isPlot } from './buildings'
import { seasonBonus } from './seasons'
import type { Economy } from './Economy'
import { soldBy } from './products'

// Everything buildings produce over time: collecting income, planting and
// harvesting crops, restocking shops, running factories, finishing
// construction and upgrading.
// Production runs on timestamps (readyAt, plantedAt, construction.endsAt),
// so nothing ticks: each action checks the time it's given.
// (What state a building is in, for the interface, is production.ts.)

export class ProductionSystem {
  // The calendar month (0 = January), for crops in season. GameState wires it to the clock.
  month: () => number = () => 0
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
    return Math.round(crop.sellPrice * this.city.incomeMultiplier(plot) * (1 + seasonBonus(crop, this.month())))
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
    // For the tax books, in goods: a product counts as the goods it was made from.
    const goodsUsed = (building.type.goodsPerSale ?? 0) * soldBy(building.type).goodsEach
    // The next timer starts when you collect, not when it became ready,
    // so leaving money uncollected doesn't stack up extra payouts.
    building.readyAt = now + building.type.income.seconds * 1000
    building.lastCollectedAt = now
    building.stock -= goodsUsed
    this.emit({ kind: 'collected', building, amount, goodsUsed })
    this.economy.adjust(amount)
    return amount
  }

  // What's in town storage for this shop to sell: goods, or its product.
  supplyFor(b: PlacedBuilding): number {
    return b.type.sells ? this.economy.product(b.type.sells) : this.economy.goods
  }

  // Fill a shop's shelves from town storage, as far as both allow. Returns the units moved.
  restock(id: number): number {
    const b = this.city.get(id)
    if (!b || !b.type.goodsPerSale || !this.city.isBuilt(b)) return 0
    const units = Math.min(this.stockCapacity(b) - b.stock, this.supplyFor(b))
    if (units <= 0) return 0
    b.stock += units
    this.emit({ kind: 'restocked', building: b, units })
    if (b.type.sells) this.economy.changeProduct(b.type.sells, -units)
    else this.economy.changeGoods(-units)
    return units
  }

  // ---- Factories. A batch takes its goods when it starts (they're in the
  // works, kept in building.stock as the units being made) and its products
  // go into storage when it's collected; then the next batch starts.

  factoryState(b: PlacedBuilding, now: number): 'idle' | 'working' | 'done' {
    if (!b.type.factory || b.stock <= 0) return 'idle'
    return now >= b.readyAt ? 'done' : 'working'
  }

  // Start a batch if the factory is idle, working (built, with a road and
  // utilities), and storage has the goods. Returns whether it started.
  startBatch(id: number, now: number): boolean {
    const b = this.city.get(id)
    const f = b?.type.factory
    if (!b || !f || b.stock > 0 || !this.city.isOperating(b)) return false
    if (this.economy.goods < f.input) return false
    b.stock = f.output
    b.readyAt = now + f.seconds * 1000
    this.emit({ kind: 'batchStarted', building: b })
    this.economy.changeGoods(-f.input)
    return true
  }

  // Collect a finished batch into storage (if there's room), and start the
  // next. Returns the units made (0 if not ready or no room).
  collectBatch(id: number, now: number): number {
    const b = this.city.get(id)
    const f = b?.type.factory
    if (!b || !f || this.factoryState(b, now) !== 'done' || this.economy.room() < b.stock) return 0
    const units = b.stock
    b.stock = 0
    this.emit({ kind: 'made', building: b, product: f.product, units })
    this.economy.changeProduct(f.product, units)
    this.startBatch(id, now)
    return units
  }

  // Start every idle factory that can (Game calls this now and then, so
  // factories pick up goods as they arrive).
  runFactories(now: number) {
    for (const b of this.city.all()) if (b.type.factory && b.stock === 0) this.startBatch(b.id, now)
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
    // Less without enough water; more in season.
    const goods = Math.round(state.crop.goods * this.city.incomeMultiplier(plot) * (1 + seasonBonus(state.crop, this.month())))
    // Goods are kept if anything uses them: a shop selling goods, or a factory.
    const hasShops = [...this.city.all()].some((b) => ((b.type.goodsPerSale && !b.type.sells) || b.type.factory) && this.city.isBuilt(b))
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
