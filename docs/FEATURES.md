# Design pillars and feature inventory

Every item in the design spec, with its status and where it lives.
✅ done · 🟡 partly, or done differently (see note) · ⏳ planned

## Design pillars

| Pillar | How Hearthvale meets it |
|---|---|
| 1. Readable city | Bubbles for every ready or blocked state, a context menu and details for any building, placement shown in words as well as color, 🚧 for cut-off shops, the city rating explained part by part |
| 2. Meaningful progression | One new mechanic per level, quests that introduce each one, achievements, unlock previews (Quests → Progress), landmarks as long goals ([BALANCE.md](BALANCE.md)) |
| 3. Resource trade-offs | Coins vs. materials vs. energy vs. land; quick vs. slow crops; power plant vs. solar; stocking shops vs. selling at market; decorations vs. community buildings |
| 4. Low-friction offline play | No server or account; a service worker keeps every file, so after the first visit the game opens and plays with no connection, and it installs like an app |
| 5. Recoverable progress | Autosave on every change and when the page is hidden; versioned saves with upgrades; unreadable saves kept as a backup; export and import |
| 6. Modular implementation | One home per responsibility: Grid, PlacementSystem, Economy, ProductionSystem, quests, progression, UnlockSystem, SaveSystem, typed events, and UI panels that only show and ask ([ARCHITECTURE.md](ARCHITECTURE.md#systems-and-who-owns-what)); 215 tests, including the full test plan ([TESTING.md](TESTING.md)) |

## 4.1 City map and camera

| Feature | | Where |
|---|---|---|
| Isometric view | ✅ | Orthographic camera at 45° (`CameraController.ts`) |
| Grid-based placement | ✅ | `grid.ts`, `City.canPlace` |
| Pan, zoom | ✅ | Drag, wheel, pinch; arrow keys / WASD, + / − |
| Select buildings and empty tiles | ✅ | Buildings select with a context menu; tapping an empty tile of your land offers 🔨 Build here (the building you pick goes on that spot); tapping land you could buy opens it |
| Placement preview, valid / invalid | ✅ | Ghost model, green / red outline, and words: "✓ Fits here", "✗ Doesn't fit", "⚠ needs a road" |
| Highlight the selected building | ✅ | Yellow outline (`Builder.selection`) |
| Starting plot and expansions | ✅ | 4 starting lots of 10×10; buy more (`land.ts`) |
| Recenter the camera | ✅ | 🎯 in the top bar, or the Home key |
| Readable UI at any size | ✅ | Phone layout (one-row top bar, bottom sheets) and desktop (side sheets); browser zoom scales everything |
| Consistent tile coordinates | ✅ | Tile (x, z), 0–59; world = tile − 30 + 0.5 (`grid.ts`) |
| World vs. screen coordinates | ✅ | Screen → ray → ground point → tile (`groundPointAt`, `worldToTile`) |
| Grid-based collision regardless of artwork | ✅ | The occupancy grid, never the models' shapes |
| Draw order | ✅ | 3D: the depth buffer. Labels: sorted by distance each frame, in a layer under the HUD and windows ([ARCHITECTURE.md](ARCHITECTURE.md#layers-on-screen)) |

## 4.2 Building categories

| Feature | | Where |
|---|---|---|
| Homes: population, rent, cooldowns | ✅ | 9 homes (`buildings.ts`: `residents`, `income`) |
| Homes: road access | ✅ | Decided: not required (a new town can never be stuck without roads); homes beside a road earn +5%, and the city rating's Roads part rewards it |
| Homes: show rent ready | ✅ | 🪙 bubble |
| Businesses: sales cycle, stock, state | ✅ | 6 shops; shelves, Restock, timers, 📦 when out of stock |
| Businesses: road access | ✅ | `requiresRoad`; 🚧 when cut off |
| Businesses: nearby population | ✅ | Each shop needs residents within 8 tiles for full sales; fewer still sells, down to 60% (`demand.ts`); shown when placing and in details |
| Farms: crop choice, cost, time, reward, states | ✅ | 6 crops; empty → growing → ripe → withered (`crops.ts`) |
| Harvest grants goods, coins, XP, quests | ✅ | |
| Crop seasons | ✅ | Each crop has a best season on the calendar: +25% harvest then, never blocked otherwise (`seasons.ts`) |
| Civic buildings: capacity, happiness, services | ✅ | Population capacity, location bonuses, the city rating; utilities |
| Civic: construction and materials | ✅ | `build` data |
| Decorations: appearance, small bonus | ✅ | 9 decorations, +1–8% nearby (capped at +10%) |
| Landmarks | ✅ | Clock Tower, Lighthouse, Botanical Garden: one each, a minimum rating, town-wide bonus |

## 4.3 Construction and placement

| Feature | | Where |
|---|---|---|
| Catalog by category with cost, unlock, footprint, effect | ✅ | `BuildMenu.ts`, cards with 3D thumbnails and a preview |
| Preview before placing | ✅ | |
| Validate coins, materials, free and owned footprint | ✅ | `PlacementSystem.check`; materials at construction (`projects.ts`) |
| Deduct only on success; cancel costs nothing | ✅ | Paid on ✓ only (`confirmPlacement`) |
| Several at once | ✅ | Tap a spot for each, then one ✓ buys them all; `PlacementSystem.checkMany` checks fit, overlaps, total cost and room together |
| Move mode | ✅ | Press and hold a building (or drag the selected one) and drop it; or context menu → Move. Dragging to the screen's edge scrolls; a drop that doesn't fit puts it back |
| Rotate | ✅ | ⟳ / R; footprint swaps |
| Sell / remove with a stated refund | ✅ | Remove: no refund (and why, under US tax law) |
| No moving into locked land or onto buildings | ✅ | Same `canPlace` |

## 4.4 Roads and access

| Feature | | Where |
|---|---|---|
| Place and remove road tiles | ✅ | Drag to draw; remove one or many (tap or drag to pick, then Remove) |
| Roads occupy cells | ✅ | They're 1×1 buildings |
| Buildings declare road needs | ✅ | `requiresRoad` |
| Show disconnected buildings | ✅ | 🚧 bubble, info card, details |
| Consistent adjacency rule | ✅ | A road on any tile touching one side (`City.hasRoadAccess`) |
| Warn before a removal breaks access | ✅ | The Remove window lists what it cuts off |
| Connectivity visualization | ✅ | Each road network tinted its own color, cut-off buildings in red; shown while drawing or removing roads, or always (Settings) (`RoadNetworkView.ts`) |
| Parks, beach, ski resort | ✅ | Playground, Sports Field, Central Park, Public Beach (on the shore), Ski Resort; beach goers and skiers (`LeisureView.ts`) |
| Mountains and weather | ✅ | Snowy mountains beyond the edge (`MountainView.ts`); rain showers with umbrellas and rain sound (`WeatherView.ts`), switchable in Settings |
| Feedback animations | ✅ | Collect icons fly to the HUD, bounce, dust, sparkles, confetti, fireworks, cranes, smoke, birds, cloud shadows, swaying trees, camera glide (`EffectsView.ts`, `AmbientView.ts`, `flyToHud.ts`); off with Reduce motion |
| Farm animals | ✅ | Four pens with wandering, grazing animals (`AnimalView.ts`), earning farm income |
| Snow mode, disasters | ✅ | Snow cover and snowfall (`WeatherView.ts`); tornado, lightning, flood, tsunami (`DisasterView.ts`) that damage, never destroy; repairs (`Disasters.ts`, tested) |
| Army | ✅ | Daily drill with animated soldiers, waving flag, sentry, helicopter (`ArmyView.ts`); 🎖️ Parade for a timed town-wide bonus (`Army.ts`, tested) |
| Traffic | ✅ | Cars on roads; buses between Bus Stops; trains on railway track from the Train Station; the Army Base's squad and jeep (`TrafficView.ts`, `routes.ts`); planes at the Airport (`FlightView.ts`) |

## 4.5 Economy and resources

| Feature | | Where |
|---|---|---|
| Coins, goods, materials, XP | ✅ | Plus energy |
| Costs and rewards from data | ✅ | Catalogs and `quests.json` |
| No negative balances | ✅ | Coins never go below 0; unpaid bills are a separate debt paid from income first. Goods and items can't go below 0 |
| Show costs before confirming | ✅ | |
| Central economy, balancing tables | ✅ | `Economy.ts` applies every cost, income and reward; formulas live in rule modules (`taxRules`, `utilityRules`, `communityRules`, `progression`) and the balancing worksheet is generated from them ([BALANCE.md](BALANCE.md)) |
| Debug tools | ✅ | 🛠️ Admin tools: Settings → Admin tools (always on in development): gifts, finish timers, calendar speed, free building, unlimited energy, instant timers |

## 4.6 Production timers

| Feature | | Where |
|---|---|---|
| Defined durations, saved locally, ready on return | ✅ | Timestamps (`readyAt`, `plantedAt`, `endsAt`, `arrivesAt`) |
| No background process | ✅ | State is computed from the clock when needed |
| Time remaining or ready, shown clearly | ✅ | Info card, details progress bars, bubbles |
| States idle / producing / ready / blocked | ✅ | `production.ts` (plus "building" for construction) |
| Clock changes | ✅ | Documented: a local game uses the device clock; changing it changes timers. There's no pretend server time. Nothing breaks if the clock goes backward: timers just take longer |

## 4.7 Quests and objectives

| Feature | | Where |
|---|---|---|
| Quest panel, multiple objectives, auto-tracking | ✅ | `QuestsPanel.ts`, `quests.ts` |
| Rewards, feedback, manual claim | ✅ | Toast, red badge, Claim |
| Definitions in data files | ✅ | `src/data/quests.json`, checked by `data.test.ts` |
| Tutorial objectives | ✅ | First quests and the tutorial |

## 4.8 XP, levels, unlocks

| Feature | | Where |
|---|---|---|
| XP for actions, level, configurable formula | ✅ | `progression.ts` |
| Level-up notice, unlocks visible in the catalog | ✅ | Level-up window; 🔒 cards |
| Saved locally; never pay a level reward twice | ✅ | `rewardedLevel` |

## 4.9 Land expansion

| Feature | | Where |
|---|---|---|
| Parcels with a visible boundary | ✅ | Muted ground beyond your land, 🏷️ signs, the map |
| Price and requirements shown | ✅ | Coins, materials, level (`LandPanel.ts`) |
| Validated; grid grows only on success | ✅ | `buyLand` checks all first |
| Saved; nothing beyond the boundary | ✅ | |
| Quest prerequisites | ✅ | Lots 1, 3 and 6 also need a quest finished (`land.ts expansionQuest`); the land window says which |

## 4.10 Inventory and collections

All ✅: stored buildings, materials, goods, collectibles, five collection sets
with rewards; counts never go below 0; saved.

## 4.11 Happiness and city rating

| Feature | | Where |
|---|---|---|
| A simple rating | ✅ | 0–100, seven parts (`cityRating.ts`), including residents' needs |
| Resident needs and happiness | ✅ | Homes want shopping, green space (and family homes a school) nearby; happiness lifts rent up to +15%; the Town window lists wishes with Build one (`needs.ts`) |
| Visitors and tourism | ✅ | Transport brings visitors, attractions give them room; the smaller of the two visit each month and spend 🪙 2 each (taxable); tourists walk from stops to attractions (`Tourism.ts`) |
| Events | ✅ | A festival each real season with three goals and an exclusive prize decoration (into storage; taxed at its value as a prize), plus three weekly challenges each Monday, sized to your level; from level 3, in Quests → Events (`eventData.ts`, `TownEvents.ts`) |
| Civic buildings and decorations add to it | ✅ | Neighborhoods and Greenery parts |
| Minimum rating for some buildings | ✅ | Landmarks |
| Explained, no hidden penalties | ✅ | Town window: every part, its points and what raises it; nothing but landmarks depends on it |

## 4.12 Audio and feedback

| Feature | | Where |
|---|---|---|
| Original sounds and music | ✅ | Synthesized by the game (`sound.ts`), so nothing to license |
| Click, place, collect, level-up, error | ✅ | Plus harvest and ship |
| Volume and mute | ✅ | Settings (0 mutes) |
| Reduced motion | ✅ | Settings → Reduce motion |
| Playable muted | ✅ | Sound never carries information that isn't also shown |

## 4.13 Tutorial and help

| Feature | | Where |
|---|---|---|
| Camera, selection, building, collecting, crops, quests, land | ✅ | `tutorial.ts` |
| Review or dismiss | ✅ | Skip; Help (❓) has every topic; replay from Help |
| Never blocks a different valid choice | ✅ | Steps already done another way are skipped |

## 4.14 Offline save and resume

| Feature | | Where |
|---|---|---|
| Autosave after changes; manual save | ✅ | `AutoSaver`; Settings → Save now |
| New game with confirmation | ✅ | |
| Everything saved | ✅ | [DATA_MODEL.md](DATA_MODEL.md) |
| Schema version and migrations | ✅ | `upgradeSave` |
| Corrupt or incompatible saves | ✅ | Kept as a backup, explained, downloadable |
| Explain clearing site data | ✅ | Settings and Help |
| Export / import | ✅ | Settings |

## 4.15 Accessibility and usability

| Feature | | Where |
|---|---|---|
| Keyboard and mouse | ✅ | Camera keys, Esc, R, Home; every control is a button |
| Focus indicators | ✅ | `:focus-visible` rings |
| Labels and tooltips for icons | ✅ | `aria-label` and `title` |
| Contrast | ✅ | Dark text on light panels; light text on dark hints |
| Scalable UI | ✅ | Settings → Interface size, 80–130% (bars, windows and the coach scale together) |
| Not color alone | ✅ | Placement in words; shortages say "short"; debt says "owe"; bubbles have icons |
| Mute | ✅ | |
| Confirm destructive actions | ✅ | Remove, new town, import |
