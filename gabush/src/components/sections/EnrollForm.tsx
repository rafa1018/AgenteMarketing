import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, CheckCircle2, ClipboardList, Loader2, Send } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { coMobileDigits } from '@/lib/phone'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { tr, useContent } from '@/lib/content'
import { site, whatsappLink } from '@/data/site'
import { useLang, useT } from '@/i18n'
import { ui } from '@/i18n/ui'
import { sendContact } from '@/lib/api'
import { EASE_OUT, cn } from '@/lib/utils'
import { WhatsappIcon } from '@/components/ui/BrandIcons'

type Field = 'child' | 'age' | 'birth' | 'address' | 'gender' | 'parent' | 'phone' | 'email' | 'program' | 'message'
type Validated = keyof typeof ui.form.errors
type Status = 'idle' | 'sending' | 'success' | 'error'

const LIMITS: Record<Field, number> = { child: 100, age: 2, birth: 10, address: 160, gender: 30, parent: 100, phone: 25, email: 120, program: 80, message: 1500 }
const EMPTY: Record<Field, string> = { child: '', age: '', birth: '', address: '', gender: '', parent: '', phone: '', email: '', program: '', message: '' }

function validate(v: Record<Field, string>): Validated[] {
  const bad: Validated[] = []
  if (v.child.trim().length < 3) bad.push('child')
  const age = Number(v.age)
  if (v.age === '' || !Number.isInteger(age) || age < 0 || age > 8) bad.push('age')
  if (v.birth) {
    const d = new Date(v.birth)
    if (Number.isNaN(d.getTime()) || d > new Date() || d.getFullYear() < new Date().getFullYear() - 9) bad.push('birth')
  }
  if (v.address.trim().length < 5) bad.push('address')
  if (v.parent.trim().length < 3) bad.push('parent')
  if (!coMobileDigits(v.phone)) bad.push('phone')
  if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email.trim())) bad.push('email')
  return bad
}

function Control({ id, label, required, optional, error, children, className }: { id: string; label: string; required?: boolean; optional?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[15px] font-semibold text-ink">
        {label}
        {required && <span className="text-berry"> *</span>}
        {optional && <span className="font-sans text-sm font-normal text-muted"> ({optional})</span>}
      </label>
      {children}
      <AnimatePresence>
        {error && (
          <motion.p id={`${id}-error`} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-1.5 text-sm font-medium text-berry">
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

const inputCls = (invalid: boolean) =>
  cn(
    'block w-full min-w-0 min-h-[50px] rounded-lg border bg-white px-4 py-3 text-[17px] text-text placeholder:text-muted/70 outline-none transition-[border-color,box-shadow] duration-200',
    'focus:border-royal focus:shadow-[0_0_0_4px_rgb(58_54_168/0.12)]',
    invalid ? 'border-berry' : 'border-[#d6d8ec]',
  )

/**
 * Formulario de inscripción → /api/contact.php → Telegram.
 * Anti-spam: honeypot oculto + tiempo mínimo de llenado + límite por IP en el servidor.
 */
export function EnrollForm() {
  const t = useT()
  const { lang } = useLang()
  const programs = useContent('programs')
  const [values, setValues] = useState(EMPTY)
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [serverError, setServerError] = useState<'rate_limited' | 'generic' | null>(null)
  const [serverFields, setServerFields] = useState<Validated[]>([])
  const shownAt = useRef(Date.now())
  const honeypot = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    shownAt.current = Date.now()
  }, [])

  const invalid = [...new Set([...validate(values), ...serverFields])]
  const show = (f: Field) => Boolean(submitted || touched[f]) && (invalid as string[]).includes(f)
  const err = (f: Validated) => (show(f) ? t(ui.form.errors[f]) : undefined)
  const a11y = (f: Field) => ({ 'aria-invalid': show(f) || undefined, 'aria-describedby': show(f) ? `f-${f}-error` : undefined })

  const set = (f: Field) => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [f]: e.target.value.slice(0, LIMITS[f]) }))
    setServerFields((s) => s.filter((x) => x !== f))
  }
  const blur = (f: Field) => () => setTouched((tt) => ({ ...tt, [f]: true }))

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setServerError(null)
    const bad = validate(values)
    if (bad.length) {
      formRef.current?.querySelector<HTMLElement>(`#f-${bad[0]}`)?.focus()
      return
    }
    setStatus('sending')
    const res = await sendContact({ ...values, lang, website: honeypot.current?.value ?? '', elapsed: Date.now() - shownAt.current })
    if (res.ok) {
      setStatus('success')
      return
    }
    setStatus('error')
    if (res.error === 'validation') setServerFields((res.fields ?? []).filter((f): f is Validated => f in ui.form.errors))
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
    <div className="card relative overflow-hidden p-5 sm:p-8">
      <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-ink" />
      <AnimatePresence mode="wait" initial={false}>
        {status === 'success' ? (
          <motion.div key="ok" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, ease: EASE_OUT }} className="py-12 text-center" role="status">
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }} className="mx-auto grid size-20 place-items-center rounded-full bg-[#e9f4ee] text-leaf">
              <CheckCircle2 size={44} strokeWidth={2.2} />
            </motion.span>
            <h3 className="mt-5 text-3xl">{t(ui.form.successTitle)}</h3>
            <p className="mx-auto mt-2 max-w-sm text-lg text-muted">{t(ui.form.successText)}</p>
            <button type="button" onClick={reset} className="btn btn-ghost mt-6">
              {t(ui.form.again)}
            </button>
          </motion.div>
        ) : (
          <motion.form key="form" ref={formRef} onSubmit={onSubmit} noValidate initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-labelledby="enroll-title">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-ink text-gold">
                <ClipboardList size={22} strokeWidth={1.8} />
              </span>
              <div>
                <h3 id="enroll-title" className="text-[1.75rem]">
                  {t(ui.form.title)}
                </h3>
                <p className="text-sm text-muted">{t(ui.form.required)}</p>
              </div>
            </div>
            <p className="mt-4 text-[16px] text-text/85">{t(ui.form.intro)}</p>
            <p className="mt-2 text-[15px] text-muted">{t(ui.form.note)}</p>

            {/* honeypot — hidden from people, irresistible to bots */}
            <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label>
                Website
                <input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>

            <fieldset className="mt-7 min-w-0">
              <legend className="mb-4 w-full border-b border-line pb-2 font-serif text-lg font-semibold text-ink">{t(ui.form.section1)}</legend>
              <div className="grid gap-4 sm:grid-cols-6 [&>*]:min-w-0">
                <Control id="f-child" label={t(ui.form.child)} required error={err('child')} className="sm:col-span-6">
                  <input id="f-child" className={inputCls(show('child'))} value={values.child} onChange={set('child')} onBlur={blur('child')} autoComplete="off" required {...a11y('child')} />
                </Control>
                <Control id="f-age" label={t(ui.form.age)} required error={err('age')} className="sm:col-span-2">
                  <input id="f-age" type="number" inputMode="numeric" min={0} max={18} className={inputCls(show('age'))} value={values.age} onChange={set('age')} onBlur={blur('age')} required {...a11y('age')} />
                </Control>
                <Control id="f-birth" label={t(ui.form.birth)} error={err('birth')} className="sm:col-span-4">
                  <input id="f-birth" type="date" className={inputCls(show('birth'))} value={values.birth} onChange={set('birth')} onBlur={blur('birth')} max={new Date().toISOString().slice(0, 10)} {...a11y('birth')} />
                </Control>
                <Control id="f-address" label={t(ui.form.address)} required error={err('address')} className="sm:col-span-4">
                  <input id="f-address" className={inputCls(show('address'))} value={values.address} onChange={set('address')} onBlur={blur('address')} autoComplete="street-address" required {...a11y('address')} />
                </Control>
                <Control id="f-gender" label={t(ui.form.gender)} className="sm:col-span-2">
                  <select id="f-gender" className={inputCls(false)} value={values.gender} onChange={set('gender')}>
                    <option value="">{t(ui.form.select)}</option>
                    {ui.form.genders.map((g) => (
                      <option key={g.value} value={g.value}>
                        {t(g.label)}
                      </option>
                    ))}
                  </select>
                </Control>
              </div>
            </fieldset>

            <fieldset className="mt-7 min-w-0">
              <legend className="mb-4 w-full border-b border-line pb-2 font-serif text-lg font-semibold text-ink">{t(ui.form.section2)}</legend>
              <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
                <Control id="f-parent" label={t(ui.form.parent)} required error={err('parent')} className="sm:col-span-2">
                  <input id="f-parent" className={inputCls(show('parent'))} value={values.parent} onChange={set('parent')} onBlur={blur('parent')} autoComplete="name" required {...a11y('parent')} />
                </Control>
                <Control id="f-phone" label={t(ui.form.phone)} required error={err('phone')}>
                  <PhoneInput id="f-phone" className="!min-h-[50px]" value={values.phone} onChange={(v) => setValues((x) => ({ ...x, phone: v }))} onBlur={blur('phone')} invalid={show('phone')} required {...a11y('phone')} />
                </Control>
                <Control id="f-email" label={t(ui.form.email)} optional={t(ui.form.optional)} error={err('email')}>
                  <input id="f-email" type="email" inputMode="email" className={inputCls(show('email'))} value={values.email} onChange={set('email')} onBlur={blur('email')} autoComplete="email" {...a11y('email')} />
                </Control>
                <Control id="f-program" label={t(ui.form.program)} className="sm:col-span-2">
                  <select id="f-program" className={inputCls(false)} value={values.program} onChange={set('program')}>
                    <option value="">{t(ui.form.programAny)}</option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.title.es}>
                        {tr(p.title, lang)}
                      </option>
                    ))}
                  </select>
                </Control>
                <Control id="f-message" label={t(ui.form.message)} optional={t(ui.form.optional)} className="sm:col-span-2">
                  <textarea id="f-message" rows={4} className={cn(inputCls(false), 'resize-y')} value={values.message} onChange={set('message')} placeholder={t(ui.form.messagePh)} />
                </Control>
              </div>
            </fieldset>

            <AnimatePresence>
              {serverError && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert" className="mt-5 flex items-start gap-3 rounded-lg border border-berry/30 bg-[#fdf0ef] p-4 text-berry">
                  <AlertTriangle size={22} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">{t(serverError === 'rate_limited' ? ui.form.rateLimited : ui.form.generic)}</p>
                    <a href={whatsappLink(t(site.whatsappMessage))} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 font-semibold text-ink underline">
                      <WhatsappIcon size={18} /> {t(ui.contact.cta)}
                    </a>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted">{t(ui.form.privacy)}</p>
              <button type="submit" disabled={status === 'sending'} className="btn btn-primary w-full disabled:opacity-70 sm:w-auto">
                {status === 'sending' ? <Loader2 size={20} className="animate-spin" /> : <Send size={19} strokeWidth={2.3} />}
                {t(status === 'sending' ? ui.form.sending : ui.form.send)}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  )
}
