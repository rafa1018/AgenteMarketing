import { useSyncExternalStore } from 'react'

/** Admin theme: follows the phone/computer setting unless the admin picks light or dark. */
export type ThemePref = 'system' | 'light' | 'dark'
const KEY = 'rp-admin-theme'
const media = window.matchMedia('(prefers-color-scheme: light)')
const subs = new Set<() => void>()

const read = (): ThemePref => {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

let pref = read()

export const resolved = (p: ThemePref = pref): 'light' | 'dark' => (p === 'system' ? (media.matches ? 'light' : 'dark') : p)

export function applyTheme() {
  const t = resolved()
  document.documentElement.dataset.theme = t
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'light' ? '#f3f5fa' : '#03060c')
}

export function setTheme(p: ThemePref) {
  pref = p
  try {
    if (p === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, p)
  } catch {
    /* ignore */
  }
  applyTheme()
  subs.forEach((f) => f())
}

media.addEventListener('change', () => {
  if (pref === 'system') {
    applyTheme()
    subs.forEach((f) => f())
  }
})

export const useTheme = () =>
  useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => pref,
  )
