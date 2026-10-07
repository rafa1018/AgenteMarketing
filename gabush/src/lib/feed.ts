import { useEffect, useState } from 'react'

/**
 * "Momentos Gabush": an Instagram-style feed that is NOT connected to Instagram.
 * Posts are managed from the admin panel (/admin/#/feed) and served by /api/feed.php.
 */
export interface FeedPost {
  id: string
  caption: string
  /** 'YYYY-MM-DD' or '' */
  date: string
  /** square image ~1080 px */
  img: string
  /** square thumbnail ~480 px */
  thumb: string
  hidden?: boolean
}

/** Same posts the server starts with — used when the API is unreachable (e.g. `npm run dev` without `npm run api`). */
export const SEED_FEED: FeedPost[] = [
  { id: 'seed-01', caption: '¡Te invitamos a celebrar con nosotros el Día de la Independencia! 🇨🇴 Ponte tu camiseta.', date: '', img: '/images/feed/01-1080.webp', thumb: '/images/feed/01-480.webp' },
  { id: 'seed-02', caption: 'Gabush, nuestro león, vino a visitar a las profes 🦁💛', date: '', img: '/images/feed/02-1080.webp', thumb: '/images/feed/02-480.webp' },
  { id: 'seed-03', caption: 'En familia celebramos Amor y Amistad 💕 #gabushkids', date: '', img: '/images/feed/03-1080.webp', thumb: '/images/feed/03-480.webp' },
  { id: 'seed-04', caption: 'Show de magia, disfraces y muchas risas ✨🎩', date: '', img: '/images/feed/04-1080.webp', thumb: '/images/feed/04-480.webp' },
  { id: 'seed-05', caption: '¡Fiesta de colores en el jardín! 🎈🎉', date: '', img: '/images/feed/05-1080.webp', thumb: '/images/feed/05-480.webp' },
]

let cache: Promise<FeedPost[]> | null = null

export function loadFeed(): Promise<FeedPost[]> {
  cache ??= fetch('/api/feed.php')
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (d?.ok && Array.isArray(d.items) ? (d.items as FeedPost[]) : SEED_FEED))
    .catch(() => SEED_FEED)
  return cache
}

export function useFeed() {
  const [items, setItems] = useState<FeedPost[] | null>(null)
  useEffect(() => {
    let alive = true
    loadFeed().then((x) => alive && setItems(x))
    return () => {
      alive = false
    }
  }, [])
  return items
}
