import { ShieldAlert } from 'lucide-react'
import { Brand } from '@/components/layout/Navbar'
import { useT } from '@/i18n'
import { links, ui } from '@/i18n/ui'
import { scrollToId } from '@/lib/utils'

export function Footer() {
  const t = useT()
  const cols = [
    {
      title: ui.footer.platform,
      items: [
        { label: ui.nav.login, href: links.login },
        { label: ui.footer.create, href: links.signup },
        { label: ui.nav.items[0].label, id: 'platform' },
      ],
    },
    {
      title: ui.footer.resources,
      items: [
        { label: ui.about.kicker, id: 'about' },
        { label: ui.how.kicker, id: 'how' },
        { label: { es: 'Masterclass', en: 'Masterclass' }, href: links.masterclass },
      ],
    },
  ]
  return (
    <footer className="relative border-t border-line">
      <div className="container-x grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Brand />
          <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-muted">{t(ui.footer.tagline)}</p>
        </div>
        {cols.map((c) => (
          <div key={c.title.en}>
            <p className="hud !text-[10px] text-cyan">{t(c.title)}</p>
            <ul className="mt-4 space-y-2.5">
              {c.items.map((i) => (
                <li key={i.label.en}>
                  {'href' in i ? (
                    <a href={i.href} className="text-[14px] text-muted transition-colors hover:text-fg">
                      {t(i.label)}
                    </a>
                  ) : (
                    <button type="button" onClick={() => scrollToId(i.id!)} className="text-[14px] text-muted transition-colors hover:text-fg">
                      {t(i.label)}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="container-x border-t border-line py-6">
        <p className="flex gap-3 text-[12.5px] leading-relaxed text-dim">
          <ShieldAlert size={16} className="mt-0.5 shrink-0 text-cyan/70" />
          {t(ui.footer.riskNotice)}
        </p>
        <p className="mt-4 pr-16 font-mono text-[10.5px] tracking-[0.12em] text-dim">© {new Date().getFullYear()} MiMatt PRO</p>
      </div>
    </footer>
  )
}
