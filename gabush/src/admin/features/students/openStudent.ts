import { useSyncExternalStore } from 'react'
import type { Id } from '../../v2/api'

/** Which student file is open (any module can open it: debtors list, attendance, grades…). */
let current: { id: Id; tab?: string } | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export const openStudent = (id: Id, tab?: string) => {
  current = { id, tab }
  emit()
}
export const closeStudent = () => {
  current = null
  emit()
}
/** Bumped when a file saved something, so lists can refresh. */
let version = 0
export const studentsChanged = () => {
  version++
  emit()
}

export function useOpenStudent() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
}
export function useStudentsVersion() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => version,
  )
}
