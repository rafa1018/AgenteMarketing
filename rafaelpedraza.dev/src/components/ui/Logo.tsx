import { cn } from '@/lib/utils'

/** RP monogram — vector version of Rafael's RP mark (white R, blue P). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 98 64" className={cn('h-6 w-auto', className)} aria-hidden>
      <path fill="#eef3fb" fillRule="evenodd" d="M2 8H34A14 14 0 0 1 34 36H31L45 56H34L21 36H16V56H6V16Z M16 17H33A5.5 5.5 0 0 1 33 28H16Z" />
      <path fill="#2f8cff" fillRule="evenodd" d="M50 8H82A14 14 0 0 1 82 36H60V56L50 48Z M60 17H81A5.5 5.5 0 0 1 81 28H60Z" />
    </svg>
  )
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <span className="relative grid size-9 place-items-center rounded-lg border border-line bg-navy/60">
        <LogoMark className="h-[15px]" />
      </span>
      {!compact && (
        <span className="hud !text-[10.5px] !tracking-[0.32em] text-fg">
          Rafael <span className="text-volt">Pedraza</span>
        </span>
      )}
    </span>
  )
}
