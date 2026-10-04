import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, CheckCircle2, Loader2, Send } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useLang, useT } from '@/i18n'
import { ui } from '@/i18n/ui'
import { sendContact } from '@/lib/api'
import { EASE_OUT, cn } from '@/lib/utils'

type Field = 'name' | 'phone' | 'subject' | 'message'
type Status = 'idle' | 'sending' | 'success' | 'error'

const LIMITS: Record<Field, number> = { name: 80, phone: 25, subject: 120, message: 2000 }
const EMPTY: Record<Field, string> = { name: '', phone: '', subject: '', message: '' }

function validate(v: Record<Field, string>): Field[] {
  const bad: Field[] = []
  if (v.name.trim().length < 2) bad.push('name')
  if (!/^\+?[0-9 ()\-.]{7,25}$/.test(v.phone.trim())) bad.push('phone')
  if (v.subject.trim().length < 3) bad.push('subject')
  if (v.message.trim().length < 10) bad.push('message')
  return bad
}

function Control({ id, label, error, children, counter }: { id: string; label: string; error?: string; children: ReactNode; counter?: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label htmlFor={id} className="hud !text-[9.5px] text-muted">{label}</label>
        {counter && <span className="font-mono text-[10px] text-dim">{counter}</span>}
      </div>
      {children}
      <AnimatePresence>
        {error && (
          <motion.p id={`${id}-error`} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-1.5 text-[12px] text-[#ff8a8a]">
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

const inputCls = (invalid: boolean) =>
  cn(
    'w-full rounded-lg border bg-ink/60 px-3.5 py-3 text-[15px] text-fg placeholder:text-dim outline-none transition-[border-color,box-shadow] duration-300',
    'focus:border-cyan/60 focus:shadow-[0_0_0_3px_rgb(82_211_255/0.12)]',
    invalid ? 'border-[#ff8a8a]/60' : 'border-line',
  )

/**
 * Contact form → /api/contact.php → Telegram. No email is exposed.
 * Anti-spam: hidden honeypot field + minimum fill time + server-side rate limit.
 */
export function ContactForm() {
  const t = useT()
  const { lang } = useLang()
  const [values, setValues] = useState(EMPTY)
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [serverError, setServerError] = useState<'rate_limited' | 'generic' | null>(null)
  const [serverFields, setServerFields] = useState<Field[]>([])
  const shownAt = useRef(Date.now())
  const honeypot = useRef<HTMLInputElement>(null)

  useEffect(() => {
    shownAt.current = Date.now()
  }, [])

  const invalid = [...new Set([...validate(values), ...serverFields])]
  const show = (f: Field) => Boolean(submitted || touched[f]) && invalid.includes(f)
  const err = (f: Field) => (show(f) ? t(ui.form.errors[f]) : undefined)

  const set = (f: Field) => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [f]: e.target.value.slice(0, LIMITS[f]) }))
    setServerFields((s) => s.filter((x) => x !== f))
  }
  const blur = (f: Field) => () => setTouched((tt) => ({ ...tt, [f]: true }))

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setServerError(null)
    if (validate(values).length) return
    setStatus('sending')
    const res = await sendContact({
      ...values,
      lang,
      website: honeypot.current?.value ?? '',
      elapsed: Date.now() - shownAt.current,
    })
    if (res.ok) {
      setStatus('success')
      return
    }
    setStatus('error')
    if (res.error === 'validation') setServerFields((res.fields ?? []).filter((f): f is Field => f in EMPTY))
    else setServerError(res.error)
  }

  const reset = () => {
    setValues(EMPTY)
    setTouched({})
    setSubmitted(false)
    setServerError(null)
    setStatus('idle')
    shownAt.current = Date.now()
  }

  return (
    <div className="panel corners relative overflow-hidden p-5 text-left sm:p-7">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-xl font-semibold tracking-tight">{t(ui.form.title)}</h3>
          <p className="hud mt-1 !text-[9.5px] text-dim">{t(ui.form.channel)}</p>
        </div>
        <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-line text-cyan">
          <Send size={17} strokeWidth={1.6} />
        </span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {status === 'success' ? (
          <motion.div key="ok" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, ease: EASE_OUT }} className="flex flex-col items-center py-10 text-center" role="status">
            <motion.span initial={{ scale: 0.4, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }} className="grid size-16 place-items-center rounded-full border border-ok/50 bg-ok/10 text-ok shadow-[0_0_40px_-8px_rgb(74_222_154/0.6)]">
              <CheckCircle2 size={30} strokeWidth={1.6} />
            </motion.span>
            <h4 className="mt-5 font-display text-2xl font-semibold">{t(ui.form.successTitle)}</h4>
            <p className="mt-2 max-w-sm text-[15px] text-muted">{t(ui.form.successText)}</p>
            <button type="button" onClick={reset} className="mt-7 font-mono text-[11px] tracking-[0.18em] text-cyan uppercase hover:text-fg">
              {t(ui.form.another)}
            </button>
          </motion.div>
        ) : (
          <motion.form key="form" onSubmit={onSubmit} noValidate initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* honeypot: hidden from humans and assistive tech */}
            <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
              <label htmlFor="cf-website">Website</label>
              <input ref={honeypot} id="cf-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Control id="cf-name" label={t(ui.form.name)} error={err('name')}>
                <input id="cf-name" name="name" autoComplete="name" value={values.name} onChange={set('name')} onBlur={blur('name')} placeholder={t(ui.form.namePh)} aria-invalid={show('name')} aria-describedby={show('name') ? 'cf-name-error' : undefined} className={inputCls(show('name'))} />
              </Control>
              <Control id="cf-phone" label={t(ui.form.phone)} error={err('phone')}>
                <input id="cf-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" value={values.phone} onChange={set('phone')} onBlur={blur('phone')} placeholder={t(ui.form.phonePh)} aria-invalid={show('phone')} aria-describedby={show('phone') ? 'cf-phone-error' : undefined} className={inputCls(show('phone'))} />
              </Control>
            </div>
            <Control id="cf-subject" label={t(ui.form.subject)} error={err('subject')}>
              <input id="cf-subject" name="subject" value={values.subject} onChange={set('subject')} onBlur={blur('subject')} placeholder={t(ui.form.subjectPh)} aria-invalid={show('subject')} aria-describedby={show('subject') ? 'cf-subject-error' : undefined} className={inputCls(show('subject'))} />
            </Control>
            <Control id="cf-message" label={t(ui.form.message)} error={err('message')} counter={`${values.message.length}/${LIMITS.message}`}>
              <textarea id="cf-message" name="message" rows={5} value={values.message} onChange={set('message')} onBlur={blur('message')} placeholder={t(ui.form.messagePh)} aria-invalid={show('message')} aria-describedby={show('message') ? 'cf-message-error' : undefined} className={cn(inputCls(show('message')), 'resize-y min-h-[120px]')} />
            </Control>

            <AnimatePresence>
              {serverError && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert" className="flex gap-2.5 rounded-lg border border-[#ff8a8a]/40 bg-[#ff8a8a]/[0.06] px-3.5 py-3 text-[13.5px] text-[#ffb3b3]">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {t(ui.form.errors[serverError])}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex flex-col-reverse items-start gap-4 pt-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[12px] text-dim">{t(ui.form.privacy)}</p>
              <button
                type="submit"
                disabled={status === 'sending'}
                className="group relative inline-flex h-12 w-full items-center justify-center gap-2.5 overflow-hidden rounded-lg bg-gradient-to-b from-[#3b95ff] to-[#1f6fe0] px-6 font-mono text-[11.5px] font-medium tracking-[0.18em] text-white uppercase shadow-[0_0_0_1px_rgb(120_180_255/0.5),0_10px_40px_-10px_rgb(47_140_255/0.8)] transition-shadow hover:shadow-[0_0_0_1px_rgb(150_200_255/0.8),0_12px_50px_-8px_rgb(47_140_255/0.95)] disabled:opacity-70 sm:w-auto"
              >
                {status === 'sending' ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} className="transition-transform group-hover:translate-x-0.5" />}
                {status === 'sending' ? t(ui.form.sending) : t(ui.form.send)}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  )
}
