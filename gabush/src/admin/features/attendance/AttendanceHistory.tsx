import { useQuery } from '@/shared/useQuery'
import { date } from '@/shared/format'
import { api2, qs, useSetup } from '../../v2/api'
import { ErrorBox, Spinner, Stat, StatusBadge } from '../../v2/kit'

type History = { year: number; days: { day: string; status: string; note: string | null }[]; totals: Record<'presente' | 'ausente' | 'justificada' | 'tarde', number> }

/** Attendance of one student in the working year (totals + day by day, absences first). */
export function AttendanceHistory({ studentId }: { studentId: number }) {
  const { year } = useSetup()
  const { data, error, loading, reload } = useQuery(`att:${studentId}:${year}`, () => api2.get<History>(`/students/${studentId}/attendance` + qs({ year })))
  if (error) return <ErrorBox message={error.message} onRetry={reload} />
  if (loading && !data) return <Spinner />
  if (!data) return null
  const t = data.totals
  const marked = t.presente + t.ausente + t.justificada + t.tarde
  const notPresent = data.days.filter((d) => d.status !== 'presente')
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Asistió" value={t.presente + t.tarde} hint={marked ? `${Math.round(((t.presente + t.tarde) / marked) * 100)}% de los días` : undefined} tone="green" />
        <Stat label="Faltas" value={t.ausente} tone={t.ausente ? 'red' : 'ink'} />
        <Stat label="Justificadas" value={t.justificada} tone="blue" />
        <Stat label="Llegó tarde" value={t.tarde} />
      </div>
      <section className="card p-4 sm:p-5">
        <h3 className="mb-2 text-lg">Faltas, justificadas y tardanzas</h3>
        {!notPresent.length ? (
          <p className="text-sm text-muted">{marked ? 'Asistió todos los días registrados. ¡Muy bien!' : 'Aún no hay asistencia registrada este año.'}</p>
        ) : (
          <ul className="divide-y divide-line">
            {notPresent.map((d) => (
              <li key={d.day} className="flex items-center justify-between gap-3 py-2">
                <span>
                  <span className="font-semibold text-ink">{date(d.day)}</span>
                  {d.note && <span className="text-sm text-muted"> · {d.note}</span>}
                </span>
                <StatusBadge status={d.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
