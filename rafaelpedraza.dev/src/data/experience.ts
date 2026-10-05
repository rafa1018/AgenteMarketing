import { useEffect, useState } from 'react'
import type { L } from '@/i18n'
import seed from '../../public/api/seed/experience.json'

/**
 * PROFESSIONAL EXPERIENCE — managed from the admin panel (/admin/ → Experiencia) and served by /api/experience.php.
 * public/api/seed/experience.json (from CVRafaelPedraza2026_v2.pdf) is only the starting point: the API copies it
 * into the data folder the first time, and it is the fallback when the API can't be reached.
 */
export interface Experience {
  id: string
  company: string
  location: string
  role: L
  start: string // YYYY-MM
  end: string // YYYY-MM, '' = current job
  technologies: string[]
  responsibilities: L[]
  highlight?: boolean
}

export const experienceSeed = seed as Experience[]

const MONTHS: L[] = ['Ene|Jan', 'Feb|Feb', 'Mar|Mar', 'Abr|Apr', 'May|May', 'Jun|Jun', 'Jul|Jul', 'Ago|Aug', 'Sep|Sep', 'Oct|Oct', 'Nov|Nov', 'Dic|Dec'].map((m) => {
  const [es, en] = m.split('|')
  return { es, en }
})
const month = (ym: string, lang: 'es' | 'en') => `${MONTHS[Number(ym.slice(5, 7)) - 1]?.[lang] ?? ''} ${ym.slice(0, 4)}`

/** "Ago 2025 — Dic 2025" / "Aug 2025 — Present" */
export const period = (e: Pick<Experience, 'start' | 'end'>): L => ({
  es: `${month(e.start, 'es')} — ${e.end ? month(e.end, 'es') : 'Actualidad'}`,
  en: `${month(e.start, 'en')} — ${e.end ? month(e.end, 'en') : 'Present'}`,
})

/** English is optional in the admin panel: fall back to Spanish. */
export const both = (v: L): L => ({ es: v.es, en: v.en?.trim() ? v.en : v.es })

/** Newest first: current jobs, then by start date. */
export const sortExperience = (list: Experience[]) => [...list].sort((a, b) => Number(b.end === '') - Number(a.end === '') || b.start.localeCompare(a.start))

/** Career summary: years covered (first start → last end, or today), number of roles and organizations. */
export function summary(list: Experience[]) {
  const now = new Date().toISOString().slice(0, 7)
  const firstYear = list.length ? Math.min(...list.map((e) => Number(e.start.slice(0, 4)))) : 0
  const lastYear = list.length ? Math.max(...list.map((e) => Number((e.end || now).slice(0, 4)))) : 0
  const companies = [...new Set(list.map((e) => e.company.replace(/ \(.+\)$/, '').trim()))]
  return { firstYear, lastYear, roles: list.length, companies }
}

let loaded: Promise<Experience[]> | null = null
export function loadExperience(): Promise<Experience[]> {
  loaded ??= fetch('/api/experience.php')
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (d?.ok && Array.isArray(d.items) ? (d.items as Experience[]) : experienceSeed))
    .catch(() => experienceSeed)
    .then(sortExperience)
  return loaded
}

/** Experience from the API; null while loading. */
export function useExperience(): Experience[] | null {
  const [list, setList] = useState<Experience[] | null>(null)
  useEffect(() => {
    let alive = true
    loadExperience().then((l) => alive && setList(l))
    return () => {
      alive = false
    }
  }, [])
  return list
}

const p = (es: string, en: string): L => ({ es, en })

export const education = [
  { title: p('Especialización en Ingeniería de Software', 'Specialization in Software Engineering'), institution: 'Universidad Popular del Cesar', date: p('Dic 2025', 'Dec 2025') },
  { title: p('Ingeniería de Sistemas', 'Systems Engineering'), institution: 'Universidad Popular del Cesar', date: p('Oct 2022', 'Oct 2022') },
]
