import { addDays, dayDiff, parseYMD, ymd } from '@/lib/dates'
import type { Charge, Mark, Payment, Plan, Student } from './store'
import { coMobileDigits } from '@/lib/phone'

/* Pure calculations for attendance and billing. */

/** Is attendance taken for this student? Default: plan "por día" yes, "mensual" no. */
export const tracksAttendance = (st: Student, plans: Plan[]) => st.attendance ?? plans.find((p) => p.id === st.planId)?.type === 'dia'

/** Was the student enrolled on that date (any period)? */
export const enrolledOn = (st: Student, date: string) => (st.periods ?? []).some((p) => p.start <= date && (p.end === null || date <= p.end))

/** Students who should appear in the attendance list of a date. */
export const expectedOn = (students: Student[], date: string) => students.filter((s) => enrolledOn(s, date))

const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate()

/**
 * How the monthly fee is collected:
 * - "vencido": when each month is completed (entered Sep 18 → pays Oct 18, Nov 18…)
 * - "anticipado": in advance (pays on the entry day, then on the billing day of every month)
 */
export type MonthlyMode = 'vencido' | 'anticipado'

/** Due date of the k-th monthly payment (k = 0 is the first one). */
export function periodDue(st: Student, k: number, mode: MonthlyMode = 'vencido'): string {
  if (mode === 'vencido') k++
  if (k === 0) return st.startDate
  const { y, m } = parseYMD(st.startDate)
  const d = new Date(Date.UTC(y, m + k, 1))
  const yy = d.getUTCFullYear()
  const mm = d.getUTCMonth()
  return ymd(yy, mm, Math.min(st.billingDay, daysInMonth(yy, mm)))
}

export type DueStatus = 'vencido' | 'hoy' | 'pronto' | 'al-dia'

export interface Due {
  student: Student
  plan?: Plan
  kind: 'mensual' | 'dia' | 'extra'
  /** extra charges still unpaid (kind 'extra') */
  charges?: Charge[]
  /** amount to collect now (mensual: overdue periods incl. today; dia: unpaid attended days; extra: unpaid extras) */
  amount: number
  /** next date to collect (mensual) or today when a "por día" balance exists */
  date: string
  status: DueStatus
  /** mensual: overdue periods · dia: unpaid days */
  count: number
  /** the student is inactive but still owes this */
  inactive?: boolean
}

/** What a student owes and when. */
export function dueOf(st: Student, plan: Plan | undefined, price: number, payments: Payment[], attendance: Record<string, Record<string, Mark>>, today: string, mode: MonthlyMode = 'vencido'): Due {
  const mine = payments.filter((p) => p.studentId === st.id)
  if (plan?.type === 'dia') {
    const ledger = dayLedger(st, price, mine, attendance, today)
    return { student: st, plan, kind: 'dia', amount: ledger.owed, date: ledger.pending[0]?.date ?? today, status: ledger.owed > 0 ? 'hoy' : 'al-dia', count: ledger.pending.length }
  }
  // no price configured yet → nothing to collect
  if (price <= 0) return { student: st, plan, kind: 'mensual', amount: 0, date: st.startDate, status: 'al-dia', count: 0 }
  // mensual: one payment covers one month of the CURRENT enrolment (a re-entry starts a new count)
  const paidPeriods = mine.filter((p) => p.kind === 'mensual' && p.date >= addDays(st.startDate, -15)).length
  let overdue = 0
  while (periodDue(st, paidPeriods + overdue, mode) <= today && overdue < 36) overdue++
  const next = periodDue(st, paidPeriods, mode)
  const diff = dayDiff(today, next)
  const status: DueStatus = overdue > 0 ? (next === today && overdue === 1 ? 'hoy' : 'vencido') : diff <= 7 ? 'pronto' : 'al-dia'
  return { student: st, plan, kind: 'mensual', amount: Math.max(overdue, 1) * price, date: next, status, count: overdue }
}

/**
 * Everything a student owes (plan + extras). Inactive students keep their debts: unpaid attended days,
 * monthly fees that fell due before they left, and unpaid extras — but no new months after leaving.
 */
export function duesFor(st: Student, plan: Plan | undefined, price: number, payments: Payment[], charges: Charge[], attendance: Record<string, Record<string, Mark>>, today: string, mode: MonthlyMode): Due[] {
  const out: Due[] = []
  if (st.active) {
    out.push(dueOf(st, plan, price, payments, attendance, today, mode))
  } else {
    const end = st.periods?.[st.periods.length - 1]?.end
    const cutoff = end && end < today ? end : today
    const main = dueOf(st, plan, price, payments, attendance, cutoff, mode)
    const owes = main.amount > 0 && (main.kind === 'dia' || main.status === 'vencido' || main.status === 'hoy')
    if (owes) out.push({ ...main, status: main.kind === 'mensual' ? 'vencido' : main.status, inactive: true })
  }
  const extra = extraDueOf(st, plan, charges, payments, today)
  if (extra) out.push(st.active ? extra : { ...extra, inactive: true })
  return out
}

export interface LedgerDay {
  date: string
  /** a: asistió · f: no asistió */
  s: 'a' | 'f'
  /** value of an attended day */
  price: number
  /** the payment that covers it (attended days only) */
  paidBy?: Payment
  /** amount charged for this day in that payment (when it was changed) and why */
  paidAmount?: number
  paidNote?: string
}

/**
 * "Por día" ledger: every marked day since entry. Attended days are paid by the payment that lists them;
 * older payments without a list of days pay the oldest attended days first.
 */
export function dayLedger(st: Student, price: number, payments: Payment[], attendance: Record<string, Record<string, Mark>>, today: string) {
  // attendance counts from the student's (first) entry date
  const from = st.periods?.[0]?.start ?? st.startDate
  const days: LedgerDay[] = Object.entries(attendance)
    .filter(([date, day]) => day[st.id] && date >= from && date <= today)
    .map(([date, day]) => ({ date, s: day[st.id].s, price: day[st.id].s === 'a' ? (day[st.id].p ?? price) : 0 }))
    .sort((a, b) => a.date.localeCompare(b.date))
  const mine = payments.filter((p) => p.studentId === st.id && p.kind === 'dia').sort((a, b) => a.date.localeCompare(b.date))
  const byDay = new Map<string, Payment>()
  for (const p of mine) for (const d of p.days ?? []) byDay.set(d, p)
  for (const d of days) {
    if (d.s !== 'a' || !byDay.has(d.date)) continue
    d.paidBy = byDay.get(d.date)
    const item = d.paidBy!.items?.find((it) => it.date === d.date)
    if (item) {
      d.paidAmount = item.amount
      d.paidNote = item.note
    }
  }
  // legacy payments (no list of days): oldest unpaid days first
  let credit = 0
  for (const p of mine.filter((x) => !x.days?.length)) {
    credit += p.amount
    for (const d of days) {
      if (d.s !== 'a' || d.paidBy || credit < d.price) continue
      d.paidBy = p
      credit -= d.price
    }
  }
  const pending = days.filter((d) => d.s === 'a' && !d.paidBy)
  const owed = Math.max(0, pending.reduce((n, d) => n + d.price, 0) - credit)
  return { days, pending, owed, attended: days.filter((d) => d.s === 'a').length, payments: mine }
}

/** Unpaid one-off extras of a student (oldest charges are considered paid first). */
export function extraDueOf(st: Student, plan: Plan | undefined, charges: Charge[], payments: Payment[], today: string): Due | null {
  const mine = charges.filter((c) => c.studentId === st.id).sort((a, b) => a.date.localeCompare(b.date))
  if (!mine.length) return null
  let paid = payments.filter((p) => p.studentId === st.id && p.kind === 'extra').reduce((n, p) => n + p.amount, 0)
  const open: Charge[] = []
  for (const c of mine) {
    if (paid >= c.amount) paid -= c.amount
    else {
      open.push({ ...c, amount: c.amount - paid })
      paid = 0
    }
  }
  const amount = open.reduce((n, c) => n + c.amount, 0)
  if (amount <= 0) return null
  return { student: st, plan, kind: 'extra', charges: open, amount, date: open[0].date, status: open[0].date < today ? 'vencido' : 'hoy', count: open.length }
}

const ORDER: Record<DueStatus, number> = { vencido: 0, hoy: 1, pronto: 2, 'al-dia': 3 }
export const sortDues = (a: Due, b: Due) => ORDER[a.status] - ORDER[b.status] || a.date.localeCompare(b.date)

/**
 * Every day the club opened, from the earliest *latest* entry date among the students up to yesterday
 * (newest first), with how many of the students enrolled that day are still unmarked.
 */
export function daysSinceEntry(students: Student[], attendance: Record<string, Record<string, Mark>>, isOpen: (d: string) => boolean, today: string) {
  const starts = students.map((s) => s.periods?.[s.periods.length - 1]?.start ?? s.startDate).filter(Boolean)
  if (!starts.length) return []
  const from = starts.reduce((m, d) => (d < m ? d : m))
  const out: { date: string; pending: number; total: number }[] = []
  for (let d = addDays(today, -1), i = 0; d >= from && i < 800; d = addDays(d, -1), i++) {
    if (!isOpen(d)) continue
    // only students whose latest entry is on/before that day
    const exp = expectedOn(students, d).filter((s) => (s.periods?.[s.periods.length - 1]?.start ?? s.startDate) <= d)
    if (!exp.length) continue
    out.push({ date: d, total: exp.length, pending: exp.filter((s) => !attendance[d]?.[s.id]).length })
  }
  return out
}

/** Recent open days with students still unmarked (to catch up on a forgotten day). */
export function pendingDays(students: Student[], attendance: Record<string, Record<string, Mark>>, isOpen: (d: string) => boolean, today: string, back = 14) {
  const out: { date: string; pending: number }[] = []
  for (let i = 1; i <= back; i++) {
    const d = addDays(today, -i)
    if (!isOpen(d)) continue
    const exp = expectedOn(students, d)
    const pending = exp.filter((s) => !attendance[d]?.[s.id]).length
    if (pending) out.push({ date: d, pending })
  }
  return out
}

/** Age on a date from 'YYYY-MM-DD'. */
export function ageOn(birth: string, today: string): number {
  const [by, bm, bd] = birth.split('-').map(Number)
  const [y, m, d] = today.split('-').map(Number)
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0)
}

/** Age shown everywhere: from the birth date when there is one, otherwise the typed age. */
export const studentAge = (st: Student, today: string) => (st.birthDate ? ageOn(st.birthDate, today) : st.age)

/** Next birthday on/after today (Feb 29 → Feb 28 in common years) and the age they turn. */
export function nextBirthday(birth: string, today: string): { date: string; turns: number } {
  const [by, bm, bd] = birth.split('-').map(Number)
  const at = (y: number) => {
    const leap = new Date(Date.UTC(y, 1, 29)).getUTCMonth() === 1
    const day = bm === 2 && bd === 29 && !leap ? 28 : bd
    return `${y}-${String(bm).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }
  const y = Number(today.slice(0, 4))
  const date = at(y) >= today ? at(y) : at(y + 1)
  return { date, turns: Number(date.slice(0, 4)) - by }
}

/** Students (enrolled today) with a birthday in the next `days` days, soonest first. */
export function upcomingBirthdays(students: Student[], today: string, days = 7) {
  return students
    .filter((s) => s.birthDate && enrolledOn(s, today))
    .map((s) => ({ student: s, ...nextBirthday(s.birthDate!, today) }))
    .filter((b) => dayDiff(today, b.date) <= days)
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** COP money: $ 180.000 */
export const money = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

/** WhatsApp link to the guardian (Colombian mobile numbers get the 57 prefix). */
export function guardianWhatsapp(phone: string, text: string): string | null {
  const d = coMobileDigits(phone)
  return d ? `https://wa.me/57${d}?text=${encodeURIComponent(text)}` : null
}
