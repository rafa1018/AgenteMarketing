import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, LogIn, Plus } from 'lucide-react'
import { useState } from 'react'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Button } from '@/components/ui/Button'
import { FadeIn } from '@/components/animations'
import { useT } from '@/i18n'
import { links, ui } from '@/i18n/ui'
import { cn } from '@/lib/utils'

export function Faq() {
  const t = useT()
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section id="faq" className="relative py-20 sm:py-28">
      <div className="container-x grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionHeader index="07" kicker={t(ui.faq.kicker)} title={t(ui.faq.title)} />
        <ul className="space-y-3">
          {ui.faq.items.map((f, i) => {
            const isOpen = open === i
            return (
              <li key={f.q.en} className={cn('panel overflow-hidden transition-colors', isOpen && 'border-line-strong')}>
                <button type="button" onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
                  <span className="font-display text-[16px] font-semibold">{t(f.q)}</span>
                  <Plus size={18} className={cn('shrink-0 text-cyan transition-transform duration-300', isOpen && 'rotate-45')} />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}>
                      <p className="px-5 pb-5 text-[15px] leading-relaxed text-muted">{t(f.a)}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            )
          })}
        </ul>
      </div>

      {/* closing call to action */}
      <FadeIn className="container-x mt-24">
        <div className="relative overflow-hidden rounded-3xl border border-line-strong bg-gradient-to-br from-[#132a52] via-[#0b1d3d] to-[#071226] px-6 py-14 text-center sm:px-12">
          <div aria-hidden className="grid-bg absolute inset-0 opacity-60" />
          <img src="/images/logo-256.webp" alt="" aria-hidden className="pointer-events-none absolute -right-10 -bottom-10 size-64 opacity-[0.07]" />
          <div className="relative">
            <h2 className="font-display text-[clamp(1.9rem,4.6vw,3.4rem)] leading-tight font-semibold tracking-tight">
              <span className="text-silver">{t(ui.cta.title)}</span>
              <br />
              <span className="text-gold">{t(ui.cta.title2)}</span>
            </h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button href={links.signup} icon={ArrowRight} iconRight>
                {t(ui.cta.start)}
              </Button>
              <Button href={links.login} variant="secondary" icon={LogIn}>
                {t(ui.cta.login)}
              </Button>
            </div>
          </div>
        </div>
      </FadeIn>
    </section>
  )
}
