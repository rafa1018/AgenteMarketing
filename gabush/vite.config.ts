import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// Static build: `npm run build` → dist/ (upload its contents to Hostinger public_html)
export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss()],
  // Tailwind runs as a Vite plugin; an empty PostCSS config stops Vite from picking up
  // the parent Laravel project's postcss.config.js
  css: { postcss: {} },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Dev only: /api/*.php is served by PHP's built-in server (`npm run api`, port 8020).
  // In production Hostinger runs the same PHP files from dist/api/.
  // (Ports differ from Grandes Genios — 5180/8010 — so both projects can run at once.)
  server: {
    port: 5190,
    proxy: { '/api': 'http://127.0.0.1:8020' },
  },
  preview: {
    port: 4190,
    proxy: { '/api': 'http://127.0.0.1:8020' },
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
        chunkSizeWarningLimit: 600,
  },
})
