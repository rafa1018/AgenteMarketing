import type { L } from '@/i18n'

/** CERTIFICATIONS — only real certifications. Add new ones here. */
export interface Certification {
  name: string
  issuer: string
  date: L
  code?: string
  url?: string
}

export const certifications: Certification[] = [
  { name: 'Scrum Master Professional Certificate', code: 'SMPC', issuer: 'CertiProf', date: { es: 'Dic 2024', en: 'Dec 2024' } },
]
