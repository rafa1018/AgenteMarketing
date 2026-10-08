import { Mail, RotateCcw, Save, Send } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@/shared/useQuery'
import { dateTime } from '@/shared/format'
import { toast } from '../../store'
import { PageHead } from '../../ui'
import { api2 } from '../../v2/api'
import { Badge, ErrorBox, Field, Spinner, StatusBadge, inputCls } from '../../v2/kit'

type Account = { enabled: boolean; host: string; port: number; security: 'ssl' | 'tls' | 'none'; username: string; fromEmail: string; fromName: string; hasPassword: boolean }
type Template = { id: number; key: string; name: string; subject: string; body: string; active: boolean; updatedAt: string }
type EmailData = { account: Account; templates: Template[]; outbox: { id: number; toEmail: string; subject: string; template: string | null; status: string; attempts: number; lastError: string | null; createdAt: string; sentAt: string | null }[]; stats: { pending: number; sent: number; failed: number } }

const PRESETS: { label: string; host: string; port: number; security: Account['security']; hint: string }[] = [
  { label: 'Gmail', host: 'smtp.gmail.com', port: 465, security: 'ssl', hint: 'Usa una "contraseña de aplicación" de Google (no la normal): cuenta de Google → Seguridad → Verificación en 2 pasos → Contraseñas de aplicaciones.' },
  { label: 'Hostinger', host: 'smtp.hostinger.com', port: 465, security: 'ssl', hint: 'Crea el buzón en hPanel → Correos (ej. notificaciones@gabushkids.com) y usa su contraseña.' },
  { label: 'Outlook / Hotmail', host: 'smtp-mail.outlook.com', port: 587, security: 'tls', hint: 'Usa el correo y la contraseña (o contraseña de aplicación si tienes verificación en 2 pasos).' },
]
const VARS = ['{{acudiente}}', '{{estudiante}}', '{{codigo}}', '{{valor}}', '{{concepto}}', '{{fecha}}', '{{saldo}}', '{{comprobante}}', '{{detalle}}', '{{boton}}', '{{jardin}}', '{{usuario}}', '{{clave}}', '{{asunto}}', '{{mensaje}}', '{{pasarela}}']

/** E-mail account used to notify families + editable templates. */
export function EmailSettingsPage() {
  const { data, error, loading, reload, setData } = useQuery('email', () => api2.get<EmailData>('/email'))
  const [acc, setAcc] = useState<Account & { password: string }>()
  const [tpl, setTpl] = useState<string>('payment_receipt')
  const [draft, setDraft] = useState<Template | null>(null)
  const [testTo, setTestTo] = useState('')
  const m = useMutation()
  useEffect(() => {
    if (data) setAcc({ ...data.account, password: '' })
  }, [data])
  useEffect(() => {
    const t = data?.templates.find((x) => x.key === tpl)
    if (t) setDraft(t)
  }, [data, tpl])
  if (error) return <ErrorBox message={error.message} onRetry={reload} />
  if (loading || !data || !acc) return <Spinner />
  const preset = PRESETS.find((p) => p.host === acc.host)
  return (
    <div className="space-y-5">
      <PageHead title="Correo" sub="La cuenta desde la que Gabush envía comprobantes, recordatorios de pago, mensajes y accesos al portal." />
      <section className="card space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="flex items-center gap-2 text-lg">
            <Mail size={19} className="text-royal" /> Cuenta de envío
          </h3>
          {data.account.enabled ? <Badge tone="green">Activa</Badge> : <Badge>Apagada</Badge>}
          <span className="ml-auto text-sm text-muted">
            Enviados {data.stats.sent ?? 0} · pendientes {data.stats.pending ?? 0} · con error {data.stats.failed ?? 0}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button key={p.label} type="button" onClick={() => setAcc({ ...acc, host: p.host, port: p.port, security: p.security })} className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${acc.host === p.host ? 'bg-ink text-white' : 'bg-paper text-ink'}`}>
              {p.label}
            </button>
          ))}
        </div>
        {preset?.label === 'Gmail' ? (
          <div className="rounded-xl bg-[#eaf3fa] px-4 py-3 text-[14px] text-[#185a8a]">
            <p className="font-semibold">Gmail no acepta tu contraseña normal. Crea una «contraseña de aplicación» (una sola vez):</p>
            <ol className="mt-1.5 list-decimal space-y-0.5 pl-5">
              <li>Activa la verificación en 2 pasos de tu cuenta de Google, si no la tienes.</li>
              <li>
                Abre{' '}
                <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener" className="font-semibold underline">
                  myaccount.google.com/apppasswords
                </a>
                , escribe «Gabush» y toca Crear.
              </li>
              <li>Copia la clave de 16 letras que te muestra y pégala abajo en Contraseña.</li>
              <li>En «Correo de envío» y «Usuario» pon tu dirección de Gmail. Guarda y envía una prueba.</li>
            </ol>
            <p className="mt-1.5 text-[13px]">Gmail permite unos 500 correos al día: suficiente para el jardín.</p>
          </div>
        ) : (
          preset && <p className="rounded-xl bg-[#eaf3fa] px-4 py-3 text-[14px] text-[#185a8a]">{preset.hint}</p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Correo de envío" error={m.fields.fromEmail}>
            <input type="email" value={acc.fromEmail} onChange={(e) => setAcc({ ...acc, fromEmail: e.target.value, username: acc.username || e.target.value })} className={inputCls(m.fields.fromEmail)} placeholder="notificaciones@gabushkids.com" />
          </Field>
          <Field label="Nombre que ven las familias">
            <input value={acc.fromName} onChange={(e) => setAcc({ ...acc, fromName: e.target.value })} className={inputCls()} />
          </Field>
          <Field label="Usuario (normalmente el mismo correo)">
            <input value={acc.username} onChange={(e) => setAcc({ ...acc, username: e.target.value })} className={inputCls()} autoComplete="off" />
          </Field>
          <Field label="Contraseña" hint={data.account.hasPassword ? 'Guardada. Déjala vacía para no cambiarla.' : undefined}>
            <input type="password" value={acc.password} onChange={(e) => setAcc({ ...acc, password: e.target.value })} className={inputCls()} autoComplete="new-password" placeholder={data.account.hasPassword ? '••••••••' : ''} />
          </Field>
          <Field label="Servidor SMTP" error={m.fields.host}>
            <input value={acc.host} onChange={(e) => setAcc({ ...acc, host: e.target.value })} className={inputCls(m.fields.host)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Puerto">
              <input type="number" value={acc.port} onChange={(e) => setAcc({ ...acc, port: Number(e.target.value) })} className={inputCls()} />
            </Field>
            <Field label="Seguridad">
              <select value={acc.security} onChange={(e) => setAcc({ ...acc, security: e.target.value as Account['security'] })} className={inputCls()}>
                <option value="ssl">SSL</option>
                <option value="tls">TLS (STARTTLS)</option>
                <option value="none">Ninguna</option>
              </select>
            </Field>
          </div>
        </div>
        <label className="flex items-center gap-2 text-[15px] font-semibold text-ink">
          <input type="checkbox" checked={acc.enabled} onChange={(e) => setAcc({ ...acc, enabled: e.target.checked })} className="size-5 accent-[#3a36a8]" /> Enviar correos a las familias
        </label>
        {m.message && <ErrorBox message={m.message} />}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={m.busy} onClick={async () => { const r = await m.run(() => api2.put<{ account: Account }>('/email/account', { ...acc, password: acc.host === 'smtp.gmail.com' ? acc.password.replace(/\s+/g, '') : acc.password })); if (r) { toast('Cuenta de correo guardada'); setData({ ...data, account: r.account }) } }} className="btn btn-primary !text-sm">
            <Save size={17} /> Guardar
          </button>
          <input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="Enviar prueba a…" className="min-h-10 rounded-lg border border-line px-3" />
          <button type="button" disabled={m.busy || !testTo} onClick={async () => { if (await m.run(() => api2.post('/email/test', { to: testTo }))) toast(`Correo de prueba enviado a ${testTo}`) }} className="btn btn-ghost !min-h-10 !text-sm">
            <Send size={16} /> Probar
          </button>
        </div>
      </section>

      <section className="card space-y-4 p-4 sm:p-6">
        <h3 className="text-lg">Plantillas</h3>
        <div className="flex flex-wrap gap-1.5">
          {data.templates.map((t) => (
            <button key={t.key} type="button" onClick={() => setTpl(t.key)} className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${tpl === t.key ? 'bg-ink text-white' : 'bg-paper text-ink'} ${t.active ? '' : 'opacity-60'}`}>
              {t.name}
            </button>
          ))}
        </div>
        {draft && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <Field label="Asunto">
                <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} className={inputCls()} />
              </Field>
              <Field label="Mensaje (HTML sencillo: <p>, <b>, <br>)">
                <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={11} className={inputCls() + ' font-mono text-[13px]'} />
              </Field>
              <p className="text-[12px] text-muted">Variables: {VARS.join(' ')}</p>
              <label className="flex items-center gap-2 font-semibold text-ink">
                <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} className="size-5 accent-[#3a36a8]" /> Enviar este correo
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={m.busy} onClick={async () => { const r = await m.run(() => api2.put<{ templates: Template[] }>(`/email/templates/${draft.key}`, draft)); if (r) { toast('Plantilla guardada'); setData({ ...data, templates: r.templates }) } }} className="btn btn-primary !text-sm">
                  <Save size={17} /> Guardar plantilla
                </button>
                <button type="button" onClick={async () => { const r = await api2.post<{ templates: Template[] }>(`/email/templates/${draft.key}/reset`).catch(() => null); if (r) { setData({ ...data, templates: r.templates }); toast('Plantilla restaurada') } }} className="btn btn-ghost !text-sm">
                  <RotateCcw size={16} /> Restaurar original
                </button>
                {testTo && (
                  <button type="button" onClick={async () => { if (await m.run(() => api2.post('/email/test', { to: testTo, template: draft.key }))) toast('Ejemplo enviado') }} className="btn btn-ghost !text-sm">
                    <Send size={16} /> Enviarme un ejemplo
                  </button>
                )}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[14px] font-semibold text-ink">Vista previa</p>
              <div className="rounded-xl border border-line bg-[#f2f8ff] p-3">
                <p className="mb-2 text-[13px] text-muted">Asunto: {draft.subject}</p>
                <div className="rounded-lg bg-white p-4 text-[14px] leading-relaxed [&_p]:mb-2" dangerouslySetInnerHTML={{ __html: draft.body.replace(/\{\{\s*boton\s*\}\}/g, '<span style="display:inline-block;background:#23206b;color:#fff;padding:8px 16px;border-radius:999px">Botón</span>').replace(/\{\{\s*(\w+)\s*\}\}/g, '<mark>$1</mark>').replace(/<script[\s\S]*?<\/script>/gi, '') }} />
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="card overflow-hidden p-0">
        <h3 className="border-b border-line px-4 py-3 text-lg">Últimos envíos</h3>
        {!data.outbox.length ? (
          <p className="px-4 py-6 text-sm text-muted">Todavía no se ha enviado nada.</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.outbox.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-[14px]">
                <span className="min-w-0 flex-1 truncate">
                  <b className="text-ink">{o.toEmail}</b> · {o.subject}
                </span>
                <span className="text-[12px] text-muted">{dateTime(o.sentAt ?? o.createdAt)}</span>
                <StatusBadge status={o.status === 'enviado' ? 'aprobado' : o.status === 'error' ? 'rechazado' : 'pendiente'} />
                {o.lastError && <span className="w-full text-[12px] text-berry">{o.lastError}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
