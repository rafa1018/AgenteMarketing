import { Quote } from 'lucide-react'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { RevealItem, ScrollReveal } from '@/components/animations'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'

export function Trust() {
  const t = useT()
  return (
    <section className="relative py-20 sm:py-28">
      <div className="container-x">
        <SectionHeader index="05" kicker={t(ui.trust.kicker)} title={t(ui.trust.title)} align="center" />
        <ScrollReveal className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
          {ui.trust.stats.map((s) => (
            <RevealItem key={s.label.en} className="bg-abyss p-6 text-center sm:p-8">
              <p className="text-gold font-display text-[clamp(2rem,4.5vw,3.2rem)] leading-none font-semibold">{s.value}</p>
              <p className="mt-3 font-mono text-[11px] tracking-[0.14em] text-muted uppercase">{t(s.label)}</p>
            </RevealItem>
          ))}
        </ScrollReveal>

        <ScrollReveal className="mt-10 grid gap-4 md:grid-cols-3" stagger={0.12}>
          {ui.trust.testimonials.map((q) => (
            <RevealItem key={q.name} className="glow-border panel flex flex-col p-6">
              <Quote size={22} className="text-cyan/70" />
              <p className="mt-4 flex-1 text-[15.5px] leading-relaxed text-fg/90">“{t(q.quote)}”</p>
              <div className="mt-6 flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-volt/40 to-steel font-mono text-[12px] font-semibold text-fg">{q.initials}</span>
                <div>
                  <p className="text-[14px] font-semibold">{q.name}</p>
                  <p className="text-[12.5px] text-muted">{t(q.role)}</p>
                </div>
              </div>
            </RevealItem>
          ))}
        </ScrollReveal>
      </div>
    </section>
  )
}
