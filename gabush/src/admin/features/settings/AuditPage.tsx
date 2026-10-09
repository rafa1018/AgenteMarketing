import { FileDown, Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { dateTime, todayISO } from '@/shared/format'
import { useQuery } from '@/shared/useQuery'
import { toast } from '../../store'
import { PageHead } from '../../ui'
import { api2, qs, useSetup } from '../../v2/api'
import { Badge, CourseSelect, Empty, ErrorBox, Spinner, Tabs, YearPicker, inputCls, useTab } from '../../v2/kit'

type Portal = 'todos' | 'familia' | 'panel'
type Presence = { portal: 'familia' | 'panel'; userId: string; name: string | null; role: string | null; lastSeen: string; lastLogin: string | null; logins: number; ip: string | null; device: string | null; online: number; course: string | null }
type AccessEvent = { id: number; portal: 'familia' | 'panel'; userId: string; name: string | null; role: string | null; event: 'ingreso' | 'salida' | 'fallido'; ip: string | null; device: string | null; at: string }
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

const PortalBadge = ({ p }: { p: 'familia' | 'panel' }) => <Badge tone={p === 'familia' ? 'blue' : 'gray'}>{p === 'familia' ? 'Familias' : 'Panel'}</Badge>

export function AuditPage() {
  const [tab, setTab] = useTab<'conexiones' | 'ingresos' | 'boletines'>('conexiones')
  return (
    <div className="space-y-5">
      <PageHead title="Auditoría de accesos" sub="Quién está en línea, cuándo entró cada persona y quién vio o descargó los boletines." actions={tab === 'boletines' ? <YearPicker /> : undefined} />
      <Tabs tabs={[{ id: 'conexiones', label: 'En línea y conexiones' }, { id: 'ingresos', label: 'Historial de ingresos' }, { id: 'boletines', label: 'Boletines vistos' }]} value={tab} onChange={setTab} />
      {tab === 'conexiones' && <PresenceTab />}
      {tab === 'ingresos' && <AccessTab />}
      {tab === 'boletines' && <BoletinesTab />}
    </div>
  )
}

function PresenceTab() {
  const [portal, setPortal] = useState<Portal>('todos')
  const [role, setRole] = useState('')
  const [q, setQ] = useState('')
  const [online, setOnline] = useState(false)
  const [range, setRange] = useState<Range>({ from: today(), to: today() })
  const { data, error, loading, reload } = useQuery(`presence:${portal}:${role}:${q}:${online}:${range.from}:${range.to}`, () =>
    api2.get<{ users: Presence[]; counts: { familiaOnline: number; panelOnline: number; familias: number; panel: number; familiasNunca: number }; roles: string[]; onlineMinutes: number }>('/audit/presence' + qs({ portal, role: portal === 'panel' ? role || null : null, q: q.trim() || null, online: online ? 1 : null, from: range.from || null, to: range.to || null })),
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
        {portal === 'panel' && (
          <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Rol" className="min-h-10 rounded-full border border-line bg-white px-3 text-[13px] font-semibold">
            <option value="">Todos los roles</option>
            {data?.roles.map((r) => <option key={r} value={r}>{ROLE[r] ?? r}</option>)}
          </select>
        )}
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
  const [range, setRange] = useState<Range>({ from: today(), to: today() })
  const { data, error, loading, reload } = useQuery(`access:${portal}:${event}:${q}:${range.from}:${range.to}`, () =>
    api2.get<{ events: AccessEvent[] }>('/audit/access' + qs({ portal, event: event || null, q: q.trim() || null, from: range.from || null, to: range.to || null })),
  )
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <PortalFilter value={portal} onChange={setPortal} />
        <select value={event} onChange={(e) => setEvent(e.target.value)} aria-label="Evento" className="min-h-10 rounded-full border border-line bg-white px-3 text-[13px] font-semibold">
          <option value="">Todos los eventos</option>
          <option value="ingreso">Ingresos</option>
          <option value="salida">Salidas</option>
          <option value="fallido">Intentos fallidos</option>
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
              <Badge tone={e.event === 'ingreso' ? 'green' : e.event === 'fallido' ? 'red' : 'gray'}>{e.event === 'ingreso' ? 'Ingresó' : e.event === 'fallido' ? 'Intento fallido' : 'Salió'}</Badge>
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
  const { data, error, loading, reload } = useQuery(`bv:${year}:${period}:${course}:${viewer}:${range.from}:${range.to}`, () =>
    api2.get<{ students: BoletinRow[]; events: BoletinEvent[] }>('/audit/boletines' + qs({ year, period: period || null, course, viewer, from: range.from || null, to: range.to || null })),
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
