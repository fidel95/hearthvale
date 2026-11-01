# Data model

Hearthvale keeps two kinds of data apart:

- **Definitions** describe a *kind* of thing: what a Cottage costs, how big
  it is, what it earns. They're plain data in the catalogs (`buildings.ts`,
  `crops.ts`, `items.ts`, `collections.ts`, `quests.ts`) and are never saved.
- **Instances** are the things in *your* town: this cottage, here, turned this
  way, last collected at 3:02. They live in the game state (`City`, `Player`,
  `Inventory`, …) and are what the save file holds.

An instance points at its definition by id. That's why adding a building is
only data: the build menu, placement, income, taxes, the worksheet and the
save file all work from the definition. Nothing in the interface names an
individual building.

## Building definitions (`BuildingType`, buildings.ts)

| Field | Meaning | Example (Bakery) |
|---|---|---|
| `id` | Unique key, used by saves and quests | `'bakery'` |
| `name` | Shown to the player | `'Bakery'` |
| `category` | `home`, `business`, `farm`, `decoration`, `utility`, `community`, `road`, `storage`, `port`: decides the tab, the rules that apply, and how it's taxed | `'business'` |
| `size` | Footprint in tiles, `{ x, z }` (width × depth) | `{ x: 2, z: 2 }` |
| `cost` | Purchase cost in coins | `300` |
| `unlockLevel` | Player level that unlocks it | `2` |
| `income` | `{ coins, seconds }`: what one production cycle pays and how long it takes | `{ coins: 40, seconds: 45 }` |
| `goodsPerSale` | Goods a shop uses per sale | `4` |
| `stockCapacity` | Goods its shelves hold | `40` |
| `xpReward` | XP for building it (optional; otherwise 1 per 20 coins) | — |
| `build` | Construction time and materials (optional: without it, it's ready at once) | — |
| `residents` | People living there (homes) | — |
| `needs` | Water, power and trash it uses | `{ water: 2, power: 3, trash: 2 }` |
| `supplies`, `upkeep` | Utility it provides; coins a month to run | — |
| `amenity` | Income bonus for homes and shops nearby, and its radius | — |
| `populationCapacity` | Room for more residents in town | — |
| `attractsVisitors` | Walkers visit and linger | — |
| `storage` | Goods it adds to town storage | — |
| `factory` | A batch: goods (`input`) or a farm workshop's `recipe` of products in, `output` of a `product` out, every `seconds` | — |
| `produce` | Pens and orchards: farm products each collection puts in storage, `{ product, units }` | — |
| `onShore` | Must be built by the sea | — |
| `recoveryYears` | Depreciation period, if not its category's | — |
| `model`, `placeholder` | How to draw it | — |

Crops (`CropType`, crops.ts) follow the same idea: `seedCost`, `growSeconds`,
`sellPrice`, `goods`, `freshSeconds`, `xp`, `unlockLevel`, and a `look`;
wheat and grapes also have `produce` (farm products the harvest gives).
Products (products.ts) are factory products and farm products, with a
Farmers' Market `price` for farm ones.

## Placed buildings (`PlacedBuilding`, City.ts)

| Field | Meaning | Why it's stored this way |
|---|---|---|
| `id` | Instance id, unique in the town | A number from a counter (`nextId`); simple and cheap to compare |
| `type` | The definition (saved as `typeId`) | Saves store the id, so changing a definition updates every saved town |
| `tile` | Lowest corner of its footprint, `{ x, z }` | |
| `rotation` | Quarter turns, 0–3 | Turned 1 or 3, the footprint's width and depth swap (`footprint()`) |
| `construction` | `{ endsAt }` while being built, else `null` | A **timestamp**, not a progress number: progress = time passed ÷ build time, so building continues while the game is closed and there's nothing to update every frame |
| `readyAt` | When the next income is ready | Also a timestamp, for the same reason. The cycle started at `readyAt − income.seconds` |
| `lastCollectedAt` | When income was last collected, or `null` | For display and stats |
| `stock` | Goods on a shop's shelves | |
| `level` | 1–3, from upgrades | |
| `crop` | Farm plots: `{ cropId, plantedAt }` or `null` | The crop's stage is worked out from `plantedAt` |
| *stored* | (save only) the building is in the inventory, not on the map | Same object and id when it comes back, so its tax record survives |

Other instance data follows the same rules: owned land is `{ x, z, price }`
per lot; a shipment is `{ dockId, units, cost, orderedAt, arrivesAt }`;
inventory items are `{ count, cost }` stacks.

## The save file (version 3)

One JSON document in `localStorage` under `hearthvale.save`
(`SaveData` in save.ts):

```jsonc
{
  "version": 3,
  "savedAt": 1793284644137,                 // the most recent save
  "player": { "xp": 52, "level": 3, "energy": 9, "energyAt": 1793284600000 },
  "resources": { "coins": 1505, "goods": 40, "products": { "eggs": 6, "bread": 2, … } },
  "population": { "current": 12, "capacity": 40 },  // worked out on load; here for readability
  "land": { "parcels": [{ "x": 2, "z": 2, "price": 250 }, …] },
  "buildings": {
    "nextId": 7,
    "list": [
      { "id": 6, "typeId": "cottage", "tile": { "x": 23, "z": 29 }, "rotation": 1,
        "readyAt": 1793284675484, "lastCollectedAt": null, "crop": null,
        "level": 1, "stock": 0, "construction": null },
      { "id": 2, "typeId": "farm-plot", …, "crop": { "cropId": "wheat", "plantedAt": 1793284000000 } },
      { "id": 4, "typeId": "barn", …, "stored": true }
    ]
  },
  "quests": {                                // completed quests and active quest progress
    "claimed": ["welcome"],
    "active": [["growing", { "plantings": 2 }]],   // each quest's stats when it started
    "stats": { "rent": 14, "harvests": 3, … },
    "tiers": [["landlord", 1]]               // achievements
  },
  "inventory": {                             // materials and collected items
    "items": [["bricks", { "count": 6, "cost": 90 }], ["teddy-bear", { "count": 1, "cost": 0 }]],
    "collections": [["home", 1]]             // times each set was completed
  },
  "shipments": [],
  "taxes": { "ledger": { … }, "inventory": { … }, "assets": [ … ], … },
  "calendar": { "playedMs": 812345 },
  "settings": { "showGrid": true, "showPeople": true, "confirmPurchases": true, "reduceMotion": false },
  "tutorial": { "step": 6, "skipped": false },
  "safetyNet": { "lastGrantAt": null },
  "neighbors": [["rosa", { "friendship": 6, "day": "2026-10-29", "helped": ["25,25"], "giftClaimed": true, "requestDone": false }]],
  "market": {                                // the Farmers' Market (optional: added with the market)
    "orders": [{ "items": { "eggs": 8, "milk": 3 }, "coins": 144, "xp": 12 }, null, …],
    "nextAt": [0, 1793284700000, 0]          // when each empty slot gets a new order
  },
  "wilds": {                                 // trees and rocks on the town's land (optional: added with them)
    "list": [[34, 27, "tree"], [41, 22, "rock"]], // x, z, kind (tree, pine, rock, bush or stump)
    "nextGrowAt": 1793286500000              // when the next one springs up
  }
}
```

### What's derived, and why it's still saved

`player.level` comes from XP, and `population` from the buildings. The game
recalculates both on load; they're saved only so the file makes sense on its
own (and to tools reading it). Keeping one source of truth means a save edited
by hand can't disagree with itself.

### Versions

`upgradeSave` brings older saves up to date one step at a time:

| From | To | What changes |
|---|---|---|
| 1 (Stages 0–5) | 2 | Buildings move to the middle of the bigger world; starting land added |
| 2 (Stages 5.5–9.5) | 3 | Regrouped into the sections above; settings and tutorial added (returning players skip the tutorial); towns without an inventory get the starting materials |

Fields added since without changing the version (`rotation`,
`lastCollectedAt`, `neighbors`, …) get defaults when missing.

Neighbors' towns aren't saved at all: they're generated from each neighbor's
seed and level whenever you visit.

## Adding a building

1. Add an entry to `BUILDING_TYPES` with at least `id`, `name`, `category`,
   `size`, `cost`, `unlockLevel` and a `placeholder` (or a `model`).
2. Give it the fields for what it does (`income`, `residents`, `amenity`, …).
3. Run `npm test` (the balance tests check it against the principles in
   [BALANCE.md](BALANCE.md)) and `npm run balance` to see it in the worksheet.

No interface code changes: the build menu card, its picture, the details
sheet, placement, the map, taxes and saving all follow from the definition.
