import { ArrowDown, ArrowUp, Check, Loader2, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { TONE_ORDER, TONES, type Tone } from '@/data/programs'
import type { L } from '@/i18n'
import { ICONS, iconOf, type ProgramItem } from '@/lib/content'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { toast } from '../store'
import { ConfirmModal, PageHead, field, labelCls } from '../ui'
import { deleteContent, listContent, orderContent, saveContent, uploadContentImage } from '../content'
import { EnToggle, ItemActions, LField, PhotoPicker, Section, StatusBadge, moved } from '../contentUi'

/* Levels (Párvulos…Transición) and extra programmes (Artes, Inglés…) shown in "Un lugar para cada etapa". */

type Draft = Omit<ProgramItem, 'id' | 'img' | 'thumb'> & { id?: string; img?: string; thumb?: string }
const empty = (): L => ({ es: '', en: '' })
const newDraft = (grade: boolean): Draft => ({
  active: true,
  grade,
  icon: grade ? 'Baby' : 'Star',
  tone: 'pink',
  title: empty(),
  level: empty(),
  short: empty(),
  detail: empty(),
  includes: [empty()],
  alt: empty(),
})
const TONE_NAMES: Record<Tone, string> = { pink: 'Fucsia', yellow: 'Amarillo', indigo: 'Azul Gabush', blue: 'Celeste', green: 'Verde', orange: 'Naranja' }

/** "Incluye": a short list of what the level / programme offers. */
function IncludesEditor({ value, onChange, showEn }: { value: L[]; onChange: (v: L[]) => void; showEn: boolean }) {
  const set = (i: number, v: L) => onChange(value.map((x, k) => (k === i ? v : x)))
  const mv = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= value.length) return
    const next = [...value]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  return (
    <div>
      <p className={labelCls}>Incluye</p>
      <ul className="space-y-2">
        {value.map((x, i) => (
          <li key={i} className="rounded-xl bg-paper p-2">
            <div className="flex items-center gap-1.5">
              <Check size={16} strokeWidth={3} className="shrink-0 text-leaf" />
              <input className={cn(field, '!min-h-[42px] !py-2')} value={x.es} maxLength={70} placeholder="Ej.: Música y movimiento" onChange={(e) => set(i, { ...x, es: e.target.value })} aria-label={`Elemento ${i + 1}`} />
              <button type="button" onClick={() => mv(i, -1)} disabled={i === 0} title="Subir" className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-white disabled:opacity-30">
                <ArrowUp size={15} />
              </button>
              <button type="button" onClick={() => mv(i, 1)} disabled={i === value.length - 1} title="Bajar" className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-white disabled:opacity-30">
                <ArrowDown size={15} />
              </button>
              <button type="button" onClick={() => onChange(value.filter((_, k) => k !== i))} title="Quitar" className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-white hover:text-berry">
                <X size={16} />
              </button>
            </div>
            {showEn && (
              <div className="mt-1.5 flex items-center gap-1.5 pl-6">
                <span className="rounded bg-[#eeedfb] px-1.5 py-0.5 text-[11px] font-bold text-royal">EN</span>
                <input className={cn(field, '!min-h-[38px] !py-1.5 text-[15px]')} value={x.en} maxLength={70} placeholder="(opcional)" onChange={(e) => set(i, { ...x, en: e.target.value })} aria-label={`Elemento ${i + 1} (inglés)`} />
              </div>
            )}
          </li>
        ))}
      </ul>
      {value.length < 12 && (
        <button type="button" onClick={() => onChange([...value, empty()])} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-royal hover:underline">
          <Plus size={16} /> Agregar elemento
        </button>
      )}
    </div>
  )
}

function Editor({ draft, onClose, onSaved }: { draft: Draft | null; onClose: () => void; onSaved: (it: ProgramItem, isNew: boolean) => void }) {
  const [d, setD] = useState<Draft>(newDraft(true))
  const [file, setFile] = useState<File | null>(null)
  const [showEn, setShowEn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  useEffect(() => {
    if (!draft) return
    setD({ ...draft, includes: draft.includes.length ? draft.includes : [empty()] })
    setFile(null)
    setErrors([])
    setShowEn(Boolean(draft.title.en))
  }, [draft])
  const up = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }))
  const tone = TONES[d.tone]

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const { img: _img, thumb: _thumb, ...rest } = d
    const res = await saveContent('programs', { ...rest, includes: d.includes.filter((x) => x.es.trim()) })
    if (!res.item) {
      setBusy(false)
      if (res.fields) {
        setErrors(res.fields)
        document.getElementById(res.fields.includes('title') ? 'p-title' : 'p-short')?.focus()
      }
      return
    }
    let item = res.item
    if (file) item = (await uploadContentImage('programs', item.id, file)) ?? item
    setBusy(false)
    onSaved(item, !d.id)
    toast(d.id ? 'Cambios guardados' : '¡Agregado a la página!')
  }

  return (
    <Modal open={Boolean(draft)} onClose={onClose} label={d.id ? 'Editar' : 'Nuevo'} closeLabel="Cerrar" className="w-full sm:!max-w-4xl">
      <form onSubmit={submit} noValidate className="p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3 pr-10">
          <h2 className="text-2xl">{d.id ? `Editar: ${d.title.es || 'sin título'}` : d.grade ? 'Nuevo nivel' : 'Nuevo programa'}</h2>
          <EnToggle on={showEn} onChange={setShowEn} />
        </div>

        <div className="mt-5 grid gap-6 md:grid-cols-[0.9fr_1.1fr]">
          {/* left: look */}
          <div className="space-y-5">
            <div>
              <p className={labelCls}>¿Dónde aparece?</p>
              <div role="group" className="grid grid-cols-2 gap-2">
                {[
                  [true, 'Nivel', 'Fila principal con edad'],
                  [false, 'Programa adicional', 'En “Y además…”'],
                ].map(([v, t, s]) => (
                  <button key={String(v)} type="button" aria-pressed={d.grade === v} onClick={() => up({ grade: v as boolean })} className={cn('rounded-2xl border-2 p-3 text-left', d.grade === v ? 'border-royal bg-[#eeedfb]' : 'border-line')}>
                    <span className="block font-semibold text-ink">{t as string}</span>
                    <span className="block text-xs text-muted">{s as string}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className={labelCls}>Foto</p>
              <PhotoPicker current={d.img} file={file} onFile={setFile} />
            </div>

            <div>
              <p className={labelCls}>Color</p>
              <div className="flex flex-wrap gap-2">
                {TONE_ORDER.map((t) => (
                  <button key={t} type="button" onClick={() => up({ tone: t })} aria-pressed={d.tone === t} title={TONE_NAMES[t]} className={cn('grid size-10 place-items-center rounded-full text-white ring-offset-2', d.tone === t && 'ring-2 ring-ink')} style={{ background: TONES[t].solid }}>
                    {d.tone === t && <Check size={18} strokeWidth={3} className={t === 'yellow' ? 'text-ink' : ''} />}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className={labelCls}>Ícono</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(ICONS).map(([name, Icon]) => (
                  <button key={name} type="button" onClick={() => up({ icon: name })} aria-pressed={d.icon === name} title={name} className={cn('grid size-10 place-items-center rounded-xl border-2', d.icon === name ? 'text-white' : 'border-line text-muted hover:text-ink')} style={d.icon === name ? { background: tone.solid, borderColor: tone.solid } : undefined}>
                    <Icon size={19} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* right: texts */}
          <div className="space-y-4">
            <LField id="p-title" label="Nombre" value={d.title} onChange={(title) => up({ title })} showEn={showEn} max={60} required placeholder="Ej.: Párvulos" error={errors.includes('title') ? 'Escribe el nombre.' : undefined} />
            {d.grade && <LField id="p-level" label="Edad" value={d.level} onChange={(level) => up({ level })} showEn={showEn} max={40} placeholder="Ej.: 2 a 3 años" />}
            <LField id="p-short" label="Resumen (se ve en la tarjeta)" value={d.short} onChange={(short) => up({ short })} showEn={showEn} max={120} required placeholder="Una frase corta" error={errors.includes('short') ? 'Escribe un resumen corto.' : undefined} />
            <LField id="p-detail" label="Descripción (se ve al tocar “Ver detalle”)" value={d.detail} onChange={(detail) => up({ detail })} showEn={showEn} max={900} rows={5} />
            <IncludesEditor value={d.includes} onChange={(includes) => up({ includes })} showEn={showEn} />
            <LField id="p-alt" label="Descripción de la foto" value={d.alt} onChange={(alt) => up({ alt })} showEn={showEn} max={200} hint="Opcional: la leen los lectores de pantalla y Google." />
            <label className="flex items-center gap-3 font-semibold text-ink">
              <input type="checkbox" checked={d.active} onChange={(e) => up({ active: e.target.checked })} className="size-5 accent-[#3a36a8]" />
              Activo (se ve en la página)
            </label>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Cancelar
          </button>
          <button type="submit" disabled={busy} className="btn btn-primary disabled:opacity-70">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Guardar
          </button>
        </div>
      </form>
    </Modal>
  )
}

function Row({ p, i, n, onMove, onToggle, onEdit, onDelete }: { p: ProgramItem; i: number; n: number; onMove: (d: number) => void; onToggle: () => void; onEdit: () => void; onDelete: () => void }) {
  const tone = TONES[p.tone] ?? TONES.pink
  const Icon = iconOf(p.icon)
  const src = p.thumb ?? p.img
  return (
    <li className={cn('card flex min-w-0 flex-wrap items-center gap-3 p-3 sm:flex-nowrap', !p.active && 'opacity-60')}>
      <button type="button" onClick={onEdit} className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl sm:size-20" style={{ background: tone.soft }} title="Editar">
        {src ? <img src={src} alt="" loading="lazy" className="size-full object-cover" /> : <Icon size={28} style={{ color: tone.solid }} />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate font-serif text-lg font-semibold" style={{ color: tone.text }}>
          <Icon size={17} className="shrink-0" /> {p.title.es}
        </p>
        <p className="truncate text-sm text-muted">{[p.level?.es, p.short.es].filter(Boolean).join(' · ')}</p>
        <p className="mt-1 flex flex-wrap items-center gap-1.5">
          <StatusBadge active={p.active} />
          <span className="text-xs text-muted">{p.includes.length} en “Incluye”</span>
        </p>
      </div>
      {/* phones: the buttons get their own row so the name has room */}
      <div className="flex w-full justify-end border-t border-line pt-2 sm:w-auto sm:border-0 sm:pt-0">
        <ItemActions first={i === 0} last={i === n - 1} active={p.active} onUp={() => onMove(-1)} onDown={() => onMove(1)} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />
      </div>
    </li>
  )
}

export function ProgramsAdminPage() {
  const [items, setItems] = useState<ProgramItem[] | null>(null)
  const [editing, setEditing] = useState<Draft | null>(null)
  const [deleting, setDeleting] = useState<ProgramItem | null>(null)

  useEffect(() => {
    listContent('programs').then((x) => setItems(x ?? []))
  }, [])

  /** reorder inside its group (levels / extra programmes), keeping the other group in place */
  const move = async (grade: boolean, i: number, d: number) => {
    if (!items) return
    const group = moved(
      items.filter((x) => x.grade === grade),
      i,
      d,
    )
    const next = grade ? [...group, ...items.filter((x) => !x.grade)] : [...items.filter((x) => x.grade), ...group]
    setItems(next)
    await orderContent('programs', next.map((x) => x.id))
  }
  const toggle = async (p: ProgramItem) => {
    const res = await saveContent('programs', { ...p, active: !p.active })
    if (res.item) {
      setItems((xs) => xs?.map((x) => (x.id === p.id ? res.item! : x)) ?? null)
      toast(res.item.active ? 'Visible en la página' : 'Inactivo: ya no se ve en la página')
    }
  }
  const remove = async (p: ProgramItem) => {
    if (await deleteContent('programs', p.id)) {
      setItems((xs) => xs?.filter((x) => x.id !== p.id) ?? null)
      toast('Eliminado')
    }
  }

  const group = (grade: boolean) => {
    const list = (items ?? []).filter((x) => x.grade === grade)
    if (!list.length) return <p className="rounded-2xl bg-white p-5 text-sm text-muted">Todavía no hay {grade ? 'niveles' : 'programas adicionales'}.</p>
    return (
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {list.map((p, i) => (
          <Row key={p.id} p={p} i={i} n={list.length} onMove={(d) => move(grade, i, d)} onToggle={() => toggle(p)} onEdit={() => setEditing({ ...p })} onDelete={() => setDeleting(p)} />
        ))}
      </ul>
    )
  }

  return (
    <div>
      <PageHead title="Niveles y programas" sub="Lo que se ve en “Un lugar para cada etapa”: tarjetas, edades, descripción, lo que incluye y la foto. Inactivar lo oculta sin borrarlo." />
      {items === null ? (
        <p className="mt-8 flex items-center gap-2 text-muted">
          <Loader2 size={18} className="animate-spin" /> Cargando…
        </p>
      ) : (
        <>
          <Section
            title="Niveles"
            sub="Fila principal (Párvulos, Prejardín…), con edad."
            actions={
              <button type="button" onClick={() => setEditing(newDraft(true))} className="btn btn-primary !min-h-11 !text-[15px]">
                <Plus size={18} /> Nuevo nivel
              </button>
            }
          >
            {group(true)}
          </Section>
          <Section
            title="Programas adicionales"
            sub="Aparecen debajo, en “Y además…” (Artes, Inglés, Vacaciones…)."
            actions={
              <button type="button" onClick={() => setEditing(newDraft(false))} className="btn btn-ghost !min-h-11 !text-[15px]">
                <Plus size={18} /> Nuevo programa
              </button>
            }
          >
            {group(false)}
          </Section>
        </>
      )}

      <Editor
        draft={editing}
        onClose={() => setEditing(null)}
        onSaved={(it, isNew) => {
          setItems((xs) => (isNew ? [...(xs ?? []), it] : (xs ?? []).map((x) => (x.id === it.id ? it : x))))
          setEditing(null)
        }}
      />
      <ConfirmModal
        open={Boolean(deleting)}
        title={`¿Eliminar “${deleting?.title.es ?? ''}”?`}
        confirmLabel="Sí, eliminar"
        tone="danger"
        icon={<Trash2 size={24} />}
        onConfirm={async () => {
          if (deleting) await remove(deleting)
        }}
        onClose={() => setDeleting(null)}
      >
        Desaparece de la página y del formulario de inscripción. Si es temporal, mejor usa <b>Inactivar</b> (el ojo).
      </ConfirmModal>
    </div>
  )
}
