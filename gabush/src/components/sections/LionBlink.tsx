import { cn } from '@/lib/utils'

const LION = '/images/opt/leon-sosteniendo-cerrados-480.webp'

/**
 * The lion holding the phone from its right side (happy, eyes closed), still. Placement: the grabbed edge is at
 * 13.8 % of the image width — line that up with the phone's right edge.
 */
export function LionBlink({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('pointer-events-none select-none', className ?? 'relative')} style={{ aspectRatio: '480 / 720' }}>
      {/* soft shadow on the floor, under his feet */}
      <span className="absolute bottom-[0.5%] left-[10%] h-[7%] w-[72%] rounded-[50%] bg-[radial-gradient(closest-side,rgba(35,32,107,0.5),rgba(35,32,107,0.2)_60%,transparent)] blur-[2px]" />
      <img src={LION} alt="" width={480} height={720} loading="lazy" className="absolute inset-0 size-full object-contain" draggable={false} />
    </div>
  )
}
