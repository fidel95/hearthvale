# Learning journal

What each stage of Hearthvale teaches, where to find it in the code, and
exercises to try. Read the files alongside this; the comments in the code pick
up where this leaves off.

---

## Stage 0: a 3D scene in the browser

**Files:** `index.html`, `src/main.ts`, `src/game/Game.ts`

- **The toolchain.** Vite serves TypeScript straight to the browser in
  development and bundles it for production. `tsconfig.json` turns on `strict`
  mode, so TypeScript catches `null`s and typos before you run anything.
- **The three.js trio:**
  - the *scene* holds every object,
  - the *camera* decides what's visible,
  - the *renderer* draws the scene through the camera onto a `<canvas>`.
- **Orthographic vs. perspective cameras.** A perspective camera makes distant
  things smaller, like your eyes. An orthographic one doesn't. Put an
  orthographic camera at `(20, 20, 20)` looking at the origin and you get the
  isometric view classic city builders use.
- **Lights and shadows.** A `HemisphereLight` gives soft sky/ground fill. A
  `DirectionalLight` is the sun; it casts shadows from objects with `castShadow`
  onto objects with `receiveShadow`.
- **The game loop.** `setAnimationLoop` calls `tick()` once per screen refresh.

**Try it:** change the camera offset in `CameraController.ts` to
`(20, 30, 20)`. What happens to the view angle? Then change the sun's position
in `Game.addLights` and watch the shadows move.

---

## Stage 1: from a mouse click to a tile

**Files:** `src/game/CameraController.ts`, `src/game/grid.ts`

- **Coordinate spaces.** A click arrives as screen pixels; three.js wants
  *normalized device coordinates* (−1 to 1, with +Y up); the game wants tiles.
  `groundPointAt` and `worldToTile` convert between them.
- **Raycasting.** Shoot a ray from the camera through the clicked pixel and
  find where it hits the ground plane (`y = 0`). It's just a line-plane
  intersection; no meshes involved.
- **"Grab the ground" panning.** Remember the ground point under the pointer
  when the drag starts, then keep moving the camera so that point stays under
  the pointer. Zoom-toward-cursor and pinch zoom reuse the same trick.
- **Click vs. drag.** A press only becomes a drag after moving 5 px, so shaky
  clicks still count as clicks.
- **Pointer events.** One API for mouse, pen and touch. Each finger has its
  own `pointerId`, which is how pinch works. `setPointerCapture` keeps events
  coming when the pointer leaves the canvas.

**Try it:** add keyboard panning with the arrow keys. Hint: change
`controls.target` and call the same code `apply()` uses.

---

## Stage 2: data-driven buildings

**Files:** `buildings.ts`, `City.ts`, `CityView.ts`, `models.ts`, `Builder.ts`

- **Data, not code.** Every building is an entry in `BUILDING_TYPES`. Adding a
  building means adding data; placement, income, taxes and the UI all pick it
  up.
- **Separating state from view.** `City` stores what's where and enforces the
  rules, with no 3D code. `CityView` listens for its events and keeps 3D
  objects in sync. Because of that split, `City` can be unit tested and saved
  as JSON.
- **An occupancy grid.** A flat array with one slot per tile (`z * 20 + x`)
  answers "what's here?" in one step, with no raycasting against models.
- **Discriminated unions.** `Mode` and `CityEvent` are unions with a `kind`
  field. Inside `switch (mode.kind)` TypeScript knows exactly which fields
  exist; for example, `mode.type` is only reachable in build mode.
- **Async loading with a cache.** `models.ts` stores *promises* in a `Map`, so
  ten cottages trigger one download. Objects appear immediately as empty groups
  and fill in when the model arrives.
- **Fitting arbitrary models.** Measure a model's bounding box, scale it to the
  footprint, then move it so its base sits on the ground.

**Try it:** add a building. Pick a model from `public/models/suburban/`, add an
entry with `model: suburban('building-type-m')`, and give it a size, a cost and
income. No other code changes are needed.

---

## Stage 3: an economy on timers

**Files:** `City.ts` (`collect`, `readyAt`), `IncomeView.ts`, `ui/Hud.ts`

- **Timestamps, not countdowns.** Each building stores `readyAt`, a moment in
  time. Nothing decrements every frame; we just compare `now >= readyAt`. It's
  cheaper, survives background tabs, and makes offline progress free.
- **HTML in a 3D world.** `CSS2DRenderer` moves ordinary HTML elements to the
  screen position of 3D points every frame, so the bubbles get CSS styling
  and animation.
- **One-way data flow.** `City` changes coins and announces it. The counter,
  the catalog's greyed-out buttons and the tax window each update themselves.
- **Bugs worth remembering:**
  - Clicks on an element that is itself animating fell through to the canvas.
    The fix: a still button with an animated child.
  - `CSS2DRenderer` positions with `transform`, so `margin` does nothing; use
    the `translate` property.

**Try it:** make homes pay a bonus if collected within 5 seconds of being
ready. Where should that rule live: in `City`, in `IncomeView`, or in
`buildings.ts` data? (Answer: the rule goes in `City.collect`, the bonus amount
in the building data.)

---

## Stage 3.5: saving, a calendar and taxes

**Files:** `save.ts`, `GameClock.ts`, `taxRules.ts`, `Taxes.ts`, `ui/TaxPanel.ts`,
the `*.test.ts` files, and [TAXES.md](TAXES.md)

- **Serialization.** Save *data*, not objects: buildings are saved by `typeId`,
  so changing a building's stats updates old saves. Loading rebuilds the town
  by replaying `added` events, so the views need no special loading code.
- **Defensive storage.** `localStorage` can throw (private mode) or hold
  garbage, so every access is in `try/catch`, and the format carries a
  `version` for future upgrades.
- **Debouncing.** Autosave waits one second after the last change, so a burst
  of changes is one write. It also saves immediately on `pagehide`.
- **Two clocks.** Income uses real time; the calendar uses play time. The
  [architecture doc](ARCHITECTURE.md#two-kinds-of-time) explains why mixing
  them up would be a disaster.
- **Pure functions.** `taxRules.ts` has no state: same input, same output. That
  makes it trivial to test and easy to trust.
- **Accrual accounting.** Property tax and depreciation build up month by
  month and are paid later. Sales tax is a *liability*: coins you hold but
  owe.
- **Unit tests.** `npm test` runs 26 tests in under a second. They pin down
  the rules (brackets, rounding, quarter ends, Tax Day, penalties, saves), so
  refactors can't silently break them.
- **Real-world modeling.** Every tax rule has a real counterpart, and
  [TAXES.md](TAXES.md) explains each one. While building it we caught a
  mistake: demolition losses aren't deductible in the US (IRC §280B). Good
  documentation forces you to check your assumptions.

**Try it:**

1. Change `SALES_TAX_RATE` to `0.1`, run `npm test`, and read which tests fail
   and why. Then put it back.
2. Run `npm run dev`, open `http://localhost:5173/?speed=60`, build a few
   shops, and watch a year go by in 12 seconds. Open the Taxes window before
   and after Tax Day.
3. Add the 25% cap on late penalties (see "What the game simplifies" in
   TAXES.md), with a test.

---

## Stage 4: farms

**Files:** `crops.ts`, `City.ts` (`plant`, `harvest`, `clearPlot`),
`Builder.tap`, `CityView.update`, `models.ts` (`createCropObject`),
`ui/CropPicker.ts`, and the farm section of [TAXES.md](TAXES.md)

- **A state machine you don't store.** A crop goes empty → growing → ripe →
  withered, but the save only holds `{ cropId, plantedAt }`. `cropState()`
  derives the stage from the clock. No timers, no "update every second", and
  offline growth comes free. If a value can be computed from data you already
  have, don't store it: stored copies drift out of sync.
- **Discriminated unions again.** `CropState` only has `readyAt` when it's
  `growing` and `witherAt` when it's `ripe`; TypeScript won't let you read a
  field that doesn't exist in the current stage.
- **Change detection.** Every frame, `CityView` asks each plot what it should
  look like and compares a short key (`"wheat:young"`) with what it built last
  time. Only when the key changes does it rebuild, a handful of times per
  crop instead of 60 times a second. `IncomeView` does the same for bubbles.
- **Draw calls.** A GPU draws each mesh with a separate "draw call", and
  hundreds of tiny ones get slow, especially on phones. Merging every
  same-colored shape of a plot with `mergeGeometries` turns ~60 meshes into
  2–4. And since each plot's merged geometry is unique, it's `dispose()`d when
  replaced, or the GPU memory would leak.
- **Game design as numbers.** Quick crops earn the most per minute but need
  you around; slow crops earn less per minute but survive a night away.
  `crops.test.ts` checks that curve, so a typo in a price can't quietly make
  one crop better at everything.
- **Renaming without breaking saves.** The old `wheat-field` became
  `farm-plot`. Saves store type ids, so `RENAMED_BUILDING_IDS` maps old ids to
  new ones, and a test loads a pre-Stage-4 save to prove it.
- **The tax side.** Seeds are a farm expense deducted when bought (the cash
  method), harvests are farm income, and crops sold wholesale have no sales
  tax. A withered crop gives no extra deduction, since its cost was already
  deducted once.
- **A stacking bug.** Pop-ups use `z-index: 1000` to beat other labels, which
  also put them on top of the crop picker. Giving `.labels` its own stacking
  context (`z-index: 1`) keeps label z-indexes competing only with each other.

**Try it:**

1. Add a crop: carrots, 10 minutes, a `bush` look with orange fruit. Run
   `npm test`. Does it fit the speed-vs-profit curve? Adjust its price until
   it does.
2. Make withered crops cost something to clear (real farms pay to clear
   ruined fields). Where does the cost go, and should it be deductible?
   (It should: it's a farm expense.)
3. Show a progress bar on growing plots' info cards using
   `cropState(...).progress`.

---

## Stage 5: XP, levels and energy

**Files:** `progression.ts`, `Player.ts`, `ui/LevelUpPanel.ts`, `ui/Hud.ts`,
`Builder.tap`, `ui/CropPicker.ts`

- **Derive, don't store (again).** The save holds total XP, not the level;
  `levelForXp` computes it. Energy is a value plus a timestamp, and the
  current amount is computed. Same lesson as crops: fewer stored numbers,
  fewer ways to disagree.
- **Curves as formulas.** XP per level grows by 10 each level, so the total is
  `5·k·(k+1)`. A formula covers every level forever; a hand-written table
  would end and need editing. Tests pin the first values so changes are deliberate.
- **Check first, spend after.** Input code asks `hasEnergy()` before acting;
  Player spends energy when City *reports* the action. That way a tap that
  turns out to do nothing costs nothing, and energy logic lives in one place.
- **Partial progress.** When you spend energy mid-refill, the regen clock
  keeps the time you'd already waited. Getting that wrong (resetting the
  clock on every spend) is a classic bug, and there's a test for it.
- **Injecting the clock.** `new Player(city, () => time)` lets tests control
  time exactly; the game passes nothing and gets `Date.now`.
- **A loop that can't miss levels.** One big action can cross two levels.
  `addXp` loops over every level crossed, so each one's reward is paid.
- **A bug from editing by search-and-replace.** The HUD's level display was
  first inserted *inside* the coin listener because the search text appeared
  there too, so every coin change added another listener. The browser test
  showed the label missing at start. Lesson: after automated edits, read the
  result, and test what the screen shows.
- **The tax side.** Level rewards are prizes, and prizes are taxable income
  (IRC §74). City emits an `award` event for them so Taxes can tell a prize
  from a plain coin adjustment.

**Try it:**

1. Change `ENERGY_REGEN_MS` to 30 seconds and play a few minutes. Does the
   game feel better or worse? Why do you think the genre limits energy at all?
2. Add XP for planting (1 per planting). Which test needs updating?
3. Give level 5 a special reward: a free decoration placed next to your
   biggest building.

---

## Stage 5.5: land, utilities and people

**Files:** `grid.ts` (lots), `land.ts`, `LandView.ts`, `ui/LandPanel.ts`,
`save.ts` (`upgradeSave`), `utilityRules.ts`, `Services.ts`,
`ui/TownPanel.ts`, `pathfinding.ts`, `PeopleView.ts`

- **Changing the world size breaks every save.** Tile (9, 9) on the old
  20×20 map is a different place on the 60×60 one. Rather than throw old saves
  away, `upgradeSave` converts them, one version at a time, and a test feeds
  it a real version 1 save. Versioned data plus step-by-step upgrades is how
  real apps change their file formats and databases ("migrations").
- **Sets of objects need keys.** `{x: 2, z: 3} !== {x: 2, z: 3}` in JavaScript,
  so owned lots live in a `Map` keyed by the string `"2,3"`.
- **Rules vs. bookkeeping, again.** `utilityRules.ts` is pure: buildings in,
  report out. `Services` applies it over time and pays the bills. City only
  knows "a building earns `incomeMultiplier(b)` of its income", which keeps
  City's tests working without utilities at all.
- **Capital vs. operating costs.** A plant's price is depreciated over years;
  its running cost is deducted each year. The Power Plant vs. Solar Farm choice
  makes the trade-off concrete, with real recovery periods.
- **A* pathfinding.** Explore tiles in order of "steps so far + estimated
  steps left". With a guess that never overestimates (Manhattan distance on a
  4-way grid), the first path to the goal is a shortest one. A **binary heap**
  hands out the most promising tile in O(log n) instead of scanning a list.
- **Visual-only systems.** `PeopleView` changes nothing and saves nothing, so
  it can use `Math.random` freely. Keeping it out of the game state means it
  can't cause bugs in the rules, and the rules' tests don't need to know it exists.
- **Shadows on a big map.** A shadow map is one texture over a box. Stretching
  it over 60×60 tiles would blur every shadow, so the sun follows the camera
  and its box covers what's on screen.
- **Two bugs worth remembering:**
  - On macOS, `services.ts` and `Services.ts` are the *same file*: the file
    system ignores case. Writing the second replaced the first. That's why
    the rules file is `utilityRules.ts`.
  - Loading a town that was already short fired three warnings at once; now
    one `shortage` event lists every utility.

**Try it:**

1. Add a Water Treatment Plant: bigger and pricier than the tower, but
   supplying 60. Where do its numbers go, and what's its real recovery
   period? (Water utility property: 25 years.)
2. Make trash visible: when trash pickup is short, scatter a few bags near
   homes in `CityView`.
3. Give walkers a favorite shop: the nearest business to their home.
   `findPath` gives you the distance.

---

## Stage 6: welcome back

**Files:** `offline.ts`, `ui/WelcomeBackPanel.ts`, `Builder.collectAll`,
`Game.setUpWelcomeBack`, `save.ts` (`upgradeSave`, from Stage 5.5)

- **Timestamps pay off.** Many games "simulate" the hours you were away,
  tick by tick. Because every timer here is a timestamp, the town is already
  up to date the moment it loads. `awaySummary` just counts what's waiting.
- **Asking about the past.** "Did this crop wither while I was away?" is
  "is its wither time between when I left and now?" No history needed, only
  the same numbers the crop already has.
- **Two ways to leave.** Closing the game is detected from the save's
  `savedAt`; hiding the tab is detected with `visibilitychange`. Both feed
  the same window.
- **Convenience vs. the game's rules.** Collect all still spends ⚡1 per
  pickup and stops when energy runs out, so a shortcut doesn't break the
  pacing the energy system exists for.

**Try it:**

1. Add "🏗️ N plots empty" to the summary, so the player knows to replant.
2. Change `WELCOME_BACK_AFTER_MS` to 10 seconds, switch tabs and come back.

---

## Stage 7: roads and community

**Files:** `communityRules.ts`, `RoadView.ts`, `Builder.paintRoad`,
`CameraController.paint`, `pathfinding.ts` (costs), `Services.ts` (bonuses),
`ui/Hud.ts` (catalog tabs)

- **Bitmask autotiling.** Each road tile asks its four neighbors "are you a
  road?" and packs the answers into 4 bits: 16 possible shapes, picked with
  no if-else chains. Many 2D games tile walls, water and paths this way.
- **Rebuild once per frame.** Dragging a road can add 10 tiles in one frame.
  RoadView marks itself dirty and rebuilds once in `update()`, not 10 times.
  This "dirty flag" pattern shows up everywhere in UI and game code.
- **Weighted A*.** Give each step a cost instead of counting steps, and A*
  finds the cheapest path. Roads cost 1, grass 2.5, so walkers detour to a
  road when it's worth it. The heuristic must never overestimate, which holds
  as long as no step costs less than 1.
- **Input modes.** The same drag pans the camera, or paints roads. The
  controller doesn't know about roads; Builder lends it a `paint` function
  while road mode is on. Small hooks like this keep classes independent.
- **Location, location, location.** Amenities raise income and value with
  one number, `valueMultiplier`, which Taxes uses for property tax: the real
  link between a nice neighborhood and a higher tax bill.
- **Balance bugs are bugs.** Roads first gave 1 XP per tile, making a scribble
  of road the fastest way to level. A playtest (the screenshot was full of
  "+1 ⭐") caught it; `buildXp` now rounds down, with a test for road tiles.
- **Testing with a frozen clock.** Playwright waits for an element to stop
  moving before clicking it, which needs animation frames, which a frozen
  test clock never delivers. The browser tests click through the DOM instead.

**Try it:**

1. Add a Library: 2×2, +5% within 8 tiles, cheap to run. Only data changes.
2. Make roads required: homes with no road beside them earn half. Where
   does that rule belong? (In `locationBonus`, or next to it in `Services`.)
3. Give RoadView crosswalks at junctions (`links.length >= 3`).

---

## Stage 8: the coast, goods and docks

**Files:** `terrain.ts`, `LandView.ts` (sea, beach), `ShipView.ts`, `Docks.ts`,
`ui/DockPanel.ts`, `City.ts` (goods), `Taxes.ts` (inventory), `supply.test.ts`

- **Procedural terrain.** The coast is `46 + 2·sin(x/5) + sin(x/2.3 + 1)`.
  Two waves of different lengths look natural, and because it's a formula, not
  random, every world and every test sees the same coast.
- **Animating vertices.** The sea is strips of quads whose vertices move up and
  down each frame. With `flatShading`, lighting comes from each triangle's
  shape on the GPU, so there are no normals to recompute. Boats sample the
  same wave formula so they ride the swell.
- **Position as a function of time.** A cargo ship's position is computed from
  `orderedAt` and `arrivesAt` and the clock, not moved a little each frame.
  It's in the right place after a reload, or after an hour away, for free.
  Same idea as crops and energy, now for something that moves.
- **Inventory is an asset.** Buying goods isn't an expense; selling them is.
  The average cost method turns "which goods did we sell?" into one division.
  The tests check a concrete case: 80 goods costing 240, sell 4, deduct 12.
- **Design that keeps old play working.** Harvests only go into storage once
  you have a shop; until then they're sold like before, so a new town (and
  every older test) still earns from farming.
- **A circular import that isn't.** City imports `edgeTiles` from
  `communityRules.ts`, which only imports *types* from buildings and grid.
  Type-only imports disappear when compiled, so there's no runtime cycle.

**Try it:**

1. Add a Fish Market: a shop that only needs goods from fishing boats. What
   new state would a fishing trip need? (Look at how `Docks` stores a shipment.)
2. Make the container ship's price change with the season, using `GameClock.month`.
3. Switch inventory to FIFO: keep a list of batches `{ units, costPerUnit }`
   and sell from the oldest. Which test changes?

---

## Stage 9: the new interface, building systems, quests and collections

**Files:** `ui/Sheet.ts`, `ui/Hud.ts`, `ui/BuildMenu.ts`, `ui/thumbnails.ts`,
`ContextMenu.ts`, `ui/BuildingPanel.ts`, `construction.ts`, `projects.ts`,
`Inventory.ts`, `items.ts`, `collections.ts`, `quests.ts`, `ui/QuestsPanel.ts`,
`ui/InventoryPanel.ts`, `ui/CollectionsPanel.ts`, `ui/MapPanel.ts`

- **One component instead of five copies.** Every window had its own overlay,
  header, close button and Escape handling. `Sheet` and `Modal` now hold that
  once; each panel just fills a body. When the look changed (bottom sheets
  instead of centered windows), it changed in one place.
- **Design around the content.** Sheets cover the bottom of the screen, not
  all of it, and tapping the map closes them. Top-bar stats double as
  buttons, so the most-used windows need no extra buttons.
- **Rendering to an image.** The build menu's thumbnails come from a second,
  offscreen three.js renderer: render once, `toDataURL`, cache. Models load
  asynchronously, so each object carries a `ready` promise to wait for.
- **Check everything, then change anything.** Finishing and upgrading touch
  City, Inventory and Player. `projects.ts` checks all of them before changing
  any, and returns *why* when it can't (`{ ok: false, reason: 'materials',
  missing }`), which the UI turns into a message and a Buy button. A typed
  result like this beats throwing errors for expected situations.
- **Keeping identity.** Storing a building keeps the same object and id, so
  everything keyed by that id (its tax record) survives the trip.
- **Stats as the source of truth.** Quests and achievements both read lifetime
  counters built from events. A quest remembers the counters' values when it
  started, so "collect rent 3 times" counts from then.
- **Injectable randomness.** Collections take a `random` function; the game
  passes `Math.random`, the tests pass a list of numbers, so "a drop happens"
  can be tested exactly.
- **Real tax rules for new systems.** Materials and upgrades are capitalized
  (added to basis), depreciation starts when a building is placed in service,
  stored buildings pay no property tax, and quest and collection rewards are
  taxable prizes.
- **Bugs worth remembering:**
  - Switching modes while a building waited for ✓ crashed: the old ghost was
    removed and *then* the pending placement redrawn. Order of cleanup matters.
  - Sheets looked faded in phone screenshots: the slide-in animation also
    faded them in, and the screenshot caught it halfway. Sliding without
    fading reads better anyway.

**Try it:**

1. Add a material (🧶 rope?) and give the Dock a need for it. Where do icons,
   prices and the build menu pick it up?
2. Add a quest: "Upgrade three buildings to ★★". Is it a `stat` task or a `have` task?
3. Make collection drops a little likelier for buildings near a Park.

---

## Stage 9.5: balancing

**Files:** `balance.ts`, `balance.test.ts`, `scripts/balance.gen.ts`,
`safetyNet.ts`, [BALANCE.md](BALANCE.md)

- **Principles before numbers.** "Early actions are quick", "nobody gets stuck",
  "one mechanic per level": written down first, they turn a vague "does it
  feel right?" into questions with answers.
- **A worksheet generated from the code.** A spreadsheet typed by hand drifts
  the day someone changes a price. `balance.ts` computes the worksheet from
  the same catalogs the game uses, and `npm run balance` writes it out as
  Markdown, JSON and CSV.
- **Principles as tests.** Each principle is a test over the worksheet:
  payback times, timer lengths, one new mechanic per level, bigger buildings
  paying more. A price change that breaks a principle now fails `npm test`.
- **Payback.** `initial cost ÷ coins per cycle` (with materials counted at
  their price, and a shop's goods at what they'd cost to ship in). It's the
  simplest way to compare investments, and the same idea as a real business's
  payback period.
- **Finding the dead end.** Listing every resource and how it recovers showed
  exactly one state with no way out: nothing that earns, and too little to
  build something that does. One small rule (the county grant) fixes it, and
  a test proves the stuck state can be escaped.
- **Writing tests that survive rebalancing.** The first tests had numbers
  like "15 energy" baked in, so changing the energy rules broke eleven of
  them. They now ask the game (`maxEnergy(1)`, `COUNTY_SUPPLY`) instead.
- **Running TypeScript tools with the test runner.** The generator imports
  game code that uses Vite features (`import.meta.env`), so it runs under
  Vitest with its own config rather than plain Node.

**Try it:**

1. Change the Cottage's rent to 25 and run `npm test`. Which principle fails, and why?
2. Add a "per tile per minute" column to the worksheet. Which building is
   the best use of land?
3. Write a principle of your own (e.g. "no crop is better than another at
   everything") and a test for it.

---

## Stage 9.6: the data model

**Files:** [DATA_MODEL.md](DATA_MODEL.md), `buildings.ts` (`footprint`),
`City.ts` (`rotation`, `lastCollectedAt`), `save.ts` (version 3),
`settings.ts`, `tutorial.ts`, `ui/Coach.ts`

- **Definitions vs. instances.** A definition is the *kind* of building (cost,
  size, income); an instance is *this one*, in your town (where, turned how,
  when last collected). Definitions are data in code; instances are state in
  the save. Adding a building touches only the data.
- **Timestamps instead of progress values.** A design might store
  `constructionProgress: 0.4` or `lastProducedAt`. Hearthvale stores *when*
  things end (`construction.endsAt`, `readyAt`) and computes progress from
  the clock. A stored progress value would need updating every frame, and
  would stop while the game is closed.
- **Derived data.** Level comes from XP and population from the buildings, so
  they're computed, not stored; the save keeps a copy only to be readable.
- **Rotation changes geometry, not just looks.** Turning a 3×2 building makes
  it 2×3. Everything that asked `type.size` now asks `sizeOf(building)`, and
  the compiler helped find all 25 places.
- **Moving hardcoded data into data.** The starting town was a list in
  `Game.ts`; it's now `STARTING_TOWN` in `land.ts`. Walkers lingered in "the
  park" by id; now any building with `attractsVisitors` does.
- **A save format people can read.** Version 3 groups the file by what it
  describes (player, resources, land, buildings, quests, inventory, settings,
  tutorial), and `upgradeSave` converts any older save, tested with a real
  version 1 and version 2 file.

**Try it:**

1. Add a Town Hall definition with `populationCapacity: 60` and nothing else.
   What does the build menu show, and which test tells you if it breaks balance?
2. Give the Cottage an explicit `xpReward: 8`. Where does it show up?
3. Open your browser's developer tools, look at `localStorage['hearthvale.save']`,
   and find your town's coins and your newest building.

---

## Stage 10: decorations and more buildings

**Files:** `buildings.ts` (the new entries), `communityRules.ts`
(`MAX_DECOR_BONUS`), `models.ts` (new shapes), `ui/BuildMenu.ts` (ordering)

- **The payoff of data-driven design.** Five homes, four shops, two community
  buildings and six decorations: almost all of it is new entries in
  `buildings.ts`. The build menu, thumbnails, details, placement, taxes, the
  balance worksheet and the balance tests picked them up without changes.
- **Checking new content against the principles.** The balance tests
  immediately check every new building: does each home cost more and pay more
  than the one before? Is the new level's mechanic count still one?
- **Caps inside caps.** Decorations are cheap, so their bonuses get their own
  +10% cap inside the overall +40%. Otherwise the best strategy would be
  "surround everything with trees", and parks and schools would stop mattering.
- **Seeing your assets.** A throwaway page rendered every model in the pack
  with the thumbnail renderer, to pick which houses to use. Tools you build
  for the game (like the thumbnail renderer) often pay off in places you
  didn't plan.
- **Sorting for the player.** Cards are ordered by unlock level, then cost, so
  each tab reads as a path from small to big, whatever order the catalog is in.

**Try it:**

1. Add a Gazebo: a decoration with `attractsVisitors`. Watch residents gather.
2. Give the Eco House a bonus for being near a Solar Farm. Where does that
   rule belong?
3. Use `building-type-l` (the dark modern house) for a new late-game home, and
   check the worksheet: does it fit between the Modern House and the Manor?

---

## Stage 11: neighbors

**Files:** `neighborData.ts`, `Neighbors.ts`, `Visit.ts`, `ui/NeighborsList.ts`,
`ui/MapPanel.ts` (tabs), `neighbors.test.ts`

- **Procedural generation with a seed.** `seededRandom(seed)` gives the same
  "random" numbers every time for the same seed, so a neighbor's town is
  generated, not stored, yet always the same. A second generator seeded with
  the day varies only what's ready to help with.
- **A second world.** Visiting builds a whole separate scene and City and
  reuses the same view classes. Because the views only talk to *a* City, they
  didn't need to change to draw someone else's town.
- **Shared resources and cleanup.** Model clones share geometry with the
  original. Freeing the visit's memory must skip that, or your own town's
  buildings would vanish. A `WeakSet` of shared geometries makes the rule
  explicit.
- **Days, not timers.** Daily limits reset by calendar date (`dayKey`), which
  is what a player means by "today".
- **The tax side.** Pay for help is income; gifts aren't income to the
  recipient (IRC §102) and aren't deductible to the giver.
- **Keeping the principles.** Neighbors are level 7's one new mechanic, so
  upgrades moved to level 10. The balance test caught the overlap the moment
  both were at 7.

**Try it:**

1. Add a sixth neighbor. What's the least code that takes?
2. Let a neighbor's request be goods instead of materials.
3. Make a Best friend tier unlock a rare collectible as a gift.

---

## Stage 11.5: the design spec

**Files:** [FEATURES.md](FEATURES.md), `production.ts`, `cityRating.ts`,
`sound.ts`, `src/data/quests.json`, `save.ts` (`readSave`, `importSave`)

- **Audit before you build.** Going through a spec line by line showed most
  of it was already there; the gaps were specific and small enough to list.
  FEATURES.md keeps that audit current.
- **One state function.** Several screens were each working out "is this
  ready?" in their own way. `productionState()` answers once, so they can't
  disagree.
- **Invariants that throw.** "Coins never go negative" is enforced where coins
  change: spending more than you have throws, so a bug shows up immediately.
  Bills that may exceed the balance go through `bill()`, which records debt.
- **Explainable scores.** The city rating is a sum of named parts with hints,
  not a mystery number. A score players can't understand feels arbitrary.
- **Data with checks.** Moving quests into JSON makes them editable without
  code; `data.test.ts` makes sure every id they mention exists.
- **Sound without assets.** Each sound is a few oscillator notes with an
  envelope: tiny, original, and offline.
- **Never lose a save.** An unreadable save is set aside, explained, and can
  be downloaded, instead of silently replaced.

## Refactor: one home per responsibility

**Files:** `GameState.ts`, `SaveSystem.ts`, `Economy.ts`, `ProductionSystem.ts`,
`PlacementSystem.ts`, `UnlockSystem.ts`, `events.ts`

- **Split by reason to change.** City held buildings, coins and every
  production action. Now `city.economy` changes when money rules change,
  `city.production` when timers do, and City itself only when the map does.
- **Mechanical renames, safety net of tests.** About 150 call sites moved from
  `city.collect(` to `city.production.collect(`. A search-and-replace plus the
  type checker plus 170 tests made that a ten-minute job, not a risky one.
- **One question, one answer.** The build menu, the builder and the ghost
  preview each had their own "can I place this?" logic. `PlacementSystem.check`
  returns every reason once; the screens just show `problems[0]`.
- **Quotes for the interface.** `upgradeQuote` and `landQuote` use the same
  checks as the actions, so a button can't be enabled when the action would
  refuse.
- **State without a screen.** `GameState` is the whole game with no three.js or
  DOM, so a test can build a town, save it, load it into a fresh one and check
  the two saves match exactly.

## The test plan

**Files:** [TESTING.md](TESTING.md), `src/tests/`, `scripts/offline-check.mjs`

- **Write the plan as tests, named after its lines.** Each item in the plan
  is a test with the same wording, so "is this covered?" is a search.
- **Compare the whole state.** "Invalid actions don't change anything" is one
  assertion: the full save before equals the full save after. It catches
  changes nobody thought to check.
- **Plans find bugs.** Two items failed when first written down: a "have 3
  homes" objective could un-complete if a home was removed before claiming,
  and a save with the right version but missing sections would crash on
  start. Both are fixed, and each test was checked to fail without its fix.
- **Prove offline by blocking the network**, not by reading the code: the
  browser check refuses every outside request and then goes fully offline
  while playing and saving.

---

## Stage 12: polish and deploy

**Files:** `scripts/serviceWorker.ts`, `scripts/sw-template.js`,
`src/serviceWorker.ts`, `public/manifest.webmanifest`, `src/game/quality.ts`,
`.github/workflows/deploy.yml`

- **A service worker is a tiny proxy in the browser.** It sees every request
  the page makes and can answer from its own cache. Ours downloads every file
  on install, answers from the cache, and so the game opens with no network.
- **Generate it at build time.** File names contain content hashes
  (`index-DxwPZerQ.js`), so the list of files to cache must come from the
  build. A 30-line Vite plugin writes it, plus a version made from the files'
  contents: change any file and the browser sees a new service worker.
- **Never update under the player's feet.** A new version installs and waits.
  The game saves, asks, and only then tells it to take over (`skipWaiting`)
  and reloads.
- **Relative paths make a build portable.** With `base: './'` the same files
  work at a domain's root or in a GitHub Pages project folder.
- **Measure, then adapt.** `QualityGovernor` watches the frame rate and lowers
  resolution, then shadows, a step at a time, and never steps back up mid-game
  so the picture doesn't flicker between settings. It's a pure class with tests.
- **Animate only what's new.** Buildings spring into place when built, but not
  while a saved town loads, and not with Reduce motion on.
- **Ship through CI.** The deploy workflow runs the tests before building, so a
  failing test blocks a release.

---

## Ideas for later

- Seasons and weather that change what crops grow best
- More model packs (a commercial district, a harbor town)
- State taxes alongside federal ones, or a second country's tax rules
