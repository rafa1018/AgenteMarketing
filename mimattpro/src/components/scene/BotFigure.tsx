import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'

/** scene moods + login moods (wave = greeting, shy = covers its eyes, peek = peeks through its hands) */
export type BotMood = 'scan' | 'alert' | 'long' | 'short' | 'win' | 'loss' | 'wave' | 'shy' | 'peek'

const GOLD = 'var(--brand-1)'
const GOLD_DEEP = 'var(--brand-3)'
const GREEN = '#2fd08e'
const RED = '#ff5b6e'
const CYAN = '#7fe3ff'

/**
 * MiMatt Bot — an SVG robot in the brand colors (silver body, navy visor, gold trim, logo on the chest).
 * It reacts to the trading scene: scans the chart, points at the candles when a signal appears,
 * watches the open trade, celebrates a winner and lowers its head on a stop. On the login page it waves,
 * follows what you type (lookX) and covers its eyes while you type the password.
 */
export function BotFigure({ mood, size = 150, lookX }: { mood: BotMood; size?: number; lookX?: number }) {
  const reduce = useReducedMotion()
  const [blink, setBlink] = useState(false)
  const [look, setLook] = useState(0) // eye x offset while scanning

  // natural blinking + scanning eye movement
  useEffect(() => {
    if (reduce) return
    const b = window.setInterval(() => {
      setBlink(true)
      window.setTimeout(() => setBlink(false), 140)
    }, 3200)
    const l = window.setInterval(() => setLook((v) => (v === 0 ? 3 : v === 3 ? -3 : 0)), 1300)
    return () => {
      window.clearInterval(b)
      window.clearInterval(l)
    }
  }, [reduce])

  const eyeColor = mood === 'alert' ? GOLD : mood === 'long' || mood === 'win' ? GREEN : mood === 'short' || mood === 'loss' ? RED : CYAN
  const eyeX = lookX !== undefined && (mood === 'scan' || mood === 'peek') ? lookX : mood === 'scan' ? look : mood === 'alert' || mood === 'long' || mood === 'short' ? 3.5 : 0 // looks toward the chart (right/up)
  const eyeY = mood === 'loss' ? 3 : mood === 'alert' || mood === 'long' || mood === 'short' ? -1.5 : 0

  // arm poses (degrees, around the shoulder)
  const covering = mood === 'shy' || mood === 'peek'
  const right = mood === 'alert' ? -128 : mood === 'win' ? -150 : covering ? -75 : mood === 'long' || mood === 'short' ? -40 : mood === 'loss' ? 8 : 12
  const left = mood === 'win' ? 150 : covering ? 75 : mood === 'loss' ? -8 : -12
  const headTilt = mood === 'loss' ? 9 : mood === 'win' ? -4 : mood === 'alert' ? -6 : 0
  const headDrop = mood === 'loss' ? 4 : 0
  const spring = { type: 'spring' as const, stiffness: 160, damping: 14 }

  return (
    <motion.svg
      viewBox="0 0 170 210"
      width={size}
      height={(size * 210) / 170}
      aria-hidden
      animate={reduce ? {} : mood === 'win' ? { y: [0, -14, 0] } : { y: [0, -6, 0] }}
      transition={reduce ? {} : mood === 'win' ? { duration: 0.55, repeat: Infinity, ease: 'easeOut' } : { duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id="bot-metal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#dfe5ee" />
          <stop offset="100%" stopColor="#9aa6b8" />
        </linearGradient>
        <linearGradient id="bot-metal-dark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c9d2df" />
          <stop offset="100%" stopColor="#7d899c" />
        </linearGradient>
        <linearGradient id="bot-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--brand-hi)" />
          <stop offset="50%" stopColor={GOLD} />
          <stop offset="100%" stopColor={GOLD_DEEP} />
        </linearGradient>
        <linearGradient id="bot-visor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#13284f" />
          <stop offset="100%" stopColor="#050d1d" />
        </linearGradient>
        <radialGradient id="bot-thruster" cx="50%" cy="0%" r="100%">
          <stop offset="0%" stopColor={GOLD} stopOpacity="0.9" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </radialGradient>
        <filter id="bot-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* hover thruster + floor shadow */}
      <ellipse cx="85" cy="203" rx="30" ry="4" fill="black" opacity="0.45" />
      <motion.path d="M70 176 L100 176 L92 200 L78 200 Z" fill="url(#bot-thruster)" animate={reduce ? {} : { opacity: [0.55, 1, 0.55], scaleY: [0.9, 1.1, 0.9] }} transition={{ duration: 0.5, repeat: Infinity }} style={{ transformOrigin: '85px 176px' }} />

      {/* left arm (viewer's left) */}
      <motion.g animate={{ rotate: left }} transition={spring} style={{ transformOrigin: '42px 124px' }}>
        <rect x="18" y="118" width="26" height="12" rx="6" fill="url(#bot-metal-dark)" />
        <circle cx="16" cy="124" r="8" fill="url(#bot-metal)" stroke={GOLD_DEEP} strokeWidth="1.5" />
      </motion.g>

      {/* body */}
      <rect x="40" y="106" width="90" height="72" rx="26" fill="url(#bot-metal)" stroke="#8e9bb0" strokeWidth="1" />
      <path d="M58 116 h54 a8 8 0 0 1 8 8 v22 a35 35 0 0 1 -35 32 a35 35 0 0 1 -35 -32 v-22 a8 8 0 0 1 8 -8 z" fill="url(#bot-visor)" stroke="url(#bot-gold)" strokeWidth="2" />
      <image href="/images/logo-128.webp" x="66" y="122" width="38" height="38" />
      {/* chest status light */}
      <motion.circle cx="85" cy="168" r="3" fill={eyeColor} filter="url(#bot-glow)" animate={reduce ? {} : { opacity: [0.4, 1, 0.4] }} transition={{ duration: mood === 'alert' ? 0.4 : 1.4, repeat: Infinity }} />

      {/* right arm (viewer's right) — points at the chart on a signal */}
      <motion.g animate={{ rotate: mood === 'wave' && !reduce ? [-150, -112, -150] : mood === 'wave' ? -140 : right }} transition={mood === 'wave' && !reduce ? { duration: 0.9, repeat: Infinity, ease: 'easeInOut' } : spring} style={{ transformOrigin: '128px 124px' }}>
        <rect x="126" y="118" width="28" height="12" rx="6" fill="url(#bot-metal-dark)" />
        <circle cx="156" cy="124" r="8" fill="url(#bot-metal)" stroke={GOLD_DEEP} strokeWidth="1.5" />
        {/* pointing finger */}
        <AnimatePresence>
          {mood === 'alert' && <motion.rect initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} exit={{ scaleX: 0 }} x="160" y="121" width="12" height="6" rx="3" fill={GOLD} style={{ transformOrigin: '160px 124px' }} />}
        </AnimatePresence>
      </motion.g>

      {/* neck */}
      <rect x="74" y="96" width="22" height="14" rx="5" fill="url(#bot-metal-dark)" />

      {/* head */}
      <motion.g animate={{ rotate: headTilt, y: headDrop }} transition={spring} style={{ transformOrigin: '85px 98px' }}>
        {/* antenna */}
        <line x1="85" y1="20" x2="85" y2="34" stroke="#8e9bb0" strokeWidth="3" strokeLinecap="round" />
        <motion.circle
          cx="85"
          cy="16"
          r="6"
          fill={mood === 'alert' ? GOLD : eyeColor}
          filter="url(#bot-glow)"
          animate={reduce ? {} : mood === 'alert' ? { scale: [1, 1.5, 1], opacity: [1, 0.6, 1] } : { opacity: [0.6, 1, 0.6] }}
          transition={{ duration: mood === 'alert' ? 0.35 : 1.6, repeat: Infinity }}
          style={{ transformOrigin: '85px 16px' }}
        />
        {mood === 'alert' && !reduce && <motion.circle cx="85" cy="16" r="6" fill="none" stroke={GOLD} strokeWidth="1.5" animate={{ scale: [1, 3.2], opacity: [0.9, 0] }} transition={{ duration: 0.9, repeat: Infinity }} style={{ transformOrigin: '85px 16px' }} />}

        {/* ear pods */}
        <circle cx="34" cy="66" r="10" fill="url(#bot-metal-dark)" stroke="url(#bot-gold)" strokeWidth="2.5" />
        <circle cx="136" cy="66" r="10" fill="url(#bot-metal-dark)" stroke="url(#bot-gold)" strokeWidth="2.5" />

        {/* skull + visor */}
        <rect x="36" y="32" width="98" height="68" rx="30" fill="url(#bot-metal)" stroke="#8e9bb0" strokeWidth="1" />
        <rect x="46" y="44" width="78" height="44" rx="20" fill="url(#bot-visor)" stroke="url(#bot-gold)" strokeWidth="1.6" />
        <path d="M54 50 q14 -5 30 -3" stroke="white" strokeOpacity="0.25" strokeWidth="2.5" strokeLinecap="round" fill="none" />

        {/* eyes */}
        <motion.g animate={{ x: eyeX, y: eyeY }} transition={{ type: 'spring', stiffness: 120, damping: 12 }} filter="url(#bot-glow)">
          {mood === 'win' ? (
            <>
              <path d="M60 68 q8 -9 16 0" stroke={eyeColor} strokeWidth="4" strokeLinecap="round" fill="none" />
              <path d="M94 68 q8 -9 16 0" stroke={eyeColor} strokeWidth="4" strokeLinecap="round" fill="none" />
            </>
          ) : mood === 'loss' ? (
            <>
              <line x1="60" y1="68" x2="76" y2="68" stroke={eyeColor} strokeWidth="4" strokeLinecap="round" />
              <line x1="94" y1="68" x2="110" y2="68" stroke={eyeColor} strokeWidth="4" strokeLinecap="round" />
            </>
          ) : (
            <>
              <motion.rect x="61" y="58" width="14" height="20" rx="7" fill={eyeColor} animate={{ scaleY: blink ? 0.1 : mood === 'alert' ? 1.15 : 1 }} transition={{ duration: 0.08 }} style={{ transformOrigin: '68px 68px' }} />
              <motion.rect x="95" y="58" width="14" height="20" rx="7" fill={eyeColor} animate={{ scaleY: blink ? 0.1 : mood === 'alert' ? 1.15 : 1 }} transition={{ duration: 0.08 }} style={{ transformOrigin: '102px 68px' }} />
            </>
          )}
        </motion.g>
        {/* hands over the visor: covering (shy) or lowered a bit to peek */}
        <motion.g initial={false} animate={covering ? { y: mood === 'peek' ? 13 : 0, opacity: 1 } : { y: 60, opacity: 0 }} transition={spring}>
          {[66, 104].map((cx) => (
            <g key={cx}>
              <circle cx={cx} cy={68} r={14} fill="url(#bot-metal)" stroke={GOLD_DEEP} strokeWidth="1.8" />
              <path d={`M${cx - 7} 61 v8 M${cx} 58 v10 M${cx + 7} 61 v8`} stroke="#8e9bb0" strokeWidth="2" strokeLinecap="round" />
            </g>
          ))}
        </motion.g>
        {/* mouth LED */}
        <motion.rect
          x="74"
          y="80"
          height="3"
          rx="1.5"
          fill={eyeColor}
          opacity={0.8}
          animate={{ width: mood === 'win' ? 22 : mood === 'loss' ? 10 : mood === 'alert' ? 18 : 14, x: mood === 'win' ? 74 : mood === 'loss' ? 80 : mood === 'alert' ? 76 : 78 }}
          transition={spring}
        />
      </motion.g>

      {/* celebration sparkles */}
      <AnimatePresence>
        {mood === 'win' &&
          !reduce &&
          [
            [18, 30],
            [150, 22],
            [160, 80],
            [8, 86],
          ].map(([x, y], i) => (
            <motion.path
              key={i}
              d={`M${x} ${y - 6} L${x + 2} ${y - 2} L${x + 6} ${y} L${x + 2} ${y + 2} L${x} ${y + 6} L${x - 2} ${y + 2} L${x - 6} ${y} L${x - 2} ${y - 2} Z`}
              fill={GOLD}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.2, 0.9], opacity: [0, 1, 0.8], rotate: [0, 45] }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.6, delay: i * 0.08, repeat: Infinity, repeatType: 'reverse' }}
              style={{ transformOrigin: `${x}px ${y}px` }}
            />
          ))}
      </AnimatePresence>
    </motion.svg>
  )
}
