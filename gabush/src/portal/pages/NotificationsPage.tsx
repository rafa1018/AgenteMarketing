import { Bell } from 'lucide-react'
import { useEffect } from 'react'
import { dateTime } from '@/shared/format'
import { useQuery } from '@/shared/useQuery'
import { api } from '../session'
import { Loading, Problem, Title } from '../ui'

export interface Notification { id: number; kind: string; title: string; body: string; url: string | null; readAt: string | null; createdAt: string }

/** Portal links inside notifications are full paths (/familia/#/pagos); keep them in the app. */
const toHash = (url: string | null) => (url && url.includes('#') ? '#' + url.split('#')[1] : null)

export function NotificationsPage() {
  const q = useQuery('notifications', () => api.get<{ notifications: Notification[] }>('/portal/notifications'))
  const unread = q.data?.notifications.some((n) => !n.readAt)
  useEffect(() => {
    if (unread) api.post('/portal/notifications/read').catch(() => null)
  }, [unread])
  return (
    <>
      <Title sub="Avisos del jardín sobre tu hijo o hija: pagos, mensajes, notas y más.">Novedades</Title>
      {q.loading && <Loading />}
      {q.error && <Problem message={q.error.message} onRetry={q.reload} />}
      {q.data && !q.data.notifications.length && (
        <p className="card flex flex-col items-center gap-2 p-8 text-center text-muted">
          <Bell size={28} /> No hay novedades por ahora.
        </p>
      )}
      <ul className="space-y-2">
        {q.data?.notifications.map((n) => {
          const href = toHash(n.url)
          const body = (
            <>
              <p className="font-semibold text-ink">
                {!n.readAt && <span className="mr-1.5 inline-block size-2 rounded-full bg-pink align-middle" />}
                {n.title}
              </p>
              {n.body && <p className="mt-0.5 text-[15px] text-text">{n.body}</p>}
              <p className="mt-1 text-[12px] text-muted">{dateTime(n.createdAt)}</p>
            </>
          )
          return (
            <li key={n.id}>
              {href ? (
                <a href={href} className="card block p-4">
                  {body}
                </a>
              ) : (
                <div className="card p-4">{body}</div>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}
