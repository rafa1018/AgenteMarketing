import { Check, MessageSquarePlus, Send, Trash2, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'
import { useMutation, useQuery } from '@/shared/useQuery'
import { dateTime } from '@/shared/format'
import { toast } from '../../store'
import { ConfirmModal, PageHead } from '../../ui'
import { api2 } from '../../v2/api'
import { Badge, Empty, ErrorBox, Field, Spinner, inputCls } from '../../v2/kit'

type Msg = { id: number; subject: string; audience: string; sender: string; createdAt: string; recipients: number; readCount: number }
type Detail = { message: Msg & { body: string }; recipients: { id: string; name: string; readAt: string | null }[] }
type Person = { id: string; name: string; role: string }
const ROLE_LABEL: Record<string, string> = { rectora: 'Rectora', docente: 'Docente', auxiliar: 'Auxiliar', personalizado: 'Personalizado' }

/** Messages to the staff (docentes, auxiliares…): they read them in "Mi bandeja" and get a phone notification. */
export function StaffMessagesPage() {
  const { data, error, loading, reload } = useQuery('staff-messages', () => api2.get<{ messages: Msg[] }>('/staff-messages'))
  const [composing, setComposing] = useState(false)
  const [viewing, setViewing] = useState<number | null>(null)
  return (
    <div className="space-y-5">
      <PageHead
        title="Mensajes al personal"
        sub="Avisos para tu equipo: les llegan a «Mi bandeja» en el panel y como notificación al celular si las activaron. Ves quién lo leyó."
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
        <Empty icon={<UsersRound />} title="Aún no has enviado mensajes al personal">A todo el equipo, a todos los docentes o a personas específicas.</Empty>
      ) : (
        <ul className="space-y-2">
          {data.messages.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => setViewing(m.id)} className="card flex w-full flex-wrap items-center gap-3 p-4 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{m.subject}</span>
                  <span className="block text-[13px] text-muted">
                    Para: {m.audience} · {dateTime(m.createdAt)} · {m.sender}
                  </span>
                </span>
                <Badge tone={m.readCount === m.recipients ? 'green' : 'gray'}>
                  Leído {m.readCount}/{m.recipients}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Compose open={composing} onClose={() => setComposing(false)} onSent={reload} />
      <Detail id={viewing} onClose={() => setViewing(null)} onDeleted={reload} />
    </div>
  )
}

function Compose({ open, onClose, onSent }: { open: boolean; onClose: () => void; onSent: () => void }) {
  const people = useQuery(open ? 'staff-people' : null, () => api2.get<{ people: Person[]; roles: Record<string, string> }>('/staff-messages/people'))
  const empty = { subject: '', body: '', audience: 'todos', role: 'docente', userIds: [] as string[] }
  const [v, setV] = useState(empty)
  const m = useMutation()
  const list = people.data?.people ?? []
  const roles = people.data?.roles ?? {}
  const count = v.audience === 'todos' ? list.length : v.audience === 'rol' ? list.filter((p) => p.role === v.role).length : v.userIds.length
  const send = async () => {
    const r = await m.run(() => api2.post<{ recipients: number }>('/staff-messages', v))
    if (r) {
      toast(`Enviado a ${r.recipients} ${r.recipients === 1 ? 'persona' : 'personas'}`)
      setV(empty)
      onSent()
      onClose()
    }
  }
  return (
    <Modal open={open} onClose={onClose} label="Nuevo mensaje al personal" closeLabel="Cerrar">
      <div className="space-y-4 p-5 sm:p-7">
        <h2 className="text-[1.5rem]">Nuevo mensaje al personal</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Para">
            <select value={v.audience} onChange={(e) => setV({ ...v, audience: e.target.value })} className={inputCls()}>
              <option value="todos">Todo el personal</option>
              <option value="rol">Un grupo (docentes, auxiliares…)</option>
              <option value="personas">Personas específicas</option>
            </select>
          </Field>
          {v.audience === 'rol' && (
            <Field label="Grupo" error={m.fields.role}>
              <select value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })} className={inputCls(m.fields.role)}>
                {Object.entries(roles).map(([k, l]) => (
                  <option key={k} value={k}>{l}</option>
                ))}
              </select>
            </Field>
          )}
        </div>
        {v.audience === 'personas' && (
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {list.map((p) => {
              const on = v.userIds.includes(p.id)
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setV({ ...v, userIds: on ? v.userIds.filter((x) => x !== p.id) : [...v.userIds, p.id] })}
                    className={cn('flex w-full items-center gap-2 rounded-xl border-2 px-3 py-2 text-left text-[14px]', on ? 'border-royal/40 bg-[#eeedfb]' : 'border-line')}
                  >
                    <span className={cn('grid size-5 shrink-0 place-items-center rounded-md border-2', on ? 'border-royal bg-royal text-white' : 'border-muted/40')}>{on && <Check size={13} strokeWidth={3.5} />}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink">{p.name}</span>
                      <span className="block text-[12px] text-muted">{ROLE_LABEL[p.role] ?? p.role}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <p className="text-[13px] text-muted">{people.loading ? 'Cargando…' : `Le llegará a ${count} ${count === 1 ? 'persona' : 'personas'}.`}</p>
        <Field label="Asunto" error={m.fields.subject}>
          <input value={v.subject} onChange={(e) => setV({ ...v, subject: e.target.value })} maxLength={160} placeholder="Reunión de docentes, entrega de notas…" className={inputCls(m.fields.subject)} />
        </Field>
        <Field label="Mensaje" error={m.fields.body}>
          <textarea value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} rows={6} className={inputCls(m.fields.body)} />
        </Field>
        {m.message && <ErrorBox message={m.message} />}
        <button type="button" disabled={m.busy || count === 0} onClick={send} className="btn btn-primary w-full disabled:opacity-50">
          <Send size={18} /> Enviar
        </button>
      </div>
    </Modal>
  )
}

function Detail({ id, onClose, onDeleted }: { id: number | null; onClose: () => void; onDeleted: () => void }) {
  const { data, loading } = useQuery(id ? `staff-msg:${id}` : null, () => api2.get<Detail>(`/staff-messages/${id}`))
  const [asking, setAsking] = useState(false)
  return (
    <Modal open={id !== null} onClose={onClose} label="Mensaje" closeLabel="Cerrar">
      <div className="space-y-4 p-5 sm:p-7">
        {loading || !data ? (
          <Spinner />
        ) : (
          <>
            <h2 className="text-[1.5rem]">{data.message.subject}</h2>
            <p className="text-sm text-muted">
              Para: {data.message.audience} · {dateTime(data.message.createdAt)} · {data.message.sender}
            </p>
            <p className="rounded-xl bg-paper p-4 text-[15px] whitespace-pre-line text-text">{data.message.body}</p>
            <div>
              <p className="mb-1 font-semibold text-ink">
                Lectura ({data.recipients.filter((r) => r.readAt).length} de {data.recipients.length})
              </p>
              <ul className="divide-y divide-line rounded-xl ring-1 ring-line">
                {data.recipients.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 text-[14px]">
                    <span className="font-semibold text-ink">{r.name}</span>
                    {r.readAt ? <Badge tone="green">Leído el {dateTime(r.readAt)}</Badge> : <Badge tone="gray">Sin leer</Badge>}
                  </li>
                ))}
              </ul>
            </div>
            <button type="button" onClick={() => setAsking(true)} className="btn btn-ghost !text-sm text-berry">
              <Trash2 size={16} /> Eliminar mensaje
            </button>
            <ConfirmModal
              open={asking}
              title="¿Eliminar este mensaje?"
              confirmLabel="Sí, eliminar"
              tone="danger"
              icon={<Trash2 size={24} />}
              onConfirm={async () => {
                await api2.del(`/staff-messages/${id}`).catch(() => null)
                toast('Mensaje eliminado')
                onDeleted()
                onClose()
              }}
              onClose={() => setAsking(false)}
            >
              Desaparece también de la bandeja de quienes lo recibieron.
            </ConfirmModal>
          </>
        )}
      </div>
    </Modal>
  )
}
