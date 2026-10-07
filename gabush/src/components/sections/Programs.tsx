import { motion } from 'motion/react'
import { ArrowRight, Check, Users } from 'lucide-react'
import { useState } from 'react'
import { programs, TONES, type Program } from '@/data/programs'
import { site, whatsappLink } from '@/data/site'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'
import { cn } from '@/lib/utils'
import { RevealItem, ScrollReveal } from '@/components/animations'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Modal } from '@/components/ui/Modal'
import { Rich } from '@/components/ui/Rich'
import { WhatsappIcon } from '@/components/ui/BrandIcons'
import { Deco, useSectionScroll } from '@/components/fx/Fx'

function Cover({ p, large = false }: { p: Program; large?: boolean }) {
  const t = useT()
  const tone = TONES[p.tone]
  return (
    <div className={cn('relative overflow-hidden', large ? 'aspect-[16/9]' : 'aspect-[4/3]')} style={{ background: tone.soft }}>
      {p.image ? (
        <img src={p.image.src} alt={t(p.image.alt)} loading="lazy" width={640} height={480} className="size-full object-cover transition-transform duration-700 group-hover:scale-110" />
      ) : (
        <div aria-hidden className="dots-bg absolute inset-0 grid place-items-center">
          <p.icon size={large ? 72 : 56} strokeWidth={1.4} style={{ color: tone.solid }} />
        </div>
      )}
    </div>
  )
}

/** Level card: photo in a rounded window + a coloured "tab" with the age. */
function GradeCard({ p, i, onOpen }: { p: Program; i: number; onOpen: () => void }) {
  const t = useT()
  const tone = TONES[p.tone]
  const dark = p.tone === 'yellow'
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      className="group relative flex h-full w-full flex-col rounded-[28px] bg-white p-3 text-left"
      style={{ boxShadow: `0 0 0 3px ${tone.solid}, 0 8px 0 3px ${tone.edge}, 0 30px 40px -30px rgba(35,32,107,.6)`, rotate: [-1.2, 1, -0.8, 1.2][i % 4] }}
      whileHover={{ y: -8, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 16 }}
    >
      <div className="overflow-hidden rounded-[20px]">
        <Cover p={p} />
      </div>
      <span className="absolute top-6 left-6 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-extrabold shadow" style={{ background: tone.solid, color: dark ? '#23206b' : '#fff' }}>
        <p.icon size={15} strokeWidth={2.5} />
        {p.level && <Rich text={p.level} />}
      </span>
      <div className="flex flex-1 flex-col px-2 pt-4 pb-2">
        <h3 className="text-[1.7rem]" style={{ color: tone.text }}>
          {t(p.title)}
        </h3>
        <p className="mt-1 text-[15.5px] font-medium text-text/75">{t(p.short)}</p>
        <span className="mt-auto inline-flex items-center gap-1.5 pt-4 font-serif text-[16px] font-semibold text-ink">
          {t(ui.programs.more)}
          <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </motion.button>
  )
}

function ExtraCard({ p, onOpen }: { p: Program; onOpen: () => void }) {
  const t = useT()
  const tone = TONES[p.tone]
  return (
    <button type="button" onClick={onOpen} className="group card flex w-full items-center gap-4 p-3 pr-5 text-left transition-transform hover:-translate-y-1">
      <span className="size-20 shrink-0 overflow-hidden rounded-2xl sm:size-24">
        {p.image && <img src={p.image.src} alt="" loading="lazy" width={640} height={480} className="size-full object-cover transition-transform duration-500 group-hover:scale-110" />}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 font-serif text-[1.2rem] leading-tight font-semibold" style={{ color: tone.text }}>
          <p.icon size={18} strokeWidth={2.4} className="shrink-0" />
          {t(p.title)}
        </span>
        <span className="mt-1 block text-[15px] leading-snug text-muted">{t(p.short)}</span>
      </span>
    </button>
  )
}

export function Programs() {
  const t = useT()
  const [openId, setOpenId] = useState<string | null>(null)
  const current = programs.find((p) => p.id === openId)
  const grades = programs.filter((p) => p.grade)
  const extras = programs.filter((p) => !p.grade)
  const { ref, progress } = useSectionScroll<HTMLElement>()

  return (
    <section id="programas" ref={ref} className="dots-bg relative overflow-clip bg-cream py-20 sm:py-28">
      <Deco src="/images/opt/anim-7.webp" width={90} className="top-16 right-[4%] hidden md:block" anim="float" progress={progress} scroll={-140} duration={8} />
      <Deco src="/images/opt/anim-1.webp" width={80} className="top-[45%] left-[1%] hidden xl:block" anim="sway" progress={progress} scroll={-80} />

      <div className="container-x relative">
        <SectionHeader kicker={ui.programs.kicker} title={ui.programs.title} sub={ui.programs.sub} />

        <ScrollReveal className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6" stagger={0.1}>
          {grades.map((p, i) => (
            <RevealItem key={p.id} className="h-full">
              <GradeCard p={p} i={i} onOpen={() => setOpenId(p.id)} />
            </RevealItem>
          ))}
        </ScrollReveal>

        <h3 className="mt-16 text-2xl">{t(ui.programs.extras)}</h3>
        <ScrollReveal className="mt-5 grid gap-4 md:grid-cols-3" stagger={0.08}>
          {extras.map((p) => (
            <RevealItem key={p.id}>
              <ExtraCard p={p} onOpen={() => setOpenId(p.id)} />
            </RevealItem>
          ))}
        </ScrollReveal>
      </div>

      <Modal open={Boolean(current)} onClose={() => setOpenId(null)} label={current ? t(current.title) : ''} closeLabel={t(ui.programs.close)}>
        {current && (
          <div>
            <Cover p={current} large />
            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="grid size-12 place-items-center rounded-2xl text-white" style={{ background: TONES[current.tone].solid, boxShadow: `0 4px 0 ${TONES[current.tone].edge}` }}>
                  <current.icon size={24} strokeWidth={2.2} />
                </span>
                <h3 className="text-3xl sm:text-[2.2rem]">{t(current.title)}</h3>
              </div>
              {current.level && (
                <p className="mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold" style={{ background: TONES[current.tone].soft, color: TONES[current.tone].text }}>
                  <Users size={15} strokeWidth={2.5} />
                  {t({ es: 'Edad', en: 'Age' })}: <Rich text={current.level} />
                </p>
              )}
              <p className="mt-4 text-lg leading-relaxed">
                <Rich text={current.detail} />
              </p>
              <h4 className="mt-6 text-xl">{t(ui.programs.includes)}</h4>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {current.includes.map((inc, i) => (
                  <li key={i} className="flex items-start gap-2 rounded-2xl px-3 py-2.5" style={{ background: TONES[current.tone].soft }}>
                    <Check size={18} strokeWidth={3} className="mt-0.5 shrink-0" style={{ color: TONES[current.tone].solid }} />
                    <span className="font-semibold">{t(inc)}</span>
                  </li>
                ))}
              </ul>
              <a
                href={whatsappLink(`${t(ui.programs.askWhatsapp)} "${t(current.title)}" — ${site.fullName}`)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-whatsapp mt-7 w-full sm:w-auto"
              >
                <WhatsappIcon size={22} />
                {t(ui.programs.ask)}
              </a>
            </div>
          </div>
        )}
      </Modal>
    </section>
  )
}
