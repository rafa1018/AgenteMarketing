import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import '@fontsource-variable/fredoka/wght.css'
import '@fontsource-variable/nunito/wght.css'
import '../styles/index.css'
import { LanguageProvider } from '../i18n'
import { PortalApp } from './PortalApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider fixed="es" title="Gabush · Familias">
      <MotionConfig reducedMotion="user">
        <PortalApp />
      </MotionConfig>
    </LanguageProvider>
  </StrictMode>,
)

// installable app with push notifications, scoped to /familia/
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('/familia/sw.js', { scope: '/familia/' }).catch(() => {})
}
