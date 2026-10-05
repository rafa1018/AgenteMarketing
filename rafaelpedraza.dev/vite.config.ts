import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// Static build: `npm run build` → dist/ (upload its contents to Hostinger public_html)
export default defineConfig({
  base: '/',
  plugins: [
    react(),
    tailwindcss(),
    // dev/preview: /admin → /admin/ (Hostinger's Apache already adds the slash in production)
    {
      name: 'admin-trailing-slash',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/admin' || req.url?.startsWith('/admin?')) {
            res.statusCode = 301
            res.setHeader('Location', req.url.replace('/admin', '/admin/'))
            return res.end()
          }
          next()
        })
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/admin' || req.url?.startsWith('/admin?')) {
            res.statusCode = 301
            res.setHeader('Location', req.url.replace('/admin', '/admin/'))
            return res.end()
          }
          next()
        })
      },
    },
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Dev only: /api/*.php is served by PHP's built-in server (`npm run api`).
  // In production Hostinger runs the same PHP files from dist/api/.
  server: {
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
  preview: {
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
  build: {
    target: 'es2022',
    // two pages: the public site and the private admin panel (/admin/)
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin/index.html', import.meta.url)),
      },
    },
    assetsInlineLimit: 2048,
    // react-dom + motion are the bulk (~150 kB gzip total); single entry is intentional
    chunkSizeWarningLimit: 600,
  },
})
