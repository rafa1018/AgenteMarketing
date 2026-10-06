import { SectionHeader } from '@/components/ui/SectionHeader'
import { RevealItem, ScrollReveal } from '@/components/animations'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'
import { cn } from '@/lib/utils'

const TONE = {
  active: 'border-long/40 bg-long/10 text-long',
  beta: 'border-cyan/40 bg-cyan/10 text-cyan',
  dev: 'border-line bg-white/5 text-dim',
} as const

/** Decorative mini price line per instrument (not data). */
function Spark({ seed, up }: { seed: number; up: boolean }) {
  const pts = Array.from({ length: 18 }, (_, i) => {
    const v = Math.sin(i * 0.9 + seed) * 6 + Math.cos(i * 0.4 + seed * 2) * 4 + (up ? i * 0.9 : -i * 0.3)
    return `${i * 8},${30 - v}`
  }).join(' ')
  return (
    <svg viewBox="0 0 136 50" className="h-10 w-full" aria-hidden>
      <polyline points={pts} fill="none" stroke={up ? '#2fd08e' : '#8f9cb3'} strokeWidth={1.6} strokeLinejoin="round" opacity={0.8} />
    </svg>
  )
}

export function Markets() {
  const t = useT()
  return (
    <section id="markets" className="relative py-20 sm:py-28">
      <div className="container-x">
        <SectionHeader index="04" kicker={t(ui.markets.kicker)} title={t(ui.markets.title)} />
        <ScrollReveal className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {ui.markets.items.map((m, i) => (
            <RevealItem key={m.sym} className={cn('glow-border panel p-5', m.status === 'dev' && 'opacity-70')}>
              <p className="font-display text-3xl font-semibold tracking-tight">{m.sym}</p>
              <p className="mt-1 min-h-[2.5em] text-[12.5px] leading-snug text-muted">{t(m.name)}</p>
              <Spark seed={i * 1.7} up={m.status !== 'dev'} />
              <span className={cn('mt-3 inline-block rounded-full border px-2.5 py-0.5 font-mono text-[10px] tracking-[0.1em] uppercase', TONE[m.status])}>{t(ui.markets.status[m.status])}</span>
            </RevealItem>
          ))}
        </ScrollReveal>
      </div>
    </section>
  )
}
