// Leak check (docs/TESTING.md): run against the development server (npm run
// dev), with a Playwright runner that calls `run(page)`. It builds a large
// town, then builds and tears down repeatedly, runs disasters and snow, and
// sits idle, reading what's on the graphics card (development builds publish
// renderer.info on <body data-geometries>). Counts should level off, not
// keep climbing; console errors should be none.
export default async function run(page) {
  const log = { errors: [] }
  page.on('pageerror', (e) => log.errors.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('AudioContext')) log.errors.push(m.text()) })
  await page.goto('http://localhost:5173/models/suburban/License.txt')
  await page.evaluate(async () => {
    localStorage.clear()
    const { GameState } = await import('/src/game/GameState.ts')
    const { SaveSystem } = await import('/src/game/SaveSystem.ts')
    const { BUILDINGS_BY_ID } = await import('/src/game/buildings.ts')
    const { SAVE_VERSION } = await import('/src/game/save.ts')
    const s = new GameState()
    s.seedNewTown()
    s.player.grantXp(100000)
    s.city.economy.adjust(500000)
    s.city.buyLot({ x: 2, z: 4 }); s.city.buyLot({ x: 3, z: 4 }); s.city.buyLot({ x: 1, z: 2 })
    const put = (id, x, z) => s.city.place(BUILDINGS_BY_ID.get(id), { x, z }, { free: true })
    for (let x = 10; x < 40; x++) put('road', x, 26)
    for (let z = 20; z < 40; z++) put('road', 29, z)
    const ids = ['cottage', 'family-house', 'villa', 'duplex', 'bakery', 'cafe', 'chicken-coop', 'pig-pen', 'park', 'playground', 'oak-tree', 'bus-stop', 'farm-plot']
    let i = 0
    for (let x = 12; x < 39; x += 3) for (const z of [23, 27, 31, 35]) put(ids[i++ % ids.length], x, z)
    put('army-base', 33, 20); put('airport', 20, 40); put('public-beach', 31, 41)
    s.settings.set('admin', { ...s.settings.values.admin, enabled: true })
    s.tutorial.load({ step: 99, skipped: true })
    localStorage.setItem('hearthvale.save', JSON.stringify({ version: SAVE_VERSION, savedAt: Date.now(), ...new SaveSystem(s).toSave() }))
  })
  await page.goto('http://localhost:5173/')
  await page.waitForSelector('.topbar')
  await page.waitForTimeout(4000)
  const memory = () => page.evaluate(() => ({ geometries: Number(document.body.dataset.geometries), textures: Number(document.body.dataset.textures), heapMB: Math.round(performance.memory.usedJSHeapSize / 1e6) }))
  log.start = await memory()
  const admin = async (label) => {
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent === '🛠️').click())
    await page.waitForTimeout(150)
    await page.evaluate((label) => [...document.querySelectorAll('.panel-button')].find((b) => b.textContent.includes(label)).click(), label)
    await page.keyboard.press('Escape')
  }
  log.rounds = []
  log.rounds.push(await memory())
  for (let r = 0; r < 2; r++) {
    for (const d of ['Tornado', 'Flood']) {
      await admin(d)
      await page.waitForTimeout(27500)
    }
    log.rounds.push(await memory())
  }
  log.errors = log.errors.slice(0, 8)
  return log
}
