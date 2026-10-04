import { ui } from '@/i18n/ui'

export const navItems = [
  { id: 'home', label: ui.nav.home },
  { id: 'about', label: ui.nav.about },
  { id: 'experience', label: ui.nav.experience },
  { id: 'stack', label: ui.nav.stack },
  { id: 'method', label: ui.nav.method },
  { id: 'projects', label: ui.nav.projects },
  { id: 'architecture', label: ui.nav.architecture },
  { id: 'contact', label: ui.nav.contact },
] as const

/** Sections tracked by the left progress rail (wide desktop). Labels are HUD codes. */
export const railSections = [
  { id: 'home', label: 'INIT' },
  { id: 'about', label: 'PROFILE' },
  { id: 'evolution', label: 'EVOLUTION' },
  { id: 'experience', label: 'EXPERIENCE' },
  { id: 'stack', label: 'STACK' },
  { id: 'method', label: 'METHOD' },
  { id: 'projects', label: 'PROJECTS' },
  { id: 'architecture', label: 'ARCHITECTURE' },
  { id: 'focus', label: 'STATUS' },
  { id: 'contact', label: 'CONTACT' },
] as const
