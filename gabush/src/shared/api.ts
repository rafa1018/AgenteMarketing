/**
 * Client of the Gabush v2 API (/api/v2). Shared by the staff panel and the family portal: each one plugs in
 * where its CSRF token comes from and what to do when the session expires.
 * PUT/DELETE travel as POST + X-HTTP-Method-Override (some shared hosts block those methods).
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields: Record<string, string> = {},
  ) {
    super(message)
  }
}

type Config = { csrf: () => string; onUnauthorized?: () => void }

export function createApi(config: Config) {
  async function call<T>(method: string, path: string, body?: unknown, form?: FormData): Promise<T> {
    const headers: Record<string, string> = {}
    let realMethod = method
    if (method === 'PUT' || method === 'DELETE' || method === 'PATCH') {
      headers['X-HTTP-Method-Override'] = method
      realMethod = 'POST'
    }
    if (method !== 'GET') headers['X-CSRF-Token'] = config.csrf()
    if (body !== undefined && !form) headers['Content-Type'] = 'application/json'
    let res: Response
    try {
      res = await fetch(`/api/v2${path}`, { method: realMethod, credentials: 'same-origin', headers, body: form ?? (body !== undefined ? JSON.stringify(body) : undefined) })
    } catch {
      throw new ApiError(0, 'network', 'Sin conexión. Revisa tu internet e intenta de nuevo.')
    }
    const data = await res.json().catch(() => null)
    if (res.status === 401 || (res.status === 403 && data?.error === 'csrf')) config.onUnauthorized?.()
    if (!res.ok || !data?.ok) {
      const msg = data?.message || MESSAGES[data?.error as string] || (res.status >= 500 ? 'Algo falló en el servidor. Intenta de nuevo.' : 'No se pudo completar la acción.')
      throw new ApiError(res.status, data?.error ?? 'error', msg, data?.fields ?? {})
    }
    return data as T
  }
  return {
    get: <T>(path: string) => call<T>('GET', path),
    post: <T>(path: string, body: unknown = {}) => call<T>('POST', path, body),
    put: <T>(path: string, body: unknown = {}) => call<T>('PUT', path, body),
    del: <T>(path: string, body?: unknown) => call<T>('DELETE', path, body ?? {}),
    upload: <T>(path: string, form: FormData) => call<T>('POST', path, undefined, form),
  }
}

export type Api = ReturnType<typeof createApi>

const MESSAGES: Record<string, string> = {
  unauthorized: 'Tu sesión terminó. Vuelve a iniciar sesión.',
  forbidden: 'No tienes permiso para hacer esto.',
  not_found: 'No se encontró lo que buscas.',
  validation: 'Revisa los campos marcados.',
  csrf: 'Tu sesión expiró. Recarga la página.',
}

/** Querystring from an object (skips empty values). */
export function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== '' && v !== false) p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ''
}
