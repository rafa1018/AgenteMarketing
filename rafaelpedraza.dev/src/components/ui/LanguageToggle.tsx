import { motion } from 'motion/react'
import { useLang, useT, type Lang } from '@/i18n'
import { ui } from '@/i18n/ui'
import { cn } from '@/lib/utils'

const LANGS: Lang[] = ['es', 'en']

/** Compact ES / EN segmented switch. */
export function LanguageToggle({ className, id = 'lang' }: { className?: string; id?: string }) {
  const { lang, setLang } = useLang()
  const t = useT()
  return (
    <div role="group" aria-label={t(ui.nav.language)} className={cn('relative flex h-9 items-center rounded-md border border-line p-0.5', className)}>
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={cn('relative h-full rounded-[5px] px-2.5 font-mono text-[10.5px] tracking-[0.16em] uppercase transition-colors', lang === l ? 'text-white' : 'text-muted hover:text-fg')}
        >
          {lang === l && <motion.span layoutId={`${id}-pill`} className="absolute inset-0 rounded-[5px] bg-volt/80" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
          <span className="relative">{l}</span>
        </button>
      ))}
    </div>
  )
}
