import { formatTime, weekdayIndex, weekdayLong } from './dates'
import type { CalEvent, DayHours, Schedule, Slot } from './calendar'

/** Opening-hours helpers for the calendar, the contact block and the FAQ. */

const and = (lang: string) => (lang === 'en' ? ' and ' : ' y ')
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** "8:00 a. m. – 11:00 a. m. y 2:00 p. m. – 5:00 p. m." */
export function formatSlots(slots: Slot[], lang: string): string {
  const parts = slots.map((s) => `${formatTime(s.from, lang)} – ${formatTime(s.to, lang)}`)
  if (parts.length <= 1) return parts.join('')
  return `${parts.slice(0, -1).join(', ')}${and(lang)}${parts[parts.length - 1]}`
}

const same = (a: DayHours, b: DayHours) => a.open === b.open && JSON.stringify(a.slots) === JSON.stringify(b.slots)

/** Groups consecutive weekdays with the same hours: "Lunes a viernes: 8:00 a. m. – …". Closed days are left out. */
export function summarizeSchedule(schedule: Schedule, lang: string): string[] {
  const out: string[] = []
  const d = schedule.days
  let i = 0
  while (i < 7) {
    let j = i
    while (j + 1 < 7 && same(d[j + 1], d[i])) j++
    if (d[i].open) {
      const days = i === j ? cap(weekdayLong(i, lang)) : `${cap(weekdayLong(i, lang))} ${lang === 'en' ? 'to' : 'a'} ${weekdayLong(j, lang)}`
      out.push(`${days}: ${formatSlots(d[i].slots, lang)}`)
    }
    i = j + 1
  }
  return out
}

export type DayStatus = { open: true; slots: Slot[] } | { open: false; reason: 'weekly' | 'festivo'; festivo?: CalEvent }

/** Whether the club opens on a date: closed on the weekly days off and on holidays (festivos). */
export function dayStatus(schedule: Schedule, events: CalEvent[], date: string): DayStatus {
  const festivo = events.find((e) => e.type === 'festivo' && e.start <= date && e.end >= date)
  if (festivo) return { open: false, reason: 'festivo', festivo }
  const day = schedule.days[weekdayIndex(date)]
  return day?.open ? { open: true, slots: day.slots } : { open: false, reason: 'weekly' }
}

/** Is a 'HH:MM' time inside one of the slots? */
export const openAt = (slots: Slot[], hhmm: string) => slots.some((s) => s.from <= hhmm && hhmm < s.to)
