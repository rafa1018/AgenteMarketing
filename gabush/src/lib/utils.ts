export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

/** Values like "[AGREGAR CIUDAD]" are placeholders and must never be linked or sent. */
export function isPlaceholder(value?: string | null): boolean {
  return !value || /^\[.*\]$/.test(value.trim())
}

let settleTimer = 0

/**
 * Smooth-scrolls to a section (76 px below the fixed header). Images loading on the way can move the section,
 * so when the scroll settles the position is checked again and corrected.
 */
export function scrollToId(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const target = () => (id === 'inicio' ? 0 : Math.max(0, el.getBoundingClientRect().top + window.scrollY - 76))
  window.scrollTo({ top: target(), behavior: reduce ? 'auto' : 'smooth' })
  history.replaceState(null, '', id === 'inicio' ? location.pathname : `#${id}`)
  window.clearTimeout(settleTimer)
  // the visitor takes over (touch, wheel, keys): no correction
  const cancel = () => window.clearTimeout(settleTimer)
  for (const ev of ['touchstart', 'wheel', 'keydown'] as const) window.addEventListener(ev, cancel, { once: true, passive: true })
  let last = -1
  const settle = (tries: number) => {
    settleTimer = window.setTimeout(() => {
      // still moving: wait a bit more
      if (Math.abs(window.scrollY - last) > 1 && tries > 0) {
        last = window.scrollY
        return settle(tries - 1)
      }
      const off = target() - window.scrollY
      if (Math.abs(off) > 6) window.scrollTo({ top: target(), behavior: 'auto' })
    }, 250)
  }
  settle(12)
}

export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1]
