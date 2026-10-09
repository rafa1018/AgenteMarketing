import { Bell, BookOpenCheck, CalendarCheck, Download, LogIn, Wallet } from 'lucide-react'
import { FadeIn } from '@/components/animations'
import { PhoneDemo } from './PhoneDemo'
import { useT } from '@/i18n'

const FEATURES = [
  { icon: BookOpenCheck, es: 'Notas y boletín de cada periodo en PDF', en: 'Grades and each term report card as PDF', color: '#e5197e' },
  { icon: Wallet, es: 'Pensiones: paga en línea y descarga el comprobante', en: 'Tuition: pay online and download the receipt', color: '#f26b1d' },
  { icon: CalendarCheck, es: 'Asistencia, calendario y documentos', en: 'Attendance, calendar and documents', color: '#5cb531' },
  { icon: Bell, es: 'Avisos del jardín en tu celular', en: 'School notices on your phone', color: '#1fa3dd' },
]

/**
 * "App para familias": the installable family portal (/familia/). Kept apart from the staff panel (/admin/),
 * so parents install the right app.
 */
export function FamilyApp() {
  const t = useT()
  return (
    <section id="app-familias" aria-labelledby="app-familias-title" className="relative overflow-clip bg-cloud py-20 sm:py-24">
      <div className="container-x grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
        <FadeIn>
          <p className="inline-flex rounded-full bg-pink px-3 py-1 text-[13px] font-extrabold tracking-wide text-white uppercase">{t({ es: 'Para las familias', en: 'For families' })}</p>
          <h2 id="app-familias-title" className="mt-3 text-[clamp(2.1rem,4.6vw,3.2rem)] leading-tight">{t({ es: 'La app de Gabush para las familias', en: 'The Gabush app for families' })}</h2>
          <p className="mt-3 max-w-xl text-lg text-text">
            {t({ es: 'Todo lo de tu hijo o hija en un solo lugar. Entras con el documento del estudiante.', en: "Everything about your child in one place. Sign in with the student's ID number." })}
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <li key={f.es} className="flex items-start gap-3 rounded-2xl bg-white p-3.5 shadow-[0_10px_30px_-22px_rgba(35,32,107,0.6)]">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: f.color }}>
                  <f.icon size={20} />
                </span>
                <span className="text-[15px] font-semibold text-ink">{t({ es: f.es, en: f.en })}</span>
              </li>
            ))}
          </ul>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a href="/familia/?instalar=1" className="btn btn-primary">
              <Download size={20} /> {t({ es: 'Instalar la app de familias', en: 'Install the family app' })}
            </a>
            <a href="/familia/" className="btn btn-ghost">
              <LogIn size={20} /> {t({ es: 'Entrar al portal', en: 'Open the portal' })}
            </a>
          </div>
          <p className="mt-3 text-[13px] text-muted">
            {t({
              es: 'En iPhone: ábrela en Safari, toca Compartir y luego «Agregar a inicio». Es la app de las familias; el personal del jardín usa otra.',
              en: 'On iPhone: open it in Safari, tap Share and then "Add to Home Screen". This is the family app; school staff use a different one.',
            })}
          </p>
        </FadeIn>

        {/* animated tour of the app inside the phone (it has its own scroll entrance) */}
        <PhoneDemo />
      </div>
    </section>
  )
}
