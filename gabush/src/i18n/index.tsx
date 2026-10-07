import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export type Lang = 'es' | 'en'
/** A localized string. Data files use this for every visible text. */
export type L = { es: string; en: string }
export type Text = string | L

const STORAGE_KEY = 'gb-lang'
const DEFAULT_LANG: Lang = 'es'

const TITLES: Record<Lang, string> = {
  es: 'Gabush Kids | Jardín infantil en Valledupar · Creciendo con las artes',
  en: 'Gabush Kids | Kindergarten in Valledupar · Growing up with the arts',
}

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'es' || saved === 'en') return saved
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_LANG
}

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: DEFAULT_LANG, setLang: () => {} })

/** `fixed` forces a language (the admin panel is Spanish only); `title` overrides the document title. */
export function LanguageProvider({ children, fixed, title }: { children: ReactNode; fixed?: Lang; title?: string }) {
  const [lang, setLangState] = useState<Lang>(() => fixed ?? initialLang())

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try {
      localStorage.setItem(STORAGE_KEY, l)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
    document.title = title ?? TITLES[lang]
  }, [lang, title])

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>
}

export const useLang = () => useContext(LangContext)

/** Returns a translator: t('plain') → 'plain', t({ es, en }) → current language. */
export function useT() {
  const { lang } = useLang()
  return useCallback((v: Text) => (typeof v === 'string' ? v : v[lang]), [lang])
}
