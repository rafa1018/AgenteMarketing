import { Award, GraduationCap } from 'lucide-react'
import { certifications } from '@/data/certifications'
import { education } from '@/data/experience'
import { FadeIn, RevealItem, ScrollReveal } from '@/components/animations'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'

/** Discreet credentials strip: certifications + formal education. */
export function Certifications() {
  const t = useT()
  const items = [
    ...certifications.map((c) => ({ icon: Award, title: c.code ? `${c.name} — ${c.code}` : c.name, by: c.issuer, date: t(c.date), kind: t(ui.certifications.certification) })),
    ...education.map((e) => ({ icon: GraduationCap, title: t(e.title), by: e.institution, date: t(e.date), kind: t(ui.certifications.education) })),
  ]
  return (
    <section id="certifications" className="relative py-16 sm:py-20">
      <div className="container-x">
        <FadeIn className="mb-8 flex items-center gap-3">
          <span className="hud text-cyan">[08]</span>
          <span className="h-px w-10 bg-line-strong" />
          <h2 className="hud text-muted">{t(ui.certifications.title)}</h2>
        </FadeIn>
        <ScrollReveal className="grid gap-4 md:grid-cols-3">
          {items.map((it) => (
            <RevealItem key={it.title} className="panel flex gap-4 p-5 transition-colors duration-300 hover:border-line-strong">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-line text-cyan">
                <it.icon size={18} strokeWidth={1.5} />
              </span>
              <div className="min-w-0">
                <div className="hud !text-[9px] text-dim">{it.kind} · {it.date}</div>
                <h3 className="mt-1.5 text-[15px] leading-snug font-medium text-fg">{it.title}</h3>
                <p className="mt-1 text-[13px] text-muted">{it.by}</p>
              </div>
            </RevealItem>
          ))}
        </ScrollReveal>
      </div>
    </section>
  )
}
