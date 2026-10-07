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
    <div role="group" aria-label={t(ui.nav.language)} className={cn('relative flex h-10 items-center rounded-lg border border-line bg-white p-1', className)}>
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={cn(
            'relative h-full min-w-9 rounded-md px-2 text-[13px] font-semibold uppercase transition-colors',
            lang === l ? 'text-white' : 'text-muted hover:text-ink',
          )}
        >
          {lang === l && <motion.span layoutId={`${id}-pill`} className="absolute inset-0 rounded-md bg-ink" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
          <span className="relative">{l}</span>
        </button>
      ))}
    </div>
  )
}
