import { AnimatePresence, motion } from 'motion/react'
import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2, Plus, RotateCcw, Save, Trash2, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { cn } from '@/lib/utils'
import { CATEGORIES, TECH_ICONS, techIcon, type CategoryId, type StackData, type TechRecord } from '@/data/technologies'
import { api, toast } from '../api'
import { Card, Confirm, PageHead, Toggle, btnGhost, btnPrimary, field, label } from '../ui'

type Editing = { category: CategoryId; item: TechRecord }
const blank = (): TechRecord => ({ id: '', name: '', icon: 'CodeXml', note: { es: '', en: '' }, active: true })

export function StackPage({ tick }: { tick: number }) {
  const [stack, setStack] = useState<StackData | null>(null)
  const [edit, setEdit] = useState<Editing | null>(null)
  const [toDelete, setToDelete] = useState<{ category: CategoryId; item: TechRecord } | null>(null)
  const [askRestore, setAskRestore] = useState(false)

  useEffect(() => {
    api.get<{ stack: StackData }>('stack.php').then(({ data }) => data?.ok && setStack(data.stack))
  }, [tick])

  const call = async (body: Record<string, unknown>, okText?: string) => {
    const { data } = await api.post<{ stack: StackData }>('stack.php', body)
    if (!data?.ok) {
      toast('No se pudo guardar.')
      return false
    }
    setStack(data.stack)
    if (okText) toast(okText)
    return true
  }

  const total = stack ? Object.values(stack).flat() : []
  const visible = total.filter((t) => t.active).length

  return (
    <>
      <PageHead title="Stack tecnológico" sub={`Sección 04 del sitio. ${visible} de ${total.length} tecnologías visibles. Los cambios se ven al recargar la página.`} />

      {!stack ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {CATEGORIES.map((c) => {
            const items = stack[c.id] ?? []
            return (
              <Card key={c.id} className="!p-4 sm:!p-5">
                <header className="mb-3 flex items-center gap-3">
                  <c.icon size={18} className="text-cyan" />
                  <h2 className="flex-1 font-display text-[17px] font-semibold">{c.label.es}</h2>
                  <span className="hud !text-[9.5px] text-dim">
                    {items.filter((t) => t.active).length}/{items.length}
                  </span>
                  <button type="button" onClick={() => setEdit({ category: c.id, item: blank() })} className="grid size-9 place-items-center rounded-md border border-line-strong text-fg hover:border-cyan/60" aria-label={`Agregar en ${c.label.es}`}>
                    <Plus size={17} />
                  </button>
                </header>
                {items.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-line-strong px-3 py-5 text-center text-sm text-muted">Sin tecnologías en esta categoría.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {items.map((t, i) => {
                      const Icon = techIcon(t.icon)
                      return (
                        <li key={t.id} className={cn('flex items-center gap-3 py-2.5', !t.active && 'opacity-55')}>
                          <span className="grid size-9 shrink-0 place-items-center rounded-md border border-line text-muted">
                            <Icon size={16} strokeWidth={1.6} />
                          </span>
                          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEdit({ category: c.id, item: structuredClone(t) })}>
                            <span className="block truncate text-[15px] font-medium text-fg">{t.name}</span>
                            <span className="block truncate font-mono text-[11px] text-dim">{t.note.es || '—'}</span>
                          </button>
                          <div className="flex shrink-0 items-center">
                            <button type="button" className="hidden size-8 place-items-center text-muted hover:text-fg disabled:opacity-30 sm:grid" disabled={i === 0} onClick={() => call({ action: 'move', category: c.id, id: t.id, dir: -1 })} aria-label="Subir">
                              <ArrowUp size={15} />
                            </button>
                            <button type="button" className="hidden size-8 place-items-center text-muted hover:text-fg disabled:opacity-30 sm:grid" disabled={i === items.length - 1} onClick={() => call({ action: 'move', category: c.id, id: t.id, dir: 1 })} aria-label="Bajar">
                              <ArrowDown size={15} />
                            </button>
                            <Toggle on={t.active} onChange={(active) => call({ action: 'save', category: c.id, item: { ...t, active } }, active ? `${t.name} ahora se ve en el sitio.` : `${t.name} quedó oculto.`)} label={`Mostrar ${t.name}`} />
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Card>
            )
          })}
        </div>
      )}

      <button type="button" className={`${btnGhost} mt-6`} onClick={() => setAskRestore(true)}>
        <RotateCcw size={16} /> Restaurar el stack original
      </button>

      <AnimatePresence>
        {edit && (
          <Editor
            editing={edit}
            onClose={() => setEdit(null)}
            onDelete={() => {
              setToDelete(edit)
              setEdit(null)
            }}
            onSave={async (category, item) => {
              const ok = await call({ action: 'save', category, item }, item.id ? 'Tecnología actualizada.' : 'Tecnología agregada.')
              if (ok) setEdit(null)
            }}
          />
        )}
      </AnimatePresence>
      <Confirm
        open={Boolean(toDelete)}
        title={`¿Eliminar ${toDelete?.item.name ?? ''}?`}
        body="Si solo quieres ocultarla un tiempo, mejor usa el interruptor."
        confirm="Eliminar"
        danger
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && call({ action: 'delete', category: toDelete.category, id: toDelete.item.id }, 'Tecnología eliminada.')}
      />
      <Confirm open={askRestore} title="¿Restaurar el stack original?" body="Se reemplazan todas las tecnologías por las originales. Lo que agregaste o cambiaste aquí se pierde." confirm="Restaurar" danger onClose={() => setAskRestore(false)} onConfirm={() => call({ action: 'restoreSeed' }, 'Se restauró el stack original.')} />
    </>
  )
}

function Editor({ editing, onClose, onSave, onDelete }: { editing: Editing; onClose: () => void; onSave: (c: CategoryId, t: TechRecord) => Promise<void>; onDelete: () => void }) {
  const [category, setCategory] = useState<CategoryId>(editing.category)
  const [t, setT] = useState<TechRecord>(editing.item)
  const [busy, setBusy] = useState(false)
  const up = (p: Partial<TechRecord>) => setT((x) => ({ ...x, ...p }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    await onSave(category, { ...t, name: t.name.trim() })
    setBusy(false)
  }

  return (
    <motion.div className="fixed inset-0 z-[80] grid place-items-end bg-ink/70 backdrop-blur-sm sm:place-items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 30, opacity: 0 }}
        className="flex max-h-[92dvh] w-full flex-col rounded-t-2xl border border-line-strong bg-abyss sm:max-w-lg sm:rounded-2xl"
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="font-display text-lg font-semibold">{t.id ? 'Editar tecnología' : 'Nueva tecnología'}</h2>
          <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-md text-muted hover:text-fg" aria-label="Cerrar">
            <X size={20} />
          </button>
        </header>
        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <label className="block">
            <span className={label}>Nombre *</span>
            <input className={field} value={t.name} onChange={(e) => up({ name: e.target.value })} required maxLength={40} placeholder="C#" autoFocus={!t.id} />
          </label>
          <label className="block">
            <span className={label}>Descripción corta</span>
            <input className={field} value={t.note.es} onChange={(e) => up({ note: { ...t.note, es: e.target.value } })} maxLength={60} placeholder="Lenguaje principal" />
          </label>
          <label className="block">
            <span className={label}>Descripción en inglés (opcional)</span>
            <input className={field} value={t.note.en} onChange={(e) => up({ note: { ...t.note, en: e.target.value } })} maxLength={60} placeholder="Primary language" />
          </label>
          <label className="block">
            <span className={label}>Categoría</span>
            <select className={field} value={category} onChange={(e) => setCategory(e.target.value as CategoryId)}>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label.es}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend className={label}>Ícono</legend>
            <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
              {Object.entries(TECH_ICONS).map(([name, Icon]) => (
                <button key={name} type="button" title={name} onClick={() => up({ icon: name })} className={cn('grid aspect-square place-items-center rounded-md border transition-colors', t.icon === name ? 'border-cyan bg-cyan/15 text-cyan' : 'border-line text-muted hover:text-fg')} aria-pressed={t.icon === name}>
                  <Icon size={16} strokeWidth={1.6} />
                </button>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5">
            <span className="flex items-center gap-2 text-sm text-fg">{t.active ? <Eye size={16} /> : <EyeOff size={16} />} Visible en el sitio</span>
            <Toggle on={t.active} onChange={(active) => up({ active })} label="Visible en el sitio" />
          </label>
        </div>
        <footer className="flex gap-2 border-t border-line px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          {t.id && (
            <button type="button" onClick={onDelete} className="grid size-11 place-items-center rounded-lg border border-danger/40 text-danger hover:bg-danger/10" aria-label="Eliminar">
              <Trash2 size={17} />
            </button>
          )}
          <button type="button" className={btnGhost} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className={cn(btnPrimary, 'flex-1')} disabled={busy || !t.name.trim()}>
            {busy ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />} Guardar
          </button>
        </footer>
      </motion.form>
    </motion.div>
  )
}
