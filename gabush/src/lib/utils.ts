export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

/** Values like "[AGREGAR CIUDAD]" are placeholders and must never be linked or sent. */
export function isPlaceholder(value?: string | null): boolean {
  return !value || /^\[.*\]$/.test(value.trim())
}

export function scrollToId(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const top = id === 'inicio' ? 0 : el.getBoundingClientRect().top + window.scrollY - 76
  window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' })
  history.replaceState(null, '', id === 'inicio' ? location.pathname : `#${id}`)
}

export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1]
