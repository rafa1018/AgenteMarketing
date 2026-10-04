import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react'
import { useRef } from 'react'
import { profile } from '@/data/profile'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'
import { cn } from '@/lib/utils'

const KEY = new Set<string>(profile.centralKeywords)

function Word({ word, progress, range }: { word: string; progress: MotionValue<number>; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0.1, 1])
  const y = useTransform(progress, range, [10, 0])
  return (
    <motion.span style={{ opacity, y }} className={cn('mr-[0.25em] inline-block', KEY.has(word) && 'text-gradient')}>
      {word}
    </motion.span>
  )
}

/**
 * The central statement. A sticky stage where each word lights up as you
 * scroll — then the secondary concept resolves underneath.
 */
export function Manifesto() {
  const t = useT()
  const ref = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const phrase = t(profile.centralPhrase)
  const words = phrase.split(' ')
  const lineScale = useTransform(scrollYProgress, [0, 0.25], [0, 1])
  const subOpacity = useTransform(scrollYProgress, [0.62, 0.78], [0, 1])
  const subY = useTransform(scrollYProgress, [0.62, 0.78], [24, 0])
  const glow = useTransform(scrollYProgress, [0.3, 0.8], [0.15, 0.6])

  return (
    <section id="manifesto" ref={ref} aria-label="Manifesto" className={cn('relative', reduce ? 'py-32' : 'h-[210vh]')}>
      <div className={cn('flex flex-col items-center justify-center overflow-hidden', !reduce && 'sticky top-0 h-svh')}>
        {/* the hero line continues down into the statement */}
        <motion.span aria-hidden className="absolute top-0 left-1/2 h-[22vh] w-px origin-top bg-gradient-to-b from-cyan/0 via-cyan/70 to-cyan/0" style={{ scaleY: reduce ? 1 : lineScale }} />
        <motion.div aria-hidden className="absolute top-1/2 left-1/2 h-[60vh] w-[80vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(47_140_255/0.25),transparent)]" style={{ opacity: glow }} />

        <div className="container-x relative text-center">
          <p className="hud mb-8 text-cyan">{t(ui.manifesto.kicker)}</p>
          <h2 key={phrase} className="mx-auto max-w-5xl font-display text-[clamp(2.2rem,7vw,5.6rem)] leading-[1.02] font-semibold tracking-[-0.04em]">
            {reduce
              ? phrase
              : words.map((w, i) => {
                  const start = 0.1 + (i / words.length) * 0.48
                  return <Word key={i} word={w} progress={scrollYProgress} range={[start, start + 0.08]} />
                })}
          </h2>
          <motion.p style={reduce ? undefined : { opacity: subOpacity, y: subY }} className="mx-auto mt-10 flex max-w-3xl items-center justify-center gap-4 font-mono text-[12px] tracking-[0.24em] text-muted uppercase sm:text-sm">
            <span className="h-px w-8 shrink-0 bg-line-strong sm:w-14" />
            {t(profile.secondaryPhrase)}
            <span className="h-px w-8 shrink-0 bg-line-strong sm:w-14" />
          </motion.p>
        </div>
      </div>
    </section>
  )
}
