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
          │ City   GameClock   Taxes      │   the rules and the data
          └──────────────┬────────────────┘
                         │ emits events (added, coins, taxDay, …)
                         ▼
          ┌──────────── views ────────────┐
          │ CityView  IncomeView  Hud      │   draw what the state says
          │ TaxPanel                       │
          └───────────────────────────────┘
```

- **State** (`City`, `GameClock`, `Taxes`) knows the rules and holds the data.
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
| City | `coins` | the coin balance changes | Hud (counter, catalog), TaxPanel |
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
   ended, `taxes.endOfMonth(month)` runs: property tax and depreciation accrue,
   the quarter's sales tax is sent, and in December the return is filed.
3. `incomeView.update(now)` adds or removes collect bubbles and refreshes the
   info card countdown.
4. `hud.update(clock)` refreshes the date and month progress bar.
5. Draw the 3D scene, then the HTML labels on top.

Nothing in the game "ticks down". Timers are stored as **timestamps**
(`readyAt`) and compared with the current time. That's cheaper, survives the
tab being in the background, and makes offline progress automatic.

## Two kinds of time

| | Real time (`Date.now()`) | Play time (`GameClock`) |
|---|---|---|
| Used for | Income timers (`readyAt`) | The calendar: months, quarters, Tax Day |
| Runs while the game is closed? | Yes, so rent is waiting when you return | No |
| Why | Matches the genre: come back later and collect | Otherwise a week away would mean 800 years of tax bills |

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

## Saving

`save.ts` stores one JSON document in `localStorage` under `hearthvale.save`:

```jsonc
{
  "version": 1,
  "savedAt": 1761700000000,
  "city":  { "coins": 271, "nextId": 7, "buildings": [{ "id": 1, "typeId": "cottage", "tile": { "x": 9, "z": 9 }, "readyAt": 1761700030000 }] },
  "clock": { "playedMs": 812345 },
  "taxes": { "ledger": { … }, "salesTaxHeld": 3, "lastReturn": { … }, "assets": [[1, { "basis": 100, "depreciated": 4.2, "placedMonth": 0 }]] }
}
```

- **What's saved:** only data. Buildings are saved by `typeId`, not by copying
  the type, so changing a building's stats in `buildings.ts` applies to old
  saves. If a type is removed, `City.load` skips those buildings with a
  warning instead of failing.
- **When:** `AutoSaver` saves one second after any change, batching bursts into
  one write, and immediately when the tab is hidden or closed (`pagehide`,
  `visibilitychange`).
- **Loading order:** clock, then city, then taxes (see the comment in
  `Game.loadOrSeed`).
- **Versioning:** `SAVE_VERSION` must be bumped when the format changes, with
  an upgrade step in `readSave` (Stage 6).
- **Safety:** every `localStorage` call is wrapped in `try/catch`. Private
  windows and strict browser settings can block storage, and the game still runs
  without it.

## Adding things

- **A new building:** add an entry to `BUILDING_TYPES` in `buildings.ts`, with
  an optional `model: suburban('…')` from `public/models/suburban/`. The
  catalog, placement, income, property tax and depreciation all pick it up
  automatically.
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
  costs, income timing, save round-trips, every tax and the bookkeeping across
  months and years.
- Rendering and input are checked by playing the game. With `?speed=60` a full
  tax year takes 12 seconds.
