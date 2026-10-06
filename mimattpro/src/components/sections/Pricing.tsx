import { Check, Crown } from 'lucide-react'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Button } from '@/components/ui/Button'
import { FadeIn, TiltCard } from '@/components/animations'
import { useT } from '@/i18n'
import { links, ui } from '@/i18n/ui'

export function Pricing() {
  const t = useT()
  return (
    <section id="pricing" className="relative py-20 sm:py-28">
      <div className="container-x">
        <SectionHeader index="06" kicker={t(ui.pricing.kicker)} title={t(ui.pricing.title)} description={t(ui.pricing.text)} align="center" />
        <FadeIn className="mx-auto max-w-md">
          <TiltCard max={3} className="relative overflow-hidden rounded-3xl border border-line-strong bg-gradient-to-b from-[#132a52]/80 to-[#071226]/90 p-8 shadow-[0_40px_100px_-30px_rgb(var(--brand-rgb)/0.35)]">
            <div aria-hidden className="absolute -top-24 -right-24 size-64 rounded-full bg-[radial-gradient(closest-side,rgb(var(--brand-1-rgb)/0.22),transparent)]" />
            <div className="relative">
              <span className="chip !border-line-strong !text-cyan">
                <Crown size={12} /> {t(ui.pricing.plan)}
              </span>
              <p className="mt-4 text-[15px] text-muted">{t(ui.pricing.planText)}</p>
              <p className="mt-6 flex items-baseline gap-1">
                <span className="text-gold font-display text-6xl font-semibold tracking-tight">{ui.pricing.price}</span>
                <span className="text-lg text-muted">USD{t(ui.pricing.per)}</span>
              </p>
              <ul className="mt-7 space-y-3">
                {ui.pricing.includes.map((i) => (
                  <li key={i.en} className="flex items-center gap-3 text-[15px]">
                    <span className="grid size-6 place-items-center rounded-full bg-volt/20 text-cyan">
                      <Check size={14} />
                    </span>
                    {t(i)}
                  </li>
                ))}
              </ul>
              <Button href={links.monthly} className="mt-8 w-full">
                {t(ui.pricing.cta)}
              </Button>
              <p className="mt-4 text-center text-[12.5px] text-dim">{t(ui.pricing.cancel)}</p>
            </div>
          </TiltCard>
        </FadeIn>
      </div>
    </section>
  )
}
