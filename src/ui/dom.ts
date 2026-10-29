// Tiny helpers for building UI with plain DOM calls. Setting textContent
// (never innerHTML) means text is always shown as text, never run as HTML.

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = '') {
  const node = document.createElement(tag)
  node.className = className
  node.textContent = text
  return node
}

export function coins(amount: number): string {
  return `🪙 ${Math.round(amount).toLocaleString()}`
}

export function percent(rate: number): string {
  return `${(rate * 100).toFixed(1).replace(/\.0$/, '')}%`
}
