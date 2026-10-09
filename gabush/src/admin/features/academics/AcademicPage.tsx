import { CheckCircle2, Lock, Pencil, Plus, Send, Trash2, Unlock } from 'lucide-react'
import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { useMutation, useQuery } from '@/shared/useQuery'
import { date } from '@/shared/format'
import { toast } from '../../store'
import { PageHead } from '../../ui'
import { api2, useSetup, type Classroom, type CourseInfo } from '../../v2/api'
import { Badge, Empty, ErrorBox, Field, Spinner, Tabs, YearPicker, inputCls, useTab } from '../../v2/kit'
import { AchievementsBank } from './AchievementsBank'
import { StaffTab } from './StaffTab'

type Tab = 'anios' | 'cursos' | 'materias' | 'logros' | 'personal'

export function AcademicPage() {
  const [tab, setTab] = useTab<Tab>('cursos')
  return (
    <div className="space-y-5">
      <PageHead title="Gestión académica" sub="Años y periodos, cursos y salones, materias, banco de logros y personal." actions={<YearPicker />} />
      <Tabs tabs={[{ id: 'cursos', label: 'Cursos y salones' }, { id: 'anios', label: 'Años y periodos' }, { id: 'materias', label: 'Materias' }, { id: 'logros', label: 'Banco de logros' }, { id: 'personal', label: 'Personal' }]} value={tab} onChange={setTab} />
      {tab === 'anios' && <YearsTab />}
      {tab === 'cursos' && <CoursesTab />}
      {tab === 'materias' && <SubjectsTab />}
      {tab === 'logros' && <AchievementsBank />}
      {tab === 'personal' && <StaffTab />}
    </div>
  )
}

/* ───────── years & periods ───────── */
type YearsData = { years: { id: number; name: string; startsOn: string | null; endsOn: string | null; status: string; active: number; withdrawn: number; pre: number; courses: number; periods: { id: number; number: number; name: string; startsOn: string | null; endsOn: string | null; weight: string; gradingOpen: number; published: number }[] }[] }

function YearsTab() {
  const { reload: reloadSetup } = useSetup()
  const { data, error, loading, reload } = useQuery('years', () => api2.get<YearsData>('/years'))
  const [editPeriod, setEditPeriod] = useState<YearsData['years'][0]['periods'][0] | null>(null)
  const m = useMutation()
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    if (await m.run(fn)) {
      toast(ok)
      reload()
      reloadSetup()
    }
  }
  if (error) return <ErrorBox message={error.message} onRetry={reload} />
  if (loading && !data) return <Spinner />
  return (
    <div className="space-y-4">
      {m.message && <ErrorBox message={m.message} />}
      {data?.years.map((y) => (
        <section key={y.id} className="card p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl">{y.id}</h3>
            <Badge tone={y.status === 'active' ? 'green' : y.status === 'planned' ? 'blue' : 'gray'}>{y.status === 'active' ? 'Año actual' : y.status === 'planned' ? 'Próximo' : 'Cerrado'}</Badge>
            <span className="text-sm text-muted">
              {y.active} activos · {y.withdrawn} retirados{y.pre ? ` · ${y.pre} prematrícula` : ''} · {y.courses} cursos
            </span>
            {y.status !== 'active' && (
              <button type="button" onClick={() => act(() => api2.post(`/years/${y.id}/activate`), `${y.id} es ahora el año actual`)} className="btn btn-ghost ml-auto !min-h-9 !px-3 !text-[13px]">
                <CheckCircle2 size={15} /> Hacer año actual
              </button>
            )}
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {y.periods.map((p) => (
              <li key={p.id} className="rounded-xl bg-paper p-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-ink">{p.name}</p>
                  <button type="button" aria-label="Editar periodo" onClick={() => setEditPeriod(p)} className="text-muted hover:text-ink">
                    <Pencil size={15} />
                  </button>
                </div>
                <p className="text-[13px] text-muted">
                  {p.startsOn ? `${date(p.startsOn, false)} – ${date(p.endsOn, false)}` : 'Sin fechas'} · {Number(p.weight)}%
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => act(() => api2.put(`/periods/${p.id}`, { gradingOpen: !p.gradingOpen }), p.gradingOpen ? 'Calificación cerrada' : 'Calificación abierta para las docentes')} className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[12px] font-bold text-ink ring-1 ring-line">
                    {p.gradingOpen ? <Unlock size={12} className="text-leaf" /> : <Lock size={12} className="text-muted" />} {p.gradingOpen ? 'Calificando' : 'Cerrado'}
                  </button>
                  <button type="button" onClick={() => act(() => api2.post(`/periods/${p.id}/publish`, { published: !p.published }), p.published ? 'Boletín oculto para las familias' : 'Boletín publicado: las familias reciben el aviso')} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold ${p.published ? 'bg-leaf text-white' : 'bg-white text-ink ring-1 ring-line'}`}>
                    <Send size={12} /> {p.published ? 'Publicado para todos' : 'Publicar a todo el jardín'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <Modal open={Boolean(editPeriod)} onClose={() => setEditPeriod(null)} label="Periodo" closeLabel="Cerrar" className="sm:!max-w-md">
        {editPeriod && <PeriodForm p={editPeriod} onDone={() => { setEditPeriod(null); reload(); reloadSetup() }} />}
      </Modal>
    </div>
  )
}

function PeriodForm({ p, onDone }: { p: { id: number; name: string; startsOn: string | null; endsOn: string | null; weight: string }; onDone: () => void }) {
  const [v, setV] = useState({ name: p.name, startsOn: p.startsOn ?? '', endsOn: p.endsOn ?? '', weight: String(Number(p.weight)) })
  const m = useMutation()
  return (
    <div className="space-y-4 p-6">
      <h2 className="text-[1.4rem]">{p.name}</h2>
      <Field label="Nombre">
        <input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className={inputCls()} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Inicia" error={m.fields.startsOn}>
          <input type="date" value={v.startsOn} onChange={(e) => setV({ ...v, startsOn: e.target.value })} className={inputCls()} />
        </Field>
        <Field label="Termina" error={m.fields.endsOn}>
          <input type="date" value={v.endsOn} onChange={(e) => setV({ ...v, endsOn: e.target.value })} className={inputCls()} />
        </Field>
      </div>
      <Field label="Peso en la nota final (%)" error={m.fields.weight}>
        <input type="number" min={0} max={100} value={v.weight} onChange={(e) => setV({ ...v, weight: e.target.value })} className={inputCls()} />
      </Field>
      {m.message && <ErrorBox message={m.message} />}
      <button type="button" disabled={m.busy} onClick={async () => { if (await m.run(() => api2.put(`/periods/${p.id}`, { ...v, startsOn: v.startsOn || null, endsOn: v.endsOn || null }))) { toast('Periodo guardado'); onDone() } }} className="btn btn-primary w-full">
        Guardar
      </button>
    </div>
  )
}

/* ───────── courses & classrooms ───────── */
type CourseDetail = { course: { id: number; name: string }; subjects: { id: number; subjectId: number; subject: string; teacherId: number | null; teacher: string | null }[] }

function CoursesTab() {
  const { setup, year, reload } = useSetup()
  const [editing, setEditing] = useState<Partial<CourseInfo> | null>(null)
  const [room, setRoom] = useState<Partial<Classroom> | null>(null)
  const [status, setStatus] = useState<'activos' | 'inactivos' | 'todos'>('activos')
  const m = useMutation()
  if (!setup) return <Spinner />
  const shown = setup.courses.filter((c) => status === 'todos' || (status === 'activos' ? c.active : !c.active))
  const toggle = async (c: CourseInfo) => {
    if (await m.run(() => api2.post(`/courses/${c.id}/active`, { active: !c.active }))) {
      toast(c.active ? `${c.name} inactivo: ya no sale en las listas de cursos` : `${c.name} activo de nuevo`)
      reload()
    }
  }
  const nActive = setup.courses.filter((c) => c.active).length
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xl">Cursos {year}</h3>
          <button type="button" onClick={() => setEditing({ capacity: 12 })} className="btn btn-primary !text-sm">
            <Plus size={17} /> Nuevo curso
          </button>
        </div>
        <StatusTabs value={status} onChange={setStatus} counts={[nActive, setup.courses.length - nActive]} labels={['Activos', 'Inactivos', 'Todos']} />
        {m.message && <ErrorBox message={m.message} />}
        {!setup.courses.length ? (
          <Empty title="Este año no tiene cursos">Crea el primero, o copia los del año anterior desde Matrículas → Año siguiente.</Empty>
        ) : !shown.length ? (
          <Empty title={status === 'inactivos' ? 'No hay cursos inactivos' : 'No hay cursos activos'} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((c) => (
              <li key={c.id} className={`card p-4 ${c.active ? '' : 'opacity-70'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-serif text-lg font-semibold text-ink">{c.name}</p>
                    <p className="text-[13px] text-muted">
                      {setup.gradeLevels.find((g) => g.id === c.gradeLevelId)?.name} · {setup.classrooms.find((r) => r.id === c.classroomId)?.name ?? 'Sin salón'}
                    </p>
                    {c.directorId ? (
                      <p className="text-[13px] text-muted">Director(a): {setup.staff.find((s) => s.id === c.directorId)?.name ?? '—'}</p>
                    ) : (
                      <p className="text-[13px] font-semibold text-berry">Sin director(a) de grupo: asígnalo</p>
                    )}
                  </div>
                  <button type="button" aria-label="Editar" onClick={() => setEditing(c)} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-paper hover:text-ink">
                    <Pencil size={16} />
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge tone={c.enrolled >= c.capacity ? 'red' : 'green'}>
                    {c.enrolled} de {c.capacity} cupos
                  </Badge>
                  {!c.active && <Badge>Inactivo</Badge>}
                  <button type="button" disabled={m.busy} onClick={() => toggle(c)} className={`ml-auto rounded-full px-3 py-1 text-[12px] font-bold ring-1 ${c.active ? 'text-muted ring-line hover:text-berry hover:ring-berry' : 'text-leaf ring-leaf hover:bg-[#e9f4ee]'}`}>
                    {c.active ? 'Inactivar' : 'Activar'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xl">Salones</h3>
          <button type="button" onClick={() => setRoom({ capacity: 12, active: 1 })} className="btn btn-ghost !text-sm">
            <Plus size={17} /> Nuevo salón
          </button>
        </div>
        {!setup.classrooms.length ? (
          <p className="text-sm text-muted">Registra los salones (y su capacidad) para asignarlos a los cursos.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {setup.classrooms.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => setRoom(r)} className="card flex items-center gap-2 px-4 py-2.5 text-left">
                  <span className="font-semibold text-ink">{r.name}</span>
                  <span className="text-sm text-muted">
                    {r.location ? `${r.location} · ` : ''}
                    {r.capacity} niños
                  </span>
                  {!r.active && <Badge>Inactivo</Badge>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} label="Curso" closeLabel="Cerrar">
        {editing && <CourseForm course={editing} onDone={() => { setEditing(null); reload() }} />}
      </Modal>
      <Modal open={Boolean(room)} onClose={() => setRoom(null)} label="Salón" closeLabel="Cerrar" className="sm:!max-w-md">
        {room && <RoomForm room={room} onDone={() => { setRoom(null); reload() }} />}
      </Modal>
    </div>
  )
}

function CourseForm({ course, onDone }: { course: Partial<CourseInfo>; onDone: () => void }) {
  const { setup, year } = useSetup()
  const [v, setV] = useState({ name: course.name ?? '', alias: course.alias ?? '', gradeLevelId: course.gradeLevelId ?? setup?.gradeLevels[0]?.id ?? '', classroomId: course.classroomId ?? '', capacity: course.capacity ?? 12, directorId: course.directorId ?? '', shift: course.shift ?? '' })
  const detail = useQuery(course.id ? `course:${course.id}` : null, () => api2.get<CourseDetail>(`/courses/${course.id}`))
  const [subjects, setSubjects] = useState<{ subjectId: number; teacherId: number | null }[] | null>(null)
  const list = subjects ?? detail.data?.subjects.map((s) => ({ subjectId: s.subjectId, teacherId: s.teacherId })) ?? []
  const m = useMutation()
  const save = async () => {
    const body = { ...v, yearId: year, gradeLevelId: Number(v.gradeLevelId), classroomId: v.classroomId || null, directorId: v.directorId || null, shift: v.shift || null, subjects: list }
    if (await m.run(() => (course.id ? api2.put(`/courses/${course.id}`, body) : api2.post('/courses', body)))) {
      toast('Curso guardado')
      onDone()
    }
  }
  const staff = setup?.staff.filter((s) => s.active) ?? []
  return (
    <div className="space-y-4 p-5 sm:p-7">
      <h2 className="text-[1.5rem]">{course.id ? `Curso ${course.name}` : `Nuevo curso ${year}`}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre" error={m.fields.name}>
          <input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Párvulos A" className={inputCls(m.fields.name)} />
        </Field>
        <Field label="Grado">
          <select value={v.gradeLevelId} onChange={(e) => setV({ ...v, gradeLevelId: Number(e.target.value) })} className={inputCls()}>
            {setup?.gradeLevels.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Salón">
          <select value={v.classroomId} onChange={(e) => setV({ ...v, classroomId: e.target.value ? Number(e.target.value) : '' })} className={inputCls()}>
            <option value="">—</option>
            {setup?.classrooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.capacity})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Capacidad (cupos)" error={m.fields.capacity}>
          <input type="number" min={1} max={99} value={v.capacity} onChange={(e) => setV({ ...v, capacity: Number(e.target.value) })} className={inputCls(m.fields.capacity)} />
        </Field>
        <Field label="Director(a) de grupo *" error={m.fields.directorId} hint="Obligatorio: es quien califica el curso en Calificaciones. Solo personal activo (pestaña Personal).">
          <select value={v.directorId} onChange={(e) => setV({ ...v, directorId: e.target.value ? Number(e.target.value) : '' })} className={inputCls(m.fields.directorId)}>
            <option value="">Elige…</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Jornada">
          <select value={v.shift} onChange={(e) => setV({ ...v, shift: e.target.value })} className={inputCls()}>
            <option value="">—</option>
            <option value="manana">Mañana</option>
            <option value="tarde">Tarde</option>
            <option value="completa">Completa</option>
          </select>
        </Field>
      </div>
      <div>
        <p className="mb-1.5 font-semibold text-ink">Materias del curso y docente</p>
        <ul className="space-y-1.5">
          {setup?.subjects.filter((s) => s.active).map((s) => {
            const row = list.find((x) => x.subjectId === s.id)
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-paper px-3 py-2">
                <label className="flex min-w-0 flex-1 items-center gap-2 font-semibold text-ink">
                  <input type="checkbox" checked={Boolean(row)} onChange={(e) => setSubjects(e.target.checked ? [...list, { subjectId: s.id, teacherId: null }] : list.filter((x) => x.subjectId !== s.id))} className="size-5 accent-[#3a36a8]" />
                  {s.name}
                </label>
                {row && (
                  <select value={row.teacherId ?? ''} onChange={(e) => setSubjects(list.map((x) => (x.subjectId === s.id ? { ...x, teacherId: e.target.value ? Number(e.target.value) : null } : x)))} className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm" aria-label="Docente">
                    <option value="">Docente…</option>
                    {staff.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
              </li>
            )
          })}
        </ul>
      </div>
      {m.message && <ErrorBox message={m.message} />}
      <button type="button" disabled={m.busy} onClick={save} className="btn btn-primary w-full">
        Guardar curso
      </button>
    </div>
  )
}

function RoomForm({ room, onDone }: { room: Partial<Classroom>; onDone: () => void }) {
  const [v, setV] = useState({ name: room.name ?? '', capacity: room.capacity ?? 12, location: room.location ?? '', active: room.active ?? 1 })
  const m = useMutation()
  return (
    <div className="space-y-4 p-6">
      <h2 className="text-[1.4rem]">{room.id ? 'Editar salón' : 'Nuevo salón'}</h2>
      <Field label="Nombre" error={m.fields.name}>
        <input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Salón Arcoíris" className={inputCls(m.fields.name)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Capacidad">
          <input type="number" min={1} value={v.capacity} onChange={(e) => setV({ ...v, capacity: Number(e.target.value) })} className={inputCls()} />
        </Field>
        <Field label="Ubicación">
          <input value={v.location} onChange={(e) => setV({ ...v, location: e.target.value })} placeholder="Casa 1" className={inputCls()} />
        </Field>
      </div>
      <label className="flex items-center gap-2 font-semibold text-ink">
        <input type="checkbox" checked={Boolean(v.active)} onChange={(e) => setV({ ...v, active: e.target.checked ? 1 : 0 })} className="size-5 accent-[#3a36a8]" /> Activo
      </label>
      {m.message && <ErrorBox message={m.message} />}
      <button type="button" disabled={m.busy} onClick={async () => { if (await m.run(() => (room.id ? api2.put(`/classrooms/${room.id}`, v) : api2.post('/classrooms', v)))) { toast('Salón guardado'); onDone() } }} className="btn btn-primary w-full">
        Guardar
      </button>
    </div>
  )
}

/* ───────── dimensions of development (areas) ───────── */
function AreasCard() {
  const { setup, reload } = useSetup()
  const [area, setArea] = useState<{ id?: number; name: string; position: number } | null>(null)
  const m = useMutation()
  if (!setup) return null
  const used = (id: number) => setup.subjects.filter((s) => s.areaId === id).length
  const save = async () => {
    if (!area) return
    if (await m.run(() => (area.id ? api2.put(`/areas/${area.id}`, area) : api2.post('/areas', area)))) {
      toast('Dimensión guardada')
      setArea(null)
      reload()
    }
  }
  const remove = async (id: number) => {
    if (await m.run(() => api2.del(`/areas/${id}`))) {
      toast('Dimensión eliminada')
      setArea(null)
      reload()
    }
  }
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg">Dimensiones del desarrollo</h3>
        <button type="button" onClick={() => setArea({ name: '', position: Math.max(0, ...setup.areas.map((a) => a.position)) + 1 })} className="btn btn-ghost !min-h-9 !px-3 !text-[13px]">
          <Plus size={15} /> Dimensión
        </button>
      </div>
      <p className="text-[13px] text-muted">El número es el orden en que salen en el boletín.</p>
      <ol className="mt-2 space-y-1">
        {setup.areas.map((a) => (
          <li key={a.id} className="flex items-center gap-2 rounded-lg bg-paper px-3 py-2">
            <span className="flex-1 font-semibold text-ink">
              {a.position}. {a.name}
            </span>
            <span className="text-[12px] text-muted">{used(a.id)} materias</span>
            <button type="button" aria-label={`Editar ${a.name}`} onClick={() => setArea({ id: a.id, name: a.name, position: a.position })} className="text-muted hover:text-ink">
              <Pencil size={15} />
            </button>
          </li>
        ))}
      </ol>
      <Modal open={Boolean(area)} onClose={() => setArea(null)} label="Dimensión" closeLabel="Cerrar" className="sm:!max-w-md">
        {area && (
          <div className="space-y-4 p-6">
            <h2 className="text-[1.4rem]">{area.id ? 'Editar dimensión' : 'Nueva dimensión'}</h2>
            <Field label="Nombre" error={m.fields.name}>
              <input value={area.name} onChange={(e) => setArea({ ...area, name: e.target.value })} placeholder="Dimensión Cognitiva" className={inputCls(m.fields.name)} />
            </Field>
            <Field label="Orden en el boletín" hint="1 sale primero.">
              <input type="number" min={0} max={99} value={area.position} onChange={(e) => setArea({ ...area, position: Number(e.target.value) })} className={inputCls()} />
            </Field>
            {m.message && <ErrorBox message={m.message} />}
            <button type="button" disabled={m.busy} onClick={save} className="btn btn-primary w-full">
              Guardar
            </button>
            {area.id && (
              <button type="button" disabled={m.busy} onClick={() => remove(area.id!)} className="btn btn-ghost w-full text-berry">
                <Trash2 size={16} /> Eliminar dimensión
              </button>
            )}
            {area.id && used(area.id) > 0 && <p className="text-[12px] text-muted">Para eliminarla, primero pasa sus {used(area.id)} materias a otra dimensión.</p>}
          </div>
        )}
      </Modal>
    </div>
  )
}

/* ───────── performance levels ───────── */
type LevelRow = { id?: number; name: string; min: string; max: string }

function LevelsCard() {
  const { setup, reload } = useSetup()
  const [rows, setRows] = useState<LevelRow[] | null>(null)
  const m = useMutation()
  if (!setup) return null
  const num = (v: string) => String(Number(v))
  const start = () => setRows(setup.levels.map((l) => ({ id: l.id, name: l.name, min: num(l.min), max: num(l.max) })))
  const set = (i: number, p: Partial<LevelRow>) => setRows((rs) => rs!.map((r, j) => (j === i ? { ...r, ...p } : r)))
  const save = async () => {
    if (!rows) return
    if (await m.run(() => api2.put('/levels', { levels: rows }))) {
      toast('Niveles de desempeño guardados')
      setRows(null)
      reload()
    }
  }
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg">Niveles de desempeño</h3>
        {!rows && (
          <button type="button" onClick={start} className="btn btn-ghost !min-h-9 !px-3 !text-[13px]">
            <Pencil size={14} /> Editar
          </button>
        )}
      </div>
      {!rows ? (
        <ul className="mt-2 space-y-1">
          {setup.levels.map((l) => (
            <li key={l.id} className="flex justify-between rounded-lg bg-paper px-3 py-2">
              <span className="font-semibold text-ink">{l.name}</span>
              <span className="text-sm text-muted tabular-nums">
                {num(l.min)} – {num(l.max)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-[1fr_72px_72px_32px] gap-2 px-1 text-[12px] font-bold tracking-wide text-muted uppercase">
            <span>Nombre</span>
            <span>Desde</span>
            <span>Hasta</span>
            <span />
          </div>
          {rows.map((r, i) => (
            <div key={r.id ?? `n${i}`} className="grid grid-cols-[1fr_72px_72px_32px] items-center gap-2">
              <input value={r.name} onChange={(e) => set(i, { name: e.target.value })} maxLength={40} aria-label="Nombre del nivel" className="min-w-0 rounded-lg border border-line px-2.5 py-2" />
              <input value={r.min} onChange={(e) => set(i, { min: e.target.value })} inputMode="decimal" aria-label="Desde" className="min-w-0 rounded-lg border border-line px-2 py-2 tabular-nums" />
              <input value={r.max} onChange={(e) => set(i, { max: e.target.value })} inputMode="decimal" aria-label="Hasta" className="min-w-0 rounded-lg border border-line px-2 py-2 tabular-nums" />
              <button type="button" aria-label={`Quitar ${r.name}`} onClick={() => setRows(rows.filter((_, j) => j !== i))} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-[#fdf0ef] hover:text-berry">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setRows([...rows, { name: '', min: '', max: '' }])} className="btn btn-ghost !min-h-9 !px-3 !text-[13px]">
            <Plus size={15} /> Nivel
          </button>
          <p className="text-[12px] text-muted">Escala de 0 a 100, sin rangos que se crucen. Un nivel que ya está en notas o logros no se puede quitar, pero sí renombrar o cambiar su rango. Los colores del boletín van con los nombres Insuficiente, Aceptable, Bueno y Excelente.</p>
          {m.message && <ErrorBox message={m.message} />}
          <div className="flex gap-2">
            <button type="button" onClick={() => setRows(null)} className="btn btn-ghost flex-1">
              Cancelar
            </button>
            <button type="button" disabled={m.busy} onClick={save} className="btn btn-primary flex-1">
              Guardar niveles
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ───────── subjects, areas, levels ───────── */
/** Activos / Inactivos / Todos with counts. */
function StatusTabs<T extends 'activos' | 'inactivos' | 'todos'>({ value, onChange, counts, labels }: { value: T; onChange: (v: T) => void; counts: [number, number]; labels: [string, string, string] }) {
  const items = [['activos', `${labels[0]} (${counts[0]})`], ['inactivos', `${labels[1]} (${counts[1]})`], ['todos', labels[2]]] as [T, string][]
  return (
    <div className="inline-flex rounded-full bg-white p-1 ring-1 ring-line">
      {items.map(([id, label]) => (
        <button key={id} type="button" onClick={() => onChange(id)} className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${value === id ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}>
          {label}
        </button>
      ))}
    </div>
  )
}

function SubjectsTab() {
  const { setup, reload } = useSetup()
  const [subject, setSubject] = useState<{ id?: number; name: string; areaId: number | ''; active: boolean } | null>(null)
  const [status, setStatus] = useState<'activos' | 'inactivos' | 'todos'>('activos')
  const m = useMutation()
  const toggle = async (s: { id: number; name: string; areaId: number | null; active: number }) => {
    if (await m.run(() => api2.put(`/subjects/${s.id}`, { name: s.name, areaId: s.areaId, active: !s.active }))) {
      toast(s.active ? `${s.name} inactiva: ya no sale para calificar ni en los cursos` : `${s.name} activa de nuevo`)
      reload()
    }
  }
  if (!setup) return <Spinner />
  const nActive = setup.subjects.filter((s) => s.active).length
  const subjects = setup.subjects.filter((s) => status === 'todos' || (status === 'activos' ? s.active : !s.active))
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="card p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg">Materias</h3>
          <button type="button" onClick={() => setSubject({ name: '', areaId: '', active: true })} className="btn btn-ghost !min-h-9 !px-3 !text-[13px]">
            <Plus size={15} /> Materia
          </button>
        </div>
        <div className="mt-3">
          <StatusTabs value={status} onChange={setStatus} counts={[nActive, setup.subjects.length - nActive]} labels={['Activas', 'Inactivas', 'Todas']} />
        </div>
        {m.message && <div className="mt-2"><ErrorBox message={m.message} /></div>}
        <ul className="mt-2 divide-y divide-line">
          {!subjects.length && <li className="py-3 text-sm text-muted">No hay materias {status === 'inactivos' ? 'inactivas' : 'activas'}.</li>}
          {subjects.map((s) => (
            <li key={s.id} className={`flex items-center gap-2 py-2 ${s.active ? '' : 'opacity-70'}`}>
              <span className="flex-1 font-semibold text-ink">{s.name}</span>
              <span className="text-[13px] text-muted">{setup.areas.find((a) => a.id === s.areaId)?.name ?? '—'}</span>
              <button type="button" disabled={m.busy} onClick={() => toggle(s)} className={`rounded-full px-2.5 py-0.5 text-[12px] font-bold ring-1 ${s.active ? 'text-muted ring-line hover:text-berry hover:ring-berry' : 'text-leaf ring-leaf'}`}>
                {s.active ? 'Inactivar' : 'Activar'}
              </button>
              <button type="button" aria-label="Editar" onClick={() => setSubject({ id: s.id, name: s.name, areaId: s.areaId ?? '', active: Boolean(s.active) })} className="text-muted hover:text-ink">
                <Pencil size={15} />
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-5">
        <AreasCard />
        <LevelsCard />
      </section>
      <Modal open={Boolean(subject)} onClose={() => setSubject(null)} label="Materia" closeLabel="Cerrar" className="sm:!max-w-md">
        {subject && (
          <div className="space-y-4 p-6">
            <h2 className="text-[1.4rem]">{subject.id ? 'Editar materia' : 'Nueva materia'}</h2>
            <Field label="Nombre" error={m.fields.name}>
              <input value={subject.name} onChange={(e) => setSubject({ ...subject, name: e.target.value })} className={inputCls(m.fields.name)} />
            </Field>
            <Field label="Dimensión">
              <select value={subject.areaId} onChange={(e) => setSubject({ ...subject, areaId: e.target.value ? Number(e.target.value) : '' })} className={inputCls()}>
                <option value="">—</option>
                {setup.areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
            <label className="flex items-center gap-2 font-semibold text-ink">
              <input type="checkbox" checked={subject.active} onChange={(e) => setSubject({ ...subject, active: e.target.checked })} className="size-5 accent-[#3a36a8]" /> Activa
            </label>
            {m.message && <ErrorBox message={m.message} />}
            <button type="button" disabled={m.busy} onClick={async () => { const body = { ...subject, areaId: subject.areaId || null }; if (await m.run(() => (subject.id ? api2.put(`/subjects/${subject.id}`, body) : api2.post('/subjects', body)))) { toast('Materia guardada'); setSubject(null); reload() } }} className="btn btn-primary w-full">
              Guardar
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}

