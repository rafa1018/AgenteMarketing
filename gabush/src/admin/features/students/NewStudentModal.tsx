import { Loader2, Search, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { useMutation } from '@/shared/useQuery'
import { toast } from '../../store'
import { api2, qs, useSetup } from '../../v2/api'
import { CourseSelect, ErrorBox, Field, inputCls } from '../../v2/kit'
import { GuardianForm, emptyGuardian, type GuardianFormValue } from './GuardianForm'
import { openStudent, studentsChanged } from './openStudent'
import { ReturningStudent, lookupStudents, type FoundStudent } from './ReturningStudent'
import { StudentForm, emptyStudent } from './StudentForm'
import type { StudentDetail } from './types'

/**
 * New student: personal data, family (a new one with its guardians, or the family of a sibling already in
 * the school) and the enrollment of the working year (prematrícula or directly active).
 */
export function NewStudentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { setup, year } = useSetup()
  const [student, setStudent] = useState(emptyStudent)
  const [guardians, setGuardians] = useState<GuardianFormValue[]>([emptyGuardian('Madre')])
  const [sibling, setSibling] = useState<{ id: number; name: string; students: string } | null>(null)
  const [search, setSearch] = useState('')
  const [found, setFound] = useState<{ id: number; name: string; students: string }[]>([])
  const [course, setCourse] = useState<number | null>(null)
  const [status, setStatus] = useState<'prematricula' | 'activo'>('prematricula')
  const m = useMutation()
  // the document typed already belongs to someone → warn before creating a duplicate
  const [duplicate, setDuplicate] = useState<FoundStudent | null>(null)
  useEffect(() => {
    const doc = student.docNumber.replace(/[^0-9A-Za-z]/g, '')
    if (doc.length < 5) return setDuplicate(null)
    const t = window.setTimeout(() => lookupStudents({ doc, year }).then((r) => setDuplicate(r[0] ?? null)).catch(() => setDuplicate(null)), 400)
    return () => window.clearTimeout(t)
  }, [student.docNumber, year])

  const reset = () => {
    setStudent(emptyStudent())
    setGuardians([emptyGuardian('Madre')])
    setSibling(null)
    setSearch('')
    setFound([])
    setCourse(null)
  }

  const findFamily = async () => {
    if (search.trim().length < 2) return
    const r = await api2.get<{ families: { id: number; name: string; students: string }[] }>('/families' + qs({ q: search.trim() })).catch(() => ({ families: [] }))
    setFound(r.families)
  }

  const save = async () => {
    const r = await m.run(() =>
      api2.post<StudentDetail>('/students', {
        ...student,
        familyId: sibling?.id ?? null,
        guardians: sibling ? [] : guardians,
        year,
        courseId: course,
        status,
      }),
    )
    if (!r) return
    toast(`¡${r.student.firstName} quedó registrado con el código ${r.student.code}!`)
    studentsChanged()
    reset()
    onClose()
    openStudent(r.student.id, 'matricula')
  }

  return (
    <Modal open={open} onClose={onClose} label="Nuevo estudiante" closeLabel="Cerrar" className="sm:!max-w-3xl">
      <div className="space-y-6 p-5 sm:p-7">
        <h2 className="flex items-center gap-2 text-[1.6rem]">
          <UserPlus className="text-pink" /> Nuevo estudiante
        </h2>
        <ReturningStudent year={year} onDone={() => { reset(); onClose() }} />
        <p className="flex items-center gap-3 text-[13px] font-bold tracking-wide text-muted uppercase">
          <span className="h-px flex-1 bg-line" /> o registra un estudiante nuevo <span className="h-px flex-1 bg-line" />
        </p>
        <section>
          <h3 className="mb-3 text-lg">Datos del niño o la niña</h3>
          <StudentForm value={student} onChange={setStudent} errors={m.fields} />
          {duplicate && (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-butter px-4 py-3 text-[14px] text-[#8a5716]">
              <span className="min-w-0 flex-1">
                Ya existe un estudiante con ese documento: <b>{duplicate.firstName} {duplicate.lastName}</b> ({duplicate.code}
                {duplicate.lastYear ? `, último año ${duplicate.lastYear}` : ''}). No lo registres de nuevo.
              </span>
              <button type="button" onClick={() => { reset(); onClose(); openStudent(duplicate.id, 'matricula') }} className="btn btn-ghost !min-h-10 !text-sm">
                Abrir su ficha
              </button>
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-paper p-4">
          <h3 className="text-lg">Familia</h3>
          {sibling ? (
            <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-white p-3">
              <span>
                <b className="text-ink">{sibling.name}</b>
                <span className="block text-sm text-muted">Hermanos: {sibling.students || '—'}</span>
              </span>
              <button type="button" onClick={() => setSibling(null)} className="text-sm font-semibold text-berry">
                Quitar
              </button>
            </div>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted">¿Tiene un hermano en el jardín? Búscalo para usar la misma familia y sus acudientes.</p>
              <div className="mt-2 flex gap-2">
                <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), findFamily())} placeholder="Nombre del hermano o del acudiente" className={inputCls()} />
                <button type="button" onClick={findFamily} className="btn btn-ghost shrink-0">
                  <Search size={16} /> Buscar
                </button>
              </div>
              {found.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {found.map((f) => (
                    <li key={f.id}>
                      <button type="button" onClick={() => setSibling(f)} className="w-full rounded-lg bg-white px-3 py-2 text-left text-sm hover:ring-2 hover:ring-royal">
                        <b>{f.name}</b> <span className="text-muted">· {f.students || 'sin estudiantes'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 space-y-4">
                {guardians.map((g, i) => (
                  <div key={i} className="rounded-xl bg-white p-3.5">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-semibold text-ink">Acudiente {i + 1}</p>
                      {i > 0 && (
                        <button type="button" onClick={() => setGuardians(guardians.filter((_, j) => j !== i))} className="text-sm font-semibold text-berry">
                          Quitar
                        </button>
                      )}
                    </div>
                    <GuardianForm compact value={g} onChange={(v) => setGuardians(guardians.map((x, j) => (j === i ? v : x)))} />
                  </div>
                ))}
                {guardians.length < 3 && (
                  <button type="button" onClick={() => setGuardians([...guardians, emptyGuardian(guardians.length === 1 ? 'Padre' : 'Acudiente')])} className="text-sm font-semibold text-royal">
                    + Agregar otro acudiente
                  </button>
                )}
                {m.fields.guardians && <p className="text-sm font-semibold text-berry">{m.fields.guardians}</p>}
              </div>
            </>
          )}
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <Field label={`Curso ${year ?? ''}`}>
            <CourseSelect value={course} onChange={setCourse} allowAll={false} />
          </Field>
          <Field label="Estado">
            <select value={status} onChange={(e) => setStatus(e.target.value as 'prematricula' | 'activo')} className={inputCls()}>
              <option value="prematricula">Prematrícula (faltan documentos o pago)</option>
              <option value="activo">Matriculado (activo)</option>
            </select>
          </Field>
          {setup && !setup.courses.length && <p className="text-sm text-muted sm:col-span-2">Este año todavía no tiene cursos: créalos en Gestión académica.</p>}
        </section>

        {m.message && <ErrorBox message={m.message} />}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Cancelar
          </button>
          <button type="button" disabled={m.busy} onClick={save} className="btn btn-primary">
            {m.busy && <Loader2 size={18} className="animate-spin" />} Registrar estudiante
          </button>
        </div>
      </div>
    </Modal>
  )
}
