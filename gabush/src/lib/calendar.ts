import { useSyncExternalStore } from 'react'

/** Calendar events + admin session, shared by the public calendar, the navbar and the admin panel. */

export type EventType = 'evento' | 'festivo'
export interface CalEvent {
  id: string
  title: string
  description: string
  type: EventType
  /** 'privado' = only the admin sees it (the server hides it from visitors) */
  visibility?: 'publico' | 'privado'
  color: string // '#rrggbb'
  start: string // 'YYYY-MM-DD'
  end: string
}
export type EventDraft = Omit<CalEvent, 'id'> & { id?: string }

export interface Slot {
  from: string // 'HH:MM'
  to: string
}
export interface DayHours {
  open: boolean
  slots: Slot[]
}
/** Opening hours per weekday, index 0 = Monday. */
export interface Schedule {
  days: DayHours[]
}
const WEEKDAY: DayHours = { open: true, slots: [{ from: '08:00', to: '11:00' }, { from: '14:00', to: '17:00' }] }
const CLOSED: DayHours = { open: false, slots: [] }
export const DEFAULT_SCHEDULE: Schedule = { days: [WEEKDAY, WEEKDAY, WEEKDAY, WEEKDAY, WEEKDAY, CLOSED, CLOSED] }

export const FESTIVO_COLOR = '#dc2626'
export const EVENT_COLORS = ['#23206b', '#1fa3dd', '#4aa52a', '#e5a800', '#f26b1d', '#e5197e', '#7c3aed', '#0f9d8f']
export const COLOR_NAMES: Record<string, { es: string; en: string }> = {
  '#23206b': { es: 'Azul Gabush', en: 'Gabush blue' },
  '#1fa3dd': { es: 'Celeste', en: 'Sky blue' },
  '#4aa52a': { es: 'Verde', en: 'Green' },
  '#e5a800': { es: 'Amarillo', en: 'Yellow' },
  '#f26b1d': { es: 'Naranja', en: 'Orange' },
  '#e5197e': { es: 'Fucsia', en: 'Magenta' },
  '#7c3aed': { es: 'Morado', en: 'Purple' },
  '#0f9d8f': { es: 'Turquesa', en: 'Teal' },
}

interface State {
  /** the admin panel asked the server whether a session exists */
  sessionChecked: boolean
  events: CalEvent[]
  schedule: Schedule
  scheduleOpen: boolean
  loaded: boolean
  failed: boolean
  admin: boolean
  user: string
  /** display name of the logged-in person (e.g. "Rectora") */
  name: string
  /** role label and permissions of the logged-in person (see api/users.php) */
  role: string
  perms: Perm[]
  csrf: string
  /** event being created / edited (null = editor closed) */
  editing: EventDraft | null
  loginOpen: boolean
  panelOpen: boolean
  notice: string | null
}

let state: State = { sessionChecked: false, schedule: DEFAULT_SCHEDULE, scheduleOpen: false, events: [], loaded: false, failed: false, admin: false, user: '', name: '', role: '', perms: [], csrf: '', editing: null, loginOpen: false, panelOpen: false, notice: null }
const listeners = new Set<() => void>()
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useCalendar<T>(select: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => select(state),
    () => select(state),
  )
}

const BASE = '/api'
const HINT = 'gb-admin' // set while logged in, so ordinary visitors never call auth.php

const hint = {
  get: () => {
    try {
      return localStorage.getItem(HINT) === '1'
    } catch {
      return false
    }
  },
  set: (on: boolean) => {
    try {
      if (on) localStorage.setItem(HINT, '1')
      else localStorage.removeItem(HINT)
    } catch {
      /* ignore */
    }
  },
}

async function call(path: string, init?: RequestInit): Promise<{ status: number; data: any }> {
  try {
    const res = await fetch(`${BASE}/${path}`, { credentials: 'same-origin', ...init })
    return { status: res.status, data: await res.json().catch(() => null) }
  } catch {
    return { status: 0, data: null }
  }
}

const post = (path: string, body: unknown) =>
  call(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(state.csrf ? { 'X-CSRF-Token': state.csrf } : {}) },
    body: JSON.stringify(body),
  })

let loading: Promise<void> | null = null
/** Re-fetches events and schedule (changes from another device). */
export function reloadEvents(): Promise<void> {
  loading = null
  return loadEvents()
}
export function loadEvents(): Promise<void> {
  loading ??= Promise.all([call('events.php'), call('settings.php')]).then(([ev, st]) => {
    if (st.data?.ok && st.data.schedule?.days?.length === 7) set({ schedule: st.data.schedule })
    if (ev.data?.ok) set({ events: ev.data.events, loaded: true, failed: false })
    else set({ loaded: true, failed: true })
  })
  return loading
}

let checked = false
/** Restores an existing admin session. `force` asks the server even without the local hint (admin panel). */
export function checkAdmin(force = false): Promise<void> {
  if (checked || (!force && !hint.get())) return Promise.resolve()
  checked = true
  return call('auth.php').then(({ data }) => {
    if (data?.admin) {
      hint.set(true)
      set({ admin: true, user: data.user, name: data.name ?? data.user, role: data.role ?? '', perms: data.perms ?? [], csrf: data.csrf, sessionChecked: true })
    } else {
      hint.set(false)
      set({ sessionChecked: true })
    }
  })
}

/* ── permissions ── */
export type Perm = 'asistencia' | 'estudiantes' | 'pagos' | 'inscripciones' | 'calendario' | 'feed' | 'ajustes' | 'usuarios'
/** What the logged-in person may do (the server checks it again on every request). */
export const can = (p: Perm) => state.perms.includes(p)
export const useCan = (p: Perm) => useCalendar((s) => s.perms.includes(p))

/** For other admin modules: current CSRF token, and what to do when the server says the session ended. */
export const getCsrf = () => state.csrf
export const expireSession = () => signedOut('expired')

export type LoginError = 'invalid' | 'rate_limited' | 'not_configured' | 'generic'
export async function login(user: string, password: string): Promise<LoginError | null> {
  const { status, data } = await post('auth.php', { action: 'login', user, password })
  if (data?.admin) {
    hint.set(true)
    set({ admin: true, user: data.user, name: data.name ?? data.user, role: data.role ?? '', perms: data.perms ?? [], csrf: data.csrf, loginOpen: false, sessionChecked: true })
    return null
  }
  if (status === 401) return 'invalid'
  if (status === 429) return 'rate_limited'
  if (status === 503) return 'not_configured'
  return 'generic'
}

const signedOut = (notice: string | null = null) => {
  hint.set(false)
  set({ admin: false, user: '', name: '', role: '', perms: [], csrf: '', editing: null, panelOpen: false, scheduleOpen: false, loginOpen: notice === 'expired', notice })
}

export async function logout() {
  await post('auth.php', { action: 'logout' })
  signedOut()
}

export type SaveError = 'validation' | 'expired' | 'generic'
export async function saveEvent(draft: EventDraft): Promise<{ error: SaveError; fields?: string[] } | null> {
  const { status, data } = await post('events.php', { action: 'save', event: draft })
  if (data?.ok) {
    const ev: CalEvent = data.event
    const others = state.events.filter((e) => e.id !== ev.id)
    set({ events: [...others, ev].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end)), editing: null })
    return null
  }
  if (status === 401 || status === 403) {
    signedOut('expired')
    return { error: 'expired' }
  }
  if (status === 422) return { error: 'validation', fields: data?.fields }
  return { error: 'generic' }
}

export async function deleteEvent(id: string): Promise<boolean> {
  const { status, data } = await post('events.php', { action: 'delete', id })
  if (data?.ok) {
    set({ events: state.events.filter((e) => e.id !== id) })
    return true
  }
  if (status === 401 || status === 403) signedOut('expired')
  return false
}

export async function saveSchedule(schedule: Schedule): Promise<{ error: SaveError; days?: number[] } | null> {
  const { status, data } = await post('settings.php', { action: 'schedule', schedule })
  if (data?.ok) {
    set({ schedule: data.schedule, scheduleOpen: false })
    return null
  }
  if (status === 401 || status === 403) {
    signedOut('expired')
    return { error: 'expired' }
  }
  if (status === 422) return { error: 'validation', days: data?.days }
  return { error: 'generic' }
}

export async function syncHolidays(year: number): Promise<{ added: number; existing: number } | null> {
  const { status, data } = await post('events.php', { action: 'sync_holidays', year })
  if (data?.ok) {
    set({ events: data.events })
    return { added: data.added, existing: data.existing }
  }
  if (status === 401 || status === 403) signedOut('expired')
  return null
}

export const openSchedule = () => set({ scheduleOpen: true })
export const closeSchedule = () => set({ scheduleOpen: false })

export const openEditor = (draft: EventDraft) => set({ editing: draft })
export const closeEditor = () => set({ editing: null })
export const openLogin = () => set({ loginOpen: true, notice: null })
export const closeLogin = () => set({ loginOpen: false })
export const openPanel = () => set({ panelOpen: true })
export const closePanel = () => set({ panelOpen: false })
export const clearNotice = () => set({ notice: null })

export const newDraft = (date: string): EventDraft => ({ title: '', description: '', type: 'evento', visibility: 'publico', color: EVENT_COLORS[0], start: date, end: date })

/** Events covering a given day, festivos first. */
export const eventsOn = (events: CalEvent[], date: string) =>
  events.filter((e) => e.start <= date && e.end >= date).sort((a, b) => (a.type === b.type ? 0 : a.type === 'festivo' ? -1 : 1))
