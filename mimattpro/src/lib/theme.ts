/**
 * Brand theme: 'blue' (default) or 'gold', chosen in the admin panel (Ajustes → Tema) and served by
 * /api/site.php. The last known theme is cached so the inline script in each page's <head> can apply
 * it before the first paint (no blue→gold flash).
 */
export type Theme = 'blue' | 'gold'
export const THEMES: Theme[] = ['blue', 'gold']
const KEY = 'mm-theme'

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* ignore */
  }
}

/** Asks the site API for the theme set in the admin panel (keeps the cached one if the API is unavailable). */
export async function syncTheme(): Promise<void> {
  try {
    const r = await fetch('/api/site.php', { cache: 'no-store' })
    const d = r.ok ? await r.json() : null
    if (d?.ok && THEMES.includes(d.theme)) applyTheme(d.theme)
  } catch {
    /* API not available (e.g. plain static dev server): keep the cached / default theme */
  }
}
