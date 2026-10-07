/** Client for the tiny PHP API (public/api). Same origin in production; proxied by Vite in dev. */
const BASE = '/api'

export type ContactPayload = {
  child: string
  age: string
  birth: string
  address: string
  gender: string
  parent: string
  phone: string
  email: string
  program: string
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

const VISIT_KEY = 'gb-visit-counted'
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
  // where the visit comes from (shown in the admin panel → Visitas, with the approximate location of the IP)
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
