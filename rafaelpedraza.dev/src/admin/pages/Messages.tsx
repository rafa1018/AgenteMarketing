import { CheckCheck, Mail, MailOpen, MessageCircle, Phone, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { ago, api, flag, fmtDate, setUnread, toast, type Message } from '../api'
import { Card, Confirm, Empty, PageHead, btnDanger, btnGhost } from '../ui'

/** Digits for wa.me — numbers without country code are assumed Colombian. */
const waNumber = (phone: string) => {
  const d = phone.replace(/\D/g, '')
  return phone.trim().startsWith('+') || d.length > 10 ? d : `57${d}`
}

export function MessagesPage({ tick }: { tick: number }) {
  const [messages, setMessages] = useState<Message[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [toDelete, setToDelete] = useState<Message | null>(null)

  const load = () =>
    api.get<{ messages: Message[]; unread: number }>('messages.php').then(({ data }) => {
      if (!data?.ok) return
      setMessages(data.messages)
      setUnread(data.unread)
    })
  useEffect(() => {
    load()
  }, [tick])

  const update = (fn: (list: Message[]) => Message[]) =>
    setMessages((list) => {
      const next = fn(list ?? [])
      setUnread(next.filter((m) => !m.read).length)
      return next
    })

  const setRead = (m: Message, read: boolean) => {
    update((l) => l.map((x) => (x.id === m.id ? { ...x, read } : x)))
    api.post('messages.php', { action: 'read', id: m.id, read })
  }

  const toggle = (m: Message) => {
    setOpen((o) => (o === m.id ? null : m.id))
    if (!m.read) setRead(m, true)
  }

  const remove = async (m: Message) => {
    const { data } = await api.post('messages.php', { action: 'delete', id: m.id })
    if (data?.ok) {
      update((l) => l.filter((x) => x.id !== m.id))
      toast('Mensaje eliminado.')
    }
  }

  const readAll = async () => {
    await api.post('messages.php', { action: 'readAll' })
    update((l) => l.map((x) => ({ ...x, read: true })))
  }

  const list = (messages ?? []).filter((m) => filter === 'all' || !m.read)
  const unread = (messages ?? []).filter((m) => !m.read).length

  return (
    <>
      <PageHead
        title="Mensajes"
        sub="Lo que te escriben desde el formulario de contacto del sitio."
        actions={
          unread > 0 && (
            <button type="button" className={btnGhost} onClick={readAll}>
              <CheckCheck size={16} /> Marcar todo como leído
            </button>
          )
        }
      />
      <div className="mb-4 flex gap-2">
        {(['all', 'unread'] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} className={cn('rounded-full border px-3.5 py-1.5 text-sm', filter === f ? 'border-cyan/60 bg-cyan/10 text-fg' : 'border-line text-muted')}>
            {f === 'all' ? `Todos (${messages?.length ?? 0})` : `Sin leer (${unread})`}
          </button>
        ))}
      </div>

      {messages === null ? null : list.length === 0 ? (
        <Empty>{filter === 'unread' ? 'No tienes mensajes sin leer.' : 'Aún no hay mensajes. Cuando alguien te escriba desde el sitio, aparecerá aquí.'}</Empty>
      ) : (
        <ul className="space-y-2.5">
          {list.map((m) => {
            const isOpen = open === m.id
            return (
              <li key={m.id}>
                <Card className={cn('!p-0 transition-colors', !m.read && 'border-volt/40')}>
                  <button type="button" onClick={() => toggle(m)} className="flex w-full items-start gap-3 p-4 text-left sm:p-5" aria-expanded={isOpen}>
                    <span className={cn('mt-2 size-2 shrink-0 rounded-full', m.read ? 'bg-steel' : 'bg-volt')} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className={cn('truncate text-[15px]', m.read ? 'text-fg/80' : 'font-semibold text-fg')}>{m.name}</span>
                        <span className="shrink-0 text-xs text-dim">{ago(m.t)}</span>
                      </span>
                      <span className="block truncate text-sm text-cyan/90">{m.subject}</span>
                      {!isOpen && <span className="mt-0.5 line-clamp-1 text-sm text-muted">{m.message}</span>}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-line px-4 pt-4 pb-5 sm:px-5">
                      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-fg">{m.message}</p>
                      <dl className="mt-4 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                        <Row k="Teléfono" v={m.phone} />
                        <Row k="Fecha" v={fmtDate(m.t)} />
                        <Row k="Desde" v={m.place ? `${flag(m.cc)} ${m.place}` : '—'} />
                        <Row k="Dispositivo" v={m.device || '—'} />
                        <Row k="IP" v={m.ip || '—'} />
                        <Row k="Idioma del sitio" v={m.lang === 'en' ? 'Inglés' : 'Español'} />
                      </dl>
                      <div className="mt-5 flex flex-wrap gap-2">
                        <a className={btnGhost} href={`https://wa.me/${waNumber(m.phone)}?text=${encodeURIComponent(`Hola ${m.name.split(' ')[0]}, te escribo por tu mensaje en rafaelpedraza.dev: "${m.subject}".`)}`} target="_blank" rel="noopener noreferrer">
                          <MessageCircle size={16} /> WhatsApp
                        </a>
                        <a className={btnGhost} href={`tel:${m.phone.replace(/[^\d+]/g, '')}`}>
                          <Phone size={16} /> Llamar
                        </a>
                        <button type="button" className={btnGhost} onClick={() => setRead(m, !m.read)}>
                          {m.read ? <Mail size={16} /> : <MailOpen size={16} />} {m.read ? 'Marcar no leído' : 'Marcar leído'}
                        </button>
                        <button type="button" className={btnDanger} onClick={() => setToDelete(m)}>
                          <Trash2 size={16} /> Eliminar
                        </button>
                      </div>
                    </div>
                  )}
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      <Confirm open={Boolean(toDelete)} title="¿Eliminar este mensaje?" body={toDelete && `De ${toDelete.name}: "${toDelete.subject}". No se puede deshacer.`} confirm="Eliminar" danger onClose={() => setToDelete(null)} onConfirm={() => toDelete && remove(toDelete)} />
    </>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-dim">{k}:</dt>
      <dd className="min-w-0 truncate text-muted">{v}</dd>
    </div>
  )
}
