import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import '@fontsource-variable/sora/wght.css'
import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/jetbrains-mono/wght.css'
import '../styles/index.css'
import './theme.css'
import { applyTheme } from './theme'
import { AdminApp } from './AdminApp'

applyTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <AdminApp />
    </MotionConfig>
  </StrictMode>,
)

// installable app + push notifications; scoped to /admin/ so it never affects the public site
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/' }).catch(() => {})
}
