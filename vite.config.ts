import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  worker: { format: 'es' },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Lexi — Từ điển Anh–Việt, Nhật–Việt',
        short_name: 'Lexi',
        lang: 'vi',
        description: 'Từ điển Anh–Việt, Anh–Anh và Nhật–Việt.',
        theme_color: '#fcfcfb',
        background_color: '#fcfcfb',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,json}'],
        globIgnores: ['**/dictionary/**']
      }
    })
  ]
})
