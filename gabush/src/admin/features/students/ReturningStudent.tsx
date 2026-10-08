import { ArrowRight, History, Loader2, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ApiError } from '@/shared/api'
import { toast } from '../../store'
import { api2, qs } from '../../v2/api'
import { Badge, StatusBadge, StudentAvatar, inputCls } from '../../v2/kit'
import { openStudent, studentsChanged } from './openStudent'

export type FoundStudent = {
  id: number
  code: string
  firstName: string
  middleName: string | null
  lastName: string
  secondLastName: string | null
  docNumber: string | null
  hasPhoto: number
  lastYear: number | null
  lastCourse: string | null
  lastStatus: string | null
  years: number
  statusThisYear: string | null
  guardian: string | null
  suggestedCourse: string | null
}

export const lookupStudents = (params: { q?: string; doc?: string; year: number | null }) => api2.get<{ students: FoundStudent[] }>('/students/lookup' + qs(params)).then((r) => r.students)

/**
 * "¿Ya estuvo en el jardín?": finds a student of any year and enrolls them in the working year with all their
 * data and history (instead of typing them again as a new student).
 */
export function ReturningStudent({ year, onDone }: { year: number | null; onDone: () => void }) {
  const [q, setQ] = useState('')
  const [found, setFound] = useState<FoundStudent[] | null>(null)
  const [busy, setBusy] = useState<number | 'search' | null>(null)
  useEffect(() => {
    if (q.trim().length < 3) return setFound(null)
    const t = window.setTimeout(async () => {
      setBusy('search')
      setFound(await lookupStudents({ q: q.trim(), year }).catch(() => []))
      setBusy(null)
    }, 350)
    return () => window.clearTimeout(t)
  }, [q, year])
  const enroll = async (s: FoundStudent) => {
    setBusy(s.id)
    try {
      await api2.post('/enrollments', { studentId: s.id, year, status: 'prematricula' })
      toast(`${s.firstName} quedó prematriculado en ${year}${s.suggestedCourse ? ` · ${s.suggestedCourse}` : ''}`)
      studentsChanged()
      onDone()
      openStudent(s.id, 'matricula')
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'No se pudo prematricular')
    } finally {
      setBusy(null)
    }
  }
  return (
    <section className="rounded-2xl border-2 border-royal/25 bg-[#f5f4fd] p-4">
      <h3 className="flex items-center gap-2 text-lg">
        <History size={19} className="text-royal" /> ¿Ya estuvo en el jardín?
      </h3>
      <p className="mt-1 text-sm text-muted">Búscalo y matricúlalo en {year} con todos sus datos, su familia y su historial. No hace falta escribir nada de nuevo.</p>
      <div className="relative mt-2">
        <Search size={17} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, código GAB, documento o acudiente" className={inputCls() + ' pl-10'} />
        {busy === 'search' && <Loader2 size={17} className="absolute top-1/2 right-3.5 -translate-y-1/2 animate-spin text-muted" />}
      </div>
      {found && !found.length && <p className="mt-2 text-sm text-muted">No encontramos a nadie con «{q}». Si es nuevo, llena el formulario de abajo.</p>}
      {found && found.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {found.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-2.5">
              <StudentAvatar s={s} size={42} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">
                  {s.lastName} {s.secondLastName ?? ''}, {s.firstName} {s.middleName ?? ''}
                </span>
                <span className="block text-[12px] text-muted">
                  {s.code}
                  {s.lastYear ? ` · último año ${s.lastYear}${s.lastCourse ? ` en ${s.lastCourse}` : ''}` : ''}
                  {s.years > 1 ? ` · ${s.years} años en el jardín` : ''}
                  {s.guardian ? ` · ${s.guardian}` : ''}
                </span>
              </span>
              {s.lastStatus === 'retirado' && !s.statusThisYear && <Badge tone="yellow">Se había retirado</Badge>}
              {s.statusThisYear ? (
                <button type="button" onClick={() => { onDone(); openStudent(s.id, 'matricula') }} className="inline-flex items-center gap-1.5 text-sm font-semibold text-royal">
                  <StatusBadge status={s.statusThisYear} /> Ya está en {year} <ArrowRight size={15} />
                </button>
              ) : (
                <button type="button" disabled={busy !== null} onClick={() => enroll(s)} className="btn btn-primary !min-h-10 !px-4 !text-sm">
                  {busy === s.id && <Loader2 size={16} className="animate-spin" />} Prematricular en {year}
                  {s.suggestedCourse && <span className="font-normal opacity-80">· {s.suggestedCourse}</span>}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
