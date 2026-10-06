import { motion } from 'motion/react'
import { BarChart3, BellRing, UserPlus } from 'lucide-react'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { RevealItem, ScrollReveal } from '@/components/animations'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'
import { EASE_OUT } from '@/lib/utils'

const ICONS = [UserPlus, BellRing, BarChart3]

export function HowItWorks() {
  const t = useT()
  return (
    <section id="how" className="relative py-20 sm:py-28">
      <div className="container-x">
        <SectionHeader index="03" kicker={t(ui.how.kicker)} title={t(ui.how.title)} align="center" />
        <div className="relative">
          {/* connecting line that draws itself */}
          <motion.span
            aria-hidden
            className="absolute top-[42px] right-[16%] left-[16%] hidden h-px origin-left bg-gradient-to-r from-volt via-cyan to-violet md:block"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 1.4, ease: EASE_OUT }}
          />
          <ScrollReveal stagger={0.18} className="grid gap-6 md:grid-cols-3">
            {ui.how.steps.map((s, i) => {
              const Icon = ICONS[i]
              return (
                <RevealItem key={s.title.en} className="relative text-center">
                  <span className="relative mx-auto grid size-[84px] place-items-center rounded-full border border-line-strong bg-abyss shadow-[0_0_40px_-10px_rgb(var(--brand-rgb)/0.5)]">
                    <Icon size={28} strokeWidth={1.5} className="text-cyan" />
                    <span className="absolute -top-1 -right-1 grid size-7 place-items-center rounded-full bg-gradient-to-b from-[var(--brand-btn)] to-[var(--brand-3)] font-mono text-[11px] font-bold text-[var(--on-brand)]">{i + 1}</span>
                  </span>
                  <p className="hud mt-6 !text-[10px] text-dim">{t(ui.how.step)} 0{i + 1}</p>
                  <h3 className="mt-2 font-display text-xl font-semibold">{t(s.title)}</h3>
                  <p className="mx-auto mt-2 max-w-xs text-[14.5px] leading-relaxed text-muted">{t(s.text)}</p>
                </RevealItem>
              )
            })}
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
