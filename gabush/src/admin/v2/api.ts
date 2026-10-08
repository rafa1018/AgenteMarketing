import { useSyncExternalStore } from 'react'
import { expireSession, getCsrf } from '@/lib/calendar'
import { createApi, qs } from '@/shared/api'

/** v2 API for the staff panel (same session + CSRF token as the rest of the panel). */
export const api2 = createApi({ csrf: getCsrf, onUnauthorized: expireSession })
export { qs }

export type Id = number
export interface YearInfo { id: number; name: string; startsOn: string | null; endsOn: string | null; status: 'planned' | 'active' | 'closed' }
export interface PeriodInfo { id: Id; number: number; name: string; startsOn: string | null; endsOn: string | null; weight: string; gradingOpen: number; published: number }
export interface GradeLevel { id: Id; name: string; sort: number; minAgeMonths: number | null; maxAgeMonths: number | null; active: number }
export interface Classroom { id: Id; name: string; capacity: number; location: string | null; active: number }
export interface CourseInfo { id: Id; name: string; alias: string | null; gradeLevelId: Id; classroomId: Id | null; capacity: number; directorId: Id | null; shift: string | null; active: number; enrolled: number }
export interface StaffInfo { id: Id; name: string; position: string | null; phone: string | null; email: string | null; userId: string | null; active: number }
export interface Area { id: Id; name: string; position: number }
export interface Subject { id: Id; name: string; areaId: Id | null; active: number }
export interface Level { id: Id; name: string; min: string; max: string }
export interface Concept { id: Id; code: string; name: string; frequency: 'mensual' | 'anual' | 'eventual'; onEnrollment: number; lateFee: number; online: number; active: number }
export interface DocumentType { id: Id; name: string; description: string | null; required: number; appliesTo: 'nuevos' | 'todos'; familyUpload: number; sort: number; active: number }
export interface Setup {
  activeYear: number
  year: number
  years: YearInfo[]
  periods: PeriodInfo[]
  gradeLevels: GradeLevel[]
  classrooms: Classroom[]
  courses: CourseInfo[]
  staff: StaffInfo[]
  areas: Area[]
  subjects: Subject[]
  levels: Level[]
  concepts: Concept[]
  documentTypes: DocumentType[]
  school: { name: string; nit?: string; address?: string; phone?: string; email?: string }
}

/* ── shared setup (catalogs) + the year being worked on, kept across modules ── */
type SetupState = { setup: Setup | null; year: number | null; loading: boolean }
let state: SetupState = { setup: null, year: null, loading: false }
const listeners = new Set<() => void>()
const set = (p: Partial<SetupState>) => {
  state = { ...state, ...p }
  listeners.forEach((l) => l())
}
const YEAR_KEY = 'gb-year'

export async function loadSetup(year?: number | null) {
  set({ loading: true })
  try {
    const y = year ?? state.year ?? (Number(sessionStorage.getItem(YEAR_KEY)) || null)
    const s = await api2.get<Setup>('/setup' + qs({ year: y }))
    set({ setup: s, year: s.year })
  } finally {
    set({ loading: false })
  }
}

export function setWorkingYear(year: number) {
  try {
    sessionStorage.setItem(YEAR_KEY, String(year))
  } catch {
    /* ignore */
  }
  loadSetup(year)
}

export function useSetup(): SetupState & { reload: () => Promise<void> } {
  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
  if (!s.setup && !s.loading) queueMicrotask(() => !state.setup && !state.loading && loadSetup())
  return { ...s, reload: () => loadSetup(s.year) }
}

export const studentPhoto = (id: Id, version?: string) => `/api/v2/students/${id}/photo${version ? `?v=${version}` : ''}`
