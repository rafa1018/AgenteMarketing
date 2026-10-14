import { Inbox, MailOpen } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useQuery } from '@/shared/useQuery'
import { dateTime } from '@/shared/format'
import { PageHead } from '../../ui'
import { api2 } from '../../v2/api'
import { Empty, ErrorBox, Spinner } from '../../v2/kit'
import { refreshInbox } from './inbox'

type InboxMsg = { id: number; subject: string; body: string; sender: string; createdAt: string; readAt: string | null }

/** "Mi bandeja": the messages the rectora / administration sent to me. Opening one marks it as read. */
export function InboxPage() {
  const { data, error, loading, reload } = useQuery('staff-inbox', () => api2.get<{ messages: InboxMsg[]; unread: number }>('/staff-inbox'))
  const [open, setOpen] = useState<number | null>(null)
  const read = async (m: InboxMsg) => {
    setOpen(open === m.id ? null : m.id)
    if (!m.readAt) {
      await api2.post(`/staff-inbox/${m.id}/read`).catch(() => null)
      reload()
      refreshInbox()
    }
  }
  return (
    <div className="space-y-5">
      <PageHead title="Mi bandeja" sub="Los mensajes que te envía la rectora o la administración del jardín." />
      {error ? (
        <ErrorBox message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Spinner />
      ) : !data?.messages.length ? (
        <Empty icon={<Inbox />} title="No tienes mensajes">Aquí aparecerán los avisos que te envíen.</Empty>
      ) : (
        <ul className="space-y-2">
          {data.messages.map((m) => (
            <li key={m.id} className={cn('card overflow-hidden p-0', !m.readAt && 'ring-2 ring-royal/30')}>
              <button type="button" onClick={() => read(m)} className="flex w-full items-start gap-3 p-4 text-left">
                {m.readAt ? <MailOpen size={18} className="mt-0.5 shrink-0 text-muted" /> : <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-royal" aria-label="Sin leer" />}
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-ink', !m.readAt && 'font-bold')}>{m.subject}</span>
                  <span className="block text-[13px] text-muted">
                    {m.sender} · {dateTime(m.createdAt)}
                  </span>
                </span>
              </button>
              {open === m.id && <p className="border-t border-line bg-paper px-4 py-3 text-[15px] whitespace-pre-line text-text">{m.body}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
