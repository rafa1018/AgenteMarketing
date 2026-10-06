import { useSyncExternalStore } from 'react'

/* ───────── tiny stores ───────── */

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

export type Session = { status: 'checking' } | { status: 'out'; expired?: boolean } | { status: 'in'; user: string; csrf: string; defaultPassword: boolean }

const session = createStore<Session>({ status: 'checking' })
export const useSession = () => useSyncExternalStore(session.subscribe, session.get)
export const markPasswordChanged = () => {
  const s = session.get()
  if (s.status === 'in') session.set({ ...s, defaultPassword: false })
}

const toasts = createStore<{ id: number; text: string } | null>(null)
export const useToast = () => useSyncExternalStore(toasts.subscribe, toasts.get)
let toastTimer: number | undefined
export function toast(text: string) {
  window.clearTimeout(toastTimer)
  toasts.set({ id: Date.now(), text })
  toastTimer = window.setTimeout(() => toasts.set(null), 3200)
}

/* ───────── API client ───────── */

type Res<T> = { status: number; data: (T & { ok?: boolean; error?: string }) | null }

async function request<T = Record<string, unknown>>(path: string, init: RequestInit = {}): Promise<Res<T>> {
  const s = session.get()
  const headers = new Headers(init.headers)
  if (s.status === 'in' && init.method && init.method !== 'GET') headers.set('X-CSRF-Token', s.csrf)
  try {
    const res = await fetch('/api/' + path, { ...init, headers, credentials: 'same-origin', cache: 'no-store' })
    const data = await res.json().catch(() => null)
    if ((res.status === 401 || (res.status === 403 && data?.error === 'csrf')) && session.get().status === 'in') session.set({ status: 'out', expired: true })
    return { status: res.status, data }
  } catch {
    return { status: 0, data: null }
  }
}

export const api = {
  get: <T = Record<string, unknown>>(path: string) => request<T>(path),
  post: <T = Record<string, unknown>>(path: string, body: unknown) => request<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
}

type AuthRes = { admin: boolean; user: string; csrf: string; defaultPassword: boolean }

export async function checkSession() {
  const { data } = await request<AuthRes>('auth.php')
  session.set(data?.admin ? { status: 'in', user: data.user, csrf: data.csrf, defaultPassword: data.defaultPassword } : { status: 'out' })
}

export async function login(user: string, password: string): Promise<'ok' | 'invalid' | 'rate_limited' | 'error'> {
  const { status, data } = await request<AuthRes>('auth.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'login', user, password }) })
  if (data?.admin) {
    session.set({ status: 'in', user: data.user, csrf: data.csrf, defaultPassword: data.defaultPassword })
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
