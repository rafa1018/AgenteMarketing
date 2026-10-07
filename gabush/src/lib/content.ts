import { Apple, Baby, Bike, Blocks, BookOpen, Drama, Globe2, GraduationCap, Heart, Music2, Palette, Puzzle, Smile, Sparkles, Star, Sun, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { L } from '@/i18n'
import type { Tone } from '@/data/programs'
import seed from '@/data/content-seed.json'

/*
 * Editable content of the public page (admin panel → Galería / Niveles), served by api/content.php.
 * Until something is edited the server returns the same seed this file imports, so the page looks the
 * same with or without the API (e.g. `npm run dev` without `npm run api`).
 */

export interface GalleryItem {
  id: string
  active: boolean
  caption: L
  alt: L
  /** large picture (~1280 px) and thumbnail (~640 px) */
  img: string
  thumb: string
}

export interface ProgramItem {
  id: string
  active: boolean
  /** true = level of the kindergarten (main row); false = extra programme ("Y además…") */
  grade: boolean
  icon: IconName
  tone: Tone
  title: L
  /** age, e.g. "2 a 3 años" (optional) */
  level: L
  short: L
  detail: L
  includes: L[]
  img: string
  thumb?: string
  alt: L
}

export type Collection = 'gallery' | 'programs'
type ItemOf<C extends Collection> = C extends 'gallery' ? GalleryItem : ProgramItem

/** Icons offered for levels / programmes (same list as ICONS in api/content.php). */
export const ICONS: Record<string, LucideIcon> = { Baby, Blocks, Palette, GraduationCap, Music2, Globe2, Sun, Heart, BookOpen, Star, Smile, Puzzle, Drama, Bike, Apple, Sparkles }
export type IconName = keyof typeof ICONS
export const iconOf = (name: string): LucideIcon => ICONS[name] ?? Star

export const SEED = seed as unknown as { gallery: GalleryItem[]; programs: ProgramItem[] }

/** English text falls back to Spanish when it was left empty in the panel. */
export const tr = (v: L | undefined, lang: 'es' | 'en') => (v ? (lang === 'en' && v.en.trim() ? v.en : v.es) : '')

const cache: Partial<Record<Collection, Promise<unknown[]>>> = {}

export function loadContent<C extends Collection>(c: C): Promise<ItemOf<C>[]> {
  const fallback = () => (SEED[c] as ItemOf<C>[]).filter((x) => x.active)
  cache[c] ??= fetch(`/api/content.php?c=${c}`, { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (d?.ok && Array.isArray(d.items) ? d.items : fallback()))
    .catch(fallback)
  return cache[c] as Promise<ItemOf<C>[]>
}

/** Active items in order; starts with the seed so the section never renders empty while loading. */
export function useContent<C extends Collection>(c: C): ItemOf<C>[] {
  const [items, setItems] = useState<ItemOf<C>[]>(() => (SEED[c] as ItemOf<C>[]).filter((x) => x.active))
  useEffect(() => {
    let alive = true
    loadContent(c).then((x) => alive && setItems(x))
    return () => {
      alive = false
    }
  }, [c])
  return items
}
