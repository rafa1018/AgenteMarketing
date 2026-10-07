import { motion, useScroll, useSpring, useTransform, type HTMLMotionProps } from 'motion/react'
import { useRef, type ImgHTMLAttributes, type ReactNode } from 'react'
import { useReducedMotionPref } from '@/hooks/useMediaQuery'
import { EASE_OUT, cn } from '@/lib/utils'

/* Scroll-linked motion. Everything renders static when the visitor prefers reduced motion. */

/** Thin gold reading-progress bar pinned to the top of the window. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 })
  return <motion.div aria-hidden className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-gold" style={{ scaleX }} />
}

/** Moves its children vertically while the element crosses the viewport (positive speed = slower than the page). */
export function Parallax({ speed = 60, className, children }: { speed?: number; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotionPref()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], [speed, -speed])
  return (
    <motion.div ref={ref} className={className} style={reduce ? undefined : { y }}>
      {children}
    </motion.div>
  )
}

/**
 * An image inside a clipped frame: the frame wipes open when it enters the viewport and
 * the picture drifts / settles inside it while scrolling.
 */
export function ParallaxImage({ frameClassName, className, alt, ...img }: ImgHTMLAttributes<HTMLImageElement> & { frameClassName?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotionPref()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], ['-7%', '7%'])
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [1.22, 1.12, 1.16])
  // The in-view trigger sits on the unclipped frame: a fully clipped element never counts as visible.
  return (
    <motion.div ref={ref} className={cn('relative overflow-hidden', frameClassName)} initial={reduce ? false : 'hidden'} whileInView="show" viewport={{ once: true, amount: 0.25 }}>
      <motion.div
        className="absolute inset-0"
        variants={{ hidden: { clipPath: 'inset(100% 0% 0% 0%)' }, show: { clipPath: 'inset(0% 0% 0% 0%)', transition: { duration: 1.1, ease: EASE_OUT } } }}
      >
        <motion.img alt={alt} className={cn('size-full object-cover', className)} style={reduce ? undefined : { y, scale }} {...(img as HTMLMotionProps<'img'>)} />
      </motion.div>
    </motion.div>
  )
}

/** A line of large outlined words that slides sideways as the page scrolls. */
export function ScrollMarquee({ words, direction = 1, className }: { words: string[]; direction?: 1 | -1; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotionPref()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const x = useTransform(scrollYProgress, [0, 1], direction === 1 ? ['0%', '-30%'] : ['-30%', '0%'])
  const line = [...words, ...words, ...words]
  return (
    <div ref={ref} aria-hidden className={cn('overflow-hidden select-none', className)}>
      <motion.p className="flex w-max items-center gap-8 font-serif text-[clamp(2.6rem,7vw,5.5rem)] leading-none font-semibold whitespace-nowrap" style={reduce ? undefined : { x }}>
        {line.map((w, i) => (
          <span key={i} className="flex items-center gap-8">
            {w}
            <span className="inline-block size-2.5 rotate-45 bg-gold" />
          </span>
        ))}
      </motion.p>
    </div>
  )
}

/** Hero exit: the content drifts and softens while the visitor scrolls past it. */
export function useHeroScroll() {
  const ref = useRef<HTMLElement>(null)
  const reduce = useReducedMotionPref()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const copyY = useTransform(scrollYProgress, [0, 1], [0, 120])
  const copyO = useTransform(scrollYProgress, [0, 0.8], [1, 0.15])
  const photoY = useTransform(scrollYProgress, [0, 1], [0, -70])
  const photoScale = useTransform(scrollYProgress, [0, 1], [1, 0.94])
  return {
    ref,
    copy: reduce ? undefined : { y: copyY, opacity: copyO },
    photo: reduce ? undefined : { y: photoY, scale: photoScale },
  }
}
