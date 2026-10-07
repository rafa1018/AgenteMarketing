import { AnimatePresence, motion } from 'motion/react'
import { ClipboardList, Plus, Quote } from 'lucide-react'
import { useState } from 'react'
import { faq, testimonials } from '@/data/content'
import { TONE_ORDER, TONES } from '@/data/programs'
import { site, whatsappLink } from '@/data/site'
import { useLang, useT } from '@/i18n'
import { useCalendar } from '@/lib/calendar'
import { summarizeSchedule } from '@/lib/schedule'
import { ui } from '@/i18n/ui'
import { cn, scrollToId } from '@/lib/utils'
import { FadeIn, RevealItem, ScrollReveal } from '@/components/animations'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Rich } from '@/components/ui/Rich'
import { WhatsappIcon } from '@/components/ui/BrandIcons'
import { BlockWord, Confetti, Deco, Wave, useSectionScroll } from '@/components/fx/Fx'

/** Real parent testimonials only — hidden while src/data/content.ts has none. */
export function Testimonials() {
  const t = useT()
  if (!testimonials.length) return null
  return (
    <section className="bg-cream py-20 sm:py-28">
      <div className="container-x">
        <SectionHeader kicker={ui.testimonials.kicker} title={ui.testimonials.title} />
        <ScrollReveal className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((q, i) => (
            <RevealItem key={i} className="card p-7">
              <Quote style={{ color: TONES[TONE_ORDER[i % 6]].solid }} size={30} strokeWidth={2} />
              <p className="mt-3 font-serif text-lg text-ink">{t(q.quote)}</p>
              <p className="mt-4 text-sm font-bold text-muted">— {q.author}</p>
            </RevealItem>
          ))}
        </ScrollReveal>
      </div>
    </section>
  )
}

/** "Inscripciones abiertas" band: indigo night sky with the kids and the lion. */
export function CtaBand() {
  const t = useT()
  const { ref, progress } = useSectionScroll<HTMLElement>()
  return (
    <section ref={ref} aria-label={t(ui.cta.title)} className="relative overflow-clip bg-ink text-white">
      <Wave color="#fff" flip />
      <Confetti className="opacity-70" />
      <Deco src="/images/opt/anim-5.webp" width={70} className="top-16 left-[6%]" anim="float" progress={progress} scroll={-50} />
      <Deco src="/images/opt/anim-10.webp" width={90} className="right-[40%] bottom-14 hidden lg:block" anim="float" progress={progress} scroll={-70} duration={7} />

      <div className="container-x relative grid items-center gap-10 pt-10 pb-0 lg:grid-cols-[1.2fr_1fr] lg:pt-6">
        <FadeIn className="pb-4 lg:pb-16">
          <BlockWord size="text-[clamp(1.6rem,4vw,2.4rem)]" />
          <p className="mt-6 inline-flex rounded-full bg-yellow px-3 py-1 text-[13px] font-extrabold tracking-wide text-ink uppercase">{t(ui.cta.kicker)}</p>
          <h2 className="mt-3 text-[clamp(2.3rem,5.4vw,3.8rem)] !text-white">{t(ui.cta.title)}</h2>
          <p className="mt-4 max-w-xl text-lg text-white/80">{t(ui.cta.sub)}</p>
          <div className="mt-8 flex flex-col gap-3.5 sm:flex-row">
            <button type="button" onClick={() => scrollToId('contacto')} className="btn btn-gold">
              <ClipboardList size={20} strokeWidth={2.2} />
              {t(ui.cta.form)}
            </button>
            <a href={whatsappLink(t(site.whatsappMessage))} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp">
              <WhatsappIcon size={20} />
              {t(ui.cta.whatsapp)}
            </a>
          </div>
        </FadeIn>

        <div className="relative mx-auto flex w-full max-w-[460px] items-end justify-center self-end">
          <motion.img
            src="/images/opt/kids-640.webp"
            alt={t({ es: 'Niño y niña sonrientes con sus cuadernos', en: 'Smiling boy and girl with their notebooks' })}
            width={640}
            height={762}
            loading="lazy"
            className="relative z-10 w-[78%]"
            initial={{ y: 80, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 120, damping: 16 }}
          />
          <motion.img
            src="/images/opt/lion-wave-400.webp"
            alt=""
            width={400}
            loading="lazy"
            className="absolute bottom-0 -left-2 z-20 w-[34%]"
            initial={{ x: -60, opacity: 0, rotate: -20 }}
            whileInView={{ x: 0, opacity: 1, rotate: 0 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 160, damping: 12, delay: 0.3 }}
          />
          <div aria-hidden className="absolute bottom-0 left-1/2 aspect-square w-[92%] -translate-x-1/2 translate-y-1/3 rounded-full bg-[radial-gradient(circle,#f8c21c_0%,#f26b1d_60%,transparent_61%)] opacity-90" />
        </div>
      </div>
    </section>
  )
}

export function Faq() {
  const t = useT()
  const { lang } = useLang()
  const hours = summarizeSchedule(useCalendar((s) => s.schedule), lang)
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section id="preguntas" className="py-20 sm:py-28">
      <div className="container-x grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
        <div>
          <SectionHeader kicker={ui.faq.kicker} title={ui.faq.title} />
          <img src="/images/opt/anim-6.webp" alt="" aria-hidden loading="lazy" width={160} className="mt-10 hidden w-40 animate-float lg:block" />
        </div>
        <ScrollReveal className="space-y-3" stagger={0.06}>
          {faq.map((f, i) => {
            const isOpen = open === i
            const tone = TONES[TONE_ORDER[i % TONE_ORDER.length]]
            return (
              <RevealItem key={i} className="overflow-hidden rounded-3xl border-2 bg-white transition-colors" style={{ borderColor: isOpen ? tone.solid : 'var(--color-line)' }}>
                <h3 className="!font-sans">
                  <button
                    type="button"
                    id={`faq-q-${i}`}
                    aria-expanded={isOpen}
                    aria-controls={`faq-a-${i}`}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex min-h-16 w-full items-center justify-between gap-4 px-5 py-4 text-left font-serif text-[1.2rem] font-semibold text-ink"
                  >
                    {t(f.q)}
                    <motion.span
                      animate={{ rotate: isOpen ? 45 : 0 }}
                      className={cn('grid size-9 shrink-0 place-items-center rounded-full', !isOpen && 'bg-paper')}
                      style={isOpen ? { background: tone.solid, color: tone.solid === '#f8c21c' ? '#23206b' : '#fff' } : { color: tone.solid }}
                    >
                      <Plus size={20} strokeWidth={2.6} />
                    </motion.span>
                  </button>
                </h3>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`faq-a-${i}`}
                      role="region"
                      aria-labelledby={`faq-q-${i}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <p className="px-5 pr-14 pb-5 text-[17px] leading-relaxed text-text/85">
                        {f.hours && hours.length ? `${hours.join('. ')}. ${t({ es: 'Los días festivos no hay atención.', en: 'Closed on public holidays.' })}` : <Rich text={f.a} />}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </RevealItem>
            )
          })}
        </ScrollReveal>
      </div>
    </section>
  )
}
