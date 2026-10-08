import { Bell, BookOpenCheck, CalendarCheck, Download, LogIn, Wallet } from 'lucide-react'
import { FadeIn } from '@/components/animations'
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

        {/* phone preview of the portal */}
        <FadeIn className="mx-auto w-full max-w-[300px]">
          <div className="relative rounded-[2.6rem] bg-ink p-3 shadow-[0_40px_70px_-35px_rgba(35,32,107,0.9)]">
            <div className="absolute top-3 left-1/2 h-5 w-24 -translate-x-1/2 rounded-b-2xl bg-ink" />
            <div className="overflow-hidden rounded-[2rem] bg-paper">
              <div className="flex items-center gap-2.5 bg-white px-4 pt-8 pb-3">
                <img src="/images/opt/leon-asomado-160.webp" alt="" width={160} height={161} loading="lazy" className="size-9" />
                <span className="leading-tight">
                  <span className="block font-serif text-[15px] font-semibold text-ink">{t({ es: 'Hola, familia', en: 'Hi, family' })} 👋</span>
                  <span className="block text-[11px] font-bold text-muted uppercase">Gabush · {t({ es: 'Familias', en: 'Families' })}</span>
                </span>
              </div>
              <div className="space-y-2.5 p-3.5">
                <div className="rounded-2xl bg-white p-3.5">
                  <p className="text-[10px] font-bold tracking-wide text-muted uppercase">{t({ es: 'Pagos', en: 'Payments' })}</p>
                  <p className="font-serif text-lg font-semibold text-leaf">{t({ es: '¡Estás al día! 🎉', en: "You're up to date! 🎉" })}</p>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-2xl bg-white p-3">
                    <BookOpenCheck size={18} className="text-pink" />
                    <p className="mt-1 text-[12px] font-semibold text-ink">{t({ es: 'Boletín', en: 'Report card' })}</p>
                    <span className="mt-1 inline-block rounded-full bg-[#e6f6dd] px-2 py-0.5 text-[10px] font-bold text-leaf">Excelente</span>
                  </div>
                  <div className="rounded-2xl bg-white p-3">
                    <Bell size={18} className="text-sky" />
                    <p className="mt-1 text-[12px] font-semibold text-ink">{t({ es: 'Novedades', en: 'News' })}</p>
                    <span className="mt-1 inline-block text-[10px] font-bold text-pink">2 {t({ es: 'nuevas', en: 'new' })}</span>
                  </div>
                </div>
                <div className="rounded-2xl bg-white p-3">
                  <p className="text-[10px] font-bold tracking-wide text-muted uppercase">{t({ es: 'Asistencia', en: 'Attendance' })}</p>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-paper">
                    <div className="h-full w-[94%] rounded-full bg-leaf" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-4 border-t border-line bg-white py-2 text-center text-[9px] font-semibold text-muted">
                <span className="text-ink">{t({ es: 'Inicio', en: 'Home' })}</span>
                <span>{t({ es: 'Mensajes', en: 'Messages' })}</span>
                <span>{t({ es: 'Pagos', en: 'Payments' })}</span>
                <span>{t({ es: 'Notas', en: 'Grades' })}</span>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
