import { motion, useMotionValue, useSpring } from 'motion/react'
import { useRef, type ReactNode, type PointerEvent } from 'react'
import { useFinePointer } from '@/hooks/useMediaQuery'

interface MagneticProps {
  children: ReactNode
  strength?: number
  className?: string
}

/** Very subtle magnetic pull toward the pointer (desktop only). */
export function MagneticButton({ children, strength = 0.18, className }: MagneticProps) {
  const ref = useRef<HTMLDivElement>(null)
  const fine = useFinePointer()
  const x = useSpring(useMotionValue(0), { stiffness: 220, damping: 18, mass: 0.4 })
  const y = useSpring(useMotionValue(0), { stiffness: 220, damping: 18, mass: 0.4 })

  const onMove = (e: PointerEvent) => {
    if (!fine || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    x.set((e.clientX - (r.left + r.width / 2)) * strength)
    y.set((e.clientY - (r.top + r.height / 2)) * strength)
  }
  const reset = () => {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.div ref={ref} className={className ?? 'inline-flex'} style={{ x, y }} onPointerMove={onMove} onPointerLeave={reset}>
      {children}
    </motion.div>
  )
}
