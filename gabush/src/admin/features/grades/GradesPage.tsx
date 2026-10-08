import { ChevronDown, Lock, Save, Send } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { can } from '@/lib/calendar'
import { cn } from '@/lib/utils'
import { LevelChip } from '@/shared/ReportCard'
import { useMutation, useQuery } from '@/shared/useQuery'
import { toast } from '../../store'
import { PageHead } from '../../ui'
import { api2, qs, useSetup } from '../../v2/api'
import { CourseSelect, Empty, ErrorBox, Spinner, StudentAvatar, Tabs, YearPicker, useTab } from '../../v2/kit'

type Sheet = {
  course: { id: number; name: string; gradeLevelId: number }
  period: { id: number; number: number; name: string; gradingOpen: boolean; published: boolean; publishedForAll: boolean }
  achievements: { id: number; levelId: number | null; period: number | null; description: string }[]
  students: { enrollmentId: number; id: number; code: string; name: string; hasPhoto: boolean; entry: Entry | null }[]
}
type Entry = { score: number | null; levelId: number | null; levelManual?: boolean; absences: number | null; comments: string | null; achievements: number[]; achievementLevels?: Record<string, number | null> }
/** achLevels: the level this child got in each marked achievement · level: subject level set by hand (null = automatic) */
type RowState = { achievements: number[]; achLevels: Record<string, number | null>; level: number | null; score: string; absences: string; comments: string }
const toRow = (e: Entry | null): RowState => ({
  achievements: e?.achievements ?? [],
  achLevels: e?.achievementLevels ?? {},
  level: e?.levelManual ? e.levelId : null,
  score: e?.score?.toString() ?? '',
  absences: e?.absences?.toString() ?? '',
  comments: e?.comments ?? '',
})

/**
 * Subject level when the teacher leaves it on "Automático" (same rules as the server): the score 0–10 when
 * typed, else the level repeated most among the marked achievements (ties → the higher one).
 */
function autoLevel(r: RowState, bank: Sheet['achievements'], levels: { id: number; min: string; max: string }[]): number | null {
  const score = Number(r.score.replace(',', '.'))
  if (r.score !== '' && !Number.isNaN(score)) {
    const byScore = levels.find((l) => score >= Number(l.min) && score <= Number(l.max))
    if (byScore) return byScore.id
  }
  const count = new Map<number, number>()
  for (const a of r.achievements) {
    const l = r.achLevels[a] ?? bank.find((x) => x.id === a)?.levelId ?? null
    if (l !== null) count.set(l, (count.get(l) ?? 0) + 1)
  }
  const rank = (id: number) => levels.findIndex((l) => l.id === id)
  let best: number | null = null
  for (const [id, n] of count) if (best === null || n > count.get(best)! || (n === count.get(best) && rank(id) > rank(best))) best = id
  return best
}

export function GradesPage() {
  const [tab, setTab] = useTab<'planilla' | 'avance'>('planilla')
  return (
    <div className="space-y-5">
      <PageHead title="Calificaciones" sub="Marca los logros de cada niño por materia y periodo. El boletín se arma solo." actions={<YearPicker />} />
      {can('academico') && <Tabs tabs={[{ id: 'planilla', label: 'Planilla' }, { id: 'avance', label: 'Avance del periodo' }]} value={tab} onChange={setTab} />}
      {tab === 'planilla' ? <SheetEditor /> : <Progress />}
    </div>
  )
}

function SheetEditor() {
  const { setup } = useSetup()
  const [course, setCourse] = useState<number | null>(null)
  const [subject, setSubject] = useState<number | ''>('')
  const [period, setPeriod] = useState<number | ''>('')
  useEffect(() => {
    if (!setup) return
    setPeriod((p) => p || setup.periods.find((x) => x.gradingOpen)?.id || setup.periods[0]?.id || '')
  }, [setup])
  const ready = course && subject && period
  const { data, error, loading, reload } = useQuery(ready ? `sheet:${course}:${subject}:${period}` : null, () => api2.get<Sheet>('/grades/sheet' + qs({ course, subject, period })))
  const [rows, setRows] = useState<Record<number, RowState>>({})
  const [open, setOpen] = useState<number | null>(null)
  const m = useMutation()
  useEffect(() => {
    setRows(Object.fromEntries((data?.students ?? []).map((s) => [s.enrollmentId, toRow(s.entry)])))
  }, [data])
  const levelName = (id: number | null) => setup?.levels.find((l) => l.id === id)?.name ?? null
  // levels a teacher can give (lowest first), without "No clasificado"
  const gradeLevels = (setup?.levels ?? []).filter((l) => Number(l.max) > 0).sort((a, b) => Number(a.min) - Number(b.min))
  const dirty = useMemo(() => JSON.stringify(rows) !== JSON.stringify(Object.fromEntries((data?.students ?? []).map((s) => [s.enrollmentId, toRow(s.entry)]))), [rows, data])
  const save = async () => {
    const payload = Object.entries(rows).map(([eid, r]) => ({
      enrollmentId: Number(eid),
      achievements: r.achievements,
      achievementLevels: Object.fromEntries(r.achievements.map((a) => [a, r.achLevels[a] ?? null])),
      levelId: r.level,
      score: r.score || null,
      absences: r.absences || null,
      comments: r.comments || null,
    }))
    const r = await m.run(() => api2.put<{ saved: number }>('/grades/sheet', { subjectId: subject, periodId: period, rows: payload }))
    if (r) {
      toast('Calificaciones guardadas')
      reload()
    }
  }
  const publish = async (published: boolean) => {
    if (published && dirty) return toast('Guarda la planilla antes de publicar')
    const r = await m.run(() => api2.post('/grades/publish', { courseId: course, periodId: period, published }))
    if (r) {
      toast(published ? 'Boletín publicado: las familias del curso reciben el aviso' : 'Boletín oculto para las familias del curso')
      reload()
    }
  }
  const markAll = (aid: number) => {
    const allHave = Object.values(rows).every((r) => r.achievements.includes(aid))
    setRows(Object.fromEntries(Object.entries(rows).map(([k, r]) => [k, { ...r, achievements: allHave ? r.achievements.filter((x) => x !== aid) : [...new Set([...r.achievements, aid])] }])))
  }
  if (!setup) return <Spinner />
  const sel = 'block min-h-[46px] w-full rounded-lg border border-[#d6d8ec] bg-white px-3'
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <CourseSelect value={course} onChange={setCourse} allowAll={false} />
        <select value={subject} onChange={(e) => setSubject(e.target.value ? Number(e.target.value) : '')} className={sel} aria-label="Materia">
          <option value="">Elige la materia…</option>
          {setup.subjects.filter((s) => s.active).map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select value={period} onChange={(e) => setPeriod(e.target.value ? Number(e.target.value) : '')} className={sel} aria-label="Periodo">
          {setup.periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.gradingOpen ? '' : ' (cerrado)'}
            </option>
          ))}
        </select>
      </div>
      {!ready ? (
        <Empty title="Elige curso, materia y periodo" />
      ) : error ? (
        <ErrorBox message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Spinner />
      ) : !data ? null : (
        <>
          {!data.period.gradingOpen && (
            <p className="flex items-center gap-2 rounded-xl bg-butter px-4 py-3 text-[14px] text-[#8a5716]">
              <Lock size={16} /> {data.period.name} está cerrado. {can('academico') ? 'Como rectora puedes corregir igual.' : 'Pídele a la rectora que lo abra para calificar.'}
            </p>
          )}
          <div className={cn('flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 text-[14px]', data.period.published ? 'bg-[#e9f4ee] text-leaf' : 'bg-paper text-muted')}>
            <Send size={16} className="shrink-0" />
            <span className="min-w-0 flex-1">
              {data.period.publishedForAll
                ? `${data.period.name} está publicado para todo el jardín: las familias ven estas notas.`
                : data.period.published
                  ? `Las familias de ${data.course.name} ya ven el boletín de ${data.period.name}. Lo que guardes se actualiza al instante.`
                  : `Las familias de ${data.course.name} aún no ven el boletín de ${data.period.name}. Publícalo cuando termines todas las materias del curso.`}
            </span>
            {!data.period.publishedForAll && (
              <button type="button" disabled={m.busy} onClick={() => publish(!data.period.published)} className={cn('btn !min-h-10 !text-sm', data.period.published ? 'btn-ghost' : 'btn-primary')}>
                {data.period.published ? 'Ocultar a las familias' : 'Publicar a las familias'}
              </button>
            )}
          </div>
          {!data.achievements.length ? (
            <Empty title="No hay logros para este grado, materia y periodo">Agrégalos en Gestión académica → Banco de logros.</Empty>
          ) : (
            <details className="card p-4">
              <summary className="cursor-pointer font-semibold text-ink">Marcar un logro a todo el curso ({data.achievements.length} disponibles)</summary>
              <ul className="mt-3 space-y-1.5">
                {data.achievements.map((a) => (
                  <li key={a.id}>
                    <button type="button" onClick={() => markAll(a.id)} className="flex w-full items-start gap-2 rounded-lg bg-paper px-3 py-2 text-left text-[14px] hover:ring-2 hover:ring-royal">
                      <LevelChip level={levelName(a.levelId)} /> <span>{a.description}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <ul className="space-y-2">
            {data.students.map((s) => {
              const r = rows[s.enrollmentId] ?? toRow(null)
              const isOpen = open === s.enrollmentId
              const set = (patch: Partial<RowState>) => setRows({ ...rows, [s.enrollmentId]: { ...r, ...patch } })
              const auto = autoLevel(r, data.achievements, gradeLevels)
              const shown = r.level ?? auto
              return (
                <li key={s.enrollmentId} className="card overflow-hidden p-0">
                  <button type="button" onClick={() => setOpen(isOpen ? null : s.enrollmentId)} className="flex w-full items-center gap-3 p-3 text-left">
                    <StudentAvatar s={{ id: s.id, firstName: s.name.split(', ')[1] ?? s.name, lastName: s.name, hasPhoto: s.hasPhoto }} name={s.name} size={40} />
                    <span className="min-w-0 flex-1 truncate font-semibold text-ink">{s.name}</span>
                    {shown !== null && <LevelChip level={levelName(shown)} />}
                    <span className={cn('rounded-full px-2.5 py-0.5 text-[12px] font-bold', r.achievements.length ? 'bg-[#e9f4ee] text-leaf' : 'bg-paper text-muted')}>{r.achievements.length} logros</span>
                    <ChevronDown size={18} className={cn('text-muted transition-transform', isOpen && 'rotate-180')} />
                  </button>
                  {isOpen && (
                    <div className="space-y-3 border-t border-line bg-paper/50 p-3">
                      <ul className="space-y-1.5">
                        {data.achievements.map((a) => {
                          const on = r.achievements.includes(a.id)
                          return (
                            <li key={a.id} className={cn('flex flex-wrap items-start gap-3 rounded-lg px-3 py-2 text-[14px]', on ? 'bg-white ring-2 ring-leaf' : 'bg-white')}>
                              <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                                <input type="checkbox" checked={on} onChange={() => set({ achievements: on ? r.achievements.filter((x) => x !== a.id) : [...r.achievements, a.id] })} className="mt-0.5 size-5 shrink-0 accent-[#3f9a1f]" />
                                <span className="flex-1">{a.description}</span>
                              </label>
                              {on ? (
                                // the teacher grades how the child did in this achievement (the bank level is only the suggestion)
                                <select
                                  value={r.achLevels[a.id] ?? a.levelId ?? ''}
                                  onChange={(e) => set({ achLevels: { ...r.achLevels, [a.id]: e.target.value ? Number(e.target.value) : null } })}
                                  aria-label="Desempeño del niño en este logro"
                                  className="rounded-lg border border-line bg-white px-2 py-1 text-[13px] font-semibold"
                                >
                                  {gradeLevels.map((l) => (
                                    <option key={l.id} value={l.id}>
                                      {l.name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="opacity-60" title="Nivel sugerido del banco de logros">
                                  <LevelChip level={levelName(a.levelId)} />
                                </span>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                      <label className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-3 py-2 text-[14px]">
                        <span className="font-semibold text-ink">Desempeño en la materia este periodo:</span>
                        <select value={r.level ?? ''} onChange={(e) => set({ level: e.target.value ? Number(e.target.value) : null })} className="rounded-lg border border-line bg-white px-2 py-1.5 font-semibold">
                          <option value="">Automático{auto !== null ? ` (${levelName(auto)})` : ''}</option>
                          {gradeLevels.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name}
                            </option>
                          ))}
                        </select>
                        <span className="text-[12px] text-muted">Automático = según la nota o los logros marcados.</span>
                      </label>
                      <div className="grid gap-2 sm:grid-cols-[120px_120px_1fr]">
                        <input value={r.score} onChange={(e) => setRows({ ...rows, [s.enrollmentId]: { ...r, score: e.target.value } })} inputMode="decimal" placeholder="Nota 0–10 (opcional)" title="Nota de 0 a 10. Si la escribes, define el desempeño de la materia; si no, sale de los logros marcados." className={`rounded-lg border px-3 py-2 ${Number(r.score.replace(',', '.')) > 10 ? 'border-berry' : 'border-line'}`} aria-label="Nota de 0 a 10" />
                        <input value={r.absences} onChange={(e) => setRows({ ...rows, [s.enrollmentId]: { ...r, absences: e.target.value } })} inputMode="numeric" placeholder="Fallas" className="rounded-lg border border-line px-3 py-2" aria-label="Fallas" />
                        <input value={r.comments} onChange={(e) => setRows({ ...rows, [s.enrollmentId]: { ...r, comments: e.target.value } })} placeholder="Comentario para la familia (opcional)" className="rounded-lg border border-line px-3 py-2" aria-label="Comentario" />
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          <div className="sticky bottom-20 z-10 flex items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-white shadow-lg lg:bottom-4">
            <span className="text-sm">{dirty ? 'Hay cambios sin guardar' : 'Todo guardado'}</span>
            <button type="button" disabled={!dirty || m.busy} onClick={save} className="btn btn-gold ml-auto !min-h-10 !text-sm disabled:opacity-50">
              <Save size={17} /> Guardar planilla
            </button>
          </div>
          {m.message && <ErrorBox message={m.message} />}
        </>
      )}
    </div>
  )
}

function Progress() {
  const { setup } = useSetup()
  const [period, setPeriod] = useState<number | ''>('')
  useEffect(() => {
    if (setup && !period) setPeriod(setup.periods.find((p) => p.gradingOpen)?.id ?? setup.periods[0]?.id ?? '')
  }, [setup, period])
  const { data, error, loading, reload } = useQuery(period ? `progress:${period}` : null, () => api2.get<{ progress: { courseId: number; course: string; subjectId: number; subject: string; teacher: string | null; students: number; graded: number }[] }>('/grades/progress' + qs({ period })))
  return (
    <div className="space-y-3">
      <select value={period} onChange={(e) => setPeriod(Number(e.target.value))} className="rounded-lg border border-line bg-white px-3 py-2 font-semibold" aria-label="Periodo">
        {setup?.periods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      {error ? (
        <ErrorBox message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Spinner />
      ) : !data?.progress.length ? (
        <Empty title="No hay materias asignadas a los cursos de este año" />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {data.progress.map((p) => {
            const pct = p.students ? Math.round((p.graded / p.students) * 100) : 0
            return (
              <li key={`${p.courseId}:${p.subjectId}`} className="card p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-ink">
                    {p.course} · {p.subject}
                  </span>
                  <span className={cn('text-sm font-bold', pct === 100 ? 'text-leaf' : 'text-muted')}>
                    {p.graded}/{p.students}
                  </span>
                </div>
                <p className="text-[13px] text-muted">{p.teacher ?? 'Sin docente'}</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-paper">
                  <div className={cn('h-full rounded-full', pct === 100 ? 'bg-leaf' : 'bg-gold')} style={{ width: `${pct}%` }} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
