import { CheckCheck, ClipboardCheck, Loader2, Save } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { useMutation, useQuery } from '@/shared/useQuery'
import { date, listName, todayISO } from '@/shared/format'
import { toast } from '../../store'
import { PageHead } from '../../ui'
import { api2, qs, useSetup } from '../../v2/api'
import { CourseSelect, Empty, ErrorBox, Spinner, StudentAvatar, Tabs, useTab } from '../../v2/kit'
import { openStudent } from '../students/openStudent'

type Row = { id: number; code: string; firstName: string; lastName: string; secondLastName: string | null; hasPhoto: number; status: string | null; note: string | null; recordedBy: string | null }
type Summary = { days: string[]; students: { id: number; code: string; firstName: string; lastName: string; presente: number; ausente: number; justificada: number; tarde: number }[] }

const STATES: { id: string; label: string; short: string; cls: string }[] = [
  { id: 'presente', label: 'Presente', short: 'P', cls: 'bg-leaf text-white' },
  { id: 'ausente', label: 'Ausente', short: 'A', cls: 'bg-berry text-white' },
  { id: 'justificada', label: 'Justificada', short: 'J', cls: 'bg-ocean text-white' },
  { id: 'tarde', label: 'Tarde', short: 'T', cls: 'bg-gold text-ink' },
]

/** Daily attendance per course + monthly summary. */
export function AttendancePage() {
  const { setup } = useSetup()
  const [tab, setTab] = useTab<'dia' | 'resumen'>('dia')
  const [course, setCourse] = useState<number | null>(null)
  useEffect(() => {
    if (!course && setup?.courses.length) setCourse(setup.courses.find((c) => c.enrolled > 0)?.id ?? setup.courses[0].id)
  }, [setup, course])
  return (
    <div className="space-y-5">
      <PageHead title="Asistencia" sub="Marca la asistencia de cada curso; la familia recibe un aviso si su hijo faltó o llegó tarde." />
      <div className="flex flex-wrap items-center gap-3">
        <Tabs tabs={[{ id: 'dia', label: 'Tomar asistencia' }, { id: 'resumen', label: 'Resumen del mes' }]} value={tab} onChange={setTab} />
        <div className="w-full sm:ml-auto sm:w-64">
          <CourseSelect value={course} onChange={setCourse} allowAll={false} />
        </div>
      </div>
      {!course ? <Empty icon={<ClipboardCheck />} title="Elige un curso" /> : tab === 'dia' ? <DaySheet course={course} /> : <MonthSummary course={course} />}
    </div>
  )
}

function DaySheet({ course }: { course: number }) {
  const [day, setDay] = useState(todayISO())
  const { data, error, loading, reload } = useQuery(`attday:${course}:${day}`, () => api2.get<{ students: Row[] }>('/attendance' + qs({ course, date: day })))
  const [marks, setMarks] = useState<Record<number, { status: string | null; note: string }>>({})
  const m = useMutation()
  useEffect(() => {
    setMarks(Object.fromEntries((data?.students ?? []).map((s) => [s.id, { status: s.status, note: s.note ?? '' }])))
  }, [data])
  const dirty = useMemo(() => (data?.students ?? []).some((s) => (marks[s.id]?.status ?? null) !== s.status || (marks[s.id]?.note ?? '') !== (s.note ?? '')), [data, marks])
  const counts = useMemo(() => Object.values(marks).reduce<Record<string, number>>((a, x) => (x.status ? { ...a, [x.status]: (a[x.status] ?? 0) + 1 } : a), {}), [marks])
  const save = async () => {
    const items = Object.entries(marks).map(([id, v]) => ({ studentId: Number(id), status: v.status ?? '', note: v.note }))
    if (await m.run(() => api2.put('/attendance', { date: day, items }))) {
      toast('Asistencia guardada')
      reload()
    }
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={day} max={todayISO()} onChange={(e) => setDay(e.target.value)} className="rounded-lg border border-line bg-white px-3 py-2 font-semibold" aria-label="Fecha" />
        <span className="text-sm text-muted">{date(day)}</span>
        <button type="button" onClick={() => setMarks(Object.fromEntries((data?.students ?? []).map((s) => [s.id, { status: marks[s.id]?.status ?? 'presente', note: marks[s.id]?.note ?? '' }])))} className="btn btn-ghost ml-auto !min-h-10 !text-sm">
          <CheckCheck size={17} /> Los demás presentes
        </button>
      </div>
      {error ? (
        <ErrorBox message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Spinner />
      ) : !data?.students.length ? (
        <Empty title="Este curso no tiene estudiantes activos" />
      ) : (
        <>
          <ul className="space-y-2">
            {data.students.map((s) => {
              const v = marks[s.id] ?? { status: null, note: '' }
              return (
                <li key={s.id} className="card flex flex-wrap items-center gap-3 p-3">
                  <button type="button" onClick={() => openStudent(s.id, 'asistencia')} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <StudentAvatar s={s} size={44} />
                    <span className="truncate font-semibold text-ink">{listName(s)}</span>
                  </button>
                  <div className="flex gap-1.5">
                    {STATES.map((st) => (
                      <button key={st.id} type="button" title={st.label} aria-pressed={v.status === st.id} onClick={() => setMarks({ ...marks, [s.id]: { ...v, status: v.status === st.id ? null : st.id } })} className={cn('grid size-11 place-items-center rounded-xl text-[15px] font-bold transition-colors', v.status === st.id ? st.cls : 'bg-paper text-muted hover:text-ink')}>
                        {st.short}
                      </button>
                    ))}
                  </div>
                  {v.status && v.status !== 'presente' && (
                    <input value={v.note} onChange={(e) => setMarks({ ...marks, [s.id]: { ...v, note: e.target.value } })} placeholder="Nota (motivo, hora de llegada…)" className="w-full rounded-lg border border-line px-3 py-2 text-[15px]" />
                  )}
                </li>
              )
            })}
          </ul>
          <div className="sticky bottom-20 z-10 flex flex-wrap items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-white shadow-lg lg:bottom-4">
            <span className="text-sm">
              {STATES.map((st) => `${st.label}: ${counts[st.id] ?? 0}`).join(' · ')}
            </span>
            <button type="button" disabled={!dirty || m.busy} onClick={save} className="btn btn-gold ml-auto !min-h-10 !text-sm disabled:opacity-50">
              {m.busy ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />} Guardar
            </button>
          </div>
          {m.message && <ErrorBox message={m.message} />}
        </>
      )}
    </div>
  )
}

function MonthSummary({ course }: { course: number }) {
  const [month, setMonth] = useState(todayISO().slice(0, 7))
  const from = `${month}-01`
  const to = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).toISOString().slice(0, 10)
  const { data, error, loading, reload } = useQuery(`attsum:${course}:${month}`, () => api2.get<Summary>('/attendance/summary' + qs({ course, from, to })))
  return (
    <div className="space-y-3">
      <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg border border-line bg-white px-3 py-2 font-semibold" aria-label="Mes" />
      {error ? (
        <ErrorBox message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Spinner />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[520px] text-[14px]">
            <thead>
              <tr className="bg-paper text-left text-[12px] font-bold tracking-wide text-muted uppercase">
                <th className="px-4 py-2.5">Estudiante</th>
                {STATES.map((s) => (
                  <th key={s.id} className="px-3 py-2.5 text-center">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.students.map((s) => (
                <tr key={s.id} className="border-t border-line">
                  <td className="px-4 py-2.5">
                    <button type="button" onClick={() => openStudent(s.id, 'asistencia')} className="font-semibold text-ink hover:text-royal">
                      {s.lastName}, {s.firstName}
                    </button>
                  </td>
                  <td className="px-3 text-center tabular-nums">{s.presente}</td>
                  <td className={cn('px-3 text-center tabular-nums', s.ausente > 0 && 'font-bold text-berry')}>{s.ausente}</td>
                  <td className="px-3 text-center tabular-nums">{s.justificada}</td>
                  <td className="px-3 text-center tabular-nums">{s.tarde}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-line px-4 py-2 text-[13px] text-muted">{data?.days.length ?? 0} días con asistencia registrada en el mes.</p>
        </div>
      )}
    </div>
  )
}
