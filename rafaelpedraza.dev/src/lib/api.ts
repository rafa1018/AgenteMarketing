/** Client for the tiny PHP API (public/api). Same origin in production; proxied by Vite in dev. */
const BASE = '/api'

export type ContactPayload = {
  name: string
  phone: string
  subject: string
  message: string
  lang: 'es' | 'en'
  website: string // honeypot — must stay empty
  elapsed: number // ms since the form was shown
}

export type ContactError = 'validation' | 'rate_limited' | 'generic'

export async function sendContact(payload: ContactPayload): Promise<{ ok: true } | { ok: false; error: ContactError; fields?: string[] }> {
  try {
    const res = await fetch(`${BASE}/contact.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => null)
    if (res.ok && data?.ok) return { ok: true }
    if (res.status === 422) return { ok: false, error: 'validation', fields: data?.fields }
    if (res.status === 429) return { ok: false, error: 'rate_limited' }
    return { ok: false, error: 'generic' }
  } catch {
    return { ok: false, error: 'generic' }
  }
}

/** Settings managed from the admin panel: whether the CV can be downloaded and which music plays. */
export type SiteVideo = { youtube: string; src: string; opacity: number }
export type SiteSettings = { cv: { enabled: boolean }; preloader: boolean; autoScroll: boolean; music: { src: string | null; autoplay: boolean; volume: number }; video: SiteVideo | null }

const SITE_FALLBACK: SiteSettings = { cv: { enabled: true }, preloader: true, autoScroll: true, music: { src: '/audio/background.mp3', autoplay: true, volume: 80 }, video: null }
let sitePromise: Promise<SiteSettings> | null = null
const siteListeners = new Set<(s: SiteSettings) => void>()

function fetchSite(): Promise<SiteSettings> {
  return fetch(`${BASE}/site.php`, { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) =>
      d?.ok
        ? {
            cv: { enabled: Boolean(d.cv?.enabled) },
            preloader: d.preloader !== false,
            autoScroll: d.autoScroll !== false,
            music: { src: d.music?.src ?? null, autoplay: d.music?.autoplay !== false, volume: Math.max(0, Math.min(100, Number(d.music?.volume ?? 80))) },
            video: d.video ? { youtube: String(d.video.youtube ?? ''), src: String(d.video.src ?? ''), opacity: Number(d.video.opacity ?? 30) } : null,
          }
        : SITE_FALLBACK,
    )
    .catch(() => SITE_FALLBACK)
}

export function loadSite(): Promise<SiteSettings> {
  sitePromise ??= fetchSite()
  return sitePromise
}

/** Calls `fn` whenever the settings change while the page is open (checked when the visitor comes back to the tab). */
export function onSiteChange(fn: (s: SiteSettings) => void): () => void {
  siteListeners.add(fn)
  return () => siteListeners.delete(fn)
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !siteListeners.size) return
    const next = fetchSite()
    sitePromise = next
    next.then((s) => siteListeners.forEach((f) => f(s)))
  })
}

export type SubscribeResult = 'subscribed' | 'already' | 'invalid' | 'rate_limited' | 'error'

/** Footer newsletter form. */
export async function subscribe(payload: { email: string; lang: 'es' | 'en'; website: string; elapsed: number }): Promise<SubscribeResult> {
  try {
    const res = await fetch(`${BASE}/subscribe.php`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json().catch(() => null)
    if (res.ok && data?.ok) return data.already ? 'already' : 'subscribed'
    if (res.status === 422) return 'invalid'
    if (res.status === 429) return 'rate_limited'
    return 'error'
  } catch {
    return 'error'
  }
}

const VISIT_KEY = 'rp-visit-counted'
let visitsPromise: Promise<number | null> | null = null

/** Registers this visit once per browser session and returns the total. null when the API is unavailable. */
export function loadVisits(): Promise<number | null> {
  if (visitsPromise) return visitsPromise
  let counted = false
  try {
    counted = sessionStorage.getItem(VISIT_KEY) === '1'
  } catch {
    /* ignore */
  }
  const visit = counted
    ? undefined
    : JSON.stringify({
        ref: document.referrer,
        lang: navigator.language,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        screen: `${screen.width}x${screen.height}`,
      })
  visitsPromise = fetch(`${BASE}/visits.php`, { method: counted ? 'GET' : 'POST', headers: visit ? { 'Content-Type': 'application/json' } : undefined, body: visit })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (!d?.ok) return null
      try {
        sessionStorage.setItem(VISIT_KEY, '1')
      } catch {
        /* ignore */
      }
      return Number(d.count) || 0
    })
    .catch(() => null)
  return visitsPromise
}
