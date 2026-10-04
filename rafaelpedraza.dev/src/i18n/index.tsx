import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export type Lang = 'es' | 'en'
/** A localized string. Data files use this for every visible text. */
export type L = { es: string; en: string }
export type Text = string | L

const STORAGE_KEY = 'rp-lang'
const DEFAULT_LANG: Lang = 'es'

const TITLES: Record<Lang, string> = {
  es: 'Rafael Pedraza | Ingeniero Full Stack | Ingeniería de Software',
  en: 'Rafael Pedraza | Full Stack Engineer | Software Engineering',
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

export function LanguageProvider({ children }: { children: ReactNode }) {
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
    document.title = TITLES[lang]
  }, [lang])

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>
}

export const useLang = () => useContext(LangContext)

/** Returns a translator: t('plain') → 'plain', t({ es, en }) → current language. */
export function useT() {
  const { lang } = useLang()
  return useCallback((v: Text) => (typeof v === 'string' ? v : v[lang]), [lang])
}
