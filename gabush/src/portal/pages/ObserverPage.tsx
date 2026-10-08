import { NotebookPen } from 'lucide-react'
import { date } from '@/shared/format'
import { useQuery } from '@/shared/useQuery'
import { api } from '../session'
import { Chip, Loading, Problem, Title } from '../ui'

interface Observation { id: number; date: string; category: string; body: string; createdBy: string | null }

/** Observador: only the notes the school chose to share with the family. */
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
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <Chip tone={o.category === 'logro' ? 'green' : o.category === 'salud' ? 'blue' : 'violet'}>{o.category}</Chip>
              <span className="text-[12px] text-muted">{date(o.date)}</span>
            </div>
            <p className="text-[15px] leading-relaxed whitespace-pre-line text-text">{o.body}</p>
            {o.createdBy && <p className="mt-1.5 text-[12px] text-muted">— {o.createdBy}</p>}
          </li>
        ))}
      </ul>
    </>
  )
}
