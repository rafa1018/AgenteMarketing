import { AnimatePresence, motion } from 'motion/react'
import { BarChart3, Bell, BellRing, CalendarDays, Globe, Images, ShieldCheck, RefreshCw, ClipboardCheck, House, Loader2, LogOut, Menu, Settings as SettingsIcon, Users, Wallet, X } from 'lucide-react'
import { useEffect, useState, type ComponentType } from 'react'
import { checkAdmin, loadEvents, logout, reloadEvents, useCalendar, type Perm } from '@/lib/calendar'
import { cn } from '@/lib/utils'
import { AdminLayer, LoginForm } from '@/components/admin/AdminUI'
import { loadAll, syncNow, useAdmin } from './store'
import { PhotoViewer, useRoute } from './ui'
import { Home } from './pages/Home'
import { Attendance } from './pages/Attendance'
import { Students, StudentEditor } from './pages/Students'
import { Payments } from './pages/Payments'
import { ChargeModal } from './pages/ChargeModal'
import { ReminderModal } from './pages/Reminder'
import { DayBillingModal } from './pages/DayBilling'
import { Inscriptions } from './pages/Inscriptions'
import { CalendarPage, Settings } from './pages/Settings'
import { FeedPage } from './pages/Feed'
import { UsersPage } from './pages/Users'
import { NotificationsPage } from './pages/Notifications'
import { SitePage } from './pages/SiteSettings'
import { VisitsPage } from './pages/Visits'
import { roleColor, roleLabel } from './roles'

/** perm: the page is only shown to users with that permission (the server enforces it too). */
type Page = { id: string; label: string; icon: ComponentType<{ size?: number; className?: string }>; view: ComponentType; perm?: Perm }
const ALL_PAGES: Page[] = [
  { id: 'inicio', label: 'Inicio', icon: House, view: Home, perm: 'pagos' },
  { id: 'asistencia', label: 'Asistencia', icon: ClipboardCheck, view: Attendance, perm: 'asistencia' },
  { id: 'estudiantes', label: 'Estudiantes', icon: Users, view: Students, perm: 'estudiantes' },
  { id: 'pagos', label: 'Pagos', icon: Wallet, view: Payments, perm: 'pagos' },
  { id: 'inscripciones', label: 'Inscripciones', icon: Bell, view: Inscriptions, perm: 'inscripciones' },
  { id: 'calendario', label: 'Calendario', icon: CalendarDays, view: CalendarPage, perm: 'calendario' },
  { id: 'feed', label: 'Momentos', icon: Images, view: FeedPage, perm: 'feed' },
  { id: 'visitas', label: 'Visitas', icon: BarChart3, view: VisitsPage, perm: 'ajustes' },
  { id: 'sitio', label: 'Sitio web', icon: Globe, view: SitePage, perm: 'ajustes' },
  { id: 'usuarios', label: 'Usuarios', icon: ShieldCheck, view: UsersPage, perm: 'usuarios' },
  { id: 'notificaciones', label: 'Notificaciones', icon: BellRing, view: NotificationsPage },
  { id: 'ajustes', label: 'Ajustes', icon: SettingsIcon, view: Settings, perm: 'ajustes' },
]

function NoAccess() {
  return <p className="rounded-2xl bg-white p-6 text-muted">Tu usuario todavía no tiene permisos. Pídele a la rectora que te los asigne.</p>
}
const MOBILE_PREF = ['inicio', 'asistencia', 'estudiantes', 'feed', 'pagos', 'calendario', 'inscripciones', 'notificaciones']

/** The installed app opens straight on attendance; the browser on the dashboard. */
const STANDALONE = window.matchMedia('(display-mode: standalone)').matches

function Shell() {
  const perms = useCalendar((s) => s.perms)
  const role = useCalendar((s) => s.role)
  const PAGES = ALL_PAGES.filter((p) => !p.perm || perms.includes(p.perm))
  const hasMore = PAGES.length > 5
  const MOBILE_MAIN = hasMore ? MOBILE_PREF.filter((id) => PAGES.some((p) => p.id === id)).slice(0, 4) : PAGES.map((p) => p.id)
  const START = (STANDALONE && PAGES.find((p) => p.id === 'asistencia')?.id) || PAGES[0]?.id || 'inicio'
  const [route] = useRoute(START)
  const [more, setMore] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const loaded = useAdmin((s) => s.loaded)
  const failed = useAdmin((s) => s.failed)
  const newIns = useAdmin((s) => s.inscriptions.filter((i) => i.status === 'pendiente').length)
  const toast = useAdmin((s) => s.toast)
  const name = useCalendar((s) => s.name)
  const page = PAGES.find((p) => p.id === route) ?? PAGES[0] ?? { id: 'none', label: '', icon: House, view: NoAccess }
  const View = page.view

  useEffect(() => {
    loadAll()
    loadEvents()
    // keep every device in sync: when the app comes back to the screen, and every minute while visible
    const sync = () => {
      if (document.visibilityState !== 'visible') return
      syncNow()
      reloadEvents()
    }
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('focus', sync)
    const id = window.setInterval(sync, 60000)
    return () => {
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('focus', sync)
      window.clearInterval(id)
    }
  }, [])
  useEffect(() => setMore(false), [route])

  // A new version was published while the app stayed open → offer to reload.
  const [update, setUpdate] = useState(false)
  useEffect(() => {
    const current = document.querySelector<HTMLScriptElement>('script[src*="/assets/admin-"]')?.getAttribute('src')
    if (!current) return // dev server
    const check = async () => {
      if (document.visibilityState !== 'visible') return
      const html = await fetch('/admin/', { cache: 'no-store' }).then((r) => (r.ok ? r.text() : '')).catch(() => '')
      const latest = html.match(/\/assets\/admin-[^"']+\.js/)?.[0]
      if (latest && latest !== current) setUpdate(true)
    }
    document.addEventListener('visibilitychange', check)
    const id = window.setInterval(check, 10 * 60000)
    return () => {
      document.removeEventListener('visibilitychange', check)
      window.clearInterval(id)
    }
  }, [])

  const badge = (id: string) => id === 'inscripciones' && newIns > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-berry px-1 text-[11px] font-bold text-white">{newIns}</span>

  return (
    <div className="min-h-svh overflow-x-clip bg-paper pb-24 lg:pb-10 lg:pl-[256px]">
      {/* vertical sidebar (desktop) — room for many modules */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[256px] flex-col border-r-2 border-line bg-white lg:flex">
        <a href={`#/${PAGES[0]?.id ?? ''}`} className="flex items-center gap-2.5 px-5 pt-5 pb-4">
          <img src="/images/opt/lion-head-160.webp" alt="" width={160} height={150} className="size-11 object-contain" />
          <span className="leading-none">
            <img src="/images/opt/logo-240.webp" alt="Gabush Kids" width={240} height={101} className="h-9 w-auto" />
            <span className="mt-1 block text-[10px] font-bold tracking-[0.16em] text-muted uppercase">Administración</span>
          </span>
        </a>
        <nav aria-label="Módulos" className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {PAGES.map((p) => (
            <a
              key={p.id}
              href={`#/${p.id}`}
              aria-current={p.id === page.id ? 'page' : undefined}
              className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition-colors', p.id === page.id ? 'bg-ink text-white shadow-[0_4px_0_#14124a]' : 'text-text hover:bg-paper hover:text-ink')}
            >
              <p.icon size={19} className={p.id === page.id ? 'text-yellow' : 'text-royal'} />
              <span className="flex-1">{p.label}</span>
              {badge(p.id)}
            </a>
          ))}
        </nav>
        <div className="border-t-2 border-line p-3">
          {name && (
            <div className="flex items-center gap-3 rounded-xl bg-paper px-3 py-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-full font-serif font-semibold text-white" style={{ background: roleColor(role) }}>
                {name.trim().slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-sm font-bold text-ink">{name}</span>
                <span className="block text-[11px] font-bold tracking-wide text-muted uppercase">{roleLabel(role)}</span>
              </span>
            </div>
          )}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={async () => {
                setSyncing(true)
                await Promise.all([syncNow(true), reloadEvents()])
                setSyncing(false)
              }}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-muted hover:bg-paper hover:text-ink"
            >
              <RefreshCw size={16} className={cn(syncing && 'animate-spin')} /> Actualizar
            </button>
            <button type="button" onClick={logout} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-muted hover:bg-[#fdf0ef] hover:text-berry">
              <LogOut size={16} /> Salir
            </button>
          </div>
          <a href="/" className="mt-1 block rounded-lg px-3 py-2 text-center text-xs font-semibold text-muted hover:text-royal">
            Ver la página →
          </a>
        </div>
      </aside>

      {/* top bar (phones / tablets) */}
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur lg:hidden">
        <div className="flex h-16 items-center gap-3 px-4">
          <img src="/images/opt/lion-head-160.webp" alt="" width={160} height={150} className="size-10 object-contain" />
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate font-serif text-lg font-semibold text-ink">{page.label || 'Gabush Kids'}</span>
            {name && (
              <span className="block truncate text-[11px] font-bold tracking-wide text-muted uppercase">
                {name} · {roleLabel(role)}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={async () => {
              setSyncing(true)
              await Promise.all([syncNow(true), reloadEvents()])
              setSyncing(false)
            }}
            title="Actualizar datos"
            aria-label="Actualizar datos"
            className="grid size-10 place-items-center rounded-lg text-muted hover:bg-paper hover:text-ink"
          >
            <RefreshCw size={18} className={cn(syncing && 'animate-spin')} />
          </button>
          <button type="button" onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión" className="grid size-10 place-items-center rounded-lg text-muted hover:bg-paper hover:text-berry">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {update && (
        <button type="button" onClick={() => location.reload()} className="flex w-full items-center justify-center gap-2 bg-gold px-4 py-2.5 text-sm font-semibold text-ink">
          Hay una versión nueva de la app · <span className="underline">Actualizar</span>
        </button>
      )}

      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8 lg:px-8">
        {!loaded ? (
          <p className="flex items-center gap-2 text-muted">
            <Loader2 size={18} className="animate-spin" /> Cargando…
          </p>
        ) : (
          <>
            {failed && <p className="mb-4 rounded-lg bg-[#fdf0ef] px-4 py-3 text-sm font-medium text-berry">No se pudieron cargar todos los datos. Revisa tu conexión y recarga.</p>}
            <View />
          </>
        )}
      </main>

      {/* bottom tab bar (phones) */}
      <nav aria-label="Módulos" className={cn("fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden", PAGES.length < 2 && "hidden")}>
        <div className="grid" style={{ gridTemplateColumns: `repeat(${MOBILE_MAIN.length + (hasMore ? 1 : 0)}, minmax(0, 1fr))` }}>
          {PAGES.filter((p) => MOBILE_MAIN.includes(p.id)).map((p) => (
            <a key={p.id} href={`#/${p.id}`} aria-current={p.id === page.id ? 'page' : undefined} className={cn('flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold', p.id === page.id ? 'text-ink' : 'text-muted')}>
              <span className={cn('grid h-8 w-12 place-items-center rounded-full', p.id === page.id && 'bg-[#eeedfb] text-royal')}>
                <p.icon size={20} />
              </span>
              {p.label}
            </a>
          ))}
          {hasMore && (
          <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} className={cn('relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold', !MOBILE_MAIN.includes(page.id) ? 'text-ink' : 'text-muted')}>
            <span className={cn('grid h-8 w-12 place-items-center rounded-full', !MOBILE_MAIN.includes(page.id) && 'bg-[#eeedfb] text-royal')}>{more ? <X size={20} /> : <Menu size={20} />}</span>
            Más
            {newIns > 0 && <span className="absolute top-1.5 right-[calc(50%-22px)] size-2.5 rounded-full bg-berry" />}
          </button>
          )}
        </div>
        <AnimatePresence>
          {more && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute inset-x-3 bottom-full mb-2 rounded-xl border border-line bg-white p-2 shadow-[0_20px_40px_-20px_rgba(35,32,107,0.5)]">
              {PAGES.filter((p) => !MOBILE_MAIN.includes(p.id)).map((p) => (
                <a key={p.id} href={`#/${p.id}`} className={cn('flex items-center gap-3 rounded-lg px-3 py-3 font-semibold', p.id === page.id ? 'bg-paper text-ink' : 'text-text')}>
                  <p.icon size={19} className="text-royal" /> <span className="flex-1">{p.label}</span> {badge(p.id)}
                </a>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <AnimatePresence>
        {toast && (
          <motion.p role="status" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className="fixed inset-x-4 bottom-24 z-[95] mx-auto max-w-sm rounded-lg bg-ink px-4 py-3 text-center text-sm font-medium text-white shadow-lg lg:bottom-8">
            {toast}
          </motion.p>
        )}
      </AnimatePresence>

      <StudentEditor />
      <ChargeModal />
      <ReminderModal />
      <DayBillingModal />
      <PhotoViewer />
      <AdminLayer />
    </div>
  )
}

export function AdminApp() {
  const checked = useCalendar((s) => s.sessionChecked)
  const admin = useCalendar((s) => s.admin)
  useEffect(() => {
    checkAdmin(true)
  }, [])

  if (!checked)
    return (
      <div className="grid min-h-svh place-items-center bg-paper text-muted">
        <Loader2 className="animate-spin" />
      </div>
    )
  if (!admin)
    return (
      <div className="grid min-h-svh place-items-center bg-paper p-4">
        <div className="flex w-full flex-col items-center gap-6">
          <img src="/images/opt/logo-480.webp" alt="Gabush Kids" width={480} height={202} className="h-20 w-auto" />
          <LoginForm />
          <a href="/" className="text-sm font-semibold text-royal">
            ← Volver a la página
          </a>
        </div>
      </div>
    )
  return <Shell />
}
