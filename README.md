# Hearthvale

A cozy isometric city-builder in the style of the 2010s social city games:
place homes and shops, collect rent and sales on timers, plant and harvest
crops, level up to unlock more, buy land to expand, keep the water, power
and trash services running, watch your residents walk around town, and deal
with taxes modeled on the real thing. It runs entirely in the browser.
There are no accounts or servers, and progress is saved on your device.

It's also a learning project. The code is written to be read: comments explain
the *why*, each system lives in its own file, and the docs walk through the
ideas behind them.

| Doc | What's in it |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the code fits together: state vs. views, events, the frame loop, saving |
| [docs/TAXES.md](docs/TAXES.md) | The tax system: each tax, the real rule behind it, worked examples, simplifications |
| [docs/LEARNING.md](docs/LEARNING.md) | Stage-by-stage journal of the concepts each part teaches, with exercises |

## Running it

You need [Node.js](https://nodejs.org) (the version is pinned in `.nvmrc`).

```sh
nvm use          # or install the version in .nvmrc
npm install
npm run dev      # then open http://localhost:5173
```

| Command | Does |
|---|---|
| `npm run dev` | Development server with instant reload |
| `npm test` | Unit tests for the game rules (Vitest) |
| `npm run test:watch` | Re-run tests as you edit |
| `npm run typecheck` | TypeScript type check |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |

**Development tip:** add `?speed=60` to the URL (`http://localhost:5173/?speed=60`)
to make each in-game month last one second, so you can watch a whole tax year in
12 seconds. It only works in development.

## How to play

The screen is built around the city: a slim bar of stats along the top, a
toolbar along the bottom, and menus that slide up from the bottom (or in from
the right on a wide screen) so the town stays in view.

| | |
|---|---|
| **Top bar** | 🪙 coins (tap: Taxes) · 📦 goods (tap: Inventory) · 👥 population (tap: Town services) · ⚡ energy · ⭐ level (tap: Quests) · 📅 date (tap: Taxes) · ⚙️ settings |
| **Toolbar** | 🔨 Build · 📜 Quests · 🎒 Inventory · 🏆 Collections · 🗺️ Map |
| **Bubbles** | 🪙 rent or sales ready · 🧺 crop ripe · 🌱 plot empty · 📦 shop out of stock · 🔨 construction ready to finish · 🚢 ship waiting |

| Action | Mouse | Touch |
|---|---|---|
| Pan / zoom | Drag / scroll wheel | Drag / pinch |
| Collect, harvest, restock, finish, unload | Click the building or its bubble | Tap |
| Select a building (context menu) | Click it when it has nothing ready | Tap |
| Draw roads | Drag with Road selected | Drag |
| Close a menu | Esc, ✕, or click the map | ✕ or tap the map |

### The screens

- **Build:** tabs for homes, businesses, community, farms, roads and decor. Each card shows a picture, price, size and what it earns; locked ones say which level unlocks them, and ones you can't afford say how much more you need. Pick a card to preview everything about it, press **Place**, tap the map, then ✓ to buy (✕ to try elsewhere). Roads are drawn by dragging.
- **Context menu:** tap a building to select it: its name, what it's doing, and **Details**, **Move**, **Store** and **Remove**.
- **Building details:** status; a progress bar for production, a growing crop, construction or a ship; the shop's stock; location and utility effects; its value and property tax; and actions: Collect, Restock, Finish, Upgrade, Move, Store, Remove.
- **Quests:** active quests with task progress and rewards, what's coming next and why it's locked, your level and what the next levels unlock, achievements with three stars each, and finished quests. A red badge on Quests means a reward is waiting.
- **Inventory:** stored buildings (place them again, free), construction materials (with a Buy button), goods and shop shelves, and collectibles.
- **Collections:** five sets of five items. Items turn up while you collect rent, sell, harvest, unload ships and finish buildings. Hand in a full set for coins, XP and energy, as often as you complete it.
- **Map:** the whole world at the game's angle. Tap to jump there; tap a lot for sale to buy it.
- **Town services and Taxes:** tap 👥 or 🪙 in the top bar.

### The systems

- **Construction:** bigger buildings start as a construction site with a timer, then need materials (🧱 bricks, 🪵 lumber, 🪟 glass, 🔩 steel) to finish. You start with a few; buy more in Inventory, or right from the building's details.
- **Shops and stock:** shops sell from their own shelves (the Bakery holds 40 goods, 4 per sale). Tap an out-of-stock shop, or press Restock, to fill its shelves from town storage.
- **Upgrades:** homes and shops go up to ★★★: +50% and then +100% income, residents and shelf space, for coins, materials and a player level.
- **Storing:** put a building away in your Inventory and place it again later for free. While stored it pays no property tax and isn't depreciated.
- **Levels and XP:** building, collecting, harvesting, finishing and upgrading earn XP (⭐). Each level pays a reward, refills energy, raises its maximum and unlocks more.
- **Energy (⚡):** collecting, harvesting, planting, clearing and unloading use 1. It refills by 1 every 2 minutes in real time, even while the game is closed.
- **Farming:** tap an empty plot (🌱) to choose seeds. Crops sprout, grow and ripen; harvest before they wither (🥀). Quick crops earn the most per minute; slow ones can be left overnight.
- **Goods and storage (📦):** once you have a shop, harvests go into storage as goods; what doesn't fit is sold at the market. A Barn, Warehouse or Dock adds space.
- **Land and the coast:** the world is 60×60 tiles in 10×10 lots, with the sea along the south. Tap a 🏷️ sign (or a lot on the Map) to buy the land next to yours.
- **Docks and shipping:** build a Dock on the shore, order a coastal freighter or a container ship, and unload it (🚢) when it arrives.
- **Utilities:** homes, shops and farms use 💧 water, 🔌 electricity and 🗑️ trash pickup. Beyond what the county supplies, build plants; they cost coins every month. Shortages cut income.
- **Roads and community:** homes and shops beside a road earn +5%; near a Park, Fire Station or School, +10–15% (up to +40%), which also raises their assessed value.
- **People:** residents walk between homes, shops and parks, preferring roads.
- **Taxes:** see below and [docs/TAXES.md](docs/TAXES.md).
- **New town:** ⚙️ → Start a new town.

### Time

- **Income timers and crops use real time.** Rent keeps building while the game is closed and waits for you to collect it. A building pays one batch at a time; uncollected rent doesn't stack. Crops keep growing while you're away too, and can wither, so plant slow crops before you leave.
- **Welcome back.** Open the game after 5 minutes or more away (or return to a tab you left in the background) and a summary shows what's waiting: income ready, crops ripe or withered, energy regained. **Collect all** gathers everything, using ⚡1 per pickup.
- **The calendar only runs while you play.** One month is one minute of play, so a year is 12 minutes. Taxes follow the calendar: sales tax is sent every quarter, and income and property tax are paid on Tax Day after December.

### Taxes in one paragraph

Homes earn rent, shops earn sales and farms earn crop sales. Level-up, quest and collection rewards are prize money, which is taxable too. Goods are inventory: buying a shipment isn't deductible, but each sale deducts what its goods cost (cost of goods sold). Shops also
collect 7% sales tax from customers, which you hold for the state and hand
over each quarter. Crops are sold wholesale, so they carry no sales tax, and
the seeds you buy are a deductible farm expense. Every
building owes property tax on its assessed value. On Tax Day, your income
minus deductions is taxed using the real US 2024 brackets, scaled ÷10.
Deductions are the standard deduction, seeds, cost of goods sold, running costs, property tax (on buildings and land) and depreciation. Materials and upgrades are added to a building's cost and depreciated, not deducted at once. If a bill pushes your coins below zero, you're in tax debt,
and a 0.5% penalty is added each month until you've paid it off.
[docs/TAXES.md](docs/TAXES.md) has the details.

## Project structure

```
src/
  main.ts                 entry point: creates the Game
  style.css               all styling (HUD, labels, panels)
  game/
    Game.ts               creates and wires everything; the frame loop
    grid.ts               tile ↔ world coordinate math
    buildings.ts          the building catalog (pure data)
    crops.ts              the crop catalog and crop stages (empty → growing → ripe → withered)
    land.ts               starting land and expansion prices
    terrain.ts            the coastline: which tiles are sea
    Docks.ts              shipments: ordering, sailing time, unloading
    construction.ts       building levels, upgrade costs, starting materials
    projects.ts           finishing construction and upgrading (checks everything first)
    items.ts              construction materials
    Inventory.ts          materials and collectibles, with what they cost
    collections.ts        collectible sets, drops and rewards
    quests.ts             quests, achievements and the stats behind them
    ContextMenu.ts        the menu over a selected building
    utilityRules.ts       water, power and trash: demand, supply, effect on income (pure functions)
    communityRules.ts     location bonuses (parks, schools, roads) and road shapes (pure functions)
    Services.ts           keeps utilities and location bonuses current; pays running costs monthly
    pathfinding.ts        A* shortest paths on the tile grid
    offline.ts            what happened while you were away (for the welcome-back window)
    progression.ts        XP, level and energy rules (pure functions)
    Player.ts             the player's XP, level and energy over time
    City.ts               town state: coins, buildings, occupancy, income timers
    GameClock.ts          the in-game calendar (play time, not wall time)
    taxRules.ts           tax rates, brackets and formulas (pure functions)
    Taxes.ts              the tax books: ledger, quarterly/yearly payments, penalties
    save.ts               localStorage save/load and autosave
    CameraController.ts   pan, zoom, pinch, click detection
    CityView.ts           keeps 3D objects in sync with City
    LandView.ts           the ground, owned land and "for sale" signs
    PeopleView.ts         residents walking around town
    RoadView.ts           draws the road network as one merged mesh
    ShipView.ts           sailboats, fishing boats and cargo ships
    models.ts             loads .glb models, draws placeholder shapes and crops
    Builder.ts            build / move / demolish tools, ghost preview, what a tap does
    IncomeView.ts         HTML labels over buildings: bubbles, pop-ups, info card
    *.test.ts             unit tests
  ui/
    Hud.ts                coins, calendar, toolbar, catalog, hints, toasts
    TaxPanel.ts           the Taxes window and Tax Day report
    CropPicker.ts         the seed window for farm plots
    LevelUpPanel.ts       the level-up window
    LandPanel.ts          the window for buying land
    TownPanel.ts          the Town window: population and utilities
    WelcomeBackPanel.ts   the "Welcome back" summary
    DockPanel.ts          ordering shipments at a dock
    Sheet.ts              the slide-up Sheet and centered Modal every window uses
    BuildMenu.ts          the build menu, with thumbnails and a preview
    thumbnails.ts         draws building pictures with three.js
    BuildingPanel.ts      building details and actions
    QuestsPanel.ts        quests, progress, achievements
    InventoryPanel.ts     stored buildings, materials, goods, collectibles
    CollectionsPanel.ts   collection sets and rewards
    MapPanel.ts           the world map
    dom.ts                small DOM helpers
public/models/            3D models served as-is (Kenney City Kit, CC0)
assets-src/               raw downloaded asset packs (git-ignored)
docs/                     the docs linked above
```

## Roadmap

| Stage | Status | |
|---|---|---|
| 0 | ✅ | Scaffold: Vite, TypeScript, three.js, isometric camera |
| 1 | ✅ | Pan and zoom, tile picking with raycasting |
| 2 | ✅ | Building catalog, place / move / demolish, 3D models |
| 3 | ✅ | Coins, costs, income timers, collect bubbles |
| 3.5 | ✅ | Local saving, game calendar, tax system, unit tests, touch support |
| 4 | ✅ | Farms: plant, grow, harvest, wither; farm income and seed expenses on the tax return |
| 5 | ✅ | Energy, XP and levels, unlocks; level rewards taxed as prizes |
| 5.5 | ✅ | Expandable land, utilities (water, power, trash), walking residents, save upgrades |
| 6 | ✅ | "Welcome back" summary, collect all, save upgrades |
| 7 | ✅ | Roads (drag to draw, autotiled), parks, fire stations, schools, location bonuses |
| 8 | ✅ | Coast and sea, goods and storage, docks and cargo ships, inventory and cost of goods sold |
| 9 | ✅ | New interface (top bar, toolbar, sheets, context menu, building details, map); construction and materials, shop stock, upgrades, storing; quests, achievements, inventory, collections |
| 10 | ⏳ | Decorations that boost payouts, more buildings and models |
| 11 | | Simulated neighbors to visit and help |
| 12 | | Polish (animation, sound, citizens) and deploy |

## Credits

- 3D models: [City Kit (Suburban)](https://kenney.nl/assets/city-kit-suburban) by Kenney, CC0 (see `public/models/suburban/License.txt`).
- Built with [three.js](https://threejs.org), [Vite](https://vite.dev) and [Vitest](https://vitest.dev).
