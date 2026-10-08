import { Camera, Loader2, Save } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { can } from '@/lib/calendar'
import { useMutation, useQuery } from '@/shared/useQuery'
import { age, fullName } from '@/shared/format'
import { toast } from '../../store'
import { preparePhoto } from '../../ui'
import { api2 } from '../../v2/api'
import { Drawer, ErrorBox, Spinner, StatusBadge, StudentAvatar, Tabs } from '../../v2/kit'
import { StatementView } from '../billing/StatementView'
import { AttendanceHistory } from '../attendance/AttendanceHistory'
import { ReportCardView } from '../grades/ReportCardView'
import { ObservationsTab } from '../observations/ObservationsTab'
import { closeStudent, studentsChanged, useOpenStudent } from './openStudent'
import { EnrollmentTab } from './EnrollmentTab'
import { FamilyTab } from './FamilyTab'
import { StudentForm, studentToForm } from './StudentForm'
import type { StudentDetail } from './types'

type Tab = 'ficha' | 'familia' | 'matricula' | 'cartera' | 'asistencia' | 'notas' | 'observador'

/** The student's complete file, opened from anywhere in the panel. */
export function StudentFile() {
  const open = useOpenStudent()
  const [tab, setTab] = useState<Tab>('ficha')
  useEffect(() => {
    if (open) setTab((open.tab as Tab) || 'ficha')
  }, [open])
  const { data, error, loading, reload, setData } = useQuery(open ? `student:${open.id}` : null, () => api2.get<StudentDetail>(`/students/${open!.id}`))
  const s = data?.student
  const current = data?.enrollments[0]

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: 'ficha', label: 'Ficha', show: true },
    { id: 'familia', label: 'Familia', show: true },
    { id: 'matricula', label: 'Matrícula', show: can('matriculas') || can('estudiantes') },
    { id: 'cartera', label: 'Cartera', show: can('pagos') },
    { id: 'asistencia', label: 'Asistencia', show: can('asistencia') },
    { id: 'notas', label: 'Notas', show: can('calificaciones') || can('academico') },
    { id: 'observador', label: 'Observador', show: can('observador') },
  ]

  return (
    <Drawer open={Boolean(open)} onClose={closeStudent} title={s ? fullName(s) : 'Estudiante'} wide>
      {error ? (
        <ErrorBox message={error.message} onRetry={reload} />
      ) : loading || !data || !s ? (
        <Spinner />
      ) : (
        <div className="space-y-5">
          <header className="card flex items-center gap-4 p-4">
            <PhotoButton detail={data} onChange={(d) => { setData(d); studentsChanged() }} />
            <div className="min-w-0">
              <p className="font-serif text-xl leading-tight font-semibold text-ink">{fullName(s)}</p>
              <p className="mt-1 text-[14px] text-muted">
                {s.code} · {age(s.birthDate)}
                {current && ` · ${current.year} ${current.course ?? ''}`}
              </p>
              {current && <div className="mt-1.5"><StatusBadge status={current.status} /></div>}
            </div>
          </header>
          <Tabs tabs={tabs.filter((t) => t.show)} value={tab} onChange={setTab} />
          {tab === 'ficha' && <PersonalTab detail={data} onSaved={(d) => { setData(d); studentsChanged() }} />}
          {tab === 'familia' && <FamilyTab detail={data} onChanged={reload} />}
          {tab === 'matricula' && <EnrollmentTab detail={data} onChanged={() => { reload(); studentsChanged() }} />}
          {tab === 'cartera' && <StatementView studentId={s.id} />}
          {tab === 'asistencia' && <AttendanceHistory studentId={s.id} />}
          {tab === 'notas' && <ReportCardView studentId={s.id} years={data.enrollments.map((e) => e.year)} />}
          {tab === 'observador' && <ObservationsTab studentId={s.id} />}
        </div>
      )}
    </Drawer>
  )
}

function PhotoButton({ detail, onChange }: { detail: StudentDetail; onChange: (d: StudentDetail) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const upload = async (f: File) => {
    setBusy(true)
    try {
      const blob = await preparePhoto(f, 720)
      const fd = new FormData()
      fd.append('photo', blob, 'foto.jpg')
      onChange(await api2.upload<StudentDetail>(`/students/${detail.student.id}/photo`, fd))
      toast('Foto actualizada')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo subir la foto')
    } finally {
      setBusy(false)
    }
  }
  return (
    // tap the photo → see it big; the camera button → change it
    <div className="relative shrink-0">
      <StudentAvatar s={{ ...detail.student, hasPhoto: detail.student.hasPhoto }} size={76} />
      {(can('estudiantes') || can('matriculas')) && (
        <button type="button" onClick={() => input.current?.click()} title="Cambiar foto" aria-label="Cambiar foto" className="absolute -right-1 -bottom-1 grid size-8 place-items-center rounded-full border-2 border-white bg-ink text-white hover:bg-royal">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
        </button>
      )}
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
    </div>
  )
}

function PersonalTab({ detail, onSaved }: { detail: StudentDetail; onSaved: (d: StudentDetail) => void }) {
  const [form, setForm] = useState(() => studentToForm(detail.student))
  const m = useMutation()
  const editable = can('estudiantes') || can('matriculas')
  return (
    <div className="card space-y-4 p-4 sm:p-6">
      <fieldset disabled={!editable} className="contents">
        <StudentForm value={form} onChange={setForm} errors={m.fields} />
      </fieldset>
      {m.message && <ErrorBox message={m.message} />}
      {editable && (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={m.busy}
            onClick={async () => {
              const r = await m.run(() => api2.put<StudentDetail>(`/students/${detail.student.id}`, form))
              if (r) {
                onSaved(r)
                toast('Datos guardados')
              }
            }}
            className="btn btn-primary"
          >
            {m.busy ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Guardar cambios
          </button>
        </div>
      )}
    </div>
  )
}
