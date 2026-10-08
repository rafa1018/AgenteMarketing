// Service worker of the family portal (/familia/): offline shell + push notifications.
// Network first for everything; the API is never cached (personal data).
const CACHE = 'gb-familia-v1'
const SHELL = ['/familia/', '/familia/manifest.webmanifest', '/images/opt/leon-asomado-160.webp']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('gb-familia-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && (url.pathname.startsWith('/familia/') || url.pathname.startsWith('/assets/'))) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(e.request, copy))
        }
        return res
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('/familia/'))),
  )
})

self.addEventListener('push', (e) => {
  let msg = {}
  try {
    msg = e.data ? e.data.json() : {}
  } catch {
    msg = { body: e.data && e.data.text() }
  }
  e.waitUntil(
    self.registration.showNotification(msg.title || 'Jardín Gabush', {
      body: msg.body || '',
      icon: '/icon-192.png?v=2',
      badge: '/favicon-48.png?v=2',
      tag: msg.tag || undefined,
      renotify: Boolean(msg.tag),
      data: { url: msg.url || '/familia/' },
    }),
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || '/familia/'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes('/familia/')) {
          c.navigate(url).catch(() => {})
          return c.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
