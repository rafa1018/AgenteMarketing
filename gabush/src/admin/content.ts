import { expireSession, getCsrf } from '@/lib/calendar'
import type { Collection, GalleryItem, ProgramItem } from '@/lib/content'
import { api, toast } from './store'
import { resizePhoto } from './ui'

/* Admin calls for the editable page content (api/content.php): gallery and levels & programmes. */

type Item<C extends Collection> = C extends 'gallery' ? GalleryItem : ProgramItem

export async function listContent<C extends Collection>(c: C): Promise<Item<C>[] | null> {
  const { data } = await api.get(`content.php?c=${c}&all=1`)
  return data?.ok ? data.items : null
}

/** Create (no id) or update. Returns the saved item, or the invalid fields. */
export async function saveContent<C extends Collection>(c: C, item: Partial<Item<C>>): Promise<{ item?: Item<C>; fields?: string[] }> {
  const { status, data } = await api.post('content.php', { action: 'save', c, item })
  if (data?.ok) return { item: data.item }
  if (status === 422 && data?.error === 'validation') return { fields: data.fields ?? [] }
  toast(data?.error === 'full' ? 'Llegaste al máximo de elementos.' : 'No se pudo guardar. Revisa tu conexión e intenta de nuevo.')
  return {}
}

export async function deleteContent(c: Collection, id: string) {
  const { data } = await api.post('content.php', { action: 'delete', c, id })
  if (!data?.ok) toast('No se pudo eliminar.')
  return Boolean(data?.ok)
}

export async function orderContent(c: Collection, ids: string[]) {
  const { data } = await api.post('content.php', { action: 'order', c, ids })
  if (!data?.ok) toast('No se pudo cambiar el orden.')
  return Boolean(data?.ok)
}

/** Shrinks the photo (1280 + 640 px, no crop) and attaches it to the item. */
export async function uploadContentImage<C extends Collection>(c: C, id: string, file: File): Promise<Item<C> | null> {
  let big: Blob, small: Blob
  try {
    ;[big, small] = await Promise.all([resizePhoto(file, 1280), resizePhoto(file, 640)])
  } catch {
    toast('No se pudo leer esa foto. Prueba con otra o tómala de nuevo con la cámara.')
    return null
  }
  const fd = new FormData()
  fd.append('action', 'image')
  fd.append('c', c)
  fd.append('id', id)
  fd.append('photo', big, 'foto.jpg')
  fd.append('thumb', small, 'mini.jpg')
  try {
    const res = await fetch('/api/content.php', { method: 'POST', credentials: 'same-origin', headers: { 'X-CSRF-Token': getCsrf() }, body: fd })
    if (res.status === 401) expireSession()
    const data = await res.json().catch(() => null)
    if (data?.ok) return data.item
  } catch {
    /* below */
  }
  toast('No se pudo subir la foto. Revisa tu conexión e intenta de nuevo.')
  return null
}
