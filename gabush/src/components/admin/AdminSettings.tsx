import { AlertTriangle, Check, Clock, Flag, Loader2, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useLang, useT } from '@/i18n'
import { ui } from '@/i18n/ui'
import { cn } from '@/lib/utils'
import { parseYMD, todayYMD, weekdayLong } from '@/lib/dates'
import { summarizeSchedule } from '@/lib/schedule'
import { closeSchedule, openSchedule, saveSchedule, syncHolidays, useCalendar, type Schedule } from '@/lib/calendar'
import { Modal } from '@/components/ui/Modal'

const time = 'h-10 min-w-0 rounded-lg border border-[#d6d8ec] bg-white px-2 text-[15px] text-text outline-none focus:border-royal'

/** Two cards inside the admin panel: opening hours + Colombian holiday sync. */
export function AdminSettings() {
  const t = useT()
  const { lang } = useLang()
  const schedule = useCalendar((s) => s.schedule)
  const thisYear = parseYMD(todayYMD()).y
  const [year, setYear] = useState(thisYear)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ added: number; existing: number; year: number } | 'error' | null>(null)
  const lines = summarizeSchedule(schedule, lang)

  const sync = async () => {
    setBusy(true)
    setResult(null)
    const r = await syncHolidays(year)
    setResult(r ? { ...r, year } : 'error')
    setBusy(false)
  }

  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2">
      <div className="rounded-xl border border-line p-4">
        <p className="flex items-center gap-2 font-serif text-lg font-semibold text-ink">
          <Clock size={18} className="text-royal" /> {t(ui.admin.schedule.title)}
        </p>
        <ul className="mt-2 space-y-1 text-[14px] text-text/85">
          {lines.length ? lines.map((l) => <li key={l}>{l}</li>) : <li>{t(ui.admin.schedule.none)}</li>}
        </ul>
        <button type="button" onClick={openSchedule} className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold text-ink hover:border-ink">
          {t(ui.admin.schedule.edit)}
        </button>
      </div>

      <div className="rounded-xl border border-line p-4">
        <p className="flex items-center gap-2 font-serif text-lg font-semibold text-ink">
          <Flag size={18} className="text-red-600" /> {t(ui.admin.holidays.title)}
        </p>
        <p className="mt-2 text-[13.5px] leading-snug text-muted">{t(ui.admin.holidays.sub)}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="hol-year">
            {t(ui.admin.holidays.year)}
          </label>
          <select id="hol-year" value={year} onChange={(e) => setYear(Number(e.target.value))} className={time}>
            {[thisYear - 1, thisYear, thisYear + 1, thisYear + 2].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button type="button" disabled={busy} onClick={sync} className="inline-flex h-10 items-center gap-2 rounded-lg bg-ink px-3 text-sm font-semibold text-white hover:bg-royal disabled:opacity-70">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            {t(busy ? ui.admin.holidays.syncing : ui.admin.holidays.sync)}
          </button>
        </div>
        {result === 'error' && (
          <p role="alert" className="mt-2 flex items-center gap-1.5 text-sm font-medium text-berry">
            <AlertTriangle size={15} /> {t(ui.admin.generic)}
          </p>
        )}
        {result && result !== 'error' && (
          <p role="status" className="mt-2 flex items-center gap-1.5 text-sm font-medium text-leaf">
            <Check size={15} /> {result.year}: {result.added} {t(ui.admin.holidays.done)}
            {result.existing > 0 && ` · ${result.existing} ${t(ui.admin.holidays.existing)}`}
          </p>
        )}
      </div>
    </div>
  )
}

/** Weekly opening-hours editor (modal). */
export function ScheduleEditor() {
  const t = useT()
  const { lang } = useLang()
  const open = useCalendar((s) => s.scheduleOpen)
  const saved = useCalendar((s) => s.schedule)
  const [draft, setDraft] = useState<Schedule>(saved)
  const [bad, setBad] = useState<number[]>([])
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setDraft(structuredClone(saved))
      setBad([])
      setFailed(false)
    }
  }, [open, saved])

  const upDay = (i: number, fn: (d: Schedule['days'][number]) => Schedule['days'][number]) => setDraft((s) => ({ days: s.days.map((d, j) => (j === i ? fn(d) : d)) }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const wrong = draft.days.flatMap((d, i) => (d.open && (!d.slots.length || d.slots.some((s) => !s.from || !s.to || s.from >= s.to)) ? [i] : []))
    setBad(wrong)
    if (wrong.length) return
    setBusy(true)
    const r = await saveSchedule(draft)
    setBusy(false)
    if (r?.error === 'validation') setBad(r.days ?? [])
    else if (r?.error === 'generic') setFailed(true)
  }

  return (
    <Modal open={open} onClose={closeSchedule} label={t(ui.admin.schedule.title)} closeLabel={t(ui.programs.close)}>
      <form onSubmit={submit} noValidate className="p-6 sm:p-8">
        <h2 className="pr-12 text-[1.8rem]">{t(ui.admin.schedule.title)}</h2>
        <p className="mt-1 text-[15px] text-muted">{t(ui.admin.schedule.sub)}</p>

        <ul className="mt-6 divide-y divide-line border-y border-line">
          {draft.days.map((d, i) => (
            <li key={i} className={cn('grid gap-3 py-3.5 sm:grid-cols-[150px_1fr] sm:items-start', bad.includes(i) && 'bg-[#fdf0ef]')}>
              <label className="flex h-10 items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={d.open}
                  onChange={(e) => upDay(i, (x) => ({ open: e.target.checked, slots: e.target.checked && !x.slots.length ? [{ from: '08:00', to: '12:00' }] : x.slots }))}
                  className="size-5 accent-[#3a36a8]"
                />
                <span className="font-semibold text-ink capitalize">{weekdayLong(i, lang)}</span>
              </label>

              {d.open ? (
                <div className="space-y-2">
                  {d.slots.map((s, k) => (
                    <div key={k} className="flex items-center gap-2">
                      <input type="time" aria-label={`${weekdayLong(i, lang)} — ${t(ui.admin.schedule.from)}`} value={s.from} onChange={(e) => upDay(i, (x) => ({ ...x, slots: x.slots.map((y, z) => (z === k ? { ...y, from: e.target.value } : y)) }))} className={cn(time, 'flex-1')} />
                      <span className="text-muted">–</span>
                      <input type="time" aria-label={`${weekdayLong(i, lang)} — ${t(ui.admin.schedule.to)}`} value={s.to} onChange={(e) => upDay(i, (x) => ({ ...x, slots: x.slots.map((y, z) => (z === k ? { ...y, to: e.target.value } : y)) }))} className={cn(time, 'flex-1')} />
                      <button type="button" aria-label={t(ui.admin.schedule.removeSlot)} onClick={() => upDay(i, (x) => ({ ...x, slots: x.slots.filter((_, z) => z !== k) }))} className="grid size-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-paper hover:text-berry">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  {d.slots.length < 3 && (
                    <button type="button" onClick={() => upDay(i, (x) => ({ ...x, slots: [...x.slots, { from: '14:00', to: '17:00' }] }))} className="inline-flex items-center gap-1.5 text-sm font-semibold text-royal hover:underline">
                      <Plus size={15} /> {t(ui.admin.schedule.addSlot)}
                    </button>
                  )}
                </div>
              ) : (
                <p className="flex h-10 items-center text-[15px] text-muted">{t(ui.admin.schedule.closed)}</p>
              )}
            </li>
          ))}
        </ul>

        {(bad.length > 0 || failed) && (
          <p role="alert" className="mt-4 flex items-start gap-2 text-sm font-medium text-berry">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {t(failed ? ui.admin.form.errGeneric : ui.admin.schedule.invalid)}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={closeSchedule} className="btn btn-ghost">
            <X size={18} /> {t(ui.admin.form.cancel)}
          </button>
          <button type="submit" disabled={busy} className="btn btn-primary disabled:opacity-70">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
            {t(ui.admin.schedule.save)}
          </button>
        </div>
      </form>
    </Modal>
  )
}
