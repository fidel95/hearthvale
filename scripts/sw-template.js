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
// A new version installs in the background and waits; the game offers to
// switch to it (a 'skipWaiting' message), so it never changes mid-game.

const VERSION = '__VERSION__'
const CACHE = `hearthvale-${VERSION}`
const FILES = __FILES__

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)))
})

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
