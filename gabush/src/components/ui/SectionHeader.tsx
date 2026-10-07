import { FadeIn, RevealText } from '@/components/animations'
import { SectionMascot } from '@/components/fx/BlinkingCharacter'
import type { CharacterId } from '@/data/characters'
import { useT, type Text } from '@/i18n'
import { cn } from '@/lib/utils'

/** Default spot for a mascot: top-right of the header (small on phones, the text wraps before it). */
const MASCOT_SPOT = 'absolute top-0 right-0 w-[76px] sm:w-28 lg:-top-4 lg:w-40'

/** Kicker pill + word-by-word title + optional subtitle, and optionally a blinking Gabush character. */
export function SectionHeader({
  kicker,
  title,
  sub,
  className,
  light = false,
  center = false,
  mascot,
  mascotClassName = MASCOT_SPOT,
}: {
  kicker: Text
  title: Text
  sub?: Text
  className?: string
  light?: boolean
  center?: boolean
  mascot?: CharacterId
  mascotClassName?: string
}) {
  const t = useT()
  const header = (
    <div className={cn('max-w-3xl', center && 'mx-auto text-center', mascot && 'pr-[84px] sm:pr-32 lg:pr-0', className)}>
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
  if (!mascot) return header
  return (
    <div className="relative">
      {header}
      <SectionMascot id={mascot} className={mascotClassName} />
    </div>
  )
}
