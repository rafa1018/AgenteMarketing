import { AnimatePresence, motion } from 'motion/react'
import { BarChart3, Briefcase, ExternalLink, Home, Layers, Loader2, LogIn, LogOut, Mail, Monitor, Moon, MoreHorizontal, Music2, RefreshCw, Settings as SettingsIcon, Sun, Users } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Logo } from '@/components/ui/Logo'
import { cn } from '@/lib/utils'
import { api, checkSession, login, logout, setUnread, useSession, useUnread } from './api'
import { setTheme, useTheme, type ThemePref } from './theme'
import { Toasts, btnPrimary, field, label, useRoute } from './ui'
import { HomePage } from './pages/Home'
import { MessagesPage } from './pages/Messages'
import { VisitsPage } from './pages/Visits'
import { ExperiencePage } from './pages/Experience'
import { StackPage } from './pages/Stack'
import { SubscribersPage } from './pages/Subscribers'
import { MusicPage } from './pages/Music'
import { SettingsPage } from './pages/Settings'

// `main` pages go in the phone's bottom bar; the rest live under "Más"
const PAGES = [
  { id: 'inicio', label: 'Inicio', icon: Home, view: HomePage, main: true },
  { id: 'mensajes', label: 'Mensajes', icon: Mail, view: MessagesPage, main: true },
  { id: 'visitas', label: 'Visitas', icon: BarChart3, view: VisitsPage, main: true },
  { id: 'experiencia', label: 'Experiencia', icon: Briefcase, view: ExperiencePage, main: true },
  { id: 'suscriptores', label: 'Suscriptores', icon: Users, view: SubscribersPage, main: false },
  { id: 'stack', label: 'Stack', icon: Layers, view: StackPage, main: false },
  { id: 'musica', label: 'Música', icon: Music2, view: MusicPage, main: false },
  { id: 'ajustes', label: 'Ajustes', icon: SettingsIcon, view: SettingsPage, main: false },
] as const

const THEMES: { id: ThemePref; label: string; icon: typeof Sun }[] = [
  { id: 'system', label: 'Automático', icon: Monitor },
  { id: 'light', label: 'Claro', icon: Sun },
  { id: 'dark', label: 'Oscuro', icon: Moon },
]

/** Cycles automático → claro → oscuro. */
function ThemeButton() {
  const pref = useTheme()
  const i = THEMES.findIndex((t) => t.id === pref)
  const cur = THEMES[i]
  const next = THEMES[(i + 1) % THEMES.length]
  return (
    <button type="button" onClick={() => setTheme(next.id)} className="grid size-10 place-items-center rounded-md text-muted hover:text-fg" aria-label={`Tema: ${cur.label}. Cambiar a ${next.label}`} title={`Tema: ${cur.label}`}>
      <cur.icon size={17} />
    </button>
  )
}

export function AdminApp() {
  const session = useSession()
  useEffect(() => {
    checkSession()
  }, [])

  if (session.status === 'checking') {
    return (
      <div className="grid min-h-dvh place-items-center text-muted">
        <Loader2 className="animate-spin" />
      </div>
    )
  }
  return (
    <>
      {session.status === 'in' ? <Shell /> : <Login expired={session.expired} />}
      <Toasts />
    </>
  )
}

function Login({ expired }: { expired?: boolean }) {
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const r = await login(user.trim(), password)
    setBusy(false)
    if (r === 'invalid') setError('Usuario o contraseña incorrectos.')
    else if (r === 'rate_limited') setError('Demasiados intentos. Espera 15 minutos e intenta de nuevo.')
    else if (r === 'error') setError('No se pudo conectar con el servidor.')
  }

  return (
    <main className="grid-bg grid min-h-dvh place-items-center px-4 py-10">
      <motion.form initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} onSubmit={submit} className="panel corners w-full max-w-sm bg-abyss/80 p-7 backdrop-blur">
        <Logo />
        <h1 className="mt-6 font-display text-2xl font-semibold">Panel de administración</h1>
        <p className="mt-1 text-sm text-muted">rafaelpedraza.dev</p>
        {expired && <p className="mt-4 rounded-lg border border-line-strong bg-steel/50 px-3 py-2 text-sm text-muted">Tu sesión expiró. Ingresa de nuevo.</p>}
        <label className="mt-6 block">
          <span className={label}>Usuario</span>
          <input className={field} value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" autoCapitalize="none" required />
        </label>
        <label className="mt-4 block">
          <span className={label}>Contraseña</span>
          <input className={field} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {error && (
          <p role="alert" className="mt-4 text-sm text-danger">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className={cn(btnPrimary, 'mt-6 w-full')}>
          {busy ? <Loader2 size={17} className="animate-spin" /> : <LogIn size={17} />} Ingresar
        </button>
      </motion.form>
    </main>
  )
}

function Shell() {
  const route = useRoute('inicio')
  const page = PAGES.find((p) => p.id === route) ?? PAGES[0]
  const unread = useUnread()
  const [tick, setTick] = useState(0) // bump → pages reload their data
  const [spinning, setSpinning] = useState(false)

  // keep the unread badge fresh: on focus, when the app comes back to the foreground and every minute
  useEffect(() => {
    const sync = () => api.get('messages.php').then(({ data }) => data?.ok && setUnread(data.unread))
    sync()
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        sync()
        setTick((t) => t + 1)
      }
    }
    document.addEventListener('visibilitychange', onVis)
    const id = window.setInterval(sync, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.clearInterval(id)
    }
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0) // newer browsers return a Promise here: never return it from the effect
  }, [route])

  const refresh = () => {
    setSpinning(true)
    setTick((t) => t + 1)
    window.setTimeout(() => setSpinning(false), 700)
  }

  const View = page.view
  return (
    <div className="min-h-dvh pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-10">
      <header className="sticky top-0 z-40 border-b border-line bg-ink/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <a href="#/inicio" className="flex items-center gap-3" aria-label="Inicio">
            <Logo />
            <span className="hud hidden !text-[9.5px] text-dim sm:inline">Panel</span>
          </a>
          <nav className="ml-4 hidden items-center gap-0.5 lg:flex">
            {PAGES.map((p) => (
              <a key={p.id} href={`#/${p.id}`} title={p.label} className={cn('relative flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors', p.id === page.id ? 'bg-steel/70 text-fg' : 'text-muted hover:text-fg')}>
                <p.icon size={16} /> <span className="hidden xl:inline">{p.label}</span>
                {p.id === 'mensajes' && unread > 0 && <Badge n={unread} />}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <ThemeButton />
            <button type="button" onClick={refresh} className="grid size-10 place-items-center rounded-md text-muted hover:text-fg" aria-label="Actualizar">
              <RefreshCw size={17} className={cn(spinning && 'animate-spin')} />
            </button>
            <a href="/" target="_blank" rel="noopener" className="grid size-10 place-items-center rounded-md text-muted hover:text-fg" aria-label="Ver el sitio">
              <ExternalLink size={17} />
            </a>
            <button type="button" onClick={logout} className="hidden size-10 place-items-center rounded-md text-muted hover:text-danger lg:grid" aria-label="Cerrar sesión">
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <AnimatePresence mode="wait">
          <motion.div key={page.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            <View tick={tick} />
          </motion.div>
        </AnimatePresence>
      </main>

      <TabBar current={page.id} unread={unread} />
    </div>
  )
}

/** Phone bottom bar: the main pages + "Más" (Stack, Música, Ajustes). */
function TabBar({ current, unread }: { current: string; unread: number }) {
  const [more, setMore] = useState(false)
  const extra = PAGES.filter((p) => !p.main)
  const inExtra = extra.some((p) => p.id === current)
  useEffect(() => setMore(false), [current])

  return (
    <>
      <AnimatePresence>
        {more && (
          <>
            <motion.div className="fixed inset-0 z-30 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMore(false)} />
            <motion.ul
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="panel fixed right-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 w-52 overflow-hidden !bg-abyss p-1.5 shadow-2xl lg:hidden"
            >
              {extra.map((p) => (
                <li key={p.id}>
                  <a href={`#/${p.id}`} className={cn('flex items-center gap-3 rounded-lg px-3 py-3 text-[15px]', p.id === current ? 'bg-steel/70 text-fg' : 'text-muted')}>
                    <p.icon size={18} /> {p.label}
                  </a>
                </li>
              ))}
              <li className="mt-1 border-t border-line pt-1">
                <button type="button" onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-[15px] text-danger">
                  <LogOut size={18} /> Cerrar sesión
                </button>
              </li>
            </motion.ul>
          </>
        )}
      </AnimatePresence>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
        <ul className="grid grid-cols-5">
          {PAGES.filter((p) => p.main).map((p) => (
            <li key={p.id}>
              <a href={`#/${p.id}`} className={cn('relative flex h-16 flex-col items-center justify-center gap-1 text-[10.5px]', p.id === current ? 'text-cyan' : 'text-muted')}>
                <span className="relative">
                  <p.icon size={21} />
                  {p.id === 'mensajes' && unread > 0 && <Badge n={unread} className="absolute -top-2 -right-3" />}
                </span>
                {p.label}
              </a>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more} className={cn('flex h-16 w-full flex-col items-center justify-center gap-1 text-[10.5px]', inExtra || more ? 'text-cyan' : 'text-muted')}>
              <MoreHorizontal size={21} />
              {inExtra ? PAGES.find((p) => p.id === current)?.label : 'Más'}
            </button>
          </li>
        </ul>
      </nav>
    </>
  )
}

function Badge({ n, className }: { n: number; className?: string }) {
  return <span className={cn('grid h-[18px] min-w-[18px] place-items-center rounded-full bg-volt px-1 font-mono text-[10px] leading-none text-white', className)}>{n > 99 ? '99+' : n}</span>
}
