import { ChevronDown, FileDown, Lock, Pencil, Plus, Save, Send } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { can } from '@/lib/calendar'
import { cn } from '@/lib/utils'
import { LevelChip } from '@/shared/ReportCard'
import { useMutation, useQuery } from '@/shared/useQuery'
import { toast } from '../../store'
import { PageHead } from '../../ui'
import { api2, qs, useSetup } from '../../v2/api'
import { CourseSelect, Empty, ErrorBox, Spinner, StudentAvatar, Tabs, YearPicker, useTab } from '../../v2/kit'
import { AchievementEditor, type AchievementDraft } from './AchievementEditor'
import { StudentFinder, type FoundRow } from './StudentFinder'
import { StudentNotes } from './StudentNotes'

type Sheet = {
  course: { id: number; name: string; gradeLevelId: number }
  period: { id: number; number: number; name: string; gradingOpen: boolean; published: boolean; publishedForAll: boolean }
  achievements: { id: number; levelId: number | null; period: number | null; description: string; editable?: boolean }[]
  /** note: the child's final observation of the period (the same in every subject sheet) */
  students: { enrollmentId: number; id: number; code: string; name: string; hasPhoto: boolean; entry: Entry | null; note: string }[]
}
type Entry = { score: number | null; levelId: number | null; levelManual?: boolean; absences: number | null; comments: string | null; achievements: number[]; achievementLevels?: Record<string, number | null> }
/** achLevels: the level this child got in each marked achievement · level: subject level set by hand (null = automatic) */
type RowState = { achievements: number[]; achLevels: Record<string, number | null>; level: number | null; score: string; absences: string; comments: string; note: string }
const toRow = (e: Entry | null, note = ''): RowState => ({
  note,
  achievements: e?.achievements ?? [],
  achLevels: e?.achievementLevels ?? {},
  level: e?.levelManual ? e.levelId : null,
  score: e?.score?.toString() ?? '',
  absences: e?.absences?.toString() ?? '',
  comments: e?.comments ?? '',
})

/**
 * Score that matches a level chosen by hand: the current one when it already falls in the level's range,
 * otherwise the middle of the range rounded to one decimal (Aceptable 6.0–7.9 → 7.0, Bueno → 8.5, Excelente → 9.5).
 */
function scoreIn(current: string, level: { min: string; max: string }, top: number): string {
  const min = Number(level.min)
  const max = Number(level.max)
  const now = Number(current.replace(',', '.'))
  if (current !== '' && !Number.isNaN(now) && now >= min && now <= max) return current
  const mid = (min + max) / 2
  // 0–100: whole numbers (Aceptable 60–79 → 70) · 0–10: one decimal
  return top > 10 ? String(Math.round(mid)) : (Math.round(mid * 10) / 10).toFixed(1)
}

/** Colours of the selected level button (same family as the report-card chips). */
const LEVEL_ON: Record<string, string> = {
  Excelente: 'bg-[#e9f4ee] text-leaf ring-leaf',
  Bueno: 'bg-[#eaf3fa] text-[#185a8a] ring-[#2f7fc1]',
  Aceptable: 'bg-butter text-[#8a5716] ring-[#e2a33b]',
  Insuficiente: 'bg-[#fdf0ef] text-berry ring-berry',
}

/**
 * Subject level when the teacher leaves it on "Automático" (same rules as the server): the score 0–10 when
 * typed, else the level repeated most among the marked achievements (ties → the higher one).
 */
function autoLevel(r: RowState, bank: Sheet['achievements'], levels: { id: number; min: string; max: string }[]): number | null {
  const score = Number(r.score.replace(',', '.'))
  const top = Math.max(0, ...levels.map((l) => Number(l.max)))
  if (r.score !== '' && !Number.isNaN(score) && score >= 0 && score <= top) {
    // the level whose minimum the score reaches (same rule as the server)
    const byScore = [...levels].sort((a, b) => Number(a.min) - Number(b.min)).filter((l) => score >= Number(l.min)).pop()
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
  const { setup, year } = useSetup()
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
  // a child picked in the search box: their row opens (and scrolls into view) once their course sheet loads
  const [pending, setPending] = useState<number | null>(null)
  const [picked, setPicked] = useState<FoundRow | null>(null)
  useEffect(() => {
    if (!pending || !data?.students.some((s) => s.enrollmentId === pending)) return
    setOpen(pending)
    setPending(null)
    requestAnimationFrame(() => document.getElementById(`alumno-${pending}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [data, pending])
  const m = useMutation()
  useEffect(() => {
    setRows(Object.fromEntries((data?.students ?? []).map((s) => [s.enrollmentId, toRow(s.entry, s.note)])))
  }, [data])
  // a teacher only sees her courses (director or teacher) and, in each, the subjects assigned to her;
  // with just one course / subject it is picked by itself
  const mine = setup?.me?.courses ?? null
  const mySubjects = setup?.me?.subjects ?? null
  const subjectOptions = (setup?.subjects ?? []).filter((s) => s.active && (!mySubjects || (course !== null && (mySubjects[course] ?? []).includes(s.id))))
  useEffect(() => {
    if (mine?.length === 1 && !course) setCourse(mine[0])
  }, [mine, course])
  useEffect(() => {
    if (!mySubjects || course === null) return
    const own = mySubjects[course] ?? []
    if (subject && !own.includes(subject)) setSubject('')
    else if (!subject && own.length === 1) setSubject(own[0])
  }, [mySubjects, course, subject])
  const [ach, setAch] = useState<AchievementDraft | null>(null)
  const levelName = (id: number | null) => setup?.levels.find((l) => l.id === id)?.name ?? null
  const subjectName = setup?.subjects.find((s) => s.id === subject)?.name ?? ''
  // levels a teacher can give (lowest first), without "No clasificado"
  const gradeLevels = (setup?.levels ?? []).filter((l) => Number(l.max) > 0).sort((a, b) => Number(a.min) - Number(b.min))
  const top = Math.max(10, ...gradeLevels.map((l) => Number(l.max))) // the school's scale: 0–100
  const dirty = useMemo(() => JSON.stringify(rows) !== JSON.stringify(Object.fromEntries((data?.students ?? []).map((s) => [s.enrollmentId, toRow(s.entry, s.note)]))), [rows, data])
  const save = async () => {
    const payload = Object.entries(rows).map(([eid, r]) => ({
      enrollmentId: Number(eid),
      achievements: r.achievements,
      achievementLevels: Object.fromEntries(r.achievements.map((a) => [a, r.achLevels[a] ?? null])),
      levelId: r.level,
      score: r.score || null,
      absences: r.absences || null,
      comments: r.comments || null,
      note: r.note,
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
      <StudentFinder
        year={year}
        only={mine}
        onPick={(s) => {
          setCourse(s.courseId)
          setPending(s.enrollmentId)
          setPicked(s)
        }}
      />
      {picked && <StudentNotes key={picked.id} student={picked} year={year} periods={setup.periods} period={period} onPeriod={setPeriod} onClose={() => setPicked(null)} onSaved={() => ready && reload()} />}
      <div className="grid gap-2 sm:grid-cols-3">
        <CourseSelect value={course} onChange={setCourse} allowAll={false} only={mine} />
        <select value={subject} onChange={(e) => setSubject(e.target.value ? Number(e.target.value) : '')} className={sel} aria-label="Materia">
          <option value="">Elige la materia…</option>
          {subjectOptions.map((s) => (
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
      {mine && !mine.length ? (
        <Empty title={`No tienes cursos asignados en ${year}`}>
          Pídele a la rectora que te asigne como director(a) de grupo o como docente de alguna materia (Gestión académica → Cursos) y que tu usuario esté vinculado a tu ficha de personal (Usuarios).
        </Empty>
      ) : mySubjects && course !== null && !subjectOptions.length ? (
        <Empty title="No tienes materias asignadas en este curso">Puedes ver los boletines del curso, pero para calificar la rectora debe asignarte materias (Gestión académica → Cursos → Materias del curso y docente).</Empty>
      ) : !ready ? (
        <Empty title={course && period ? 'Elige la materia para calificar' : 'Elige curso, materia y periodo'}>
          {course && period ? (
            <a href={`/api/v2/courses/${course}/boletines?period=${period}`} target="_blank" rel="noopener" className="btn btn-ghost mt-3 !min-h-10 !text-sm">
              <FileDown size={16} /> Boletines del curso (PDF)
            </a>
          ) : null}
        </Empty>
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
            <a href={`/api/v2/courses/${data.course.id}/boletines?period=${data.period.id}`} target="_blank" rel="noopener" className="btn btn-ghost !min-h-10 !text-sm" title="Un boletín por estudiante, listo para descargar en PDF o imprimir">
              <FileDown size={16} /> Boletines del curso (PDF)
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 flex-1 text-[14px] text-muted">{data.achievements.length ? `${data.achievements.length} logros para esta materia y periodo.` : 'Aún no hay logros para este grado, materia y periodo.'}</p>
            <button type="button" onClick={() => setAch({ description: '', levelId: null, period: data.period.number })} className="btn btn-primary !min-h-10 !text-sm">
              <Plus size={16} /> Nuevo logro
            </button>
          </div>
          {data.achievements.length > 0 && (
            <details className="card p-4">
              <summary className="cursor-pointer font-semibold text-ink">Logros de la materia: marcar a todo el curso o editar los tuyos</summary>
              <ul className="mt-3 space-y-1.5">
                {data.achievements.map((a) => (
                  <li key={a.id} className="flex items-start gap-1">
                    <button type="button" onClick={() => markAll(a.id)} title="Marcar (o desmarcar) a todo el curso" className="flex min-w-0 flex-1 items-start gap-2 rounded-lg bg-paper px-3 py-2 text-left text-[14px] hover:ring-2 hover:ring-royal">
                      <LevelChip level={levelName(a.levelId)} /> <span>{a.description}</span>
                    </button>
                    {a.editable && (
                      <button type="button" aria-label="Editar logro" onClick={() => setAch({ id: a.id, description: a.description, levelId: a.levelId, period: a.period })} className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-paper hover:text-ink">
                        <Pencil size={15} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[12px] text-muted">Tocar un logro lo marca a todo el curso. Solo puedes editar o eliminar los logros que tú creaste.</p>
            </details>
          )}
          <AchievementEditor
            draft={ach}
            gradeLevelId={data.course.gradeLevelId}
            subjectId={Number(subject)}
            periodNumber={data.period.number}
            levels={gradeLevels}
            onClose={() => setAch(null)}
            onSaved={() => {
              setAch(null)
              reload()
            }}
          />
          <ul className="space-y-2">
            {data.students.map((s) => {
              const r = rows[s.enrollmentId] ?? toRow(null)
              const isOpen = open === s.enrollmentId
              const set = (patch: Partial<RowState>) => setRows({ ...rows, [s.enrollmentId]: { ...r, ...patch } })
              const auto = autoLevel(r, data.achievements, gradeLevels)
              const shown = r.level ?? auto
              return (
                <li key={s.enrollmentId} id={`alumno-${s.enrollmentId}`} className={cn('card scroll-mt-24 overflow-hidden p-0', isOpen && 'ring-2 ring-royal/40')}>
                  <div className="flex items-center gap-2 pr-3">
                  <button type="button" onClick={() => setOpen(isOpen ? null : s.enrollmentId)} className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left">
                    <StudentAvatar s={{ id: s.id, firstName: s.name.split(', ')[1] ?? s.name, lastName: s.name, hasPhoto: s.hasPhoto }} name={s.name} size={40} />
                    <span className="min-w-0 flex-1 truncate font-semibold text-ink">{s.name}</span>
                    {shown !== null && <LevelChip level={levelName(shown)} />}
                    <span className={cn('rounded-full px-2.5 py-0.5 text-[12px] font-bold', r.achievements.length ? 'bg-[#e9f4ee] text-leaf' : 'bg-paper text-muted')}>{r.achievements.length} logros</span>
                    <ChevronDown size={18} className={cn('text-muted transition-transform', isOpen && 'rotate-180')} />
                  </button>
                  <a href={`/api/v2/students/${s.id}/boletin?year=${year}&period=${data.period.id}`} target="_blank" rel="noopener" title={`Boletín de ${s.name} (PDF)`} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#fde7f1] px-3 py-1.5 text-[12px] font-bold text-pink hover:bg-pink hover:text-white">
                    <FileDown size={14} /> <span className="hidden sm:inline">Boletín</span>
                  </a>
                  </div>
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
                      <section className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-line">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <h4 className="font-serif text-[1.05rem] font-semibold text-ink">Calificación del periodo</h4>
                          <span className="text-[12px] text-muted">Lo que elijas aquí es lo que ve la familia en el boletín.</span>
                        </div>
                        <div>
                          <p className="mb-2 text-[13px] font-bold tracking-wide text-muted uppercase">Desempeño en la materia</p>
                          <div role="radiogroup" aria-label="Desempeño en la materia" className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              role="radio"
                              aria-checked={r.level === null}
                              onClick={() => set({ level: null })}
                              className={cn('rounded-full px-3.5 py-2 text-[14px] font-semibold transition-colors', r.level === null ? 'bg-ink text-white' : 'bg-paper text-muted hover:text-ink')}
                            >
                              Automático{auto !== null ? ` · ${levelName(auto)}` : ''}
                            </button>
                            {gradeLevels.map((l) => {
                              const on = r.level === l.id
                              return (
                                <button key={l.id} type="button" role="radio" aria-checked={on} onClick={() => set({ level: l.id, score: scoreIn(r.score, l, top) })} className={cn('rounded-full px-3.5 py-2 text-[14px] font-semibold ring-2 transition-colors', on ? LEVEL_ON[l.name] ?? 'bg-royal text-white ring-royal' : 'bg-white text-text ring-line hover:ring-ink/30')}>
                                  {l.name}
                                </button>
                              )
                            })}
                          </div>
                          <p className="mt-1.5 text-[12px] text-muted">Automático: sale de la nota o, si no hay nota, del nivel que más se repite en los logros marcados.</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-[160px_120px]">
                          <label className="block">
                            <span className="mb-1 block text-[13px] font-semibold text-ink">Nota (0 a {top})</span>
                            <input value={r.score} onChange={(e) => set({ score: e.target.value, level: null })} inputMode="decimal" placeholder="Opcional" className={cn('w-full rounded-lg border px-3 py-2.5', Number(r.score.replace(',', '.')) > top ? 'border-berry' : 'border-line')} />
                            {Number(r.score.replace(',', '.')) > top && <span className="mt-1 block text-[12px] text-berry">Debe ser de 0 a {top}</span>}
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-[13px] font-semibold text-ink">Fallas</span>
                            <input value={r.absences} onChange={(e) => set({ absences: e.target.value })} inputMode="numeric" placeholder="0" className="w-full rounded-lg border border-line px-3 py-2.5" />
                          </label>
                        </div>
                        <label className="block">
                          <span className="mb-1 block text-[13px] font-semibold text-ink">Observación de la materia · {subjectName}</span>
                          <textarea value={r.comments} onChange={(e) => set({ comments: e.target.value })} rows={2} placeholder="Opcional: cómo le fue en esta materia. Sale debajo de la materia en el boletín." className="w-full resize-y rounded-lg border border-line px-3 py-2.5" />
                        </label>
                      </section>
                      <section className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-line">
                        <h4 className="font-serif text-[1.05rem] font-semibold text-ink">Observación final del boletín · {data.period.name}</h4>
                        <p className="text-[12px] text-muted">Una sola por niño y periodo (no por materia): sale en el recuadro «Observación final» al terminar el boletín. Si otra docente la escribió, aquí la ves y puedes completarla.</p>
                        <textarea value={r.note} onChange={(e) => set({ note: e.target.value })} rows={3} maxLength={2000} placeholder="Ej.: Es un niño alegre y participativo; este periodo avanzó mucho en…" className="w-full resize-y rounded-lg border border-line px-3 py-2.5" />
                      </section>
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
