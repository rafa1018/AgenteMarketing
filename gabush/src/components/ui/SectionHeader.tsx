import { FadeIn, RevealText } from '@/components/animations'
import { useT, type Text } from '@/i18n'
import { cn } from '@/lib/utils'

/** Kicker pill + word-by-word title + optional subtitle. */
export function SectionHeader({ kicker, title, sub, className, light = false, center = false }: { kicker: Text; title: Text; sub?: Text; className?: string; light?: boolean; center?: boolean }) {
  const t = useT()
  return (
    <div className={cn('max-w-3xl', center && 'mx-auto text-center', className)}>
      <FadeIn distance={12}>
        <p className="kicker">{t(kicker)}</p>
      </FadeIn>
      <RevealText as="h2" text={t(title)} className={cn('section-title mt-4', light && '!text-white [text-shadow:0_3px_0_rgb(35_32_107/0.25)]')} />
      {sub && (
        <FadeIn delay={0.15}>
          <p className={cn('mt-4 max-w-2xl text-lg font-medium', center && 'mx-auto', light ? 'text-white/90' : 'text-muted')}>{t(sub)}</p>
        </FadeIn>
      )}
    </div>
  )
}
