import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Caminho base da aplicação.
 *
 * O GitHub Pages publica o projeto em um subdiretório com o nome do repositório
 * (`https://usuario.github.io/calisthenics-app/`). Mantemos o mesmo `base` em
 * desenvolvimento e produção para que caminhos de assets, manifest e Service
 * Worker sejam idênticos aos do ambiente publicado.
 */
const BASE = '/calisthenics-app/'

export default defineConfig({
  base: BASE,
  build: {
    target: 'es2020',
    sourcemap: false,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Calisthenics App',
        short_name: 'Calisthenics',
        description:
          'Treinos de calistenia sem equipamentos para condicionamento físico e perda de peso.',
        lang: 'pt-BR',
        dir: 'ltr',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0a0f0d',
        background_color: '#0a0f0d',
        start_url: BASE,
        scope: BASE,
        categories: ['fitness', 'health', 'sports'],
        icons: [
          {
            src: 'icons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webp,woff,woff2}'],
        navigateFallback: `${BASE}index.html`,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
})
