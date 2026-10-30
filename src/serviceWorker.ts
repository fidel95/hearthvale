// Registers the service worker (scripts/sw-template.js) in the built game, so
// it can be installed and played offline. A new version takes over as soon
// as it has downloaded; the open game keeps running, and onUpdate is called
// with a function that reloads into the new version (the game asks first).
export function registerServiceWorker(onUpdate: (apply: () => void) => void) {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  // A page that already had a service worker is being updated; a page that
  // didn't is just installing for the first time (nothing to offer).
  const hadController = navigator.serviceWorker.controller !== null
  let offered = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || offered) return
    offered = true
    onUpdate(() => location.reload())
  })
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js')
      // An older version's worker may still be waiting to be told to take over.
      if (registration.waiting && navigator.serviceWorker.controller) {
        const waiting = registration.waiting
        onUpdate(() => waiting.postMessage('skipWaiting'))
      }
    } catch (err) {
      console.warn("Couldn't set up offline play", err)
    }
  })
}

// Recovery, for the crash screen: forget the offline copy of the game (not
// the saved town, which is separate) so the next load fetches it fresh.
export async function clearOfflineCopy() {
  if ('serviceWorker' in navigator) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister()
  if ('caches' in window) for (const key of await caches.keys()) await caches.delete(key)
}
