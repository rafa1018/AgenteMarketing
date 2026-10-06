import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Background } from '@/components/layout/Background'
import { Brand } from '@/components/layout/Navbar'
import { LanguageToggle } from '@/components/ui/LanguageToggle'
import { BotFigure, type BotMood } from '@/components/scene/BotFigure'
import { useT } from '@/i18n'
import { links, ui } from '@/i18n/ui'
import { EASE_OUT, cn } from '@/lib/utils'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * /login — a native form that POSTs straight to the platform's own login (same fields as today:
 * email, password, remember_me). This page never stores or sees the credentials beyond the browser.
 * The MiMatt Bot reacts to the form: waves, follows the email, covers its eyes for the password.
 */
export function LoginPage() {
  const t = useT()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [caps, setCaps] = useState(false)
  const [focus, setFocus] = useState<'email' | 'password' | null>(null)
  const [errors, setErrors] = useState<{ email?: boolean; password?: boolean }>({})
  const [submitting, setSubmitting] = useState(false)
  const [greeting, setGreeting] = useState(true)
  const emailRef = useRef<HTMLInputElement>(null)
  const passRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const id = window.setTimeout(() => setGreeting(false), 2600)
    return () => window.clearTimeout(id)
  }, [])

  const hasError = errors.email || errors.password
  const mood: BotMood = submitting
    ? 'alert'
    : hasError
      ? 'loss'
      : focus === 'password'
        ? showPass
          ? 'peek'
          : 'shy'
        : greeting && !focus
          ? 'wave'
          : 'scan'
  // eyes follow the caret along the email field
  const lookX = focus === 'email' ? Math.max(-4, Math.min(4, -4 + (email.length / 28) * 8)) : undefined
  const botLine = submitting
    ? ui.login.bot.go
    : hasError
      ? ui.login.bot.error
      : focus === 'password'
        ? showPass
          ? ui.login.bot.peek
          : ui.login.bot.shy
        : focus === 'email'
          ? ui.login.bot.email
          : ui.login.bot.hello

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    const next = { email: !EMAIL_RE.test(email.trim()), password: password.length === 0 }
    setErrors(next)
    if (next.email || next.password) {
      e.preventDefault()
      ;(next.email ? emailRef : passRef).current?.focus()
      return
    }
    // valid: let the browser POST the form to the platform (full-page navigation)
    setSubmitting(true)
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState?.('CapsLock') ?? false)

  return (
    <div className="relative min-h-dvh">
      <Background />
      <header className="container-x flex h-16 items-center gap-4">
        <a href="/" aria-label="MiMatt PRO">
          <Brand />
        </a>
        <div className="ml-auto flex items-center gap-2">
          <LanguageToggle />
          <a href="/" className="hidden h-9 items-center gap-2 rounded-md border border-line px-3 text-[13px] text-muted transition-colors hover:border-line-strong hover:text-fg sm:inline-flex">
            <ArrowLeft size={14} /> {t(ui.login.back)}
          </a>
        </div>
      </header>

      <main className="container-x grid min-h-[calc(100dvh-4rem)] items-center gap-12 pt-6 pb-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        {/* ── brand side ── */}
        <motion.section initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.9, ease: EASE_OUT }} className="order-2 lg:order-1">
          <p className="chip !text-cyan">
            <span className="size-1.5 animate-pulse rounded-full bg-long" /> {t(ui.login.kicker)}
          </p>
          <h1 className="mt-6 font-display text-[clamp(2.2rem,4.6vw,3.8rem)] leading-[1.02] font-semibold tracking-[-0.035em]">
            <span className="text-silver">{t(ui.login.title1)}</span>
            <br />
            <span className="text-gold">{t(ui.login.title2)}</span>
          </h1>
          <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-muted">{t(ui.login.text)}</p>
          <ul className="mt-7 space-y-3">
            {ui.login.bullets.map((b, i) => (
              <motion.li key={b.en} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.12 }} className="flex items-center gap-3 text-[15px] text-fg/90">
                <CheckCircle2 size={18} className="shrink-0 text-cyan" /> {t(b)}
              </motion.li>
            ))}
          </ul>
          <MarketPanel />
        </motion.section>

        {/* ── form side ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.1 }} className="order-1 mx-auto w-full max-w-[440px] pt-24 lg:order-2">
          <div className="relative">
            {/* the bot peeks over the card */}
            <div className="absolute -top-[118px] left-1/2 z-0 -translate-x-1/2">
              <BotFigure mood={mood} lookX={lookX} size={128} />
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={botLine.en}
                initial={{ opacity: 0, y: 6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25 }}
                className={cn(
                  'absolute -top-[96px] left-[calc(50%+66px)] z-20 max-w-[170px] rounded-2xl rounded-bl-sm border px-3 py-2 text-[12px] leading-snug shadow-xl backdrop-blur-md',
                  hasError ? 'border-short/50 bg-[#22070c]/90 text-short' : submitting ? 'border-cyan/60 bg-abyss/90 text-cyan' : 'border-line bg-abyss/90 text-fg/90',
                )}
                aria-live="polite"
              >
                {t(botLine)}
              </motion.p>
            </AnimatePresence>

            <form
              method="post"
              action={links.loginAction}
              onSubmit={onSubmit}
              noValidate
              className="relative z-10 rounded-3xl border border-line-strong bg-gradient-to-b from-[#132a52]/85 to-[#071226]/95 p-7 shadow-[0_40px_100px_-30px_rgb(0_0_0/0.9),0_0_80px_-40px_rgb(var(--brand-rgb)/0.5)] backdrop-blur-xl sm:p-8"
            >
              <div aria-hidden className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan/70 to-transparent" />
              <h2 className="font-display text-2xl font-semibold">{t(ui.login.cardTitle)}</h2>
              <p className="mt-1 text-[14px] text-muted">{t(ui.login.cardSub)}</p>

              {/* email */}
              <label className="mt-7 block">
                <span className="hud !text-[10px] text-muted">{t(ui.login.email)}</span>
                <span className={cn('mt-2 flex items-center gap-2.5 rounded-xl border bg-ink/60 px-3.5 transition-colors focus-within:border-cyan/70', errors.email ? 'border-danger/70' : 'border-line-strong')}>
                  <Mail size={17} className="shrink-0 text-dim" />
                  <input
                    ref={emailRef}
                    type="email"
                    name="email"
                    autoComplete="username"
                    inputMode="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (errors.email) setErrors((x) => ({ ...x, email: false }))
                    }}
                    onFocus={() => setFocus('email')}
                    onBlur={() => setFocus(null)}
                    placeholder={t(ui.login.emailPh)}
                    aria-invalid={errors.email || undefined}
                    className="h-12 min-w-0 flex-1 bg-transparent text-[15px] text-fg placeholder:text-dim focus:outline-none"
                  />
                </span>
                {errors.email && <span className="mt-1.5 block text-[12.5px] text-danger">{t(ui.login.errEmail)}</span>}
              </label>

              {/* password */}
              <label className="mt-5 block">
                <span className="hud !text-[10px] text-muted">{t(ui.login.password)}</span>
                <span className={cn('mt-2 flex items-center gap-2.5 rounded-xl border bg-ink/60 pr-1.5 pl-3.5 transition-colors focus-within:border-cyan/70', errors.password ? 'border-danger/70' : 'border-line-strong')}>
                  <Lock size={17} className="shrink-0 text-dim" />
                  <input
                    ref={passRef}
                    type={showPass ? 'text' : 'password'}
                    name="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (errors.password) setErrors((x) => ({ ...x, password: false }))
                    }}
                    onFocus={() => setFocus('password')}
                    onBlur={() => setFocus(null)}
                    onKeyDown={onKey}
                    onKeyUp={onKey}
                    aria-invalid={errors.password || undefined}
                    className="h-12 min-w-0 flex-1 bg-transparent text-[15px] text-fg placeholder:text-dim focus:outline-none"
                  />
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()} // keep focus in the field
                    onClick={() => setShowPass((v) => !v)}
                    aria-label={t(showPass ? ui.login.hide : ui.login.show)}
                    aria-pressed={showPass}
                    className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-white/5 hover:text-fg"
                  >
                    {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
                {errors.password && <span className="mt-1.5 block text-[12.5px] text-danger">{t(ui.login.errPassword)}</span>}
                {caps && focus === 'password' && (
                  <span className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-cyan">
                    <AlertTriangle size={13} /> {t(ui.login.caps)}
                  </span>
                )}
              </label>

              <label className="mt-5 inline-flex cursor-pointer items-center gap-2.5 text-[14px] text-muted select-none">
                <input type="checkbox" name="remember_me" className="size-4 rounded accent-[var(--brand-2)]" />
                {t(ui.login.remember)}
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="group relative mt-6 inline-flex h-12 w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-gradient-to-b from-[var(--brand-btn)] to-[var(--brand-3)] font-mono text-[12px] font-semibold tracking-[0.18em] text-[var(--on-brand)] uppercase shadow-[0_0_0_1px_rgb(var(--brand-1-rgb)/0.6),0_10px_40px_-10px_rgb(var(--brand-rgb)/0.75)] transition-[filter] hover:brightness-110 disabled:opacity-80"
              >
                <span aria-hidden className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                <span className="relative">{t(submitting ? ui.login.submitting : ui.login.submit)}</span>
                {!submitting && <ArrowRight size={16} className="relative transition-transform group-hover:translate-x-0.5" />}
              </button>

              <p className="mt-6 text-center text-[14px] text-muted">
                {t(ui.login.noAccount)}{' '}
                <a href={links.signup} className="font-medium text-cyan hover:underline">
                  {t(ui.login.create)}
                </a>
              </p>
            </form>
          </div>
          <p className="mt-5 flex items-center justify-center gap-2 text-center text-[12px] text-dim">
            <ShieldCheck size={14} className="text-long" /> {t(ui.login.secure)}
          </p>
        </motion.section>
      </main>
    </div>
  )
}

/* ── live-looking market panel (illustrative, not data) ── */

const INSTRUMENTS = [
  { sym: 'ES', base: 6125, vol: 1.2 },
  { sym: 'NQ', base: 21480, vol: 5 },
  { sym: 'YM', base: 44120, vol: 9 },
]

function MarketPanel() {
  const t = useT()
  const reduce = useReducedMotion()
  const [series, setSeries] = useState(() =>
    INSTRUMENTS.map((m, k) => {
      let v = m.base
      return Array.from({ length: 28 }, (_, i) => (v += Math.sin(i * 0.7 + k * 2) * m.vol + Math.cos(i * 0.3 + k) * m.vol * 0.6))
    }),
  )

  useEffect(() => {
    if (reduce) return
    const id = window.setInterval(() => {
      setSeries((all) =>
        all.map((s, k) => {
          const m = INSTRUMENTS[k]
          const last = s[s.length - 1]
          const next = last + (Math.random() - 0.48) * m.vol * 1.6 + (m.base - last) * 0.03
          return [...s.slice(1), next]
        }),
      )
    }, 900)
    return () => window.clearInterval(id)
  }, [reduce])

  return (
    <div className="panel mt-9 max-w-lg p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="hud !text-[10px] text-cyan">{t(ui.login.marketTitle)}</span>
        <span className="font-mono text-[10px] text-dim">{t(ui.login.marketNote)}</span>
      </div>
      <ul className="divide-y divide-line">
        {INSTRUMENTS.map((m, k) => {
          const s = series[k]
          const last = s[s.length - 1]
          const chg = ((last - s[0]) / s[0]) * 100
          const up = chg >= 0
          const lo = Math.min(...s)
          const hi = Math.max(...s)
          const pts = s.map((v, i) => `${(i / (s.length - 1)) * 120},${28 - ((v - lo) / Math.max(hi - lo, 0.01)) * 24}`).join(' ')
          return (
            <li key={m.sym} className="flex items-center gap-4 py-2.5">
              <span className="w-10 font-display text-[16px] font-semibold">{m.sym}</span>
              <svg viewBox="0 0 120 30" className="h-8 flex-1" aria-hidden>
                <polyline points={pts} fill="none" stroke={up ? '#2fd08e' : '#ff5b6e'} strokeWidth={1.6} strokeLinejoin="round" />
              </svg>
              <span className="w-24 text-right font-mono text-[13px] text-fg tabular-nums">{last.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className={cn('w-16 text-right font-mono text-[12px] tabular-nums', up ? 'text-long' : 'text-short')}>
                {up ? '+' : ''}
                {chg.toFixed(2)}%
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
