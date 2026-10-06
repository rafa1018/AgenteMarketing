import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// Static build: `npm run build` → dist/
export default defineConfig({
  base: '/',
  plugins: [
    react(),
    tailwindcss(),
    // dev: /login → /login/ and /admin → /admin/ (the static host adds the slash in production)
    {
      name: 'trailing-slash',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const m = req.url?.match(/^\/(login|admin)(\?.*)?$/)
          if (m) {
            res.statusCode = 301
            res.setHeader('Location', `/${m[1]}/${m[2] ?? ''}`)
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
  // dev only: /api/*.php is served by PHP's built-in server (npm run api, port 8001)
  server: { port: 5174, proxy: { '/api': 'http://127.0.0.1:8001' } },
  preview: { port: 4174, proxy: { '/api': 'http://127.0.0.1:8001' } },
  build: {
    target: 'es2022',
    // three pages: the site, the login and the admin panel
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        login: fileURLToPath(new URL('./login/index.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin/index.html', import.meta.url)),
      },
    },
    assetsInlineLimit: 2048,
    chunkSizeWarningLimit: 600,
  },
})
