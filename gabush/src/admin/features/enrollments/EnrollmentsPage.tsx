import { ArrowRightCircle, FileWarning, Loader2, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { useMutation, useQuery } from '@/shared/useQuery'
import { listName } from '@/shared/format'
import { toast } from '../../store'
import { ConfirmModal, PageHead } from '../../ui'
import { api2, qs, useSetup, type DocumentType } from '../../v2/api'
import { Badge, Empty, ErrorBox, Field, Spinner, StatusBadge, StudentAvatar, Tabs, YearPicker, inputCls, useTab } from '../../v2/kit'
import { openStudent } from '../students/openStudent'
import { SuppliesTab } from './SuppliesTab'
import type { StudentRow } from '../students/types'

type Tab = 'cupos' | 'documentos' | 'requeridos' | 'utiles' | 'siguiente'

export function EnrollmentsPage() {
  const [tab, setTab] = useTab<Tab>('cupos')
  return (
    <div className="space-y-5">
      <PageHead title="Matrículas" sub="Cupos por curso, documentos, lista de útiles y el paso al año siguiente." actions={<YearPicker />} />
      <Tabs tabs={[{ id: 'cupos', label: 'Cupos por curso' }, { id: 'documentos', label: 'Documentos pendientes' }, { id: 'requeridos', label: 'Documentos requeridos' }, { id: 'utiles', label: 'Lista de útiles' }, { id: 'siguiente', label: 'Año siguiente' }]} value={tab} onChange={setTab} />
      {tab === 'cupos' && <Capacity />}
      {tab === 'documentos' && <PendingDocs />}
      {tab === 'requeridos' && <DocTypes />}
      {tab === 'utiles' && <SuppliesTab />}
      {tab === 'siguiente' && <NextYear />}
    </div>
  )
}

function Capacity() {
  const { year } = useSetup()
  const { data, error, loading, reload } = useQuery(year ? `cap:${year}` : null, () => api2.get<{ courses: { id: number; name: string; gradeLevel: string; capacity: number; classroom: string | null; director: string | null; active_students: number; pre: number; withdrawn: number }[] }>('/courses' + qs({ year })))
  const [roster, setRoster] = useState<{ id: number; name: string } | null>(null)
  if (error) return <ErrorBox message={error.message} onRetry={reload} />
  if (loading && !data) return <Spinner />
  const courses = data?.courses ?? []
  if (!courses.length) return <Empty icon={<Users />} title={`${year} no tiene cursos`}>Créalos en Gestión académica → Cursos y salones.</Empty>
  const tot = courses.reduce((a, c) => ({ cap: a.cap + c.capacity, act: a.act + (c.active_students || 0), pre: a.pre + (c.pre || 0) }), { cap: 0, act: 0, pre: 0 })
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {tot.act} activos · {tot.pre} en prematrícula · {Math.max(0, tot.cap - tot.act - tot.pre)} cupos libres de {tot.cap}
      </p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((c) => {
          const used = (c.active_students || 0) + (c.pre || 0)
          const pct = Math.min(100, Math.round((used / Math.max(1, c.capacity)) * 100))
          return (
            <li key={c.id}>
              <button type="button" onClick={() => setRoster({ id: c.id, name: c.name })} title="Ver los estudiantes del curso" className="card block w-full p-4 text-left transition-shadow hover:ring-2 hover:ring-royal/40">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-serif text-lg font-semibold text-ink">{c.name}</p>
                  <p className="text-[13px] text-muted">
                    {c.classroom ?? 'Sin salón'} · {c.director ?? 'Sin directora'}
                  </p>
                </div>
                <Badge tone={used >= c.capacity ? 'red' : used >= c.capacity - 2 ? 'yellow' : 'green'}>
                  {used}/{c.capacity}
                </Badge>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-paper">
                <div className={`h-full rounded-full ${pct >= 100 ? 'bg-berry' : pct >= 80 ? 'bg-gold' : 'bg-leaf'}`} style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-[13px] text-muted">
                {c.active_students || 0} activos{c.pre ? ` · ${c.pre} prematrícula` : ''}
                {c.withdrawn ? ` · ${c.withdrawn} retirados` : ''}
                <span className="float-right font-semibold text-royal">Ver lista →</span>
              </p>
              </button>
            </li>
          )
        })}
      </ul>
      <CourseRoster course={roster} onClose={() => setRoster(null)} />
    </div>
  )
}

type RosterStudent = { id: number; code: string; firstName: string; middleName: string | null; lastName: string; secondLastName: string | null; hasPhoto: number; status: 'activo' | 'prematricula' | 'retirado'; orderNumber: number | null }

/** Students of one course (active, pre-enrolled, withdrawn); tapping one opens their file. */
function CourseRoster({ course, onClose }: { course: { id: number; name: string } | null; onClose: () => void }) {
  const { data, error, loading } = useQuery(course ? `roster:${course.id}` : null, () => api2.get<{ students: RosterStudent[] }>(`/courses/${course!.id}`))
  const groups: [RosterStudent['status'], string][] = [['activo', 'Matriculados'], ['prematricula', 'En prematrícula'], ['retirado', 'Retirados']]
  return (
    <Modal open={Boolean(course)} onClose={onClose} label={course ? `Curso ${course.name}` : 'Curso'} closeLabel="Cerrar" className="sm:!max-w-lg">
      {course && (
        <div className="space-y-4 p-6">
          <h2 className="text-[1.5rem]">{course.name}</h2>
          {error ? (
            <ErrorBox message={error.message} />
          ) : loading || !data ? (
            <Spinner />
          ) : !data.students.length ? (
            <Empty title="Este curso aún no tiene estudiantes" />
          ) : (
            groups.map(([status, label]) => {
              const list = data.students.filter((s) => s.status === status)
              if (!list.length) return null
              return (
                <section key={status}>
                  <p className="mb-1.5 text-[12px] font-bold tracking-wide text-muted uppercase">
                    {label} ({list.length})
                  </p>
                  <ul className="divide-y divide-line rounded-2xl bg-white ring-1 ring-line">
                    {list.map((s, i) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => {
                            onClose()
                            openStudent(s.id, 'matricula')
                          }}
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-paper"
                        >
                          <span className="w-6 text-right text-[12px] font-semibold text-muted tabular-nums">{s.orderNumber ?? i + 1}</span>
                          <StudentAvatar s={s} size={36} zoom={false} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold text-ink">{listName(s)}</span>
                            <span className="block text-[12px] text-muted">{s.code}</span>
                          </span>
                          {status !== 'activo' && <StatusBadge status={status} />}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })
          )}
        </div>
      )}
    </Modal>
  )
}

function PendingDocs() {
  const { year } = useSetup()
  const { data, error, loading, reload } = useQuery(year ? `pdocs:${year}` : null, () => api2.get<{ students: StudentRow[] }>('/students' + qs({ year })))
  const rows = useMemo(() => (data?.students ?? []).filter((s) => s.docsPending > 0 && s.status !== 'retirado'), [data])
  if (error) return <ErrorBox message={error.message} onRetry={reload} />
  if (loading && !data) return <Spinner />
  if (!rows.length) return <Empty icon={<FileWarning />} title="No hay documentos pendientes">Todas las matrículas del año tienen sus documentos requeridos.</Empty>
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {rows.map((s) => (
        <li key={s.id}>
          <button type="button" onClick={() => openStudent(s.id, 'matricula')} className="card flex w-full items-center gap-3 p-3.5 text-left">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-ink">{listName(s)}</span>
              <span className="block text-[13px] text-muted">
                {s.course ?? 'Sin curso'} · {s.guardian ?? ''}
              </span>
            </span>
            <Badge tone="red">Faltan {s.docsPending}</Badge>
          </button>
        </li>
      ))}
    </ul>
  )
}

const emptyType = { name: '', description: '', required: true, appliesTo: 'nuevos' as 'nuevos' | 'todos', familyUpload: true, sort: 0, active: true }

function DocTypes() {
  const { setup, reload } = useSetup()
  const [editing, setEditing] = useState<{ id: number | null; v: typeof emptyType } | null>(null)
  const [removing, setRemoving] = useState<DocumentType | null>(null)
  const m = useMutation()
  const types = setup?.documentTypes ?? []
  const save = async () => {
    if (!editing) return
    if (await m.run(() => (editing.id ? api2.put(`/document-types/${editing.id}`, editing.v) : api2.post('/document-types', editing.v)))) {
      toast('Documento guardado')
      setEditing(null)
      reload()
    }
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[15px] text-muted">Lo que se le pide a cada familia. Aparece en su portal para que lo suban, y en la ficha del estudiante.</p>
        <button type="button" onClick={() => setEditing({ id: null, v: { ...emptyType, sort: types.length + 1 } })} className="btn btn-primary !text-sm">
          <Plus size={17} /> Agregar documento
        </button>
      </div>
      {!types.length ? (
        <Empty title="Sin documentos configurados">Ejemplos: Registro civil, Carné de vacunas, Certificado de EPS, Foto, Fotocopia de la cédula del acudiente.</Empty>
      ) : (
        <ul className="space-y-2">
          {types.map((t) => (
            <li key={t.id} className="card flex flex-wrap items-center gap-3 p-3.5">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink">{t.name}</span>
                <span className="block text-[13px] text-muted">{t.description || '—'}</span>
              </span>
              <Badge tone={t.required ? 'red' : 'gray'}>{t.required ? 'Obligatorio' : 'Opcional'}</Badge>
              <Badge tone="blue">{t.appliesTo === 'todos' ? 'Todos' : 'Solo nuevos'}</Badge>
              {!t.active && <Badge>Inactivo</Badge>}
              <button type="button" aria-label="Editar" onClick={() => setEditing({ id: t.id, v: { name: t.name, description: t.description ?? '', required: Boolean(t.required), appliesTo: t.appliesTo, familyUpload: Boolean(t.familyUpload), sort: t.sort, active: Boolean(t.active) } })} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-paper hover:text-ink">
                <Pencil size={16} />
              </button>
              <button type="button" aria-label="Eliminar" onClick={() => setRemoving(t)} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-[#fdf0ef] hover:text-berry">
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} label="Documento requerido" closeLabel="Cerrar" className="sm:!max-w-lg">
        {editing && (
          <div className="space-y-4 p-6">
            <h2 className="text-[1.4rem]">{editing.id ? 'Editar documento' : 'Nuevo documento'}</h2>
            <Field label="Nombre" error={m.fields.name}>
              <input value={editing.v.name} onChange={(e) => setEditing({ ...editing, v: { ...editing.v, name: e.target.value } })} className={inputCls(m.fields.name)} placeholder="Registro civil de nacimiento" />
            </Field>
            <Field label="Indicaciones para la familia">
              <input value={editing.v.description} onChange={(e) => setEditing({ ...editing, v: { ...editing.v, description: e.target.value } })} className={inputCls()} placeholder="Foto clara de ambas caras" />
            </Field>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 font-semibold text-ink">
                <input type="checkbox" checked={editing.v.required} onChange={(e) => setEditing({ ...editing, v: { ...editing.v, required: e.target.checked } })} className="size-5 accent-[#3a36a8]" /> Obligatorio
              </label>
              <label className="flex items-center gap-2 font-semibold text-ink">
                <input type="checkbox" checked={editing.v.familyUpload} onChange={(e) => setEditing({ ...editing, v: { ...editing.v, familyUpload: e.target.checked } })} className="size-5 accent-[#3a36a8]" /> La familia lo sube
              </label>
              <label className="flex items-center gap-2 font-semibold text-ink">
                <input type="checkbox" checked={editing.v.active} onChange={(e) => setEditing({ ...editing, v: { ...editing.v, active: e.target.checked } })} className="size-5 accent-[#3a36a8]" /> Activo
              </label>
              <select value={editing.v.appliesTo} onChange={(e) => setEditing({ ...editing, v: { ...editing.v, appliesTo: e.target.value as 'nuevos' | 'todos' } })} className={inputCls()}>
                <option value="nuevos">Solo estudiantes nuevos</option>
                <option value="todos">Todos, cada año</option>
              </select>
            </div>
            {m.message && <ErrorBox message={m.message} />}
            <button type="button" disabled={m.busy} onClick={save} className="btn btn-primary w-full">
              Guardar
            </button>
          </div>
        )}
      </Modal>
      <ConfirmModal open={Boolean(removing)} title={`¿Eliminar «${removing?.name}»?`} confirmLabel="Eliminar" tone="danger" onClose={() => setRemoving(null)} onConfirm={async () => { await api2.del(`/document-types/${removing!.id}`).catch(() => null); reload() }}>
        Si ya hay archivos cargados, solo se desactiva (los archivos se conservan).
      </ConfirmModal>
    </div>
  )
}

function NextYear() {
  const { setup, reload } = useSetup()
  const latest = setup ? Math.max(...setup.years.map((y) => y.id)) : 0
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const m = useMutation()
  if (!setup) return <Spinner />
  const next = latest + 1
  const exists = setup.years.some((y) => y.id === next)
  const create = async () => {
    if (await m.run(() => api2.post('/years', { year: next, copyFrom: latest, copyPrices: true }))) {
      toast(`Año ${next} creado con sus cursos y precios`)
      reload()
    }
  }
  const promote = async () => {
    setBusy(true)
    const r = await m.run(() => api2.post<{ promoted: number; graduates: number }>('/enrollments/promote', { from: setup.activeYear, to: next }))
    setBusy(false)
    if (r) setResult(`${r.promoted} estudiantes quedaron en prematrícula ${next}. ${r.graduates} se gradúan de Transición.`)
  }
  return (
    <div className="space-y-4">
      <section className="card space-y-3 p-5">
        <h3 className="text-lg">1. Crear el año {next}</h3>
        <p className="text-[15px] text-muted">Se copian los cursos, salones, directoras, materias por curso y los precios de {latest}. Luego los puedes ajustar.</p>
        <button type="button" disabled={exists || m.busy} onClick={create} className="btn btn-primary !text-sm">
          {exists ? `El año ${next} ya existe` : `Crear año ${next}`}
        </button>
      </section>
      <section className="card space-y-3 p-5">
        <h3 className="text-lg">2. Prematricular a los que continúan</h3>
        <p className="text-[15px] text-muted">
          Cada estudiante activo de {setup.activeYear} pasa al grado siguiente con la misma letra (Párvulos A → PreJardín A) en prematrícula. Después los matriculas uno a uno cuando paguen la matrícula y entreguen los documentos.
        </p>
        <button type="button" disabled={!exists || busy} onClick={promote} className="btn btn-ghost !text-sm">
          {busy ? <Loader2 size={17} className="animate-spin" /> : <ArrowRightCircle size={17} />} Prematricular para {next}
        </button>
        {result && <p className="rounded-xl bg-[#e9f4ee] px-4 py-3 text-[15px] font-semibold text-leaf">{result}</p>}
      </section>
      <section className="card space-y-2 p-5">
        <h3 className="text-lg">3. Activar el año {next}</h3>
        <p className="text-[15px] text-muted">Cuando empiecen las clases, actívalo en Gestión académica → Años y periodos. Ese día el panel y el portal de las familias pasan a mostrar {next} por defecto.</p>
      </section>
      {m.message && <ErrorBox message={m.message} />}
    </div>
  )
}
