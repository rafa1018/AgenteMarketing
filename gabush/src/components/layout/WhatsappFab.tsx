import { AnimatePresence, motion } from 'motion/react'
import { ArrowUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { site, whatsappLink } from '@/data/site'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'
import { WhatsappIcon } from '@/components/ui/BrandIcons'

/** Floating WhatsApp button, with a "back to top" arrow above it once the visitor has scrolled down. */
export function WhatsappFab({ visible }: { visible: boolean }) {
  const t = useT()
  // the arrow appears once the visitor is about a screen down the page
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > window.innerHeight * 0.8)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])

  const toTop = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
    history.replaceState(null, '', location.pathname)
  }

  return (
    <div className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex flex-col items-center gap-3 sm:right-6 sm:bottom-6">
      <AnimatePresence>
        {visible && scrolled && (
          <motion.button
            type="button"
            onClick={toTop}
            aria-label={t({ es: 'Volver arriba', en: 'Back to top' })}
            title={t({ es: 'Volver arriba', en: 'Back to top' })}
            initial={{ opacity: 0, y: 16, scale: 0.6 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.6 }}
            transition={{ type: 'spring', stiffness: 380, damping: 20 }}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.92 }}
            className="grid size-12 place-items-center rounded-full border-[3px] border-white bg-yellow text-ink shadow-[0_4px_0_#c99a00,0_12px_24px_-12px_rgba(35,32,107,0.6)]"
          >
            <ArrowUp size={22} strokeWidth={2.8} />
          </motion.button>
        )}
      </AnimatePresence>
      <motion.a
        href={whatsappLink(t(site.whatsappMessage))}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t(ui.whatsappFab)}
        title={t(ui.whatsappFab)}
        initial={{ scale: 0, opacity: 0 }}
        animate={visible ? { scale: 1, opacity: 1 } : undefined}
        transition={{ delay: 0.6, type: 'spring', stiffness: 300, damping: 18 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.94 }}
        className="grid size-14 place-items-center rounded-full bg-whatsapp text-white shadow-[0_12px_28px_-12px_rgba(35,32,107,0.6)]"
      >
        <WhatsappIcon size={28} className="relative" />
      </motion.a>
    </div>
  )
}
