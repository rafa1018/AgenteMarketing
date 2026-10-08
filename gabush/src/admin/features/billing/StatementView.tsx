import { Ban, ChevronDown, FilePlus2, HandCoins, Percent, Printer, Receipt, ShieldOff, Trash2, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useQuery } from '@/shared/useQuery'
import { date, money } from '@/shared/format'
import { toast } from '../../store'
import { api2, qs, useSetup } from '../../v2/api'
import { Badge, ErrorBox, Spinner, Stat, StatusBadge } from '../../v2/kit'
import { AdjustModal, ChargeFormModal, PaymentModal, VoidModal } from './BillingModals'
import { methodLabel, type Charge, type Statement } from './types'

/** Account of one student: what was charged, adjustments, what was paid, receipts. */
export function StatementView({ studentId }: { studentId: number }) {
  const { year } = useSetup()
  const [scope, setScope] = useState<'year' | 'all'>('year')
  const { data, error, loading, reload } = useQuery(`statement:${studentId}:${scope}:${year}`, () => api2.get<Statement>(`/billing/students/${studentId}` + qs({ year: scope === 'year' ? year : null })))
  const [paying, setPaying] = useState<number[] | null>(null)
  const [charging, setCharging] = useState(false)
  const [adjusting, setAdjusting] = useState<Charge | null>(null)
  const [voiding, setVoiding] = useState<{ kind: 'charge' | 'payment'; id: number; label: string } | null>(null)
  const [open, setOpen] = useState<number | null>(null)

  if (error) return <ErrorBox message={error.message} onRetry={reload} />
  if (loading && !data) return <Spinner />
  if (!data) return null
  const s = data.total
  const charges = [...data.charges].reverse()
  const pending = data.charges.filter((c) => c.status === 'abierto')

  const waive = async (c: Charge, waiveIt: boolean) => {
    try {
      await api2.post(`/billing/charges/${c.id}/late-fee`, { waive: waiveIt })
      toast(waiveIt ? 'Mora perdonada' : 'Mora restaurada')
      reload()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo')
    }
  }
  const removeAdj = async (id: number) => {
    try {
      await api2.del(`/billing/adjustments/${id}`)
      toast('Ajuste quitado')
      reload()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo')
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Saldo pendiente" value={money(s.balance)} tone={s.balance > 0 ? 'red' : 'green'} />
        <Stat label="Vencido" value={money(s.overdue)} tone={s.overdue > 0 ? 'red' : 'ink'} />
        <Stat label="Mora acumulada" value={money(s.lateFees)} tone={s.lateFees > 0 ? 'pink' : 'ink'} />
        <Stat label="Saldo a favor" value={money(s.credit)} tone={s.credit > 0 ? 'green' : 'ink'} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setPaying(pending.map((c) => c.id))} className="btn btn-primary !text-sm">
          <HandCoins size={18} /> Registrar pago
        </button>
        <button type="button" onClick={() => setCharging(true)} className="btn btn-ghost !text-sm">
          <FilePlus2 size={18} /> Nuevo cobro
        </button>
        {s.credit > 0 && pending.length > 0 && (
          <button type="button" onClick={async () => { const r = await api2.post<{ applied: number }>(`/billing/students/${studentId}/apply-credit`).catch(() => null); if (r) { toast(`Se aplicaron ${money(r.applied)} del saldo a favor`); reload() } }} className="btn btn-ghost !text-sm">
            Aplicar saldo a favor
          </button>
        )}
        <label className="ml-auto flex items-center gap-2 text-sm font-semibold text-muted">
          <select value={scope} onChange={(e) => setScope(e.target.value as 'year' | 'all')} className="rounded-lg border border-line bg-white px-2 py-1.5">
            <option value="year">Año {year}</option>
            <option value="all">Todos los años</option>
          </select>
        </label>
      </div>

      <section className="card overflow-hidden p-0">
        <h3 className="border-b border-line px-4 py-3 text-lg">Cobros</h3>
        {!charges.length ? (
          <p className="px-4 py-6 text-sm text-muted">Sin cobros en este periodo.</p>
        ) : (
          <ul className="divide-y divide-line">
            {charges.map((c) => {
              const mora = c.adjustments.find((a) => a.kind === 'mora')
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => setOpen(open === c.id ? null : c.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-paper/60">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">{c.description}</span>
                      <span className="block text-[13px] text-muted">
                        {c.dueOn ? `Vence ${date(c.dueOn)}` : date(c.createdAt)}
                        {c.lateFees > 0 && <span className="font-semibold text-pink"> · mora {money(c.lateFees)}</span>}
                        {c.discounts > 0 && <span className="text-leaf"> · desc. {money(c.discounts)}</span>}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block font-semibold text-ink tabular-nums">{money(c.net)}</span>
                      {c.status === 'abierto' && c.paid > 0 && <span className="block text-[12px] text-muted">debe {money(c.balance)}</span>}
                    </span>
                    {c.overdue ? <Badge tone="red">Vencido</Badge> : <StatusBadge status={c.status} />}
                    <ChevronDown size={18} className={cn('shrink-0 text-muted transition-transform', open === c.id && 'rotate-180')} />
                  </button>
                  {open === c.id && (
                    <div className="space-y-3 bg-paper/60 px-4 pt-1 pb-4 text-[14px]">
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                        <div><dt className="text-muted">Valor</dt><dd className="font-semibold">{money(c.amount)}</dd></div>
                        <div><dt className="text-muted">Descuentos</dt><dd className="font-semibold text-leaf">− {money(c.discounts)}</dd></div>
                        <div><dt className="text-muted">Recargos + mora</dt><dd className="font-semibold text-pink">+ {money(c.surcharges + c.lateFees)}</dd></div>
                        <div><dt className="text-muted">Pagado</dt><dd className="font-semibold">{money(c.paid)}</dd></div>
                      </dl>
                      {c.adjustments.length > 0 && (
                        <ul className="space-y-1">
                          {c.adjustments.map((a) => (
                            <li key={a.id} className="flex items-center gap-2">
                              <Badge tone={a.kind === 'descuento' || a.kind === 'traslado' ? 'green' : 'red'}>{a.kind === 'traslado' ? 'Traslado' : a.kind[0].toUpperCase() + a.kind.slice(1)}</Badge>
                              <span className={cn('flex-1', a.waived && 'text-muted line-through')}>
                                {a.reason || '—'} · {money(a.amount)}
                                {a.waived && ' (perdonada)'}
                              </span>
                              {a.kind !== 'mora' && a.kind !== 'traslado' && c.status !== 'anulado' && (
                                <button type="button" title="Quitar" onClick={() => removeAdj(a.id)} className="text-muted hover:text-berry">
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                      {c.status !== 'anulado' && (
                        <div className="flex flex-wrap gap-2">
                          {c.status === 'abierto' && (
                            <button type="button" onClick={() => setPaying([c.id])} className="btn btn-primary !min-h-9 !px-3 !text-[13px]">
                              <HandCoins size={15} /> Pagar este cobro
                            </button>
                          )}
                          <button type="button" onClick={() => setAdjusting(c)} className="btn btn-ghost !min-h-9 !px-3 !text-[13px]">
                            <Percent size={15} /> Descuento / recargo
                          </button>
                          {c.lateFeeApplies && c.status === 'abierto' && (mora && mora.waived ? (
                            <button type="button" onClick={() => waive(c, false)} className="btn btn-ghost !min-h-9 !px-3 !text-[13px]">
                              <Undo2 size={15} /> Volver a cobrar mora
                            </button>
                          ) : (
                            <button type="button" onClick={() => waive(c, true)} className="btn btn-ghost !min-h-9 !px-3 !text-[13px]">
                              <ShieldOff size={15} /> Perdonar mora
                            </button>
                          ))}
                          {c.paid === 0 && (
                            <button type="button" onClick={() => setVoiding({ kind: 'charge', id: c.id, label: c.description })} className="btn btn-ghost !min-h-9 !px-3 !text-[13px] text-berry">
                              <Ban size={15} /> Anular
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="card overflow-hidden p-0">
        <h3 className="border-b border-line px-4 py-3 text-lg">Pagos</h3>
        {!data.payments.length ? (
          <p className="px-4 py-6 text-sm text-muted">Sin pagos en este periodo.</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e9f4ee] text-leaf">
                  <Receipt size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">
                    {money(p.amount)} · {methodLabel(p.method)}
                    {p.source === 'en_linea' && <Badge tone="violet" className="ml-2">En línea</Badge>}
                  </span>
                  <span className="block text-[13px] text-muted">
                    {date(p.paidOn)} · Comprobante {p.receipt} · {p.charges.map((c) => c.description).join(', ') || 'Saldo a favor'}
                  </span>
                </span>
                {p.status !== 'aprobado' && <StatusBadge status={p.status} />}
                <a href={`/api/v2/billing/payments/${p.id}/receipt`} target="_blank" rel="noopener noreferrer" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-paper hover:text-ink" title="Comprobante">
                  <Printer size={17} />
                </a>
                {p.status === 'aprobado' && p.source !== 'en_linea' && (
                  <button type="button" onClick={() => setVoiding({ kind: 'payment', id: p.id, label: `pago de ${money(p.amount)}` })} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-[#fdf0ef] hover:text-berry" title="Anular">
                    <Ban size={17} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <PaymentModal studentId={studentId} preselect={paying} charges={pending} onClose={() => setPaying(null)} onDone={reload} />
      <ChargeFormModal studentId={studentId} open={charging} onClose={() => setCharging(false)} onDone={reload} />
      <AdjustModal charge={adjusting} onClose={() => setAdjusting(null)} onDone={reload} />
      <VoidModal target={voiding} onClose={() => setVoiding(null)} onDone={reload} />
    </div>
  )
}
