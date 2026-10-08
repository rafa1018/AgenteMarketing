import { FileDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useQuery } from '@/shared/useQuery'
import { ReportCard, type ReportCardData } from '@/shared/ReportCard'
import { api2, qs, useSetup } from '../../v2/api'
import { ErrorBox, Spinner } from '../../v2/kit'

/** Report card of a student in the panel (any year the student was enrolled). */
export function ReportCardView({ studentId, years }: { studentId: number; years: number[] }) {
  const { year: working } = useSetup()
  const [year, setYear] = useState<number>(() => (working && years.includes(working) ? working : years[0]))
  const [period, setPeriod] = useState<number | 'final'>('final')
  const { data, error, loading, reload } = useQuery(`rc:${studentId}:${year}`, () => api2.get<{ reportCard: ReportCardData }>(`/students/${studentId}/report-card` + qs({ year })))
  useEffect(() => {
    const ps = data?.reportCard.periods ?? []
    if (ps.length) setPeriod(ps[ps.length - 1].id)
  }, [data])
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="rounded-lg border border-line bg-white px-3 py-2 font-semibold" aria-label="Año">
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        {data?.reportCard.course && <span className="text-sm text-muted">{data.reportCard.course}</span>}
        {/* the designed report card: download PDF, print, share or send by WhatsApp to the guardian */}
        <a href={`/api/v2/students/${studentId}/boletin?year=${year}&period=${period}`} target="_blank" rel="noopener" className="btn btn-primary ml-auto !min-h-10 !text-sm">
          <FileDown size={16} /> Boletín PDF
        </a>
      </div>
      {error ? <ErrorBox message={error.message} onRetry={reload} /> : loading && !data ? <Spinner /> : data && <ReportCard data={data.reportCard} period={period} onPeriod={setPeriod} />}
    </div>
  )
}
