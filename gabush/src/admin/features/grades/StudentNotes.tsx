import { FileDown, MessageSquareText, Save, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@/shared/useQuery'
import { toast } from '../../store'
import { api2, qs } from '../../v2/api'
import { ErrorBox, StudentAvatar } from '../../v2/kit'
import type { FoundRow } from './StudentFinder'

type Notes = { enrollmentId: number; courseId: number | null; course: string | null; notes: Record<string, string> }

/**
 * The child picked in the search box: their report card for the chosen period (no subject needed) and the
 * general observation that prints in the «Observaciones» box at the end of the boletín.
 */
export function StudentNotes({ student, year, periods, period, onPeriod, onClose, onSaved }: {
  onSaved?: () => void
  student: FoundRow
  year: number | null
  periods: { id: number; name: string }[]
  period: number | ''
  onPeriod: (p: number) => void
  onClose: () => void
}) {
  // '' → the chosen period of the sheet; 'final' → informe final
  const [which, setWhich] = useState<string>(String(period))
  useEffect(() => setWhich(String(period)), [period])
  const { data, error, reload } = useQuery(`notes:${student.id}:${year}`, () => api2.get<Notes>('/grades/notes' + qs({ student: student.id, year })))
  const saved = data?.notes[which] ?? ''
  const [text, setText] = useState('')
  useEffect(() => setText(saved), [saved, which])
  const m = useMutation()
  const save = async () => {
    if (!data) return
    const r = await m.run(() => api2.put('/grades/notes', { enrollmentId: data.enrollmentId, periodId: which, body: text }))
    if (r) {
      toast(text.trim() ? 'Observación guardada: ya sale en el boletín' : 'Observación borrada')
      reload()
      onSaved?.()
    }
  }
  const name = `${student.firstName} ${student.lastName} ${student.secondLastName ?? ''}`.trim()
  const label = which === 'final' ? 'Informe final' : periods.find((p) => String(p.id) === which)?.name ?? 'Periodo'
  return (
    <section className="card space-y-4 p-4 ring-2 ring-royal/30">
      <div className="flex items-center gap-3">
        <StudentAvatar s={student} size={48} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-[1.15rem] font-semibold text-ink">{name}</p>
          <p className="text-[13px] text-muted">{student.course}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="grid size-9 place-items-center rounded-full text-muted hover:bg-paper hover:text-ink">
          <X size={18} />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={which}
          onChange={(e) => {
            setWhich(e.target.value)
            if (e.target.value !== 'final') onPeriod(Number(e.target.value))
          }}
          aria-label="Periodo del boletín"
          className="min-h-11 rounded-lg border border-[#d6d8ec] bg-white px-3 font-semibold"
        >
          {periods.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
          <option value="final">Informe final</option>
        </select>
        <a href={`/api/v2/students/${student.id}/boletin?year=${year ?? ''}&period=${which}`} target="_blank" rel="noopener" className="btn btn-primary !min-h-11 !text-sm">
          <FileDown size={17} /> Ver y descargar boletín · {label}
        </a>
      </div>
      <div>
        <label htmlFor="obs-general" className="mb-1 flex items-center gap-2 text-[14px] font-semibold text-ink">
          <MessageSquareText size={17} className="text-royal" /> Observación final del boletín · {label}
        </label>
        <p className="mb-2 text-[12px] text-muted">Sale en el recuadro «Observación final» al terminar el boletín. La observación de cada materia se escribe en la planilla de esa materia.</p>
        {error ? (
          <ErrorBox message={error.message} onRetry={reload} />
        ) : (
          <textarea id="obs-general" value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000} disabled={!data} placeholder="Ej.: Sofía es una niña alegre y participativa; este periodo avanzó mucho en…" className="w-full resize-y rounded-lg border border-line px-3 py-2.5" />
        )}
        <div className="mt-2 flex items-center gap-3">
          {m.message && <span className="text-sm text-berry">{m.message}</span>}
          <button type="button" disabled={!data || m.busy || text === saved} onClick={save} className="btn btn-gold ml-auto !min-h-10 !text-sm disabled:opacity-50">
            <Save size={16} /> Guardar observación
          </button>
        </div>
      </div>
      <p className="border-t border-line pt-3 text-[13px] text-muted">Para calificar sus logros, elige la materia abajo: se abre su fila en la planilla.</p>
    </section>
  )
}
