import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { LevelChip } from '@/shared/ReportCard'
import { useMutation, useQuery } from '@/shared/useQuery'
import { toast } from '../../store'
import { api2, qs, useSetup } from '../../v2/api'
import { Empty, ErrorBox, Field, SearchBox, Spinner, inputCls } from '../../v2/kit'

type Ach = { id: number; gradeLevelId: number; subjectId: number; period: number | null; levelId: number | null; description: string; active: number; createdBy: string | null; used: number }

/** Banco de logros: by grade / subject / period; teachers pick from it when grading. */
export function AchievementsBank() {
  const { setup } = useSetup()
  const [grade, setGrade] = useState<number | ''>('')
  const [subject, setSubject] = useState<number | ''>('')
  const [period, setPeriod] = useState<number | ''>('')
  const [q, setQ] = useState('')
  const dq = useDeferredValue(q)
  const [editing, setEditing] = useState<Partial<Ach> | null>(null)
  const { data, error, loading, reload } = useQuery(`ach:${grade}:${subject}:${period}:${dq}`, () => api2.get<{ achievements: Ach[] }>('/achievements' + qs({ grade, subject, period, q: dq })))
  const m = useMutation()
  if (!setup) return <Spinner />
  const levelName = (id: number | null) => setup.levels.find((l) => l.id === id)?.name ?? null
  const sel = 'block min-h-[46px] w-full rounded-lg border border-[#d6d8ec] bg-white px-3'
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-4">
        <select value={grade} onChange={(e) => setGrade(e.target.value ? Number(e.target.value) : '')} className={sel} aria-label="Grado">
          <option value="">Todos los grados</option>
          {setup.gradeLevels.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <select value={subject} onChange={(e) => setSubject(e.target.value ? Number(e.target.value) : '')} className={sel} aria-label="Materia">
          <option value="">Todas las materias</option>
          {setup.subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select value={period} onChange={(e) => setPeriod(e.target.value ? Number(e.target.value) : '')} className={sel} aria-label="Periodo">
          <option value="">Todos los periodos</option>
          {[1, 2, 3, 4].map((p) => (
            <option key={p} value={p}>Periodo {p}</option>
          ))}
        </select>
        <button type="button" onClick={() => setEditing({ gradeLevelId: grade || setup.gradeLevels[0]?.id, subjectId: subject || setup.subjects[0]?.id, period: period || null, levelId: setup.levels[setup.levels.length - 1]?.id })} className="btn btn-primary !text-sm">
          <Plus size={17} /> Nuevo logro
        </button>
      </div>
      <SearchBox value={q} onChange={setQ} placeholder="Buscar en la descripción…" />
      {error ? (
        <ErrorBox message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Spinner />
      ) : !data?.achievements.length ? (
        <Empty title="Sin logros con estos filtros" />
      ) : (
        <ul className="space-y-2">
          {data.achievements.map((a) => (
            <li key={a.id} className="card flex items-start gap-3 p-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] text-text">{a.description}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-muted">
                  {setup.gradeLevels.find((g) => g.id === a.gradeLevelId)?.name} · {setup.subjects.find((s) => s.id === a.subjectId)?.name} · {a.period ? `P${a.period}` : 'Cualquier periodo'} <LevelChip level={levelName(a.levelId)} /> · usado {a.used} veces
                </p>
              </div>
              <button type="button" aria-label="Editar" onClick={() => setEditing(a)} className="text-muted hover:text-ink">
                <Pencil size={16} />
              </button>
              <button type="button" aria-label="Eliminar" onClick={async () => { await api2.del(`/achievements/${a.id}`).catch(() => null); toast(a.used ? 'Logro ocultado (se conserva en los boletines)' : 'Logro eliminado'); reload() }} className="text-muted hover:text-berry">
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} label="Logro" closeLabel="Cerrar" className="sm:!max-w-lg">
        {editing && (
          <div className="space-y-4 p-6">
            <h2 className="text-[1.4rem]">{editing.id ? 'Editar logro' : 'Nuevo logro'}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Grado">
                <select value={editing.gradeLevelId} onChange={(e) => setEditing({ ...editing, gradeLevelId: Number(e.target.value) })} className={inputCls()}>
                  {setup.gradeLevels.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </Field>
              <Field label="Materia">
                <select value={editing.subjectId} onChange={(e) => setEditing({ ...editing, subjectId: Number(e.target.value) })} className={inputCls()}>
                  {setup.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="Periodo">
                <select value={editing.period ?? ''} onChange={(e) => setEditing({ ...editing, period: e.target.value ? Number(e.target.value) : null })} className={inputCls()}>
                  <option value="">Cualquiera</option>
                  {[1, 2, 3, 4].map((p) => <option key={p} value={p}>Periodo {p}</option>)}
                </select>
              </Field>
              <Field label="Nivel de desempeño">
                <select value={editing.levelId ?? ''} onChange={(e) => setEditing({ ...editing, levelId: e.target.value ? Number(e.target.value) : null })} className={inputCls()}>
                  {setup.levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Descripción del logro" error={m.fields.description}>
              <textarea value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={3} className={inputCls(m.fields.description)} placeholder="Desarrolla su motricidad fina mediante el moldeado de plastilina…" />
            </Field>
            {m.message && <ErrorBox message={m.message} />}
            <button type="button" disabled={m.busy} onClick={async () => { const body = { ...editing, active: true }; if (await m.run(() => (editing.id ? api2.put(`/achievements/${editing.id}`, body) : api2.post('/achievements', body)))) { toast('Logro guardado'); setEditing(null); reload() } }} className="btn btn-primary w-full">
              Guardar
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}
