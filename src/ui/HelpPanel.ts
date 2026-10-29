import { el } from './dom'
import { Sheet } from './Sheet'

// Help: short answers to "how do I…?", always available from ❓ in the top
// bar, so the tutorial's tips can be looked up again any time.

const TOPICS: [string, string][] = [
  ['🖱️ Moving around', 'Drag to pan, scroll or pinch to zoom. Arrow keys or WASD pan, + and − zoom. 🎯 brings you back to your town.'],
  ['🪙 Collecting', 'A bubble over a building means something is ready: tap it (or the building) to collect rent, harvest, restock or unload. Collecting uses ⚡ energy, which refills by 1 a minute.'],
  ['🔨 Building', 'Tap Build, pick a card, tap Place, then tap the map: a green outline and "✓ Fits here" mean it fits. Press ⟳ (or R) to turn it, then ✓ to buy. Nothing is paid until you confirm.'],
  ['🏪 Shops and roads', 'Shops need a road touching one side, and goods on their shelves. Harvests (and ships) fill town storage; Restock moves goods onto the shelves.'],
  ['🌾 Farms', 'Tap an empty plot to plant. Harvest when ripe, before it withers. Quick crops earn more per minute; slow ones can wait overnight.'],
  ['🏘️ Your town', 'Tap 👥 for Town: utilities, population room, location bonuses, running costs and your city rating (and what would raise it).'],
  ['📜 Quests and levels', 'Quests guide you through the game; claim rewards in Quests. Each level unlocks something new, shown in the build menu and Quests → Progress.'],
  ['🏷️ Land', 'From level 8, tap a 🏷️ sign (or a lot on the Map) to buy land next to yours, for coins and materials.'],
  ['🧾 Taxes', 'Tap 🪙 for your books. Taxes follow real US rules: sales tax each quarter, property and income tax on Tax Day after December. Unpaid bills become debt, paid from income first.'],
  ['💾 Saving', 'Your town saves itself in this browser. Clearing site data (or private browsing) deletes it, so use Settings → Export to keep a copy, and Import to bring it back.'],
  ['📲 Install and play offline', "Once the game has opened, it keeps a copy of itself and plays with no connection. To keep it like an app: on iPhone or iPad, Share → Add to Home Screen; on Android or a computer, the browser's Install option. When a new version arrives, the game asks before updating."],
  ['🕐 Time', "Timers use your device's clock, so they keep running while the game is closed. This is a local game with no server: changing the device clock changes the timers too."],
]

export class HelpPanel {
  private sheet: Sheet

  constructor(container: HTMLElement, onReplayTutorial: () => void) {
    this.sheet = new Sheet(container, '❓ Help')
    for (const [title, text] of TOPICS) {
      const d = el('details', 'help-topic')
      d.append(el('summary', '', title), el('p', '', text))
      this.sheet.body.append(d)
    }
    const replay = el('button', 'panel-button secondary', 'Replay the tutorial')
    replay.addEventListener('click', () => {
      this.sheet.close()
      onReplayTutorial()
    })
    this.sheet.setButtons(replay)
  }

  open() {
    this.sheet.open()
  }
}
