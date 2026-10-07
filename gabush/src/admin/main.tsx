import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import '@fontsource-variable/fredoka/wght.css'
import '@fontsource-variable/nunito/wght.css'
import '../styles/index.css'
import { LanguageProvider } from '../i18n'
import { AdminApp } from './AdminApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider fixed="es" title="Gabush Kids · Administración">
      <MotionConfig reducedMotion="user">
        <AdminApp />
      </MotionConfig>
    </LanguageProvider>
  </StrictMode>,
)

// installable app (Chrome "Instalar app"); scoped to /admin/ so it never affects the public site
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/' }).catch(() => {})
}
