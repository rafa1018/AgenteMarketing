import { Ban, CalendarClock, ChevronDown, FilePlus2, HandCoins, Lock, Pencil, Percent, Printer, Receipt, ShieldCheck, ShieldOff, Trash2, Undo2, Unlock } from 'lucide-react'
import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'
import { useMutation, useQuery } from '@/shared/useQuery'
import { date, discountReason, money, parseMoney } from '@/shared/format'
import { toast } from '../../store'
import { api2, qs, useSetup } from '../../v2/api'
import { Badge, ErrorBox, Field, Spinner, Stat, StatusBadge, inputCls } from '../../v2/kit'
import { AdjustModal, ChargeFormModal, PaymentModal, VoidModal } from './BillingModals'
import { methodLabel, type Charge, type GradesLock, type Statement } from './types'

/** New due date of a pending charge. */
function DueDateModal({ charge, onClose, onDone }: { charge: Charge | null; onClose: () => void; onDone: () => void }) {
  const [due, setDue] = useState('')
  const [last, setLast] = useState<Charge | null>(null)
  const m = useMutation()
  if (charge !== last) {
    setLast(charge)
    setDue(charge?.dueOn ?? '')
  }
  return (
    <Modal open={Boolean(charge)} onClose={onClose} label="Cambiar vencimiento" closeLabel="Cerrar" className="sm:!max-w-md">
      {charge && (
        <div className="space-y-4 p-6">
          <h2 className="text-[1.4rem]">Cambiar vencimiento</h2>
          <p className="text-[14px] text-muted">
            {charge.description} · hoy vence el {date(charge.dueOn)}. Antes de la nueva fecha no aparece como vencido.
          </p>
          <Field label="Nueva fecha de vencimiento">
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputCls()} />
          </Field>
          {m.message && <ErrorBox message={m.message} />}
          <button
            type="button"
            disabled={m.busy || !due || due === charge.dueOn}
            onClick={async () => {
              if (await m.run(() => api2.post(`/billing/charges/${charge.id}/due`, { dueOn: due }))) {
                toast(`Ahora vence el ${date(due)}`)
                onClose()
                onDone()
              }
            }}
            className="btn btn-primary w-full disabled:opacity-50"
          >
            Guardar fecha
          </button>
        </div>
      )}
    </Modal>
  )
}

/** New value of a pending charge (the agreed price instead of the price list). */
function AmountModal({ charge, onClose, onDone }: { charge: Charge | null; onClose: () => void; onDone: () => void }) {
  const [value, setValue] = useState('')
  const [reason, setReason] = useState('')
  const [last, setLast] = useState<Charge | null>(null)
  const m = useMutation()
  if (charge !== last) {
    setLast(charge)
    setValue(charge ? String(charge.amount) : '')
    setReason('')
  }
  const amount = parseMoney(value)
  return (
    <Modal open={Boolean(charge)} onClose={onClose} label="Cambiar valor" closeLabel="Cerrar" className="sm:!max-w-md">
      {charge && (
        <div className="space-y-4 p-6">
          <h2 className="text-[1.4rem]">Cambiar valor</h2>
          <p className="text-[14px] text-muted">
            {charge.description} · hoy vale {money(charge.amount)}. Los descuentos y recargos que tenga se conservan.
          </p>
          <Field label="Nuevo valor">
            <input value={value ? Number(amount).toLocaleString('es-CO') : ''} onChange={(e) => setValue(e.target.value)} inputMode="numeric" autoFocus className={inputCls()} />
          </Field>
          <Field label="Motivo">
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Valor acordado con la rectora, hermanos…" className={inputCls()} />
          </Field>
          {m.message && <ErrorBox message={m.message} />}
          <button
            type="button"
            disabled={m.busy || amount <= 0 || amount === charge.amount}
            onClick={async () => {
              if (await m.run(() => api2.post(`/billing/charges/${charge.id}/amount`, { amount, reason: reason.trim() || null }))) {
                toast(`${charge.description}: ahora vale ${money(amount)}`)
                onClose()
                onDone()
              }
            }}
            className="btn btn-primary w-full disabled:opacity-50"
          >
            Guardar valor
          </button>
          <p className="text-center text-[12px] text-muted">Si no se debe cobrar, usa «Anular».</p>
        </div>
      )}
    </Modal>
  )
}

/** Account of one student: what was charged, adjustments, what was paid, receipts. */
/**
 * Notes held in the family app for overdue payments: shows it, and lets the staff make an exception while there
 * is a payment agreement (visible until a date; afterwards, if still owing, it locks again by itself).
 */
function GradesLockCard({ studentId, lock, onChanged }: { studentId: number; lock: GradesLock; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const inMonth = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)
  const [until, setUntil] = useState(lock.until ?? inMonth)
  const [reason, setReason] = useState(lock.reason ?? 'Acuerdo de pago')
  const m = useMutation()
  const save = async (u: string | null) => {
    if (await m.run(() => api2.put(`/billing/students/${studentId}/grades-unlock`, { until: u, reason: reason.trim() || null }))) {
      toast(u ? `Podrá ver notas y boletín hasta el ${date(u)}` : lock.overdue > 0 ? 'Excepción quitada: notas bloqueadas de nuevo' : 'Excepción quitada')
      setEditing(false)
      onChanged()
    }
  }
  return (
    <div className={cn('space-y-3 rounded-xl px-4 py-3 text-[14px]', lock.until ? 'bg-[#e9f4ee] text-[#2f6b45]' : 'bg-[#fdf0ef] text-berry')}>
      <div className="flex flex-wrap items-center gap-2">
        {lock.until ? <Unlock size={18} className="shrink-0" /> : <Lock size={18} className="shrink-0" />}
        <span className="min-w-0 flex-1">
          {lock.until ? (
            <>
              <b>Notas visibles por acuerdo de pago</b> hasta el {date(lock.until)}
              {lock.reason ? ` · ${lock.reason}` : ''}
              {lock.by ? <span className="block text-[12px] opacity-80">Lo autorizó {lock.by}. Pasada esa fecha, si sigue debiendo, se bloquean solas.</span> : null}
            </>
          ) : (
            <>
              <b>Notas y boletín bloqueados en el app</b> por {money(lock.overdue)} vencidos.
            </>
          )}
        </span>
        {!editing && (
          <span className="flex gap-2">
            <button type="button" onClick={() => setEditing(true)} className="btn btn-ghost !min-h-9 !bg-white !px-3 !text-[13px]">
              {lock.until ? 'Cambiar' : 'Acuerdo de pago'}
            </button>
            {lock.until && (
              <button type="button" disabled={m.busy} onClick={() => save(null)} className="btn btn-ghost !min-h-9 !bg-white !px-3 !text-[13px]">
                Quitar
              </button>
            )}
          </span>
        )}
      </div>
      {editing && (
        <div className="flex flex-wrap items-end gap-2 text-ink">
          <Field label="Ver notas hasta">
            <input type="date" value={until} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setUntil(e.target.value)} className={inputCls()} />
          </Field>
          <Field label="Motivo">
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Acuerdo de pago, abono…" className={inputCls() + ' min-w-0'} />
          </Field>
          <button type="button" disabled={m.busy || !until} onClick={() => save(until)} className="btn btn-primary !min-h-[46px] !text-sm">
            Guardar
          </button>
          <button type="button" onClick={() => setEditing(false)} className="btn btn-ghost !min-h-[46px] !bg-white !text-sm">
            Cancelar
          </button>
        </div>
      )}
      {m.message && <ErrorBox message={m.message} />}
    </div>
  )
}

export function StatementView({ studentId }: { studentId: number }) {
  const { year } = useSetup()
  const [scope, setScope] = useState<'year' | 'all'>('year')
  const { data, error, loading, reload } = useQuery(`statement:${studentId}:${scope}:${year}`, () => api2.get<Statement>(`/billing/students/${studentId}` + qs({ year: scope === 'year' ? year : null })))
  const [paying, setPaying] = useState<number[] | null>(null)
  const [charging, setCharging] = useState(false)
  const [adjusting, setAdjusting] = useState<Charge | null>(null)
  const [voiding, setVoiding] = useState<{ kind: 'charge' | 'payment'; id: number; label: string } | null>(null)
  const [redating, setRedating] = useState<Charge | null>(null)
  const [repricing, setRepricing] = useState<Charge | null>(null)
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
      {scope === 'year' && s.balance !== data.summary.balance && (
        // the totals cover every year; the list below only the chosen one
        <p className="flex flex-wrap items-center gap-2 rounded-xl bg-butter px-4 py-3 text-[14px] text-[#8a5716]">
          <span className="flex-1">
            Debe {money(s.balance - data.summary.balance)} de otros años (no aparecen abajo porque estás viendo {year}).
          </span>
          <button type="button" onClick={() => setScope('all')} className="font-semibold underline">
            Ver todos los años
          </button>
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Saldo pendiente hoy" value={money(s.balance)} tone={s.balance > 0 ? 'red' : 'green'} />
        <Stat label="Vencido" value={money(s.overdue)} tone={s.overdue > 0 ? 'red' : 'ink'} />
        <Stat label="Mora acumulada" value={money(s.lateFees)} tone={s.lateFees > 0 ? 'pink' : 'ink'} />
        <Stat label="Saldo a favor" value={money(s.credit)} tone={s.credit > 0 ? 'green' : 'ink'} />
      </div>
      {!!s.byYear?.length && s.balance > 0 && (
        // which year each part of today's balance belongs to
        <p className="flex flex-wrap items-center gap-1.5 text-[14px] text-muted">
          <span className="font-semibold text-ink">Lo que debe hoy, por año:</span>
          {s.byYear.map((y) => (
            <span key={y.year ?? 'x'} className={`rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${y.year === year ? 'bg-[#fde7f1] text-pink' : 'bg-butter text-[#8a5716]'}`}>
              {y.year ?? 'Sin año'}: {money(y.balance)}
              {y.overdue > 0 && y.overdue < y.balance ? ` (vencido ${money(y.overdue)})` : ''}
            </span>
          ))}
        </p>
      )}
      {data.gradesLock?.enabled && (data.gradesLock.overdue > 0 || data.gradesLock.until) && <GradesLockCard studentId={studentId} lock={data.gradesLock} onChanged={reload} />}
      {(s.upcoming ?? 0) > 0 && (
        <p className="rounded-xl bg-[#eaf3fa] px-4 py-3 text-[14px] text-[#185a8a]">
          <b>Próximo año:</b> {money(s.upcoming!)} por cobros del año siguiente que aún no vencen (por ejemplo, la matrícula). No cuentan como deuda hoy ni impiden el paz y salvo; la familia los puede pagar por adelantado.
        </p>
      )}
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
        <a href={`/api/v2/billing/students/${studentId}/paz-y-salvo`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost !text-sm" title={s.balance > 0 ? 'Tiene saldo pendiente: sale sin firma' : 'Al día: sale firmado'}>
          <ShieldCheck size={18} /> Paz y salvo{s.balance > 0 ? ' (sin firma)' : ''}
        </a>
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
                                {a.validUntil && c.status === 'abierto' && <span className="ml-1 text-[12px] font-semibold text-[#8a5716]">· vale si paga hasta el {date(a.validUntil)}</span>}
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
                          {c.status === 'abierto' && (
                            <button type="button" onClick={() => setRepricing(c)} className="btn btn-ghost !min-h-9 !px-3 !text-[13px]">
                              <Pencil size={15} /> Cambiar valor
                            </button>
                          )}
                          {c.status === 'abierto' && (
                            <button type="button" onClick={() => setRedating(c)} className="btn btn-ghost !min-h-9 !px-3 !text-[13px]">
                              <CalendarClock size={15} /> Cambiar vencimiento
                            </button>
                          )}
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
      <AdjustModal charge={adjusting} onClose={() => setAdjusting(null)} onDone={reload} defaultReason={discountReason(data.since, data.years ?? 0)} />
      <VoidModal target={voiding} onClose={() => setVoiding(null)} onDone={reload} />
      <DueDateModal charge={redating} onClose={() => setRedating(null)} onDone={reload} />
      <AmountModal charge={repricing} onClose={() => setRepricing(null)} onDone={reload} />
    </div>
  )
}
