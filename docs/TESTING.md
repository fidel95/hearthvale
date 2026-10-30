# Testing

`npm test` runs every automated test (Vitest, in plain Node: the game rules
don't need a browser). The test plan below maps each item to the test that
checks it. The plan's suites live in `src/tests/`, one file per section, with
tests named after the plan's lines; the rest of the tests sit beside the code
they check (`src/game/*.test.ts`).

| Command | What it runs |
|---|---|
| `npm test` | All unit, data and test-plan tests |
| `npx vitest run src/tests` | Just the test plan |
| `npm run typecheck` | The TypeScript checker |
| `npm run balance` | Regenerates the balancing worksheet ([BALANCE.md](BALANCE.md)) |

## Placement — `src/tests/placement.test.ts`

| Plan item | Test |
|---|---|
| Reject placement outside unlocked land | rejects placement outside unlocked land |
| Reject overlapping footprints | rejects overlapping footprints |
| Reject placement when coins or materials are insufficient | rejects placement when coins are insufficient; rejects finishing construction or buying land when materials are short (materials are paid when construction finishes, not when placing) |
| Failed placement doesn't deduct resources | does not deduct anything when placement fails (the whole save is compared before and after) |
| Road-access requirements | enforces road access for shops |
| Moving updates the footprint | updates the footprint when a building moves or turns (and after reloading) |

## Economy — `src/tests/economy.test.ts`

| Plan item | Test |
|---|---|
| Collecting income increases the correct balance | adds collected income to the coin balance, and nothing else; pays debt from income before coins |
| Costs are deducted once | deducts each cost exactly once |
| Balances can't go below zero | never lets a balance go below zero (coins, goods, materials; bills become debt) |
| Rewards can't be collected twice | pays each reward only once (income, quests, level rewards after reload) |
| Invalid actions don't change the state | leaves the state untouched when an action is invalid (13 invalid actions, whole save compared) |

## Production — `src/tests/production.test.ts`

| Plan item | Test |
|---|---|
| Correct completion time | starts with the right completion time (income, crops, construction) |
| Not ready before completion | is not ready before its completion time |
| Ready after completion | is ready once its completion time comes, and stays ready |
| Reloading preserves the timestamp | keeps completion times through a save and reload |
| Collection returns the correct rewards | pays the right rewards when collected (coins and XP) |
| A collected cycle can't be collected again | cannot collect the same cycle twice |

## Quests and progression — `src/tests/questsProgression.test.ts`

| Plan item | Test |
|---|---|
| Relevant events increment the right objectives | count relevant events toward the right objectives |
| Unrelated events don't | ignore unrelated events |
| A completed objective stays completed | keep a completed objective completed (even if a "have 3 homes" drops to 2, and after reloading) |
| Quest rewards are awarded once | pay their reward once (also after reloading) |
| Level thresholds trigger the right unlocks | unlocks exactly the right content at each level threshold (levels 2–13, one XP short and exactly on) |
| Content stays unlocked after loading | keeps content unlocked after loading a save |

## Saves — `src/tests/saves.test.ts`, `src/game/save.test.ts`, `src/game/SaveSystem.test.ts`

| Plan item | Test |
|---|---|
| Resources and placed buildings | keeps resources and placed buildings (including debt, turned and stored buildings) |
| Active production | keeps production in progress (income timers, crops, construction, shop shelves) |
| Quests, level, inventory and land | keeps quests, level, inventory and land |
| Older versions migrated or rejected safely | upgrades older versions, and rejects newer ones safely; `save.test.ts` covers each version step |
| Invalid save data doesn't crash | starts a new town instead of crashing on invalid save data (bad JSON, `null`, numbers, arrays, a save with nothing in it, a save missing a section); refuses to import a damaged file |

Every save is tried on a throwaway game first (`SaveSystem.canLoad`), so one
that has the right version but missing parts is set aside as a backup instead
of half-loading or stopping the game.

## Updates and recovery (offline cache)

A blank screen on a phone after an update was traced to the service worker:
GitHub Pages lets browsers reuse the page for 10 minutes, so a new version
could cache the **old** page with the **new** code, and the old page asks for
a code file that no longer exists. Tested in a browser against a local copy
served from a subfolder:

- A "deploy" whose page is stale: the new version refuses to install (and
  deletes its half-filled cache); the old version keeps running normally.
- A real deploy: the new version takes over, the game offers "Update ready",
  and after reloading it runs the new code, offline too.
- Recovery from the broken state itself (the previous version's worker with a
  page naming a missing file): after the fix is published, the first reload
  installs it in the background and the second starts the game.

## Stage 5 polish — `src/tests/stage5.test.ts`

**Older saves:** saves written before each recent addition (tips, the
financial report, events and factories, neighbors and parades) are built by
removing those sections from a current save. Each loads, keeps its whole town
and coins, works with the new features from then on, and saves again with
every section, which loads back identically.

**Tips** wait for the tutorial, show one at a time and only once, can be
turned off, and remember what was read across a save.

**Phone performance** (browser, phone-sized window, a 125-building town with
walkers and traffic): the development build reports the last frame's draw
calls (`<body data-draw-calls>`). Simple-shape buildings were drawn as dozens
of separate parts each (an Apartment Block alone was over 50); merging each
building's parts by color took the frame from **986 to 369 draw calls**,
looking the same. Their shapes are now also freed when a building is
demolished. Headless browsers draw in software, so this counts work, not
frame rate; the automatic quality steps (quality.ts) still handle slow phones.

## Simulation and audit — `src/tests/simulation.test.ts`, `src/tests/audit.test.ts`

The audit added a **simulation**: 20 runs of 3,000 random actions each, the
way a curious player might try anything in any order (building, moving,
storing, collecting, farming, upgrading, buying land, disasters, repairs,
parades, ships, neighbors, admin powers, months of taxes, saving and loading).
After every step it checks what must always be true: coins, debt, goods and
materials never negative or NaN; every building's tiles on the map point back
at it, with no tile shared and nothing on land the town doesn't own; the tax
books hold only real numbers; and a save, loaded and saved again, comes out
exactly the same. A failure names the seed and step, so it replays exactly.

Bugs it and the code review found are pinned in `audit.test.ts`: Admin free
building allowed a second one-of-a-kind building; damage and repairs didn't
update neighborhood bonuses; damaged buildings could be upgraded; a free
(Admin) building claimed depreciation on money never spent; the tax books
saved their assets in a varying order.

**Leak check** (`scripts/leak-check.mjs`, in a browser against `npm run dev`):
a large town built and torn down repeatedly, every disaster, snow on and off,
then idle, reading the graphics card's geometry count. It found two leaks, now
fixed: farm animals rebuilt from new shapes on every town change, and each
flock of birds; and disasters not freeing their shapes. After the fixes the
count levels off (one-time setup the first time an effect runs) and stays
flat while idle, with no console errors.

**Not covered here:** real phones' performance. Headless browsers draw in
software, so frame rates there say nothing about a phone's GPU; the game's
automatic quality steps (quality.ts) handle slow devices.

## Offline — `src/tests/offlinePlay.test.ts` and `scripts/offline-check.mjs`

| Plan item | How it's checked |
|---|---|
| No gameplay feature calls a remote API | No `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` or `sendBeacon` anywhere in the game code |
| All assets are packaged locally | No remote URLs in the code, styles or page; every model and each texture it references is a file under `public/` |
| Start and play with the network cut off | `scripts/offline-check.mjs`, in a browser against the production build: every request to another host is blocked and reported, then the browser goes fully offline and the player collects rent and saves |
| Save and load without a network | The same script saves while offline, reloads, and checks the town is unchanged |

To run the browser check:

```
npm run build
npx vite preview --port 4173
```

then run `scripts/offline-check.mjs` with a Playwright runner that calls its
`run(page)` export.

**Last run:** no requests to any other host, no console errors; rent collected
offline (🪙 600 → 616), saved offline, and the same town after reloading.

The built files mention three outside addresses, none of which is ever
requested: SVG namespace names (`w3.org`), a citation in a three.js comment,
and the license link in the model pack's `License.txt`.

**Fully offline (Stage 12):** the production build was served from a
subfolder (as GitHub Pages does), opened once, then the browser was taken
completely offline and reloaded: the service worker served all 50 files and the
town loaded, including with `?options` in the address. Publishing a changed
`sw.js` showed the "Update ready" prompt; Update now switched versions and the
old cache was deleted.
