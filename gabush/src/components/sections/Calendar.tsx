import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight, Clock, Plus } from 'lucide-react'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useLang, useT } from '@/i18n'
import { ui } from '@/i18n/ui'
import { cn } from '@/lib/utils'
import { dayDiff, formatDay, monthGrid, ymd, monthName, nowHHMM, parseYMD, tint, todayYMD, weekdayIndex, weekdayShort } from '@/lib/dates'
import { dayStatus, formatSlots, openAt } from '@/lib/schedule'
import { eventsOn, loadEvents, newDraft, openEditor, useCalendar, type CalEvent, type Schedule } from '@/lib/calendar'
import { FadeIn } from '@/components/animations'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { EventItem } from '@/components/calendar/EventItem'

const FESTIVO_BG = '#fee2e2'
const CLOSED_BG = '#eceef3'

/** Light background for a day: light red for holidays, otherwise a tint of the first event colour. */
function dayStyle(evs: CalEvent[]): CSSProperties | undefined {
  if (!evs.length) return undefined
  return { background: evs[0].type === 'festivo' ? FESTIVO_BG : tint(evs[0].color, 0.13) }
}

function MonthGrid({ y, m, events, schedule, today, selected, admin, onSelect }: { y: number; m: number; events: CalEvent[]; schedule: Schedule; today: string; selected: string; admin: boolean; onSelect: (d: string) => void }) {
  const t = useT()
  const { lang } = useLang()
  // only the weeks this month needs (4–6 rows); days of other months stay empty
  const cells = useMemo(() => {
    const all = monthGrid(y, m)
    return Array.from({ length: 6 }, (_, w) => all.slice(w * 7, w * 7 + 7))
      .filter((week) => week.some((c) => c.inMonth))
      .flat()
  }, [y, m])
  return (
    <div>
      <div className="grid grid-cols-7 border-b border-line pb-2 text-center text-[12px] font-semibold tracking-wide text-muted uppercase">
        {weekdayShort(lang).map((w) => (
          <span key={w}>{w.slice(0, 3)}</span>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-line bg-line">
        {cells.map(({ date, inMonth }, i) => {
          if (!inMonth) return <div key={date} aria-hidden className="min-h-[54px] bg-[#fbfbfd] sm:min-h-[96px]" />
          const evs = eventsOn(events, date)
          const isToday = date === today
          const isSel = date === selected
          const festivo = evs[0]?.type === 'festivo'
          const weekStart = i % 7 === 0
          const closed = !schedule.days[i % 7]?.open
          return (
            <div
              key={date}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(date)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(date)
                }
              }}
              aria-pressed={isSel}
              aria-label={`${formatDay(date, lang, true)}${evs.length ? ` — ${evs.map((e) => e.title).join(', ')}` : ''}`}
              className={cn(
                'relative flex min-h-[54px] cursor-pointer flex-col items-stretch gap-1 bg-white p-1 text-left transition-colors sm:min-h-[96px] sm:p-1.5',
                isSel ? 'z-10 outline-2 -outline-offset-2 outline-royal' : 'hover:bg-[#f8f9fc]',
              )}
              style={dayStyle(evs) ?? (closed ? { background: CLOSED_BG } : undefined)}
            >
              <span
                className={cn(
                  'grid size-7 place-items-center self-center rounded-full text-[14px] font-semibold sm:self-start',
                  festivo ? 'text-red-700' : closed ? 'text-muted' : 'text-ink',
                  isToday && '!bg-ink !text-white',
                )}
              >
                {parseYMD(date).d}
              </span>

              {evs.length > 0 && (
                <>
                  {/* phones: dots */}
                  <span className="flex justify-center gap-0.5 sm:hidden">
                    {evs.slice(0, 3).map((e) => (
                      <span key={e.id} className="size-1.5 rounded-full" style={{ background: e.color }} />
                    ))}
                  </span>
                  {/* desktop: continuous bars, labelled where the event starts (or each new week / month) */}
                  <span className="hidden flex-col gap-0.5 sm:flex">
                    {evs.slice(0, 2).map((e) => {
                      const first = e.start === date || weekStart || parseYMD(date).d === 1
                      // the label may run across the rest of the week the event covers
                      const span = Math.min(dayDiff(date, e.end), 6 - (i % 7)) + 1
                      const cls = cn('relative block h-[18px] w-auto', e.start === date && 'rounded-l', e.end === date && 'rounded-r', e.start !== date && '-ml-1.5', e.end !== date && '-mr-1.5')
                      const label = first && (
                        <span className="pointer-events-none absolute inset-y-0 left-1.5 z-20 truncate text-left text-[11px] leading-[18px] font-semibold text-white" style={{ width: `calc(${span * 100}% + ${span - 1}px - 12px)` }}>
                          {e.visibility === 'privado' && '🔒 '}
                          {e.title}
                        </span>
                      )
                      // private events: diagonal stripes so they are told apart at a glance
                      const barStyle = { background: e.visibility === 'privado' ? `repeating-linear-gradient(135deg, ${e.color} 0 6px, ${tint(e.color, 0.7)} 6px 12px)` : e.color }
                      // admin: clicking the bar opens the editor for that event
                      return admin && !e.readonly ? (
                        <button
                          key={e.id}
                          type="button"
                          title={`${t(ui.admin.edit)}: ${e.title}`}
                          aria-label={`${t(ui.admin.edit)}: ${e.title}`}
                          onClick={(ev) => {
                            ev.stopPropagation()
                            openEditor(e)
                          }}
                          className={cn(cls, 'cursor-pointer hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink')}
                          style={barStyle}
                        >
                          {label}
                        </button>
                      ) : (
                        <span key={e.id} className={cls} style={barStyle}>
                          {label}
                        </span>
                      )
                    })}
                    {evs.length > 2 && <span className="px-1 text-[11px] font-medium text-muted">+{evs.length - 2}</span>}
                  </span>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MiniMonth({ y, m, events, schedule, today, onOpen }: { y: number; m: number; events: CalEvent[]; schedule: Schedule; today: string; onOpen: () => void }) {
  const { lang } = useLang()
  const cells = useMemo(() => monthGrid(y, m), [y, m])
  return (
    <button type="button" onClick={onOpen} className="group rounded-xl border border-line bg-white p-3 text-left transition-shadow hover:shadow-[0_12px_28px_-20px_rgba(35,32,107,0.5)]">
      <p className="mb-2 font-serif text-[17px] font-semibold text-ink capitalize group-hover:text-royal">{monthName(y, m, lang)}</p>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[11px]">
        {cells.map(({ date, inMonth }) => {
          if (!inMonth) return <span key={date} />
          const evs = eventsOn(events, date)
          const closed = !schedule.days[weekdayIndex(date)]?.open
          return (
            <span
              key={date}
              className={cn('grid aspect-square place-items-center rounded', evs[0]?.type === 'festivo' ? 'font-semibold text-red-700' : closed ? 'text-muted' : 'text-text', date === today && '!bg-ink font-semibold !text-white')}
              style={evs.length ? { background: evs[0].type === 'festivo' ? FESTIVO_BG : tint(evs[0].color, 0.22) } : closed ? { background: CLOSED_BG } : undefined}
            >
              {parseYMD(date).d}
            </span>
          )
        })}
      </div>
    </button>
  )
}

/** Public calendar section; `embedded` drops the section header and spacing (admin panel). */
export function Calendar({ embedded = false }: { embedded?: boolean }) {
  const t = useT()
  const { lang } = useLang()
  const events = useCalendar((s) => s.events)
  const loaded = useCalendar((s) => s.loaded)
  const failed = useCalendar((s) => s.failed)
  const admin = useCalendar((s) => s.admin)
  const schedule = useCalendar((s) => s.schedule)

  const today = todayYMD()
  const now = parseYMD(today)
  const [view, setView] = useState<'month' | 'year'>('month')
  const [cursor, setCursor] = useState({ y: now.y, m: now.m })
  const [dir, setDir] = useState(1)
  const [selected, setSelected] = useState(today)

  useEffect(() => {
    loadEvents()
  }, [])

  const move = (n: number) => {
    setDir(n)
    if (view === 'year') return setCursor(({ y, m }) => ({ y: y + n, m }))
    const d = new Date(Date.UTC(cursor.y, cursor.m + n, 1))
    const next = { y: d.getUTCFullYear(), m: d.getUTCMonth() }
    setCursor(next)
    // keep the side panel on the month being shown: today in the current month, otherwise the 1st
    setSelected(next.y === now.y && next.m === now.m ? today : ymd(next.y, next.m, 1))
  }
  const goToday = () => {
    setDir(0)
    setCursor({ y: now.y, m: now.m })
    setSelected(today)
  }

  const dayEvents = eventsOn(events, selected)
  const status = dayStatus(schedule, events, selected)
  const openNow = selected === today && status.open && openAt(status.slots, nowHHMM())
  // only the month on screen: from today in the current month, the whole month otherwise
  const monthStart = ymd(cursor.y, cursor.m, 1)
  const monthEnd = ymd(cursor.y, cursor.m, new Date(Date.UTC(cursor.y, cursor.m + 1, 0)).getUTCDate())
  const from = today > monthStart ? today : monthStart
  const upcoming = from > monthEnd ? [] : events.filter((e) => e.end >= from && e.start <= monthEnd)

  return (
    <section id={embedded ? undefined : 'calendario'} className={embedded ? '' : 'relative py-20 sm:py-28'}>
      <div className={embedded ? '' : 'container-x'}>
        {!embedded && <SectionHeader kicker={ui.calendar.kicker} title={ui.calendar.title} sub={ui.calendar.sub} mascot="tigre" />}

        <div className={cn(!embedded && 'mt-12', 'grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start')}>
          {/* calendar */}
          <FadeIn className="card min-w-0 p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => move(-1)} aria-label={t(view === 'year' ? ui.calendar.prevYear : ui.calendar.prev)} className="grid size-10 place-items-center rounded-lg border border-line text-ink hover:border-ink">
                  <ChevronLeft size={20} />
                </button>
                <h3 aria-live="polite" className="min-w-[10.5rem] text-center text-2xl capitalize sm:min-w-[13rem] sm:text-[1.7rem]">
                  {view === 'year' ? cursor.y : `${monthName(cursor.y, cursor.m, lang)} ${cursor.y}`}
                </h3>
                <button type="button" onClick={() => move(1)} aria-label={t(view === 'year' ? ui.calendar.nextYear : ui.calendar.next)} className="grid size-10 place-items-center rounded-lg border border-line text-ink hover:border-ink">
                  <ChevronRight size={20} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={goToday} className="h-10 rounded-lg border border-line px-3 text-sm font-semibold text-ink hover:border-ink">
                  {t(ui.calendar.today)}
                </button>
                <div role="group" className="flex h-10 rounded-lg border border-line p-1">
                  {(['month', 'year'] as const).map((v) => (
                    <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={cn('rounded-md px-3 text-sm font-semibold transition-colors', view === v ? 'bg-ink text-white' : 'text-muted hover:text-ink')}>
                      {t(ui.calendar[v])}
                    </button>
                  ))}
                </div>
                {admin && (
                  <button type="button" onClick={() => openEditor(newDraft(selected))} className="btn btn-gold !min-h-10 !px-3 !text-sm">
                    <Plus size={17} /> <span className="hidden sm:inline">{t(ui.admin.newEvent)}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="mt-5 overflow-hidden">
              <AnimatePresence mode="wait" initial={false} custom={dir}>
                <motion.div
                  key={`${view}-${cursor.y}-${view === 'month' ? cursor.m : ''}`}
                  custom={dir}
                  initial={{ opacity: 0, x: dir * 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: dir * -40 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                >
                  {view === 'month' ? (
                    <MonthGrid y={cursor.y} m={cursor.m} events={events} schedule={schedule} today={today} selected={selected} admin={admin} onSelect={setSelected} />
                  ) : (
                    <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                      {Array.from({ length: 12 }, (_, m) => (
                        <MiniMonth
                          key={m}
                          y={cursor.y}
                          m={m}
                          events={events}
                          schedule={schedule}
                          today={today}
                          onOpen={() => {
                            setDir(0)
                            setCursor({ y: cursor.y, m })
                            setSelected(cursor.y === now.y && m === now.m ? today : ymd(cursor.y, m, 1))
                            setView('month')
                          }}
                        />
                      ))}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* legend */}
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
              <span className="inline-flex items-center gap-2">
                <span className="size-3.5 rounded" style={{ background: FESTIVO_BG, boxShadow: 'inset 0 0 0 1px #fca5a5' }} /> {t(ui.calendar.festivo)}
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="size-3.5 rounded bg-[#e8edf7]" style={{ boxShadow: 'inset 0 0 0 1px #c7d2ea' }} /> {t(ui.calendar.evento)}
              </span>
              {admin && (
                <span className="inline-flex items-center gap-2">
                  <span className="h-3.5 w-5 rounded" style={{ background: 'repeating-linear-gradient(135deg, #3a36a8 0 4px, #8a9cc4 4px 8px)' }} /> 🔒 {t({ es: 'Privado (solo tú)', en: 'Private (only you)' })}
                </span>
              )}
              <span className="inline-flex items-center gap-2">
                <span className="size-3.5 rounded" style={{ background: CLOSED_BG, boxShadow: 'inset 0 0 0 1px #d5d9e2' }} /> {t(ui.calendar.closed)}
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-full bg-ink text-[11px] font-semibold text-white">{now.d}</span> {t(ui.calendar.today)}
              </span>
              {!loaded && <span>{t(ui.calendar.loading)}</span>}
              {failed && <span className="text-berry">{t(ui.calendar.failed)}</span>}
            </div>
          </FadeIn>

          {/* side panel */}
          <div className="grid gap-6">
            <FadeIn delay={0.08} className="card p-5 sm:p-6">
              <p className="kicker">{t({ es: 'Día seleccionado', en: 'Selected day' })}</p>
              <h3 className="mt-2 text-xl first-letter:uppercase">{formatDay(selected, lang, true)}</h3>
              <div className={cn('mt-3 flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-[15px]', status.open ? 'bg-[#eeedfb] text-ink' : status.reason === 'festivo' ? 'bg-red-50 text-red-800' : 'bg-[#f1f2f5] text-muted')}>
                <Clock size={17} className="mt-0.5 shrink-0" />
                <div>
                  {status.open ? (
                    <>
                      <p className="font-semibold">{t(ui.calendar.hours)}</p>
                      <p>{formatSlots(status.slots, lang)}</p>
                      {selected === today && (
                        <p className={cn('mt-1.5 inline-flex items-center gap-1.5 text-sm font-semibold', openNow ? 'text-leaf' : 'text-muted')}>
                          <span className={cn('size-2 rounded-full', openNow ? 'bg-leaf' : 'bg-muted/60')} />
                          {t(openNow ? ui.calendar.openNow : ui.calendar.closedNow)}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="font-semibold">{status.reason === 'festivo' ? `${t(ui.calendar.closedHoliday)}${status.festivo ? ` · ${status.festivo.title}` : ''}` : t(ui.calendar.closedDay)}</p>
                  )}
                </div>
              </div>
              {dayEvents.length ? (
                <ul className="mt-1 divide-y divide-line">
                  {dayEvents.map((e) => (
                    <EventItem key={e.id} e={e} admin={admin} />
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[15px] text-muted">{t(ui.calendar.dayEmpty)}</p>
              )}
              {admin && (
                <button type="button" onClick={() => openEditor(newDraft(selected))} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-royal hover:underline">
                  <Plus size={16} /> {t(ui.calendar.addHere)}
                </button>
              )}
            </FadeIn>

            <FadeIn delay={0.14} className="card p-5 sm:p-6">
              <p className="kicker">
                {t(ui.calendar.upcoming)} · {monthName(cursor.y, cursor.m, lang)}
              </p>
              {upcoming.length ? (
                <ul className="mt-1 divide-y divide-line">
                  {upcoming.map((e) => (
                    <EventItem key={e.id} e={e} admin={admin} current={e.start <= today} />
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-[15px] text-muted">{loaded ? t(ui.calendar.noUpcoming) : t(ui.calendar.loading)}</p>
              )}
            </FadeIn>
          </div>
        </div>
      </div>
    </section>
  )
}
