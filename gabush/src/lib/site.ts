import { useEffect, useState } from 'react'

/** Website options managed from the admin panel (Sitio web): intro screen and background music. */
export interface SiteMusic {
  enabled: boolean
  mode: 'none' | 'file' | 'url'
  file: string
  name: string
  url: string
  autoplay: boolean
  /** starting volume 0–100 */
  volume: number
  updatedAt: string | null
  /** what actually plays (null = no music) */
  src: string | null
}
export interface SiteSettings {
  preloader: boolean
  /** how long the intro stays, 1.5–8 s */
  preloaderSeconds: number
  music: SiteMusic
}

/** Used when the API is unreachable (e.g. `npm run dev` without `npm run api`). */
const FALLBACK: SiteSettings = {
  preloader: true,
  preloaderSeconds: 2.5,
  music: { enabled: false, mode: 'none', file: '', name: '', url: '', autoplay: true, volume: 60, updatedAt: null, src: null },
}

let cache: Promise<SiteSettings> | null = null
export function loadSite(): Promise<SiteSettings> {
  cache ??= fetch('/api/settings.php', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (d?.ok && d.site ? (d.site as SiteSettings) : FALLBACK))
    .catch(() => FALLBACK)
  return cache
}

/** null while loading. */
export function useSite() {
  const [site, setSite] = useState<SiteSettings | null>(null)
  useEffect(() => {
    let alive = true
    loadSite().then((s) => alive && setSite(s))
    return () => {
      alive = false
    }
  }, [])
  return site
}
