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

| Action | Mouse | Touch |
|---|---|---|
| Pan | Drag | Drag |
| Draw roads | Drag (with Road selected) | Drag |
| Zoom | Scroll wheel | Pinch |
| Collect rent / sales | Click the 🪙 bubble or the building | Tap |
| Plant, harvest, clear crops | Click the plot or its bubble | Tap |
| Building info | Hover a building | Tap it |
| Cancel a tool | Esc, right-click or **Done** | **Done** |

- **Build:** pick a building. A green preview means it fits and you can afford it; red means it doesn't. Place as many as you like, then press Done.
- **Levels and XP:** building, collecting and harvesting earn XP (⭐). Each level pays a coin reward, refills your energy, raises its maximum and unlocks new buildings and crops. Locked items are shown with the level that unlocks them.
- **Energy (⚡):** collecting, harvesting, planting and clearing use 1 energy each; building and moving don't. It refills by 1 every 2 minutes, in real time, even while the game is closed.
- **Land:** the world is 60×60 tiles, in 10×10 lots. You start with the middle four. Tap a 🏷️ sign on a lot next to your land to buy it; each lot costs more than the last and needs a higher level. Land pays property tax but is never depreciated.
- **Utilities:** homes, shops and farms use 💧 water, 🔌 electricity and 🗑️ trash pickup. The county covers a small town for free; after that, build a Water Tower, Power Plant or Solar Farm, and Recycling Center. Plants cost coins every month to run (deductible on your taxes). When supply falls short, income drops: the top-left line turns red and the **Town** window shows what to build.
- **Roads:** pick Road from the build menu's Town tab and drag across the map to draw (a tap places one tile). Roads join up into straights, corners and crossings by themselves. Homes and shops touching a road earn +5%, and walkers prefer roads.
- **Community buildings:** a Park, Fire Station and School each raise the income of homes and shops nearby (+10%, +10%, +15%), shown as a blue area while placing. Bonuses stack up to +40%. A better location also raises a building's assessed value, so property tax goes up too, as it does in real life. Each has a monthly running cost.
- **People:** each home has residents (👥). About one in two is out walking at any time, between home, shops and neighbors.
- **Farming:** build a Farm Plot, then tap it (🌱) to choose seeds. Crops grow through sprout, young and grown stages, then ripen (the crop's bubble appears): tap to harvest and sell. Wait too long and it withers (🥀): the harvest is lost and you tap to clear the plot. Quick crops earn the most per minute; slow ones can be left overnight. Tick "Plant all empty plots" to sow every empty plot at once.
- **Move:** tap a building to pick it up, then tap where it should go.
- **Demolish:** tap a building to remove it. You get no refund and no tax deduction; that's the real US rule, explained in docs/TAXES.md.
- **Town:** population, how each utility keeps up with demand, the effect on income and the monthly running costs.
- **Taxes:** your books for the year, an income tax estimate by bracket, the sales tax you're holding, property values and last year's return.
- **New town** (top right) deletes the save and starts over.

### Time

- **Income timers and crops use real time.** Rent keeps building while the game is closed and waits for you to collect it. A building pays one batch at a time; uncollected rent doesn't stack. Crops keep growing while you're away too, and can wither, so plant slow crops before you leave.
- **Welcome back.** Open the game after 5 minutes or more away (or return to a tab you left in the background) and a summary shows what's waiting: income ready, crops ripe or withered, energy regained. **Collect all** gathers everything, using ⚡1 per pickup.
- **The calendar only runs while you play.** One month is one minute of play, so a year is 12 minutes. Taxes follow the calendar: sales tax is sent every quarter, and income and property tax are paid on Tax Day after December.

### Taxes in one paragraph

Homes earn rent, shops earn sales and farms earn crop sales. Level-up rewards are prize money, which is taxable too. Shops also
collect 7% sales tax from customers, which you hold for the state and hand
over each quarter. Crops are sold wholesale, so they carry no sales tax, and
the seeds you buy are a deductible farm expense. Every
building owes property tax on its assessed value. On Tax Day, your income
minus deductions is taxed using the real US 2024 brackets, scaled ÷10.
Deductions are the standard deduction, seeds, utility running costs, property tax (on buildings and land) and depreciation. If a bill pushes your coins below zero, you're in tax debt,
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
| 8 | ⏳ | Supply chain: farm goods stock shops (cost of goods becomes deductible) |
| 9 | | Quests and goals |
| 10 | | Land expansions, decorations that boost payouts |
| 11 | | Simulated neighbors to visit and help |
| 12 | | Polish (animation, sound, citizens) and deploy |

## Credits

- 3D models: [City Kit (Suburban)](https://kenney.nl/assets/city-kit-suburban) by Kenney, CC0 (see `public/models/suburban/License.txt`).
- Built with [three.js](https://threejs.org), [Vite](https://vite.dev) and [Vitest](https://vitest.dev).
