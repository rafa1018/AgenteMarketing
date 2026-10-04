import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform, type HTMLMotionProps } from 'motion/react'
import { useRef, type PointerEvent, type ReactNode } from 'react'
import { useFinePointer } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'

interface TiltCardProps extends HTMLMotionProps<'div'> {
  max?: number
  glare?: boolean
}

/** Very light 3D tilt with a pointer-following glare. Disabled on touch devices. */
export function TiltCard({ max = 4, glare = true, className, children, style, ...rest }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const fine = useFinePointer()
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const spring = { stiffness: 160, damping: 20 }
  const rotateX = useSpring(useTransform(py, [0, 1], [max, -max]), spring)
  const rotateY = useSpring(useTransform(px, [0, 1], [-max, max]), spring)
  const gx = useTransform(px, (v) => `${v * 100}%`)
  const gy = useTransform(py, (v) => `${v * 100}%`)
  const glareBg = useMotionTemplate`radial-gradient(420px circle at ${gx} ${gy}, rgb(82 211 255 / 0.10), transparent 60%)`

  const onMove = (e: PointerEvent) => {
    if (!fine || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    px.set((e.clientX - r.left) / r.width)
    py.set((e.clientY - r.top) / r.height)
  }
  const reset = () => {
    px.set(0.5)
    py.set(0.5)
  }

  return (
    <motion.div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={reset}
      style={{ ...style, rotateX: fine ? rotateX : 0, rotateY: fine ? rotateY : 0, transformPerspective: 900 }}
      className={cn('relative', className)}
      {...rest}
    >
      {children as ReactNode}
      {glare && fine && (
        <motion.div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit]" style={{ background: glareBg }} />
      )}
    </motion.div>
  )
}
