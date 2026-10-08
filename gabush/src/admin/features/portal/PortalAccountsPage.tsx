import { KeyRound, Printer, Smartphone, UserCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@/shared/useQuery'
import { dateTime } from '@/shared/format'
import { toast } from '../../store'
import { PageHead } from '../../ui'
import { api2, qs, useSetup } from '../../v2/api'
import { Badge, ErrorBox, SearchBox, Spinner, Stat, YearPicker } from '../../v2/kit'
import { openStudent } from '../students/openStudent'

type Account = { id: number; code: string; firstName: string; lastName: string; course: string | null; status: string; active: number | null; mustChange: number | null; lastLogin: string | null; createdAt: string | null; devices: number; emails: number }
type Cred = { studentId: number; username: string; password: string; student: string; emailed: boolean }

/** Family portal accounts: who has access, who already entered, devices with notifications; create in bulk. */
export function PortalAccountsPage() {
  const { year } = useSetup()
  const { data, error, loading, reload } = useQuery(year ? `portal:${year}` : null, () => api2.get<{ accounts: Account[] }>('/portal-accounts' + qs({ year })))
  const [q, setQ] = useState('')
  const [creds, setCreds] = useState<Cred[]>([])
  const m = useMutation()
  const rows = useMemo(() => (data?.accounts ?? []).filter((a) => !q || `${a.firstName} ${a.lastName} ${a.code} ${a.course}`.toLowerCase().includes(q.toLowerCase())), [data, q])
  const stats = useMemo(() => {
    const a = data?.accounts ?? []
    return { total: a.length, with: a.filter((x) => x.active).length, entered: a.filter((x) => x.lastLogin).length, devices: a.filter((x) => x.devices > 0).length }
  }, [data])
  const issueAll = async (sendEmail: boolean) => {
    const r = await m.run(() => api2.post<{ credentials: Cred[] }>('/portal-accounts/issue', { all: true, onlyMissing: true, sendEmail }))
    if (r) {
      setCreds(r.credentials)
      toast(`Se crearon ${r.credentials.length} accesos`)
      reload()
    }
  }
  return (
    <div className="space-y-5">
      <PageHead title="Portal de familias" sub="Cada estudiante activo tiene su usuario (el código GAB) para que la familia vea notas, asistencia, mensajes y pague en línea." actions={<YearPicker />} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Estudiantes" value={stats.total} />
        <Stat label="Con acceso" value={stats.with} tone="blue" icon={<KeyRound size={18} />} />
        <Stat label="Ya entraron" value={stats.entered} tone="green" icon={<UserCheck size={18} />} />
        <Stat label="Con notificaciones" value={stats.devices} tone="pink" icon={<Smartphone size={18} />} />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={m.busy} onClick={() => issueAll(false)} className="btn btn-primary !text-sm">
          <KeyRound size={17} /> Crear accesos que faltan
        </button>
        <button type="button" disabled={m.busy} onClick={() => issueAll(true)} className="btn btn-ghost !text-sm">
          Crear y enviar por correo
        </button>
      </div>
      {m.message && <ErrorBox message={m.message} />}
      {creds.length > 0 && (
        <section className="card space-y-3 p-4 print:shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg">Credenciales nuevas (solo se muestran ahora)</h3>
            <button type="button" onClick={() => window.print()} className="btn btn-ghost !min-h-10 !text-sm">
              <Printer size={16} /> Imprimir para entregar
            </button>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {creds.map((c) => (
              <li key={c.studentId} className="rounded-xl border-2 border-dashed border-line p-3 text-[14px]">
                <p className="font-semibold text-ink">{c.student}</p>
                <p className="mt-1 font-mono">Usuario: {c.username}</p>
                <p className="font-mono">Contraseña: {c.password}</p>
                <p className="mt-1 text-[12px] text-muted">gabushkids.com/familia {c.emailed && '· enviado por correo'}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      <SearchBox value={q} onChange={setQ} placeholder="Buscar estudiante o curso…" />
      {error ? (
        <ErrorBox message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Spinner />
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {rows.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => openStudent(a.id, 'matricula')} className="card flex w-full items-center gap-3 p-3.5 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">
                    {a.lastName}, {a.firstName}
                  </span>
                  <span className="block text-[13px] text-muted">
                    {a.code} · {a.course ?? '—'} · {a.lastLogin ? `entró ${dateTime(a.lastLogin)}` : a.active ? 'no ha entrado' : 'sin acceso'}
                  </span>
                </span>
                {a.active ? <Badge tone="green">Acceso</Badge> : <Badge>Sin acceso</Badge>}
                {a.devices > 0 && (
                  <Badge tone="violet">
                    <Smartphone size={12} /> {a.devices}
                  </Badge>
                )}
                {!a.emails && <Badge tone="yellow">Sin correo</Badge>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
