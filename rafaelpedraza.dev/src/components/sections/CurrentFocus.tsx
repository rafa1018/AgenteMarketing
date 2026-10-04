import { motion } from 'motion/react'
import { focusStatus } from '@/data/journey'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { FadeIn } from '@/components/animations'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'
import { EASE_OUT } from '@/lib/utils'

export function CurrentFocus() {
  const t = useT()
  return (
    <section id="focus" className="relative py-20 sm:py-28">
      <div className="container-x">
        <SectionHeader index="09" kicker={t(ui.focus.kicker)} title={t(ui.focus.title)} />
        <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
          <FadeIn>
            <div className="panel corners overflow-hidden font-mono">
              <div className="flex items-center justify-between border-b border-line px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-steel" />
                  <span className="size-2.5 rounded-full bg-steel" />
                  <span className="size-2.5 rounded-full bg-cyan/70" />
                </div>
                <span className="text-[10.5px] tracking-[0.2em] text-dim">system_status.log</span>
              </div>
              <div className="p-5 sm:p-7">
                <div className="text-[11px] tracking-[0.22em] text-cyan">{t(ui.focus.status)}</div>
                <ul className="mt-5 space-y-3.5">
                  {focusStatus.map((s, i) => (
                    <motion.li
                      key={s.label.en}
                      className="flex items-baseline text-[12px] tracking-[0.12em] sm:text-[13px]"
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.15 + i * 0.12, duration: 0.5, ease: EASE_OUT }}
                    >
                      <span className="text-fg/90 uppercase">{t(s.label)}</span>
                      <span className="dotted-leader" />
                      <span className={s.status === 'ONLINE' ? 'flex items-center gap-2 text-ok' : 'flex items-center gap-2 text-cyan'}>
                        <span className={`size-1.5 rounded-full ${s.status === 'ONLINE' ? 'bg-ok' : 'bg-cyan animate-blink'}`} />
                        {s.status}
                      </span>
                    </motion.li>
                  ))}
                </ul>
                <motion.div className="mt-7 flex items-center gap-2 text-[12px] text-muted" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 1 }}>
                  <span className="text-cyan">›</span> {t(ui.focus.prompt)}
                  <span className="inline-block h-3.5 w-2 bg-cyan animate-blink" />
                </motion.div>
              </div>
            </div>
            <p className="hud mt-3 !text-[9px] text-dim">{t(ui.focus.disclaimer)}</p>
          </FadeIn>

          <FadeIn delay={0.15}>
            <p className="font-display text-[clamp(1.4rem,2.6vw,2rem)] leading-snug font-medium tracking-[-0.02em]">{t(ui.focus.text)}</p>
          </FadeIn>
        </div>
      </div>
    </section>
  )
}
