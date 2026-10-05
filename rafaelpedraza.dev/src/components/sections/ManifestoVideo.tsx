import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { useSite } from '@/hooks/useSite'

/**
 * Optional background video behind the Manifesto statement (turned on from the admin panel).
 * - Only loads once the section is near the viewport.
 * - Skipped for visitors who ask for reduced motion or data saving.
 * - A YouTube video plays muted through YouTube's own embed player; an .mp4 plays natively.
 * - The video stays invisible until it is actually playing, so YouTube's play button / title bar
 *   never shows through (and if the browser blocks autoplay, the section simply keeps its normal background).
 * Dimmed and faded into the page so the statement stays readable.
 */
export function ManifestoVideo() {
  const video = useSite()?.video ?? null
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const [near, setNear] = useState(false)
  const [playing, setPlaying] = useState(false)
  const saveData = typeof navigator !== 'undefined' && Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData)
  const yt = video?.youtube ?? ''

  useEffect(() => {
    const el = ref.current
    if (!el || near) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: '600px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [near, video])

  // YouTube IFrame API over postMessage: reveal the video only once its state is "playing" (1)
  useEffect(() => {
    if (!near || !yt) return
    setPlaying(false)
    let timer: number | undefined
    const onMessage = (e: MessageEvent) => {
      if (!/^https:\/\/(www\.)?youtube(-nocookie)?\.com$/.test(e.origin)) return
      let data: { event?: string; info?: unknown } | null = null
      try {
        data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
      } catch {
        return
      }
      const state = data?.event === 'onStateChange' ? data.info : data?.event === 'infoDelivery' ? (data.info as { playerState?: number })?.playerState : undefined
      if (state === 1) {
        window.clearTimeout(timer)
        timer = window.setTimeout(() => setPlaying(true), 700) // let YouTube's start-up overlay fade first
      } else if (state === 0 || state === 2 || state === -1) {
        window.clearTimeout(timer)
        setPlaying(false)
      }
    }
    window.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('message', onMessage)
      window.clearTimeout(timer)
    }
  }, [near, yt])

  if (!video || reduce || saveData) return null
  const embed =
    `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&mute=1&loop=1&playlist=${yt}&controls=0&disablekb=1&modestbranding=1` +
    `&playsinline=1&rel=0&iv_load_policy=3&fs=0&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`

  // asks the YouTube player to start sending state events
  const listen = () => frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 'rp-bg' }), '*')

  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {near && (
        <div className="absolute inset-0 transition-opacity duration-1000" style={{ opacity: playing ? video.opacity / 100 : 0 }}>
          {yt ? (
            // 16:9 frame that always covers the stage (like object-fit: cover), scaled up to crop YouTube's edges
            <iframe
              ref={frame}
              src={embed}
              title="background"
              tabIndex={-1}
              allow="autoplay; encrypted-media"
              onLoad={() => {
                listen()
                window.setTimeout(listen, 1000)
              }}
              className="absolute top-1/2 left-1/2 h-[max(100%,56.25vw)] w-[max(100%,177.78svh)] -translate-x-1/2 -translate-y-1/2 scale-[1.35] border-0"
            />
          ) : (
            <video src={video.src} autoPlay muted loop playsInline preload="metadata" onPlaying={() => setPlaying(true)} className="absolute inset-0 h-full w-full object-cover" />
          )}
        </div>
      )}
      {/* blue veil + fade into the page above and below */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(3_6_12/0.35),rgb(3_6_12/0.85))]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,var(--color-ink)_0%,transparent_22%,transparent_78%,var(--color-ink)_100%)]" />
      <div className="absolute inset-0 bg-[rgb(20_60_140/0.18)] mix-blend-color" />
    </div>
  )
}
