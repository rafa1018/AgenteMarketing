import { Copy, CreditCard, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@/shared/useQuery'
import { dateTime, money } from '@/shared/format'
import { toast } from '../../store'
import { PageHead } from '../../ui'
import { api2 } from '../../v2/api'
import { Badge, ErrorBox, Field, Spinner, StatusBadge, inputCls } from '../../v2/kit'

type Config = {
  provider: 'wompi' | 'mercadopago' | null
  wompi: { publicKey: string; hasIntegritySecret: boolean; hasEventsSecret: boolean }
  mercadopago: { accessToken: string; hasAccessToken: boolean; hasWebhookSecret: boolean }
  webhooks: { wompi: string; mercadopago: string }
  testMode: boolean
}
type Data = { config: Config; recent: { id: number; reference: string; provider: string; amount: number; status: string; providerStatus: string | null; createdAt: string; code: string; firstName: string; lastName: string }[] }

/** One online payment provider (Wompi or Mercado Pago): keys and webhook URL. */
export function PaymentGatewayPage() {
  const { data, error, loading, reload, setData } = useQuery('gateway', () => api2.get<Data>('/payment-gateway'))
  const [provider, setProvider] = useState<'wompi' | 'mercadopago' | 'none'>('none')
  const [wompi, setWompi] = useState({ publicKey: '', integritySecret: '', eventsSecret: '' })
  const [mp, setMp] = useState({ accessToken: '', webhookSecret: '' })
  const m = useMutation()
  useEffect(() => {
    if (data) {
      setProvider(data.config.provider ?? 'none')
      setWompi({ publicKey: data.config.wompi.publicKey, integritySecret: '', eventsSecret: '' })
    }
  }, [data])
  if (error) return <ErrorBox message={error.message} onRetry={reload} />
  if (loading || !data) return <Spinner />
  const c = data.config
  const copy = (t: string) => navigator.clipboard.writeText(t).then(() => toast('Copiado'))
  const save = async () => {
    const r = await m.run(() => api2.put<{ config: Config }>('/payment-gateway', { provider, wompi, mercadopago: mp }))
    if (r) {
      toast(provider === 'none' ? 'Pagos en línea desactivados' : 'Pasarela guardada: las familias ya pueden pagar en línea')
      setData({ ...data, config: r.config })
      setWompi({ ...wompi, integritySecret: '', eventsSecret: '' })
      setMp({ accessToken: '', webhookSecret: '' })
    }
  }
  return (
    <div className="space-y-5">
      <PageHead title="Pagos en línea" sub="Las familias pagan pensiones y cobros desde su portal. Elige una pasarela; el dinero llega a tu cuenta en ella." />
      <section className="card space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="flex items-center gap-2 text-lg">
            <CreditCard size={19} className="text-royal" /> Pasarela activa
          </h3>
          {c.provider ? <Badge tone="green">{c.provider === 'wompi' ? 'Wompi' : 'Mercado Pago'}</Badge> : <Badge>Ninguna</Badge>}
          {c.testMode && <Badge tone="yellow">Modo de pruebas</Badge>}
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            ['none', 'Desactivado', 'Las familias ven sus pagos pero pagan en el jardín.'],
            ['wompi', 'Wompi', 'De Bancolombia: PSE, tarjetas, Nequi, Bancolombia.'],
            ['mercadopago', 'Mercado Pago', 'Tarjetas, PSE y efectivo (Efecty).'],
          ].map(([id, label, hint]) => (
            <button key={id} type="button" onClick={() => setProvider(id as typeof provider)} className={`rounded-2xl border-2 p-4 text-left ${provider === id ? 'border-royal bg-[#eeedfb]' : 'border-line bg-white'}`}>
              <p className="font-semibold text-ink">{label}</p>
              <p className="mt-0.5 text-[13px] text-muted">{hint}</p>
            </button>
          ))}
        </div>
        {provider === 'wompi' && (
          <div className="space-y-3 rounded-2xl bg-paper p-4">
            <p className="text-[14px] text-muted">En comercios.wompi.co → Desarrolladores → Llaves del API. Usa primero las de pruebas (pub_test_…) y cuando todo esté bien, las de producción (pub_prod_…).</p>
            <Field label="Llave pública" error={m.fields['wompi.publicKey']}>
              <input value={wompi.publicKey} onChange={(e) => setWompi({ ...wompi, publicKey: e.target.value.trim() })} className={inputCls(m.fields['wompi.publicKey'])} placeholder="pub_prod_…" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Secreto de integridad" hint={c.wompi.hasIntegritySecret ? 'Guardado. Vacío = no cambiar.' : undefined}>
                <input type="password" value={wompi.integritySecret} onChange={(e) => setWompi({ ...wompi, integritySecret: e.target.value.trim() })} className={inputCls()} autoComplete="new-password" />
              </Field>
              <Field label="Secreto de eventos" hint={c.wompi.hasEventsSecret ? 'Guardado. Vacío = no cambiar.' : undefined}>
                <input type="password" value={wompi.eventsSecret} onChange={(e) => setWompi({ ...wompi, eventsSecret: e.target.value.trim() })} className={inputCls()} autoComplete="new-password" />
              </Field>
            </div>
            <Webhook url={c.webhooks.wompi} onCopy={copy} where="Wompi → Desarrolladores → URL de eventos" />
          </div>
        )}
        {provider === 'mercadopago' && (
          <div className="space-y-3 rounded-2xl bg-paper p-4">
            <p className="text-[14px] text-muted">En mercadopago.com.co/developers → Tus integraciones → Credenciales. Primero las de prueba (TEST-…) y luego las de producción (APP_USR-…).</p>
            <Field label="Access token" error={m.fields['mercadopago.accessToken']} hint={c.mercadopago.hasAccessToken ? `Guardado (${c.mercadopago.accessToken}). Vacío = no cambiar.` : undefined}>
              <input type="password" value={mp.accessToken} onChange={(e) => setMp({ ...mp, accessToken: e.target.value.trim() })} className={inputCls(m.fields['mercadopago.accessToken'])} autoComplete="new-password" />
            </Field>
            <Field label="Clave secreta del webhook" hint={c.mercadopago.hasWebhookSecret ? 'Guardada. Vacío = no cambiar.' : 'Tus integraciones → Webhooks → Clave secreta.'}>
              <input type="password" value={mp.webhookSecret} onChange={(e) => setMp({ ...mp, webhookSecret: e.target.value.trim() })} className={inputCls()} autoComplete="new-password" />
            </Field>
            <Webhook url={c.webhooks.mercadopago} onCopy={copy} where="Mercado Pago → Webhooks (evento «Pagos»)" />
          </div>
        )}
        {m.message && <ErrorBox message={m.message} />}
        <button type="button" disabled={m.busy} onClick={save} className="btn btn-primary !text-sm">
          <Save size={17} /> Guardar
        </button>
      </section>
      <section className="card overflow-hidden p-0">
        <h3 className="border-b border-line px-4 py-3 text-lg">Últimos intentos de pago en línea</h3>
        {!data.recent.length ? (
          <p className="px-4 py-6 text-sm text-muted">Aún no hay pagos en línea.</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.recent.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-[14px]">
                <span className="min-w-0 flex-1 truncate">
                  <b className="text-ink">
                    {r.firstName} {r.lastName}
                  </b>{' '}
                  · {money(r.amount)} · {r.provider} · {dateTime(r.createdAt)}
                </span>
                <StatusBadge status={r.status === 'creado' ? 'pendiente' : r.status === 'expirado' || r.status === 'error' ? 'rechazado' : r.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Webhook({ url, onCopy, where }: { url: string; onCopy: (t: string) => void; where: string }) {
  return (
    <div>
      <p className="mb-1 text-[14px] font-semibold text-ink">URL de notificaciones (webhook)</p>
      <div className="flex gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2 text-[13px]">{url}</code>
        <button type="button" onClick={() => onCopy(url)} className="btn btn-ghost !min-h-10 !px-3 !text-sm">
          <Copy size={15} /> Copiar
        </button>
      </div>
      <p className="mt-1 text-[12px] text-muted">Pégala en {where}. Así el pago queda confirmado aunque la familia cierre la página.</p>
    </div>
  )
}
