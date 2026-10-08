import { ArrowLeft, Mail } from 'lucide-react'
import { date, dateTime } from '@/shared/format'
import { useQuery } from '@/shared/useQuery'
import { api } from '../session'
import { Chip, Loading, Problem, Title } from '../ui'

interface MessageRow { id: number; subject: string; kind: string; dueOn: string | null; createdBy: string | null; createdAt: string; readAt: string | null; preview: string }
interface Message { id: number; subject: string; body: string; kind: string; dueOn: string | null; createdBy: string | null; createdAt: string }

const KIND: Record<string, { label: string; tone: 'violet' | 'yellow' | 'blue' | 'gray' }> = {
  mensaje: { label: 'Mensaje', tone: 'violet' },
  actividad: { label: 'Actividad', tone: 'yellow' },
  tarea: { label: 'Tarea', tone: 'yellow' },
  circular: { label: 'Circular', tone: 'blue' },
}
const KindChip = ({ kind }: { kind: string }) => {
  const k = KIND[kind] ?? { label: kind, tone: 'gray' as const }
  return <Chip tone={k.tone}>{k.label}</Chip>
}

/** Inbox: everything the school sends to this student (messages, activities, circulars). */
export function MessagesPage({ param }: { param?: string }) {
  if (param) return <MessageView id={Number(param)} />
  return <Inbox />
}

function Inbox() {
  const q = useQuery('messages', () => api.get<{ messages: MessageRow[] }>('/portal/messages'))
  return (
    <>
      <Title sub="Mensajes, actividades y circulares del jardín.">Mensajes</Title>
      {q.loading && <Loading />}
      {q.error && <Problem message={q.error.message} onRetry={q.reload} />}
      {q.data && !q.data.messages.length && (
        <p className="card flex flex-col items-center gap-2 p-8 text-center text-muted">
          <Mail size={28} /> Tu bandeja está vacía.
        </p>
      )}
      <ul className="space-y-2">
        {q.data?.messages.map((m) => (
          <li key={m.id}>
            <a href={`#/mensajes/${m.id}`} className="card block p-4">
              <div className="flex items-start justify-between gap-2">
                <p className={`min-w-0 flex-1 ${m.readAt ? 'font-medium text-text' : 'font-bold text-ink'}`}>
                  {!m.readAt && <span className="mr-1.5 inline-block size-2 rounded-full bg-pink align-middle" />}
                  {m.subject}
                </p>
                <span className="shrink-0 text-[12px] text-muted">{date(m.createdAt, false)}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted">{m.preview}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <KindChip kind={m.kind} />
                {m.dueOn && <Chip tone="red">Para el {date(m.dueOn, false)}</Chip>}
              </div>
            </a>
          </li>
        ))}
      </ul>
    </>
  )
}

function MessageView({ id }: { id: number }) {
  const q = useQuery(`message-${id}`, () => api.get<{ message: Message }>(`/portal/messages/${id}`))
  const m = q.data?.message
  return (
    <>
      <a href="#/mensajes" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-royal">
        <ArrowLeft size={16} /> Mensajes
      </a>
      {q.loading && <Loading />}
      {q.error && <Problem message={q.error.message} onRetry={q.reload} />}
      {m && (
        <article className="card p-5">
          <div className="mb-2 flex flex-wrap gap-1.5">
            <KindChip kind={m.kind} />
            {m.dueOn && <Chip tone="red">Para el {date(m.dueOn)}</Chip>}
          </div>
          <h1 className="text-[1.5rem] leading-tight">{m.subject}</h1>
          <p className="mt-1 text-[13px] text-muted">
            {m.createdBy ? `${m.createdBy} · ` : ''}
            {dateTime(m.createdAt)}
          </p>
          <div className="mt-4 text-[16px] leading-relaxed whitespace-pre-line text-text">{m.body}</div>
        </article>
      )}
    </>
  )
}
