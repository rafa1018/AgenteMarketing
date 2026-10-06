import { Activity, BellRing, Landmark, Target, type LucideIcon } from 'lucide-react'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { RevealItem, ScrollReveal, TiltCard } from '@/components/animations'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'

const ICONS: Record<string, LucideIcon> = { target: Target, flow: Activity, context: Landmark, alert: BellRing }

/** Instruments tape that scrolls across the top of the platform section. */
function Tape() {
  const t = useT()
  const row = ui.markets.items.map((m) => (
    <span key={m.sym} className="flex shrink-0 items-center gap-3 px-6">
      <span className="font-display text-[15px] font-semibold text-fg">{m.sym}</span>
      <span className="text-[12.5px] text-muted">{t(m.name)}</span>
      <span className={m.status === 'active' ? 'text-long' : m.status === 'beta' ? 'text-cyan' : 'text-dim'}>●</span>
    </span>
  ))
  return (
    <div className="relative overflow-hidden border-y border-line bg-abyss/50 py-3 [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
      <div className="flex w-max animate-marquee">
        {row}
        {row}
        {row}
        {row}
      </div>
    </div>
  )
}

export function Platform() {
  const t = useT()
  return (
    <section id="platform" className="relative pt-4 pb-20 sm:pb-28">
      <Tape />
      <div className="container-x mt-20">
        <SectionHeader index="01" kicker={t(ui.features.kicker)} title={t(ui.features.title)} />
        <ScrollReveal className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ui.features.items.map((f, i) => {
            const Icon = ICONS[f.icon]
            return (
              <RevealItem key={f.icon}>
                <TiltCard className="glow-border panel group h-full p-6">
                  <span className="hud !text-[9.5px] text-dim">0{i + 1}</span>
                  <span className="mt-4 grid size-12 place-items-center rounded-xl border border-line-strong bg-gradient-to-br from-volt/20 to-transparent text-cyan transition-transform duration-500 group-hover:scale-110">
                    <Icon size={22} strokeWidth={1.6} />
                  </span>
                  <h3 className="mt-5 font-display text-lg font-semibold">{t(f.title)}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{t(f.text)}</p>
                </TiltCard>
              </RevealItem>
            )
          })}
        </ScrollReveal>
      </div>
    </section>
  )
}
