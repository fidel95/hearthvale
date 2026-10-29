# Architecture

How Hearthvale's code is organized, and why. Read this before changing
something that crosses file boundaries.

## The big idea: state, views, input

The game is split into three kinds of code that only talk to each other in
fixed directions:

```
          ┌──────────── input ────────────┐
          │ CameraController  Builder  Hud │   turn clicks into requests
          └──────────────┬────────────────┘
                         │ calls methods (place, move, collect, …)
                         ▼
          ┌──────────── state ────────────┐
          │ City Player Services Clock    │   the rules and the data
          │ Taxes  (+ pure rule modules)  │
          └──────────────┬────────────────┘
                         │ emits events (added, coins, taxDay, …)
                         ▼
          ┌──────────── views ────────────┐
          │ CityView LandView PeopleView   │   draw what the state says
          │ IncomeView  Hud                │
          │ TaxPanel TownPanel LandPanel   │
          │ CropPicker  LevelUpPanel       │
          └───────────────────────────────┘
```

- **State** (`City`, `Player`, `Services`, `GameClock`, `Taxes`) knows the rules and holds the data.
  The rules themselves are pure functions and data in modules beside them:
  `buildings.ts`, `crops.ts`, `land.ts`, `progression.ts`, `utilityRules.ts`, `taxRules.ts`.
  It never touches three.js or the DOM, so it can be unit tested in plain Node
  (`*.test.ts`) and saved as plain JSON.
- **Views** listen for state events and update the screen. They never change
  the game themselves.
- **Input** turns pointer and keyboard events into calls on the state.

This one-way flow is the same idea behind React, Redux and most game engines'
"model / view" split. The payoff: when the coin count changes, nobody has to
remember to update the counter, the catalog's greyed-out buttons and the tax
panel. Each of them is listening for `coins` and updates itself.

`Game.ts` is the only file that knows about everything: it creates each piece,
passes it what it needs and runs the frame loop. If you want to know how two
parts connect, start there.

## Events

State objects use a tiny observer pattern: `onChange(listener)` registers a
function, and `emit(event)` calls them all. Events are TypeScript
*discriminated unions*: each has a `kind`, and TypeScript narrows the type
inside `switch (event.kind)`.

| Source | Event | Fired when | Who listens |
|---|---|---|---|
| City | `added` | a building is placed or loaded | CityView (creates the 3D object), Taxes (opens an asset record) |
| City | `moved` | a building moves | CityView |
| City | `removed` | a building is demolished | CityView, IncomeView, Taxes (stops taxing it) |
| City | `collected` | income is collected | IncomeView (pop-up), Taxes (records income, adds sales tax) |
| City | `planted` | seeds go into a farm plot | IncomeView (seed cost pop-up), Taxes (farm expense) |
| City | `harvested` | a ripe crop is harvested | IncomeView (pop-up), Taxes (farm income) |
| City | `cleared` | a withered crop is cleared | IncomeView (pop-up) |
| City | `award` | prize coins are given (a level-up reward) | Taxes (other income) |
| City | `expense` | a running cost is paid (utility upkeep) | Taxes (operating expense) |
| City | `land` | a lot is bought, or a save loaded | LandView (ground and signs) |
| City | `coins` | the coin balance changes | Hud (counter, catalog), TaxPanel, LandView (sign affordability) |
| Services | `changed` | the utility report changed | Hud (utility line), TownPanel |
| Services | `shortage` | utilities just started falling short | Game → Hud warning toast |
| Player | `xp` | XP is earned | Hud (level and bar), Game → IncomeView "+2 ⭐" pop-up |
| Player | `levelUp` | a new level is reached | Game → LevelUpPanel, Hud (unlocks catalog items) |
| Player | `energy` | energy is spent, refilled or loaded | Hud, autosave |
| Taxes | `salesTax` | sales tax is collected on a sale | Game → IncomeView pop-up |
| Taxes | `remitted` | quarterly sales tax is sent | Game → Hud toast |
| Taxes | `taxDay` | the yearly return is filed | Game → TaxPanel report |
| Taxes | `penalty` | a late penalty is charged | Game → Hud toast |
| Taxes | `changed` | anything in the books changed | TaxPanel, autosave |

Order matters in one place: listeners must be registered **before** the town is
loaded, or they miss the `added` events. `Game`'s constructor creates the views
first and loads the save last.

## The frame loop

`renderer.setAnimationLoop` calls `Game.tick()` once per screen refresh:

1. Work out `dt`, the real milliseconds since the last frame.
2. `clock.advance(dt)` moves the calendar forward. For each month that just
   ended, `services.endOfMonth()` pays the utilities' running costs, then
   `taxes.endOfMonth(month)` runs: property tax and depreciation accrue,
   the quarter's sales tax is sent, and in December the return is filed.
3. The sun moves to stay over the point the camera looks at, so the shadow
   box (sharp, but only ~48 tiles wide) covers what's on screen.
4. `cityView.update(now)` swaps a farm plot's crop model when its look
   changes (sprout → young → grown → ripe → withered).
5. `peopleView.update(dt)` moves the walking residents.
6. `incomeView.update(now)` adds, changes or removes bubbles (coins, plant,
   harvest, withered) and refreshes the info card countdown.
7. `hud.update(clock, now)` refreshes energy (it refills with time, so it's
   checked every frame), the date and the month progress bar.
8. Draw the 3D scene, then the HTML labels on top.

Nothing in the game "ticks down". Timers are stored as **timestamps**
(`readyAt`) and compared with the current time. That's cheaper, survives the
tab being in the background, and makes offline progress automatic.

## Two kinds of time

| | Real time (`Date.now()`) | Play time (`GameClock`) |
|---|---|---|
| Used for | Income timers (`readyAt`), crops (`plantedAt`), energy (`energyAt`) | The calendar: months, quarters, Tax Day |
| Runs while the game is closed? | Yes, so rent is waiting and crops grow (or wither) while you're away | No |
| Why | Matches the genre: come back later and collect | Otherwise a week away would mean 800 years of tax bills |

Because everything on real time is a timestamp, coming back after a day
needs no catch-up simulation: asking each timer about *now* is the catch-up.
`offline.ts` only *counts* what's waiting for the "Welcome back" window
(shown when a save is at least 5 minutes old, or a hidden tab comes back
after 5 minutes). A crop counts as "withered while you were away" if its
wither time falls between when you left and now.

`GameClock` also caps each step at 250 ms, so a stalled browser can't skip
months in one frame, and has a development-only `speed` multiplier (`?speed=60`).

## 3D rendering

- **Camera:** an `OrthographicCamera` at `(20, 20, 20)` relative to its target,
  looking at it. Orthographic means no perspective, so this angle gives the
  classic isometric look. `CameraController` moves the *target* to pan and
  changes `camera.zoom` to zoom.
- **Picking:** to find what's under the pointer, `groundPointAt` shoots a ray
  from the camera through the pixel (`Raycaster`) and intersects it with the
  ground plane `y = 0`. `worldToTile` turns that point into a tile. We never
  raycast against building meshes: the `City` occupancy grid answers "what's on
  this tile?" instantly.
- **Grid:** tiles are 1 world unit. The map is centered on the origin, so tile
  `(x, z)` has its center at `(x − 10 + 0.5, 0, z − 10 + 0.5)`. A building's
  `tile` is its footprint's lowest corner; `footprintCenter` finds the middle.
- **Models:** `models.ts` loads each `.glb` once (a cached promise), clones it
  per building, scales it to fit the footprint (capping height so trees stay
  tree-sized) and sits it on the ground. Until it loads, or if it fails, a
  placeholder shape built from boxes and cones is used.
- **Labels:** bubbles, pop-ups and the info card are HTML elements placed by
  `CSS2DRenderer`, which converts a 3D point to screen pixels every frame. Two
  gotchas found the hard way, both commented in `style.css`:
  - It positions elements with `transform`, so margins don't move them; we use
    the separate `translate` property instead.
  - An element that is itself animating can lose clicks to the canvas below,
    so the bubble is a still button with an animated face inside.

## Farming: a state machine with no stored state

A plot's crop is stored as just `{ cropId, plantedAt }`. Its stage (empty,
growing, ripe, withered) is never saved or updated; `cropState()` in
`crops.ts` works it out from the timestamp and the crop's timings whenever
something asks. That's why crops keep growing while the game is closed, and
why there's nothing to keep in sync: the views ask for the state each frame
and only rebuild things when the answer changes.

Tapping a plot (`Builder.tap`, also used by bubbles) does whatever the stage
calls for: open the `CropPicker` on an empty plot, say how long is left on a
growing one, harvest a ripe one, clear a withered one.

Crops are drawn by `createCropObject` in `models.ts`. A plot has 4–16 plants
of a few shapes each; rather than hundreds of meshes, every shape of the same
color is merged into one geometry (`mergeGeometries`), so a whole plot is 2–4
draw calls.

## The world and land

The world is 60×60 tiles split into 6×6 lots of 10×10 (`grid.ts`). City
keeps the owned lots and what each cost; `canPlace` only allows owned tiles.
`canBuyLot` allows lots next to owned land; `land.ts` sets the rising price
and level. `LandView` draws the whole world as muted ground, owned lots as one
merged grass mesh with a grid, and a sign on every buyable lot.

## Utilities

`utilityRules.ts` turns the list of buildings into a report: population, and
for water, power and trash the supply (county + plants), demand and the
share met. `incomeMultiplier` turns that into how much of its income each
building earns. `Services` recomputes the report when buildings are added or
removed, plugs `City.incomeMultiplier` into it (so `City.collect` and
`City.harvest` pay the reduced amount, and stay testable without Services),
and pays running costs at each month's end via `City.payExpense`.

Supply is town-wide, as if every building were connected to every pipe and
wire. That keeps it understandable; coverage areas or pipes could come later.

## Roads and community buildings

Roads are ordinary 1×1 buildings (category `road`), so placing, saving,
demolishing and taxes all work as for anything else. Two things are special:

- **Drawing.** In road mode, `Builder` sets `CameraController.paint`, so a
  one-finger drag paints tiles instead of panning. A fast drag skips tiles
  between pointer events, so `paintRoad` fills in every tile from the last
  one painted.
- **Rendering.** `CityView` gives roads an empty placeholder; `RoadView`
  rebuilds the whole network, merged into one mesh per color, at most once a
  frame after a change. Each tile's shape comes from `roadMask`, a 4-bit
  number of which neighbors are roads (bitmask autotiling).

Community buildings have an `amenity: { bonus, radius }`. `locationBonus`
(`communityRules.ts`) sums the amenities whose footprint is within `radius`
tiles of a home or shop, adds `ROAD_BONUS` if one touches a road, and caps it.
`Services` recomputes every building's bonus when anything is added, moved or
removed, and gives City two hooks:

- `incomeMultiplier(b)` = utility share × (1 + bonus): what it earns,
- `valueMultiplier(b)` = 1 + bonus: what it's worth, for property tax.

## People

`PeopleView` is purely visual: nothing is saved and nothing affects the
game. Homes send out about one walker per two residents (max 40). A walker
picks a destination (a shop or park half the time), finds a path with A*
(`pathfinding.ts`, through owned tiles that are empty or road, with grass
costing 2.5× a road step so paths stick to roads), walks it tile by tile,
lingers longer in parks, pauses, and goes on or goes home. If something gets built in its way,
it plans again from where it stands.

## XP, levels and energy

`Player` watches City the same way `Taxes` does, so neither City nor the input
code knows these rules exist:

- `added` with `paid > 0` → XP for building (free and loaded buildings give none),
- `collected` / `harvested` → XP, and 1 energy,
- `planted` (paid) / `cleared` → 1 energy.

Energy is checked *before* an action, by the code that handles the tap
(`Builder.tap`, `CropPicker`), and spent *after* it, when City reports that
it happened. So a tap that does nothing (a building that isn't ready) never
costs energy.

Energy is stored as a value and the time it was true (`energy`, `energyAt`),
the same trick as crops: `Player.energy(now)` adds one point per full regen
period since then. When spending, the clock only moves forward by the whole
periods already counted, so partial progress toward the next point is kept.

Levels come from XP with a formula (`levelForXp`), never stored. Each new
level calls `City.awardCoins`, which emits `award` so Taxes can record the
prize as income.

## Saving

### Save versions

`upgradeSave` in `save.ts` brings any older save up to date one version at a
time. Version 1 (the 20×20 map) → 2 moves every building 20 tiles so it lands
in the middle of the 60×60 world, and adds the starting lots.
`save.test.ts` checks it with a real version 1 save.

`save.ts` stores one JSON document in `localStorage` under `hearthvale.save`:

```jsonc
{
  "version": 1,
  "savedAt": 1761700000000,
  "city":  { "coins": 271, "nextId": 7, "buildings": [
    { "id": 1, "typeId": "cottage", "tile": { "x": 9, "z": 9 }, "readyAt": 1761700030000, "crop": null },
    { "id": 2, "typeId": "farm-plot", "tile": { "x": 12, "z": 9 }, "readyAt": 0, "crop": { "cropId": "wheat", "plantedAt": 1761700000000 } }
  ] },
  "clock": { "playedMs": 812345 },
  "taxes": { "ledger": { … }, "salesTaxHeld": 3, "lastReturn": { … }, "assets": [[1, { "basis": 100, "depreciated": 4.2, "placedMonth": 0 }]] },
  "player": { "xp": 52, "energy": 9, "energyAt": 1761700000000 }
}
```

- **What's saved:** only data. Buildings are saved by `typeId`, not by copying
  the type, so changing a building's stats in `buildings.ts` applies to old
  saves. If a type is removed, `City.load` skips those buildings with a
  warning instead of failing. A *renamed* type goes in `RENAMED_BUILDING_IDS`
  (the Stage 4 `wheat-field` → `farm-plot` rename is the first), so old
  saves keep their buildings.
- **Additive changes don't need a version bump.** Stage 4 added `crop` to
  buildings and farm lines to the tax books; the loaders fill in defaults
  when they're missing (`crop: null`, `farmIncome: 0`), so older saves load as is.
  Stage 5 added `player`; a save without it starts at level 1 with full energy.
- **When:** `AutoSaver` saves one second after any change, batching bursts into
  one write, and immediately when the tab is hidden or closed (`pagehide`,
  `visibilitychange`).
- **Loading order:** clock, then city, then taxes (see the comment in
  `Game.loadOrSeed`).
- **Versioning:** bump `SAVE_VERSION` when the format changes in a way old
  saves can't simply default (like moving every tile), and add a step to
  `upgradeSave` (see "Save versions" above).
- **Safety:** every `localStorage` call is wrapped in `try/catch`. Private
  windows and strict browser settings can block storage, and the game still runs
  without it.

## Layers on screen

From bottom to top: the WebGL canvas, the map labels (`.labels`, z-index 1:
bubbles, pop-ups, info card), the HUD (`.hud`, 2), and windows (`.overlay`,
10: Taxes, Tax Day, crop picker). CSS2DRenderer sets each label's z-index
every frame to sort them by depth; because `.labels` is its own stacking
context, those numbers can't lift a label above the HUD or a window.

## Adding things

- **A new building:** add an entry to `BUILDING_TYPES` in `buildings.ts`, with
  an optional `model: suburban('…')` from `public/models/suburban/`. The
  catalog, placement, income, property tax and depreciation all pick it up
  automatically.
- **A new crop:** add an entry to `CROP_TYPES` in `crops.ts` with its timings,
  prices and `look` (one of the plant shapes in `createCropObject`). The
  picker, bubbles, growth stages and taxes pick it up. `crops.test.ts` checks
  that it pays back its seeds and fits the speed-vs-profit curve.
- **A new tax rule:** put the constant or formula in `taxRules.ts` with a
  comment naming its real-world source, apply it in `Taxes.ts`, test it in
  `Taxes.test.ts`, and explain it in `docs/TAXES.md` and the in-game explainer
  (`TaxPanel.explainer`).
- **A new HUD element:** add it in `Hud.ts`, use `el()` from `ui/dom.ts`
  (which sets `textContent`, never `innerHTML`), style it in `style.css`, and
  remember `.hud` has `pointer-events: none`, so interactive elements need
  `pointer-events: auto`.

## Testing

- `npm test` runs the unit tests. They cover the rules: placement, occupancy,
  costs, income timing, crop stages, planting and harvesting, save round-trips
  (including old saves), every tax and the bookkeeping across months and years.
- Rendering and input are checked by playing the game. With `?speed=60` a full
  tax year takes 12 seconds.
