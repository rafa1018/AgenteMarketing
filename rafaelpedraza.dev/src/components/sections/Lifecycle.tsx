import { motion, useMotionValueEvent, useScroll, useSpring } from 'motion/react'
import { useRef, useState } from 'react'
import { lifecycle } from '@/data/journey'
import { useT } from '@/i18n'
import { EASE_OUT, cn, pad } from '@/lib/utils'

/**
 * Full software lifecycle: Analysis → … → Support. A line draws across the
 * stages as you scroll and each stage lights up when the line reaches it.
 * Horizontal on desktop, vertical on mobile.
 */
export function Lifecycle() {
  const t = useT()
  const ref = useRef<HTMLOListElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.8', 'end 0.55'] })
  const fill = useSpring(scrollYProgress, { stiffness: 110, damping: 28 })
  const [active, setActive] = useState(-1)
  useMotionValueEvent(scrollYProgress, 'change', (v) => setActive(Math.floor(v * lifecycle.length * 0.999)))

  return (
    <ol ref={ref} className="relative grid gap-4 pl-8 lg:grid-cols-6 lg:gap-3 lg:pt-10 lg:pl-0">
      {/* progress line: vertical (mobile) / horizontal (desktop) */}
      <span aria-hidden className="absolute top-0 bottom-0 left-[11px] w-px bg-line lg:top-[15px] lg:right-[8%] lg:bottom-auto lg:left-[8%] lg:h-px lg:w-auto" />
      <motion.span aria-hidden className="absolute top-0 bottom-0 left-[11px] w-px origin-top bg-gradient-to-b from-cyan to-volt lg:hidden" style={{ scaleY: fill }} />
      <motion.span aria-hidden className="absolute top-[15px] right-[8%] left-[8%] hidden h-px origin-left bg-gradient-to-r from-cyan via-volt to-violet lg:block" style={{ scaleX: fill }} />

      {lifecycle.map((s, i) => {
        const on = i <= active
        const Icon = s.icon
        return (
          <motion.li
            key={s.id}
            className="relative"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.7, delay: i * 0.06, ease: EASE_OUT }}
          >
            {/* node */}
            <span
              aria-hidden
              className={cn(
                'absolute top-5 -left-[26px] size-3 rotate-45 border transition-all duration-500 lg:top-[-31px] lg:left-1/2 lg:-translate-x-1/2',
                on ? 'scale-110 border-cyan bg-cyan shadow-[0_0_14px_rgb(82_211_255)]' : 'border-line-strong bg-ink',
              )}
            />
            <div className={cn('panel h-full p-4 transition-[border-color,box-shadow] duration-500 lg:p-5', on && 'border-cyan/30 shadow-[0_20px_50px_-30px_rgb(47_140_255/0.7)]')}>
              <div className="flex items-center justify-between">
                <span className={cn('grid size-10 place-items-center rounded-lg border transition-colors duration-500', on ? 'border-cyan/50 text-cyan' : 'border-line text-dim')}>
                  <Icon size={19} strokeWidth={1.5} />
                </span>
                <span className="font-mono text-[10px] text-dim">{pad(i + 1)}</span>
              </div>
              <h3 className="mt-4 font-display text-[17px] font-semibold tracking-tight">{t(s.title)}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{t(s.text)}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {s.proof.map((pr) => (
                  <span key={pr.en} className={cn('chip !rounded-md !px-2 !py-0.5 !text-[10px] !whitespace-normal transition-colors duration-500', on && 'border-cyan/30 text-fg')}>
                    {t(pr)}
                  </span>
                ))}
              </div>
            </div>
          </motion.li>
        )
      })}
    </ol>
  )
}
