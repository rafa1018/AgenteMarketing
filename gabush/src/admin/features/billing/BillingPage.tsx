import { CalendarPlus, Download, Loader2, MessageCircle, Plus, Printer, Save, Wallet } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@/shared/useQuery'
import { date, MONTH_NAMES, money, monthLabel, parseMoney, todayISO } from '@/shared/format'
import { toast } from '../../store'
import { PageHead } from '../../ui'
import { api2, qs, useSetup } from '../../v2/api'
import { Badge, Empty, ErrorBox, Field, SearchBox, Spinner, Stat, StatusBadge, Tabs, YearPicker, inputCls, useTab } from '../../v2/kit'
import { openStudent } from '../students/openStudent'
import { PlansPanel } from './PlansPanel'
import { SignatureCard } from './SignatureCard'
import { METHODS, methodLabel } from './types'

type Tab = 'resumen' | 'deudores' | 'pagos' | 'planes' | 'config'

export function BillingPage() {
  const [tab, setTab] = useTab<Tab>('resumen')
  return (
    <div className="space-y-5">
      <PageHead title="Cartera" sub="Pensiones, cobros, pagos y deudores. Los pagos en línea entran solos." actions={<YearPicker />} />
      <Tabs tabs={[{ id: 'resumen', label: 'Resumen' }, { id: 'deudores', label: 'Deudores' }, { id: 'pagos', label: 'Pagos recibidos' }, { id: 'planes', label: 'Planes' }, { id: 'config', label: 'Precios y mora' }]} value={tab} onChange={setTab} />
      {tab === 'resumen' && <Overview />}
      {tab === 'planes' && <PlansPanel />}
      {tab === 'deudores' && <Debtors />}
      {tab === 'pagos' && <PaymentsReport />}
      {tab === 'config' && (
        <div className="space-y-5">
          <BillingConfig />
          <SignatureCard kind="rectora" />
          <SignatureCard kind="contadora" />
        </div>
      )}
    </div>
  )
}

type OverviewData = { year: number; billed: { month: string; amount: number }[]; collected: { month: string; amount: number; n: number }[]; byMethod: { method: string; amount: number; n: number }[]; pending: number; overdue: number; debtors: number; today: { amount: number; n: number }; online: { amount: number; n: number } }

function Overview() {
  const { year } = useSetup()
  const { data, error, loading, reload } = useQuery(year ? `bov:${year}` : null, () => api2.get<OverviewData>('/billing/overview' + qs({ year })))
  if (error) return <ErrorBox message={error.message} onRetry={reload} />
  if (loading && !data) return <Spinner />
  if (!data) return null
  const months = Array.from(new Set([...data.billed.map((b) => b.month), ...data.collected.map((c) => c.month)])).sort()
  const max = Math.max(1, ...data.billed.map((b) => b.amount), ...data.collected.map((c) => c.amount))
  const totalCollected = data.collected.reduce((a, c) => a + c.amount, 0)
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Recaudado en el año" value={money(totalCollected)} tone="green" />
        <Stat label="Por cobrar" value={money(data.pending)} hint={`${data.debtors} familias`} tone={data.pending ? 'red' : 'ink'} />
        <Stat label="Vencido" value={money(data.overdue)} tone={data.overdue ? 'red' : 'ink'} />
        <Stat label="Recibido hoy" value={money(data.today.amount)} hint={`${data.today.n} pagos · en línea en el año: ${money(data.online.amount)}`} />
      </div>
      <section className="card p-4 sm:p-6">
        <h3 className="text-lg">Facturado vs. recaudado por mes</h3>
        <div className="mt-4 space-y-2.5">
          {months.map((m) => {
            const b = data.billed.find((x) => x.month === m)?.amount ?? 0
            const c = data.collected.find((x) => x.month === m)?.amount ?? 0
            return (
              <div key={m} className="grid grid-cols-[88px_1fr] items-center gap-3 text-[13px]">
                <span className="font-semibold text-muted capitalize">{monthLabel(m).replace(/ \d+$/, '')}</span>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="h-3 rounded-full bg-[#d6d8ec]" style={{ width: `${(b / max) * 100}%` }} />
                    <span className="text-muted tabular-nums">{money(b)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 rounded-full bg-leaf" style={{ width: `${(c / max) * 100}%` }} />
                    <span className="font-semibold text-ink tabular-nums">{money(c)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <p className="mt-3 flex gap-4 text-[12px] text-muted">
          <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-[#d6d8ec]" /> Facturado</span>
          <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-leaf" /> Recaudado</span>
        </p>
      </section>
      <section className="card p-4 sm:p-6">
        <h3 className="text-lg">Por medio de pago</h3>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {data.byMethod.map((m) => (
            <li key={m.method} className="flex items-center justify-between rounded-xl bg-paper px-3 py-2">
              <span className="font-semibold text-ink">{methodLabel(m.method)}</span>
              <span className="text-sm text-muted">
                {m.n} · <b className="text-ink">{money(m.amount)}</b>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

type Debtor = { id: number; code: string; firstName: string; lastName: string; secondLastName: string | null; course: string | null; guardian: string | null; guardianPhone: string | null; status: string | null; balance: number; overdue: number; lateFees: number; credit: number; byYear?: { year: number | null; balance: number; overdue: number }[] }

function Debtors() {
  const { year } = useSetup()
  const [min, setMin] = useState('')
  const [q, setQ] = useState('')
  const { data, error, loading, reload } = useQuery(year ? `debt:${year}:${min}` : null, () => api2.get<{ debtors: Debtor[] }>('/billing/debtors' + qs({ year, min: parseMoney(min) || null })))
  const rows = useMemo(() => (data?.debtors ?? []).filter((d) => !q || `${d.firstName} ${d.lastName} ${d.code} ${d.guardian}`.toLowerCase().includes(q.toLowerCase())), [data, q])
  const total = rows.reduce((a, d) => a + d.balance, 0)
  const wa = (d: Debtor) => {
    const text = `Hola ${d.guardian ?? ''}, le saludamos del Jardín Infantil Gabush. ${d.firstName} tiene un saldo pendiente de ${money(d.balance)}${d.lateFees ? ` (incluye ${money(d.lateFees)} de mora)` : ''}. Puede pagar en línea desde el portal de familias: https://gabushkids.com/familia/ ¡Gracias!`
    return `https://wa.me/57${(d.guardianPhone ?? '').replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(text)}`
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
        <SearchBox value={q} onChange={setQ} placeholder="Buscar estudiante o acudiente…" />
        <input value={min} onChange={(e) => setMin(e.target.value)} inputMode="numeric" placeholder="Saldo mayor a $…" className={inputCls()} />
      </div>
      {error ? (
        <ErrorBox message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Spinner />
      ) : !rows.length ? (
        <Empty icon={<Wallet />} title="¡Nadie debe!">No hay saldos pendientes con estos filtros.</Empty>
      ) : (
        <>
          <p className="text-sm text-muted">
            {rows.length} estudiantes · total <b className="text-berry">{money(total)}</b>
          </p>
          <ul className="space-y-2">
            {rows.map((d) => (
              <li key={d.id} className="card flex flex-wrap items-center gap-3 p-3.5">
                <button type="button" onClick={() => openStudent(d.id, 'cartera')} className="min-w-0 flex-1 text-left">
                  <span className="block truncate font-semibold text-ink">
                    {d.lastName} {d.secondLastName ?? ''}, {d.firstName}
                  </span>
                  <span className="block text-[13px] text-muted">
                    {d.code} · {d.course ?? 'sin curso'} {d.status && d.status !== 'activo' && <StatusBadge status={d.status} />} · {d.guardian ?? 'sin acudiente'}
                  </span>
                  {/* which years the debt comes from */}
                  {!!d.byYear?.length && (
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      {d.byYear.map((y) => (
                        <span key={y.year ?? 'x'} className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ${y.year === year ? 'bg-[#fde7f1] text-pink' : 'bg-butter text-[#8a5716]'}`}>
                          {y.year ?? 'Sin año'}: {money(y.balance)}
                        </span>
                      ))}
                    </span>
                  )}
                </button>
                <span className="text-right">
                  <span className="block font-serif text-lg font-semibold text-berry tabular-nums">{money(d.balance)}</span>
                  {d.overdue > 0 && <span className="block text-[12px] text-muted">vencido {money(d.overdue)}</span>}
                  {d.lateFees > 0 && <Badge tone="red">mora {money(d.lateFees)}</Badge>}
                </span>
                {d.guardianPhone && (
                  <a href={wa(d)} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp !min-h-10 !px-3 !text-sm" title="Recordar por WhatsApp">
                    <MessageCircle size={16} /> Recordar
                  </a>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

type PaymentRow = { id: number; receipt: string; paidOn: string; amount: number; method: string; reference: string | null; status: string; source: string; createdBy: string | null; studentId: number; code: string; firstName: string; lastName: string; concepts: string | null; guardian: string | null; guardianPhone: string | null }

/** WhatsApp to the family: payment received, with the receipt number and where to download it. */
const paymentWhatsapp = (p: PaymentRow) => {
  const hi = (p.guardian ?? '').trim().split(/\s+/)[0]
  const text = `Hola${hi ? ` ${hi}` : ''}, le saludamos del Jardín Infantil Gabush. Recibimos el pago de ${money(p.amount)} del ${date(p.paidOn)} (comprobante ${p.receipt}) por: ${p.concepts ?? 'abono a la cuenta'}, de ${p.firstName}. Puede ver y descargar el comprobante en el portal de familias: https://gabushkids.com/familia/ ¡Muchas gracias!`
  return `https://wa.me/57${(p.guardianPhone ?? '').replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(text)}`
}

function PaymentsReport() {
  const [from, setFrom] = useState(todayISO().slice(0, 8) + '01')
  const [to, setTo] = useState(todayISO())
  const [method, setMethod] = useState('')
  const { data, error, loading, reload } = useQuery(`pays:${from}:${to}:${method}`, () => api2.get<{ payments: PaymentRow[]; total: number; count: number }>('/billing/payments' + qs({ from, to, method })))
  const csv = () => {
    const rows = [['Comprobante', 'Fecha', 'Código', 'Estudiante', 'Valor', 'Medio', 'Referencia', 'Conceptos', 'Estado', 'Registró'], ...(data?.payments ?? []).map((p) => [p.receipt, p.paidOn, p.code, `${p.lastName}, ${p.firstName}`, String(p.amount), methodLabel(p.method), p.reference ?? '', p.concepts ?? '', p.status, p.createdBy ?? ''])]
    const blob = new Blob(['﻿' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `pagos-${from}-a-${to}.csv`
    a.click()
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Desde">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls()} />
        </Field>
        <Field label="Hasta">
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls()} />
        </Field>
        <Field label="Medio">
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputCls()}>
            <option value="">Todos</option>
            {[...METHODS, ['wompi', 'Wompi'], ['mercadopago', 'Mercado Pago']].map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <button type="button" onClick={csv} disabled={!data?.payments.length} className="btn btn-ghost">
          <Download size={17} /> Excel (CSV)
        </button>
      </div>
      {error ? (
        <ErrorBox message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Spinner />
      ) : !data?.payments.length ? (
        <Empty title="Sin pagos en esas fechas" />
      ) : (
        <>
          <p className="text-sm text-muted">
            {data.count} pagos · total <b className="text-leaf">{money(data.total)}</b>
          </p>
          <ul className="space-y-2">
            {data.payments.map((p) => (
              <li key={p.id} className="card flex flex-wrap items-center gap-3 p-3.5">
                <button type="button" onClick={() => openStudent(p.studentId, 'cartera')} className="min-w-0 flex-1 text-left">
                  <span className="block truncate font-semibold text-ink">
                    {p.lastName}, {p.firstName} <span className="font-normal text-muted">· {p.code}</span>
                  </span>
                  <span className="block truncate text-[13px] text-muted">
                    {date(p.paidOn)} · {methodLabel(p.method)} · {p.concepts ?? 'saldo a favor'}
                  </span>
                </button>
                {p.source === 'en_linea' && <Badge tone="violet">En línea</Badge>}
                {p.status !== 'aprobado' && <StatusBadge status={p.status} />}
                <span className="font-semibold text-ink tabular-nums">{money(p.amount)}</span>
                {p.status === 'aprobado' && p.guardianPhone && (
                  <a href={paymentWhatsapp(p)} target="_blank" rel="noopener noreferrer" className="grid size-9 place-items-center rounded-lg bg-[#e7f9ee] text-[#128c4a] hover:bg-[#25d366] hover:text-white" title={`Enviar a ${p.guardian ?? 'la familia'} por WhatsApp`}>
                    <MessageCircle size={17} />
                  </a>
                )}
                <a href={`/api/v2/billing/payments/${p.id}/receipt`} target="_blank" rel="noopener noreferrer" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-paper hover:text-ink" title="Comprobante">
                  <Printer size={17} />
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

/**
 * Charge a yearly concept (útiles, clausura) to every active student of the year that doesn't have it yet,
 * at the price of their grade, with the chosen due date.
 */
/**
 * The concepts of the price table: which ones are charged by themselves when enrolling, which ones show in the
 * table, and new ones (App, Seguro escolar, Fotos, Uniforme…). The matrícula and the pension are fixed.
 */
function ConceptsManager() {
  const { setup, reload } = useSetup()
  const [name, setName] = useState('')
  const [open, setOpen] = useState(false)
  const m = useMutation()
  const editable = (setup?.concepts ?? []).filter((c) => c.active && !['PENSION', 'MATRICULA', 'DIAS', 'SALDO_ANTERIOR', 'NOTA_DEBITO', 'OTRO'].includes(c.code))
  const update = async (id: number, body: Record<string, unknown>) => {
    if (await m.run(() => api2.put(`/billing/concepts/${id}`, body))) reload()
  }
  const create = async () => {
    if (await m.run(() => api2.post('/billing/concepts', { name: name.trim(), onEnrollment: false }))) {
      toast(`«${name.trim()}» agregado a la tabla de precios`)
      setName('')
      reload()
    }
  }
  return (
    <details open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)} className="rounded-2xl bg-paper p-4">
      <summary className="cursor-pointer font-semibold text-ink">Conceptos de cobro (agregar App, Seguro escolar, Fotos u otros)</summary>
      <ul className="mt-3 divide-y divide-line rounded-xl bg-white ring-1 ring-line">
        {editable.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 text-[14px]">
            <span className="min-w-0 flex-1 font-semibold text-ink">{c.name}</span>
            <label className="flex items-center gap-1.5 text-muted">
              <input type="checkbox" checked={Boolean(c.inPriceTable)} disabled={m.busy} onChange={(e) => update(c.id, { inPriceTable: e.target.checked })} className="size-4 accent-[#3a36a8]" /> En la tabla
            </label>
            <label className="flex items-center gap-1.5 text-muted" title="Se genera solo al tocar «Matricular (activar)», con la fecha límite de la matrícula">
              <input type="checkbox" checked={Boolean(c.onEnrollment)} disabled={m.busy} onChange={(e) => update(c.id, { onEnrollment: e.target.checked })} className="size-4 accent-[#3a36a8]" /> Cobrar al matricular
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Nuevo concepto (ej. Uniforme, Agenda…)" className={inputCls() + ' min-w-0 flex-1'} />
        <button type="button" disabled={m.busy || name.trim().length < 2} onClick={create} className="btn btn-primary !min-h-[46px] !text-sm disabled:opacity-50">
          <Plus size={16} /> Agregar
        </button>
      </div>
      {m.message && <ErrorBox message={m.message} />}
    </details>
  )
}

function ConceptCharger({ year, code, label, defaultDue, hint }: { year: number; code: string; label: string; defaultDue: string; hint: string }) {
  const { data, reload } = useQuery(`concept-pending:${year}:${code}`, () => api2.get<{ missing: number; withoutPrice: number; concept: string | null }>('/billing/concept-charges' + qs({ year, concept: code })))
  const [due, setDue] = useState(defaultDue)
  const m = useMutation()
  useEffect(() => setDue((d) => d || defaultDue), [defaultDue])
  if (!data?.concept) return null
  const run = async () => {
    const r = await m.run(() => api2.post<{ created: number }>('/billing/concept-charges', { year, concept: code, dueOn: due }))
    if (r) {
      toast(r.created ? `Se cobró ${label.toLowerCase()} a ${r.created} estudiantes de ${year}` : 'No había a quién cobrar')
      reload()
    }
  }
  return (
    <div className="space-y-2 rounded-2xl bg-paper p-4">
      <p className="font-semibold text-ink">Cobrar {label.toLowerCase()} {year} a los ya matriculados</p>
      <p className="text-[13px] text-muted">{hint}</p>
      <p className="text-[14px]">
        {data.missing ? (
          <b className="text-ink">{data.missing} matriculados aún no tienen este cobro.</b>
        ) : (
          <span className="text-leaf">Todos los matriculados con precio ya lo tienen.</span>
        )}
        {data.withoutPrice > 0 && <span className="block text-[13px] text-[#8a5716]">{data.withoutPrice} no tienen precio para su grado: ponlo en la tabla y guarda.</span>}
      </p>
      {data.missing > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Vence el">
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputCls()} />
          </Field>
          <button type="button" disabled={m.busy || !due} onClick={run} className="btn btn-primary !min-h-[46px] !text-sm disabled:opacity-50">
            Cobrar a {data.missing}
          </button>
        </div>
      )}
      {m.message && <ErrorBox message={m.message} />}
    </div>
  )
}

type LateFee = { enabled: boolean; amountPerDay: number; dueDay: number; graceDays: number; maxAmount: number | null; appliesFrom: string | null; mode: 'dia' | 'mes' }

function BillingConfig() {
  const { setup, year } = useSetup()
  const settings = useQuery(year ? `billing-settings:${year}` : null, () => api2.get<{ lateFee: LateFee; pensionMonths: number[]; enrollmentDueDays: number; enrollmentDueOn: string | null; enrollmentLateFee: number; earlyDiscountPct: number; earlyDiscountUntil: string | null }>('/billing/settings' + qs({ year })))
  const [dueDays, setDueDays] = useState(0)
  const [dueOn, setDueOn] = useState('')
  const [extra, setExtra] = useState('')
  const [earlyPct, setEarlyPct] = useState('')
  const [earlyUntil, setEarlyUntil] = useState('')
  const prices = useQuery(year ? `prices:${year}` : null, () => api2.get<{ prices: { conceptId: number; gradeLevelId: number | null; amount: number }[] }>('/billing/prices' + qs({ year })))
  const [lf, setLf] = useState<LateFee | null>(null)
  const [months, setMonths] = useState<number[]>([])
  const [grid, setGrid] = useState<Record<string, string>>({})
  const [genMonth, setGenMonth] = useState(todayISO().slice(0, 7))
  const m = useMutation()
  useEffect(() => {
    if (settings.data) {
      setLf(settings.data.lateFee)
      setMonths(settings.data.pensionMonths)
      setDueDays(settings.data.enrollmentDueDays ?? 0)
      setDueOn(settings.data.enrollmentDueOn ?? '')
      setExtra(settings.data.enrollmentLateFee ? String(settings.data.enrollmentLateFee) : '')
      setEarlyPct(settings.data.earlyDiscountPct ? String(settings.data.earlyDiscountPct).replace('.', ',') : '')
      setEarlyUntil(settings.data.earlyDiscountUntil ?? '')
    }
  }, [settings.data])
  useEffect(() => {
    setGrid(Object.fromEntries((prices.data?.prices ?? []).map((p) => [`${p.conceptId}:${p.gradeLevelId ?? ''}`, String(p.amount)])))
  }, [prices.data])
  // columns of the price table: the concepts marked "in the price table", in their order
  const concepts = (setup?.concepts ?? []).filter((c) => c.active && c.inPriceTable).sort((a, b) => a.sort - b.sort || a.id - b.id)
  // the yearly ones that can be charged to every enrolled student at once (not the matrícula nor the pension)
  const bulk = concepts.filter((c) => !['MATRICULA', 'PENSION'].includes(c.code))
  const grades = setup?.gradeLevels.filter((g) => g.active) ?? []

  const saveSettings = async () => {
    const r = await m.run(() =>
      api2.put<{ movedEnrollmentCharges?: number; extraEnrollmentCharges?: number; earlyDiscountCharges?: number }>('/billing/settings' + qs({ year }), {
        lateFee: lf,
        pensionMonths: months,
        enrollmentDueDays: dueDays,
        enrollmentDueOn: dueOn || null,
        enrollmentLateFee: extra ? parseMoney(extra) : 0,
        earlyDiscountPct: earlyPct ? Number(earlyPct.replace(',', '.')) || 0 : 0,
        earlyDiscountUntil: earlyUntil || null,
      }),
    )
    if (r) {
      const parts = ['Configuración guardada']
      if (r.movedEnrollmentCharges) parts.push(`${r.movedEnrollmentCharges} matrículas pendientes ahora vencen el ${date(dueOn)}`)
      if (r.extraEnrollmentCharges) parts.push(`${r.extraEnrollmentCharges} matrículas sin pagar recibieron la matrícula extraordinaria`)
      if (r.earlyDiscountCharges) parts.push(`${r.earlyDiscountCharges} matrículas recibieron el descuento de pronto pago`)
      toast(parts.join(' · '))
    }
  }
  const savePrices = async () => {
    const items = concepts.flatMap((c) => grades.map((g) => ({ conceptId: c.id, gradeLevelId: g.id, amount: grid[`${c.id}:${g.id}`] ? parseMoney(grid[`${c.id}:${g.id}`]) : null })))
    if (await m.run(() => api2.put('/billing/prices', { year, prices: items }))) {
      toast(`Precios ${year} guardados`)
      prices.reload()
    }
  }
  const generate = async () => {
    const r = await m.run(() => api2.post<{ created: number; skipped: number }>('/billing/generate', { month: genMonth }))
    if (r) toast(r.created ? `Se crearon ${r.created} pensiones de ${monthLabel(genMonth)}` : `Las pensiones de ${monthLabel(genMonth)} ya estaban creadas`)
  }
  if (!setup || settings.loading || !lf) return <Spinner />
  return (
    <div className="space-y-5">
      <section className="card space-y-4 p-4 sm:p-6">
        <h3 className="text-lg">Precios {year} por grado</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-[14px]">
            <thead>
              <tr className="text-left text-[12px] font-bold text-muted uppercase">
                <th className="py-2 pr-3">Grado</th>
                {concepts.map((c) => (
                  <th key={c.id} className="px-2 py-2">
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grades.map((g) => (
                <tr key={g.id} className="border-t border-line">
                  <td className="py-2 pr-3 font-semibold text-ink">{g.name}</td>
                  {concepts.map((c) => {
                    const k = `${c.id}:${g.id}`
                    return (
                      <td key={c.id} className="px-2 py-1.5">
                        <input value={grid[k] ? Number(parseMoney(grid[k])).toLocaleString('es-CO') : ''} onChange={(e) => setGrid({ ...grid, [k]: e.target.value })} inputMode="numeric" placeholder="—" className="w-full rounded-lg border border-line px-2.5 py-2 text-right tabular-nums" />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[13px] text-muted">
          La <b>matrícula</b> y los cobros marcados «al matricular» se generan solos al tocar «Matricular (activar)», con la misma fecha límite. La <b>pensión</b> se genera cada mes. Los demás se cobran a todos los matriculados con los botones de abajo (uno por concepto), sin tener que hacerlo estudiante por estudiante.
        </p>
        <button type="button" disabled={m.busy} onClick={savePrices} className="btn btn-primary !text-sm">
          <Save size={17} /> Guardar precios
        </button>
        <ConceptsManager />
        {year && bulk.length > 0 && (
          <div className="space-y-2 border-t border-line pt-4">
            <p className="font-semibold text-ink">Cobrar a los ya matriculados de {year}</p>
            <div className="grid gap-3 lg:grid-cols-2">
              {bulk.map((c) => (
                <ConceptCharger
                  key={c.id}
                  year={year}
                  code={c.code}
                  label={c.name}
                  defaultDue={c.onEnrollment ? settings.data?.enrollmentDueOn ?? '' : ''}
                  hint={c.onEnrollment ? 'Se cobra solo al matricular; esto es para los que se matricularon antes de poner su precio.' : 'Pon el valor en la tabla, guarda y cóbralo aquí a todos los matriculados de una vez.'}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="card space-y-4 p-4 sm:p-6">
        <h3 className="text-lg">Mora por pago tardío</h3>
        <label className="flex items-center gap-2 text-[15px] font-semibold text-ink">
          <input type="checkbox" checked={lf.enabled} onChange={(e) => setLf({ ...lf, enabled: e.target.checked })} className="size-5 accent-[#3a36a8]" /> Cobrar mora (según el contrato de matrícula)
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ['mes', 'Por mes de atraso', 'Un valor fijo cuando pasan los días de gracia, y otra vez cada mes que siga sin pagar.'],
              ['dia', 'Por día de retraso', 'El valor se suma por cada día después del vencimiento (y de los días de gracia).'],
            ] as const
          ).map(([id, title, detail]) => (
            <button key={id} type="button" onClick={() => setLf({ ...lf, mode: id })} className={`rounded-2xl border-2 p-3.5 text-left ${(lf.mode ?? 'dia') === id ? 'border-royal bg-[#eeedfb]' : 'border-line bg-white'}`}>
              <span className="block font-semibold text-ink">{title}</span>
              <span className="block text-[13px] text-muted">{detail}</span>
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={lf.mode === 'mes' ? 'Valor por cada mes de atraso' : 'Valor por día de retraso'}>
            <input value={lf.amountPerDay.toLocaleString('es-CO')} onChange={(e) => setLf({ ...lf, amountPerDay: parseMoney(e.target.value) })} inputMode="numeric" className={inputCls()} />
          </Field>
          <Field label="La pensión vence el día">
            <input type="number" min={1} max={28} value={lf.dueDay} onChange={(e) => setLf({ ...lf, dueDay: Number(e.target.value) })} className={inputCls()} />
          </Field>
          <Field label="Días de gracia">
            <input type="number" min={0} max={30} value={lf.graceDays} onChange={(e) => setLf({ ...lf, graceDays: Number(e.target.value) })} className={inputCls()} />
          </Field>
          <Field label="Tope por cobro (opcional)">
            <input value={lf.maxAmount ? lf.maxAmount.toLocaleString('es-CO') : ''} onChange={(e) => setLf({ ...lf, maxAmount: parseMoney(e.target.value) || null })} inputMode="numeric" placeholder="Sin tope" className={inputCls()} />
          </Field>
          <Field label="Aplica a cobros que venzan desde" hint="Los cobros anteriores (traídos de Cerkademia) no generan mora." className="sm:col-span-2">
            <input type="date" value={lf.appliesFrom ?? ''} onChange={(e) => setLf({ ...lf, appliesFrom: e.target.value || null })} className={inputCls()} />
          </Field>
        </div>
        <p className="rounded-xl bg-butter px-4 py-3 text-[14px] text-[#8a5716]">
          {lf.mode === 'mes' ? (
            <>
              Ejemplo: la pensión de octubre vence el {lf.dueDay} de octubre. Si el {lf.dueDay + Math.max(1, lf.graceDays)} de octubre no la han pagado suma <b>{money(lf.amountPerDay)}</b>; si el {lf.dueDay + Math.max(1, lf.graceDays)} de noviembre sigue sin pagar suma otros {money(lf.amountPerDay)} (<b>{money(2 * lf.amountPerDay)}</b> en total). La de noviembre lleva su propia cuenta. La mora se puede perdonar cobro por cobro.
            </>
          ) : (
            <>
              Ejemplo: una pensión que vence el {lf.dueDay} y se paga 3 días después{lf.graceDays ? ` (más ${lf.graceDays} de gracia)` : ''} suma <b>{money(3 * lf.amountPerDay)}</b> de mora. La mora se puede perdonar cobro por cobro.
            </>
          )}
        </p>
        <div>
          <p className="mb-1.5 text-[14px] font-semibold text-ink">Meses en que se cobra pensión en {year} (el primero marcado es el que arranca)</p>
          <div className="flex flex-wrap gap-1.5">
            {MONTH_NAMES.map((name, i) => (
              <button key={name} type="button" onClick={() => setMonths(months.includes(i + 1) ? months.filter((x) => x !== i + 1) : [...months, i + 1].sort((a, b) => a - b))} className={`rounded-full px-3 py-1.5 text-[13px] font-semibold capitalize ${months.includes(i + 1) ? 'bg-ink text-white' : 'bg-paper text-muted'}`}>
                {name.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={`Fecha límite para pagar la matrícula ${year}`} hint="Es el plazo: hasta ese día la matrícula sale pendiente (no vencida). Si pagan antes, queda saldada. Al cambiarla, las matrículas de este año aún sin pagar pasan a esta fecha.">
            <input type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} className={inputCls()} />
          </Field>
          <Field label="Matrícula extraordinaria (valor adicional)" hint={dueOn ? `Se suma una sola vez a quien no haya pagado la matrícula al ${date(dueOn)}, y a quien se matricule después. Vacío = no se cobra.` : 'Primero pon la fecha límite. Vacío = no se cobra.'}>
            <input value={extra} onChange={(e) => setExtra(e.target.value)} inputMode="numeric" placeholder="Ej. 50.000" className={inputCls()} />
          </Field>
          <Field label="Plazo si se matricula después de esa fecha (días)" hint={dueDays ? `Vence ${dueDays} días después de matricular.` : 'Con 0, vence el mismo día en que se matricula.'}>
            <input type="number" min={0} max={120} value={dueDays} onChange={(e) => setDueDays(Math.max(0, Number(e.target.value) || 0))} className={inputCls()} />
          </Field>
        </div>
        <div className="grid gap-3 rounded-2xl bg-[#e9f4ee] p-4 sm:grid-cols-[160px_220px_1fr]">
          <Field label="Pronto pago (%)">
            <div className="relative">
              <input value={earlyPct} onChange={(e) => setEarlyPct(e.target.value)} inputMode="decimal" placeholder="Ej. 10" className={inputCls() + ' pr-9'} />
              <span className="absolute inset-y-0 right-3 grid place-items-center font-semibold text-muted">%</span>
            </div>
          </Field>
          <Field label="Si paga la matrícula hasta">
            <input type="date" value={earlyUntil} onChange={(e) => setEarlyUntil(e.target.value)} className={inputCls()} />
          </Field>
          <p className="self-center text-[13px] text-leaf">
            {earlyPct && earlyUntil
              ? `Toda matrícula ${year} sin pagar recibe ${earlyPct}% de descuento si se paga completa hasta el ${date(earlyUntil)}. Si a esa fecha sigue pendiente, el descuento se quita solo y queda el valor completo.`
              : 'Descuento por pagar la matrícula antes de una fecha. Vacío = sin pronto pago.'}
          </p>
        </div>
        <div className="rounded-xl bg-[#eaf3fa] px-4 py-3 text-[14px] text-[#185a8a]">
          <p className="font-semibold">Así se cobra en {year}:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            <li>
              <b>Matrícula:</b> se genera al tocar «Matricular (activar)» y vence {dueOn ? `el ${date(dueOn)}` : dueDays ? `${dueDays} días después` : 'ese mismo día'}
              {dueOn && dueDays ? ` (o ${dueDays} días después si se matricula más tarde)` : ''}. No genera mora.
              {dueOn && extra && parseMoney(extra) > 0 ? ` Si al ${date(dueOn)} no la han pagado, se le suma la matrícula extraordinaria de ${money(parseMoney(extra))} (una sola vez; se puede quitar en el cobro).` : ''}
            </li>
            <li>
              <b>Pensión:</b> se genera sola el día 1 de cada mes marcado ({months.map((x) => MONTH_NAMES[x - 1].slice(0, 3)).join(', ') || 'ninguno'}) y vence el día {lf.dueDay}. La primera es la del primer mes marcado del año; quien entra a mitad de año paga desde el mes en que entra.
            </li>
          </ul>
        </div>
        {m.message && <ErrorBox message={m.message} />}
        <button type="button" disabled={m.busy} onClick={saveSettings} className="btn btn-primary !text-sm">
          {m.busy ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />} Guardar
        </button>
      </section>

      <section className="card space-y-3 p-4 sm:p-6">
        <h3 className="text-lg">Generar pensiones</h3>
        <p className="text-[14px] text-muted">El sistema crea solo las pensiones de cada mes el día 1. Si necesitas hacerlo a mano (por ejemplo, después de cambiar precios), elige el mes: no se duplican.</p>
        <div className="flex flex-wrap gap-2">
          <input type="month" value={genMonth} onChange={(e) => setGenMonth(e.target.value)} className="rounded-lg border border-line bg-white px-3 py-2 font-semibold" />
          <button type="button" disabled={m.busy} onClick={generate} className="btn btn-ghost !text-sm">
            <CalendarPlus size={17} /> Generar pensiones del mes
          </button>
        </div>
      </section>
    </div>
  )
}
