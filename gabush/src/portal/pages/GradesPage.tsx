import { FileDown, Lock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ReportCard, type ReportCardData } from '@/shared/ReportCard'
import { useQuery } from '@/shared/useQuery'
import { money } from '@/shared/format'
import { api, useSession } from '../session'
import { Loading, Problem, Title, YearSelect } from '../ui'

/** Mis notas: report card of the chosen year (current and previous years), per period and final. */
export function GradesPage() {
  const { me } = useSession()
  const [year, setYear] = useState(me?.year ?? new Date().getFullYear())
  const q = useQuery(`grades-${year}`, () => api.get<{ reportCard: ReportCardData | null; locked?: { overdue: number } | null }>(`/portal/grades?year=${year}`))
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
      {q.data?.locked && !q.loading && <LockedGrades overdue={q.data.locked.overdue} />}
      {rc && !q.loading && <ReportCard data={rc} period={period} onPeriod={setPeriod} />}
    </>
  )
}

/**
 * Overdue payments and the school holds the grades: a blurred, watermarked report card (no real data reaches
 * the phone) with the amount owed and the way to pay.
 */
function LockedGrades({ overdue }: { overdue: number }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white p-5 ring-1 ring-line">
      <div aria-hidden className="space-y-5 blur-[2px] select-none">
        {['Dimensión cognitiva', 'Dimensión comunicativa', 'Dimensión corporal'].map((d) => (
          <div key={d} className="space-y-2.5">
            <p className="text-[12px] font-bold tracking-wider text-muted uppercase">{d}</p>
            {[0, 1].map((i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between gap-3">
                  <span className="h-3.5 w-1/2 rounded bg-[#e4e8f3]" />
                  <span className="h-3.5 w-16 rounded-full bg-[#e6f6dd]" />
                </div>
                <span className="block h-2.5 w-11/12 rounded bg-[#eef1f8]" />
                <span className="block h-2.5 w-3/4 rounded bg-[#eef1f8]" />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
        <span className="-rotate-[28deg] text-[clamp(30px,9vw,52px)] font-extrabold tracking-wide whitespace-nowrap text-[#e5197e]/15">PAGO PENDIENTE</span>
      </div>
      <div className="absolute inset-x-4 top-1/2 mx-auto max-w-sm -translate-y-1/2 rounded-2xl bg-white p-5 text-center shadow-[0_10px_40px_rgba(35,32,107,.18)]">
        <span className="mx-auto grid size-11 place-items-center rounded-full bg-[#fdf0ef] text-berry">
          <Lock size={20} />
        </span>
        <p className="mt-2 font-serif text-lg font-semibold text-ink">Notas y boletín bloqueados</p>
        <p className="mt-1 text-[14px] text-muted">
          Hay pagos vencidos por <b className="text-ink">{money(overdue)}</b>. Al ponerse al día, las notas y el boletín quedan disponibles de inmediato.
        </p>
        <a href="#/pagos" className="btn btn-primary mt-3 !min-h-10 !text-sm">
          Ver mis pagos
        </a>
      </div>
    </div>
  )
}
