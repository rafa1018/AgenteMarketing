import { motion } from 'motion/react'
import { useEffect } from 'react'
import { BlockWord, Cloud, KidsTag } from '@/components/fx/Fx'

const DURATION = 2700 // ms — total, including the exit
const SKY = '#bfe8ff' // = background_color in admin/manifest.webmanifest (Android's launch screen)

/**
 * Welcome animation of the installed app. Android always shows its own launch screen first (the app icon
 * on the manifest's background colour) and no web app can remove it — so this one STARTS exactly like it:
 * same flat sky colour and the whole lion in the middle at about the same size. When Android hands over,
 * the lion "wakes up": it jumps up waving, the GABUSH blocks drop, clouds and grass appear, then the panel.
 */
export function AppIntro({ onDone }: { onDone: () => void }) {
  // plays through (no skip): it is short and the panel is loading underneath meanwhile
  useEffect(() => {
    const id = setTimeout(onDone, DURATION)
    return () => clearTimeout(id)
  }, [onDone])

  return (
    <motion.div
      className="fixed inset-0 z-[100] overflow-hidden"
      style={{ background: SKY }}
      initial={{ opacity: 1 }}
      animate={{ opacity: [1, 1, 0] }}
      transition={{ duration: DURATION / 1000, times: [0, 0.86, 1], ease: 'easeIn' }}
    >
      {/* the flat launch colour turns into the website's sky */}
      <motion.div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,#9fdcff_0%,#d8f2ff_60%,#f2fbff_100%)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35, duration: 0.8 }} />
      <motion.div aria-hidden className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.6 }}>
        <Cloud className="top-[10%]" size={170} duration={22} delay={6} />
        <Cloud className="top-[26%]" size={110} duration={28} delay={18} opacity={0.8} />
        <Cloud className="bottom-[24%]" size={150} duration={25} delay={2} opacity={0.9} />
      </motion.div>

      {/* the lion: same place and size as on Android's launch screen, then it jumps up */}
      <div aria-hidden className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <motion.img
          src="/images/opt/leon-asomado-400.webp"
          alt=""
          width={400}
          height={402}
          className="h-[min(27vw,140px)] w-auto drop-shadow-[0_14px_16px_rgba(35,32,107,0.18)]"
          initial={{ y: '0vh', scale: 1, rotate: 0 }}
          animate={{ y: ['0vh', '0vh', '-15vh'], scale: [1, 1.06, 1.35], rotate: [0, 0, -6, 6, -3, 0] }}
          transition={{
            y: { duration: 0.75, times: [0, 0.4, 1], ease: [0.34, 1.56, 0.64, 1] },
            scale: { duration: 0.75, times: [0, 0.4, 1] },
            rotate: { delay: 0.75, duration: 0.8 },
          }}
        />
      </div>

      {/* GABUSH blocks + motto under the lion */}
      <div aria-hidden className="absolute inset-x-0 top-[55%] flex flex-col items-center">
        <span className="inline-flex flex-col items-end">
          <BlockWord size="text-[min(12vw,4rem)]" delay={0.7} />
          <KidsTag className="-mt-1 mr-2 px-4 text-[min(6.5vw,2rem)]" delay={1.15} />
        </span>
        <motion.p className="mt-3 font-serif text-[min(6.5vw,1.8rem)] font-semibold text-ink" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.45, duration: 0.5 }}>
          Creciendo con las artes
        </motion.p>
      </div>

      <motion.img
        src="/images/opt/grass-1000.webp"
        srcSet="/images/opt/grass-1000.webp 1000w, /images/opt/grass-2000.webp 2000w"
        sizes="100vw"
        alt=""
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-auto min-h-[90px] w-full object-cover object-[18%_top] sm:object-top"
        initial={{ y: '100%' }}
        animate={{ y: '0%' }}
        transition={{ delay: 0.45, type: 'spring', stiffness: 120, damping: 18 }}
      />

    </motion.div>
  )
}
