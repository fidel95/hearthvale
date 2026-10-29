import { MATERIALS } from '../game/items'
import { FRIENDSHIP_TIERS, HELPS_PER_DAY, NEIGHBORS_UNLOCK_LEVEL, friendshipTier, type Neighbor } from '../game/neighborData'
import type { Neighbors } from '../game/Neighbors'
import { el } from './dom'
import { button } from './Sheet'

// The neighbors list (in the Map sheet): who they are, how good friends you
// are, what's left to do with each today, and a Visit button.

export interface NeighborActions {
  visit: (n: Neighbor) => void
  claimGift: (n: Neighbor) => void
  fulfill: (n: Neighbor) => void
}

export function neighborsList(neighbors: Neighbors, actions: NeighborActions, now = Date.now()): HTMLElement {
  const wrap = el('div', 'neighbors')
  if (!neighbors.unlocked) {
    wrap.append(el('p', 'muted', `Neighbors move in nearby at level ${NEIGHBORS_UNLOCK_LEVEL}. Then you can visit their towns, help out, and trade gifts.`))
    return wrap
  }
  wrap.append(
    el(
      'p',
      'muted',
      `Help each neighbor up to ${HELPS_PER_DAY} times a day. They pay a little for the help (that's taxable income), and send a daily gift (gifts aren't income: IRC §102).`,
    ),
  )
  for (const n of neighbors.all()) {
    const card = el('section', 'neighbor')
    const points = neighbors.friendship(n)
    const tier = friendshipTier(points)
    const next = FRIENDSHIP_TIERS.find((t) => t.points > points)
    const head = el('div', 'neighbor-head')
    const who = el('div', '')
    who.append(el('strong', '', `${n.name} · ${n.town}`), el('div', 'muted', `Level ${neighbors.townLevel(n)} town · ${tier.name}${next ? ` (${points}/${next.points} ❤️)` : ' ❤️'}`))
    head.append(el('span', 'neighbor-avatar', n.avatar), who)

    const helps = neighbors.helpsLeft(n, now)
    const gift = neighbors.gift(n, now)
    const request = neighbors.request(n, now)
    const m = MATERIALS[request.material]
    const buttons = el('div', 'neighbor-buttons')
    buttons.append(button(`Visit · 🤝 ${helps} left`, () => actions.visit(n)))
    const giftButton = button(`🎁 ${MATERIALS[gift.material].icon} ${gift.amount}`, () => actions.claimGift(n), 'panel-button secondary')
    giftButton.disabled = !neighbors.canClaimGift(n, now)
    giftButton.title = 'Daily gift'
    const give = button(
      neighbors.isRequestDone(n, now) ? `Sent ${m.icon} ✓` : `Wants ${m.icon} ${request.amount}: give`,
      () => actions.fulfill(n),
      'panel-button secondary',
    )
    give.disabled = !neighbors.canFulfill(n, now)
    buttons.append(giftButton, give)
    card.append(head, buttons)
    wrap.append(card)
  }
  return wrap
}
