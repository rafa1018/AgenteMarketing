import { AnimatePresence, motion } from 'motion/react'
import { Volume1, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'
import { loadSite } from '@/lib/api'
import { cn } from '@/lib/utils'

const PREF_KEY = 'rp-music' // 'on' | 'off'
const DEFAULT_VOLUME = 0.8

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
 * Background music. Whether it starts by itself and at what volume is set in the admin panel.
 * Browsers block audible autoplay until the visitor interacts with the page,
 * so we try immediately and otherwise start on the first click / tap / key.
 * A visitor who pauses it is remembered. Hidden if the music is turned off in the admin panel or the file is missing.
 */
export function MusicToggle({ visible }: { visible: boolean }) {
  const t = useT()
  const audio = useRef<HTMLAudioElement | null>(null)
  const fade = useRef<number | undefined>(undefined)
  const [available, setAvailable] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [blocked, setBlocked] = useState(false) // waiting for a user gesture
  // Every visit starts at the volume set in the admin panel (80 % by default); the slider only affects the current visit.
  const [volume, setVolume] = useState(DEFAULT_VOLUME)
  const [open, setOpen] = useState(false)
  const volumeRef = useRef(volume)
  volumeRef.current = volume

  const src = useRef<string | null>(null)
  const autoplay = useRef(true)

  // The track (or "no music"), whether it starts by itself and the starting volume are chosen in the
  // admin panel. Local files are checked first; an external URL is trusted until the browser fails to load it.
  useEffect(() => {
    let alive = true
    loadSite().then(async ({ music }) => {
      if (!alive || !music.src) return
      src.current = music.src
      autoplay.current = music.autoplay
      setVolume(music.volume / 100)
      if (/^https?:\/\//i.test(music.src)) return setAvailable(true)
      const r = await fetch(music.src, { method: 'HEAD' }).catch(() => null)
      if (alive) setAvailable(Boolean(r?.ok && (r.headers.get('content-type') ?? '').startsWith('audio')))
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

  // Autoplay (when enabled in the admin panel): try right away; if the browser blocks it, start on the first interaction.
  // With autoplay off the button is shown paused and the visitor decides.
  useEffect(() => {
    if (!available || !autoplay.current || read(PREF_KEY) === 'off') return
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
      className="flex items-center gap-2"
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
            initial={{ opacity: 0, x: 10, width: 0 }}
            animate={{ opacity: 1, x: 0, width: 'auto' }}
            exit={{ opacity: 0, x: 10, width: 0 }}
            className="flex h-11 items-center gap-2 overflow-hidden rounded-full border border-line bg-ink/85 px-4 backdrop-blur-md"
          >
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              aria-label={t(ui.music.volume)}
              className="h-1 w-24 cursor-pointer accent-cyan sm:w-28"
            />
            <span className="w-8 text-right font-mono text-[10px] text-muted">{Math.round(volume * 100)}%</span>
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
          'relative flex h-11 items-center gap-2.5 rounded-full border bg-ink/85 px-4 backdrop-blur-md transition-colors duration-300',
          playing ? 'border-cyan/50 text-cyan shadow-[0_0_30px_-8px_rgb(82_211_255/0.6)]' : 'border-line-strong text-fg hover:border-cyan/50',
        )}
      >
        {blocked && <span aria-hidden className="absolute inset-0 rounded-full border border-cyan/60 animate-pulse-ring" />}
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
        <span className="hud !text-[9.5px]">{playing ? t(ui.music.playing) : blocked ? t(ui.music.tap) : t(ui.music.label)}</span>
        <VolIcon size={15} strokeWidth={1.75} />
      </button>
    </motion.div>
  )
}
