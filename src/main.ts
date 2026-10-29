import './style.css'
import { Game } from './game/Game'
import { registerServiceWorker } from './serviceWorker'

const game = new Game(document.querySelector<HTMLDivElement>('#app')!)
game.start()
registerServiceWorker((apply) => game.offerUpdate(apply))
