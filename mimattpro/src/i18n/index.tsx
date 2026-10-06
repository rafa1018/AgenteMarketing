import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export type Lang = 'es' | 'en'
/** A localized string. Data files use this for every visible text. */
export type L = { es: string; en: string }
export type Text = string | L

const STORAGE_KEY = 'mm-lang'
const DEFAULT_LANG: Lang = 'es'

const TITLES: Record<Lang, string> = {
  es: 'MiMatt PRO | Inteligencia algorítmica para futuros',
  en: 'MiMatt PRO | Futures Intelligence',
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

/** 	itles: the tab title per language (each page can pass its own). */
export function LanguageProvider({ children, titles = TITLES }: { children: ReactNode; titles?: Record<Lang, string> }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

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
    document.title = titles[lang]
  }, [lang, titles])

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>
}

export const useLang = () => useContext(LangContext)

/** Returns a translator: t('plain') → 'plain', t({ es, en }) → current language. */
export function useT() {
  const { lang } = useLang()
  return useCallback((v: Text) => (typeof v === 'string' ? v : v[lang]), [lang])
}
