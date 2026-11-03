// Hearthvale's service worker: it keeps a copy of every file the game needs,
// so once the game has been opened it starts and plays with no connection.
// Generated at build time from scripts/sw-template.js (see serviceWorker.ts
// beside it): the build fills in the file list and a version that changes
// whenever any file does.
//
// - install:  fill a cache named after this version (changed files downloaded, the rest copied)
// - activate: delete caches from older versions
// - fetch:    answer from the cache; anything not in it goes to the network
//
// A new version installs in the background and takes over straight away
// (so a phone can never stay stuck on a broken copy); the open game keeps
// running the code it already has, and offers to reload into the new one.
//
// Installing is careful: a file is fetched fresh from the network (never the
// browser's own HTTP cache, which can hand back an old page for a while after
// an update), and the page must name this version's code. If anything doesn't
// match, the install fails and the old version stays.
//
// Each file in the list carries a fingerprint of its contents. A file the
// previous version already has, with the same fingerprint, is copied across
// instead of downloaded again: an update fetches only what changed, not all
// the models every time.

const VERSION = '__VERSION__'
const CACHE = `hearthvale-${VERSION}`
const FILES = __FILES__ // [path, fingerprint of its contents]
const SUMS = './sw-sums.json' // each cache's own list of fingerprints, kept beside its files
const ENTRY = __ENTRY__ // the code files index.html must load

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      try {
        await fill(cache)
      } catch (err) {
        await caches.delete(CACHE) // don't leave half a version behind
        throw err
      }
      await self.skipWaiting()
    })(),
  )
})

// Changed files fresh from the network, unchanged ones copied from the last
// version, and the page must name this version's code.
async function fill(cache) {
  const kept = await keptCopies()
  await Promise.all(
    FILES.map(async ([file, sum]) => {
      // The page and its address always come fresh: they say which version this is.
      const old = sum && file !== './index.html' ? kept.get(file) : undefined
      const copy = old && old.sum === sum ? await old.cache.match(file) : undefined
      if (copy) return cache.put(file, copy)
      const response = await fetch(new Request(file, { cache: 'reload' }))
      if (!response.ok) throw new Error(`${file}: ${response.status}`)
      await cache.put(file, response)
    }),
  )
  await cache.put(SUMS, new Response(JSON.stringify(FILES), { headers: { 'Content-Type': 'application/json' } }))
  const page = await (await cache.match('./index.html')).text()
  for (const entry of ENTRY) {
    if (!page.includes(entry)) throw new Error(`index.html is from another version (no ${entry})`)
  }
}

// The files older versions have cached, with their fingerprints: path → { sum, cache }.
async function keptCopies() {
  const kept = new Map()
  for (const key of await caches.keys()) {
    if (!key.startsWith('hearthvale-') || key === CACHE) continue
    const cache = await caches.open(key)
    const sums = await cache.match(SUMS)
    if (!sums) continue // a version from before fingerprints: nothing to compare against
    try {
      for (const [file, sum] of await sums.json()) kept.set(file, { sum, cache })
    } catch {
      // An unreadable list: download everything, as before.
    }
  }
  return kept
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('hearthvale-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return
  // Opening the game (with or without ?options) always gets the cached page.
  const lookup = request.mode === 'navigate' ? caches.match('./index.html') : caches.match(request, { ignoreSearch: true })
  event.respondWith(lookup.then((cached) => cached ?? fetch(request)))
})
