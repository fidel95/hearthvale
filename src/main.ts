import '@fontsource-variable/fredoka'
import './style.css'
import { Game } from './game/Game'
import { clearOfflineCopy, registerServiceWorker } from './serviceWorker'

// If the game can't start, say so (with the error, and ways out) instead of
// leaving a blank page. The saved town is never touched here.
function showCrash(error: unknown) {
  if (document.querySelector('.crash')) return
  const box = document.createElement('div')
  box.className = 'crash'
  const detail = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error)
  box.innerHTML = `
    <h1>😟 Hearthvale couldn't start</h1>
    <p>Your town is safe: it's saved separately. Try reloading. If that doesn't help, refresh the game's files (your town stays).</p>
    <div class="crash-buttons"><button class="reload">Reload</button><button class="refresh">Refresh the game's files</button></div>
    <details><summary>What went wrong</summary><pre></pre></details>`
  box.querySelector('pre')!.textContent = detail.slice(0, 2000)
  box.querySelector('.reload')!.addEventListener('click', () => location.reload())
  box.querySelector('.refresh')!.addEventListener('click', async () => {
    await clearOfflineCopy()
    location.reload()
  })
  document.body.append(box)
}

let started = false
window.addEventListener('error', (e) => !started && showCrash(e.error ?? e.message))
window.addEventListener('unhandledrejection', (e) => !started && showCrash(e.reason))

try {
  const game = new Game(document.querySelector<HTMLDivElement>('#app')!)
  game.start()
  started = true
  registerServiceWorker((apply) => game.offerUpdate(apply))
} catch (err) {
  showCrash(err)
  // Even a game that can't start should still be able to pick up a fixed version.
  registerServiceWorker(() => location.reload())
}
