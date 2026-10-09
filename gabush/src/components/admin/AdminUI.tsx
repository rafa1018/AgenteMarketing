import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, Check, Eye, EyeOff, Globe, Loader2, Lock, LockKeyhole, LogIn, Plus, ShieldCheck, UsersRound, X } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useLang, useT } from '@/i18n'
import { ui } from '@/i18n/ui'
import { cn } from '@/lib/utils'
import { dayDiff, formatRange, tint, todayYMD } from '@/lib/dates'
import {
  COLOR_NAMES,
  EVENT_COLORS,
  FESTIVO_COLOR,
  checkAdmin,
  closeEditor,
  login,
  saveEvent,
  useCalendar,
  type EventDraft,
  type LoginError,
} from '@/lib/calendar'
import { Modal } from '@/components/ui/Modal'
import { EventItem } from '@/components/calendar/EventItem'
import { ScheduleEditor } from './AdminSettings'

const field = 'block w-full min-w-0 min-h-[46px] rounded-lg border border-[#d6d8ec] bg-white px-3.5 py-2.5 text-[16px] text-text outline-none transition-[border-color,box-shadow] focus:border-royal focus:shadow-[0_0_0_4px_rgb(58_54_168/0.12)]'
const label = 'mb-1.5 block text-[14px] font-semibold text-ink'

/* ───────────── Navbar button ───────────── */

/**
 * Visitors and parents: "Portal familias" (/familia/). Staff already signed in: "Administrar" (/admin/).
 * The staff login stays reachable from the footer ("Acceso del personal").
 */
export function AdminButton({ className }: { className?: string }) {
  const t = useT()
  const admin = useCalendar((s) => s.admin)
  useEffect(() => {
    checkAdmin()
  }, [])
  const label = t(admin ? ui.admin.panel : ui.admin.families)
  return (
    <a
      href={admin ? '/admin/' : '/familia/'}
      aria-label={label}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold',
        admin ? 'bg-ink text-white hover:bg-royal' : 'border border-line bg-white text-ink hover:border-ink',
        className,
      )}
    >
      {admin ? <ShieldCheck size={17} /> : <UsersRound size={17} />}
      {!admin && <span className="sm:hidden">{t({ es: 'Familias', en: 'Families' })}</span>}
      <span className="hidden sm:inline">{label}</span>
    </a>
  )
}

/* ───────────── Login ───────────── */

/** Login card used by the admin panel. */
export function LoginForm() {
  const t = useT()
  const notice = useCalendar((s) => s.notice)
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<LoginError | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user.trim() || !pass) return setError('invalid')
    setBusy(true)
    setError(await login(user.trim(), pass))
    setBusy(false)
  }

  const msg = error && { invalid: ui.admin.invalid, rate_limited: ui.admin.rateLimited, not_configured: ui.admin.notConfigured, generic: ui.admin.generic }[error]

  return (
    <form onSubmit={submit} className="card w-full max-w-md p-6 sm:p-8">
      <span className="grid size-12 place-items-center rounded-xl bg-ink text-gold">
        <LockKeyhole size={22} />
      </span>
      <h1 className="mt-4 text-[1.7rem]">{t(ui.admin.loginTitle)}</h1>
      <p className="mt-1 text-[15px] text-muted">{t({ es: 'Ingresa para administrar el jardín.', en: 'Log in to manage the kindergarten.' })}</p>
      {(notice === 'expired' || notice === 'idle') && !error && <p className="mt-4 rounded-lg bg-[#fff4e0] px-3 py-2 text-sm font-medium text-[#8a5716]">{t(notice === 'idle' ? ui.admin.idle : ui.admin.expired)}</p>}

      <div className="mt-6 space-y-4">
        <div>
          <label htmlFor="adm-user" className={label}>
            {t(ui.admin.user)}
          </label>
          <input id="adm-user" className={field} value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} required />
        </div>
        <div>
          <label htmlFor="adm-pass" className={label}>
            {t(ui.admin.password)}
          </label>
          <div className="relative">
            <input id="adm-pass" type={show ? 'text' : 'password'} className={cn(field, 'pr-12')} value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" required />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={t(show ? ui.admin.hide : ui.admin.show)} className="absolute inset-y-0 right-0 grid w-12 place-items-center text-muted hover:text-ink">
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
      </div>

      {msg && (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-berry/30 bg-[#fdf0ef] px-3 py-2.5 text-sm font-medium text-berry">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" /> {t(msg)}
        </p>
      )}

      <button type="submit" disabled={busy} className="btn btn-primary mt-6 w-full disabled:opacity-70">
        {busy ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
        {t(busy ? ui.admin.entering : ui.admin.enter)}
      </button>
    </form>
  )
}

/** Every event as a list with edit / delete (admin calendar page). */
export function EventList() {
  const t = useT()
  const events = useCalendar((s) => s.events)
  const today = todayYMD()
  const upcoming = events.filter((e) => e.end >= today)
  const past = events.filter((e) => e.end < today).reverse()
  return (
    <div>
      {!events.length && <p className="rounded-lg bg-paper p-4 text-muted">{t(ui.admin.none)}</p>}
      {upcoming.length > 0 && (
        <>
          <h3 className="border-b border-line pb-2 text-lg">
            {t(ui.admin.upcoming)} <span className="text-muted">({upcoming.length})</span>
          </h3>
          <ul className="divide-y divide-line">
            {upcoming.map((e) => (
              <EventItem key={e.id} e={e} admin current={e.start <= today} />
            ))}
          </ul>
        </>
      )}
      {past.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer border-b border-line pb-2 font-serif text-lg font-semibold text-ink">
            {t(ui.admin.past)} <span className="text-muted">({past.length})</span>
          </summary>
          <ul className="divide-y divide-line">
            {past.map((e) => (
              <EventItem key={e.id} e={e} admin />
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

/* ───────────── Event editor ───────────── */

function Swatch({ color, active, onClick, children }: { color: string; active: boolean; onClick: () => void; children?: ReactNode }) {
  const t = useT()
  return (
    <button type="button" onClick={onClick} aria-pressed={active} aria-label={COLOR_NAMES[color] ? t(COLOR_NAMES[color]) : color} title={COLOR_NAMES[color] ? t(COLOR_NAMES[color]) : color} className={cn('grid size-9 place-items-center rounded-full text-white ring-offset-2 transition-transform hover:scale-110', active && 'ring-2 ring-ink')} style={{ background: color }}>
      {active && <Check size={16} strokeWidth={3} />}
      {children}
    </button>
  )
}

function EventEditor() {
  const t = useT()
  const { lang } = useLang()
  const editing = useCalendar((s) => s.editing)
  const [d, setD] = useState<EventDraft | null>(editing)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setD(editing)
    setErrors([])
    setFailed(false)
  }, [editing])

  const draft = d ?? editing
  const up = (patch: Partial<EventDraft>) => setD((x) => (x ? { ...x, ...patch } : x))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft) return
    const errs: string[] = []
    if (draft.title.trim().length < 2) errs.push('title')
    if (!draft.start) errs.push('start')
    if (!draft.end || draft.end < draft.start) errs.push('end')
    setErrors(errs)
    if (errs.length) return
    setBusy(true)
    setFailed(false)
    const res = await saveEvent({ ...draft, title: draft.title.trim(), description: draft.description.trim() })
    setBusy(false)
    if (res?.error === 'validation') setErrors(res.fields ?? [])
    else if (res?.error === 'generic') setFailed(true)
  }

  const color = draft?.type === 'festivo' ? FESTIVO_COLOR : (draft?.color ?? EVENT_COLORS[0])
  const custom = draft && !EVENT_COLORS.includes(draft.color)
  const err = (f: string, msg: { es: string; en: string }) => errors.includes(f) && <p className="mt-1 text-sm font-medium text-berry">{t(msg)}</p>

  return (
    <Modal open={Boolean(editing)} onClose={closeEditor} label={t(draft?.id ? ui.admin.editEvent : ui.admin.newEvent)} closeLabel={t(ui.programs.close)}>
      {draft && (
        <form onSubmit={submit} noValidate className="p-6 sm:p-8">
          <h2 className="pr-12 text-[1.8rem]">{t(draft.id ? ui.admin.editEvent : ui.admin.newEvent)}</h2>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="ev-title" className={label}>
                {t(ui.admin.form.title)} <span className="text-berry">*</span>
              </label>
              <input id="ev-title" className={field} value={draft.title} maxLength={80} onChange={(e) => up({ title: e.target.value })} placeholder={t(ui.admin.form.titlePh)} />
              {err('title', ui.admin.form.errTitle)}
            </div>

            <div className="sm:col-span-2">
              <span className={label}>{t(ui.admin.form.type)}</span>
              <div role="group" className="inline-flex rounded-lg border border-line p-1">
                {(['evento', 'festivo'] as const).map((ty) => (
                  <button
                    key={ty}
                    type="button"
                    aria-pressed={draft.type === ty}
                    onClick={() => up({ type: ty })}
                    className={cn('rounded-md px-4 py-2 text-sm font-semibold transition-colors', draft.type === ty ? (ty === 'festivo' ? 'bg-red-600 text-white' : 'bg-ink text-white') : 'text-muted hover:text-ink')}
                  >
                    {t(ty === 'festivo' ? ui.calendar.festivo : ui.calendar.evento)}
                  </button>
                ))}
              </div>
            </div>

            <div className="sm:col-span-2">
              <span className={label}>{t({ es: '¿Quién lo ve?', en: 'Who can see it?' })}</span>
              <div role="group" className="inline-flex rounded-lg border border-line p-1">
                {(['publico', 'privado'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={(draft.visibility ?? 'publico') === v}
                    onClick={() => up({ visibility: v })}
                    className={cn('inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition-colors', (draft.visibility ?? 'publico') === v ? 'bg-ink text-white' : 'text-muted hover:text-ink')}
                  >
                    {v === 'privado' ? <Lock size={14} /> : <Globe size={14} />}
                    {v === 'privado' ? t({ es: 'Privado', en: 'Private' }) : t({ es: 'Público', en: 'Public' })}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-sm text-muted">
                {(draft.visibility ?? 'publico') === 'privado'
                  ? t({ es: 'Solo tú lo ves en el panel. Las familias no lo ven en la página.', en: 'Only you see it in the panel. Families do not see it on the website.' })
                  : t({ es: 'Lo ve todo el mundo en el calendario de la página.', en: 'Everyone sees it in the website calendar.' })}
              </p>
            </div>

            <div className="sm:col-span-2">
              <span className={label}>{t(ui.admin.form.color)}</span>
              {draft.type === 'festivo' ? (
                <p className="flex items-center gap-2 text-[15px] text-muted">
                  <span className="size-6 rounded-full" style={{ background: FESTIVO_COLOR }} /> {t(ui.admin.form.festivoNote)}
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-2.5">
                  {EVENT_COLORS.map((c) => (
                    <Swatch key={c} color={c} active={draft.color === c} onClick={() => up({ color: c })} />
                  ))}
                  <label className={cn('relative grid size-9 cursor-pointer place-items-center overflow-hidden rounded-full border border-dashed border-muted/60 text-muted ring-offset-2', custom && 'ring-2 ring-ink')} style={custom ? { background: draft.color, borderStyle: 'solid' } : undefined} title={t(ui.admin.form.custom)}>
                    {!custom && <Plus size={16} />}
                    <input type="color" value={draft.color} onChange={(e) => up({ color: e.target.value })} aria-label={t(ui.admin.form.custom)} className="absolute inset-0 cursor-pointer opacity-0" />
                  </label>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="ev-start" className={label}>
                {t(ui.admin.form.start)} <span className="text-berry">*</span>
              </label>
              <input id="ev-start" type="date" className={field} value={draft.start} onChange={(e) => up({ start: e.target.value, end: !draft.end || draft.end < e.target.value ? e.target.value : draft.end })} />
              {err('start', ui.admin.form.errStart)}
            </div>
            <div>
              <label htmlFor="ev-end" className={label}>
                {t(ui.admin.form.end)} <span className="text-berry">*</span>
              </label>
              <input id="ev-end" type="date" className={field} value={draft.end} min={draft.start} onChange={(e) => up({ end: e.target.value })} />
              {err('end', ui.admin.form.errEnd)}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="ev-desc" className={label}>
                {t(ui.admin.form.description)} <span className="text-sm font-normal text-muted">({t(ui.form.optional)})</span>
              </label>
              <textarea id="ev-desc" rows={3} maxLength={300} className={cn(field, 'resize-y')} value={draft.description} onChange={(e) => up({ description: e.target.value })} placeholder={t(ui.admin.form.descriptionPh)} />
            </div>
          </div>

          {/* preview */}
          <div className="mt-6 rounded-xl border border-line p-4" style={{ background: draft.type === 'festivo' ? '#fee2e2' : tint(color, 0.1) }}>
            <p className="text-[12px] font-semibold tracking-[0.12em] text-muted uppercase">{t(ui.admin.form.preview)}</p>
            <p className="mt-1.5 flex items-center gap-2 font-semibold text-ink">
              <span className="size-3 rounded-full" style={{ background: color }} />
              {draft.title.trim() || t(ui.admin.form.titlePh)}
            </p>
            {draft.start && draft.end >= draft.start && (
              <p className="text-sm text-muted first-letter:uppercase">
                {formatRange(draft.start, draft.end, lang)}
                {draft.end > draft.start && ` · ${dayDiff(draft.start, draft.end) + 1} ${t(ui.calendar.days)}`}
              </p>
            )}
          </div>

          <AnimatePresence>
            {failed && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="alert" className="mt-4 flex items-center gap-2 text-sm font-medium text-berry">
                <AlertTriangle size={16} /> {t(ui.admin.form.errGeneric)}
              </motion.p>
            )}
          </AnimatePresence>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={closeEditor} className="btn btn-ghost">
              <X size={18} /> {t(ui.admin.form.cancel)}
            </button>
            <button type="submit" disabled={busy} className="btn btn-primary disabled:opacity-70">
              {busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              {t(busy ? ui.admin.form.saving : ui.admin.form.save)}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}

/** All admin dialogs, mounted once in App. */
export function AdminLayer() {
  return (
    <>
      <EventEditor />
      <ScheduleEditor />
    </>
  )
}
