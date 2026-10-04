import { motion, useTransform, type MotionValue } from 'motion/react'
import { useEffect, useState } from 'react'
import { profile } from '@/data/profile'
import { EASE_OUT, cn } from '@/lib/utils'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'

const TAGS = [
  { label: '.NET', x: 10, y: 20 },
  { label: 'ANGULAR', x: 85, y: 13 },
  { label: 'REACT', x: 90, y: 40 },
  { label: 'ORACLE', x: 12, y: 48 },
  { label: 'AZURE', x: 89, y: 67 },
  { label: 'SQL SERVER', x: 13, y: 74 },
  { label: 'DOCKER', x: 80, y: 89 },
  { label: 'DEVOPS', x: 19, y: 94 },
]
// ring anchor (center of the HUD, in the 100x110 viewBox)
const CX = 50
const CY = 46

interface Props {
  ready: boolean
  mx: MotionValue<number>
  my: MotionValue<number>
}

/** Photo integrated into an engineering HUD: rings, ticks, telemetry and tech tags. */
export function HeroPortrait({ ready, mx, my }: Props) {
  const t = useT()
  const [lit, setLit] = useState<number[]>([0, 3, 5])

  useEffect(() => {
    if (!ready) return
    let k = 0
    const id = window.setInterval(() => {
      k++
      setLit([k % 8, (k + 3) % 8, (k + 5) % 8])
    }, 1800)
    return () => clearInterval(id)
  }, [ready])

  // parallax layers (depth)
  const ringX = useTransform(mx, (v) => v * -14)
  const ringY = useTransform(my, (v) => v * -10)
  const photoX = useTransform(mx, (v) => v * 8)
  const photoY = useTransform(my, (v) => v * 6)
  const tagX = useTransform(mx, (v) => v * 20)
  const tagY = useTransform(my, (v) => v * 14)

  return (
    <div className="relative mx-auto aspect-[100/110] w-full max-w-[540px] select-none">
      {/* glow */}
      <div aria-hidden className="absolute top-[8%] left-1/2 h-[78%] w-[86%] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(47_140_255/0.32),rgb(47_140_255/0.06)_60%,transparent)]" />

      {/* rings */}
      <motion.svg aria-hidden viewBox="0 0 100 110" className="absolute inset-0 h-full w-full overflow-visible" style={{ x: ringX, y: ringY }}>
        <defs>
          <linearGradient id="ring-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#52d3ff" stopOpacity="0.9" />
            <stop offset="0.5" stopColor="#2f8cff" stopOpacity="0.2" />
            <stop offset="1" stopColor="#8f83ff" stopOpacity="0.6" />
          </linearGradient>
        </defs>
        <motion.circle cx={CX} cy={CY} r="41" fill="none" stroke="rgb(120 165 230 / 0.16)" strokeWidth="0.25"
          initial={{ pathLength: 0 }} animate={ready ? { pathLength: 1 } : {}} transition={{ duration: 1.8, ease: EASE_OUT }} />
        <g className="animate-spin-slow" style={{ transformOrigin: `${CX}px ${CY}px` }}>
          <circle cx={CX} cy={CY} r="45" fill="none" stroke="url(#ring-g)" strokeWidth="0.35" strokeDasharray="18 6 2 6 40 10" />
        </g>
        <g className="animate-spin-slower" style={{ transformOrigin: `${CX}px ${CY}px` }}>
          <circle cx={CX} cy={CY} r="37" fill="none" stroke="rgb(82 211 255 / 0.35)" strokeWidth="0.2" strokeDasharray="0.4 1.6" />
        </g>
        {/* tick marks */}
        {Array.from({ length: 72 }).map((_, i) => {
          const a = (i / 72) * Math.PI * 2
          const r1 = 48.5
          const r2 = i % 6 === 0 ? 50.5 : 49.4
          return (
            <line key={i} x1={CX + Math.cos(a) * r1} y1={CY + Math.sin(a) * r1} x2={CX + Math.cos(a) * r2} y2={CY + Math.sin(a) * r2}
              stroke={i % 18 === 0 ? '#52d3ff' : 'rgb(120 165 230 / 0.3)'} strokeWidth="0.22" />
          )
        })}
        {/* cross-hair */}
        <path d={`M${CX - 3} 2 H${CX + 3} M${CX} 0 V4`} stroke="#52d3ff" strokeWidth="0.25" />
        <path d={`M${CX - 3} ${CY * 2 - 2} H${CX + 3}`} stroke="rgb(120 165 230 / 0.4)" strokeWidth="0.25" />
      </motion.svg>

      {/* photo */}
      <motion.div className="absolute inset-x-[9%] top-[2%] bottom-0" style={{ x: photoX, y: photoY }}>
        <motion.div
          className="portrait-cutout relative h-full w-full"
          initial={{ opacity: 0, scale: 1.04, filter: 'blur(10px) brightness(0.4)' }}
          animate={ready ? { opacity: 1, scale: 1, filter: 'blur(0px) brightness(1)' } : {}}
          transition={{ duration: 1.6, ease: EASE_OUT, delay: 0.15 }}
        >
          <picture>
            <source type="image/webp" srcSet={profile.photo.srcSet} sizes="(min-width: 1024px) 460px, 80vw" />
            <img
              src={profile.photo.fallback}
              alt={t(profile.photo.alt)}
              width={760}
              height={950}
              fetchPriority="high"
              decoding="async"
              className="h-full w-full object-cover object-top"
            />
          </picture>
        </motion.div>
      </motion.div>

      {/* tags + leader lines */}
      <motion.div className="absolute inset-0" style={{ x: tagX, y: tagY }}>
        <svg aria-hidden viewBox="0 0 100 110" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
          {TAGS.map((t, i) => {
            const a = Math.atan2(t.y - CY, t.x - CX)
            const on = lit.includes(i)
            return (
              <line key={t.label} x1={CX + Math.cos(a) * 45} y1={CY + Math.sin(a) * 45} x2={t.x} y2={t.y}
                stroke={on ? 'rgb(82 211 255 / 0.55)' : 'rgb(120 165 230 / 0.12)'} strokeWidth="0.6" vectorEffect="non-scaling-stroke"
                style={{ transition: 'stroke 0.8s' }} />
            )
          })}
        </svg>
        {TAGS.map((t, i) => {
          const on = lit.includes(i)
          return (
            <motion.span
              key={t.label}
              className={cn(
                'absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-[5px] border bg-ink/80 px-2 py-1 font-mono text-[9.5px] tracking-[0.16em] backdrop-blur-sm transition-[color,border-color,box-shadow] duration-700 sm:text-[10px]',
                on ? 'border-cyan/50 text-fg shadow-[0_0_20px_-4px_rgb(82_211_255/0.55)]' : 'border-line text-dim',
              )}
              style={{ left: `${t.x}%`, top: `${(t.y / 110) * 100}%` }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={ready ? { opacity: on ? 1 : 0.55, scale: 1 } : {}}
              transition={{ duration: 0.8, delay: ready ? 0 : 0.8 + i * 0.07 }}
            >
              <span className={cn('size-1 rounded-full transition-colors duration-700', on ? 'bg-cyan' : 'bg-dim')} />
              {t.label}
            </motion.span>
          )
        })}
      </motion.div>

      {/* telemetry */}
      <motion.div
        className="pointer-events-none absolute -bottom-2 left-1/2 w-[86%] -translate-x-1/2"
        initial={{ opacity: 0, y: 10 }}
        animate={ready ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.9, delay: 1.1, ease: EASE_OUT }}
      >
        <div className="corners panel flex items-center justify-between gap-3 rounded-lg px-3 py-2 backdrop-blur-md">
          <div className="min-w-0">
            <div className="hud !text-[8.5px] text-dim">{t(ui.hero.subject)}</div>
            <div className="font-mono text-[11px] tracking-[0.12em] whitespace-nowrap text-fg">RAFAEL PEDRAZA</div>
          </div>
          <div className="hidden min-w-0 sm:block">
            <div className="hud !text-[8.5px] text-dim">{t(ui.hero.specialty)}</div>
            <div className="font-mono text-[11px] tracking-[0.08em] whitespace-nowrap text-muted">FULL STACK .NET</div>
          </div>
          <div className="text-right">
            <div className="hud !text-[8.5px] text-dim">{t(ui.hero.statusLabel)}</div>
            <div className="flex items-center justify-end gap-1.5 font-mono text-[11px] tracking-[0.12em] text-ok">
              <span className="size-1.5 rounded-full bg-ok animate-blink" /> {t(ui.hero.building)}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
