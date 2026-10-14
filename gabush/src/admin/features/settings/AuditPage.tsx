import { FileDown, Loader2, RotateCw, Search, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { dateTime, money, todayISO } from '@/shared/format'
import { openStudent } from '../students/openStudent'
import { useQuery } from '@/shared/useQuery'
import { toast } from '../../store'
import { PageHead } from '../../ui'
import { api2, qs, useSetup } from '../../v2/api'
import { Badge, CourseSelect, Empty, ErrorBox, Spinner, Tabs, YearPicker, inputCls, useTab } from '../../v2/kit'

type Portal = 'todos' | 'familia' | 'panel'
type Presence = { portal: 'familia' | 'panel'; userId: string; name: string | null; role: string | null; lastSeen: string; lastLogin: string | null; logins: number; ip: string | null; device: string | null; online: number; course: string | null }
type AccessEvent = { id: number; portal: 'familia' | 'panel'; userId: string; name: string | null; role: string | null; event: 'ingreso' | 'salida' | 'fallido' | 'inactividad'; ip: string | null; device: string | null; at: string }
type PeriodCount = { views: number; downloads: number; shared: number; last: string }
type BoletinRow = { id: number; name: string; course: string | null; total: number; views: number; downloads: number; shared: number; firstSeen: string | null; lastSeen: string | null; byPeriod: Record<string, PeriodCount> }
type BoletinEvent = { id: number; studentId: number; student: string; course: string | null; periodName: string | null; viewer: 'familia' | 'personal'; viewerName: string | null; action: string; device: string | null; at: string }

const ROLE: Record<string, string> = { admin: 'Administración', rectora: 'Rectora', docente: 'Docente', auxiliar: 'Auxiliar', personalizado: 'Personalizado', familia: 'Familia' }
const ACTION: Record<string, string> = { ver: 'Lo abrió', descargar: 'Descargó el PDF', compartir: 'Lo compartió', imprimir: 'Lo imprimió' }

/** Date range of the lists: starts on today; quick buttons for the usual ranges. */
type Range = { from: string; to: string }
const today = () => todayISO()
const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}
function RangeFilter({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const presets: [string, Range][] = [
    ['Hoy', { from: today(), to: today() }],
    ['7 días', { from: daysAgo(6), to: today() }],
    ['Este mes', { from: today().slice(0, 8) + '01', to: today() }],
    ['Todo', { from: '', to: '' }],
  ]
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {presets.map(([label, r]) => (
        <button key={label} type="button" onClick={() => onChange(r)} className={cn('rounded-full px-3 py-1.5 text-[13px] font-semibold ring-1 ring-line', value.from === r.from && value.to === r.to ? 'bg-ink text-white ring-ink' : 'bg-white text-muted hover:text-ink')}>
          {label}
        </button>
      ))}
      <input type="date" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} aria-label="Desde" className="min-h-9 rounded-full border border-line bg-white px-3 text-[13px]" />
      <span className="text-muted">a</span>
      <input type="date" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} aria-label="Hasta" className="min-h-9 rounded-full border border-line bg-white px-3 text-[13px]" />
    </div>
  )
}

/** Trash button that asks first. */
function DeleteButton({ what, onDelete }: { what: string; onDelete: () => Promise<unknown> }) {
  const [ask, setAsk] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!ask)
    return (
      <button type="button" title={`Eliminar ${what}`} aria-label={`Eliminar ${what}`} onClick={() => setAsk(true)} className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-[#fdf0ef] hover:text-berry">
        <Trash2 size={15} />
      </button>
    )
  return (
    <span className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          await onDelete().catch(() => toast('No se pudo eliminar'))
          setBusy(false)
          setAsk(false)
        }}
        className="rounded-full bg-berry px-2.5 py-1 text-[12px] font-bold text-white"
      >
        Eliminar
      </button>
      <button type="button" onClick={() => setAsk(false)} className="rounded-full px-2 py-1 text-[12px] font-semibold text-muted">
        No
      </button>
    </span>
  )
}

/** Families / panel switch shared by the tabs. */
function PortalFilter({ value, onChange }: { value: Portal; onChange: (p: Portal) => void }) {
  return (
    <div role="radiogroup" aria-label="Portal" className="inline-flex rounded-full bg-white p-1 ring-1 ring-line">
      {([['todos', 'Todos'], ['familia', 'Portal familias'], ['panel', 'Panel administrativo']] as const).map(([id, label]) => (
        <button key={id} type="button" role="radio" aria-checked={value === id} onClick={() => onChange(id)} className={cn('rounded-full px-3.5 py-1.5 text-[13px] font-semibold', value === id ? 'bg-ink text-white' : 'text-muted hover:text-ink')}>
          {label}
        </button>
      ))}
    </div>
  )
}

/** Type of user: staff roles or the families; the technical account is hidden unless asked for. */
function RoleFilter({ value, onChange, owner, onOwner }: { value: string; onChange: (r: string) => void; owner: boolean; onOwner: (v: boolean) => void }) {
  return (
    <>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Tipo de usuario" className="min-h-10 rounded-full border border-line bg-white px-3 text-[13px] font-semibold">
        <option value="">Todos los usuarios</option>
        <option value="rectora">Rectora</option>
        <option value="docente">Docentes</option>
        <option value="auxiliar">Auxiliares</option>
        <option value="personalizado">Personalizados</option>
        <option value="familia">Familias</option>
      </select>
      <label className="flex items-center gap-2 text-[13px] font-semibold text-muted" title="Administración Gabush: la cuenta principal / técnica">
        <input type="checkbox" checked={owner} onChange={(e) => onOwner(e.target.checked)} className="size-4 accent-[#3a36a8]" /> Mostrar cuenta técnica
      </label>
    </>
  )
}

const PortalBadge = ({ p }: { p: 'familia' | 'panel' }) => <Badge tone={p === 'familia' ? 'blue' : 'gray'}>{p === 'familia' ? 'Familias' : 'Panel'}</Badge>

export function AuditPage() {
  const [tab, setTab] = useTab<'conexiones' | 'ingresos' | 'boletines' | 'cartera' | 'notificaciones'>('conexiones')
  return (
    <div className="space-y-5">
      <PageHead title="Auditoría" sub="Quién está en línea, cuándo entró cada persona, quién vio los boletines, quién movió dinero en cartera y qué notificaciones se enviaron." actions={tab === 'boletines' ? <YearPicker /> : undefined} />
      <Tabs tabs={[{ id: 'conexiones', label: 'En línea y conexiones' }, { id: 'ingresos', label: 'Historial de ingresos' }, { id: 'boletines', label: 'Boletines vistos' }, { id: 'cartera', label: 'Movimientos de cartera' }, { id: 'notificaciones', label: 'Notificaciones' }]} value={tab} onChange={setTab} />
      {tab === 'conexiones' && <PresenceTab />}
      {tab === 'ingresos' && <AccessTab />}
      {tab === 'boletines' && <BoletinesTab />}
      {tab === 'cartera' && <BillingTab />}
      {tab === 'notificaciones' && <PushTab />}
    </div>
  )
}

type PanelDevice = { id: string; who: string; device: string; since: string | null; lastOk: string | null; lastStatus: number | null; types: string[]; confirmed: string | null }
type FamilyDevice = { id: number; studentId: number; who: string; course: string | null; device: string; since: string; lastOk: string | null; off: string[]; confirmed: string | null }
type NoDevice = { id: number; name: string; course: string | null; lastLogin: string | null; phone: string | null }
type Sent = { id: number; audience: 'panel' | 'familia'; type: string; title: string; body: string | null; url: string | null; studentId: number | null; recipient: string | null; devices: number; delivered: number; failed: number; received: number; opened: number; detail: { who: string; device: string; status: number; receivedAt: string | null; openedAt: string | null; tracked: boolean }[]; at: string }
const PUSH_TYPE: Record<string, string> = {
  inscripciones: 'Inscripciones', pagos: 'Pagos', asistencia: 'Asistencia', cumpleanos: 'Cumpleaños', eventos: 'Eventos', recordatorio: 'Recordatorio de pago',
  pago: 'Pago recibido', cobro: 'Nuevo cobro', mensaje: 'Mensaje', notas: 'Notas', observador: 'Observador', documento: 'Documento', 'pago-en-linea': 'Pago en línea',
  activacion: 'Activación de notificaciones', prueba: 'Prueba al activar',
}
type StaffNoDevice = { id: string; name: string; role: string; lastLogin: string | null; lastTry: { error: string | null; at: string } | null }

/** Who has notifications turned on (staff and families), what was sent and whether it reached a phone. */
function PushTab() {
  const [view, setView] = useState<'dispositivos' | 'enviadas' | 'sin'>('dispositivos')
  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-line sm:inline-flex">
        {([['dispositivos', 'Dispositivos activos'], ['enviadas', 'Enviadas'], ['sin', 'Sin notificaciones']] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setView(id)} className={cn('flex-1 rounded-lg px-3 py-1.5 text-[13px] font-semibold', view === id ? 'bg-ink text-white' : 'text-muted')}>
            {label}
          </button>
        ))}
      </div>
      {view === 'enviadas' ? <PushSent /> : <PushDevices view={view} />}
    </div>
  )
}

function PushDevices({ view }: { view: 'dispositivos' | 'sin' }) {
  const { data, error, loading, reload } = useQuery('push-devices', () => api2.get<{ panel: PanelDevice[]; families: FamilyDevice[]; without: NoDevice[]; staffWithout: StaffNoDevice[] }>('/audit/push/devices'))
  const remove = async (audience: 'panel' | 'familia', id: string | number) => {
    await api2.post('/audit/push/devices/delete', { audience, id })
    toast('Dispositivo quitado: deja de recibir notificaciones hasta que las active de nuevo')
    reload()
  }
  if (error) return <ErrorBox message={error.message} onRetry={reload} />
  if (loading && !data) return <Spinner />
  if (!data) return null
  if (view === 'sin')
    return (
      <>
        <section className="space-y-2">
          <h3 className="text-lg">Personal ({data.staffWithout.length})</h3>
          <p className="text-[14px] text-muted">Usuarios activos del panel sin ningún celular con notificaciones. Se activan en el panel: menú → Notificaciones → «Activar notificaciones aquí». Si lo intentaron y falló, aquí sale el motivo.</p>
          {!data.staffWithout.length ? (
            <Empty title="Todo el personal tiene notificaciones activas" />
          ) : (
            <ul className="card divide-y divide-line p-0">
              {data.staffWithout.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[14px]">
                  <span className="min-w-0 flex-1">
                    <b className="text-ink">{s.name}</b>
                    <span className="text-muted"> · {ROLE[s.role] ?? s.role}</span>
                    {s.lastTry ? (
                      <span className="block text-[12px] text-berry">Lo intentó el {dateTime(s.lastTry.at)} y no se pudo: {(s.lastTry.error ?? '').split(' · ')[0]}</span>
                    ) : (
                      <span className="block text-[12px] text-muted">No hay ningún intento registrado de activarlas</span>
                    )}
                  </span>
                  <span className="text-[13px] text-muted">{s.lastLogin ? `Último ingreso: ${dateTime(s.lastLogin)}` : 'Nunca ha entrado'}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <h3 className="text-lg">Familias ({data.without.length})</h3>
        <p className="text-[14px] text-muted">
          <b className="text-ink">{data.without.length}</b> estudiantes activos sin ningún celular con notificaciones. Sus familias solo ven las novedades al abrir el app (y el correo, si tienen). Para activarlas: abrir el app de familias → «Más» → «Mi cuenta» → «Notificaciones en el celular».
        </p>
        {!data.without.length ? (
          <Empty title="Todas las familias tienen notificaciones activas" />
        ) : (
          <ul className="card divide-y divide-line p-0">
            {data.without.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[14px]">
                <span className="min-w-0 flex-1">
                  <button type="button" onClick={() => openStudent(s.id)} className="font-semibold text-ink hover:underline">{s.name}</button>
                  <span className="text-muted"> · {s.course ?? 'Sin curso'}</span>
                </span>
                <span className="text-[13px] text-muted">{s.lastLogin ? `Último ingreso al app: ${dateTime(s.lastLogin)}` : 'Nunca ha entrado al app'}</span>
                {s.phone && (
                  <a href={`https://wa.me/57${s.phone.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent('Hola, desde el app de familias de Gabush pueden activar las notificaciones para enterarse al instante de pagos, notas y novedades. Entren aquí y toquen «Activar notificaciones»: https://gabushkids.com/familia/#/cuenta')}`} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp !min-h-8 !px-3 !text-[12px]">
                    Invitar por WhatsApp
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </>
    )
  // "confirmed" = the device itself said it showed one (the real proof); "lastOk" = only accepted by Google/Apple
  const state = (lastOk: string | null, confirmed: string | null, status?: number | null) =>
    status && (status < 200 || status >= 300) ? (
      <Badge tone="red">Falló la última ({status || 'sin conexión'})</Badge>
    ) : (
      <span className="text-right text-[13px] text-muted">
        {confirmed ? <span className="block text-leaf">Confirmó la última: {dateTime(confirmed)}</span> : <span className="block">Aún no ha confirmado ninguna</span>}
        {lastOk && <span className="block text-[12px]">Última enviada: {dateTime(lastOk)}</span>}
      </span>
    )
  return (
    <>
      <section className="space-y-2">
        <h3 className="text-lg">Personal ({data.panel.length})</h3>
        {!data.panel.length ? (
          <Empty title="Nadie del personal tiene notificaciones activas">Cada persona las activa en su celular desde el panel: menú → Notificaciones.</Empty>
        ) : (
          <ul className="card divide-y divide-line p-0">
            {data.panel.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[14px]">
                <span className="min-w-0 flex-1">
                  <b className="text-ink">{d.who}</b>
                  <span className="text-muted"> · {d.device}{d.since ? ` · desde ${dateTime(d.since)}` : ''}</span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {d.types.map((t) => <Badge key={t} tone="blue">{PUSH_TYPE[t] ?? t}</Badge>)}
                  </span>
                </span>
                {state(d.lastOk, d.confirmed, d.lastStatus)}
                <DeleteButton what="este dispositivo" onDelete={() => remove('panel', d.id)} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-2">
        <h3 className="text-lg">Familias ({data.families.length})</h3>
        {!data.families.length ? (
          <Empty title="Ninguna familia ha activado las notificaciones">Mira la pestaña «Familias sin notificaciones» para invitarlas.</Empty>
        ) : (
          <ul className="card divide-y divide-line p-0">
            {data.families.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[14px]">
                <span className="min-w-0 flex-1">
                  <button type="button" onClick={() => openStudent(d.studentId)} className="font-semibold text-ink hover:underline">{d.who}</button>
                  <span className="text-muted"> · {d.course ?? ''} · {d.device} · desde {dateTime(d.since)}</span>
                  {d.off.length > 0 && <span className="block text-[12px] text-[#8a5716]">Apagó: {d.off.map((t) => PUSH_TYPE[t] ?? t).join(', ')}</span>}
                </span>
                {state(d.lastOk, d.confirmed)}
                <DeleteButton what="este dispositivo" onDelete={() => remove('familia', d.id)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function PushSent() {
  const { year } = useSetup()
  const [audience, setAudience] = useState<'' | 'panel' | 'familia'>('')
  const [type, setType] = useState('')
  const [q, setQ] = useState('')
  const [student, setStudent] = useState<Picked | null>(null)
  const [range, setRange] = useState<Range>({ from: daysAgo(6), to: today() })
  const [open, setOpen] = useState<number | null>(null)
  const [resending, setResending] = useState<number | null>(null)
  const params = { audience: audience || null, type: type || null, q: q.trim() || null, student: student?.id ?? null, from: range.from || null, to: range.to || null }
  const { data, error, loading, reload } = useQuery(`push-sent:${JSON.stringify(params)}`, () => api2.get<{ sent: Sent[]; types: string[] }>('/audit/push/sent' + qs(params)))
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={audience} onChange={(e) => setAudience(e.target.value as '' | 'panel' | 'familia')} aria-label="Para quién" className="min-h-10 rounded-full border border-line bg-white px-3 text-[13px] font-semibold">
          <option value="">Personal y familias</option>
          <option value="panel">Personal</option>
          <option value="familia">Familias</option>
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Tipo" className="min-h-10 rounded-full border border-line bg-white px-3 text-[13px] font-semibold">
          <option value="">Todos los tipos</option>
          {data?.types.map((t) => <option key={t} value={t}>{PUSH_TYPE[t] ?? t}</option>)}
        </select>
        <SearchBox value={q} onChange={setQ} placeholder="Buscar en el título o destinatario…" />
      </div>
      <StudentPicker year={year} value={student} onChange={setStudent} />
      <RangeFilter value={range} onChange={setRange} />
      {error ? (
        <ErrorBox message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Spinner />
      ) : !data?.sent.length ? (
        <Empty title="No se enviaron notificaciones en esas fechas">El registro empezó el 14 de octubre de 2026; lo anterior no quedó guardado.</Empty>
      ) : (
        <ul className="card divide-y divide-line p-0">
          {data.sent.map((s) => (
            <li key={s.id} className="px-4 py-2.5 text-[14px]">
              <button type="button" onClick={() => setOpen(open === s.id ? null : s.id)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-left">
                <Badge tone={s.audience === 'panel' ? 'gray' : 'blue'}>{s.audience === 'panel' ? 'Personal' : 'Familia'}</Badge>
                <span className="min-w-0 flex-1">
                  <b className="text-ink">{s.title}</b>
                  <span className="block text-[13px] text-muted">
                    {PUSH_TYPE[s.type] ?? s.type} · {s.recipient ?? '—'}
                  </span>
                </span>
                {s.type === 'activacion' ? (
                  s.delivered ? <Badge tone="green">Activó · {s.detail[0]?.device ?? ''}</Badge> : <Badge tone="red">No se pudo · {s.detail[0]?.device ?? ''}</Badge>
                ) : s.devices === 0 ? (
                  <Badge tone="yellow">{s.audience === 'familia' ? 'Solo en el app (sin celular activado)' : 'Nadie lo tiene activado'}</Badge>
                ) : s.received > 0 ? (
                  // the device itself confirmed it showed the notification
                  <span className="flex flex-wrap justify-end gap-1">
                    <Badge tone="green">Confirmada en {s.received} de {s.devices}</Badge>
                    {s.opened > 0 && <Badge tone="blue">La tocaron</Badge>}
                  </span>
                ) : s.delivered > 0 && s.detail.some((d) => d.tracked) ? (
                  <Badge tone="yellow">Enviada · sin confirmación del dispositivo</Badge>
                ) : s.delivered > 0 ? (
                  <Badge tone="gray">Enviada (sin seguimiento)</Badge>
                ) : (
                  <Badge tone="red">No se pudo enviar</Badge>
                )}
                <span className="w-36 text-right text-[13px] whitespace-nowrap text-ink">{dateTime(s.at)}</span>
              </button>
              {open === s.id && (
                <div className="mt-2 space-y-1 rounded-xl bg-paper p-3 text-[13px]">
                  <div className="flex flex-wrap items-start gap-2">
                    {s.body && <p className="min-w-0 flex-1 text-text">{s.body}</p>}
                    <button
                      type="button"
                      disabled={resending === s.id}
                      onClick={async () => {
                        setResending(s.id)
                        try {
                          const r = await api2.post<{ delivered: number }>(`/audit/push/sent/${s.id}/resend`)
                          toast(r.delivered ? 'Reenviada. Aparecerá «Confirmada» cuando el dispositivo avise que le llegó.' : 'Se intentó reenviar, pero Google/Apple no la aceptó para ningún dispositivo')
                          reload()
                        } catch (e) {
                          toast(e instanceof Error ? e.message : 'No se pudo reenviar')
                        }
                        setResending(null)
                      }}
                      className="btn btn-ghost ml-auto !min-h-8 !bg-white !px-3 !text-[12px]"
                    >
                      {resending === s.id ? <Loader2 size={14} className="animate-spin" /> : <RotateCw size={14} />} Reenviar
                    </button>
                    <DeleteButton
                      what="este registro"
                      onDelete={async () => {
                        await api2.del(`/audit/push/sent/${s.id}`)
                        toast('Registro eliminado')
                        setOpen(null)
                        reload()
                      }}
                    />
                  </div>
                  {s.detail.map((d, i) => {
                    const sent = d.status >= 200 && d.status < 300
                    return (
                      <p key={i} className={d.receivedAt ? 'text-leaf' : sent ? 'text-[#8a5716]' : 'text-berry'}>
                        {d.who} · {d.device || 'Dispositivo'} ·{' '}
                        {d.receivedAt
                          ? `le llegó el ${dateTime(d.receivedAt)}${d.openedAt ? ` · la tocó el ${dateTime(d.openedAt)}` : ''}`
                          : sent
                            ? d.tracked
                              ? 'Google/Apple la aceptó, pero el dispositivo no ha confirmado que le llegó (apagado, sin internet o ya desinstalado)'
                              : 'Google/Apple la aceptó (envío anterior al seguimiento)'
                            : d.status === 404 || d.status === 410
                              ? 'el dispositivo ya no existe (se quitó de la lista)'
                              : `falló (${d.status || 'sin conexión'})`}
                      </p>
                    )
                  })}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-[12px] text-muted">
        «Confirmada» = el propio celular avisó que la mostró: esa es la prueba de que llegó. «Sin confirmación» = Google/Apple la aceptó pero el dispositivo no ha respondido (apagado, sin internet — le llega cuando se conecte, hasta 24 horas — o ya desinstalado). Los envíos de antes del 14 de octubre no tienen seguimiento.
      </p>
    </div>
  )
}

type BillingEvent = { id: number; at: string; action: string; label: string; actorName: string; actorType: string; studentId: number | null; student: string | null; chargeDescription: string | null; receipt: string | null; amount: number | null; detail: string; ip: string | null }
const GROUPS: [string, string][] = [
  ['cambios', 'Cambios (sin pagos ni cobros normales)'],
  ['anulaciones', 'Anulaciones'],
  ['descuentos', 'Descuentos'],
  ['mora', 'Recargos y mora'],
  ['valores', 'Valores, precios y vencimientos'],
  ['acuerdos', 'Acuerdos de pago'],
  ['pagos', 'Pagos registrados'],
  ['cobros', 'Cobros creados'],
  ['todos', 'Todo'],
]
const toneOf = (a: string): 'red' | 'green' | 'yellow' | 'blue' | 'gray' =>
  a.includes('void') ? 'red' : a.includes('descuento') || a.includes('discount') || a.includes('waive') ? 'green' : a.includes('recargo') || a.includes('late_fee') ? 'yellow' : a.startsWith('payment') ? 'blue' : 'gray'

/** Money movements: who voided, discounted, surcharged, forgave late fees, changed values… and why. */
function BillingTab() {
  const { year } = useSetup()
  const [group, setGroup] = useState('cambios')
  const [actor, setActor] = useState('')
  const [q, setQ] = useState('')
  const [student, setStudent] = useState<Picked | null>(null)
  const [range, setRange] = useState<Range>({ from: today().slice(0, 8) + '01', to: today() })
  const params = { group, actor: actor || null, q: q.trim() || null, student: student?.id ?? null, from: range.from || null, to: range.to || null }
  const { data, error, loading, reload } = useQuery(`audit-billing:${JSON.stringify(params)}`, () => api2.get<{ events: BillingEvent[]; actors: { id: string; name: string }[] }>('/audit/billing' + qs(params)))
  const total = (data?.events ?? []).reduce((s, e) => s + (e.amount ?? 0), 0)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Tipo de movimiento" className="min-h-10 rounded-full border border-line bg-white px-3 text-[13px] font-semibold">
          {GROUPS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <select value={actor} onChange={(e) => setActor(e.target.value)} aria-label="Quién" className="min-h-10 rounded-full border border-line bg-white px-3 text-[13px] font-semibold">
          <option value="">Todas las personas</option>
          {data?.actors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <SearchBox value={q} onChange={setQ} placeholder="Buscar en el motivo, cobro o recibo…" />
        <a href={'/api/v2/audit/billing' + qs({ ...params, format: 'csv' })} className="btn btn-ghost !min-h-10 !text-sm">
          <FileDown size={16} /> Excel
        </a>
      </div>
      <StudentPicker year={year} value={student} onChange={setStudent} />
      <RangeFilter value={range} onChange={setRange} />
      {error ? (
        <ErrorBox message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Spinner />
      ) : !data?.events.length ? (
        <Empty title="Sin movimientos con ese filtro">Cambia las fechas (por ejemplo «Todo») o el tipo de movimiento.</Empty>
      ) : (
        <>
          <p className="text-[14px] text-muted">
            <b className="text-ink">{data.events.length}</b> movimientos{data.events.length >= 1000 ? ' (se muestran los 1.000 más recientes; acota las fechas)' : ''}
            {group !== 'cambios' && group !== 'todos' && total > 0 ? ` · suman ${money(total)}` : ''}
          </p>
          <div className="card overflow-x-auto p-0">
            <table className="w-full min-w-[820px] text-left text-[14px]">
              <thead className="bg-paper text-[12px] font-bold tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-4 py-2.5">Fecha</th>
                  <th className="px-3 py-2.5">Quién</th>
                  <th className="px-3 py-2.5">Acción</th>
                  <th className="px-3 py-2.5">Estudiante</th>
                  <th className="px-3 py-2.5 text-right">Valor</th>
                  <th className="px-4 py-2.5">Motivo / detalle</th>
                </tr>
              </thead>
              <tbody>
                {data.events.map((e) => (
                  <tr key={e.id} className="border-t border-line align-top">
                    <td className="px-4 py-2.5 whitespace-nowrap">{dateTime(e.at)}</td>
                    <td className="px-3 py-2.5">
                      <span className={cn('font-semibold', e.actorType === 'system' ? 'text-muted' : 'text-ink')}>{e.actorName}</span>
                      {e.ip && <span className="block text-[11px] text-muted">{e.ip}</span>}
                    </td>
                    <td className="px-3 py-2.5"><Badge tone={toneOf(e.action)}>{e.label}</Badge></td>
                    <td className="px-3 py-2.5">
                      {e.studentId ? (
                        <button type="button" onClick={() => openStudent(e.studentId!, 'cartera')} className="text-left font-semibold text-royal hover:underline">
                          {e.student}
                        </button>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                      {(e.receipt || e.chargeDescription) && <span className="block text-[12px] text-muted">{e.receipt ? `Recibo ${e.receipt}` : e.chargeDescription}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap tabular-nums">{e.amount !== null ? money(e.amount) : ''}</td>
                    <td className="px-4 py-2.5 text-[13px] text-text">{e.detail || <span className="text-muted">Sin motivo</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[12px] text-muted">Toca el nombre del estudiante para abrir su cartera. Estos registros no se pueden borrar ni editar.</p>
        </>
      )}
    </div>
  )
}

function PresenceTab() {
  const [portal, setPortal] = useState<Portal>('todos')
  const [role, setRole] = useState('')
  const [q, setQ] = useState('')
  const [online, setOnline] = useState(false)
  const [owner, setOwner] = useState(false)
  const [range, setRange] = useState<Range>({ from: today(), to: today() })
  const { data, error, loading, reload } = useQuery(`presence:${portal}:${role}:${q}:${online}:${owner}:${range.from}:${range.to}`, () =>
    api2.get<{ users: Presence[]; counts: { familiaOnline: number; panelOnline: number; familias: number; panel: number; familiasNunca: number }; roles: string[]; onlineMinutes: number }>('/audit/presence' + qs({ portal, role: role || null, q: q.trim() || null, online: online ? 1 : null, owner: owner ? 1 : null, from: range.from || null, to: range.to || null })),
  )
  return (
    <div className="space-y-4">
      {data && (
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Familias en línea" value={data.counts.familiaOnline} tone="text-leaf" />
          <Stat label="Personal en línea" value={data.counts.panelOnline} tone="text-leaf" />
          <Stat label="Familias que han entrado" value={data.counts.familias} />
          <Stat label="Familias que nunca han entrado" value={data.counts.familiasNunca} tone="text-berry" />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <PortalFilter value={portal} onChange={setPortal} />
        <RoleFilter value={role} onChange={setRole} owner={owner} onOwner={setOwner} />
        <label className="flex items-center gap-2 text-[13px] font-semibold text-ink">
          <input type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} className="size-4 accent-[#3f9a1f]" /> Solo en línea
        </label>
        <SearchBox value={q} onChange={setQ} placeholder="Buscar por nombre o curso…" />
      </div>
      <RangeFilter value={range} onChange={setRange} />
      {error ? (
        <ErrorBox message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Spinner />
      ) : !data?.users.length ? (
        <Empty title="Nadie se conectó en esas fechas">Cambia las fechas (por ejemplo «Todo»). Las conexiones se registran desde que se activó la auditoría.</Empty>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-left text-[14px]">
            <thead className="bg-paper text-[12px] font-bold tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-2.5">Usuario</th>
                <th className="px-3 py-2.5">Portal</th>
                <th className="px-3 py-2.5">Última conexión</th>
                <th className="px-3 py-2.5">Último ingreso</th>
                <th className="px-3 py-2.5 text-right">Ingresos</th>
                <th className="px-4 py-2.5">Dispositivo</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={`${u.portal}:${u.userId}`} className="border-t border-line">
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2">
                      <span className={cn('size-2.5 shrink-0 rounded-full', u.online ? 'bg-leaf' : 'bg-line')} title={u.online ? 'En línea' : 'Desconectado'} />
                      <span>
                        <span className="block font-semibold text-ink">{u.name ?? u.userId}</span>
                        <span className="block text-[12px] text-muted">{u.portal === 'familia' ? `Familia${u.course ? ` · ${u.course}` : ''}` : ROLE[u.role ?? ''] ?? u.role}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5"><PortalBadge p={u.portal} /></td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{u.online ? <b className="text-leaf">En línea</b> : dateTime(u.lastSeen)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-muted">{dateTime(u.lastLogin)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{u.logins}</td>
                  <td className="px-4 py-2.5 text-[13px] text-muted">{u.device ?? '—'}</td>
                  <td className="pr-2">
                    <DeleteButton
                      what="este registro de conexión"
                      onDelete={async () => {
                        await api2.post('/audit/presence/delete', { portal: u.portal, userId: u.userId })
                        toast('Registro eliminado')
                        reload()
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-line px-4 py-2 text-[12px] text-muted">«En línea» = usó la plataforma en los últimos {data.onlineMinutes} minutos.</p>
        </div>
      )}
    </div>
  )
}

function AccessTab() {
  const [portal, setPortal] = useState<Portal>('todos')
  const [event, setEvent] = useState('')
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const [owner, setOwner] = useState(false)
  const [range, setRange] = useState<Range>({ from: today(), to: today() })
  const { data, error, loading, reload } = useQuery(`access:${portal}:${event}:${q}:${role}:${owner}:${range.from}:${range.to}`, () =>
    api2.get<{ events: AccessEvent[] }>('/audit/access' + qs({ portal, event: event || null, q: q.trim() || null, role: role || null, owner: owner ? 1 : null, from: range.from || null, to: range.to || null })),
  )
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <PortalFilter value={portal} onChange={setPortal} />
        <RoleFilter value={role} onChange={setRole} owner={owner} onOwner={setOwner} />
        <select value={event} onChange={(e) => setEvent(e.target.value)} aria-label="Evento" className="min-h-10 rounded-full border border-line bg-white px-3 text-[13px] font-semibold">
          <option value="">Todos los eventos</option>
          <option value="ingreso">Ingresos</option>
          <option value="salida">Salidas</option>
          <option value="fallido">Intentos fallidos</option>
          <option value="inactividad">Cerradas por inactividad</option>
        </select>
        <SearchBox value={q} onChange={setQ} placeholder="Nombre, usuario o IP…" />
      </div>
      <RangeFilter value={range} onChange={setRange} />
      {error ? (
        <ErrorBox message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Spinner />
      ) : !data?.events.length ? (
        <Empty title="Sin ingresos con ese filtro" />
      ) : (
        <ul className="card divide-y divide-line p-0">
          {data.events.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[14px]">
              <Badge tone={e.event === 'ingreso' ? 'green' : e.event === 'fallido' ? 'red' : e.event === 'inactividad' ? 'yellow' : 'gray'}>
                {e.event === 'ingreso' ? 'Ingresó' : e.event === 'fallido' ? 'Intento fallido' : e.event === 'inactividad' ? 'Cerró por inactividad' : 'Salió'}
              </Badge>
              <span className="min-w-0 flex-1">
                <b className="text-ink">{e.name ?? e.userId}</b>
                <span className="text-muted"> · {e.portal === 'familia' ? 'Portal familias' : ROLE[e.role ?? ''] ?? 'Panel'}</span>
              </span>
              <span className="text-[13px] text-muted">{e.device ?? ''}{e.ip ? ` · ${e.ip}` : ''}</span>
              <span className="w-36 text-right text-[13px] whitespace-nowrap text-ink">{dateTime(e.at)}</span>
              <DeleteButton
                what="este ingreso"
                onDelete={async () => {
                  await api2.del(`/audit/access/${e.id}`)
                  toast('Registro eliminado')
                  reload()
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function BoletinesTab() {
  const { setup, year } = useSetup()
  const [period, setPeriod] = useState('')
  const [course, setCourse] = useState<number | null>(null)
  const [viewer, setViewer] = useState<'familia' | 'personal' | 'todos'>('familia')
  const [view, setView] = useState<'ninos' | 'detalle'>('ninos')
  const [range, setRange] = useState<Range>({ from: today(), to: today() })
  const [student, setStudent] = useState<Picked | null>(null)
  const { data, error, loading, reload } = useQuery(`bv:${year}:${period}:${course}:${viewer}:${range.from}:${range.to}:${student?.id ?? ''}`, () =>
    api2.get<{ students: BoletinRow[]; events: BoletinEvent[] }>('/audit/boletines' + qs({ year, period: period || null, course, viewer, from: range.from || null, to: range.to || null, student: student?.id ?? null })),
  )
  const seen = data?.students.filter((s) => s.total > 0).length ?? 0
  // one column per report card: Periodo 1…4 and the final one (or just the chosen period)
  const columns = [...(setup?.periods ?? []).map((p) => ({ key: String(p.id), label: `P${p.number}`, name: p.name })), { key: 'final', label: 'Final', name: 'Informe final' }].filter((c) => !period || c.key === period)
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Periodo" className={inputCls()}>
          <option value="">Todos los periodos</option>
          {setup?.periods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          <option value="final">Informe final</option>
        </select>
        <CourseSelect value={course} onChange={setCourse} />
        <div className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-line">
          {([['ninos', 'Por niño'], ['detalle', 'Historial']] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setView(id)} className={cn('flex-1 rounded-lg px-3 text-[13px] font-semibold', view === id ? 'bg-ink text-white' : 'text-muted')}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <StudentPicker year={year} value={student} onChange={setStudent} />
      <RangeFilter value={range} onChange={setRange} />
      {error ? (
        <ErrorBox message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Spinner />
      ) : !data ? null : view === 'ninos' ? (
        <>
          <p className="text-[14px] text-muted">
            <b className="text-ink">{seen}</b> de {data.students.length} familias abrieron {period ? 'ese boletín' : 'algún boletín'} en las fechas elegidas. Arriba salen las que no lo han abierto. En cada periodo: 👁 veces que lo abrió · ⬇ veces que lo descargó.
          </p>
          <div className="card overflow-x-auto p-0">
            <table className="w-full min-w-[640px] text-left text-[14px]">
              <thead className="bg-paper text-[12px] font-bold tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-4 py-2.5">Estudiante</th>
                  {columns.map((c) => (
                    <th key={c.key} title={c.name} className="px-2 py-2.5 text-center">{c.label}</th>
                  ))}
                  <th className="px-4 py-2.5">Última vez</th>
                </tr>
              </thead>
              <tbody>
                {data.students.map((s) => (
                  <tr key={s.id} className="border-t border-line">
                    <td className="px-4 py-2.5">
                      <span className="block font-semibold text-ink">{s.name}</span>
                      <span className="block text-[12px] text-muted">{s.course}</span>
                    </td>
                    {columns.map((c) => {
                      const x = s.byPeriod?.[c.key]
                      return (
                        <td key={c.key} className="px-2 py-2.5 text-center">
                          {!x ? (
                            <span className="text-[12px] font-semibold text-berry/70" title={`No ha abierto ${c.name}`}>—</span>
                          ) : (
                            <span title={`${c.name}: abierto ${x.views} vez/veces, descargado ${x.downloads}, última vez ${dateTime(x.last)}`} className={cn('inline-flex flex-col items-center rounded-lg px-2 py-1 text-[12px] font-bold leading-tight tabular-nums', x.downloads ? 'bg-[#e9f4ee] text-leaf' : 'bg-[#eaf3fa] text-[#185a8a]')}>
                              <span>👁 {x.views}</span>
                              {x.downloads > 0 && <span>⬇ {x.downloads}</span>}
                            </span>
                          )}
                        </td>
                      )
                    })}
                    <td className="px-4 py-2.5 whitespace-nowrap text-muted">{s.total ? dateTime(s.lastSeen) : <Badge tone="red">No lo ha visto</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {([['familia', 'Familias'], ['personal', 'Personal'], ['todos', 'Todos']] as const).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setViewer(id)} className={cn('rounded-full px-3.5 py-1.5 text-[13px] font-semibold ring-1 ring-line', viewer === id ? 'bg-ink text-white' : 'bg-white text-muted')}>
                {label}
              </button>
            ))}
          </div>
          {!data.events.length ? (
            <Empty title="Nadie ha abierto boletines con ese filtro" />
          ) : (
            <ul className="card divide-y divide-line p-0">
              {data.events.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[14px]">
                  <FileDown size={16} className={e.action === 'descargar' ? 'text-leaf' : 'text-muted'} />
                  <span className="min-w-0 flex-1">
                    <b className="text-ink">{e.student}</b>
                    <span className="text-muted"> · {e.course} · {e.periodName}</span>
                    <span className="block text-[13px] text-muted">
                      {ACTION[e.action] ?? e.action} · {e.viewerName ?? (e.viewer === 'familia' ? 'Familia' : 'Personal')}
                      {e.device ? ` · ${e.device}` : ''}
                    </span>
                  </span>
                  <span className="text-[13px] whitespace-nowrap text-ink">{dateTime(e.at)}</span>
                  <DeleteButton
                    what="este registro"
                    onDelete={async () => {
                      await api2.del(`/audit/boletines/${e.id}`)
                      toast('Registro eliminado')
                      reload()
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

type Picked = { id: number; name: string; course: string | null }

/**
 * Search box with suggestions (autocomplete): type 2+ letters of the name, code or document and pick the child.
 * Once picked it shows as a chip with ✕ to clear the filter.
 */
function StudentPicker({ year, value, onChange }: { year: number | null; value: Picked | null; onChange: (s: Picked | null) => void }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const term = q.trim()
  const { data, loading } = useQuery(term.length >= 2 ? `pick:${year}:${term}` : null, () =>
    api2.get<{ students: { id: number; firstName: string; lastName: string; secondLastName: string | null; course: string | null; code: string }[] }>('/students' + qs({ year, q: term })),
  )
  const options = (data?.students ?? []).slice(0, 8).map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName} ${s.secondLastName ?? ''}`.trim(), course: s.course, code: s.code }))
  const pick = (o: Picked) => {
    onChange(o)
    setQ('')
    setOpen(false)
  }
  if (value)
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#eeedfb] py-1.5 pr-1.5 pl-3.5 text-[14px] font-semibold text-royal">
          Estudiante: {value.name}
          {value.course && <span className="font-normal text-muted">· {value.course}</span>}
          <button type="button" aria-label="Quitar filtro de estudiante" onClick={() => onChange(null)} className="grid size-6 place-items-center rounded-full hover:bg-white">
            <X size={14} />
          </button>
        </span>
      </div>
    )
  return (
    <div className="relative">
      <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!options.length) return
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, options.length - 1)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
          if (e.key === 'Enter') { e.preventDefault(); pick(options[active]) }
          if (e.key === 'Escape') setOpen(false)
        }}
        role="combobox"
        aria-expanded={open && term.length >= 2}
        aria-autocomplete="list"
        aria-label="Filtrar por estudiante"
        placeholder="Filtrar por estudiante: escribe su nombre, código o documento…"
        className="min-h-11 w-full rounded-xl border border-line bg-white pr-3 pl-10 text-[14px]"
      />
      {open && term.length >= 2 && (
        <ul role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-line bg-white p-1 shadow-lg">
          {loading && !data ? (
            <li className="px-3 py-2 text-sm text-muted">Buscando…</li>
          ) : !options.length ? (
            <li className="px-3 py-2 text-sm text-muted">Ningún estudiante con «{term}».</li>
          ) : (
            options.map((o, i) => (
              <li key={o.id} role="option" aria-selected={i === active}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o)} onMouseEnter={() => setActive(i)} className={cn('flex w-full items-baseline gap-2 rounded-lg px-3 py-2 text-left', i === active && 'bg-paper')}>
                  <span className="font-semibold text-ink">{o.name}</span>
                  <span className="text-[12px] text-muted">{[o.course, o.code].filter(Boolean).join(' · ')}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="card p-4">
      <p className="text-[12px] font-bold tracking-wide text-muted uppercase">{label}</p>
      <p className={cn('font-serif text-[1.8rem] font-semibold text-ink', tone)}>{value}</p>
    </div>
  )
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative min-w-[200px] flex-1">
      <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label="Buscar" className="min-h-10 w-full rounded-full border border-line bg-white pr-3 pl-9 text-[14px]" />
    </label>
  )
}
