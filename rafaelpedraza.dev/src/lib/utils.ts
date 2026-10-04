export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

/** Values like "[ADD GITHUB URL]" are placeholders and must never be linked. */
export function isPlaceholder(value?: string | null): boolean {
  return !value || /^\[.*\]$/.test(value.trim())
}

export function scrollToId(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const top = el.getBoundingClientRect().top + window.scrollY - (id === 'home' ? 0 : 64)
  window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' })
  history.replaceState(null, '', id === 'home' ? '#' : `#${id}`)
}

export const pad = (n: number, len = 2) => String(n).padStart(len, '0')

export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1]
