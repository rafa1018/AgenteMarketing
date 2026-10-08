import { cn } from '@/lib/utils'

/** Report card data as the API returns it (panel and family portal share this view). */
export interface ReportCardData {
  year: number
  course: string | null
  periods: { id: number; number: number; name: string; published: boolean }[]
  areas: {
    name: string
    position: number
    subjects: {
      name: string
      final: string | null
      absences: number
      periods: Record<string, { level: string | null; score: number | null; absences: number | null; comments: string | null; achievements: { description: string; level: string | null }[] }>
    }[]
  }[]
}

const LEVEL_TONE: Record<string, string> = {
  Excelente: 'bg-[#e9f4ee] text-leaf',
  Bueno: 'bg-[#eaf3fa] text-[#185a8a]',
  Aceptable: 'bg-butter text-[#8a5716]',
  Insuficiente: 'bg-[#fdf0ef] text-berry',
}
export const LevelChip = ({ level }: { level: string | null }) =>
  level ? <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-[12px] font-bold', LEVEL_TONE[level] ?? 'bg-paper text-muted')}>{level}</span> : <span className="text-muted">—</span>

/**
 * Boletín: per dimension → subject, the level of each period and the final, and (for the chosen period)
 * the achievements the child reached.
 */
export function ReportCard({ data, period, onPeriod }: { data: ReportCardData; period: number | 'final'; onPeriod: (p: number | 'final') => void }) {
  if (!data.areas.length) return <p className="rounded-2xl bg-white p-6 text-center text-muted">Aún no hay calificaciones {data.periods.length ? 'publicadas ' : ''}para {data.year}.</p>
  return (
    <div className="space-y-4">
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
        {data.periods.map((p) => (
          <button key={p.id} type="button" onClick={() => onPeriod(p.id)} className={cn('shrink-0 rounded-full px-4 py-2 text-[14px] font-semibold', period === p.id ? 'bg-ink text-white' : 'bg-white text-muted ring-1 ring-line')}>
            {p.name}
          </button>
        ))}
        <button type="button" onClick={() => onPeriod('final')} className={cn('shrink-0 rounded-full px-4 py-2 text-[14px] font-semibold', period === 'final' ? 'bg-pink text-white' : 'bg-white text-muted ring-1 ring-line')}>
          Final del año
        </button>
      </div>
      {data.areas.map((a) => (
        <section key={a.name} className="card overflow-hidden p-0">
          <h3 className="bg-paper px-4 py-2.5 text-[13px] font-extrabold tracking-[0.12em] text-ink uppercase">{a.name}</h3>
          <ul className="divide-y divide-line">
            {a.subjects.map((s) => {
              const p = period === 'final' ? null : s.periods[String(period)]
              return (
                <li key={s.name} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-ink">{s.name}</p>
                    <div className="flex items-center gap-2">
                      {period === 'final' ? (
                        <>
                          {data.periods.map((pp) => (
                            <span key={pp.id} title={pp.name} className="hidden sm:inline">
                              <LevelChip level={s.periods[String(pp.id)]?.level ?? null} />
                            </span>
                          ))}
                          <span className="text-[12px] font-bold text-muted">Final</span>
                          <LevelChip level={s.final} />
                        </>
                      ) : (
                        <>
                          {p?.score !== null && p?.score !== undefined && <span className="font-semibold tabular-nums">{p.score.toFixed(1)}</span>}
                          <LevelChip level={p?.level ?? null} />
                        </>
                      )}
                    </div>
                  </div>
                  {p && p.achievements.length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {p.achievements.map((x, i) => (
                        <li key={i} className="flex gap-2 text-[14px] leading-snug text-text">
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-pink" />
                          <span>{x.description}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {p?.comments && <p className="mt-2 rounded-lg bg-paper px-3 py-2 text-[14px] text-text">{p.comments}</p>}
                  {(period === 'final' ? s.absences : p?.absences) ? <p className="mt-1 text-[12px] text-muted">Fallas: {period === 'final' ? s.absences : p?.absences}</p> : null}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
