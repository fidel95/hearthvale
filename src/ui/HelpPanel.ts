import { el } from './dom'
import { Sheet } from './Sheet'

// Help: short answers to "how do I…?", always available from ❓ in the top
// bar, so the tutorial's tips can be looked up again any time.

const TOPICS: [string, string][] = [
  ['🖱️ Moving around', 'Drag to pan, scroll or pinch to zoom. Arrow keys or WASD pan, + and − zoom. 🎯 brings you back to your town.'],
  ['🪙 Collecting', 'A bubble over a building means something is ready: tap it (or the building) to collect rent, harvest, restock or unload. Collecting uses ⚡ energy, which refills by 1 a minute.'],
  ['🔨 Building', 'Tap an empty tile and 🔨 Build here, or tap Build, pick a card, tap Place, then tap the map: a green outline and "✓ Fits here" mean it fits. Want several? Keep tapping spots (tap one again to take it back), then ✓ or "Buy N" buys them all at once. Press ⟳ (or R) to turn the next one. Nothing is paid until you confirm.'],
  ['✋ Moving buildings', 'Press and hold a building until it lifts, then drag it and let go. Or tap it once to select it, then drag it. The outline turns green where it fits; drag near the edge of the screen to go further. If it doesn\'t fit where you let go, it stays where it was. Moving is free.'],
  ['😊 Happy homes', 'Every home wants 🛒 a shop within 8 tiles and 🌳 green space (a park, playground, sports field or beach) within 6; family homes (4+ residents) also want 🏫 a school or library within 10. The more needs a home has met, the more rent it pays: up to +15%. The Town window (👥) lists what residents want most, with a button to build it.'],
  ['🧳 Tourism', 'Visitors come by bus stop, dock, train station or airport, to parks, playgrounds, the beach, Central Park, the ski resort and landmarks. Each month the town gets the smaller of what transport brings and what attractions have room for, and each visitor spends 🪙 2 (taxable). Look for them in sun hats and backpacks. The Town window (👥) shows which side to build up.'],
  ['🎉 Events', 'From level 3, Quests → Events has a festival each season (by your device\'s calendar: 🌸 Blossom Festival in spring, ☀️ Summer Fair, 🎃 Harvest Fair in fall, ❄️ Winter Lights) and three new challenges every Monday. Claim each goal as you finish it; finish every festival goal to win its prize decoration, which you can only get there. Prizes go to your Inventory, ready to place.'],
  ['🏪 Shops and roads', 'Shops need a road touching one side, goods on their shelves, and customers: residents living within 8 tiles (with fewer they still sell, at as little as 60%). Homes don\'t need roads, but earn more beside one. While you draw roads, each connected network shows in its own color and anything cut off shows red. Harvests (and ships) fill town storage; Restock moves goods onto the shelves.'],
  ['🗑️ Removing roads', 'To remove roads, tap one, then 🗑️ Remove: tap more roads or drag along them to pick several (tap again to un-pick), then Remove them all at once.'],
  ['🏖️ Parks, beaches and the slopes', 'Playgrounds, Sports Fields and Central Park make the homes around them nicer, and people love to spend time there. A Public Beach goes on the shore: sunbathers and swimmers come when it\'s dry. The Ski Resort (level 13) is a business: skiers buy lift tickets, ski down and ride the chairlift back up.'],
  ['🌧️ Weather', 'Every so often a shower rolls in: the sky darkens, people open umbrellas and the beach empties until the sun comes back. It\'s just for looks. Settings → Rain showers turns it off.'],
  ['🚗 Traffic and transport', 'Cars appear as your town grows. Bus Stops (level 7) make nearby homes and shops nicer, and buses run between them. Railway track and a Train Station (level 14) bring visitors by train, and an Airport (level 15) by plane. An Army Base (level 12) makes the town feel safe and adds room for residents: its squad drills, a sentry keeps watch and a helicopter flies. Tap the base and 🎖️ Parade (🪙 300): the squad marches through town and all rent and sales are 10% higher for 3 minutes; then the troops rest for 10. Settings can hide the traffic.'],
  ['🐔 Farm animals', 'A Chicken Coop (level 3), Pig Pen (5), Sheep Meadow (7) and Cow Pasture (9) earn like shops: collect eggs, pork, wool and milk when the 🪙 bubble shows. It all counts as farm income on your taxes.'],
  ['🌪️ Disasters', 'Now and then a tornado, a lightning storm, a flood or a tsunami strikes. They never destroy anything: a building they hit is damaged (🔧) and stops working until you tap it and pay to repair it. Floods ruin crops. Repairs are a deductible expense. Settings → Natural disasters turns them off.'],
  ['❄️ Snow mode', 'Settings → Snow mode turns the town wintry: snow on the ground and trees, roads plowed, and showers fall as snow.'],
  ['🌾 Farms', 'Every crop has a best season (🌸 spring, ☀️ summer, 🍂 fall, ❄️ winter): harvested then, it gives 25% more. Tap an empty plot to plant. Harvest when ripe, before it withers. Quick crops earn more per minute; slow ones can wait overnight.'],
  ['🏘️ Your town', 'Tap 👥 for Town: utilities, population room, location bonuses, running costs and your city rating (and what would raise it).'],
  ['📜 Quests and levels', 'Quests guide you through the game; claim rewards in Quests. Each level unlocks something new, shown in the build menu and Quests → Progress.'],
  ['🏷️ Land', 'From level 8, tap a 🏷️ sign (or a lot on the Map) to buy land next to yours, for coins and materials.'],
  ['🧾 Taxes', 'Tap 🪙 for your books. Taxes follow real US rules: sales tax each quarter, property and income tax on Tax Day after December. Unpaid bills become debt, paid from income first.'],
  ['💾 Saving', 'Your town saves itself in this browser. Clearing site data (or private browsing) deletes it, so use Settings → Export to keep a copy, and Import to bring it back.'],
  ['📲 Install and play offline', "Once the game has opened, it keeps a copy of itself and plays with no connection. To keep it like an app: on iPhone or iPad, Share → Add to Home Screen; on Android or a computer, the browser's Install option. When a new version arrives, the game asks before updating."],
  ['🛠️ Admin tools', 'Settings → Admin tools adds a 🛠️ button to the top bar: give yourself coins, levels, materials and energy, finish every timer, speed up the calendar, or switch on powers like building anything for free. They change your saved town; switch them off any time.'],
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
