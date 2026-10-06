import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import '@fontsource-variable/sora/wght.css'
import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/jetbrains-mono/wght.css'
import '../styles/index.css'
import { LanguageProvider } from '../i18n'
import { syncTheme } from '../lib/theme'
import { AdminApp } from './AdminApp'

syncTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider titles={{ es: 'Panel · MiMatt PRO', en: 'Panel · MiMatt PRO' }}>
      <MotionConfig reducedMotion="user">
        <AdminApp />
      </MotionConfig>
    </LanguageProvider>
  </StrictMode>,
)
