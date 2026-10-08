import { GraduationCap, School } from 'lucide-react'
import { useState } from 'react'
import { useQuery } from '@/shared/useQuery'
import { api, useSession } from '../session'
import { Loading, Problem, Title, YearSelect } from '../ui'

interface Subjects { year: number; course: { name: string; director: string | null } | null; subjects: { subject: string; area: string | null; teacher: string | null }[] }

/** Subjects (dimensions) of the student's course in the year, with their teachers. */
export function SubjectsPage() {
  const { me } = useSession()
  const [year, setYear] = useState(me?.year ?? new Date().getFullYear())
  const q = useQuery(`subjects-${year}`, () => api.get<Subjects>(`/portal/subjects?year=${year}`))
  const d = q.data
  const areas = new Map<string, Subjects['subjects']>()
  for (const s of d?.subjects ?? []) areas.set(s.area ?? 'Otras', [...(areas.get(s.area ?? 'Otras') ?? []), s])
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <Title sub="Lo que aprende tu hijo o hija este año.">Materias</Title>
        {me && <YearSelect years={me.years.length ? me.years : [me.year]} value={year} onChange={setYear} />}
      </div>
      {q.loading && <Loading />}
      {q.error && <Problem message={q.error.message} onRetry={q.reload} />}
      {d && (
        <div className="space-y-4">
          {d.course && (
            <div className="card flex items-center gap-3 p-4">
              <School className="shrink-0 text-royal" />
              <span>
                <span className="block font-semibold text-ink">{d.course.name}</span>
                {d.course.director && <span className="block text-sm text-muted">Directora de grupo: {d.course.director}</span>}
              </span>
            </div>
          )}
          {!d.subjects.length && <p className="card p-6 text-center text-muted">Aún no hay materias asignadas para {year}.</p>}
          {[...areas].map(([area, list]) => (
            <section key={area} className="card overflow-hidden p-0">
              <h2 className="bg-paper px-4 py-2.5 text-[13px] font-extrabold tracking-[0.12em] text-ink uppercase">{area}</h2>
              <ul className="divide-y divide-line">
                {list.map((s) => (
                  <li key={s.subject} className="flex items-center gap-3 px-4 py-3">
                    <GraduationCap size={18} className="shrink-0 text-pink" />
                    <span className="flex-1 font-semibold text-ink">{s.subject}</span>
                    {s.teacher && <span className="text-right text-[13px] text-muted">{s.teacher}</span>}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  )
}
