import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from './api'

/**
 * Loads data and keeps it fresh: re-runs when `key` changes, exposes reload() after a mutation, and
 * ignores answers that arrive after a newer request (no flicker when filters change fast).
 */
export function useQuery<T>(key: string | null, load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [loading, setLoading] = useState(Boolean(key))
  const seq = useRef(0)
  const loader = useRef(load)
  loader.current = load

  const run = useCallback(
    async (quiet = false) => {
      if (key === null) return
      const id = ++seq.current
      if (!quiet) setLoading(true)
      try {
        const r = await loader.current()
        if (id === seq.current) {
          setData(r)
          setError(null)
        }
      } catch (e) {
        if (id === seq.current) setError(e instanceof ApiError ? e : new ApiError(0, 'error', String(e)))
      } finally {
        if (id === seq.current) setLoading(false)
      }
    },
    [key],
  )

  useEffect(() => {
    run()
  }, [run])

  return { data, error, loading, reload: () => run(true), setData }
}

/** Runs a mutation with a busy flag and field errors (for forms). */
export function useMutation() {
  const [busy, setBusy] = useState(false)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const run = useCallback(async <T>(fn: () => Promise<T>): Promise<T | null> => {
    setBusy(true)
    setFields({})
    setMessage(null)
    try {
      return await fn()
    } catch (e) {
      if (e instanceof ApiError) {
        setFields(e.fields)
        setMessage(e.message)
      } else setMessage('Algo salió mal.')
      return null
    } finally {
      setBusy(false)
    }
  }, [])
  return { busy, fields, message, run, setMessage, setFields }
}
