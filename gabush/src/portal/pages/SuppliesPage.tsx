import { Backpack, Check, Printer } from 'lucide-react'
import { useState } from 'react'
import { useQuery } from '@/shared/useQuery'
import { api } from '../session'
import { Loading, Problem, Title } from '../ui'

type Item = { name: string; qty: string; note: string }
interface Supplies { years: { year: number; course: string | null; grade: string | null; lists: { id: number; gradeLevelId: number | null; grade: string | null; notes: string | null; items: Item[] }[] }[] }

/**
 * Lista de útiles of the child's year and grade (also next year's when already enrolled for it). The family can
 * tick what they already bought (saved on this phone only) and print it.
 */
export function SuppliesPage() {
  const q = useQuery('supplies', () => api.get<Supplies>('/portal/supplies'))
  const [have, setHave] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('gb-supplies-have') ?? '{}')
    } catch {
      return {}
    }
  })
  const toggle = (k: string) => {
    const next = { ...have, [k]: !have[k] }
    setHave(next)
    try {
      localStorage.setItem('gb-supplies-have', JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }
  const years = q.data?.years ?? []
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <Title sub="Lo que tu hijo o hija necesita para el año. Marca lo que ya compraste.">Útiles escolares</Title>
        {years.length > 0 && (
          <button type="button" onClick={() => window.print()} className="btn btn-ghost !min-h-10 shrink-0 !px-3 !text-sm print:hidden">
            <Printer size={16} /> Imprimir
          </button>
        )}
      </div>
      {q.loading && <Loading />}
      {q.error && <Problem message={q.error.message} onRetry={q.reload} />}
      {q.data && !years.length && (
        <div className="card p-6 text-center">
          <Backpack className="mx-auto text-pink" size={32} />
          <p className="mt-2 font-semibold text-ink">Aún no hay lista de útiles publicada.</p>
          <p className="text-sm text-muted">Cuando el jardín la publique, aparecerá aquí.</p>
        </div>
      )}
      <div className="space-y-5">
        {years.map((y) => {
          const items = y.lists.flatMap((l) => l.items.map((it, i) => ({ ...it, key: `${y.year}:${l.id}:${i}` })))
          const done = items.filter((it) => have[it.key]).length
          return (
            <section key={y.year} className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-serif text-[1.3rem] font-semibold text-ink">
                  {y.year} · {y.course ?? y.grade ?? ''}
                </h2>
                <span className="text-sm font-semibold text-muted">
                  {done} de {items.length} listos
                </span>
              </div>
              {y.lists.map((l) => (
                <div key={l.id} className="card overflow-hidden p-0">
                  {y.lists.length > 1 && <p className="bg-paper px-4 py-2 text-[12px] font-extrabold tracking-[0.12em] text-ink uppercase">{l.gradeLevelId ? `Para ${l.grade}` : 'Para todos'}</p>}
                  {l.notes && <p className="border-b border-line bg-[#fff8e6] px-4 py-3 text-[14px] whitespace-pre-line text-[#8a5716]">{l.notes}</p>}
                  <ul className="divide-y divide-line">
                    {l.items.map((it, i) => {
                      const k = `${y.year}:${l.id}:${i}`
                      const on = Boolean(have[k])
                      return (
                        <li key={k}>
                          <button type="button" onClick={() => toggle(k)} aria-pressed={on} className="flex w-full items-start gap-3 px-4 py-3 text-left">
                            <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg border-2 ${on ? 'border-leaf bg-leaf text-white' : 'border-line'}`}>{on && <Check size={15} strokeWidth={3} />}</span>
                            <span className="min-w-0 flex-1">
                              <span className={`block font-semibold ${on ? 'text-muted line-through' : 'text-ink'}`}>{it.name}</span>
                              {it.note && <span className="block text-[13px] text-muted">{it.note}</span>}
                            </span>
                            {it.qty && <span className="shrink-0 rounded-full bg-paper px-2.5 py-0.5 text-[13px] font-bold text-ink">{it.qty}</span>}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </section>
          )
        })}
      </div>
    </>
  )
}
