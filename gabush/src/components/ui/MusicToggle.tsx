import { AnimatePresence, motion } from 'motion/react'
import { Volume1, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'
import { cn } from '@/lib/utils'

const SRC = '/audio/background.mp3'
const PREF_KEY = 'gb-music' // 'on' | 'off'
const DEFAULT_VOLUME = 0.5

const read = (k: string) => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* ignore */
  }
}

/**
 * Background music, on by default.
 * Browsers block audible autoplay until the visitor interacts with the page,
 * so we try immediately and otherwise start on the first click / tap / key.
 * A visitor who pauses it is remembered. Hidden if the audio file is missing.
 */
export function MusicToggle({ visible }: { visible: boolean }) {
  const t = useT()
  const audio = useRef<HTMLAudioElement | null>(null)
  const fade = useRef<number | undefined>(undefined)
  const [available, setAvailable] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [blocked, setBlocked] = useState(false) // waiting for a user gesture
  // Every visit starts at the default volume (50 %); the slider only affects the current visit.
  const [volume, setVolume] = useState(DEFAULT_VOLUME)
  const [open, setOpen] = useState(false)
  const volumeRef = useRef(volume)
  volumeRef.current = volume

  useEffect(() => {
    fetch(SRC, { method: 'HEAD' })
      .then((r) => setAvailable(r.ok && (r.headers.get('content-type') ?? '').startsWith('audio')))
      .catch(() => setAvailable(false))
  }, [])

  const getAudio = () => {
    if (!audio.current) {
      const el = new Audio(SRC)
      el.loop = true
      el.preload = 'auto'
      el.volume = 0
      audio.current = el
    }
    return audio.current
  }

  const rampTo = (el: HTMLAudioElement, to: number, done?: () => void) => {
    window.clearInterval(fade.current)
    fade.current = window.setInterval(() => {
      const step = to > el.volume ? 0.04 : -0.06
      const next = el.volume + step
      if ((step > 0 && next >= to) || (step < 0 && next <= to)) {
        el.volume = Math.max(0, Math.min(1, to))
        window.clearInterval(fade.current)
        done?.()
      } else el.volume = Math.max(0, Math.min(1, next))
    }, 40)
  }

  const play = async (): Promise<boolean> => {
    const el = getAudio()
    try {
      await el.play()
      setPlaying(true)
      setBlocked(false)
      rampTo(el, volumeRef.current)
      return true
    } catch {
      return false
    }
  }

  const pause = () => {
    const el = audio.current
    setPlaying(false)
    write(PREF_KEY, 'off')
    if (el) rampTo(el, 0, () => el.pause())
  }

  // Autoplay: try right away; if the browser blocks it, start on the first interaction.
  useEffect(() => {
    if (!available || read(PREF_KEY) === 'off') return
    let cancelled = false
    const events = ['pointerdown', 'keydown', 'touchstart'] as const
    const onGesture = () => {
      remove()
      if (!cancelled) play()
    }
    const remove = () => events.forEach((e) => window.removeEventListener(e, onGesture, true))

    play().then((ok) => {
      if (ok || cancelled) return
      setBlocked(true)
      events.forEach((e) => window.addEventListener(e, onGesture, { capture: true, passive: true }))
    })
    return () => {
      cancelled = true
      remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available])

  // Pause while the tab is hidden
  useEffect(() => {
    const onVis = () => {
      const el = audio.current
      if (!el || !playing) return
      if (document.hidden) el.pause()
      else el.play().catch(() => {})
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [playing])

  useEffect(
    () => () => {
      window.clearInterval(fade.current)
      audio.current?.pause()
    },
    [],
  )

  const changeVolume = (v: number) => {
    setVolume(v)
    const el = audio.current
    if (el && playing) {
      window.clearInterval(fade.current)
      el.volume = v
    }
  }

  const toggle = () => {
    if (playing) pause()
    else {
      write(PREF_KEY, 'on')
      play()
    }
  }

  if (!available) return null
  const VolIcon = !playing || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2

  return (
    <motion.div
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-40 flex flex-row-reverse items-center gap-2 sm:bottom-6 sm:left-6"
      initial={{ opacity: 0, y: 16 }}
      animate={visible ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: 0.6 }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {/* volume slider */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: -10, width: 0 }}
            animate={{ opacity: 1, x: 0, width: 'auto' }}
            exit={{ opacity: 0, x: -10, width: 0 }}
            className="flex h-11 items-center gap-2 overflow-hidden rounded-lg border border-line bg-white px-3 shadow-md"
          >
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              aria-label={t(ui.music.volume)}
              className="h-1 w-24 cursor-pointer accent-[#3a36a8] sm:w-28"
            />
            <span className="w-9 text-right text-xs font-semibold text-muted">{Math.round(volume * 100)}%</span>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={toggle}
        onFocus={() => setOpen(true)}
        aria-pressed={playing}
        aria-label={playing ? t(ui.music.off) : t(ui.music.on)}
        title={playing ? t(ui.music.off) : t(ui.music.on)}
        className={cn(
          'relative flex h-11 items-center gap-2 rounded-lg border px-3 text-sm font-semibold shadow-md transition-colors duration-300',
          playing ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:border-ink',
        )}
      >
        {blocked && <span aria-hidden className="absolute -top-1 -right-1 size-2.5 rounded-full bg-gold" />}
        <span aria-hidden className="flex h-4 items-end gap-[3px]">
          {[0.55, 1, 0.7, 0.85].map((h, i) => (
            <motion.span
              key={i}
              className="w-[3px] origin-bottom rounded-full bg-current"
              style={{ height: '100%' }}
              animate={playing ? { scaleY: [h * 0.4, h, h * 0.5, h * 0.9, h * 0.4] } : { scaleY: 0.25 }}
              transition={playing ? { duration: 1.1 + i * 0.15, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
            />
          ))}
        </span>
        <VolIcon size={18} strokeWidth={2.2} />
      </button>
    </motion.div>
  )
}
