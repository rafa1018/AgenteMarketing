import { CalendarDays } from 'lucide-react'
import { date, monthLabel, todayISO } from '@/shared/format'
import { useQuery } from '@/shared/useQuery'
import { api } from '../session'
import { Loading, Problem, Title } from '../ui'

export interface PublicEvent { title: string; description: string; type: string; color: string | null; start: string; end: string }

/** Public school calendar, grouped by month (private events of the panel never reach the portal). */
export function CalendarPage() {
  const q = useQuery('calendar', () => api.get<{ events: PublicEvent[] }>('/portal/calendar'))
  const today = todayISO()
  const months = new Map<string, PublicEvent[]>()
  for (const e of q.data?.events ?? []) {
    const k = e.start.slice(0, 7)
    months.set(k, [...(months.get(k) ?? []), e])
  }
  return (
    <>
      <Title sub="Fechas importantes del jardín.">Calendario</Title>
      {q.loading && <Loading />}
      {q.error && <Problem message={q.error.message} onRetry={q.reload} />}
      {q.data && !q.data.events.length && (
        <p className="card flex flex-col items-center gap-2 p-8 text-center text-muted">
          <CalendarDays size={28} /> Aún no hay eventos publicados.
        </p>
      )}
      <div className="space-y-5">
        {[...months].map(([m, events]) => (
          <section key={m}>
            <h2 className="mb-2 text-[13px] font-extrabold tracking-[0.12em] text-muted uppercase">{monthLabel(m)}</h2>
            <ul className="space-y-2">
              {events.map((e, i) => {
                const past = e.end < today
                return (
                  <li key={i} className={`card flex gap-3 p-4 ${past ? 'opacity-60' : ''}`} style={{ borderLeft: `4px solid ${e.color ?? '#5b54c9'}` }}>
                    <span className="w-16 shrink-0 font-serif text-[15px] leading-tight font-semibold text-royal">
                      {date(e.start, false)}
                      {e.end !== e.start && <span className="block text-[12px] text-muted">al {date(e.end, false)}</span>}
                    </span>
                    <span>
                      <span className="block font-semibold text-ink">{e.title}</span>
                      {e.description && <span className="block text-sm text-muted">{e.description}</span>}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  )
}
