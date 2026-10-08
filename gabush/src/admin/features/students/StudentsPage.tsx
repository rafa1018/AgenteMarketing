import { FileWarning, KeyRound, Phone, UserPlus, Users } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { useQuery } from '@/shared/useQuery'
import { age, listName } from '@/shared/format'
import { PageHead } from '../../ui'
import { api2, qs, useSetup } from '../../v2/api'
import { Badge, CourseSelect, Empty, ErrorBox, SearchBox, Spinner, StatusBadge, StudentAvatar, YearPicker } from '../../v2/kit'
import { openStudent, useStudentsVersion } from './openStudent'
import { NewStudentModal } from './NewStudentModal'
import type { StudentRow } from './types'

/** Students of the working year: filters by course / state, search by name, code, document or guardian. */
export function StudentsPage() {
  const { year } = useSetup()
  const version = useStudentsVersion()
  const [course, setCourse] = useState<number | null>(null)
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const dq = useDeferredValue(q.trim())
  const [creating, setCreating] = useState(false)
  const { data, error, loading, reload } = useQuery(year ? `students:${year}:${course}:${status}:${dq}:${version}` : null, () =>
    api2.get<{ students: StudentRow[] }>('/students' + qs({ year, course, status, q: dq.length >= 2 ? dq : null })),
  )
  const rows = data?.students ?? []
  const counts = useMemo(() => ({ activo: rows.filter((r) => r.status === 'activo').length, pre: rows.filter((r) => r.status === 'prematricula').length, ret: rows.filter((r) => r.status === 'retirado').length }), [rows])

  return (
    <div className="space-y-5">
      <PageHead
        title="Estudiantes"
        sub={data ? `${counts.activo} activos${counts.pre ? ` · ${counts.pre} en prematrícula` : ''}${counts.ret ? ` · ${counts.ret} retirados` : ''}` : 'Fichas, familias, matrícula y todo su historial.'}
        actions={
          <>
            <YearPicker />
            <button type="button" onClick={() => setCreating(true)} className="btn btn-primary">
              <UserPlus size={18} /> Nuevo estudiante
            </button>
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-[1fr_220px_180px]">
        <SearchBox value={q} onChange={setQ} placeholder="Nombre, código, documento o acudiente…" />
        <CourseSelect value={course} onChange={setCourse} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Estado" className="block min-h-[46px] w-full rounded-lg border border-[#d6d8ec] bg-white px-3.5 text-[16px]">
          <option value="">Todos los estados</option>
          <option value="activo">Activos</option>
          <option value="prematricula">Prematrícula</option>
          <option value="retirado">Retirados</option>
        </select>
      </div>

      {error ? (
        <ErrorBox message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Spinner />
      ) : !rows.length ? (
        <Empty icon={<Users />} title={dq ? 'Nadie coincide con la búsqueda' : 'No hay estudiantes con estos filtros'}>
          {!dq && 'Cambia el año o el curso, o registra un estudiante nuevo.'}
        </Empty>
      ) : (
        <ul className="grid gap-2.5 md:grid-cols-2">
          {rows.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => openStudent(s.id)} className="card flex w-full items-center gap-3 p-3.5 text-left transition-shadow hover:shadow-md sm:p-4">
                <StudentAvatar s={s} size={52} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate font-semibold text-ink">{listName(s)}</span>
                    {s.status && <StatusBadge status={s.status} />}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-muted">
                    {s.code} · {s.course ?? 'Sin curso'} · {age(s.birthDate)}
                  </span>
                  {s.guardian && (
                    <span className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-text">
                      <Phone size={13} className="shrink-0 text-muted" /> {s.guardian}
                      {s.guardianPhone && <span className="text-muted">· {s.guardianPhone}</span>}
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  {s.docsPending > 0 && (
                    <Badge tone="red">
                      <FileWarning size={12} /> {s.docsPending}
                    </Badge>
                  )}
                  {s.hasPortal > 0 && (
                    <Badge tone="violet">
                      <KeyRound size={12} /> Portal
                    </Badge>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <NewStudentModal open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}
