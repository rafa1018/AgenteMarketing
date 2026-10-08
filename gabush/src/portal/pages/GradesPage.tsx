import { Printer } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ReportCard, type ReportCardData } from '@/shared/ReportCard'
import { useQuery } from '@/shared/useQuery'
import { api, useSession } from '../session'
import { Loading, Problem, Title, YearSelect } from '../ui'

/** Mis notas: report card of the chosen year (current and previous years), per period and final. */
export function GradesPage() {
  const { me } = useSession()
  const [year, setYear] = useState(me?.year ?? new Date().getFullYear())
  const q = useQuery(`grades-${year}`, () => api.get<{ reportCard: ReportCardData }>(`/portal/grades?year=${year}`))
  const [period, setPeriod] = useState<number | 'final'>('final')
  const rc = q.data?.reportCard
  // open on the last published period of the year
  useEffect(() => {
    if (rc) setPeriod(rc.periods.length ? rc.periods[rc.periods.length - 1].id : 'final')
  }, [rc])
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <Title sub={rc?.course ? `${rc.course} · ${year}` : 'Boletín de calificaciones'}>Notas</Title>
        <div className="flex items-center gap-2">
          {me && <YearSelect years={me.years.length ? me.years : [me.year]} value={year} onChange={setYear} />}
          {rc && rc.areas.length > 0 && (
            <button type="button" onClick={() => print()} aria-label="Imprimir boletín" className="grid size-10 place-items-center rounded-lg border border-line bg-white text-muted print:hidden">
              <Printer size={18} />
            </button>
          )}
        </div>
      </div>
      {q.loading && <Loading />}
      {q.error && <Problem message={q.error.message} onRetry={q.reload} />}
      {rc && !q.loading && <ReportCard data={rc} period={period} onPeriod={setPeriod} />}
    </>
  )
}
