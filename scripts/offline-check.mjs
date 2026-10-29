// The offline part of the test plan (docs/TESTING.md), run in a real browser
// against the production build:
//
//   npm run build && npx vite preview --port 4173
//   then run this with a Playwright runner that calls `run(page)`
//
// Any request to a host other than the local server is blocked and reported.
// After the game loads, the browser is switched fully offline; the player
// collects, builds and saves, and then the page is reloaded from the local server
// and the town must still be there.
export default async function run(page) {
  const remote = []
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return route.continue()
    remote.push(url.href)
    return route.abort()
  })
  await page.goto('http://localhost:4173/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForSelector('.topbar')
  await page.waitForTimeout(1500)

  await page.context().setOffline(true)
  const bar = () => page.evaluate(() => document.querySelector('.topbar').innerText.replace(/\s+/g, ' '))
  const before = await bar()
  // Play: wait for the cottage's rent, then tap its coin bubble.
  await page.waitForTimeout(31_000)
  const collected = await page.evaluate(() => {
    const bubbles = [...document.querySelectorAll('.bubble')].filter((e) => e.textContent?.includes('🪙'))
    for (const bubble of bubbles) bubble.click()
    return bubbles.length
  })
  await page.waitForTimeout(500)
  const afterPlay = await bar()
  // Save while offline.
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent === '⚙️')?.click())
  await page.waitForTimeout(300)
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Save now'))?.click())
  await page.waitForTimeout(300)
  const savedOffline = await page.evaluate(() => JSON.parse(localStorage.getItem('hearthvale.save') ?? 'null')?.resources)

  // Reload (the page itself comes from the local server; still no outside network).
  await page.context().setOffline(false)
  await page.reload()
  await page.waitForSelector('.topbar')
  await page.waitForTimeout(1000)
  const afterReload = await bar()
  return { remoteRequests: remote, before, collected, afterPlay, savedOffline, afterReload }
}
