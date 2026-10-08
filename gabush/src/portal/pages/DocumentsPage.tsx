import { CheckCircle2, Clock, FileText, Loader2, Upload, XCircle } from 'lucide-react'
import { useRef, useState } from 'react'
import { ApiError } from '@/shared/api'
import { dateTime } from '@/shared/format'
import { useQuery } from '@/shared/useQuery'
import { api, toast } from '../session'
import { Chip, Loading, Problem, Title } from '../ui'

interface Doc {
  typeId: number
  name: string
  description: string | null
  required: number
  familyUpload: number
  id: number
  status: 'pendiente' | 'recibido' | 'aprobado' | 'rechazado'
  fileName: string | null
  uploadedAt: string | null
  note: string | null
}

const STATUS = {
  pendiente: { label: 'Pendiente', tone: 'yellow', icon: Clock },
  recibido: { label: 'En revisión', tone: 'blue', icon: Clock },
  aprobado: { label: 'Aprobado', tone: 'green', icon: CheckCircle2 },
  rechazado: { label: 'Corregir', tone: 'red', icon: XCircle },
} as const

/** Enrollment documents of the current year: what is missing, what the school approved, upload from the phone. */
export function DocumentsPage() {
  const q = useQuery('documents', () => api.get<{ enrollmentId?: number; documents: Doc[] }>('/portal/documents'))
  const docs = q.data?.documents ?? []
  const missing = docs.filter((d) => d.required && (d.status === 'pendiente' || d.status === 'rechazado')).length
  return (
    <>
      <Title sub="Sube desde tu celular los documentos de matrícula (foto o PDF, máximo 10 MB).">Documentos</Title>
      {q.loading && <Loading />}
      {q.error && <Problem message={q.error.message} onRetry={q.reload} />}
      {q.data && !docs.length && <p className="card p-6 text-center text-muted">No hay documentos pendientes para este año.</p>}
      {docs.length > 0 && (
        <p className={`mb-3 rounded-xl px-4 py-3 text-sm ${missing ? 'bg-butter text-[#8a5716]' : 'bg-[#e9f4ee] text-leaf'}`}>
          {missing ? `Faltan ${missing} ${missing === 1 ? 'documento obligatorio' : 'documentos obligatorios'}.` : '¡Tienes todos los documentos obligatorios!'}
        </p>
      )}
      <ul className="space-y-2">
        {docs.map((d) => (
          <DocRow key={d.typeId} doc={d} onChange={(list) => q.setData({ ...q.data!, documents: list })} />
        ))}
      </ul>
    </>
  )
}

function DocRow({ doc: d, onChange }: { doc: Doc; onChange: (docs: Doc[]) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const s = STATUS[d.status]
  const upload = async (file: File) => {
    if (file.size > 10_000_000) return setError('El archivo pesa más de 10 MB. Toma la foto con menor calidad o escanéalo en PDF.')
    setBusy(true)
    setError(null)
    const form = new FormData()
    form.append('file', file)
    try {
      const r = await api.upload<{ documents: Doc[] }>(`/portal/documents/${d.typeId}`, form)
      onChange(r.documents)
      toast('Documento enviado al jardín')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo subir.')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }
  const canUpload = Boolean(d.familyUpload) && d.status !== 'aprobado'
  return (
    <li className="card p-4">
      <div className="flex items-start gap-3">
        <FileText size={20} className="mt-0.5 shrink-0 text-royal" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">
            {d.name} {!d.required && <span className="text-[12px] font-normal text-muted">(opcional)</span>}
          </p>
          {d.description && <p className="text-[13px] text-muted">{d.description}</p>}
          {d.fileName && d.uploadedAt && (
            <p className="mt-1 text-[13px] text-muted">
              <a href={`/api/v2/enrollment-documents/${d.id}/file`} target="_blank" rel="noopener" className="font-semibold text-royal underline">
                {d.fileName}
              </a>{' '}
              · {dateTime(d.uploadedAt)}
            </p>
          )}
          {d.status === 'rechazado' && d.note && <p className="mt-1.5 rounded-lg bg-[#fdf0ef] px-3 py-2 text-[13px] text-berry">El jardín dice: {d.note}</p>}
          {!d.familyUpload && d.status !== 'aprobado' && <p className="mt-1 text-[12px] text-muted">Este documento se entrega en físico en el jardín.</p>}
        </div>
        <Chip tone={s.tone}>
          <s.icon size={12} /> {s.label}
        </Chip>
      </div>
      {error && (
        <div className="mt-2">
          <Problem message={error} />
        </div>
      )}
      {canUpload && (
        <>
          <input ref={input} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <button type="button" disabled={busy} onClick={() => input.current?.click()} className="btn btn-ghost mt-3 w-full">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
            {d.fileName ? 'Reemplazar archivo' : 'Subir foto o PDF'}
          </button>
        </>
      )}
    </li>
  )
}
