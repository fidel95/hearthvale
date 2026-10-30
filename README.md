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
| [docs/TESTING.md](docs/TESTING.md) | The test plan, and which test checks each item |
| [docs/FEATURES.md](docs/FEATURES.md) | The design pillars and every feature in the spec: status and where it lives |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Building definitions vs. placed buildings, and every field of the save file |
| [docs/BALANCE.md](docs/BALANCE.md) | Balance principles, the unlock schedule, and a worksheet of every building and crop (generated) |
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
| `npm run balance` | Regenerate the balancing worksheet in docs/BALANCE.md (and its JSON and CSV) |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |

### Installing and offline play

The production build is a Progressive Web App. A small Vite plugin
(`scripts/serviceWorker.ts`) writes `dist/sw.js` from `scripts/sw-template.js`,
listing every file in the build. After the first visit the service worker
keeps them all, so the game opens and plays with no connection, and it can be
installed (Add to Home Screen on iPhone and iPad, Install on Android and
desktop). A new version downloads in the background, fetching every file
fresh (never the browser's own cache) and checking the page belongs to the
same version before it takes over; the open game then offers to reload. If
the game ever fails to start, it shows what went wrong with Reload and
"Refresh the game's files" (the saved town is never touched). The service worker only runs in the production build, never in
`npm run dev`.

### Publishing

The build uses relative paths (`base: './'`), so `dist/` works from any
address. `.github/workflows/deploy.yml` tests, builds and publishes to GitHub
Pages on every push to `main` (turn it on in the repository's Settings → Pages →
Source: GitHub Actions).

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
- **Map:** the whole world at the game's angle. Tap to jump there; tap a lot for sale to buy it. Its **Neighbors** tab lists your neighbors.
- **Neighbors** (from level 7): five simulated neighbors with towns of their own that grow with yours. Visit one, tap 🤝 bubbles to help (collect their rent, harvest or clear crops: 5 helps per neighbor a day, each paying coins and XP), claim their daily gift, and give them the materials they ask for. Helping builds friendship, and better friends send bigger gifts. Everything is local: no accounts, no network.
- **Town services and Taxes:** tap 👥 or 🪙 in the top bar.

### The systems

- **Construction:** bigger buildings start as a construction site with a timer, then need materials (🧱 bricks, 🪵 lumber, 🪟 glass, 🔩 steel) to finish. You start with a few; buy more in Inventory, or right from the building's details.
- **Shops and stock:** shops sell from their own shelves (the Bakery holds 40 goods, 4 per sale). Tap an out-of-stock shop, or press Restock, to fill its shelves from town storage.
- **Upgrades:** homes and shops go up to ★★★: +50% and then +100% income, residents and shelf space, for coins, materials and a player level.
- **Turning:** press ⟳ (or R) while placing or moving a building, or choose Turn on a placed one. A turned building's footprint swaps width and depth.
- **Population capacity:** a town has room for 40 residents; Parks, Fire Stations and Schools make room for more. New homes and upgrades need room. The top bar shows 👥 residents / room.
- **Settings:** ⚙️ for the tile grid, walking residents, the ✓ step before buying, reduced motion, replaying the tutorial, and starting a new town.
- **Tutorial:** a new town is guided through the basics, one step at a time; skip it any time.
- **Storing:** put a building away in your Inventory and place it again later for free. While stored it pays no property tax and isn't depreciated.
- **Levels and XP:** building, collecting, harvesting, finishing and upgrading earn XP (⭐). Each level pays a reward, refills energy, raises its maximum and unlocks more.
- **Energy (⚡):** collecting, harvesting, planting, clearing and unloading use 1. It refills by 1 a minute in real time, even while the game is closed.
- **Farming:** tap an empty plot (🌱) to choose seeds. Crops sprout, grow and ripen; harvest before they wither (🥀). Quick crops earn the most per minute; slow ones can be left overnight.
- **Goods and storage (📦):** once you have a shop, harvests go into storage as goods; what doesn't fit is sold at the market. A Barn, Warehouse or Dock adds space.
- **Land and the coast:** the world is 60×60 tiles in 10×10 lots, with the sea along the south. Tap a 🏷️ sign (or a lot on the Map) to buy the land next to yours.
- **Docks and shipping:** build a Dock on the shore, order a coastal freighter or a container ship, and unload it (🚢) when it arrives.
- **Utilities:** homes, shops and farms use 💧 water, 🔌 electricity and 🗑️ trash pickup. Beyond what the county supplies, build plants; they cost coins every month. Shortages cut income.
- **Decorations:** trees, flower beds, stone paths, fences, benches, fountains and statues raise the income of homes and shops right around them (+1% to +8% each), up to +10% from decorations in all. Landscaping also raises a building's assessed value.
- **Roads and community:** shops need a road touching one side (🚧 means one is missing); homes and shops beside a road earn +5%; near a Park, Fire Station or School, +10–15% (up to +40%), which also raises their assessed value.
- **People:** residents walk between homes, shops and parks, preferring roads.
- **Taxes:** see below and [docs/TAXES.md](docs/TAXES.md).
- **City rating (😊):** 0–100, from utilities, neighborhoods, roads, room to grow, finances and greenery. The Town window shows each part and what raises it. Landmarks need a minimum rating.
- **Landmarks:** the Clock Tower, Lighthouse and Botanical Garden: expensive, one of each, and they raise all rent and sales in town.
- **Sound and help:** sound effects and optional music (Settings), and ❓ for help on every topic. 🎯 or the Home key brings the camera back to your town.
- **Your save:** saved automatically in this browser. Settings has Save now, Export (download a copy) and Import. Clearing site data deletes the save, so export a copy to keep it safe.
- **Admin tools:** Settings → Admin tools adds a 🛠️ button: give yourself coins, levels and materials, finish every timer, run the calendar 10× or 60× faster, or switch on powers (build anything free and instantly, unlimited energy, everything ready at once).
- **Parks, beaches and the slopes:** Playground, Sports Field and Central Park lift nearby homes and draw visitors; a Public Beach on the shore fills with sunbathers and swimmers; the Ski Resort (level 13) sells lift tickets while skiers zigzag down and ride the chairlift up. Snowy mountains rise behind the town.
- **Happy homes:** homes want a shop and green space nearby (family homes a school too); each need met lifts their rent, up to +15%. The Town window lists what residents want, with a button to build it.
- **Tourism:** bus stops, the dock, the train station and the airport bring visitors; parks, the beach, the ski resort and landmarks give them room. Each visitor spends 🪙 2 a month, and you can spot them walking about in sun hats and backpacks.
- **Events:** a festival each real season (Blossom Festival, Summer Fair, Harvest Fair, Winter Lights) with three goals and a prize decoration you can only win there, plus three weekly challenges every Monday. All on the device's own calendar, so it works offline.
- **Shops need customers, crops have seasons:** a shop sells at full speed with enough residents within 8 tiles (down to 60% without); each crop gives +25% in its season. Tap an empty tile for 🔨 Build here; while drawing roads, each network shows in its own color. Settings has an Interface size slider.
- **Feels alive:** coins, stars and goods fly from buildings to the top bar when you collect, and buildings bounce; dust and sparkles when you build, confetti when construction finishes, fireworks when you level up; cranes on building sites, chimney smoke, swaying trees, birds and drifting cloud shadows; the map glides after a flick. Reduce motion turns it all off.
- **Farm animals:** Chicken Coop, Pig Pen, Sheep Meadow and Cow Pasture: animals wander, graze and peck in their yards, and what they give sells as farm income.
- **Snow mode and disasters:** Settings → Snow mode for a wintry town with snowfall. Tornados, lightning storms, floods and tsunamis strike now and then: damaged buildings (🔧) stop working until repaired (a deductible expense); nothing is ever destroyed. Settings can turn disasters off; Admin can start any of them.
- **Weather:** rain showers roll in every few minutes: the sky dims, umbrellas come out and the beach empties (Settings → Rain showers; Admin can start or stop it).
- **Traffic and transport:** cars drive your roads as the town grows. Bus Stops (level 7) lift nearby homes and shops, and buses run between them. An Army Base (level 12) adds safety and room for residents: its squad runs a daily drill (marching, saluting as the flag goes up, jumping jacks, push-ups, a run), a sentry keeps watch, a helicopter circles the town and a jeep patrols. Tap it and 🎖️ Parade (🪙 300): the squad marches through town behind a flag and a drum, and all rent and sales are 10% higher for 3 minutes. Railway track and a Train Station (level 14): a train shuttles along your line and visitors lift all rent and sales. An Airport (level 15): planes take off, circle the town and land.
- **Building several at once:** after Place, tap a spot for each one (tap a spot again to take it back), then ✓ or "Buy N · 🪙 total" buys them all; coins, fit and room for residents are checked for the whole set.
- **Removing roads:** tap a road and 🗑️ Remove, then tap or drag along more roads to pick several and remove them together; it warns if a shop would lose its road.
- **Phones in landscape:** the toolbar moves to a slim column on the left and windows open down the right side, so the map stays visible; the map fills the screen around the notch.
- **Moving buildings:** press and hold a building, or drag the selected one, and let go where it should go. The outline shows where it fits; dragging to the screen's edge scrolls the map.
- **Never stuck:** if nothing in your town earns coins and you can't afford a Cottage, the county offers a grant (once an hour).
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
    Game.ts               puts views and windows on the game state; the frame loop
    GameState.ts          every game system, with no rendering (used by saves and tests)
    SaveSystem.ts         which system owns which part of the save, and restore order
    events.ts             the typed event emitter every system uses
    Economy.ts            coins, goods and debt (never negative)
    ProductionSystem.ts   collect, restock, plant, harvest, finish, upgrade (timestamps)
    PlacementSystem.ts    can it go here: every placement rule, with reasons
    UnlockSystem.ts       what's available at the player's level
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
    balance.ts            the balancing worksheet, computed from the catalogs
    safetyNet.ts          the county grant for a town that would otherwise be stuck
    settings.ts           player settings and their defaults
    tutorial.ts           the new-town tutorial steps
    production.ts         what a building is doing: building, idle, producing, ready, blocked
    cityRating.ts         the city rating and its parts
    neighborData.ts       the neighbors, their generated towns, daily gifts and requests
    Neighbors.ts          friendship and today's helps, gifts and requests
    Visit.ts              a visit to a neighbor's town: its own scene, town and help bubbles
    ContextMenu.ts        the menu over a selected building
    utilityRules.ts       water, power and trash: demand, supply, effect on income (pure functions)
    communityRules.ts     location bonuses (parks, schools, roads) and road shapes (pure functions)
    Services.ts           keeps utilities and location bonuses current; pays running costs monthly
    pathfinding.ts        A* shortest paths on the tile grid
    offline.ts            what happened while you were away (for the welcome-back window)
    progression.ts        XP, level and energy rules (pure functions)
    Player.ts             the player's XP, level and energy over time
    City.ts               the town: buildings, occupancy, land, roads (owns its economy and production)
    GameClock.ts          the in-game calendar (play time, not wall time)
    taxRules.ts           tax rates, brackets and formulas (pure functions)
    Taxes.ts              the tax books: ledger, quarterly/yearly payments, penalties
    save.ts               save storage: localStorage, versions, backups, export/import, autosave
    CameraController.ts   pan, zoom, pinch, click detection
    CityView.ts           keeps 3D objects in sync with City
    LandView.ts           the ground, owned land and "for sale" signs
    PeopleView.ts         residents walking around town
    RoadView.ts           draws the road network as one merged mesh
    RoadNetworkView.ts    overlay: each connected road network in its own color, cut-off buildings red
    demand.ts             shops' customers: residents within reach, and the share of sales they give
    needs.ts              what homes want nearby, their happiness, and its rent bonus
    Tourism.ts            visitors: arrivals (transport) vs. room (attractions), and their monthly spending
    eventData.ts          festivals (one per real season), weekly challenges, and their rewards
    TownEvents.ts         progress and claims for the festival that's on and this week's challenges
    seasons.ts            the seasons, and crops' in-season bonus
    RailView.ts           draws railway track the same way
    TrafficView.ts        cars, buses, trains and the army's squad and jeep
    FlightView.ts         planes taking off, circling and landing at the airport
    LeisureView.ts        sunbathers and swimmers at the beach, skiers and the chairlift
    Army.ts               parades: cost, the town-wide bonus, the rest between them (tested)
    ArmyView.ts           the base's drill, flag, sentry, helicopter and parades
    MountainView.ts       the countryside and snowy mountains beyond the world's edge
    WeatherView.ts        rain showers and snowfall: dimmer light, a grayer sky, snow cover
    AnimalView.ts         chickens, pigs, sheep and cows in their pens
    EffectsView.ts        particles: dust, sparkles, smoke, confetti, fireworks
    AmbientView.ts        cloud shadows, birds, chimney smoke, dust at building sites
    Disasters.ts          what disasters do: damage, ruined crops, repairs (tested)
    DisasterView.ts       tornados, lightning, floods and tsunamis on screen, and when they strike
    routes.ts             route-finding on roads and track (tested)
    ShipView.ts           sailboats, fishing boats and cargo ships
    models.ts             loads .glb models, draws placeholder shapes and crops
    scenery.ts            the countryside: pines, round trees, boulders, bushes and flowers
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
    Coach.ts              the tutorial's instruction card
    HelpPanel.ts          help topics
    SettingsPanel.ts      settings, saving, export / import
    AdminPanel.ts         admin tools (cheats): gifts, time, powers
    sound.ts              sound effects and music, made with Web Audio
  data/
    quests.json           quests and achievements, as data
    NeighborsList.ts      the neighbors tab of the Map
    dom.ts                small DOM helpers
scripts/                  generators run with Vitest (npm run balance)
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
| 9.5 | ✅ | Balance pass: design principles, a generated balance worksheet (npm run balance), balance tests, one new mechanic per level, a safety-net grant |
| 9.6 | ✅ | Data model: turning buildings, population capacity, settings, tutorial, save format version 3 |
| 10 | ✅ | Decorations that boost nearby income (capped at +10%); 5 new homes from the model pack, 4 new shops, a Library and Town Hall, 6 new decorations |
| 11 | ✅ | Simulated neighbors: generated towns to visit, daily helps, gifts, requests, friendship; gifts vs. pay for help on taxes |
| 11.5 | ✅ | Design spec: shops need roads, production states, coins never negative (debt instead), land needs materials, city rating, 3 landmarks, quests as data, sound and music, help, save export / import and damaged-save backup, keyboard camera and accessibility, debug tools ([FEATURES.md](docs/FEATURES.md)) |
| 11.6 | ✅ | Systems refactor: Economy, ProductionSystem, PlacementSystem, UnlockSystem, GameState, SaveSystem; panels show the rules' answers instead of re-checking them |
| 11.7 | ✅ | Test plan: placement, economy, production, quests, saves and offline suites (215 tests); fixed quest tasks un-completing and damaged saves crashing ([TESTING.md](docs/TESTING.md)) |
| 12 | ✅ | Polish and deploy: installable and fully offline (service worker, manifest, app icon), update prompt, buildings spring into place, automatic quality on slow phones, GitHub Pages workflow |

## Credits

- 3D models: [City Kit (Suburban)](https://kenney.nl/assets/city-kit-suburban) by Kenney, CC0 (see `public/models/suburban/License.txt`).
- Pines, boulders and stones: [Mini Forest](https://kenney.nl/assets/mini-forest) by Kenney, CC0 (see `public/models/forest/License.txt`).
- Built with [three.js](https://threejs.org), [Vite](https://vite.dev) and [Vitest](https://vitest.dev).
