import { FileDown, Search } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { dateTime } from '@/shared/format'
import { useQuery } from '@/shared/useQuery'
import { PageHead } from '../../ui'
import { api2, qs, useSetup } from '../../v2/api'
import { Badge, CourseSelect, Empty, ErrorBox, Spinner, Tabs, YearPicker, inputCls, useTab } from '../../v2/kit'

type Portal = 'todos' | 'familia' | 'panel'
type Presence = { portal: 'familia' | 'panel'; userId: string; name: string | null; role: string | null; lastSeen: string; lastLogin: string | null; logins: number; ip: string | null; device: string | null; online: number; course: string | null }
type AccessEvent = { id: number; portal: 'familia' | 'panel'; userId: string; name: string | null; role: string | null; event: 'ingreso' | 'salida' | 'fallido'; ip: string | null; device: string | null; at: string }
type BoletinRow = { id: number; name: string; course: string | null; total: number; views: number; downloads: number; shared: number; firstSeen: string | null; lastSeen: string | null }
type BoletinEvent = { id: number; studentId: number; student: string; course: string | null; periodName: string | null; viewer: 'familia' | 'personal'; viewerName: string | null; action: string; device: string | null; at: string }

const ROLE: Record<string, string> = { admin: 'Administración', rectora: 'Rectora', docente: 'Docente', auxiliar: 'Auxiliar', personalizado: 'Personalizado', familia: 'Familia' }
const ACTION: Record<string, string> = { ver: 'Lo abrió', descargar: 'Descargó el PDF', compartir: 'Lo compartió', imprimir: 'Lo imprimió' }

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
  const { data, error, loading, reload } = useQuery(`presence:${portal}:${role}:${q}:${online}`, () =>
    api2.get<{ users: Presence[]; counts: { familiaOnline: number; panelOnline: number; familias: number; panel: number; familiasNunca: number }; roles: string[]; onlineMinutes: number }>('/audit/presence' + qs({ portal, role: portal === 'panel' ? role || null : null, q: q.trim() || null, online: online ? 1 : null })),
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
      {error ? (
        <ErrorBox message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Spinner />
      ) : !data?.users.length ? (
        <Empty title="Sin registros con ese filtro">Las conexiones se registran desde que se activó la auditoría.</Empty>
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
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const { data, error, loading, reload } = useQuery(`access:${portal}:${event}:${q}:${from}:${to}`, () =>
    api2.get<{ events: AccessEvent[] }>('/audit/access' + qs({ portal, event: event || null, q: q.trim() || null, from: from || null, to: to || null })),
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
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Desde" className="min-h-10 rounded-full border border-line bg-white px-3 text-[13px]" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Hasta" className="min-h-10 rounded-full border border-line bg-white px-3 text-[13px]" />
        <SearchBox value={q} onChange={setQ} placeholder="Nombre, usuario o IP…" />
      </div>
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
  const { data, error, loading, reload } = useQuery(`bv:${year}:${period}:${course}:${viewer}`, () =>
    api2.get<{ students: BoletinRow[]; events: BoletinEvent[] }>('/audit/boletines' + qs({ year, period: period || null, course, viewer })),
  )
  const seen = data?.students.filter((s) => s.total > 0).length ?? 0
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
      {error ? (
        <ErrorBox message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Spinner />
      ) : !data ? null : view === 'ninos' ? (
        <>
          <p className="text-[14px] text-muted">
            <b className="text-ink">{seen}</b> de {data.students.length} familias abrieron el boletín{period ? '' : ' (algún periodo)'}. Arriba salen las que aún no lo han visto.
          </p>
          <div className="card overflow-x-auto p-0">
            <table className="w-full min-w-[640px] text-left text-[14px]">
              <thead className="bg-paper text-[12px] font-bold tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-4 py-2.5">Estudiante</th>
                  <th className="px-3 py-2.5">Estado</th>
                  <th className="px-3 py-2.5 text-right">Abierto</th>
                  <th className="px-3 py-2.5 text-right">Descargas</th>
                  <th className="px-3 py-2.5">Primera vez</th>
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
                    <td className="px-3 py-2.5">{s.downloads ? <Badge tone="green">Lo descargó</Badge> : s.views ? <Badge tone="blue">Lo vio</Badge> : <Badge tone="red">No lo ha visto</Badge>}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{s.views}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{s.downloads}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted">{dateTime(s.firstSeen)}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-muted">{dateTime(s.lastSeen)}</td>
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
