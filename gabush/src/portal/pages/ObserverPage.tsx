import { Lightbulb, NotebookPen, TrendingUp } from 'lucide-react'
import { date } from '@/shared/format'
import { useQuery } from '@/shared/useQuery'
import { api } from '../session'
import { Chip, Loading, Problem, Title } from '../ui'

interface Observation { id: number; date: string; category: string; body: string; actions: string | null; recommendations: string | null; year: number | null; period: string | null; createdBy: string | null }

/** Observador: only the notes the school chose to share with the family, with the actions and recommendations. */
export function ObserverPage() {
  const q = useQuery('observations', () => api.get<{ observations: Observation[] }>('/portal/observations'))
  return (
    <>
      <Title sub="Notas que el jardín comparte sobre el proceso de tu hijo o hija.">Observaciones</Title>
      {q.loading && <Loading />}
      {q.error && <Problem message={q.error.message} onRetry={q.reload} />}
      {q.data && !q.data.observations.length && (
        <p className="card flex flex-col items-center gap-2 p-8 text-center text-muted">
          <NotebookPen size={28} /> No hay observaciones compartidas.
        </p>
      )}
      <ul className="space-y-2">
        {q.data?.observations.map((o) => (
          <li key={o.id} className="card p-4">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <span className="flex flex-wrap gap-1.5">
                <Chip tone={o.category === 'logro' ? 'green' : o.category === 'salud' ? 'blue' : 'violet'}>{o.category}</Chip>
                {o.period && <Chip tone="blue">{o.period}{o.year ? ` · ${o.year}` : ''}</Chip>}
              </span>
              <span className="text-[12px] text-muted">{date(o.date)}</span>
            </div>
            <p className="text-[15px] leading-relaxed whitespace-pre-line text-text">{o.body}</p>
            {o.actions && (
              <div className="mt-3 rounded-xl bg-[#eaf3fa] px-3 py-2.5 text-[14px] text-[#185a8a]">
                <p className="flex items-center gap-1.5 text-[12px] font-bold tracking-wide uppercase">
                  <TrendingUp size={14} /> Lo que haremos en el jardín
                </p>
                <p className="mt-1 whitespace-pre-line">{o.actions}</p>
              </div>
            )}
            {o.recommendations && (
              <div className="mt-2 rounded-xl bg-[#fff8e6] px-3 py-2.5 text-[14px] text-[#8a5716]">
                <p className="flex items-center gap-1.5 text-[12px] font-bold tracking-wide uppercase">
                  <Lightbulb size={14} /> Recomendaciones para casa
                </p>
                <p className="mt-1 whitespace-pre-line">{o.recommendations}</p>
              </div>
            )}
            {o.createdBy && <p className="mt-1.5 text-[12px] text-muted">— {o.createdBy}</p>}
          </li>
        ))}
      </ul>
    </>
  )
}
