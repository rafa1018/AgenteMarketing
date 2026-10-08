import { CheckCircle2, Clock, ExternalLink, Loader2, Receipt, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Charge, Payment, Summary } from '../../admin/features/billing/types'
import { methodLabel } from '../../admin/features/billing/types'
import { ApiError } from '@/shared/api'
import { date, money } from '@/shared/format'
import { useQuery } from '@/shared/useQuery'
import { cn } from '@/lib/utils'
import { api, useSession } from '../session'
import { Card, Chip, Loading, Problem, Title, YearSelect } from '../ui'

interface Account {
  summary: Summary
  total: Summary
  charges: Charge[]
  payments: Payment[]
  onlinePayments: boolean
  provider: string | null
  lateFee: { enabled: boolean; amountPerDay: number; dueDay: number; graceDays: number; maxAmount: number | null }
}
interface CheckoutState { reference: string; provider: string; amount: number; status: 'creado' | 'pendiente' | 'aprobado' | 'rechazado' | 'expirado' | 'error'; paymentId: number | null }

const receiptUrl = (id: number) => `/api/v2/billing/payments/${id}/receipt`

/** Account of the student: what is pending (pay online), what was paid (with its receipt). */
export function PaymentsPage() {
  const { me } = useSession()
  const [year, setYear] = useState(me?.year ?? new Date().getFullYear())
  const q = useQuery(`account-${year}`, () => api.get<Account>(`/portal/account?year=${year}`))
  const [selected, setSelected] = useState<number[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const a = q.data
  const open = (a?.charges ?? []).filter((c) => c.status === 'abierto' && c.balance > 0)
  const payable = open.filter((c) => c.onlinePayable)
  // by default everything that can be paid online is selected
  const chosen = selected ?? payable.map((c) => c.id)
  const toPay = payable.filter((c) => chosen.includes(c.id)).reduce((s, c) => s + c.balance, 0)
  const toggle = (id: number) => setSelected(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id])

  const pay = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await api.post<{ url: string }>('/portal/checkout', { chargeIds: chosen })
      location.href = r.url
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo iniciar el pago.')
      setBusy(false)
    }
  }

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <Title sub="Pensiones y otros cobros del jardín.">Pagos</Title>
        {me && <YearSelect years={me.years.length ? me.years : [me.year]} value={year} onChange={(y) => { setYear(y); setSelected(null) }} />}
      </div>

      <CheckoutReturn onDone={q.reload} />

      {q.loading && !a && <Loading />}
      {q.error && <Problem message={q.error.message} onRetry={q.reload} />}
      {a && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <p className="text-[12px] font-bold tracking-wide text-muted uppercase">Pendiente {year}</p>
              <p className={cn('font-serif text-2xl font-semibold', a.summary.balance > 0 ? 'text-berry' : 'text-leaf')}>{money(a.summary.balance)}</p>
            </Card>
            <Card>
              <p className="text-[12px] font-bold tracking-wide text-muted uppercase">Pagado {year}</p>
              <p className="font-serif text-2xl font-semibold text-ink">{money(a.summary.paid)}</p>
            </Card>
          </div>
          {a.total.balance !== a.summary.balance && a.total.balance > 0 && (
            <p className="rounded-xl bg-butter px-4 py-3 text-sm text-[#8a5716]">
              Saldo total de todos los años: <b>{money(a.total.balance)}</b>
            </p>
          )}
          {a.total.credit > 0 && (
            <p className="rounded-xl bg-[#e9f4ee] px-4 py-3 text-sm text-leaf">
              Tienes un saldo a favor de <b>{money(a.total.credit)}</b>; el jardín lo aplicará a tus próximos cobros.
            </p>
          )}

          <section>
            <h2 className="mb-2 text-[13px] font-extrabold tracking-[0.12em] text-muted uppercase">Por pagar</h2>
            {!open.length ? (
              <p className="card p-5 text-center text-leaf">
                <CheckCircle2 className="mx-auto mb-1" /> No tienes cobros pendientes en {year}.
              </p>
            ) : (
              <ul className="space-y-2">
                {open.map((c) => (
                  <li key={c.id}>
                    <label className={cn('card flex cursor-pointer items-start gap-3 p-4', !c.onlinePayable && 'cursor-default')}>
                      {a.onlinePayments && (
                        <input type="checkbox" disabled={!c.onlinePayable} checked={c.onlinePayable && chosen.includes(c.id)} onChange={() => toggle(c.id)} className="mt-1 size-5 accent-[#5b54c9]" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-ink">{c.description}</span>
                        <span className="mt-0.5 block text-[13px] text-muted">
                          {c.dueOn ? `Vence ${date(c.dueOn)}` : 'Sin fecha de vencimiento'}
                          {c.paid > 0 && ` · abonado ${money(c.paid)}`}
                        </span>
                        {(c.discounts > 0 || c.lateFees > 0) && (
                          <span className="mt-1 flex flex-wrap gap-1.5">
                            {c.discounts > 0 && <Chip tone="green">Descuento {money(c.discounts)}</Chip>}
                            {c.lateFees > 0 && <Chip tone="red">Mora {money(c.lateFees)}</Chip>}
                          </span>
                        )}
                        {!c.onlinePayable && a.onlinePayments && <span className="mt-1 block text-[12px] text-muted">Este cobro se paga en el jardín.</span>}
                      </span>
                      <span className="text-right">
                        <span className="block font-serif text-lg font-semibold text-ink">{money(c.balance)}</span>
                        {c.overdue && <Chip tone="red">Vencido</Chip>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {open.length > 0 &&
              (a.onlinePayments ? (
                <div className="sticky bottom-24 z-10 mt-3">
                  {error && <Problem message={error} />}
                  <button type="button" onClick={pay} disabled={busy || toPay <= 0} className="btn btn-primary mt-2 w-full shadow-lg">
                    {busy ? <Loader2 size={18} className="animate-spin" /> : null}
                    {toPay > 0 ? `Pagar ${money(toPay)} en línea` : 'Elige qué pagar'}
                  </button>
                  <p className="mt-1.5 text-center text-[12px] text-muted">Te llevamos a {a.provider === 'mercadopago' ? 'Mercado Pago' : 'Wompi'} para pagar con PSE, tarjeta o Nequi de forma segura.</p>
                </div>
              ) : (
                <p className="mt-3 rounded-xl bg-paper px-4 py-3 text-sm text-muted">Para pagar, comunícate con el jardín{me?.school.phone ? ` al ${me.school.phone}` : ''}. Pronto podrás hacerlo en línea desde aquí.</p>
              ))}
            {a.lateFee.enabled && (
              <p className="mt-3 text-[13px] text-muted">
                Recuerda: la pensión vence el día {a.lateFee.dueDay} de cada mes{a.lateFee.graceDays ? ` (con ${a.lateFee.graceDays} días de gracia)` : ''}. Cada día de retraso suma {money(a.lateFee.amountPerDay)}, según el contrato de matrícula.
              </p>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-[13px] font-extrabold tracking-[0.12em] text-muted uppercase">Pagos realizados</h2>
            {!a.payments.length ? (
              <p className="card p-5 text-center text-muted">Aún no hay pagos en {year}.</p>
            ) : (
              <ul className="space-y-2">
                {a.payments.map((p) => (
                  <li key={p.id} className="card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block font-semibold text-ink">{money(p.amount)}</span>
                        <span className="block text-[13px] text-muted">
                          {date(p.paidOn)} · {methodLabel(p.method)}
                        </span>
                        <span className="mt-1 block text-[13px] text-text">{p.charges.map((c) => c.description).join(' · ')}</span>
                      </span>
                      <a href={receiptUrl(p.id)} target="_blank" rel="noopener" className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#eeedfb] px-3 py-1.5 text-[13px] font-bold text-royal">
                        <Receipt size={15} /> {p.receipt ?? 'Comprobante'}
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {a.charges.some((c) => c.status === 'pagado') && (
            <details className="card p-4">
              <summary className="cursor-pointer font-semibold text-ink">Cobros pagados de {year}</summary>
              <ul className="mt-2 divide-y divide-line">
                {a.charges
                  .filter((c) => c.status === 'pagado')
                  .map((c) => (
                    <li key={c.id} className="flex justify-between gap-3 py-2 text-[15px]">
                      <span>{c.description}</span>
                      <span className="font-semibold text-leaf">{money(c.net)}</span>
                    </li>
                  ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </>
  )
}

/**
 * Back from the gateway: /familia/?pago=REF(&id=TX | &payment_id=TX)#/pagos. Asks the server for the
 * status (it confirms with the gateway) and polls a few times while it is still pending.
 */
function CheckoutReturn({ onDone }: { onDone: () => void }) {
  const params = new URLSearchParams(location.search)
  const [ref] = useState(params.get('pago'))
  const [tx] = useState(params.get('id') ?? params.get('payment_id') ?? params.get('collection_id'))
  const [state, setState] = useState<CheckoutState | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!ref) return
    // the URL is cleaned so a reload does not show the banner again
    history.replaceState(null, '', location.pathname + location.hash)
    let tries = 0
    let timer: number | undefined
    let alive = true
    const check = async () => {
      try {
        const r = await api.get<{ checkout: CheckoutState }>(`/portal/checkout/${encodeURIComponent(ref)}${tx ? `?id=${encodeURIComponent(tx)}` : ''}`)
        if (!alive) return
        setState(r.checkout)
        if (['pendiente', 'creado'].includes(r.checkout.status) && ++tries < 10) timer = window.setTimeout(check, 4000)
        else onDone()
      } catch (e) {
        if (alive) setError(e instanceof ApiError ? e.message : 'No pudimos consultar el pago.')
      }
    }
    check()
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, tx])

  if (!ref) return null
  if (error) return <div className="mb-4"><Problem message={error} /></div>
  if (!state)
    return (
      <p className="card mb-4 flex items-center gap-2 p-4 text-muted">
        <Loader2 size={18} className="animate-spin" /> Consultando tu pago…
      </p>
    )
  const s = state.status
  if (s === 'aprobado')
    return (
      <div className="card mb-4 border-l-4 border-l-[#2f8a5b] p-5">
        <p className="flex items-center gap-2 text-lg font-semibold text-leaf">
          <CheckCircle2 /> ¡Pago aprobado!
        </p>
        <p className="mt-1 text-[15px]">Recibimos {money(state.amount)}. Gracias.</p>
        {state.paymentId && (
          <a href={receiptUrl(state.paymentId)} target="_blank" rel="noopener" className="btn btn-primary mt-3 w-full">
            <ExternalLink size={18} /> Ver comprobante de pago
          </a>
        )}
      </div>
    )
  if (s === 'pendiente' || s === 'creado')
    return (
      <div className="card mb-4 border-l-4 border-l-[#e2a33b] p-5">
        <p className="flex items-center gap-2 text-lg font-semibold text-[#8a5716]">
          <Clock /> Pago en proceso
        </p>
        <p className="mt-1 text-[15px]">Tu banco aún no confirma el pago de {money(state.amount)}. Te avisaremos con una notificación apenas se apruebe; no lo pagues de nuevo.</p>
      </div>
    )
  return (
    <div className="card mb-4 border-l-4 border-l-[#c4473e] p-5">
      <p className="flex items-center gap-2 text-lg font-semibold text-berry">
        <XCircle /> El pago no se completó
      </p>
      <p className="mt-1 text-[15px]">{s === 'rechazado' ? 'La entidad rechazó el pago.' : 'El pago se canceló o expiró.'} No se hizo ningún cobro; puedes intentarlo de nuevo.</p>
    </div>
  )
}
