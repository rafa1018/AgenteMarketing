/** Calendar date helpers. Dates travel as 'YYYY-MM-DD' strings (no time zones involved). */

const pad = (n: number) => String(n).padStart(2, '0')

export const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}` // m: 0-11

export function todayYMD(): string {
  const d = new Date()
  return ymd(d.getFullYear(), d.getMonth(), d.getDate())
}

export function parseYMD(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split('-').map(Number)
  return { y, m: m - 1, d }
}

const toUTC = (s: string) => {
  const { y, m, d } = parseYMD(s)
  return new Date(Date.UTC(y, m, d))
}

export function addDays(s: string, n: number): string {
  const t = toUTC(s)
  t.setUTCDate(t.getUTCDate() + n)
  return ymd(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate())
}

/** 42 cells (6 weeks) starting on Monday, for month m (0-11) of year y. */
export function monthGrid(y: number, m: number): { date: string; inMonth: boolean }[] {
  const first = new Date(Date.UTC(y, m, 1))
  const offset = (first.getUTCDay() + 6) % 7 // Monday = 0
  const start = addDays(ymd(y, m, 1), -offset)
  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(start, i)
    return { date, inMonth: parseYMD(date).m === m }
  })
}

const locale = (lang: string) => (lang === 'en' ? 'en-US' : 'es-CO')

export const monthName = (y: number, m: number, lang: string) =>
  new Intl.DateTimeFormat(locale(lang), { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m, 1)))

export const weekdayShort = (lang: string) =>
  Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale(lang), { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 1 + i))).replace('.', ''))

export function formatDay(s: string, lang: string, withWeekday = false): string {
  return new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'long', ...(withWeekday ? { weekday: 'long' } : {}), timeZone: 'UTC' }).format(toUTC(s))
}

/** "12 – 16 de octubre de 2026", "30 sept – 3 oct", or a single day. */
export function formatRange(start: string, end: string, lang: string): string {
  const f = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale(lang), { ...opts, timeZone: 'UTC' })
  const a = toUTC(start)
  if (start === end) return f({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(a)
  return f({ day: 'numeric', month: 'short', year: 'numeric' }).formatRange(a, toUTC(end))
}

export const dayDiff = (a: string, b: string) => Math.round((toUTC(b).getTime() - toUTC(a).getTime()) / 86400000)

/** '#3a36a8' → 'rgba(28, 59, 130, a)' */
export function tint(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

/** Monday = 0 … Sunday = 6 */
export const weekdayIndex = (s: string) => (toUTC(s).getUTCDay() + 6) % 7

/** '14:00' → '2:00 p. m.' / '2:00 PM' */
export function formatTime(hhmm: string, lang: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  return new Intl.DateTimeFormat(locale(lang), { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 1, h, m)))
}

export const weekdayLong = (i: number, lang: string) => new Intl.DateTimeFormat(locale(lang), { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 1 + i)))

/** Current local time as 'HH:MM'. */
export function nowHHMM(): string {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
