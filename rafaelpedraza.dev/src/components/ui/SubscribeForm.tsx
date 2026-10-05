import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, CheckCircle2, Info, Loader2, Mail } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { subscribe, type SubscribeResult } from '@/lib/api'
import { useLang, useT } from '@/i18n'
import { ui } from '@/i18n/ui'
import { cn } from '@/lib/utils'

/** Footer newsletter form: the email goes to the admin panel (Suscriptores). */
export function SubscribeForm({ className }: { className?: string }) {
  const t = useT()
  const { lang } = useLang()
  const shownAt = useRef(Date.now())
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<SubscribeResult | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    const r = await subscribe({ email: email.trim(), lang, website, elapsed: Date.now() - shownAt.current })
    setBusy(false)
    setResult(r)
    if (r === 'subscribed' || r === 'already') setEmail('')
  }

  const good = result === 'subscribed' || result === 'already'

  // confirmation messages fade out after 5 s (errors stay until the visitor edits the email)
  useEffect(() => {
    if (!good) return
    const id = window.setTimeout(() => setResult(null), 5000)
    return () => window.clearTimeout(id)
  }, [result, good])

  return (
    <div className={cn('w-full max-w-md', className)}>
      <p className="flex items-center gap-2 font-display text-[15px] font-semibold text-fg">
        <Mail size={15} className="text-cyan" /> {t(ui.subscribe.title)}
      </p>
      <p className="mt-1 text-[13px] text-muted">{t(ui.subscribe.text)}</p>
      <form onSubmit={submit} className="mt-3 flex gap-2" noValidate={false}>
        <label className="sr-only" htmlFor="sub-email">
          {t(ui.subscribe.label)}
        </label>
        <input
          id="sub-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          maxLength={160}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (result && !good) setResult(null)
          }}
          placeholder={t(ui.subscribe.placeholder)}
          aria-invalid={result === 'invalid'}
          aria-describedby="sub-status"
          className={cn(
            'h-10 min-w-0 flex-1 rounded-md border bg-ink/60 px-3.5 text-[14px] text-fg placeholder:text-dim focus:border-cyan/60 focus:outline-none',
            result === 'invalid' ? 'border-danger/60' : 'border-line-strong',
          )}
        />
        {/* honeypot: hidden from people, bots fill it */}
        <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" aria-hidden />
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md bg-volt px-4 font-mono text-[11px] tracking-[0.14em] text-white uppercase transition-[filter] hover:brightness-110 disabled:opacity-70"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
          <span className="hidden sm:inline">{t(ui.subscribe.button)}</span>
        </button>
      </form>
      <div id="sub-status" aria-live="polite" className="min-h-5">
        <AnimatePresence mode="wait">
          {result ? (
            <motion.p
              key={result}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={cn('mt-2 flex items-start gap-1.5 text-[12.5px]', good ? (result === 'already' ? 'text-cyan' : 'text-ok') : 'text-danger')}
            >
              {good ? result === 'already' ? <Info size={14} className="mt-px shrink-0" /> : <CheckCircle2 size={14} className="mt-px shrink-0" /> : null}
              {t(ui.subscribe[result])}
            </motion.p>
          ) : (
            <motion.p key="note" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 font-mono text-[10.5px] tracking-[0.08em] text-dim">
              {t(ui.subscribe.note)}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
