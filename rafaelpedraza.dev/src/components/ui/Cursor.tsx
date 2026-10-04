import { motion, useMotionValue, useSpring } from 'motion/react'
import { useEffect, useState } from 'react'
import { useFinePointer, useReducedMotionPref } from '@/hooks/useMediaQuery'

/**
 * Subtle tech cursor: a precise dot + a lagging halo that grows over interactive
 * elements. Desktop fine-pointer only; disabled for touch and reduced motion.
 */
export function Cursor() {
  const fine = useFinePointer()
  const reduce = useReducedMotionPref()
  const enabled = fine && !reduce
  const x = useMotionValue(-100)
  const y = useMotionValue(-100)
  const hx = useSpring(x, { stiffness: 380, damping: 32, mass: 0.5 })
  const hy = useSpring(y, { stiffness: 380, damping: 32, mass: 0.5 })
  const [mode, setMode] = useState<'idle' | 'hover' | 'text'>('idle')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!enabled) return
    document.documentElement.classList.add('has-cursor')
    const move = (e: PointerEvent) => {
      x.set(e.clientX)
      y.set(e.clientY)
      if (!visible) setVisible(true)
    }
    const over = (e: PointerEvent) => {
      const t = e.target as HTMLElement
      const interactive = t.closest('a, button, [data-cursor="hover"], [role="button"], summary')
      setMode(interactive ? 'hover' : 'idle')
    }
    const leave = () => setVisible(false)
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerover', over, { passive: true })
    document.addEventListener('pointerleave', leave)
    return () => {
      document.documentElement.classList.remove('has-cursor')
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerover', over)
      document.removeEventListener('pointerleave', leave)
    }
  }, [enabled, visible, x, y])

  if (!enabled) return null
  const hover = mode === 'hover'
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[100]" style={{ opacity: visible ? 1 : 0 }}>
      <motion.div className="absolute top-0 left-0" style={{ x: hx, y: hy }}>
        <motion.div
          className="-translate-x-1/2 -translate-y-1/2 rounded-full border"
          animate={{
            width: hover ? 46 : 28,
            height: hover ? 46 : 28,
            borderColor: hover ? 'rgba(82,211,255,0.75)' : 'rgba(120,165,230,0.35)',
            backgroundColor: hover ? 'rgba(82,211,255,0.06)' : 'rgba(82,211,255,0)',
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          style={{ boxShadow: hover ? '0 0 24px rgba(82,211,255,0.25)' : 'none' }}
        />
      </motion.div>
      <motion.div className="absolute top-0 left-0" style={{ x, y }}>
        <div className="size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan shadow-[0_0_10px_rgb(82_211_255)]" />
      </motion.div>
    </div>
  )
}
