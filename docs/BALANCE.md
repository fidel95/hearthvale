# Game balance and progression

How Hearthvale is balanced: the principles it follows, the numbers behind
every building and crop, and the tests that keep them honest.

- The **principles** below are design rules, each with what the game does to
  meet it and the test in `src/game/balance.test.ts` that checks it.
- The **worksheet** further down is generated from the game's catalogs by
  `npm run balance` (code in `src/game/balance.ts`), so it always matches the
  game. The same data is in [`balance.json`](balance.json), and as CSV for a
  spreadsheet: [`balance-buildings.csv`](balance-buildings.csv) and
  [`balance-crops.csv`](balance-crops.csv).

After changing any price, timer or unlock level: run `npm test` (the balance
tests may fail and tell you which principle broke) and `npm run balance`
(to refresh the worksheet).

## Principles

### 1. Early actions are quick and rewarding

- Level 1 buildings and crops produce within a minute (Cottage 30 s,
  Strawberries 1 min) and pay back within a few minutes.
- The first levels come fast: level 2 at 10 XP, a cottage gives 5 XP to build
  and 1 per collection, and the first quest is three collections and a harvest.
- Level-ups refill energy, and they're frequent early on.
- **Tested:** level-1 cycles ≤ 1 minute; early earners pay back within 15
  minutes; the first quest's tasks can be done with the starting town.

### 2. Nobody gets stuck for good

Every shortage in the game recovers on its own or has a way out:

| Shortage | Way out |
|---|---|
| Energy | Refills 1 a minute, in real time, and on every level-up |
| Coins | Homes keep paying rent; nothing costs coins to keep (except plants you chose to build) |
| Tax debt | Income pays it down; the penalty is 0.5% a month |
| Utilities | A shortage lowers income but never to zero: the county always supplies some |
| Materials | Always for sale for coins (Inventory, or from the building's details) |
| Goods | Harvests (seeds cost coins), or a shipment at a dock |
| **Nothing that earns and too few coins to build one** | **The county grant** (`safetyNet.ts`): if nothing on the map or in storage earns, and you can't afford a Cottage, the county offers 150 coins, at most once an hour. It's taxable, like any grant to a business. |

- **Tested:** every material has a price; the county supplies every utility;
  a town with no earners and no coins can claim the grant, and a working town
  can't.

### 3. One new mechanic per level

Each level from 2 up introduces at most one new mechanic, with a quest that
introduces it:

| Level | Mechanic | Introduced by |
|---|---|---|
| 1 | Homes, farming, roads, decorations (the starting kit) | Welcome to Hearthvale, A Growing Town, Paving the Way |
| 2 | Shops and goods | Open for Business |
| 3 | Construction and materials | Master Builder |
| 4 | Utilities | Keep the Taps Running |
| 5 | Storage | Room for the Harvest |
| 6 | Community bonuses | Community Spirit |
| 7 | Neighbors (visiting, helping, gifts) | Good Neighbors |
| 8 | Land expansion | Room to Grow |
| 9 | Shipping | Harbor Town |
| 10 | Upgrades | Renovator |

New crops and bigger versions of things you already know (a Family House, a
School) aren't new mechanics; they arrive at the levels in between and after.

- **Tested:** `mechanicsByLevel()` has at most one entry per level from 2 up.

### 4. Bigger buildings are meaningful goals

Within each kind, a later building costs more, takes longer to pay back, and
pays more per collection (more coins for the same energy):

| Home | Level | Cost | Per collection |
|---|---|---|---|
| Cottage | 1 | 100 | 15 |
| Townhouse | 3 | 250 + materials | 35 |
| Family House | 6 | 400 + materials | 50 |
| Modern House | 11 | 600 + materials | 80 |

Stage 10 filled in the gaps: homes now run Cottage (1), Bungalow (2),
Townhouse (3), Duplex (5), Family House (6), Eco House (8), Villa (9), Modern
House (11), Manor (12); shops run Bakery (2), Café (4), Flower Shop (6),
General Store (8), Restaurant (10), Supermarket (12). Each step costs more and
pays more per collection than the one before.

- **Tested:** within homes and within shops, coins per collection rise with
  unlock level, and so does the total cost.

**Decorations** give homes and shops right around them a small bonus (+1% to
+8%), but all decorations together count for at most **+10%**, on top of
community buildings and roads, within the overall +40% cap. Without that
separate cap a ring of 20-coin trees would beat a 900-coin school.
**Tested** in `communityRules.test.ts`.

### 5. Timers fit the play session

| Stage | Timers | Built for |
|---|---|---|
| Early (levels 1–3) | 30 s – 5 min | A first session: something to tap every few seconds |
| Middle (4–7) | 1 – 20 min, constructions 1–3 min | Short sessions, a few times a day |
| Late (8+) | 1 h – 8 h crops, 5-min shipments | Coming back later: plant before you leave |

- Every crop stays fresh at least as long as it took to grow, so a crop
  planted before a break survives a break of the same length.
- **Tested:** early cycles ≤ 5 minutes; fresh windows ≥ grow times; nothing
  takes longer than 8 hours.

### 6. Idle progress never needs the game open

Every timer is a timestamp (income, crops, construction, shipments, energy),
so the town is up to date the moment it loads, with nothing simulated. The
calendar (taxes, running costs) runs on play time, so being away never costs
anything. See [ARCHITECTURE.md](ARCHITECTURE.md#two-kinds-of-time).

### 7. No pay-to-win

There's no real money anywhere. Everything that can be bought (materials,
shipments, land, buildings) is bought with coins earned in the game, and
nothing can skip a timer.

## What changed in the balance pass

The first version of this worksheet showed several problems:

| Problem | Fix |
|---|---|
| Level 2 unlocked shops, utilities and storage at once, and the Bakery needed construction too | The unlock schedule above; the Bakery is built instantly |
| Utility shortages started around level 2–3, before plants were affordable | The county supplies more (water 20, power 16, trash 16), so shortages start around level 4, when plants unlock |
| Three cottages used energy 12× faster than it refilled | Energy refills 1 a minute (was 1 per 2), and the bar starts at 20 (was 15) |
| A town with no earners and no coins was stuck forever | The county grant |
| Upgrades came at level 3, crowded in with construction | Upgrades start at level 7 (★★) and 10 (★★★) |
| Land could be bought at level 2 | The first lot needs level 8; the starting land holds a town until then |

## Worksheet

<!-- generated:start -->

_Generated by `npm run balance` from the game's catalogs. Assumptions: income collected as soon as it's ready, full utilities, no location bonus, before tax; a shop's goods valued at 5 coins each (the cheapest shipment); shops get 10 per good._

### Levels and what each one introduces

| Level | Total XP | New mechanic | Unlocks | Quests needing this level |
|---|---|---|---|---|
| 1 | 0 | homes, farming, decorations, roads | Cottage, Farm Plot, Oak Tree, Pine Tree, Road, 🍓 Strawberries | Welcome to Hearthvale, A Growing Town, Paving the Way, Treasure Hunter, Good Citizen |
| 2 | 10 | shops | Bungalow, Bakery, Tall Pine, Stone Pile, Flower Bed, Stone Path, 🌾 Wheat | Open for Business, Green Thumb |
| 3 | 30 | construction | Townhouse, Planter, Chicken Coop | Master Builder |
| 4 | 60 | utilities | Café, Boulders, Picket Fence, Water Tower, Power Plant, Recycling Center | Keep the Taps Running |
| 5 | 100 | storage | Duplex, Bench, Barn, Pig Pen, 🎃 Pumpkins | Room for the Harvest, Down on the Farm |
| 6 | 150 | community | Family House, Flower Shop, Park, Playground | Community Spirit |
| 7 | 210 | neighbors | Fountain, Library, Bus Stop, Sheep Meadow, 🌽 Corn | Good Neighbors, All Aboard the Bus |
| 8 | 280 | land | Eco House, General Store, Sports Field | Room to Grow, Tycoon |
| 9 | 360 | shipping | Villa, Dock, Fire Station, Public Beach, Cow Pasture, 🌻 Sunflowers | Harbor Town, Fun in the Sun |
| 10 | 450 | upgrades | Restaurant, Statue, Warehouse, School, 🥔 Potatoes | Renovator |
| 11 | 550 | landmarks | Modern House, Solar Farm, Clock Tower, Central Park | A Town to Be Proud Of |
| 12 | 660 | — | Manor, Supermarket, Town Hall, Lighthouse, Army Base | — |

### Buildings that earn

| Building | Role | Level | Size | Cost | Materials | Build | Cycle | Per cycle | Goods | Net | XP | Residents | Payback | Coins/min | Upgrades | Quests |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Bakery | early | 2 | 2×2 | 300 | — | instant | 0.8 min | 40 | 4 | 20 | 3 (+15 to build) | — | 15 cycles · 11.3 min | 26.7 | ★★ at level 10, ★★★ at 12 | Open for Business |
| Café | middle | 4 | 2×2 | 380 | 🧱 2 🪵 2 (54) | 1 min | 1 min | 52 | 5 | 27 | 3 (+26 to build) | — | 16.1 cycles · 17.1 min | 27 | ★★ at level 10, ★★★ at 12 | — |
| Flower Shop | middle | 6 | 2×2 | 450 | 🪵 3 🪟 2 (76) | 1.5 min | 1.3 min | 62 | 6 | 32 | 4 (+31 to build) | — | 16.4 cycles · 22.0 min | 25.6 | ★★ at level 10, ★★★ at 12 | — |
| General Store | late | 8 | 3×2 | 500 | 🪵 4 🪟 2 (88) | 2 min | 1.5 min | 75 | 7 | 40 | 5 (+35 to build) | — | 14.7 cycles · 24.1 min | 26.7 | ★★ at level 10, ★★★ at 12 | — |
| Restaurant | late | 10 | 3×2 | 700 | 🧱 6 🪟 3 🔩 1 (175) | 3 min | 2 min | 110 | 10 | 60 | 7 (+49 to build) | — | 14.6 cycles · 32.2 min | 30 | ★★ at level 12, ★★★ at 14 | — |
| Supermarket | late | 12 | 3×3 | 1,100 | 🧱 6 🪟 6 🔩 6 (360) | 5 min | 2.5 min | 160 | 14 | 90 | 11 (+77 to build) | — | 16.2 cycles · 45.6 min | 36 | ★★ at level 14, ★★★ at 16 | — |
| Ski Resort | late | 13 | 4×4 | 3,500 | 🪵 10 🔩 8 (320) | 5 min | 5 min | 260 | — | 260 | 17 (+245 to build) | — | 14.7 cycles · 78.5 min | 52 | ★★ at level 15, ★★★ at 17 | Hit the Slopes |
| Chicken Coop | early | 3 | 2×2 | 220 | — | instant | 0.8 min | 22 | — | 22 | 1 (+11 to build) | — | 10 cycles · 7.5 min | 29.3 | — | Down on the Farm |
| Pig Pen | middle | 5 | 2×2 | 420 | — | instant | 1.2 min | 38 | — | 38 | 3 (+21 to build) | — | 11.1 cycles · 12.9 min | 32.6 | — | Down on the Farm |
| Sheep Meadow | middle | 7 | 3×2 | 650 | — | instant | 1.5 min | 58 | — | 58 | 4 (+32 to build) | — | 11.2 cycles · 16.8 min | 38.7 | — | — |
| Cow Pasture | late | 9 | 3×3 | 950 | — | instant | 2 min | 92 | — | 92 | 6 (+47 to build) | — | 10.3 cycles · 20.7 min | 46 | — | — |
| Cottage | early | 1 | 2×2 | 100 | — | instant | 0.5 min | 15 | — | 15 | 1 (+5 to build) | 2 | 6.7 cycles · 3.3 min | 30 | ★★ at level 10, ★★★ at 12 | — |
| Bungalow | early | 2 | 2×2 | 180 | — | instant | 0.8 min | 24 | — | 24 | 2 (+9 to build) | 2 | 7.5 cycles · 5.6 min | 32 | ★★ at level 10, ★★★ at 12 | — |
| Townhouse | early | 3 | 2×2 | 250 | 🪵 3 (36) | 1 min | 1 min | 35 | — | 35 | 2 (+17 to build) | 3 | 8.2 cycles · 9.2 min | 35 | ★★ at level 10, ★★★ at 12 | Master Builder |
| Duplex | middle | 5 | 2×2 | 330 | 🧱 3 🪵 3 (81) | 1.5 min | 1.3 min | 42 | — | 42 | 3 (+22 to build) | 4 | 9.8 cycles · 13.7 min | 33.6 | ★★ at level 10, ★★★ at 12 | — |
| Family House | middle | 6 | 2×2 | 400 | 🧱 4 🪵 4 (108) | 2 min | 1.5 min | 50 | — | 50 | 3 (+28 to build) | 4 | 10.2 cycles · 17.2 min | 33.3 | ★★ at level 10, ★★★ at 12 | — |
| Eco House | late | 8 | 2×2 | 480 | 🪟 4 🔩 2 (130) | 2 min | 1.7 min | 60 | — | 60 | 4 (+33 to build) | 4 | 10.2 cycles · 18.9 min | 36 | ★★ at level 10, ★★★ at 12 | — |
| Villa | late | 9 | 2×2 | 560 | 🧱 4 🪵 4 🪟 3 (168) | 2.5 min | 1.8 min | 70 | — | 70 | 5 (+39 to build) | 5 | 10.4 cycles · 21.6 min | 38.2 | ★★ at level 11, ★★★ at 13 | — |
| Modern House | late | 11 | 2×2 | 600 | 🧱 4 🪟 4 🔩 2 (190) | 3 min | 2 min | 80 | — | 80 | 5 (+42 to build) | 4 | 9.9 cycles · 22.8 min | 40 | ★★ at level 13, ★★★ at 15 | — |
| Manor | late | 12 | 2×2 | 900 | 🧱 8 🪟 6 🔩 2 (290) | 4 min | 3 min | 120 | — | 120 | 8 (+63 to build) | 6 | 9.9 cycles · 33.8 min | 40 | ★★ at level 14, ★★★ at 16 | — |

Payback cycles = (coins + materials) ÷ net coins per cycle. Payback minutes adds the build time. No building needs a road; homes and shops beside one earn +5%.

### Buildings that support the town

| Building | Role | Level | Size | Cost | Materials | Build | Effect | Uses | Runs per month | XP to build | Quests |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Airport | late | 15 | 7×3 | 8,000 | 🧱 10 🪟 6 🔩 12 (570) | 6 min | — | 💧3 🔌5 🗑️3 | 60 | 560 | Cleared for Takeoff |
| Park | middle | 6 | 2×2 | 200 | 🪵 3 (36) | 1 min | +10% within 4 tiles | 💧1 | 5 | 14 | Community Spirit |
| Playground | middle | 6 | 2×2 | 250 | — | instant | +6% within 3 tiles | — | 4 | 12 | Fun in the Sun |
| Library | middle | 7 | 2×2 | 500 | 🧱 6 🪵 4 (138) | 2 min | +5% within 8 tiles | 💧1 🔌2 🗑️1 | 10 | 35 | — |
| Bus Stop | middle | 7 | 1×1 | 150 | — | instant | +4% within 4 tiles | — | 3 | 7 | — |
| Sports Field | late | 8 | 3×2 | 650 | 🪵 4 (48) | 1.5 min | +8% within 5 tiles | 💧2 | 10 | 45 | — |
| Fire Station | late | 9 | 2×2 | 600 | 🧱 8 🔩 2 (170) | 3 min | +10% within 6 tiles | 💧2 🔌2 🗑️1 | 20 | 42 | — |
| Public Beach | late | 9 | 3×2 | 400 | — | instant | +8% within 5 tiles | — | 8 | 20 | Fun in the Sun |
| School | late | 10 | 3×2 | 900 | 🧱 10 🪵 6 🪟 4 (302) | 4 min | +15% within 6 tiles | 💧3 🔌3 🗑️2 | 30 | 63 | — |
| Central Park | late | 11 | 4×4 | 1,800 | 🧱 4 🪵 8 (156) | 3 min | +12% within 7 tiles | 💧3 | 25 | 126 | — |
| Town Hall | late | 12 | 3×3 | 1,500 | 🧱 12 🪟 6 🔩 4 (400) | 5 min | +5% within 12 tiles | 💧3 🔌4 🗑️2 | 40 | 105 | — |
| Army Base | late | 12 | 3×3 | 2,500 | 🧱 8 🔩 6 (270) | 4 min | +5% within 6 tiles | 💧3 🔌3 🗑️2 | 40 | 175 | — |
| Oak Tree | early | 1 | 1×1 | 20 | — | instant | +2% within 1 tiles; looks nice | — | — | 1 | — |
| Pine Tree | early | 1 | 1×1 | 15 | — | instant | +1% within 1 tiles; looks nice | — | — | 0 | — |
| Tall Pine | early | 2 | 1×1 | 25 | — | instant | +2% within 1 tiles; looks nice | — | — | 1 | — |
| Stone Pile | early | 2 | 1×1 | 15 | — | instant | +1% within 1 tiles; looks nice | — | — | 0 | — |
| Flower Bed | early | 2 | 1×1 | 25 | — | instant | +2% within 1 tiles; looks nice | — | — | 1 | — |
| Stone Path | early | 2 | 1×1 | 15 | — | instant | +1% within 0 tiles; looks nice | — | — | 0 | — |
| Planter | early | 3 | 1×1 | 30 | — | instant | +3% within 1 tiles; looks nice | — | — | 1 | — |
| Boulders | middle | 4 | 1×1 | 40 | — | instant | +3% within 1 tiles; looks nice | — | — | 2 | — |
| Picket Fence | middle | 4 | 1×2 | 20 | — | instant | +1% within 1 tiles; looks nice | — | — | 1 | — |
| Bench | middle | 5 | 1×1 | 40 | — | instant | +3% within 2 tiles; looks nice | — | — | 2 | — |
| Fountain | middle | 7 | 2×2 | 250 | — | instant | +6% within 3 tiles; looks nice | — | — | 12 | — |
| Statue | late | 10 | 1×1 | 400 | — | instant | +8% within 4 tiles; looks nice | — | — | 20 | — |
| Farm Plot | early | 1 | 2×2 | 50 | — | instant | grows crops | 💧2 | — | 2 | — |
| Clock Tower | late | 11 | 2×2 | 3,000 | 🧱 15 🪟 4 🔩 6 (455) | 5 min | — | — | — | 210 | — |
| Lighthouse | late | 12 | 2×2 | 4,000 | 🧱 12 🪟 10 🔩 6 (530) | 6 min | — | — | — | 280 | — |
| Botanical Garden | late | 13 | 3×3 | 5,000 | 🪵 12 🪟 16 🔩 4 (564) | 7 min | — | — | — | 350 | — |
| Dock | late | 9 | 3×2 | 800 | 🪵 10 🔩 4 (220) | 3 min | stores 📦 100 | 🔌1 🗑️1 | 10 | 56 | Harbor Town |
| Railway Track | late | 14 | 1×1 | 20 | — | instant | — | — | — | 0 | — |
| Train Station | late | 14 | 3×2 | 3,000 | 🧱 10 🪟 4 🔩 8 (430) | 5 min | — | 💧2 🔌3 🗑️2 | 30 | 210 | The Railway Comes to Town |
| Road | early | 1 | 1×1 | 10 | — | instant | +5% for homes and shops beside it | — | — | 0 | — |
| Barn | middle | 5 | 2×2 | 150 | 🪵 6 (72) | 1 min | stores 📦 150 | — | — | 10 | Room for the Harvest |
| Warehouse | late | 10 | 3×2 | 500 | 🪵 4 🔩 6 (198) | 3 min | stores 📦 400 | 🔌1 | — | 35 | — |
| Water Tower | middle | 4 | 2×2 | 250 | 🔩 4 (100) | 1.5 min | supplies 💧 20 | — | 15 | 17 | Keep the Taps Running |
| Power Plant | middle | 4 | 3×2 | 500 | 🧱 4 🔩 6 (210) | 3 min | supplies 🔌 30 | — | 30 | 35 | — |
| Recycling Center | middle | 4 | 2×2 | 300 | 🧱 3 🔩 3 (120) | 2 min | supplies 🗑️ 20 | — | 20 | 21 | — |
| Solar Farm | late | 11 | 3×3 | 1,200 | 🪟 8 🔩 4 (260) | 4 min | supplies 🔌 25 | — | 5 | 84 | — |

### Crops

| Crop | Role | Level | Seeds | Grows | Fresh for | Market price | Or goods | Profit | Profit/min | XP | Coins/energy | Plot paid back in |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Strawberries | early | 1 | 10 | 1 min | 3 min | 40 | 📦 6 (worth 60 in shops) | 30 | 30 | 1 | 15 | 1.67 harvests |
| Wheat | early | 2 | 15 | 5 min | 15 min | 120 | 📦 18 (worth 180 in shops) | 105 | 21 | 2 | 52.5 | 0.48 harvests |
| Pumpkins | middle | 5 | 30 | 20 min | 1 h | 360 | 📦 54 (worth 540 in shops) | 330 | 16.5 | 4 | 165 | 0.15 harvests |
| Corn | middle | 7 | 40 | 1 h | 3 h | 750 | 📦 110 (worth 1,100 in shops) | 710 | 11.8 | 7 | 355 | 0.07 harvests |
| Sunflowers | late | 9 | 60 | 4 h | 8 h | 2,000 | 📦 300 (worth 3,000 in shops) | 1,940 | 8.1 | 12 | 970 | 0.03 harvests |
| Potatoes | late | 10 | 80 | 8 h | 16 h | 3,000 | 📦 450 (worth 4,500 in shops) | 2,920 | 6.1 | 16 | 1,460 | 0.02 harvests |

### Energy

A full bar at level 1 is 20 ⚡ and refills 1 a minute. Collecting from three cottages and tending a strawberry plot uses about 7 a minute, so a full bar lasts about 3.3 minutes of nonstop tapping, and early level-ups refill it.

<!-- generated:end -->
