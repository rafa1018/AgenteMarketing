import { useSyncExternalStore } from 'react'
import { createApi } from '@/shared/api'

/** Signed-in family (one student). */
export interface Me {
  csrf: string
  mustChangePassword: boolean
  student: { id: number; code: string; firstName: string; middleName: string | null; lastName: string; secondLastName: string | null; birthDate: string | null; hasPhoto: number; course: string | null; status: string | null; gradeLevel: string | null; director: string | null }
  guardians: { name: string; relationship: string }[]
  year: number
  years: number[]
  vapidKey: string | null
  onlinePayments: boolean
  school: { name: string; phone?: string; email?: string; address?: string }
}

type State = { me: Me | null; checked: boolean }
let state: State = { me: null, checked: false }
const listeners = new Set<() => void>()
const set = (p: Partial<State>) => {
  state = { ...state, ...p }
  listeners.forEach((l) => l())
}

export const api = createApi({ csrf: () => state.me?.csrf ?? '', onUnauthorized: () => set({ me: null }) })

export function useSession() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

export async function checkSession() {
  try {
    const me = await api.get<Me>('/portal/me')
    set({ me, checked: true })
  } catch {
    set({ me: null, checked: true })
  }
}

export async function login(username: string, password: string) {
  const me = await api.post<Me>('/portal/login', { username, password })
  set({ me, checked: true })
  return me
}

export async function logout() {
  await api.post('/portal/logout').catch(() => null)
  set({ me: null })
}

export const setMe = (me: Me) => set({ me })
export const passwordChanged = () => state.me && set({ me: { ...state.me, mustChangePassword: false } })

/* toast */
type Toast = { text: string; id: number } | null
let toastState: Toast = null
const toastListeners = new Set<() => void>()
export function toast(text: string) {
  toastState = { text, id: Date.now() }
  toastListeners.forEach((l) => l())
  const id = toastState.id
  setTimeout(() => {
    if (toastState?.id === id) {
      toastState = null
      toastListeners.forEach((l) => l())
    }
  }, 3200)
}
export function useToast() {
  return useSyncExternalStore(
    (l) => {
      toastListeners.add(l)
      return () => toastListeners.delete(l)
    },
    () => toastState,
  )
}
