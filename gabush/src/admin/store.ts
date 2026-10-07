import { useSyncExternalStore } from 'react'
import { addDays, todayYMD } from '@/lib/dates'
import { expireSession, getCsrf } from '@/lib/calendar'
import type { Due } from './logic'

/* Admin data: students, plans, payments, attendance and enrolments (all admin-only on the server). */

export type PlanType = 'mensual' | 'dia'
export type Shift = 'manana' | 'tarde'
export interface Plan {
  id: string
  name: string
  type: PlanType
  shift: Shift
  price: number
}
/** One enrolment: from start to end (null = still enrolled). */
export interface Period {
  start: string
  end: string | null
  reason: string
}
export interface Student {
  id: string
  /** enrolment history, oldest first; the last one is the current / latest */
  periods: Period[]
  firstName: string
  lastName: string
  age: number | null
  /** 'YYYY-MM-DD' — when set, the age is calculated from it */
  birthDate?: string | null
  startDate: string
  planId: string
  /** amount to charge; null = plan price */
  price: number | null
  billingDay: number
  /** null = follow the general setting in Ajustes */
  monthlyMode?: 'vencido' | 'anticipado' | null
  /** take attendance? null/undefined = by plan (por día: yes · mensual: no) */
  attendance?: boolean | null
  guardianName: string
  guardianPhone: string
  authorized: string
  notes: string
  active: boolean
  /** photo version (0 = no photo) */
  photo: number
}
export type StudentDraft = Omit<Student, 'id' | 'photo' | 'periods'> & { id?: string; photo?: number; periods?: Period[] }
export type PaymentKind = PlanType | 'extra'
export interface Payment {
  id: string
  studentId: string
  amount: number
  date: string
  kind: PaymentKind
  note: string
  /** "por día": attended days this payment covers */
  days?: string[]
  /** "por día": amount charged for each day (may differ from the usual price) and why */
  items?: { date: string; amount: number; note: string }[]
  /** extra charge paid on the spot */
  chargeId?: string
}
/** One-off extra charge (e.g. an extra morning of care for a monthly student). */
export interface Charge {
  id: string
  studentId: string
  amount: number
  date: string
  concept: string
}
/** a: asistió · f: no asistió · p: price of a "por día" attendance */
export interface Mark {
  s: 'a' | 'f'
  p?: number
}
export type InscriptionStatus = 'pendiente' | 'contactado' | 'atendido'
export interface Inscription {
  id: string
  createdAt: string
  status: InscriptionStatus
  statusAt?: string
  note: string
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
}

interface State {
  loaded: boolean
  failed: boolean
  students: Student[]
  plans: Plan[]
  payments: Payment[]
  charges: Charge[]
  /** when the monthly fee is due (see logic.ts) */
  monthlyMode: 'vencido' | 'anticipado'
  /** WhatsApp payment reminder ('' = default) */
  reminderTemplate: string
  /** pending payment whose reminder dialog is open */
  reminding: Due | null
  /** "por día" student whose days & payments dialog is open */
  dayBilling: string | null
  /** student whose photo is shown enlarged */
  viewingPhoto: string | null
  /** extra-charge dialog (null = closed) */
  charging: { studentId?: string; date?: string } | null
  attendance: Record<string, Record<string, Mark>>
  /** first date whose attendance is loaded */
  attFrom: string
  inscriptions: Inscription[]
  toast: string | null
  /** student being created / edited (null = editor closed); inscriptionId links it to an enrolment */
  editing: (StudentDraft & { inscriptionId?: string }) | null
}

let state: State = { loaded: false, failed: false, students: [], plans: [], payments: [], charges: [], monthlyMode: 'vencido', reminderTemplate: '', reminding: null, dayBilling: null, viewingPhoto: null, charging: null, attendance: {}, attFrom: todayYMD(), inscriptions: [], toast: null, editing: null }
const listeners = new Set<() => void>()
const set = (patch: Partial<State> | ((s: State) => Partial<State>)) => {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
export function useAdmin<T>(select: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => select(state),
    () => select(state),
  )
}

/* ── network ── */

async function request(path: string, init?: RequestInit): Promise<{ status: number; data: any }> {
  try {
    const res = await fetch(`/api/${path}`, { credentials: 'same-origin', ...init })
    const data = await res.json().catch(() => null)
    if (res.status === 401 || (res.status === 403 && data?.error === 'csrf')) expireSession()
    return { status: res.status, data }
  } catch {
    return { status: 0, data: null }
  }
}
/** Saves in flight: a background refresh waits for them so it never undoes an optimistic change. */
let inflight = 0
const post = async (path: string, body: unknown) => {
  inflight++
  try {
    return await request(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf() }, body: JSON.stringify(body) })
  } finally {
    inflight--
  }
}

/** For admin modules with their own endpoints (e.g. notifications). */
export const api = { get: (path: string) => request(path), post }

let toastTimer: number | undefined
export function toast(msg: string) {
  window.clearTimeout(toastTimer)
  set({ toast: msg })
  toastTimer = window.setTimeout(() => set({ toast: null }), 3200)
}
const failToast = () => toast('No se pudo guardar. Revisa tu conexión e intenta de nuevo.')

/* ── loading ── */

/**
 * Loads everything from the server. Also used to pick up changes made on another device
 * (e.g. a student added from another phone): `silent` keeps the screen as it is and skips the
 * refresh while a save is still on its way.
 */
let lastSync = 0
export async function loadAll(silent = false) {
  if (silent && inflight > 0) return
  lastSync = Date.now()
  const [st, bi, ins] = await Promise.all([request('students.php'), request('billing.php'), request('inscriptions.php')])
  if (!st.data?.ok || !bi.data?.ok) return silent ? undefined : set({ loaded: true, failed: true })
  if (silent && inflight > 0) return
  const students: Student[] = (st.data.students as Student[]).map(withPeriods)
  // attendance from the earliest start date (needed for "por día" balances), at most ~2 years back
  const earliest = students.reduce((m, s) => (s.startDate < m ? s.startDate : m), addDays(todayYMD(), -60))
  const computed = earliest < addDays(todayYMD(), -730) ? addDays(todayYMD(), -730) : earliest
  // keep older days the user already browsed to
  const from = silent && state.attFrom < computed ? state.attFrom : computed
  const at = await request(`attendance.php?from=${from}&to=${addDays(todayYMD(), 60)}`)
  if (silent && (inflight > 0 || !at.data?.ok)) return
  set({
    loaded: true,
    failed: !at.data?.ok,
    students,
    plans: bi.data.plans,
    payments: bi.data.payments,
    charges: bi.data.charges ?? [],
    monthlyMode: bi.data.monthlyMode === 'anticipado' ? 'anticipado' : 'vencido',
    reminderTemplate: bi.data.reminderTemplate ?? '',
    attendance: at.data?.days ?? {},
    attFrom: from,
    inscriptions: ins.data?.items ?? [],
  })
}

/** Make sure attendance for an older date is loaded (when browsing back in time). */
export async function ensureAttendance(date: string) {
  if (date >= state.attFrom) return
  const { data } = await request(`attendance.php?from=${date}&to=${addDays(state.attFrom, -1)}`)
  if (data?.ok) set((s) => ({ attendance: { ...data.days, ...s.attendance }, attFrom: date }))
}

/** Refresh from the server unless it was done in the last few seconds. */
export function syncNow(force = false) {
  if (!force && Date.now() - lastSync < 5000) return Promise.resolve()
  return loadAll(true)
}

export async function refreshInscriptions() {
  const { data } = await request('inscriptions.php')
  if (data?.ok) set({ inscriptions: data.items })
}

/* ── students ── */

export async function saveStudent(draft: StudentDraft): Promise<{ student?: Student; fields?: string[] }> {
  const { status, data } = await post('students.php', { action: 'save', student: draft })
  if (data?.ok) {
    const st: Student = withPeriods(data.student)
    set((s) => ({ students: [...s.students.filter((x) => x.id !== st.id), st].sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)) }))
    return { student: st }
  }
  if (status === 422) return { fields: data?.fields ?? [] }
  failToast()
  return {}
}

export async function uploadPhoto(id: string, blob: Blob): Promise<boolean> {
  const fd = new FormData()
  fd.append('id', id)
  fd.append('photo', blob, 'foto.jpg')
  const { data } = await request('students.php', { method: 'POST', headers: { 'X-CSRF-Token': getCsrf() }, body: fd })
  if (data?.ok) {
    set((s) => ({ students: s.students.map((x) => (x.id === id ? withPeriods(data.student) : x)) }))
    return true
  }
  toast('No se pudo subir la foto.')
  return false
}

export async function deleteStudent(id: string) {
  const { data } = await post('students.php', { action: 'delete', id })
  if (data?.ok) set((s) => ({ students: s.students.filter((x) => x.id !== id) }))
  else failToast()
}

/* ── attendance (optimistic: the card leaves the list right away) ── */

export async function mark(date: string, student: Student, status: 'a' | 'f' | null) {
  const before = state.attendance[date]?.[student.id]
  const plan = planOf(student)
  const rec: Mark | null = status === null ? null : status === 'a' && plan?.type === 'dia' ? { s: 'a', p: priceOf(student) } : { s: status }
  const apply = (r: Mark | null | undefined) =>
    set((s) => {
      const day = { ...(s.attendance[date] ?? {}) }
      if (r) day[student.id] = r
      else delete day[student.id]
      return { attendance: { ...s.attendance, [date]: day } }
    })
  apply(rec)
  const { data } = await post('attendance.php', { action: 'mark', date, studentId: student.id, status })
  if (data?.ok) apply(data.record)
  else {
    apply(before)
    failToast()
  }
}

/* ── billing ── */

export async function savePlans(plans: Plan[]): Promise<boolean> {
  const { data } = await post('billing.php', { action: 'plans', plans })
  if (data?.ok) {
    set({ plans: data.plans })
    toast('Planes guardados')
    return true
  }
  failToast()
  return false
}

export async function saveReminderTemplate(template: string) {
  const { data } = await post('billing.php', { action: 'template', template })
  if (data?.ok) {
    set({ reminderTemplate: data.template })
    toast('Plantilla guardada')
  } else failToast()
}

export const openReminder = (d: Due) => set({ reminding: d })
export const openDayBilling = (studentId: string) => set({ dayBilling: studentId })
export const openPhoto = (studentId: string) => set({ viewingPhoto: studentId })
export const closePhoto = () => set({ viewingPhoto: null })
export const closeDayBilling = () => set({ dayBilling: null })
export const closeReminder = () => set({ reminding: null })

export async function saveMonthlyMode(mode: 'vencido' | 'anticipado') {
  const before = state.monthlyMode
  set({ monthlyMode: mode })
  const { data } = await post('billing.php', { action: 'mode', mode })
  if (data?.ok) toast('Forma de cobro guardada')
  else {
    set({ monthlyMode: before })
    failToast()
  }
}

export async function pay(p: Omit<Payment, 'id'>): Promise<Payment | null> {
  const { data } = await post('billing.php', { action: 'pay', payment: p })
  if (data?.ok) {
    set((s) => ({ payments: [...s.payments, data.payment] }))
    toast('Pago registrado')
    return data.payment
  }
  failToast()
  return null
}

export async function unpay(id: string) {
  const { data } = await post('billing.php', { action: 'unpay', id })
  if (data?.ok) set((s) => ({ payments: s.payments.filter((p) => p.id !== id) }))
  else failToast()
}

export async function addCharge(c: Omit<Charge, 'id'>): Promise<Charge | null> {
  const { data } = await post('billing.php', { action: 'charge', charge: c })
  if (data?.ok) {
    set((s) => ({ charges: [...s.charges, data.charge], charging: null }))
    toast('Cargo extra agregado')
    return data.charge
  }
  failToast()
  return null
}

export async function removeCharge(id: string) {
  const { data } = await post('billing.php', { action: 'uncharge', id })
  if (data?.ok) {
    set((s) => ({ charges: s.charges.filter((c) => c.id !== id), payments: s.payments.filter((p) => p.chargeId !== id) }))
    toast('Extra eliminado')
  } else failToast()
}

export const openCharge = (c: { studentId?: string; date?: string } = {}) => set({ charging: c })
export const closeCharge = () => set({ charging: null })

/* ── enrolments ── */

export async function deleteInscription(id: string) {
  const { data } = await post('inscriptions.php', { action: 'delete', id })
  if (data?.ok) {
    set((s) => ({ inscriptions: s.inscriptions.filter((i) => i.id !== id) }))
    toast('Inscripción eliminada')
  } else failToast()
}

export async function setInscriptionStatus(id: string, status: InscriptionStatus, note?: string) {
  const { data } = await post('inscriptions.php', { action: 'status', id, status, ...(note !== undefined ? { note } : {}) })
  if (data?.ok) set((s) => ({ inscriptions: s.inscriptions.map((i) => (i.id === id ? data.item : i)) }))
  else failToast()
}

export const openStudent = (d: StudentDraft & { inscriptionId?: string }) => set({ editing: d })
export const closeStudent = () => set({ editing: null })
export function newStudentDraft(today: string): StudentDraft {
  return { firstName: '', lastName: '', age: null, birthDate: null, startDate: today, planId: state.plans[0]?.id ?? '', price: null, billingDay: Number(today.slice(8, 10)), guardianName: '', guardianPhone: '', authorized: '', notes: '', active: true }
}

/** Students saved before periods existed get one built from their start date. */
function withPeriods(st: Student): Student {
  return st.periods?.length ? st : { ...st, periods: [{ start: st.startDate, end: st.active ? null : st.startDate, reason: '' }] }
}

/* ── helpers that read the current state ── */

export const planOf = (st: Student) => state.plans.find((p) => p.id === st.planId)
export const priceOf = (st: Student) => st.price ?? planOf(st)?.price ?? 0
export const fullName = (st: Pick<Student, 'firstName' | 'lastName'>) => `${st.firstName} ${st.lastName}`.trim()
export const photoUrl = (st: Student) => (st.photo ? `/api/photo.php?id=${st.id}&v=${st.photo}` : null)
