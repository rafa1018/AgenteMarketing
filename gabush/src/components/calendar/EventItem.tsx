import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useLang, useT } from '@/i18n'
import { ui } from '@/i18n/ui'
import { dayDiff, formatRange } from '@/lib/dates'
import { deleteEvent, openEditor, type CalEvent } from '@/lib/calendar'

/** One event row: colour dot, title, dates, description — plus edit / delete for the admin. */
export function EventItem({ e, admin = false, current = false }: { e: CalEvent; admin?: boolean; current?: boolean }) {
  const t = useT()
  const { lang } = useLang()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const days = dayDiff(e.start, e.end) + 1

  const remove = async () => {
    setBusy(true)
    const ok = await deleteEvent(e.id)
    if (!ok) setBusy(false)
  }

  return (
    <li className="flex gap-3 py-3.5">
      <span aria-hidden className="mt-1.5 size-3 shrink-0 rounded-full ring-4" style={{ background: e.color, ['--tw-ring-color' as string]: `${e.color}26` }} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 leading-snug font-semibold text-ink">
          <span className="break-words">{e.title}</span>
          {e.visibility === 'privado' && <span className="inline-flex items-center gap-1 rounded bg-ink px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-white uppercase">🔒 {t({ es: 'Privado', en: 'Private' })}</span>}
          {admin && e.visibility !== 'privado' && e.type !== 'festivo' && <span className="rounded bg-[#eeedfb] px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-royal uppercase">{t({ es: 'Público', en: 'Public' })}</span>}
          {e.type === 'festivo' && <span className="rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-red-700 uppercase">{t(ui.calendar.festivo)}</span>}
          {current && <span className="rounded bg-[#eeedfb] px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-royal uppercase">{t({ es: 'En curso', en: 'Ongoing' })}</span>}
        </p>
        <p className="mt-0.5 text-sm text-muted first-letter:uppercase">
          {formatRange(e.start, e.end, lang)}
          {days > 1 && ` · ${days} ${t(ui.calendar.days)}`}
        </p>
        {e.description && <p className="mt-1 text-[15px] leading-snug break-words text-text/85">{e.description}</p>}

        {admin && e.readonly && <p className="mt-1 text-[12px] text-muted">{t({ es: 'Automático: sale de la fecha de nacimiento en la ficha del estudiante.', en: "Automatic: from the student's birth date." })}</p>}
        {admin &&
          !e.readonly &&
          (confirming ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium text-berry">{t(ui.admin.confirmDelete)}</span>
              <button type="button" disabled={busy} onClick={remove} className="rounded-md bg-berry px-2.5 py-1 font-semibold text-white disabled:opacity-60">
                {t(ui.admin.yes)}
              </button>
              <button type="button" onClick={() => setConfirming(false)} className="rounded-md border border-line px-2.5 py-1 font-medium text-ink">
                {t(ui.admin.no)}
              </button>
            </div>
          ) : (
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => openEditor(e)} className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-sm font-medium text-ink hover:border-ink">
                <Pencil size={14} /> {t(ui.admin.edit)}
              </button>
              <button type="button" onClick={() => setConfirming(true)} className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-sm font-medium text-berry hover:border-berry">
                <Trash2 size={14} /> {t(ui.admin.delete)}
              </button>
            </div>
          ))}
      </div>
    </li>
  )
}
