import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const base = process.env.GITHUB_ACTIONS ? '/EDM-Chords-and-Melodies-Generator/' : '/'
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string }

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        id: base,
        scope: base,
        start_url: base,
        name: 'EDM Studio — chords, bass, lead & drums',
        short_name: 'EDM Studio',
        description: 'Generate chord progressions, bass, lead and drums for EDM genres. Works offline, exports MIDI and WAV.',
        theme_color: '#030712',
        background_color: '#030712',
        display: 'standalone',
        orientation: 'any',
        categories: ['music', 'entertainment'],
        shortcuts: [
          { name: 'Harmony', short_name: 'Harmony', url: `${base}?tab=harmony` },
          { name: 'Arrangement', short_name: 'Arrange', url: `${base}?tab=arrangement` },
        ],
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/tone')) {
            return 'tone-js';
          }
          if (id.includes('node_modules/vexflow')) {
            return 'vexflow';
          }
          if (id.includes('MelodyStudio')) {
            return 'melody-studio';
          }
          if (id.includes('ChordDisplay')) {
            return 'chord-display';
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
})
