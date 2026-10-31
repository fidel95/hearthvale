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
| Turn the view | 🔄, or Q / E | 🔄, or twist two fingers |
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
- **Farming:** tap an empty plot (🌱) to choose seeds. Crops sprout, grow and ripen; harvest before they wither (🥀). Quick crops earn the most per minute; slow ones can be left overnight. Each crop earns up to three mastery stars, and each star makes its harvests 10% bigger.
- **The farm:** animal pens give 🥚 eggs, 🍄 truffles, 🧶 wool and 🥛 milk besides coins; orchards (apples, cherries, oranges) are planted once and picked again and again; wheat and grapes harvests give 🌾 and 🍇 too. A Bakehouse, Dairy and Winery turn them into 🍞 bread, 🧀 cheese and 🍷 wine. The Farmers' Market buys any of it and posts orders that pay extra coins and XP. A Tractor Shed's tractor drives out to harvest, clear and resow your fields by itself.
- **Goods and storage (📦):** once you have a shop, harvests go into storage as goods; what doesn't fit is sold at the market. A Barn, Warehouse or Dock adds space.
- **Land and the coast:** the world is 60×60 tiles in 10×10 lots, with the sea along the south. Tap a 🏷️ sign (or a lot on the Map) to buy the land next to yours.
- **Docks and shipping:** build a Dock on the shore, order a coastal freighter or a container ship, and unload it (🚢) when it arrives. You can watch it all: the dock's gantry crane loads the waiting export containers, the ship casts off and sails out to sea, and it comes back full just as the shipment arrives. Unloading, the crane lifts the containers onto the quay, and trucks drive them to a shop or warehouse in town and come back with more to export.
- **Utilities:** homes, shops and farms use 💧 water, 🔌 electricity and 🗑️ trash pickup. Beyond what the county supplies, build plants; they cost coins every month. Shortages cut income. A Landfill handles trash cheaply but takes room; a Recycling Center is compact but costs more to run.
- **Decorations:** trees, flower beds, stone paths, fences, benches, fountains and statues raise the income of homes and shops right around them (+1% to +8% each), up to +10% from decorations in all. Landscaping also raises a building's assessed value.
- **Roads and community:** shops need a road touching one side (🚧 means one is missing); homes and shops beside a road earn more, by kind of road (the best one beside them counts); near a Park, Fire Station or School, +10–15% (up to +40%), which also raises their assessed value.
- **People:** residents walk between homes, shops and parks on the sidewalks only, along the roads (never across grass or down the road); a building with no road beside it gets no foot traffic.
- **Taxes:** see below and [docs/TAXES.md](docs/TAXES.md).
- **City rating (😊):** 0–100, from utilities, neighborhoods, roads, room to grow, finances and greenery. The Town window shows each part and what raises it. Landmarks need a minimum rating.
- **Landmarks:** the Clock Tower, Lighthouse and Botanical Garden: expensive, one of each, and they raise all rent and sales in town.
- **Sound and help:** sound effects and optional music (Settings), and ❓ for help on every topic. 🎯 or the Home key brings the camera back to your town.
- **Your save:** saved automatically in this browser. Settings has Save now, Export (download a copy) and Import. Clearing site data deletes the save, so export a copy to keep it safe.
- **Admin tools:** Settings → Admin tools adds a 🛠️ button: give yourself coins, levels and materials, finish every timer, run the calendar 10× or 60× faster, or switch on powers (build anything free and instantly, unlimited energy, everything ready at once).
- **Parks, beaches and the slopes:** Playground, Sports Field and Central Park lift nearby homes and draw visitors; a Public Beach on the shore fills with sunbathers and swimmers; the Ski Resort (level 13) sells lift tickets while skiers zigzag down and ride the chairlift up. Snowy mountains rise behind the town.
- **Happy homes:** homes want a shop and green space nearby (family homes a school too, apartments a hospital and police station); each need met lifts their rent, up to +15%. The Town window lists what residents want, with a button to build it.
- **Tourism:** bus stops, the dock, the train station and the airport bring visitors; parks, the beach, the ski resort and landmarks give them room. Each visitor spends 🪙 2 a month, and you can spot them walking about in sun hats and backpacks.
- **The big city (Stage 4):** Apartment Blocks and High-Rises, a Police Station and Hospital, a Shopping Center that draws visitors, carrots, tomatoes and grapes, a lamp post, hedge, gazebo and duck pond, and a five-quest Big City chain.
- **Factories and products:** a Cannery, Textile Mill and Furniture Workshop turn goods into 🫙 preserves, 👕 clothes and 🪑 furniture, which a Deli, Clothing Store and Furniture Store sell for more: farm → goods → factory → product → shop. A Coal Mine (an open pit where an excavator loads a haul truck) earns from the coal it sells.
- **Goals that never run out:** mastery stars for every building and crop, population and earnings milestones, and a town title that grows from Hamlet to Metropolis (Quests → Goals). From level 10, collecting from one building also collects everything ready around it.
- **The Highlands:** the world's east is mountain country. Buy land out there and build at the foot of the peaks: a Mountain Lodge, a Cable Car whose cabins ride up the mountainside, and the Tunnel Works, where a tunnel boring machine drills into the rock. Deer, mountain goats and rabbits roam the wild land, and eagles circle the peaks.
- **The Spaceport:** a rocket lifts off every few minutes, in fire and smoke.
- **In the sky:** hot air balloons drift over town, and now and then a UFO comes to hover over a building. Tap it before it leaves for a gift.
- **A daily gift:** a 7-day calendar that grows to a big gift on day 7. Missing a day never loses your place.
- **A river through the Highlands**, from the mountains to the sea. Roads cross it as bridges, and construction trucks bring loads to every building site.
- **Emergencies:** now and then a fire breaks out. Your fire station sends an engine to hose it down, with the police and an ambulance, lights flashing; with no engine coming, tap the 🔥 yourself. Between fires, ambulances and police cars go out on calls.
- **Traffic lights** at every paved junction; cars stop on red and queue behind each other. A yellow submarine dives and surfaces out at sea.
- **Turn the view** to look from any side; mountains in the way turn see-through.
