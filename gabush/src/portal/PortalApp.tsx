import { AnimatePresence, motion } from 'motion/react'
import { Bell, BookOpenCheck, CalendarDays, ClipboardCheck, FileText, Home, Loader2, LogOut, Mail, Menu, NotebookPen, School, UserCog, Wallet, X } from 'lucide-react'
import { useEffect, useState, type ComponentType } from 'react'
import { cn } from '@/lib/utils'
import { checkSession, logout, useSession, useToast } from './session'
import { Login, ChangePassword, ResetPassword } from './pages/Auth'
import { HomePage } from './pages/HomePage'
import { MessagesPage } from './pages/MessagesPage'
import { PaymentsPage } from './pages/PaymentsPage'
import { GradesPage } from './pages/GradesPage'
import { AttendancePage } from './pages/AttendancePage'
import { SubjectsPage } from './pages/SubjectsPage'
import { CalendarPage } from './pages/CalendarPage'
import { DocumentsPage } from './pages/DocumentsPage'
import { ObserverPage } from './pages/ObserverPage'
import { AccountPage } from './pages/AccountPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { StudentPhoto } from './ui'

type Page = { id: string; label: string; icon: ComponentType<{ size?: number; className?: string }>; view: ComponentType<{ param?: string }> }
const PAGES: Page[] = [
  { id: 'inicio', label: 'Inicio', icon: Home, view: HomePage },
  { id: 'mensajes', label: 'Mensajes', icon: Mail, view: MessagesPage },
  { id: 'pagos', label: 'Pagos', icon: Wallet, view: PaymentsPage },
  { id: 'notas', label: 'Notas', icon: BookOpenCheck, view: GradesPage },
  { id: 'asistencia', label: 'Asistencia', icon: ClipboardCheck, view: AttendancePage },
  { id: 'materias', label: 'Materias', icon: School, view: SubjectsPage },
  { id: 'calendario', label: 'Calendario', icon: CalendarDays, view: CalendarPage },
  { id: 'documentos', label: 'Documentos', icon: FileText, view: DocumentsPage },
  { id: 'observador', label: 'Observaciones', icon: NotebookPen, view: ObserverPage },
  { id: 'novedades', label: 'Novedades', icon: Bell, view: NotificationsPage },
  { id: 'cuenta', label: 'Mi cuenta', icon: UserCog, view: AccountPage },
]
const TABS = ['inicio', 'mensajes', 'pagos', 'notas']

function useHashRoute(): [string, string | undefined] {
  // back from the payment gateway (/familia/?pago=REF…) → Pagos shows the result
  if (new URLSearchParams(location.search).has('pago') && !location.hash) history.replaceState(null, '', location.pathname + location.search + '#/pagos')
  const read = () => {
    const [id, param] = location.hash.replace(/^#\/?/, '').split('?')[0].split('/')
    return [id || 'inicio', param] as [string, string | undefined]
  }
  const [r, setR] = useState(read)
  useEffect(() => {
    const on = () => {
      setR(read())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return r
}

export function PortalApp() {
  const { me, checked } = useSession()
  const [route, param] = useHashRoute()
  useEffect(() => {
    checkSession()
  }, [])
  if (route === 'restablecer' && param) return <ResetPassword token={param} />
  if (!checked) {
    return (
      <div className="grid min-h-svh place-items-center bg-paper text-muted">
        <Loader2 className="animate-spin" />
      </div>
    )
  }
  if (!me) return <Login />
  if (me.mustChangePassword) return <ChangePassword first />
  return <Shell route={route} param={param} />
}

function Shell({ route, param }: { route: string; param?: string }) {
  const { me } = useSession()
  const [more, setMore] = useState(false)
  const page = PAGES.find((p) => p.id === route) ?? PAGES[0]
  const View = page.view
  useEffect(() => setMore(false), [route])
  if (!me) return null
  const s = me.student
  return (
    <div className="min-h-svh bg-paper pb-24">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4">
          <StudentPhoto student={s} size={40} />
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate font-serif text-lg font-semibold text-ink">{s.firstName} {s.lastName}</span>
            <span className="block truncate text-[12px] font-bold tracking-wide text-muted uppercase">
              {s.course ?? 'Jardín Gabush'} · {me.year}
            </span>
          </span>
          <a href="#/novedades" aria-label="Novedades" className="grid size-10 place-items-center rounded-lg text-muted hover:bg-paper hover:text-ink">
            <Bell size={20} />
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5">
        <View param={param} />
      </main>
      <nav aria-label="Secciones" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-3xl grid-cols-5">
          {PAGES.filter((p) => TABS.includes(p.id)).map((p) => (
            <a key={p.id} href={`#/${p.id}`} aria-current={p.id === page.id ? 'page' : undefined} className={cn('flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold', p.id === page.id ? 'text-ink' : 'text-muted')}>
              <span className={cn('grid h-8 w-12 place-items-center rounded-full', p.id === page.id && 'bg-[#eeedfb] text-royal')}>
                <p.icon size={20} />
              </span>
              {p.label}
            </a>
          ))}
          <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} className={cn('flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold', !TABS.includes(page.id) ? 'text-ink' : 'text-muted')}>
            <span className={cn('grid h-8 w-12 place-items-center rounded-full', !TABS.includes(page.id) && 'bg-[#eeedfb] text-royal')}>{more ? <X size={20} /> : <Menu size={20} />}</span>
            Más
          </button>
        </div>
        <AnimatePresence>
          {more && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute inset-x-3 bottom-full mx-auto mb-2 max-w-md rounded-2xl border border-line bg-white p-2 shadow-[0_20px_40px_-20px_rgba(35,32,107,0.5)]">
              <div className="grid grid-cols-2 gap-1">
                {PAGES.filter((p) => !TABS.includes(p.id)).map((p) => (
                  <a key={p.id} href={`#/${p.id}`} className={cn('flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[15px] font-semibold', p.id === page.id ? 'bg-paper text-ink' : 'text-text')}>
                    <p.icon size={18} className="text-royal" /> {p.label}
                  </a>
                ))}
                <button type="button" onClick={logout} className="col-span-2 flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[15px] font-semibold text-berry hover:bg-[#fdf0ef]">
                  <LogOut size={18} /> Cerrar sesión
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
      <Toaster />
      <footer className="mx-auto mt-8 flex max-w-3xl flex-col items-center gap-2 px-4 pb-6 text-center text-[12px] text-muted">
        <img src="/images/opt/leon-asomado-160.webp" alt="" width={160} height={161} className="h-10 w-auto opacity-80" />
        {[me.school.name, me.school.phone].filter(Boolean).join(' · ')}
        <a href="/admin/" className="font-semibold text-muted underline-offset-2 hover:text-ink hover:underline">
          Acceso del personal del jardín
        </a>
      </footer>
    </div>
  )
}

function Toaster() {
  const t = useToast()
  return (
    <AnimatePresence>
      {t && (
        <motion.p key={t.id} role="status" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className="fixed inset-x-4 bottom-24 z-[95] mx-auto max-w-sm rounded-lg bg-ink px-4 py-3 text-center text-sm font-medium text-white shadow-lg">
          {t.text}
        </motion.p>
      )}
    </AnimatePresence>
  )
}
