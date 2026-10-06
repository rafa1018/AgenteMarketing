import { motion } from 'motion/react'
import { CheckCircle2 } from 'lucide-react'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { FadeIn, RevealItem, ScrollReveal } from '@/components/animations'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'
import { EASE_OUT } from '@/lib/utils'

export function About() {
  const t = useT()
  return (
    <section id="about" className="relative py-20 sm:py-28">
      <div className="container-x grid gap-14 lg:grid-cols-2 lg:gap-20">
        <div>
          <SectionHeader index="02" kicker={t(ui.about.kicker)} title={t(ui.about.title)} />
          <FadeIn className="space-y-4 text-[16px] leading-relaxed text-muted">
            <p>{t(ui.about.text1)}</p>
            <p>{t(ui.about.text2)}</p>
          </FadeIn>
          {/* the wolf: gold half / silver half, like the brand */}
          <FadeIn delay={0.2} className="mt-10 flex items-center gap-5">
            <motion.img
              src="/images/logo-256.webp"
              alt="MiMatt PRO"
              className="size-24 drop-shadow-[0_10px_30px_rgb(var(--brand-rgb)/0.35)]"
              initial={{ rotate: -8, scale: 0.9 }}
              whileInView={{ rotate: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: EASE_OUT }}
            />
            <p className="font-display text-xl leading-snug font-semibold">
              <span className="text-silver">{t(ui.about.quote).split('.')[0]}.</span>
              <br />
              <span className="text-gold">{t(ui.about.quote).split('.').slice(1).join('.').trim()}</span>
            </p>
          </FadeIn>
        </div>

        <div className="lg:pt-24">
          <p className="hud text-cyan">{t(ui.about.whatKicker)}</p>
          <FadeIn>
            <h3 className="mt-4 font-display text-[clamp(1.6rem,3.4vw,2.4rem)] leading-tight font-semibold tracking-tight">{t(ui.about.whatTitle)}</h3>
          </FadeIn>
          <ScrollReveal className="mt-8 space-y-3">
            {ui.about.what.map((w) => (
              <RevealItem key={w.title.en} className="glow-border panel flex gap-4 p-5">
                <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-cyan" />
                <div>
                  <h4 className="font-display text-[16px] font-semibold">{t(w.title)}</h4>
                  <p className="mt-1 text-[14.5px] leading-relaxed text-muted">{t(w.text)}</p>
                </div>
              </RevealItem>
            ))}
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
