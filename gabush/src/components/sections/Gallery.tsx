import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { TONE_ORDER, TONES } from '@/data/programs'
import { useLang, useT } from '@/i18n'
import { ui } from '@/i18n/ui'
import { cn } from '@/lib/utils'
import { tr, useContent } from '@/lib/content'
import { ParallaxImage, RevealItem, ScrollReveal } from '@/components/animations'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Modal } from '@/components/ui/Modal'
import { Deco, useSectionScroll } from '@/components/fx/Fx'

/** "Así se vive Gabush" — photos managed in the admin panel (Galería). */
export function Gallery() {
  const t = useT()
  const { lang } = useLang()
  const gallery = useContent('gallery')
  const [index, setIndex] = useState<number | null>(null)
  const n = gallery.length
  const close = useCallback(() => setIndex(null), [])
  const step = useCallback((d: number) => setIndex((i) => (i === null ? i : (i + d + n) % n)), [n])
  const { ref, progress } = useSectionScroll<HTMLElement>()

  useEffect(() => {
    if (index === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') step(1)
      if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, step])

  const current = index === null ? null : (gallery[index] ?? null)

  if (!gallery.length) return null

  return (
    <section id="galeria" ref={ref} className="relative overflow-clip bg-[#effaf0] py-20 sm:py-28">
      <Deco src="/images/opt/anim-16.webp" width={120} className="top-14 right-[4%] hidden lg:block" anim="float" progress={progress} scroll={-100} />
      <div className="container-x relative">
        <SectionHeader kicker={ui.gallery.kicker} title={ui.gallery.title} sub={ui.gallery.sub} />

        <ScrollReveal className="mt-12 grid grid-flow-dense grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3" stagger={0.08}>
          {gallery.map((g, i) => {
            const tone = TONES[TONE_ORDER[i % TONE_ORDER.length]]
            const big = i === 0
            return (
              <RevealItem key={g.id} className={cn(big && 'col-span-2 lg:row-span-2')}>
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`${t(ui.gallery.open)}: ${tr(g.caption, lang)}`}
                  className="group relative block size-full overflow-hidden rounded-[24px] border-4 border-white bg-line shadow-[0_18px_30px_-22px_rgba(35,32,107,0.6)] transition-transform hover:-rotate-1"
                >
                  <ParallaxImage
                    frameClassName={cn('w-full', big ? 'aspect-[4/3] lg:h-full lg:aspect-auto' : 'aspect-square')}
                    src={g.thumb || g.img}
                    srcSet={g.thumb && g.img ? `${g.thumb} 640w, ${g.img} 1280w` : undefined}
                    sizes={big ? '(min-width: 1024px) 760px, 100vw' : '(min-width: 1024px) 380px, 50vw'}
                    alt={tr(g.alt, lang) || tr(g.caption, lang)}
                    loading="lazy"
                    width={640}
                    height={640}
                  />
                  <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3 sm:p-4">
                    <span className="rounded-full px-3 py-1 font-serif text-[15px] font-semibold sm:text-base" style={{ background: tone.solid, color: tone.solid === '#f8c21c' ? '#23206b' : '#fff' }}>
                      {tr(g.caption, lang)}
                    </span>
                    <span className="hidden size-9 place-items-center rounded-full bg-white/90 text-ink sm:grid">
                      <ZoomIn size={17} strokeWidth={2.2} />
                    </span>
                  </span>
                </button>
              </RevealItem>
            )
          })}
        </ScrollReveal>
      </div>

      <Modal open={current !== null} onClose={close} label={current ? tr(current.caption, lang) : ''} closeLabel={t(ui.programs.close)} variant="bare" className="w-full max-w-5xl">
        {current && index !== null && (
          <figure className="relative">
            <AnimatePresence mode="wait">
              <motion.img
                key={current.id}
                src={current.img || current.thumb}
                alt={tr(current.alt, lang) || tr(current.caption, lang)}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.25 }}
                className="max-h-[78svh] w-full rounded-3xl object-contain"
              />
            </AnimatePresence>
            <figcaption className="mt-3 flex items-center justify-between gap-3 text-white">
              <button type="button" onClick={() => step(-1)} aria-label={t(ui.gallery.prev)} className="grid size-12 place-items-center rounded-full bg-white/15 hover:bg-white/25">
                <ChevronLeft size={24} />
              </button>
              <span className="text-center font-serif text-xl font-semibold">
                {tr(current.caption, lang)} <span className="text-white/60">· {index + 1}/{n}</span>
              </span>
              <button type="button" onClick={() => step(1)} aria-label={t(ui.gallery.next)} className="grid size-12 place-items-center rounded-full bg-white/15 hover:bg-white/25">
                <ChevronRight size={24} />
              </button>
            </figcaption>
          </figure>
        )}
      </Modal>
    </section>
  )
}
