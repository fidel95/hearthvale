// Registers the service worker (scripts/sw-template.js) in the built game, so
// it can be installed and played offline. When a new version has downloaded,
// onUpdate is called with a function that switches to it and reloads; the
// game asks the player first, so an update never interrupts them.
export function registerServiceWorker(onUpdate: (apply: () => void) => void) {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) location.reload()
  })
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js')
      const offer = (worker: ServiceWorker) =>
        onUpdate(() => {
          reloading = true
          worker.postMessage('skipWaiting')
        })
      if (registration.waiting && navigator.serviceWorker.controller) offer(registration.waiting)
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing
        worker?.addEventListener('statechange', () => {
          // "installed" with a page already controlled means it's an update, not the first install.
          if (worker.state === 'installed' && navigator.serviceWorker.controller) offer(worker)
        })
      })
    } catch (err) {
      console.warn("Couldn't set up offline play", err)
    }
  })
}
