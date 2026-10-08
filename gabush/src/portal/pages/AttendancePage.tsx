import { useState } from 'react'
import { date, monthLabel } from '@/shared/format'
import { useQuery } from '@/shared/useQuery'
import { cn } from '@/lib/utils'
import { api, useSession } from '../session'
import { Loading, Problem, Title, YearSelect } from '../ui'

type Status = 'presente' | 'ausente' | 'justificada' | 'tarde'
interface History { year: number; days: { day: string; status: Status; note: string | null }[]; totals: Record<Status, number> }

const META: Record<Status, { label: string; dot: string; text: string }> = {
  presente: { label: 'Asistió', dot: 'bg-[#2f8a5b]', text: 'text-leaf' },
  tarde: { label: 'Llegó tarde', dot: 'bg-[#e2a33b]', text: 'text-[#8a5716]' },
  justificada: { label: 'Falta justificada', dot: 'bg-[#2f7fc1]', text: 'text-[#185a8a]' },
  ausente: { label: 'Falta', dot: 'bg-[#c4473e]', text: 'text-berry' },
}

/** Attendance history: totals and every recorded day, newest first, grouped by month. */
export function AttendancePage() {
  const { me } = useSession()
  const [year, setYear] = useState(me?.year ?? new Date().getFullYear())
  const [only, setOnly] = useState<'todo' | 'faltas'>('todo')
  const q = useQuery(`attendance-${year}`, () => api.get<History>(`/portal/attendance?year=${year}`))
  const h = q.data
  const days = (h?.days ?? []).filter((d) => only === 'todo' || d.status !== 'presente')
  const months = new Map<string, History['days']>()
  for (const d of days) months.set(d.day.slice(0, 7), [...(months.get(d.day.slice(0, 7)) ?? []), d])
  const total = h ? Object.values(h.totals).reduce((s, n) => s + n, 0) : 0
  const pct = h && total ? Math.round(((h.totals.presente + h.totals.tarde) / total) * 100) : null
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <Title sub="Asistencias, faltas y justificaciones.">Asistencia</Title>
        {me && <YearSelect years={me.years.length ? me.years : [me.year]} value={year} onChange={setYear} />}
      </div>
      {q.loading && <Loading />}
      {q.error && <Problem message={q.error.message} onRetry={q.reload} />}
      {h && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.keys(META) as Status[]).map((s) => (
              <div key={s} className="card p-3 text-center">
                <p className={cn('font-serif text-2xl font-semibold', META[s].text)}>{h.totals[s]}</p>
                <p className="text-[12px] font-semibold text-muted">{META[s].label}</p>
              </div>
            ))}
          </div>
          {pct !== null && (
            <div className="card p-4">
              <div className="mb-1.5 flex justify-between text-sm font-semibold">
                <span>Asistencia del año</span>
                <span>{pct}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-paper">
                <div className="h-full rounded-full bg-[#2f8a5b]" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
          {total > 0 && (
            <div className="flex gap-1">
              {(['todo', 'faltas'] as const).map((k) => (
                <button key={k} type="button" onClick={() => setOnly(k)} className={cn('rounded-full px-4 py-2 text-[14px] font-semibold', only === k ? 'bg-ink text-white' : 'bg-white text-muted ring-1 ring-line')}>
                  {k === 'todo' ? 'Todos los días' : 'Solo novedades'}
                </button>
              ))}
            </div>
          )}
          {!days.length && <p className="card p-6 text-center text-muted">{total ? 'Sin faltas ni llegadas tarde. ¡Muy bien!' : `No hay registros de asistencia en ${year}.`}</p>}
          {[...months].map(([m, list]) => (
            <section key={m}>
              <h2 className="mb-2 text-[13px] font-extrabold tracking-[0.12em] text-muted uppercase">{monthLabel(m)}</h2>
              <ul className="card divide-y divide-line p-0">
                {list.map((d) => (
                  <li key={d.day} className="flex items-center gap-3 px-4 py-2.5">
                    <span className={cn('size-2.5 shrink-0 rounded-full', META[d.status].dot)} />
                    <span className="w-24 shrink-0 text-[15px] font-semibold text-ink capitalize">{weekday(d.day)} {date(d.day, false)}</span>
                    <span className={cn('flex-1 text-[14px] font-semibold', META[d.status].text)}>
                      {META[d.status].label}
                      {d.note && <span className="block font-normal text-muted">{d.note}</span>}
                    </span>
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

const weekday = (d: string) => ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][new Date(d + 'T12:00:00').getDay()]
