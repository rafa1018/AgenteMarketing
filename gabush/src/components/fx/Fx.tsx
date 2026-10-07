import { motion, useMotionValue, useScroll, useSpring, useTransform, type MotionValue } from 'motion/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { useFinePointer, useReducedMotionPref } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'

/* Playful decorations: floating objects (anim-icons), drifting clouds, GABUSH letter blocks, waves. */

export const LETTERS = [
  { c: 'G', bg: '#e5197e' },
  { c: 'A', bg: '#f8c21c' },
  { c: 'B', bg: '#23206b' },
  { c: 'U', bg: '#f8c21c' },
  { c: 'S', bg: '#5cb531' },
  { c: 'H', bg: '#f26b1d' },
]

/** Mouse position in the window, -0.5…0.5 (stays 0 on touch screens / reduced motion). */
export function usePointer() {
  const fine = useFinePointer()
  const reduce = useReducedMotionPref()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  useEffect(() => {
    if (!fine || reduce) return
    const on = (e: PointerEvent) => {
      x.set(e.clientX / window.innerWidth - 0.5)
      y.set(e.clientY / window.innerHeight - 0.5)
    }
    window.addEventListener('pointermove', on, { passive: true })
    return () => window.removeEventListener('pointermove', on)
  }, [fine, reduce, x, y])
  return { x: useSpring(x, { stiffness: 60, damping: 18 }), y: useSpring(y, { stiffness: 60, damping: 18 }) }
}

type Anim = 'float' | 'sway' | 'wiggle' | 'spin' | 'none'
const ANIM: Record<Anim, string> = {
  float: 'animate-float',
  sway: 'animate-sway',
  wiggle: 'animate-wiggle',
  spin: 'animate-spin-slow',
  none: '',
}

/**
 * A decorative object (one of the anim-icon images) that pops in, keeps an idle animation,
 * follows the mouse with `depth` and drifts `scroll` px while its section crosses the screen.
 */
export function Deco({
  src,
  className,
  width,
  depth = 20,
  anim = 'float',
  delay = 0,
  duration,
  pointer,
  progress,
  scroll = 0,
}: {
  src: string
  className?: string
  width: number
  depth?: number
  anim?: Anim
  delay?: number
  duration?: number
  pointer?: { x: MotionValue<number>; y: MotionValue<number> }
  progress?: MotionValue<number>
  scroll?: number
}) {
  const reduce = useReducedMotionPref()
  const zero = useMotionValue(0)
  const px = useTransform(pointer?.x ?? zero, (v) => v * depth * 2)
  const py = useTransform(pointer?.y ?? zero, (v) => v * depth * 2)
  const sy = useTransform(progress ?? zero, [0, 1], [0, scroll])
  const y = useTransform(() => py.get() + sy.get())
  return (
    <motion.div aria-hidden className={cn('pointer-events-none absolute select-none', className)} style={reduce ? undefined : { x: px, y }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.3, rotate: -15 }}
        whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ type: 'spring', stiffness: 170, damping: 11, delay }}
      >
        <div className={ANIM[anim]} style={{ animationDelay: `${-delay * 2}s`, animationDuration: duration ? `${duration}s` : undefined }}>
          <img src={src} alt="" width={width} loading="lazy" decoding="async" draggable={false} className="block h-auto max-w-none drop-shadow-[0_10px_14px_rgb(35_32_107/0.16)]" style={{ width }} />
        </div>
      </motion.div>
    </motion.div>
  )
}

/** Scroll progress of a section (0 when its top reaches the bottom of the screen, 1 when it leaves). */
export function useSectionScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  return { ref, progress: scrollYProgress }
}

/** A fluffy white cloud (SVG) that drifts across the section. */
export function Cloud({ className, size = 160, duration = 70, delay = 0, opacity = 1 }: { className?: string; size?: number; duration?: number; delay?: number; opacity?: number }) {
  return (
    <div aria-hidden className={cn('pointer-events-none absolute left-0', className)} style={{ opacity }}>
      <div className="animate-drift" style={{ animationDuration: `${duration}s`, animationDelay: `${-delay}s` }}>
        <svg width={size} height={size * 0.5} viewBox="0 0 200 100" fill="#fff">
          <ellipse cx="62" cy="68" rx="52" ry="28" />
          <ellipse cx="138" cy="66" rx="52" ry="30" />
          <circle cx="92" cy="44" r="34" />
          <circle cx="128" cy="48" r="26" />
        </svg>
      </div>
    </div>
  )
}

/** Wavy edge for the top or bottom of a coloured section. */
export function Wave({ color = '#fff', flip = false, className }: { color?: string; flip?: boolean; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 1440 80" preserveAspectRatio="none" className={cn('pointer-events-none block h-[40px] w-full sm:h-[64px]', flip && 'rotate-180', className)}>
      <path fill={color} d="M0 40c120-30 240-30 360 0s240 30 360 0 240-30 360 0 240 30 360 0v40H0z" />
    </svg>
  )
}

/** "GABUSH" letter blocks that pop in one by one (bouncy). */
export function BlockWord({ className, size = 'text-5xl', delay = 0, play = true }: { className?: string; size?: string; delay?: number; play?: boolean }) {
  return (
    <span aria-hidden className={cn('inline-flex gap-[0.08em]', size, className)}>
      {LETTERS.map((l, i) => (
        <motion.span
          key={i}
          className="block-letter"
          style={{ background: l.bg, rotate: [-4, 3, -2, 4, -3, 2][i] }}
          initial={{ y: '-120%', opacity: 0, rotate: -30 }}
          animate={play ? { y: 0, opacity: 1, rotate: [-4, 3, -2, 4, -3, 2][i] } : undefined}
          transition={{ type: 'spring', stiffness: 420, damping: 14, delay: delay + i * 0.08 }}
          whileHover={{ y: -8, rotate: 0, transition: { type: 'spring', stiffness: 500, damping: 10 } }}
        >
          {l.c}
        </motion.span>
      ))}
    </span>
  )
}

/** Small rainbow of confetti dots for backgrounds. */
export function Confetti({ className, children }: { className?: string; children?: ReactNode }) {
  const dots = [
    ['8%', '18%', '#e5197e', 10], ['22%', '72%', '#f8c21c', 14], ['46%', '12%', '#1fa3dd', 9], ['64%', '80%', '#5cb531', 12],
    ['82%', '26%', '#f26b1d', 10], ['92%', '64%', '#23206b', 8], ['34%', '44%', '#f8c21c', 7], ['74%', '50%', '#e5197e', 7],
  ] as const
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0', className)}>
      {dots.map(([l, t, c, s], i) => (
        <span key={i} className="absolute animate-float rounded-full" style={{ left: l, top: t, width: s, height: s, background: c, animationDelay: `${-i * 0.7}s`, animationDuration: `${5 + (i % 3)}s` }} />
      ))}
      {children}
    </div>
  )
}
