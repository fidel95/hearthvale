// Hearthvale's service worker: it keeps a copy of every file the game needs,
// so once the game has been opened it starts and plays with no connection.
// Generated at build time from scripts/sw-template.js (see serviceWorker.ts
// beside it): the build fills in the file list and a version that changes
// whenever any file does.
//
// - install:  download every file into a cache named after this version
// - activate: delete caches from older versions
// - fetch:    answer from the cache; anything not in it goes to the network
//
// A new version installs in the background and takes over straight away
// (so a phone can never stay stuck on a broken copy); the open game keeps
// running the code it already has, and offers to reload into the new one.
//
// Installing is careful: every file is fetched fresh from the network
// (never the browser's own HTTP cache, which can hand back an old page for
// a while after an update), and the page must name this version's code.
// If anything doesn't match, the install fails and the old version stays.

const VERSION = '__VERSION__'
const CACHE = `hearthvale-${VERSION}`
const FILES = __FILES__
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

// Every file fresh from the network, and the page must name this version's code.
async function fill(cache) {
  await Promise.all(
    FILES.map(async (file) => {
      const response = await fetch(new Request(file, { cache: 'reload' }))
      if (!response.ok) throw new Error(`${file}: ${response.status}`)
      await cache.put(file, response)
    }),
  )
  const page = await (await cache.match('./index.html')).text()
  for (const entry of ENTRY) {
    if (!page.includes(entry)) throw new Error(`index.html is from another version (no ${entry})`)
  }
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
