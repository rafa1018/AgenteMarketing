import { AnimatePresence, motion, useScroll, useSpring } from 'motion/react'
import { Briefcase, ChevronDown, MapPin } from 'lucide-react'
import { useRef, useState } from 'react'
import { experience, type Experience as Exp } from '@/data/experience'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { FadeIn } from '@/components/animations'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'
import { EASE_OUT, cn } from '@/lib/utils'

const INITIAL = 4

const companies = [...new Set(experience.map((e) => e.company.replace(/ \(.+\)$/, '')))]
const firstYear = Math.min(...experience.map((e) => Number(e.start.slice(0, 4))))
const lastYear = Math.max(...experience.map((e) => Number(e.start.slice(0, 4))))

function Entry({ e, i }: { e: Exp; i: number }) {
  const t = useT()
  return (
    <motion.li
      layout="position"
      className="relative pl-10 sm:pl-14"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, ease: EASE_OUT, delay: (i % INITIAL) * 0.03 }}
    >
      <span
        aria-hidden
        className={cn(
          'absolute top-7 left-[3px] size-3 rotate-45 border bg-ink sm:left-[19px]',
          e.highlight ? 'border-cyan shadow-[0_0_14px_rgb(82_211_255/0.8)]' : 'border-volt/70',
        )}
      />
      <article className="glow-border panel group p-5 transition-colors duration-300 hover:border-line-strong sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-semibold tracking-tight sm:text-xl">{t(e.role)}</h3>
            <p className="mt-1 text-[14px] text-fg/75">{e.company}</p>
          </div>
          <div className="text-left sm:text-right">
            <div className="font-mono text-[11.5px] tracking-[0.1em] text-cyan">{t(e.period)}</div>
            <div className="mt-1 flex items-center gap-1 font-mono text-[10.5px] text-dim sm:justify-end">
              <MapPin size={11} /> {e.location}
            </div>
          </div>
        </div>
        <ul className="mt-4 space-y-2">
          {e.responsibilities.map((r) => (
            <li key={r.en} className="flex gap-3 text-[14px] leading-relaxed text-muted">
              <span className="mt-[9px] h-px w-3 shrink-0 bg-volt" />
              {t(r)}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {e.technologies.map((tech) => (
            <span key={tech} className="chip !px-2 !py-0.5 !text-[10.5px] transition-colors group-hover:border-line-strong">{tech}</span>
          ))}
        </div>
      </article>
    </motion.li>
  )
}

export function Experience() {
  const t = useT()
  const [expanded, setExpanded] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: listRef, offset: ['start 0.75', 'end 0.6'] })
  const line = useSpring(scrollYProgress, { stiffness: 120, damping: 30 })
  const items = expanded ? experience : experience.slice(0, INITIAL)

  return (
    <section id="experience" className="relative py-20 sm:py-28">
      <div className="container-x">
        <SectionHeader index="03" kicker={t(ui.experience.kicker)} title={t(ui.experience.title)} />

        <div className="grid gap-10 lg:grid-cols-[300px_1fr] lg:gap-14">
          <FadeIn direction="right" className="lg:sticky lg:top-28 lg:self-start">
            <div className="panel corners p-6">
              <div className="hud !text-[9.5px] text-cyan">{t(ui.experience.log)}</div>
              <dl className="mt-5 grid grid-cols-2 gap-5 lg:grid-cols-1">
                <div>
                  <dt className="hud !text-[9px] text-dim">{t(ui.experience.span)}</dt>
                  <dd className="mt-1 font-display text-2xl font-semibold">{firstYear} — {lastYear}</dd>
                </div>
                <div>
                  <dt className="hud !text-[9px] text-dim">{t(ui.experience.roles)}</dt>
                  <dd className="mt-1 font-display text-2xl font-semibold">{experience.length}</dd>
                </div>
              </dl>
              <div className="mt-6">
                <div className="hud !text-[9px] text-dim">{t(ui.experience.orgs)}</div>
                <ul className="mt-3 space-y-2">
                  {companies.map((c) => (
                    <li key={c} className="flex items-center gap-2.5 text-[13px] text-fg/80">
                      <Briefcase size={12} className="shrink-0 text-volt" /> {c}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </FadeIn>

          <div ref={listRef} className="relative">
            <span aria-hidden className="absolute top-0 bottom-0 left-[8px] w-px bg-line sm:left-[24px]" />
            <motion.span aria-hidden className="absolute top-0 bottom-0 left-[8px] w-px origin-top bg-gradient-to-b from-cyan via-volt to-violet/40 sm:left-[24px]" style={{ scaleY: line }} />
            <motion.ol layout className="space-y-5">
              <AnimatePresence initial={false}>
                {items.map((e, i) => (
                  <Entry key={`${e.company}-${e.start}`} e={e} i={i} />
                ))}
              </AnimatePresence>
            </motion.ol>
            {experience.length > INITIAL && (
              <motion.div layout className="mt-8 pl-10 sm:pl-14">
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="group inline-flex items-center gap-2 rounded-md border border-line-strong px-4 py-2.5 font-mono text-[11px] tracking-[0.18em] text-fg uppercase transition-colors hover:border-cyan/60"
                  aria-expanded={expanded}
                >
                  {expanded ? t(ui.experience.less) : `${t(ui.experience.more)} · +${experience.length - INITIAL}`}
                  <ChevronDown size={14} className={cn('transition-transform duration-300', expanded && 'rotate-180')} />
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
