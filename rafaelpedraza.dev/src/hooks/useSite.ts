import { useEffect, useState } from 'react'
import { loadSite, onSiteChange, type SiteSettings } from '@/lib/api'

/** Site settings from the admin panel; null while loading. */
export function useSite(): SiteSettings | null {
  const [site, setSite] = useState<SiteSettings | null>(null)
  useEffect(() => {
    let alive = true
    loadSite().then((s) => alive && setSite(s))
    const off = onSiteChange(setSite)
    return () => {
      alive = false
      off()
    }
  }, [])
  return site
}

/** True only once the settings say the CV can be downloaded (hidden while loading, so it never flashes). */
export function useCvEnabled(): boolean {
  return useSite()?.cv.enabled ?? false
}
