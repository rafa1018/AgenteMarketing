import { motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { CHARACTERS, characterSrc, type CharacterId } from '@/data/characters'
import { useLang } from '@/i18n'
import { cn } from '@/lib/utils'

/**
 * A Gabush character that blinks and floats.
 * - Two frames (eyes open / closed) are stacked in exactly the same box; only the eyes differ.
 * - Every 3–5 s the closed frame is shown for ~120–180 ms (sometimes twice in a row), with an
 *   instant switch — a fade would look like a different character. No blinking while off screen.
 * - The float (translateY 0 → -8px → 0, 4 s) is pure CSS on a wrapper, independent of the blink.
 * - With prefers-reduced-motion: no blink, no float.
 */
export function BlinkingCharacter({
  id,
  className,
  priority = false,
  decorative = false,
  sizes = '(min-width: 1024px) 440px, 72vw',
}: {
  id: CharacterId
  className?: string
  priority?: boolean
  /** next to a title: empty alt so screen readers skip it */
  decorative?: boolean
  sizes?: string
}) {
  const { lang } = useLang()
  const boxRef = useRef<HTMLDivElement>(null)
  const closedRef = useRef<HTMLImageElement>(null)
  const c = CHARACTERS[id]
  const open = characterSrc(id, 'open')
  const closed = characterSrc(id, 'closed')

  useEffect(() => {
    const el = closedRef.current
    const box = boxRef.current
    if (!el || !box || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let timer = 0
    let visible = true
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting))
    io.observe(box)
    const rand = (a: number, b: number) => a + Math.random() * (b - a)
    const show = (on: boolean) => (el.style.visibility = on ? 'visible' : 'hidden')
    const blink = (then: () => void) => {
      show(true)
      timer = window.setTimeout(() => {
        show(false)
        then()
      }, rand(120, 180))
    }
    const schedule = () => {
      timer = window.setTimeout(
        () => {
          if (document.hidden || !visible) return schedule()
          blink(() => {
            // about one blink in four is a double blink
            if (Math.random() < 0.25) timer = window.setTimeout(() => blink(schedule), rand(110, 170))
            else schedule()
          })
        },
        rand(3000, 5000),
      )
    }
    schedule()
    return () => {
      window.clearTimeout(timer)
      io.disconnect()
      show(false)
    }
  }, [id])

  return (
    <div ref={boxRef} className={cn('relative', className)} style={{ aspectRatio: `${c.width} / ${c.height}` }}>
      <div className="gabush-float absolute inset-0">
        <img
          src={open.src}
          srcSet={open.srcSet}
          sizes={sizes}
          width={c.width}
          height={c.height}
          alt={decorative ? '' : c.name[lang]}
          aria-hidden={decorative || undefined}
          fetchPriority={priority ? 'high' : undefined}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          className="absolute inset-0 size-full select-none"
        />
        <img
          ref={closedRef}
          src={closed.src}
          srcSet={closed.srcSet}
          sizes={sizes}
          width={c.width}
          height={c.height}
          alt=""
          aria-hidden
          loading={priority ? undefined : 'lazy'}
          decoding="async"
          draggable={false}
          className="absolute inset-0 size-full select-none"
          style={{ visibility: 'hidden' }}
        />
      </div>
    </div>
  )
}

/**
 * A small character that pops up beside a section title. The caller places it (`className`) and
 * leaves room for it in the header; it is decorative, so it never takes clicks.
 */
export function SectionMascot({ id, className, sizes = '(min-width: 1024px) 170px, 120px' }: { id: CharacterId; className?: string; sizes?: string }) {
  return (
    <motion.div
      className={cn('pointer-events-none', className)}
      initial={{ opacity: 0, y: 28, scale: 0.85 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ type: 'spring', stiffness: 170, damping: 14 }}
    >
      <BlinkingCharacter id={id} decorative sizes={sizes} />
    </motion.div>
  )
}
