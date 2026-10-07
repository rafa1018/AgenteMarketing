import { motion } from 'motion/react'
import { useEffect } from 'react'
import { site } from '@/data/site'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'
import { BlockWord, Cloud, KidsTag } from '@/components/fx/Fx'

const EXIT = 0.37 // s — the final lift + fade, the same whatever the total length

/**
 * Playful intro: the GABUSH letter blocks drop in one by one over a sky, the lion pops up
 * and waves, then everything lifts away. Click / tap / key skips it.
 * `seconds` (total, including the exit) is chosen in the admin panel (Sitio web).
 */
export function Intro({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const t = useT()
  const total = Math.max(1.5, seconds)

  useEffect(() => {
    const id = setTimeout(onDone, total * 1000)
    const skip = (e: KeyboardEvent) => (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') && onDone()
    window.addEventListener('keydown', skip)
    return () => {
      clearTimeout(id)
      window.removeEventListener('keydown', skip)
    }
  }, [onDone, total])

  return (
    <motion.div
      className="fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-[linear-gradient(180deg,#9fdcff_0%,#d8f2ff_60%,#f2fbff_100%)]"
      initial={{ opacity: 1 }}
      animate={{ opacity: [1, 1, 0], y: [0, 0, -40] }}
      transition={{ duration: total, times: [0, (total - EXIT) / total, 1], ease: 'easeIn' }}
      onClick={onDone}
    >
      <Cloud className="top-[12%]" size={190} duration={22} delay={6} />
      <Cloud className="top-[30%]" size={120} duration={28} delay={18} opacity={0.8} />
      <Cloud className="bottom-[22%]" size={160} duration={25} delay={2} opacity={0.9} />

      <div aria-hidden className="relative flex flex-col items-center">
        {/* a gentle float keeps the lion alive when the intro is set to last longer */}
        <div className="gabush-float mb-4">
          <motion.img
            src="/images/opt/leon-asomado-400.webp"
            alt=""
            width={400}
            height={402}
            className="w-[min(38vw,170px)]"
            initial={{ y: 80, opacity: 0, scale: 0.6 }}
            animate={{ y: 0, opacity: 1, scale: 1, rotate: [0, -6, 6, -3, 0] }}
            transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.55, rotate: { delay: 1.1, duration: 0.8 } }}
          />
        </div>
        <span className="inline-flex flex-col items-end">
          <BlockWord size="text-[min(12vw,4.4rem)]" delay={0.05} />
          <KidsTag className="-mt-1 mr-2 px-4 text-[min(6.5vw,2.2rem)]" delay={0.55} />
        </span>
        <motion.p
          className="mt-4 font-serif text-[min(7vw,2rem)] font-semibold text-ink"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85, duration: 0.5 }}
        >
          {t(site.motto)}
        </motion.p>
      </div>

      <img src="/images/opt/grass-1000.webp" srcSet="/images/opt/grass-1000.webp 1000w, /images/opt/grass-2000.webp 2000w" sizes="100vw" alt="" aria-hidden className="absolute inset-x-0 bottom-0 h-[18vh] w-full object-cover object-bottom" />

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onDone()
        }}
        className="absolute right-5 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-10 min-h-11 rounded-full bg-white/90 px-5 text-sm font-bold text-ink shadow"
      >
        {t(ui.intro.skip)} →
      </button>
    </motion.div>
  )
}
