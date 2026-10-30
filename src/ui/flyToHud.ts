// "Juice" for collecting: a few icons spring out of the building and fly
// in an arc up to their counter in the top bar, which bumps as they land.
// Plain DOM and the Web Animations API, so it costs nothing in the 3D scene.

export function flyToHud(from: { x: number; y: number }, icon: string, target: HTMLElement, count = 3, onArrive?: () => void) {
  const to = target.getBoundingClientRect()
  const end = { x: to.left + 18, y: to.top + to.height / 2 }
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div')
    el.className = 'fly-icon'
    el.textContent = icon
    document.body.append(el)
    // Each one bursts out a little differently, then curves up to the counter.
    const spread = { x: (Math.random() - 0.5) * 70, y: -30 - Math.random() * 40 }
    const animation = el.animate(
      [
        { transform: `translate(${from.x}px, ${from.y}px) scale(0.4)`, opacity: 0 },
        { transform: `translate(${from.x + spread.x}px, ${from.y + spread.y}px) scale(1.25)`, opacity: 1, offset: 0.25 },
        { transform: `translate(${end.x}px, ${end.y}px) scale(0.7)`, opacity: 1 },
      ],
      { duration: 750 + i * 90, delay: i * 70, easing: 'cubic-bezier(0.5, 0, 0.7, 1)', fill: 'both' },
    )
    animation.onfinish = () => {
      el.remove()
      if (i === 0) {
        target.classList.remove('bump')
        void target.offsetWidth // restart the bump animation
        target.classList.add('bump')
        onArrive?.()
      }
    }
  }
}
