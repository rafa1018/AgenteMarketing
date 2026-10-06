import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import '@fontsource-variable/sora/wght.css'
import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/jetbrains-mono/wght.css'
import '../styles/index.css'
import { LanguageProvider } from '../i18n'
import { ui } from '../i18n/ui'
import { LoginPage } from './LoginPage'
import { syncTheme } from '../lib/theme'

syncTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider titles={ui.login.pageTitle}>
      <MotionConfig reducedMotion="user">
        <LoginPage />
      </MotionConfig>
    </LanguageProvider>
  </StrictMode>,
)
