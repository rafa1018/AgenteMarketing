import { useSyncExternalStore } from 'react'

/* ───────── tiny stores (no external state library) ───────── */

function createStore<T>(initial: T) {
  let state = initial
  const subs = new Set<() => void>()
  return {
    get: () => state,
    set: (next: T) => {
      state = next
      subs.forEach((f) => f())
    },
    subscribe: (f: () => void) => {
      subs.add(f)
      return () => subs.delete(f)
    },
  }
}

export type Session = { status: 'checking' } | { status: 'out'; expired?: boolean } | { status: 'in'; user: string; name: string; csrf: string }

const session = createStore<Session>({ status: 'checking' })
export const useSession = () => useSyncExternalStore(session.subscribe, session.get)

const toasts = createStore<{ id: number; text: string } | null>(null)
export const useToast = () => useSyncExternalStore(toasts.subscribe, toasts.get)
let toastTimer: number | undefined
export function toast(text: string) {
  window.clearTimeout(toastTimer)
  toasts.set({ id: Date.now(), text })
  toastTimer = window.setTimeout(() => toasts.set(null), 3200)
}

/** Badge for the "Mensajes" tab, kept fresh by the shell's sync loop. */
const unread = createStore(0)
export const useUnread = () => useSyncExternalStore(unread.subscribe, unread.get)
export const setUnread = (n: number) => unread.set(n)

/* ───────── API client ───────── */

const BASE = '/api/'
type Res<T> = { status: number; data: (T & { ok?: boolean; error?: string }) | null }

function expire() {
  if (session.get().status === 'in') session.set({ status: 'out', expired: true })
}

async function request<T = Record<string, unknown>>(path: string, init: RequestInit = {}): Promise<Res<T>> {
  const s = session.get()
  const headers = new Headers(init.headers)
  if (s.status === 'in' && init.method && init.method !== 'GET') headers.set('X-CSRF-Token', s.csrf)
  try {
    const res = await fetch(BASE + path, { ...init, headers, credentials: 'same-origin', cache: 'no-store' })
    const data = await res.json().catch(() => null)
    if (res.status === 401 || (res.status === 403 && data?.error === 'csrf')) expire()
    return { status: res.status, data }
  } catch {
    return { status: 0, data: null }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

export const api = {
  get: <T = Any>(path: string) => request<T>(path),
  post: <T = Any>(path: string, body: unknown) => request<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  /** multipart upload with progress (fetch has no upload progress) */
  upload: (path: string, form: FormData, onProgress: (pct: number) => void) =>
    new Promise<Res<Any>>((resolve) => {
      const s = session.get()
      const xhr = new XMLHttpRequest()
      xhr.open('POST', BASE + path)
      if (s.status === 'in') xhr.setRequestHeader('X-CSRF-Token', s.csrf)
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100))
      xhr.onload = () => {
        let data = null
        try {
          data = JSON.parse(xhr.responseText)
        } catch {
          /* ignore */
        }
        if (xhr.status === 401) expire()
        resolve({ status: xhr.status, data })
      }
      xhr.onerror = () => resolve({ status: 0, data: null })
      xhr.send(form)
    }),
}

/* ───────── auth ───────── */

export async function checkSession() {
  const { data } = await request<{ admin: boolean; user: string; name: string; csrf: string }>('auth.php')
  session.set(data?.admin ? { status: 'in', user: data.user, name: data.name, csrf: data.csrf } : { status: 'out' })
}

export async function login(user: string, password: string): Promise<'ok' | 'invalid' | 'rate_limited' | 'error'> {
  const { status, data } = await request<{ admin: boolean; user: string; name: string; csrf: string }>('auth.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'login', user, password }),
  })
  if (data?.admin) {
    session.set({ status: 'in', user: data.user, name: data.name, csrf: data.csrf })
    return 'ok'
  }
  if (status === 401) return 'invalid'
  if (status === 429) return 'rate_limited'
  return 'error'
}

export async function logout() {
  await api.post('auth.php', { action: 'logout' })
  session.set({ status: 'out' })
}

/* ───────── shared types ───────── */

export type Visit = {
  id: string
  t: number
  ip: string
  new: boolean
  country: string
  cc: string
  region: string
  city: string
  isp: string
  device: string
  kind: 'mobile' | 'tablet' | 'desktop'
  ref: string
  lang: string
  tz: string
  screen: string
}
export type Download = Pick<Visit, 'id' | 't' | 'ip' | 'device' | 'kind' | 'ref'> & Partial<Pick<Visit, 'country' | 'cc' | 'region' | 'city' | 'isp'>>
export type Stats = { visits: { count: number; unique: number }; visitLog: Visit[]; downloads: { count: number; log: Download[] }; unread: number }
export type Message = { id: string; t: number; name: string; phone: string; subject: string; message: string; lang: string; ip: string; device: string; read: boolean; place?: string; cc?: string }
export type Settings = {
  cvEnabled: boolean
  music: { enabled: boolean; autoplay: boolean; volume: number; mode: 'default' | 'url' | 'file'; url: string; file: string; name: string; updatedAt: string }
  /** the bot token itself never reaches the browser, only its last characters */
  telegram: { enabled: boolean; chatId: string; tokenHint: string; source: 'panel' | 'config' }
}

/* ───────── formatting ───────── */

const dtf = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' })
export const fmtDate = (t: number) => dtf.format(new Date(t * 1000))

export function ago(t: number) {
  const s = Math.max(0, Date.now() / 1000 - t)
  if (s < 60) return 'hace un momento'
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`
  if (s < 86400 * 30) return `hace ${Math.floor(s / 86400)} d`
  return fmtDate(t)
}

/** 🇨🇴-style flag from an ISO country code. */
export const flag = (cc?: string) => (cc && /^[A-Z]{2}$/i.test(cc) ? String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0))) : '🌐')

export const place = (v: { city?: string; region?: string; country?: string }) => [v.city, v.region, v.country].filter(Boolean).join(', ') || 'Ubicación desconocida'
