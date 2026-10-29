import './style.css'
import { Game } from './game/Game'

const game = new Game(document.querySelector<HTMLDivElement>('#app')!)
game.start()
