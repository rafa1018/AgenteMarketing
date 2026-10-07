import { Clock, Mail, MapPin, Phone } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { mapsLink, site, whatsappLink } from '@/data/site'
import { useLang, useT } from '@/i18n'
import { loadEvents, useCalendar } from '@/lib/calendar'
import { summarizeSchedule } from '@/lib/schedule'
import { ui } from '@/i18n/ui'
import { FadeIn } from '@/components/animations'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { WhatsappIcon } from '@/components/ui/BrandIcons'
import { EnrollForm } from './EnrollForm'

function Row({ icon, label, children, color, soft }: { icon: ReactNode; label: string; children: ReactNode; color: string; soft: string }) {
  return (
    <div className="flex items-start gap-4">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl" style={{ background: soft, color }}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-extrabold tracking-[0.12em] text-muted uppercase">{label}</p>
        <div className="text-[16px] font-semibold break-words text-ink">{children}</div>
      </div>
    </div>
  )
}

export function Contact() {
  const t = useT()
  const { lang } = useLang()
  const schedule = useCalendar((s) => s.schedule)
  const hours = summarizeSchedule(schedule, lang)
  useEffect(() => {
    loadEvents()
  }, [])

  return (
    <section id="contacto" className="dots-bg relative overflow-clip bg-paper py-20 sm:py-28">
      <div className="container-x relative">
        <SectionHeader kicker={ui.contact.kicker} title={ui.contact.title} sub={ui.contact.sub} mascot="oso" />

        <div className="mt-12 grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start [&>*]:min-w-0">
          <FadeIn direction="right" className="space-y-5">
            <a href={whatsappLink(t(site.whatsappMessage))} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-4 rounded-3xl bg-whatsapp p-5 text-[#06301a] shadow-[0_6px_0_#1a9e4b,0_20px_32px_-22px_rgba(37,211,102,0.9)] transition-transform hover:-translate-y-1">
              <span className="grid size-14 place-items-center rounded-2xl bg-white/90 text-[#1faa53]">
                <WhatsappIcon size={30} />
              </span>
              <span>
                <span className="block text-[12px] font-extrabold tracking-[0.12em] uppercase">{t(ui.contact.whatsapp)}</span>
                <span className="block font-serif text-2xl leading-tight font-semibold">{site.phoneDisplay}</span>
              </span>
            </a>

            <div className="card space-y-5 p-6">
              <Row icon={<MapPin size={22} />} label={t(ui.contact.address)} color="#e5197e" soft="#fde7f2">
                {site.address}
                <span className="block font-medium text-muted">{site.city}</span>
                <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[15px] font-bold text-royal underline-offset-2 hover:underline">
                  {t(ui.contact.map)} →
                </a>
              </Row>
              <Row icon={<Phone size={22} />} label={t(ui.contact.phone)} color="#1588c2" soft="#e3f5fd">
                <a href={`tel:+${site.whatsapp}`} className="hover:text-royal">
                  {site.phoneDisplay}
                </a>
              </Row>
              <Row icon={<Clock size={22} />} label={t(ui.contact.schedule)} color="#b84a0c" soft="#fff0e6">
                {hours.map((h) => (
                  <span key={h} className="block">
                    {h}
                  </span>
                ))}
              </Row>
              <Row icon={<Mail size={22} />} label={t(ui.contact.email)} color="#2f7d14" soft="#ebf7e4">
                <a href={`mailto:${site.email}`} className="hover:text-royal">
                  {site.email}
                </a>
              </Row>
            </div>
          </FadeIn>

          <FadeIn direction="left">
            <EnrollForm />
          </FadeIn>
        </div>
      </div>
    </section>
  )
}
