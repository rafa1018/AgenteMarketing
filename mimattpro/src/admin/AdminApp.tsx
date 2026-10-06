import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, ExternalLink, Eye, EyeOff, Loader2, LogIn, LogOut, Settings as SettingsIcon, User } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Background } from '@/components/layout/Background'
import { Brand } from '@/components/layout/Navbar'
import { BotFigure } from '@/components/scene/BotFigure'
import { cn } from '@/lib/utils'
import { checkSession, login, logout, useSession, useToast } from './api'
import { SettingsPage } from './Settings'

const field = 'h-12 w-full rounded-xl border border-line-strong bg-ink/60 px-3.5 text-[15px] text-fg placeholder:text-dim focus:border-cyan/70 focus:outline-none'
export const btnPrimary =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[var(--brand-btn)] to-[var(--brand-3)] px-5 font-mono text-[11.5px] font-semibold tracking-[0.16em] text-[var(--on-brand)] uppercase shadow-[0_10px_30px_-10px_rgb(var(--brand-rgb)/0.8)] transition-[filter] hover:brightness-110 disabled:opacity-60'
export const btnGhost = 'inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line-strong px-4 text-[14px] text-fg transition-colors hover:border-cyan/60'

export function AdminApp() {
  const session = useSession()
  useEffect(() => {
    checkSession()
  }, [])

  return (
    <div className="relative min-h-dvh">
      <Background />
      {session.status === 'checking' ? (
        <div className="grid min-h-dvh place-items-center text-muted">
          <Loader2 className="animate-spin" />
        </div>
      ) : session.status === 'in' ? (
        <Shell user={session.user} defaultPassword={session.defaultPassword} />
      ) : (
        <Login expired={session.expired} />
      )}
      <Toasts />
    </div>
  )
}

/* ───────── login ───────── */

function Login({ expired }: { expired?: boolean }) {
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [onPass, setOnPass] = useState(false)

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
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm pt-24">
        <div className="relative">
          <div className="absolute -top-[112px] left-1/2 -translate-x-1/2">
            <BotFigure mood={busy ? 'alert' : error ? 'loss' : onPass ? (show ? 'peek' : 'shy') : 'scan'} size={120} />
          </div>
          <motion.form
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={submit}
            className="relative rounded-3xl border border-line-strong bg-gradient-to-b from-[#132a52]/85 to-[#071226]/95 p-7 shadow-[0_40px_100px_-30px_rgb(0_0_0/0.9)] backdrop-blur-xl"
          >
            <Brand />
            <h1 className="mt-5 font-display text-2xl font-semibold">Panel de administración</h1>
            <p className="mt-1 text-sm text-muted">Gestiona el sitio de MiMatt PRO</p>
            {expired && <p className="mt-4 rounded-lg border border-line-strong bg-steel/50 px-3 py-2 text-sm text-muted">Tu sesión expiró. Ingresa de nuevo.</p>}
            <label className="mt-6 block">
              <span className="hud !text-[10px] text-muted">Usuario</span>
              <input className={cn(field, 'mt-2')} value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" autoCapitalize="none" required />
            </label>
            <label className="mt-4 block">
              <span className="hud !text-[10px] text-muted">Contraseña</span>
              <span className="relative mt-2 block">
                <input
                  className={cn(field, 'pr-12')}
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setOnPass(true)}
                  onBlur={() => setOnPass(false)}
                  autoComplete="current-password"
                  required
                />
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setShow((v) => !v)} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="absolute top-1/2 right-1.5 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted hover:text-fg">
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>
            {error && (
              <p role="alert" className="mt-4 text-sm text-danger">
                {error}
              </p>
            )}
            <button type="submit" disabled={busy} className={cn(btnPrimary, 'mt-6 w-full')}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />} Ingresar
            </button>
          </motion.form>
        </div>
        <a href="/" className="mt-5 flex items-center justify-center gap-2 text-sm text-muted hover:text-fg">
          <ExternalLink size={14} /> Ver el sitio
        </a>
      </div>
    </main>
  )
}

/* ───────── shell: sidebar on desktop, top bar on phones ───────── */

const PAGES = [{ id: 'ajustes', label: 'Ajustes', icon: SettingsIcon }] as const

function Shell({ user, defaultPassword }: { user: string; defaultPassword: boolean }) {
  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[250px_1fr]">
      {/* sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-abyss/70 p-5 backdrop-blur-xl lg:flex">
        <Brand />
        <p className="hud mt-1 ml-[46px] !text-[9px] text-dim">Panel</p>
        <nav className="mt-8 space-y-1">
          {PAGES.map((p) => (
            <a key={p.id} href={`#/${p.id}`} className="flex items-center gap-3 rounded-xl border border-volt/40 bg-volt/10 px-3 py-2.5 text-[14px] text-fg">
              <p.icon size={17} className="text-cyan" /> {p.label}
            </a>
          ))}
        </nav>
        <div className="mt-auto space-y-1">
          <a href="/" target="_blank" rel="noopener" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] text-muted hover:text-fg">
            <ExternalLink size={16} /> Ver el sitio
          </a>
          <div className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
            <span className="grid size-8 place-items-center rounded-full bg-volt/20 text-cyan">
              <User size={15} />
            </span>
            <span className="min-w-0 flex-1 truncate text-[14px]">{user}</span>
            <button type="button" onClick={logout} className="grid size-8 place-items-center rounded-lg text-muted hover:text-danger" aria-label="Cerrar sesión">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* top bar (phones / tablets) */}
      <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-line bg-ink/85 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-xl lg:hidden">
        <Brand />
        <a href="/" target="_blank" rel="noopener" className="ml-auto grid size-10 place-items-center rounded-lg text-muted hover:text-fg" aria-label="Ver el sitio">
          <ExternalLink size={17} />
        </a>
        <button type="button" onClick={logout} className="grid size-10 place-items-center rounded-lg text-muted hover:text-danger" aria-label="Cerrar sesión">
          <LogOut size={17} />
        </button>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        {defaultPassword && (
          <motion.a
            href="#seguridad"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex items-start gap-3 rounded-2xl border border-[#f5b85b]/40 bg-[#f5b85b]/10 px-4 py-3 text-[14px] text-[#f5c77e]"
          >
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span>
              <b>Estás usando la contraseña inicial (admin).</b> Cualquiera podría adivinarla: cámbiala ahora en <u>Seguridad</u>.
            </span>
          </motion.a>
        )}
        <SettingsPage />
      </main>
    </div>
  )
}

function Toasts() {
  const t = useToast()
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] z-[100] flex justify-center px-4">
      <AnimatePresence>
        {t && (
          <motion.p key={t.id} initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 8, opacity: 0 }} className="rounded-xl border border-line-strong bg-abyss/95 px-4 py-3 text-sm text-fg shadow-2xl backdrop-blur">
            {t.text}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
