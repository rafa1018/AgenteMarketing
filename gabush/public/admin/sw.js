// Gabush Kids admin — minimal service worker so the panel can be installed as an app.
// Network first for everything; the app shell is cached only as an offline fallback.
// API calls (/api/*) and student photos are never cached here.
const CACHE = 'gb-admin-v3'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && (url.pathname.startsWith('/admin/') || url.pathname.startsWith('/assets/'))) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(e.request, copy))
        }
        return res
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('/admin/'))),
  )
})

// ── Push notifications (inscripciones, pagos pendientes, asistencia) ──
self.addEventListener('push', (e) => {
  let msg = {}
  try {
    msg = e.data ? e.data.json() : {}
  } catch {
    msg = { body: e.data && e.data.text() }
  }
  e.waitUntil(
    self.registration.showNotification(msg.title || 'Gabush Kids', {
      body: msg.body || '',
      icon: '/icon-192.png',
      badge: '/favicon-48.png',
      tag: msg.tag || undefined,
      renotify: Boolean(msg.tag),
      data: { url: msg.url || '/admin/' },
    }),
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = new URL(e.notification.data?.url || '/admin/', self.location.origin).href
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const win = wins.find((w) => w.url.includes('/admin/'))
      if (win) return win.navigate(url).then((w) => (w || win).focus())
      return self.clients.openWindow(url)
    }),
  )
})
