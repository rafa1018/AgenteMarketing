import { useEffect, useState } from 'react'
import { loadVisits } from '@/lib/api'

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
