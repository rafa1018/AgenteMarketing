import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight, Grid3x3, Heart, Images } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { site } from '@/data/site'
import { useLang, useT } from '@/i18n'
import { ui } from '@/i18n/ui'
import { useFeed, type FeedPost } from '@/lib/feed'
import { RevealItem, ScrollReveal } from '@/components/animations'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Modal } from '@/components/ui/Modal'
import { InstagramIcon } from '@/components/ui/BrandIcons'
import { Deco, useSectionScroll } from '@/components/fx/Fx'

const PAGE = 9

function Avatar({ size = 'size-11' }: { size?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-[conic-gradient(#f8c21c,#f26b1d,#e5197e,#8e44c9,#1fa3dd,#5cb531,#f8c21c)] p-[3px] ${size}`}>
      <span className="grid size-full place-items-center rounded-full bg-cream p-0.5">
        <img src="/images/opt/leon-asomado-160.webp" alt="" width={160} height={161} className="size-full object-contain" />
      </span>
    </span>
  )
}

function niceDate(ymd: string, lang: 'es' | 'en') {
  if (!ymd) return ''
  const d = new Date(`${ymd}T12:00:00`)
  return d.toLocaleDateString(lang === 'es' ? 'es-CO' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Instagram-style profile + 3-column grid of posts. Managed from the admin panel, not linked to Instagram. */
export function Feed() {
  const t = useT()
  const { lang } = useLang()
  const items = useFeed()
  const [shown, setShown] = useState(PAGE)
  const [index, setIndex] = useState<number | null>(null)
  const n = items?.length ?? 0
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

  const current: FeedPost | null = index === null || !items ? null : items[index]

  return (
    <section id="momentos" ref={ref} className="relative overflow-clip bg-[linear-gradient(180deg,#fff_0%,#fff4fa_100%)] py-20 sm:py-28">
      <Deco src="/images/opt/anim-10.webp" width={110} className="top-20 right-[3%] hidden lg:block" anim="float" progress={progress} scroll={-120} />
      <Deco src="/images/opt/anim-5.webp" width={60} className="top-[40%] left-[2%] hidden xl:block" anim="float" progress={progress} scroll={-60} duration={7} />

      <div className="container-x relative">
        <SectionHeader kicker={ui.feed.kicker} title={ui.feed.title} sub={ui.feed.sub} center />

        <div className="mx-auto mt-12 max-w-[920px] rounded-[32px] border-2 border-line bg-white p-4 shadow-[0_30px_60px_-40px_rgba(35,32,107,0.5)] sm:p-7">
          {/* profile header */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-7">
            <Avatar size="size-20 sm:size-24" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <p className="font-serif text-xl font-semibold text-ink sm:text-2xl">{site.instagramHandle.replace('@', '')}</p>
                <a href={site.socials.instagram} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[linear-gradient(90deg,#f26b1d,#e5197e,#8e44c9)] px-4 text-sm font-bold text-white">
                  <InstagramIcon size={16} /> {t(ui.feed.follow)}
                </a>
              </div>
              <p className="mt-1.5 text-[15px] text-muted">
                <b className="text-ink">{n}</b> {t(ui.feed.posts)} · {site.fullName}
              </p>
              <p className="text-[15px] font-semibold text-ink">
                {t(site.motto)} 🎨🎵🦁 · {site.city}
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-center gap-10 border-t-2 border-line text-[13px] font-extrabold tracking-[0.1em] text-ink uppercase">
            <span className="-mt-0.5 flex items-center gap-1.5 border-t-2 border-ink pt-3">
              <Grid3x3 size={15} /> {t({ es: 'Publicaciones', en: 'Posts' })}
            </span>
          </div>

          {/* grid */}
          {items === null ? (
            <div className="mt-3 grid grid-cols-3 gap-1.5 sm:gap-3">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded-xl bg-paper" />
              ))}
            </div>
          ) : !n ? (
            <p className="mt-6 rounded-2xl bg-paper p-6 text-center font-semibold text-muted">{t(ui.feed.empty)}</p>
          ) : (
            <ScrollReveal className="mt-3 grid grid-cols-3 gap-1.5 sm:gap-3" stagger={0.05}>
              {items.slice(0, shown).map((p, i) => (
                <RevealItem key={p.id}>
                  <button type="button" onClick={() => setIndex(i)} aria-label={`${t(ui.feed.open)}: ${p.caption}`} className="group relative block aspect-square w-full overflow-hidden rounded-lg bg-paper sm:rounded-2xl">
                    <img src={p.thumb} alt={p.caption} loading="lazy" width={480} height={480} className="size-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    <span className="absolute inset-0 hidden items-end bg-gradient-to-t from-ink/80 via-ink/10 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100 sm:flex">
                      <span className="line-clamp-2 text-left text-sm font-semibold text-white">{p.caption}</span>
                    </span>
                    <Heart aria-hidden size={22} className="absolute top-2 right-2 fill-white text-white opacity-0 drop-shadow transition-all group-hover:scale-110 group-hover:opacity-100" />
                  </button>
                </RevealItem>
              ))}
            </ScrollReveal>
          )}

          {n > shown && (
            <div className="mt-6 text-center">
              <button type="button" onClick={() => setShown((s) => s + PAGE)} className="btn btn-ghost">
                <Images size={18} /> {t(ui.feed.more)}
              </button>
            </div>
          )}
        </div>
      </div>

      <Modal open={current !== null} onClose={close} label={current?.caption ?? ''} closeLabel={t(ui.programs.close)} className="w-full max-w-4xl">
        {current && index !== null && (
          <div className="grid md:grid-cols-[1.3fr_1fr]">
            <div className="relative bg-ink">
              <AnimatePresence mode="wait">
                <motion.img key={current.id} src={current.img} alt={current.caption} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="aspect-square w-full object-cover" />
              </AnimatePresence>
              {n > 1 && (
                <>
                  <button type="button" onClick={() => step(-1)} aria-label={t(ui.gallery.prev)} className="absolute top-1/2 left-3 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow">
                    <ChevronLeft size={22} />
                  </button>
                  <button type="button" onClick={() => step(1)} aria-label={t(ui.gallery.next)} className="absolute top-1/2 right-3 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow">
                    <ChevronRight size={22} />
                  </button>
                </>
              )}
            </div>
            <div className="flex flex-col p-5 sm:p-6">
              <div className="flex items-center gap-3 border-b-2 border-line pb-4 pr-10">
                <Avatar size="size-10" />
                <span className="font-serif text-lg font-semibold text-ink">{site.instagramHandle.replace('@', '')}</span>
              </div>
              <p className="mt-4 text-[16px] leading-relaxed whitespace-pre-line">
                <b className="font-serif font-semibold text-ink">{site.instagramHandle.replace('@', '')}</b> {current.caption}
              </p>
              <div className="mt-auto pt-6">
                {current.date && <p className="text-[13px] font-bold tracking-wide text-muted uppercase">{niceDate(current.date, lang)}</p>}
                <p className="mt-1 text-[13px] text-muted">
                  {index + 1} / {n}
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </section>
  )
}
