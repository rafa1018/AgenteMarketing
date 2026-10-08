import { BookOpen, Loader2, PenLine, Plus, Search, Trash2, Upload, UserCheck, UserX, Users } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { date } from '@/shared/format'
import { useMutation, useQuery } from '@/shared/useQuery'
import { toast } from '../../store'
import { api2, qs, useSetup } from '../../v2/api'
import { Badge, ErrorBox, Field, Spinner, inputCls } from '../../v2/kit'

type Person = {
  id: number
  name: string
  position: string | null
  phone: string | null
  email: string | null
  userId: string | null
  active: number
  inactiveSince: string | null
  hasSignature: number
  directs: string | null
  teaches: string | null
  lastYear: number | null
}
type Status = 'activo' | 'inactivo' | 'todos'

/**
 * Teachers and staff: search, what each one has this year, activate / deactivate (keeps the history of earlier
 * years), delete when never assigned, and their signature for the report cards.
 */
export function StaffTab() {
  const { year, reload: reloadSetup } = useSetup()
  const [status, setStatus] = useState<Status>('activo')
  const [q, setQ] = useState('')
  const [term, setTerm] = useState('')
  useEffect(() => {
    const t = window.setTimeout(() => setTerm(q.trim()), 250)
    return () => window.clearTimeout(t)
  }, [q])
  const { data, error, loading, reload } = useQuery(`staff:${year}:${status}:${term}`, () => api2.get<{ staff: Person[]; counts: { active: number; inactive: number } }>('/staff' + qs({ year, status, q: term })))
  const [editing, setEditing] = useState<Partial<Person> | null>(null)
  const [leaving, setLeaving] = useState<Person | null>(null)
  const refresh = () => {
    reload()
    reloadSetup()
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-[15px] text-muted">Docentes, directores de grupo y personal. Su usuario para entrar al panel se crea en <b>Usuarios</b>.</p>
        <button type="button" onClick={() => setEditing({ position: 'Docente' })} className="btn btn-primary !text-sm">
          <Plus size={17} /> Agregar persona
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={17} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, cargo, correo o teléfono" className={inputCls() + ' pl-10'} aria-label="Buscar personal" />
        </div>
        <div className="flex gap-1 rounded-full bg-white p-1 ring-1 ring-line">
          {(
            [
              ['activo', `Activos${data ? ` (${data.counts.active})` : ''}`],
              ['inactivo', `Inactivos${data ? ` (${data.counts.inactive})` : ''}`],
              ['todos', 'Todos'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setStatus(id)} className={`rounded-full px-3.5 py-1.5 text-[14px] font-semibold ${status === id ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {error ? (
        <ErrorBox message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Spinner />
      ) : !data?.staff.length ? (
        <p className="card p-6 text-center text-muted">{term ? `Nadie coincide con «${term}».` : status === 'inactivo' ? 'No hay personal inactivo.' : 'Todavía no hay personal registrado.'}</p>
      ) : (
        <ul className="grid gap-2 lg:grid-cols-2">
          {data.staff.map((p) => (
            <li key={p.id} className={`card flex flex-col gap-2 p-4 ${p.active ? '' : 'opacity-75'}`}>
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#eeedfb] font-serif text-[15px] font-semibold text-royal">
                  {p.name
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join('')
                    .toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">{p.name}</span>
                  <span className="block text-[13px] text-muted">
                    {p.position ?? 'Docente'}
                    {p.phone && ` · ${p.phone}`}
                    {p.email && ` · ${p.email}`}
                  </span>
                </span>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {p.active ? <Badge tone="green">Activo</Badge> : <Badge>Inactivo{p.inactiveSince ? ` desde ${date(p.inactiveSince)}` : ''}</Badge>}
                  {p.hasSignature ? <Badge tone="violet">Con firma</Badge> : null}
                </div>
              </div>
              {(p.directs || p.teaches) && (
                <div className="space-y-1 rounded-xl bg-paper px-3 py-2 text-[13px]">
                  {p.directs && (
                    <p className="flex gap-1.5">
                      <Users size={14} className="mt-0.5 shrink-0 text-pink" />
                      <span>
                        <b className="text-ink">Director(a) de grupo:</b> {p.directs}
                      </span>
                    </p>
                  )}
                  {p.teaches && (
                    <p className="flex gap-1.5">
                      <BookOpen size={14} className="mt-0.5 shrink-0 text-royal" />
                      <span>
                        <b className="text-ink">Materias {year}:</b> {p.teaches}
                      </span>
                    </p>
                  )}
                </div>
              )}
              {!p.directs && !p.teaches && <p className="text-[13px] text-muted">{p.lastYear ? `Sin asignación en ${year} · último año con materias: ${p.lastYear}` : `Sin cursos ni materias asignadas en ${year}`}</p>}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setEditing(p)} className="btn btn-ghost !min-h-9 !px-3 !text-[13px]">
                  <PenLine size={15} /> Editar y firma
                </button>
                {p.active ? (
                  <button type="button" onClick={() => setLeaving(p)} className="btn btn-ghost !min-h-9 !px-3 !text-[13px] text-berry">
                    <UserX size={15} /> Inactivar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      await api2.post(`/staff/${p.id}/activate`).catch(() => null)
                      toast(`${p.name} quedó activo(a): asígnale cursos y materias en «Cursos y salones»`)
                      refresh()
                    }}
                    className="btn btn-ghost !min-h-9 !px-3 !text-[13px] text-leaf"
                  >
                    <UserCheck size={15} /> Activar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <PersonModal person={editing} onClose={() => setEditing(null)} onSaved={refresh} />
      <DeactivateModal person={leaving} year={year} onClose={() => setLeaving(null)} onDone={refresh} />
    </div>
  )
}

function PersonModal({ person, onClose, onSaved }: { person: Partial<Person> | null; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({ name: '', position: 'Docente', phone: '', email: '' })
  const [sig, setSig] = useState<string | null>(null)
  const [clean, setClean] = useState(true)
  const [uploading, setUploading] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const m = useMutation()
  useEffect(() => {
    if (!person) return
    setV({ name: person.name ?? '', position: person.position ?? 'Docente', phone: person.phone ?? '', email: person.email ?? '' })
    setSig(null)
  }, [person])
  const save = async () => {
    const r = await m.run(() => (person?.id ? api2.put<{ id?: number }>(`/staff/${person.id}`, v) : api2.post<{ id: number }>('/staff', v)))
    if (r) {
      toast('Guardado')
      onSaved()
      if (!person?.id) onClose()
    }
  }
  const upload = async (file: File) => {
    if (!person?.id) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('clean', clean ? '1' : '0')
    try {
      const r = await api2.upload<{ signature: string | null }>(`/staff/${person.id}/signature`, fd)
      setSig(r.signature)
      toast('Firma guardada: saldrá en los boletines de su curso')
      onSaved()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo subir la firma')
    } finally {
      setUploading(false)
    }
  }
  return (
    <Modal open={Boolean(person)} onClose={onClose} label="Personal" closeLabel="Cerrar" className="sm:!max-w-lg">
      {person && (
        <div className="space-y-4 p-6">
          <h2 className="text-[1.4rem]">{person.id ? person.name : 'Agregar persona'}</h2>
          <Field label="Nombre completo" error={m.fields.name}>
            <input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className={inputCls(m.fields.name)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Cargo">
              <input value={v.position} onChange={(e) => setV({ ...v, position: e.target.value })} list="staff-positions" className={inputCls()} />
              <datalist id="staff-positions">
                <option value="Docente" />
                <option value="Directora de grupo" />
                <option value="Rectora" />
                <option value="Auxiliar" />
                <option value="Coordinadora" />
              </datalist>
            </Field>
            <Field label="Teléfono">
              <input value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} inputMode="tel" className={inputCls()} />
            </Field>
            <Field label="Correo" error={m.fields.email}>
              <input value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} inputMode="email" className={inputCls(m.fields.email)} />
            </Field>
          </div>
          {m.message && <ErrorBox message={m.message} />}
          <button type="button" disabled={m.busy} onClick={save} className="btn btn-primary w-full">
            {m.busy && <Loader2 size={18} className="animate-spin" />} Guardar
          </button>
          {person.id && (
            <section className="space-y-2 rounded-2xl bg-paper p-4">
              <p className="flex items-center gap-2 font-semibold text-ink">
                <PenLine size={17} className="text-royal" /> Firma para los boletines
              </p>
              <p className="text-[13px] text-muted">Sale como director(a) de grupo. Si no subes una imagen, en el boletín sale su nombre bajo la línea de firma.</p>
              <div className="grid min-h-20 place-items-center rounded-xl border-2 border-dashed border-line bg-white p-2">
                {sig ? <img src={sig} alt="Firma" className="max-h-20 max-w-full object-contain" /> : <span className="text-sm text-muted">{person.hasSignature ? 'Tiene una firma guardada' : 'Sin firma: saldrá su nombre'}</span>}
              </div>
              <label className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                <input type="checkbox" checked={clean} onChange={(e) => setClean(e.target.checked)} className="size-4 accent-[#3a36a8]" /> Quitar el fondo blanco del papel
              </label>
              <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={uploading} onClick={() => input.current?.click()} className="btn btn-ghost !min-h-10 !text-sm">
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} {person.hasSignature || sig ? 'Cambiar firma' : 'Subir firma'}
                </button>
                {(person.hasSignature || sig) && (
                  <button
                    type="button"
                    onClick={async () => {
                      await api2.del(`/staff/${person.id}/signature`).catch(() => null)
                      setSig(null)
                      toast('Firma quitada: saldrá su nombre')
                      onSaved()
                    }}
                    className="btn btn-ghost !min-h-10 !text-sm text-berry"
                  >
                    <Trash2 size={16} /> Quitar firma
                  </button>
                )}
              </div>
            </section>
          )}
          {person.id && (
            <button
              type="button"
              onClick={async () => {
                if (!window.confirm(`¿Eliminar a ${person.name}? Solo es posible si nunca tuvo cursos ni materias.`)) return
                const r = await m.run(() => api2.del(`/staff/${person.id}`))
                if (r) {
                  toast('Eliminado(a)')
                  onSaved()
                  onClose()
                }
              }}
              className="block w-full text-center text-[13px] font-semibold text-muted hover:text-berry"
            >
              Eliminar definitivamente
            </button>
          )}
        </div>
      )}
    </Modal>
  )
}

function DeactivateModal({ person, year, onClose, onDone }: { person: Person | null; year: number | null; onClose: () => void; onDone: () => void }) {
  const m = useMutation()
  return (
    <Modal open={Boolean(person)} onClose={onClose} label="Inactivar" closeLabel="Cerrar" className="sm:!max-w-md">
      {person && (
        <div className="space-y-4 p-6">
          <h2 className="text-[1.4rem]">Inactivar a {person.name}</h2>
          <p className="text-[14px] text-text">Deja de aparecer para asignar cursos y materias, y se libera de lo que tiene en {year} y en los años siguientes:</p>
          <ul className="list-disc space-y-0.5 pl-5 text-[14px] text-text">
            {person.directs && <li>Director(a) de grupo de {person.directs}</li>}
            {person.teaches && <li>Materias: {person.teaches}</li>}
            {!person.directs && !person.teaches && <li>No tiene asignaciones este año.</li>}
          </ul>
          <p className="rounded-xl bg-[#eaf3fa] px-4 py-3 text-[13px] text-[#185a8a]">En los años anteriores se conserva: los boletines de esos años siguen diciendo quién dio cada materia. Puedes volver a activarlo(a) cuando quieras.</p>
          {m.message && <ErrorBox message={m.message} />}
          <button
            type="button"
            disabled={m.busy}
            onClick={async () => {
              const r = await m.run(() => api2.post<{ coursesFreed: number; subjectsFreed: number }>(`/staff/${person.id}/deactivate`))
              if (r) {
                toast(`Inactivo(a). Se liberaron ${r.coursesFreed} cursos y ${r.subjectsFreed} materias: asígnalos a otra persona en «Cursos y salones».`)
                onDone()
                onClose()
              }
            }}
            className="btn w-full bg-berry text-white"
          >
            <UserX size={18} /> Inactivar
          </button>
        </div>
      )}
    </Modal>
  )
}
