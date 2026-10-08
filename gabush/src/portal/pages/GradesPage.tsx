import { FileDown } from 'lucide-react'
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
        {me && <YearSelect years={me.years.length ? me.years : [me.year]} value={year} onChange={setYear} />}
      </div>
      {me && rc && rc.areas.length > 0 && (
        // the designed report card (PDF): to see it whole, download, print or share it from the phone
        <a href={`/api/v2/students/${me.student.id}/boletin?year=${year}&period=${period}`} target="_blank" rel="noopener" className="card mb-4 flex items-center gap-3 border-l-4 border-l-[#e5197e] p-4">
          <FileDown className="shrink-0 text-pink" />
          <span className="flex-1">
            <span className="block font-semibold text-ink">Ver y descargar el boletín</span>
            <span className="block text-sm text-muted">{period === 'final' ? 'Informe final del año' : (rc.periods.find((p) => p.id === period)?.name ?? '')} en PDF, listo para guardar, imprimir o compartir.</span>
          </span>
        </a>
      )}
      {q.loading && <Loading />}
      {q.error && <Problem message={q.error.message} onRetry={q.reload} />}
      {rc && !q.loading && <ReportCard data={rc} period={period} onPeriod={setPeriod} />}
    </>
  )
}
