import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { architecturePrinciples, diagrams } from '@/data/architecture'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { ArchitectureDiagram, RevealItem, ScrollReveal } from '@/components/animations'
import { Lifecycle } from './Lifecycle'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'
import { cn, pad } from '@/lib/utils'

export function Architecture() {
  const t = useT()
  const [tab, setTab] = useState(diagrams[0].id)
  const current = diagrams.find((d) => d.id === tab)!

  return (
    <section id="architecture" className="relative py-20 sm:py-28">
      <div className="container-x">
        <SectionHeader index="06" kicker={t(ui.lifecycle.kicker)} title={t(ui.lifecycle.title)} description={t(ui.lifecycle.description)} />

        <Lifecycle />

        {/* architecture: zoom into the "Design" stage */}
        <div className="mt-20 mb-8 flex items-center gap-3 sm:mt-24">
          <span className="h-px w-10 bg-line-strong" />
          <h3 className="hud text-muted">{t(ui.architecture.kicker)} · {t(ui.architecture.title)}</h3>
        </div>

        <div className="panel corners overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-4 py-3 sm:px-6">
            <div role="tablist" aria-label={t(ui.architecture.kicker)} className="flex gap-1">
              {diagrams.map((d) => (
                <button
                  key={d.id}
                  role="tab"
                  aria-selected={tab === d.id}
                  onClick={() => setTab(d.id)}
                  className={cn('relative rounded-md px-3 py-2 font-mono text-[10.5px] tracking-[0.14em] uppercase transition-colors sm:px-3.5 sm:text-[11px]', tab === d.id ? 'text-fg' : 'text-muted hover:text-fg')}
                >
                  {tab === d.id && <motion.span layoutId="arch-tab" className="absolute inset-0 rounded-md border border-line-strong bg-navy/70" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
                  <span className="relative">{t(d.title)}</span>
                </button>
              ))}
            </div>
            <span className="hud hidden !text-[9.5px] text-dim sm:block">{t(ui.architecture.hint)}</span>
          </div>

          <div className="px-4 py-8 sm:px-8 lg:px-12">
            <AnimatePresence mode="wait">
              <motion.div key={current.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }}>
                <p className="mb-8 max-w-2xl text-[14.5px] text-muted">{t(current.caption)}</p>
                <ArchitectureDiagram diagram={current} className="mx-auto max-w-4xl" />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <ScrollReveal className="mt-10 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {architecturePrinciples.map((p, i) => (
            <RevealItem key={p.title.en} className="group bg-abyss p-5 transition-colors duration-300 hover:bg-navy/60">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[10px] text-cyan">{pad(i + 1)}</span>
                <h3 className="font-display text-[16px] font-semibold tracking-tight">{t(p.title)}</h3>
              </div>
              <p className="mt-1.5 pl-7 text-[13.5px] leading-relaxed text-muted">{t(p.text)}</p>
            </RevealItem>
          ))}
        </ScrollReveal>
      </div>
    </section>
  )
}
