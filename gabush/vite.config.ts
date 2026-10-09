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
    // three apps: the public site, the private admin panel (/admin/) and the family portal (/familia/)
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin/index.html', import.meta.url)),
        familia: fileURLToPath(new URL('./familia/index.html', import.meta.url)),
      },
      // "g2": new file names once, so no browser/CDN asks again for the 404s cached during the 8-Oct-2026 deploy
      output: {
        entryFileNames: 'assets/[name]-g2-[hash].js',
        chunkFileNames: 'assets/[name]-g2-[hash].js',
        assetFileNames: 'assets/[name]-g2-[hash][extname]',
      },
    },
    assetsInlineLimit: 2048,
        chunkSizeWarningLimit: 600,
  },
})
