import { AnimatePresence, motion } from 'motion/react'
import { Music2, Volume1, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'
import { loadSite } from '@/lib/site'
import { cn } from '@/lib/utils'

const PREF_KEY = 'gb-music' // 'off' once the visitor pauses it

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
 * Background music chosen in the admin panel (Sitio web → Música): the song, whether it starts by itself
 * and the starting volume. Browsers block audible autoplay until the visitor interacts with the page, so it
 * tries right away and otherwise starts on the first tap / click / key. Hidden when there is no music.
 */
export function MusicToggle({ visible }: { visible: boolean }) {
  const t = useT()
  const audio = useRef<HTMLAudioElement | null>(null)
  const fade = useRef<number | undefined>(undefined)
  const [available, setAvailable] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [blocked, setBlocked] = useState(false) // waiting for a gesture
  const [volume, setVolume] = useState(0.6)
  const [open, setOpen] = useState(false)
  const volumeRef = useRef(volume)
  volumeRef.current = volume
  const src = useRef<string | null>(null)
  const autoplay = useRef(true)

  useEffect(() => {
    let alive = true
    loadSite().then(({ music }) => {
      if (!alive || !music.src) return
      src.current = music.src
      autoplay.current = music.autoplay
      setVolume(music.volume / 100)
      setAvailable(true)
    })
    return () => {
      alive = false
    }
  }, [])

  const getAudio = () => {
    if (!audio.current) {
      const el = new Audio(src.current ?? undefined)
      el.addEventListener('error', () => {
        setAvailable(false)
        setPlaying(false)
      })
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

  const play = async () => {
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

  // autoplay (when enabled): try now; if blocked, start on the first interaction
  useEffect(() => {
    if (!available || !visible || !autoplay.current || read(PREF_KEY) === 'off') return
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
  }, [available, visible])

  // pause while the tab is hidden
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
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-40 flex items-center gap-2 sm:bottom-6 sm:left-6"
      initial={{ opacity: 0, y: 20, scale: 0.8 }}
      animate={visible ? { opacity: 1, y: 0, scale: 1 } : undefined}
      transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.8 }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={toggle}
        onFocus={() => setOpen(true)}
        aria-pressed={playing}
        aria-label={playing ? t(ui.music.off) : t(ui.music.on)}
        title={playing ? t(ui.music.off) : t(ui.music.on)}
        className={cn(
          'relative flex h-14 items-center gap-2.5 rounded-full border-[3px] border-white pr-4 pl-3 font-serif text-[15px] font-semibold shadow-[0_4px_0_rgba(35,32,107,0.25),0_14px_28px_-14px_rgba(35,32,107,0.6)] transition-colors',
          playing ? 'bg-pink text-white' : 'bg-yellow text-ink',
        )}
      >
        {blocked && <span aria-hidden className="absolute -inset-1 animate-pulse-ring rounded-full border-2 border-pink" />}
        <span aria-hidden className="grid size-8 place-items-center rounded-full bg-white/25">
          {playing ? (
            <span className="flex h-4 items-end gap-[3px]">
              {[0.55, 1, 0.7, 0.85].map((h, i) => (
                <motion.span key={i} className="w-[3px] origin-bottom rounded-full bg-current" style={{ height: '100%' }} animate={{ scaleY: [h * 0.4, h, h * 0.5, h * 0.9, h * 0.4] }} transition={{ duration: 1.1 + i * 0.15, repeat: Infinity, ease: 'easeInOut' }} />
              ))}
            </span>
          ) : (
            <Music2 size={18} strokeWidth={2.4} />
          )}
        </span>
        <span className="hidden sm:inline">{playing ? t(ui.music.playing) : blocked ? t(ui.music.tap) : t(ui.music.label)}</span>
        <VolIcon size={17} strokeWidth={2.2} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: -10, width: 0 }}
            animate={{ opacity: 1, x: 0, width: 'auto' }}
            exit={{ opacity: 0, x: -10, width: 0 }}
            className="flex h-12 items-center gap-2 overflow-hidden rounded-full border-2 border-line bg-white px-4 shadow-md"
          >
            <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => changeVolume(Number(e.target.value))} aria-label={t(ui.music.volume)} className="h-1 w-24 cursor-pointer accent-[#e5197e] sm:w-28" />
            <span className="w-9 text-right text-xs font-bold text-ink">{Math.round(volume * 100)}%</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
