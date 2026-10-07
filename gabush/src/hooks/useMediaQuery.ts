import { useEffect, useState, useSyncExternalStore } from 'react'
import { loadVisits } from '@/lib/api'

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', cb)
      return () => mql.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)')
export const useFinePointer = () => useMediaQuery('(hover: hover) and (pointer: fine)')
export const useReducedMotionPref = () => useMediaQuery('(prefers-reduced-motion: reduce)')

/** Tracks which section is crossing the middle of the viewport (IntersectionObserver — no scroll listeners). */
export function useActiveSection(ids: readonly string[]) {
  const [active, setActive] = useState(ids[0])
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id)
      },
      { rootMargin: '-45% 0px -54% 0px' },
    )
    ids.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [ids])
  return active
}

/** Total visits (null while loading or if the API is unreachable — callers hide the counter). */
export function useVisits() {
  const [count, setCount] = useState<number | null>(null)
  useEffect(() => {
    let alive = true
    loadVisits().then((n) => alive && setCount(n))
    return () => {
      alive = false
    }
  }, [])
  return count
}
