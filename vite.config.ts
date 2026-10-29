import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

/** Commit-Zeit: damit erkennt die Android-App, ob die Web-Fassung neuer ist */
const buildTime = (() => {
  try {
    return Number(execSync('git log -1 --format=%ct', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()) || 0
  } catch {
    return 0
  }
})()

export default defineConfig({
  // Relative Pfade: laeuft auf GitHub Pages (Unterordner), lokal und in der Android-App
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __BUILD_TIME__: buildTime },
  build: { target: 'es2020', assetsInlineLimit: 0 },
  plugins: [
    {
      name: 'version-json',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: pkg.version, build: buildTime }) })
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Snake Endlos',
        short_name: 'Snake',
        description: 'Snake im Endlos-Modus: Äpfel essen, die Karte wächst alle 30 Level.',
        lang: 'de',
        start_url: './',
        scope: './',
        display: 'fullscreen',
        orientation: 'portrait',
        background_color: '#171513',
        theme_color: '#171513',
        categories: ['games'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // push-sw.js: zeigt Push-Einladungen und oeffnet beim Tippen den Raum
      workbox: {
        // Neue Version sofort aktivieren, sonst wartet sie, bis die App ganz beendet ist (eine App vom Home-Bildschirm
        // schlaeft aber meist nur): Spieler blieben so tagelang auf einer alten Version. Neu geladen wird erst im Startmenue
        skipWaiting: true,
        clientsClaim: true,
        // Shop-Videos (MP4, das spielt jedes Geraet) und Standbilder sind klein (zusammen ca. 2,7 MB): mit in den Offline-
        // Speicher. WebM ist nur der Ersatz fuer Browser ohne H.264 und wird erst bei Bedarf geladen (spart 2 MB beim Installieren)
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,webp,mp4}'],
        // Trailer der Patchnotes (ca. 2 MB) laufen nur einmal nach einem Update: nicht in den Offline-Speicher
        globIgnores: ['patch/**'],
        importScripts: ['push-sw.js'],
      },
    }),
  ],
})
