import { profile } from '@/data/profile'
import { Logo } from '@/components/ui/Logo'
import { GithubIcon, LinkedinIcon } from '@/components/ui/BrandIcons'
import { VisitCounter } from '@/components/ui/VisitCounter'
import { ShareButton } from '@/components/ui/ShareButton'
import { SubscribeForm } from '@/components/ui/SubscribeForm'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'
import { isPlaceholder } from '@/lib/utils'

export function Footer() {
  const t = useT()
  const links = [
    { label: 'GitHub', href: profile.links.github, icon: GithubIcon, external: true },
    { label: 'LinkedIn', href: profile.links.linkedin, icon: LinkedinIcon, external: true },
  ].filter((l) => !isPlaceholder(l.href))

  return (
    <footer className="relative border-t border-line">
      <div className="container-x flex flex-col gap-8 py-10 md:flex-row md:items-end md:justify-between">
        <div>
          <Logo />
          <p className="mt-3 font-mono text-[11px] tracking-[0.18em] text-muted uppercase">{t(ui.footer.tagline)}</p>
          <p className="mt-1 font-mono text-[11px] tracking-[0.1em] text-dim">{profile.domain}</p>
          <VisitCounter className="mt-4" />
        </div>
        <div className="flex flex-col gap-5 md:items-end">
          <SubscribeForm />
          <ul className="flex flex-wrap gap-2 md:justify-end">
            {links.map((l) => (
              <li key={l.label}>
                <a
                  href={l.href}
                  {...(l.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-line px-3.5 font-mono text-[11px] tracking-[0.16em] text-muted uppercase transition-colors hover:border-line-strong hover:text-fg"
                >
                  <l.icon size={15} /> {l.label}
                </a>
              </li>
            ))}
            <li>
              <ShareButton placement="up" align="right" className="[&>button]:!h-10 [&>button]:!rounded-md [&>button]:!border-line [&>button]:!px-3.5 [&>button]:!text-muted" />
            </li>
          </ul>
        </div>
      </div>
      <div className="container-x flex flex-col gap-2 border-t border-line py-5 pr-20 font-mono text-[10.5px] tracking-[0.12em] text-dim sm:flex-row sm:justify-between">
        <span>© {new Date().getFullYear()} {profile.fullName}</span>
        <span>{t(ui.footer.built)}</span>
      </div>
    </footer>
  )
}
