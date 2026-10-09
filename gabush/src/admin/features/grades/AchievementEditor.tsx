import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { useMutation } from '@/shared/useQuery'
import { toast } from '../../store'
import { api2 } from '../../v2/api'
import { ErrorBox, Field, inputCls } from '../../v2/kit'

export type AchievementDraft = { id?: number; description: string; levelId: number | null; period: number | null }

/**
 * New or edit achievement from the grade sheet (grade + subject come from the sheet). A teacher only edits or
 * deletes the ones she created; the school's bank stays with the rectora (the server checks it too).
 */
export function AchievementEditor({ draft, gradeLevelId, subjectId, periodNumber, levels, onClose, onSaved }: {
  draft: AchievementDraft | null
  gradeLevelId: number
  subjectId: number
  periodNumber: number
  levels: { id: number; name: string }[]
  onClose: () => void
  onSaved: () => void
}) {
  const [d, setD] = useState<AchievementDraft | null>(draft)
  const [last, setLast] = useState(draft)
  if (draft !== last) {
    setLast(draft)
    setD(draft)
  }
  const m = useMutation()
  const save = async () => {
    if (!d) return
    const body = { gradeLevelId, subjectId, period: d.period, levelId: d.levelId, description: d.description, active: true }
    if (await m.run(() => (d.id ? api2.put(`/achievements/${d.id}`, body) : api2.post('/achievements', body)))) {
      toast(d.id ? 'Logro actualizado' : 'Logro creado: ya puedes marcarlo')
      onSaved()
    }
  }
  const remove = async () => {
    if (!d?.id) return
    if (await m.run(() => api2.del(`/achievements/${d.id}`))) {
      toast('Logro eliminado')
      onSaved()
    }
  }
  return (
    <Modal open={Boolean(draft)} onClose={onClose} label="Logro" closeLabel="Cerrar" className="sm:!max-w-lg">
      {d && (
        <div className="space-y-4 p-6">
          <h2 className="text-[1.4rem]">{d.id ? 'Editar logro' : 'Nuevo logro'}</h2>
          <Field label="Descripción del logro" error={m.fields.description}>
            <textarea value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} rows={3} maxLength={600} placeholder="Ej.: Reconoce los colores primarios en su entorno." className={inputCls(m.fields.description) + ' resize-y py-2.5'} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nivel sugerido" hint="Al marcarlo a un niño puedes darle otro nivel.">
              <select value={d.levelId ?? ''} onChange={(e) => setD({ ...d, levelId: e.target.value ? Number(e.target.value) : null })} className={inputCls()}>
                <option value="">—</option>
                {levels.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Periodo">
              <select value={d.period ?? ''} onChange={(e) => setD({ ...d, period: e.target.value ? Number(e.target.value) : null })} className={inputCls()}>
                <option value={periodNumber}>Solo periodo {periodNumber}</option>
                <option value="">Todos los periodos</option>
              </select>
            </Field>
          </div>
          {m.message && <ErrorBox message={m.message} />}
          <button type="button" disabled={m.busy || d.description.trim().length < 3} onClick={save} className="btn btn-primary w-full disabled:opacity-60">
            Guardar logro
          </button>
          {d.id && (
            <button type="button" disabled={m.busy} onClick={remove} className="btn btn-ghost w-full text-berry">
              <Trash2 size={16} /> Eliminar logro
            </button>
          )}
        </div>
      )}
    </Modal>
  )
}
