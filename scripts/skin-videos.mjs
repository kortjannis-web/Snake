// Rendert die Shop-Vorschau jedes Skins als kurzes, nahtlos wiederholendes Video (MP4/H.264 und WebM/VP9) plus Standbild (WebP).
// Der Shop spielt dann fertige Videos ab, statt jede Schlange in jedem Bild neu zu zeichnen.
// Nur noetig, wenn sich Skins aendern:  npm run skin-videos
// Braucht ffmpeg (mit libx264, libvpx-vp9 und libwebp) und Playwright mit Chromium
// (z. B. `npx playwright install chromium`; Pfade lassen sich mit PLAYWRIGHT_MODULE / CHROMIUM setzen).
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright')

/** Videogroesse in CSS-Pixeln (die Karte ist 72 hoch; breit genug fuer jede Kartenbreite) und Pixeldichte */
const W = 300
const H = 72
const DPR = 2
const FPS = 30
const ZIEL = 'public/skins'

// Die echte Zeichenfunktion aus dem Spiel fuer den Browser buendeln
const { outputFiles } = await build({
  stdin: {
    contents: "import { SKINS, drawSkinVorschau, schleifeMs, skinBewegt } from './src/render/skins'; Object.assign(window, { SKINS, drawSkinVorschau, schleifeMs, skinBewegt })",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  format: 'iife',
})
const code = outputFiles[0].text

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DPR })
await page.setContent(`<!doctype html><body style="margin:0"><canvas id="c" style="display:block;width:${W}px;height:${H}px"></canvas></body>`)
await page.addScriptTag({ content: code })

mkdirSync(ZIEL, { recursive: true })
const ids = await page.evaluate(() => window.SKINS.map((s) => s.id))
let gesamt = 0
for (const id of ids) {
  const [ms, bewegt] = await page.evaluate((id) => {
    const s = window.SKINS.find((k) => k.id === id)
    return [window.schleifeMs(s), window.skinBewegt(s)]
  }, id)
  // Ohne bewegtes Muster reicht ein Standbild (kein Video)
  const frames = bewegt ? Math.round((ms / 1000) * FPS) : 1
  const tmp = mkdtempSync(join(tmpdir(), `skin-${id}-`))
  for (let i = 0; i < frames; i++) {
    const png = await page.evaluate(
      ([id, t]) => {
        const cv = document.getElementById('c')
        window.drawSkinVorschau(cv, window.SKINS.find((s) => s.id === id), t)
        return cv.toDataURL('image/png').split(',')[1]
      },
      // Ab 0,5 s, damit das erste Bild (Standbild) nicht mitten im Blinzeln liegt; die Schleife bleibt nahtlos
      [id, 500 + (i * 1000) / FPS],
    )
    writeFileSync(join(tmp, `f${String(i).padStart(4, '0')}.png`), Buffer.from(png, 'base64'))
  }
  const ff = (...a) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...a])
  for (const e of ['mp4', 'webm']) rmSync(join(ZIEL, `${id}.${e}`), { force: true })
  // Farben genau wie im Spiel: mit BT.709 umrechnen und so kennzeichnen (sonst wirken sie im Browser blasser)
  const farbe = ['-vf', 'scale=out_color_matrix=bt709:out_range=tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv']
  if (bewegt) {
    // H.264 laeuft ueberall (iPhone, Android, WebView); faststart: kann sofort losspielen
    ff('-framerate', String(FPS), '-i', join(tmp, 'f%04d.png'), ...farbe, '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', join(ZIEL, `${id}.mp4`))
    // VP9/WebM fuer Browser ohne H.264 (z. B. freies Chromium)
    ff('-framerate', String(FPS), '-i', join(tmp, 'f%04d.png'), ...farbe, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '38', '-row-mt', '1', '-pix_fmt', 'yuv420p', '-an', join(ZIEL, `${id}.webm`))
  }
  // Standbild: sofort sichtbar, bevor das Video laeuft, und als Ersatz ohne Video
  ff('-i', join(tmp, 'f0000.png'), '-c:v', 'libwebp', '-quality', '82', join(ZIEL, `${id}.webp`))
  rmSync(tmp, { recursive: true, force: true })
  const kb = (bewegt ? ['mp4', 'webm', 'webp'] : ['webp']).reduce((n, e) => n + statSync(join(ZIEL, `${id}.${e}`)).size, 0) / 1024
  gesamt += kb
  console.log(`${id.padEnd(14)} ${bewegt ? `${String(ms).padStart(5)} ms` : '    Bild'}  ${kb.toFixed(1)} KB`)
}
await browser.close()
console.log(`${ids.length} Skins, zusammen ${(gesamt / 1024).toFixed(2)} MB in ${ZIEL} (${readdirSync(ZIEL).length} Dateien)`)
