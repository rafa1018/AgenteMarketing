import { useSyncExternalStore } from 'react'
import { api2 } from '../../v2/api'

/** Unread messages of "Mi bandeja" (for the menu badge); refreshed by the shell's minute sync and after reading. */
let unread = 0
const listeners = new Set<() => void>()

export async function refreshInbox(): Promise<void> {
  try {
    const r = await api2.get<{ unread: number }>('/staff-inbox')
    if (r.unread !== unread) {
      unread = r.unread
      listeners.forEach((l) => l())
    }
  } catch {
    // offline / session ended: keep the last count
  }
}

export function useInboxUnread() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => unread,
  )
}
