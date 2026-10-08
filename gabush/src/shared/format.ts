/** Formatting helpers for Colombia (es-CO): money, dates, names. */

export const money = (v: number | null | undefined) => (v === null || v === undefined ? '—' : '$ ' + Math.round(v).toLocaleString('es-CO'))

/** "320.000" / "$ 320.000" / 320000 → 320000 */
export const parseMoney = (s: string | number) => (typeof s === 'number' ? s : Number(String(s).replace(/\D/g, '')) || 0)

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** "2026-10-06" → "6 oct 2026" (no timezone shifts: dates are plain days). */
export function date(d: string | null | undefined, withYear = true): string {
  if (!d) return '—'
  const [y, m, day] = d.slice(0, 10).split('-').map(Number)
  if (!y || !m || !day) return d
  return `${day} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ''}`
}

/** "2026-10-06 15:30:00" → "6 oct 2026, 3:30 p. m." */
export function dateTime(d: string | null | undefined): string {
  if (!d) return '—'
  const t = d.slice(11, 16)
  if (!t) return date(d)
  const [h, mi] = t.split(':').map(Number)
  return `${date(d)}, ${((h + 11) % 12) + 1}:${String(mi).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`
}

export const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${y}`
}

export const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Age from a birth date: "3 años, 2 meses". */
export function age(birth: string | null | undefined): string {
  if (!birth) return '—'
  const b = new Date(birth + 'T00:00:00')
  const n = new Date()
  let months = (n.getFullYear() - b.getFullYear()) * 12 + (n.getMonth() - b.getMonth())
  if (n.getDate() < b.getDate()) months--
  const y = Math.floor(months / 12)
  const m = months % 12
  if (y <= 0) return `${m} ${m === 1 ? 'mes' : 'meses'}`
  return m ? `${y} ${y === 1 ? 'año' : 'años'}, ${m} ${m === 1 ? 'mes' : 'meses'}` : `${y} ${y === 1 ? 'año' : 'años'}`
}

type Named = { firstName: string; middleName?: string | null; lastName: string; secondLastName?: string | null }
export const fullName = (s: Named) => [s.firstName, s.middleName, s.lastName, s.secondLastName].filter(Boolean).join(' ')
export const shortName = (s: Named) => `${s.firstName} ${s.lastName}`
export const listName = (s: Named) => [s.lastName, s.secondLastName].filter(Boolean).join(' ') + ', ' + [s.firstName, s.middleName].filter(Boolean).join(' ')
export const initials = (s: Named) => `${s.firstName[0] ?? ''}${s.lastName[0] ?? ''}`.toUpperCase()

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
