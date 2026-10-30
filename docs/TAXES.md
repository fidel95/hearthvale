# Taxes in Hearthvale

Hearthvale's taxes are modeled on real US taxes (2024 figures). The rules are
the real ones, and only the dollar amounts are scaled to fit the game's economy.
This doc explains each tax, the real rule behind it, how the game computes it,
and where the game simplifies.

Code: rules and rates in [`src/game/taxRules.ts`](../src/game/taxRules.ts),
bookkeeping over time in [`src/game/Taxes.ts`](../src/game/Taxes.ts), the in-game
window in [`src/ui/TaxPanel.ts`](../src/ui/TaxPanel.ts), and tests in
`taxRules.test.ts` and `Taxes.test.ts`.

> This is a teaching model, not tax advice. Real taxes depend on where you
> live, your filing status, and many rules the game leaves out (listed at the end).

## Who you are, tax-wise

You own every building in town. Homes are **rental properties** you rent out,
shops are **businesses** you run, and farm plots make you a **farmer**. That
makes you, in US terms, a single filer with rental income (Schedule E),
business income (Schedule C) and farm income (Schedule F). Each year you:

1. collect sales tax from customers and hand it to the state every quarter,
2. pay property tax on what your buildings are worth,
3. file an income tax return on Tax Day.

## The calendar

One in-game month is one minute of play, so a year is 12 minutes. The calendar
only runs while you play (see [ARCHITECTURE.md](ARCHITECTURE.md#two-kinds-of-time)).

| When | What happens |
|---|---|
| Every month end | Property tax and depreciation accrue for every building you own |
| End of Mar, Jun, Sep, Dec | Sales tax you've held is sent to the state |
| End of December (**Tax Day**) | The year's return is filed; income tax + property tax are paid |
| Every month end, if coins < 0 | 0.5% late penalty on the debt |

## 1. Sales tax

**Real rule:** most US states and many cities charge sales tax on retail sales.
The combined rate is usually around 6–10%. The customer pays it on top of the
price; the store collects it, holds it, and sends it to the state monthly or
quarterly. **It is never the store's income.**

**In the game:** shops add **7%** to every sale, rounded to whole coins per sale
like a receipt. The tax lands in your coins (you really are holding it), shows
as a grey "+3 sales tax (held)" pop-up, and is tracked in `salesTaxHeld`. At
each quarter's end it's taken back out and sent to the state.

**The lesson:** if you spend the sales tax you're holding, you'll be short when
the quarter ends. Real small businesses get into trouble exactly this way.

```
Bakery sale:        40 coins     ← your income (counted for income tax)
Sales tax (7%):      3 coins     ← the state's money, held until quarter end
Coins received:     43 coins
```

## 2. Property tax

**Real rule:** local governments tax real estate every year at a percentage of
its **assessed value**. The US average effective rate is about 1%. For
income-producing property, assessors often use the **income approach**: a
building is worth what an investor would pay for the income it produces.

```
Net operating income (NOI) = gross income − operating expenses
Value                      = NOI ÷ capitalization rate ("cap rate")
```

**In the game:**

| Setting | Value | Real-world meaning |
|---|---|---|
| `PROPERTY_TAX_RATE` | 1% per year | near the US average |
| `OPERATING_EXPENSE_RATIO` | 40% | typical share of rent spent on upkeep, insurance, management |
| `CAP_RATE` | 8% | typical return investors expect from rental property |

Potential income assumes you always collect on time. Buildings with no income
(trees, planters) are valued at what they cost (the "cost approach").

**Location matters.** Real assessors value a home near a good school or a
park higher, because it rents for more. In the game, the same location bonus
that raises a building's income (parks, schools, fire stations, a road)
raises its assessed value by the same percentage. That includes decorations:
landscaping (trees, flower beds, a fountain) is a classic way to raise a
property's value, and its assessment. A cottage next to a park
(+10%) is assessed at 2,970 instead of 2,700, and pays 29.70 a year instead
of 27.

**Example: Cottage** (15 coins every 30 s, costs 100)

```
Payouts per year   = 12 min × 60 s ÷ 30 s = 24
Gross income       = 24 × 15              = 360
NOI                = 360 × (1 − 0.40)     = 216
Assessed value     = 216 ÷ 0.08           = 2,700   (you paid 100: it "appreciated")
Property tax       = 2,700 × 1%           = 27 per year
```

Property tax accrues monthly (1/12 of the yearly amount), so a building owned
for half a year pays half. It's paid on Tax Day. You owe it whether or not you
actually collected the rent, because it's a tax on what the property is
*worth*, not what it earned.

## 3. Depreciation

**Real rule:** buildings wear out, so the tax code lets you deduct their cost
over their "recovery period" instead of all at once. The US system is called
MACRS. Land never wears out and can't be depreciated. In the month a building is
placed in service you get half a month (the **mid-month convention**).

**In the game** (straight-line, from `RECOVERY_YEARS`):

| Category | Real class | Years | Cottage example (cost 100) |
|---|---|---|---|
| Homes | Residential rental property | 27.5 | 100 ÷ 27.5 = 3.64 per year |
| Shops | Nonresidential real property | 39 | Bakery: 300 ÷ 39 = 7.69 per year |
| Decorations | Land improvements | 15 | Oak tree: 20 ÷ 15 = 1.33 per year |
| Farm fields | Land | never | 0 |
| Water Tower | Water utility property | 25 | 250 ÷ 25 = 10 per year |
| Power Plant | Electric utility steam production plant | 20 | 500 ÷ 20 = 25 per year |
| Recycling Center | Waste reduction and resource recovery plant | 7 | 300 ÷ 7 = 42.86 per year |
| Solar Farm | Solar energy property | 5 | 1,200 ÷ 5 = 240 per year |
| Roads, Park, Dock | Land improvements (docks and wharves) | 15 | Dock: 800 ÷ 15 = 53.33 per year |
| Barn | Farm buildings | 20 | 150 ÷ 20 = 7.50 per year |
| Warehouse | Nonresidential real property | 39 | 500 ÷ 39 = 12.82 per year |
| Fire Station, School | Nonresidential real property | 39 | School: 900 ÷ 39 = 23.08 per year |

Solar's short 5-year period is a real, deliberate tax incentive: deducting
the cost faster makes clean energy cheaper to build. Compare it with the
Power Plant, which is cheaper to build but pays for fuel every month.

Plowing a plot counts as preparing land, which real rules also treat as part
of the land's cost, so plots are never depreciated either.

Each building tracks how much of its cost (its **basis**) has been depreciated,
so it stops once the full cost has been deducted.

**Demolition:** you might expect to deduct the cost you haven't depreciated yet
when you tear a building down. US law says no (IRC §280B): that leftover cost
is added to the *land's* basis and only matters when the land is sold. The game
follows the real rule, so demolishing gives no deduction.

## 3b. Land

**Real rule:** land is taxed every year as property, but it never wears out,
so it's never depreciated.

**In the game:** every lot you own is assessed at what it cost (starting lots
at 250), and pays 1% of that a year in property tax. Lots bought later cost
500, 1,000, 1,500 and so on, so a bigger town pays more land tax.

## 3c. Utility running costs

**Real rule:** the costs of running a business, like fuel, maintenance and
staff for its utilities, are "ordinary and necessary" business expenses (IRC
§162), deducted in full the year they're paid. That's different from the cost
of the plant itself, which is a capital cost recovered through depreciation.

**In the game:** each Water Tower, Power Plant, Recycling Center and Solar
Farm charges its running cost at the end of every month. The total appears on
the return as "Utility operating costs" and comes off your income before
brackets apply. Building a plant: depreciated over years. Running it: deducted
right away. That pair is one of the central ideas in business taxes.

## 3d. Construction, improvements and idle property

**Real rules:**

- The cost of building something includes its materials, so they're added to
  its **basis** and recovered through depreciation, not deducted when bought.
- Depreciation starts when an asset is **placed in service**: for a new
  building, when it's finished, not when construction begins.
- An improvement that makes a building better or bigger (an upgrade) is a
  capital expense: added to the basis and depreciated. (A repair would be
  deducted; the game has no repairs.)

**In the game:**

| What happens | Tax effect |
|---|---|
| Buy materials | Nothing deducted: they're held at cost in the Inventory |
| Finish construction | The materials' cost is added to the building's basis; depreciation starts that month (mid-month convention) |
| Under construction | No depreciation yet (property tax still accrues, on its cost) |
| Upgrade (coins + materials) | Whole cost added to the basis; the building earns more, so it's assessed higher |
| Store a building | Off the land, so no property tax; not in service, so no depreciation; its record waits for it |

## 4. Farm income and expenses

**Real rule:** farmers report crop sales and farm costs on Schedule F. Most
small farms use the **cash method**: income counts when you're paid and
expenses when you pay them, so seed is deducted in the year you buy it, not
when the crop is sold. Selling crops to a market or wholesaler that resells
them is a **sale for resale**, which carries no sales tax.

**In the game:**

| What happens | Tax effect |
|---|---|
| You buy seeds (planting) | Seed cost is a farm expense, deducted this year |
| You harvest | Crop's sell price is farm income |
| The harvest itself | No sales tax: crops are sold wholesale |
| A crop withers | No extra deduction (see below) |
| Free starter crops | No expense, because you paid nothing |

**Withered crops:** it's tempting to deduct the lost harvest. Real rules say
no: you can't deduct the value of a crop you grew and never sold, and the seed
cost was already deducted when you bought it. Deducting it again would count
the same cost twice. The game follows that: a withered crop costs you its
seeds and the harvest you missed, and nothing else.

```
Strawberries, one harvest:
Seeds (expense)        10 coins     ← deducted when planted
Harvest (income)       40 coins     ← counted when harvested
Taxable profit         30 coins
```

## 4b. Inventory and cost of goods sold

**Real rule:** a business that sells goods can't deduct them when it buys
them. Goods on the shelf are **inventory**, an asset. Their cost is deducted
when they're sold, as **cost of goods sold** (COGS). At the end of the year,
the cost of unsold goods carries into next year. A business picks a method
for working out which goods were sold; the **average cost** method uses
total cost ÷ units.

**In the game:**

| What happens | Tax effect |
|---|---|
| You order a shipment (pay 240 for 40 goods) | Nothing deducted; inventory cost +240 |
| The ship is unloaded | Inventory: +40 units |
| A harvest goes into storage | Inventory: + units at no cost (the seeds were already deducted) |
| A shop sells, using 4 goods | COGS += 4 × average cost; inventory shrinks |
| Year ends with goods left | Their cost stays in inventory: no deduction yet |

```
40 free starting goods + 40 bought for 240  → 80 goods costing 240 (3 each on average)
Bakery sells: 40 coins income, uses 4 goods → cost of goods sold 12
Profit on that sale                          → 28 (plus 3 sales tax collected for the state)
```

The Taxes window shows inventory (units and cost) and the year's cost of
goods sold. Selling surplus crops at the market is still farm income, as before.

## 5. Income tax

**Real rule:** federal income tax uses **marginal brackets**. Each rate applies
only to the slice of income inside its bracket. Before brackets apply, you
subtract deductions. Business and rental expenses (like property tax and
depreciation) come off first, then the **standard deduction** that every filer
gets.

**In the game:** the 2024 US single-filer brackets and standard deduction, with
dollar amounts divided by 10 (1 coin ≈ $10):

| Rate | Real 2024 bracket (single) | Hearthvale (coins) |
|---|---|---|
| 10% | $0 – $11,600 | 0 – 1,160 |
| 12% | $11,600 – $47,150 | 1,160 – 4,715 |
| 22% | $47,150 – $100,525 | 4,715 – 10,052.50 |
| 24% | $100,525 – $191,950 | 10,052.50 – 19,195 |
| 32% | $191,950 – $243,725 | 19,195 – 24,372.50 |
| 35% | $243,725 – $609,350 | 24,372.50 – 60,935 |
| 37% | over $609,350 | over 60,935 |
| Standard deduction | $14,600 | 1,460 |

```
Gross income     = rent + shop sales + crop sales + prizes   (not the sales tax)
Taxable income   = gross − seeds − cost of goods sold − running costs − property tax − depreciation − standard deduction   (never below 0)
Income tax       = sum over brackets of (income in bracket × rate)
```

**Marginal vs. effective rate:** the *marginal* rate is the rate on your next
coin. The *effective* rate is your total income tax ÷ gross income. The Taxes
window shows both, plus a bar for each bracket your income reaches.

**Myth buster:** "If I earn more I'll move into a higher bracket and take home
less." False: only the coins *above* the threshold get the higher rate.
`taxRules.test.ts` proves it: going from 4,715 to 4,716 taxable coins costs
exactly 0.22 more.

## 6. Prizes (level-up rewards)

**Real rule:** prizes and awards are taxable income (IRC §74), whether it's a
contest prize, a game-show win or a raffle. They go on the return as "other
income".

**In the game:** the coins you get for reaching a level, finishing a quest or
handing in a collection are prize money. The county grant offered to a town
with nothing left that earns is taxable too: grants to a business are
generally income. They
appear on the return as "Prizes (level-up rewards)" and are part of gross
income, so they're taxed at your marginal rate like everything else. Reaching
level 10 pays 250 coins; at a 12% marginal rate, 30 of those go to income tax.

Event rewards are prizes too: coins for festival goals and weekly challenges,
and a festival's prize decoration. A prize that isn't cash is taxed at its
fair market value (Treas. Reg. §1.74-1), so the decoration counts as 300
coins of income the moment it's won, and those 300 coins are also its cost
basis: it depreciates like any decoration once it's on the map.

## 6b. Neighbors: pay for help vs. gifts

**Real rules:**

- Money you're paid for doing work is income, even a small, friendly amount.
- A **gift** isn't income to the person who receives it (IRC §102), and the
  giver can't deduct it either (only gifts to qualified charities are
  deductible). The person receiving a gifted item takes over the giver's
  basis in it.

**In the game:**

| What happens | Tax effect |
|---|---|
| A neighbor pays you 10 coins for helping | Taxable income ("other income") |
| A neighbor's daily gift of materials | Not income; the materials have no cost to you |
| You give a neighbor what they asked for, and they thank you with coins | Gifts both ways: no income for the coins, no deduction for the materials |

## 7. Paying late

**Real rule:** the IRS failure-to-pay penalty is 0.5% of the unpaid tax per
month, up to 25%, plus interest.

**Railroad track** is 7-year property under IRC §168(e)(3)(C)(i), far
shorter than the station building beside it (39 years), so in the game track
depreciates quickly while the station takes decades. An **airport** is mostly
runway, taxiways and aprons, which are land improvements (asset class 00.3,
15 years), so the game depreciates it over 15.

**Animal pens** are single-purpose livestock structures: 10-year property
(IRC §168(e)(3)(D)). Eggs, milk and wool sold count as **farm income**, like
crops. **Repairs** after a disaster keep a building in its normal working
condition, so they're deducted in full the year they're paid, unlike an
upgrade, which improves it and is depreciated (Treas. Reg. §1.263(a)-3).

An **army parade** is a running cost of the town's own (like utility
upkeep): it's paid in coins and recorded as an operating expense, so it's
deducted in full that year.

**In the game:** coins never go below zero. A bill bigger than the coins you
have takes them all, and the rest is owed (shown as "owe" beside your coins).
Income pays what's owed before it reaches your coins. Each month you're in debt, 0.5% of it (at least
1 coin) is added as a penalty. Penalties aren't deductible (they aren't in real
life either). Collecting income pays the debt down automatically, and you can't
build until you're back above the building's cost.

## Worked examples

All figures are for a full year with buildings owned all year and income
collected on time. You can reproduce them with `taxRules.ts`.

### A small town: 3 Cottages + 1 Bakery

```
Rent       3 × 360                         = 1,080
Sales      16 sales × 40                   =   640
Gross income                               = 1,720
− Property tax   3 × 27  +  48 (bakery)    =   129
− Depreciation   3 × 3.64  +  7.69         =    18.60
− Standard deduction                       = 1,460
Taxable income                             =   112.40
Income tax       112.40 × 10%              =    11.24
Paid on Tax Day  129 + 11                  =   140
Sales tax passed on   16 × 3               =    48   (customers' money, not yours)
Effective income tax rate  11.24 ÷ 1,720   =  0.65%
```

(Bakery: 40 every 45 s → 16 sales/yr → 640 gross. NOI 384 ÷ 8% = 4,800 value → 48 property tax.)

### A growing town: 10 Family Houses + 4 General Stores

```
Rent       10 × 400                        = 4,000
Sales       4 × 600                        = 2,400
Gross income                               = 6,400
− Property tax   10 × 30  +  4 × 45        =   480
− Depreciation   10 × 14.55  +  4 × 12.82  =   196.74
− Standard deduction                       = 1,460
Taxable income                             = 4,263.26
Income tax   1,160 × 10%                   =   116.00
           + 3,103.26 × 12%                =   372.39
                                           =   488.39
Paid on Tax Day  480 + 488                 =   968
Marginal rate 12%, effective rate 488.39 ÷ 6,400 = 7.63%
```

### A farming town: the small town plus 4 strawberry plots

The small town above, plus 4 farm plots of strawberries, replanted every
minute of play, so each plot is harvested 12 times in the 12-minute year.

```
Rent and shop sales (as above)             = 1,720
Crop sales   48 harvests × 40              = 1,920
Gross income                               = 3,640
− Seeds          48 × 10                   =   480
− Property tax   129  +  4 × 0.50 (plots)  =   131
− Depreciation   (as above; plots: none)   =    18.60
− Standard deduction                       = 1,460
Taxable income                             = 1,550.40
Income tax   1,160 × 10%                   =   116.00
           +   390.40 × 12%                =    46.85
                                           =   162.85
Paid on Tax Day  131 + 163                 =   294
Marginal rate 12%, effective rate 162.85 ÷ 3,640 = 4.47%
```

(A plot is land with no income of its own, so it's valued at its cost: 50 × 1% = 0.50 a year.)

## What the game simplifies

Real taxes have far more rules. These are left out on purpose, and some may
come in later stages:

- **Self-employment tax.** Real sole proprietors and farmers also pay 15.3% Social Security and Medicare tax on business and farm profit (not on rental income).
- **Estimated payments.** Real self-employed people pay income tax quarterly during the year and are penalized for underpaying; the game collects it all on Tax Day.
- **State and local income tax.** Most states have one; the game only has the federal-style tax.
- **Operating expenses.** The 40% expense ratio is only used to value property; you don't actually pay or deduct those costs. Stage 8 adds real costs (goods for shops), which become deductible as cost of goods sold.
- **Passive activity loss rules**, which limit rental losses against other income, and **depreciation recapture** on sale. You can't sell buildings in the game.
- **Interest on unpaid tax and the 25% penalty cap.** The game only charges the 0.5% monthly penalty.
- **Inventory methods.** Real businesses can choose FIFO, LIFO or average cost; the game uses average cost. Large businesses must also add some overhead into inventory cost (the "uniform capitalization" rules); small ones are exempt.
- **Utility bills.** Real towns charge residents for water, power and trash, which would be income for a town that owns the plants. In the game you own every building, so the plants are pure costs.
- **Mid-month convention for land.** Land tax accrues for the full month a lot is bought.
- **Farmland assessment.** Many states value farmland at what it earns farming ("current use" or "use-value" assessment), usually below market value. The game values a plot at what it cost.
- **Prepaid farm supplies.** Real cash-method farmers can't deduct seed bought far ahead beyond a limit; in the game you always plant right away.
- **Property reassessment.** Real assessed values are updated every few years and follow the market; game values are fixed by building type.
- **Rounding.** The IRS lets you round to whole dollars on the return; the game rounds each payment to whole coins.
