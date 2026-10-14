import { Mail, MessageSquarePlus, Send, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { useMutation, useQuery } from '@/shared/useQuery'
import { dateTime, date } from '@/shared/format'
import { toast } from '../../store'
import { PageHead } from '../../ui'
import { api2, qs, useSetup } from '../../v2/api'
import { Badge, CourseSelect, Empty, ErrorBox, Field, Spinner, inputCls } from '../../v2/kit'
import type { StudentRow } from '../students/types'

type Msg = { id: number; subject: string; kind: string; audience: string; audienceName: string; dueOn: string | null; sendEmail: number; createdBy: string | null; createdAt: string; recipients: number; readCount: number }
type Detail = { message: Msg & { body: string }; recipients: { id: number; code: string; firstName: string; lastName: string; readAt: string | null }[] }
const KINDS: [string, string][] = [
  ['mensaje', 'Mensaje'],
  ['actividad', 'Actividad / tarea'],
  ['circular', 'Circular'],
  ['recordatorio', 'Recordatorio'],
]

/** Messages to the families' inbox (portal + push, and e-mail when chosen). */
export function MessagesPage() {
  const { data, error, loading, reload } = useQuery('messages', () => api2.get<{ messages: Msg[] }>('/messages'))
  const [composing, setComposing] = useState(false)
  const [viewing, setViewing] = useState<number | null>(null)
  return (
    <div className="space-y-5">
      <PageHead
        title="Mensajes a familias"
        sub="Llegan a la bandeja del portal y como notificación al celular de la familia."
        actions={
          <button type="button" onClick={() => setComposing(true)} className="btn btn-primary">
            <MessageSquarePlus size={18} /> Nuevo mensaje
          </button>
        }
      />
      {error ? (
        <ErrorBox message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Spinner />
      ) : !data?.messages.length ? (
        <Empty icon={<Send />} title="Aún no has enviado mensajes">Avisos, actividades para la casa, circulares… a todas las familias, a un curso o a una sola.</Empty>
      ) : (
        <ul className="space-y-2">
          {data.messages.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => setViewing(m.id)} className="card flex w-full flex-wrap items-center gap-3 p-4 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{m.subject}</span>
                  <span className="block text-[13px] text-muted">
                    {m.audienceName} · {dateTime(m.createdAt)} · {m.createdBy}
                  </span>
                </span>
                <Badge tone="violet">{KINDS.find(([k]) => k === m.kind)?.[1]}</Badge>
                {m.sendEmail > 0 && (
                  <Badge tone="blue">
                    <Mail size={12} /> Correo
                  </Badge>
                )}
                <Badge tone={m.readCount === m.recipients ? 'green' : 'gray'}>
                  Leído {m.readCount}/{m.recipients}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Compose open={composing} onClose={() => setComposing(false)} onSent={reload} />
      <MessageDetail id={viewing} onClose={() => setViewing(null)} onDeleted={reload} />
    </div>
  )
}

function Compose({ open, onClose, onSent }: { open: boolean; onClose: () => void; onSent: () => void }) {
  const { year } = useSetup()
  const [v, setV] = useState({ subject: '', body: '', kind: 'mensaje', audience: 'todos', audienceId: null as number | null, dueOn: '', sendEmail: false })
  const [student, setStudent] = useState('')
  const [students, setStudents] = useState<StudentRow[]>([])
  const m = useMutation()
  useEffect(() => {
    if (v.audience !== 'estudiante' || student.trim().length < 2) return setStudents([])
    const t = setTimeout(() => api2.get<{ students: StudentRow[] }>('/students' + qs({ year, q: student.trim(), status: 'activo' })).then((r) => setStudents(r.students.slice(0, 8))).catch(() => {}), 250)
    return () => clearTimeout(t)
  }, [student, v.audience, year])
  const send = async () => {
    const r = await m.run(() => api2.post<{ recipients: number }>('/messages', { ...v, dueOn: v.dueOn || null }))
    if (r) {
      toast(`Enviado a ${r.recipients} ${r.recipients === 1 ? 'familia' : 'familias'}`)
      setV({ subject: '', body: '', kind: 'mensaje', audience: 'todos', audienceId: null, dueOn: '', sendEmail: false })
      setStudent('')
      onSent()
      onClose()
    }
  }
  return (
    <Modal open={open} onClose={onClose} label="Nuevo mensaje" closeLabel="Cerrar">
      <div className="space-y-4 p-5 sm:p-7">
        <h2 className="text-[1.5rem]">Nuevo mensaje a familias</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Para">
            <select value={v.audience} onChange={(e) => setV({ ...v, audience: e.target.value, audienceId: null })} className={inputCls()}>
              <option value="todos">Todas las familias</option>
              <option value="curso">Un curso</option>
              <option value="estudiante">Una familia (estudiante)</option>
            </select>
          </Field>
          <Field label="Tipo">
            <select value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })} className={inputCls()}>
              {KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
        </div>
        {v.audience === 'curso' && <CourseSelect value={v.audienceId} onChange={(id) => setV({ ...v, audienceId: id })} allowAll={false} />}
        {v.audience === 'estudiante' && (
          <div>
            <input value={student} onChange={(e) => setStudent(e.target.value)} placeholder="Busca al estudiante…" className={inputCls(m.fields.audienceId)} />
            {students.length > 0 && !v.audienceId && (
              <ul className="mt-1 space-y-1">
                {students.map((s) => (
                  <li key={s.id}>
                    <button type="button" onClick={() => { setV({ ...v, audienceId: s.id }); setStudent(`${s.firstName} ${s.lastName} · ${s.course ?? ''}`) }} className="w-full rounded-lg bg-paper px-3 py-2 text-left text-sm">
                      {s.firstName} {s.lastName} <span className="text-muted">· {s.course}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {m.fields.audienceId && <p className="mt-1 text-[13px] font-semibold text-berry">{m.fields.audienceId}</p>}
          </div>
        )}
        <Field label="Asunto" error={m.fields.subject}>
          <input value={v.subject} onChange={(e) => setV({ ...v, subject: e.target.value })} className={inputCls(m.fields.subject)} />
        </Field>
        <Field label="Mensaje" error={m.fields.body}>
          <textarea value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} rows={6} className={inputCls(m.fields.body)} />
        </Field>
        {v.kind === 'actividad' && (
          <Field label="Fecha de entrega (opcional)">
            <input type="date" value={v.dueOn} onChange={(e) => setV({ ...v, dueOn: e.target.value })} className={inputCls()} />
          </Field>
        )}
        <label className="flex items-center gap-2 text-[15px] font-semibold text-ink">
          <input type="checkbox" checked={v.sendEmail} onChange={(e) => setV({ ...v, sendEmail: e.target.checked })} className="size-5 accent-[#3a36a8]" /> Enviar también por correo
        </label>
        {m.message && <ErrorBox message={m.message} />}
        <button type="button" disabled={m.busy} onClick={send} className="btn btn-primary w-full">
          <Send size={18} /> Enviar
        </button>
      </div>
    </Modal>
  )
}

function MessageDetail({ id, onClose, onDeleted }: { id: number | null; onClose: () => void; onDeleted: () => void }) {
  const { data, loading } = useQuery(id ? `msg:${id}` : null, () => api2.get<Detail>(`/messages/${id}`))
  return (
    <Modal open={id !== null} onClose={onClose} label="Mensaje" closeLabel="Cerrar">
      <div className="space-y-4 p-5 sm:p-7">
        {loading || !data ? (
          <Spinner />
        ) : (
          <>
            <h2 className="text-[1.5rem]">{data.message.subject}</h2>
            <p className="text-sm text-muted">
              {data.message.audienceName} · {dateTime(data.message.createdAt)}
              {data.message.dueOn && ` · entrega ${date(data.message.dueOn)}`}
            </p>
            <p className="rounded-xl bg-paper p-4 text-[15px] whitespace-pre-line text-text">{data.message.body}</p>
            <div>
              <p className="mb-1 font-semibold text-ink">Lectura</p>
              <ul className="flex flex-wrap gap-1.5">
                {data.recipients.map((r) => (
                  <li key={r.id}>
                    <Badge tone={r.readAt ? 'green' : 'gray'}>
                      {r.firstName} {r.lastName}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
            <button type="button" onClick={async () => { await api2.del(`/messages/${id}`).catch(() => null); toast('Mensaje eliminado'); onDeleted(); onClose() }} className="btn btn-ghost !text-sm text-berry">
              <Trash2 size={16} /> Eliminar mensaje
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}
