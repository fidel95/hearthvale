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

## Coming next

- **Stage 8:** a supply chain, with cost of goods sold as a real deduction.
