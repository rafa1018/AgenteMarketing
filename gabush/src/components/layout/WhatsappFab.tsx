import { motion } from 'motion/react'
import { site, whatsappLink } from '@/data/site'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'
import { WhatsappIcon } from '@/components/ui/BrandIcons'

/** Floating WhatsApp button. */
export function WhatsappFab({ visible }: { visible: boolean }) {
  const t = useT()
  return (
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
      className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 grid size-14 place-items-center rounded-full bg-whatsapp text-white shadow-[0_12px_28px_-12px_rgba(35,32,107,0.6)] sm:right-6 sm:bottom-6"
    >
      <WhatsappIcon size={28} className="relative" />
    </motion.a>
  )
}
