// Rendert die kurzen Trailer fuer die Patchnotes (public/patch/*.mp4, *.webm, Standbild *.webp):
//   kampagne  die drei Bosse der Kampagne und die Kaefigkoepfe (echte Missionen, gesteuert vom Autopiloten)
//   endlos    dasselbe im Endlos-Modus: Level 60, 100, 145 und 150
//   feedback  der Feedback-Knopf und die Seite (die echte App im Dev-Server, Punkte werden getippt)
//   welten    jede Welt 3 Sekunden
// und mit --hilfe die Videos des Spielfuehrers hinter dem Fragezeichen (public/hilfe/):
//   endlos          der Endlos-Modus: Aepfel, Gefahren, Welten
//   online          Mehrspieler mit vier Schlangen: Gegeneinander, Zone, Apfeljagd
//   kampagne        die Karte (die echte App: die Schlange waechst zur naechsten Mission), dann Missionen
//   aussehen        Skins, Accessoires und Effekte (die echte App, es wird getippt und gescrollt)
//   bosse-kampagne  wie kampagne der Patchnotes, bosse-endlos wie endlos der Patchnotes
// Spiel und Renderer sind die echten (scripts/patch-szene.ts), die Zeit laeuft Bild fuer Bild, im Trailer stirbt niemand.
// Nur noetig, wenn sich die Patchnotes oder der Spielfuehrer aendern:  npm run patch-videos  bzw.  npm run hilfe-videos
// (nur bestimmte: npm run patch-videos -- welten). Braucht ffmpeg (libx264, libvpx-vp9, libwebp) und Playwright mit
// Chromium (wie npm run skin-videos).
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright')

/** Videogroesse in CSS-Pixeln (wie die Karte der Patchnotes, 8:9) und Pixeldichte */
const W = 360
const H = 404
const DPR = 1.5
const FPS = 30
const HILFE = process.argv.includes('--hilfe')
const ZIEL = HILFE ? 'public/hilfe' : 'public/patch'
/** Schnitt: so lange aus Schwarz ein- und ausblenden (ms) */
const BLENDE = 220

const sek = (s) => s * 1000
const CLIPS = {
  kampagne: [
    { dauer: sek(2.6), szene: { mission: 10, hin: 'boss', laenge: 10, feld: 15, vorlauf: 1500, unter: 'Mission 10 · Boss', titel: 'Der Steingolem' } },
    { dauer: sek(2.6), szene: { mission: 20, hin: 'boss', laenge: 10, feld: 15, vorlauf: 2500, unter: 'Mission 20 · Boss', titel: 'Der Ent' } },
    { dauer: sek(2.4), szene: { mission: 29, hin: 'kaefig', laenge: 9, feld: 22, vorlauf: 300, unter: 'Neue Gegner', titel: 'Käfigköpfe' } },
    { dauer: sek(3), szene: { mission: 30, hin: 'boss', laenge: 10, feld: 17, vorher: 3000, nah: 3, weit: 5, vorlauf: 200, unter: 'Mission 30 · Boss', titel: 'Der Käfigmeister' } },
  ],
  endlos: [
    { dauer: sek(2.6), szene: { level: 59, aufsteigen: true, hin: 'boss', laenge: 16, feld: 15, vorlauf: 2500, seed: 7, unter: 'Endlos · Level 60', titel: 'Steingolem' } },
    { dauer: sek(2.6), szene: { level: 99, aufsteigen: true, hin: 'boss', laenge: 16, feld: 15, vorlauf: 3000, seed: 7, unter: 'Endlos · Level 100', titel: 'Ent' } },
    { dauer: sek(2.4), szene: { level: 144, aufsteigen: true, hin: 'kerker', laenge: 14, feld: 18, vorlauf: 800, seed: 7, unter: 'Endlos · Level 145', titel: 'Kerker' } },
    { dauer: sek(3), szene: { level: 149, aufsteigen: true, hin: 'boss', laenge: 16, feld: 16, vorher: 3000, nah: 3, weit: 5, vorlauf: 200, seed: 7, unter: 'Endlos · Level 150', titel: 'Käfigmeister' } },
  ],
}

/** Spielszenen des Spielfuehrers (Kampagne und Aussehen beginnen mit der echten App, siehe unten) */
const VIER = ['klassik', 'tiger', 'koralle', 'nacht']
const HILFE_CLIPS = {
  endlos: [
    { dauer: sek(2.6), szene: { level: 3, seed: 3, laenge: 6, feld: 22, vorlauf: 600, unter: 'Endlos · Level 3', titel: 'Äpfel essen, wachsen' } },
    { dauer: sek(2.6), szene: { level: 55, seed: 5, laenge: 14, feld: 16, vorlauf: 1500, unter: 'Endlos · Level 55', titel: 'Immer neue Gefahren' } },
    { dauer: sek(2.6), szene: { welt: 'wueste', level: 40, seed: 12, laenge: 12, feld: 18, vorlauf: 1200, unter: 'Endlos · Wüste', titel: 'Sieben Welten' } },
    { dauer: sek(2.6), szene: { welt: 'vulkan', level: 80, seed: 17, laenge: 16, feld: 17, vorlauf: 1200, unter: 'Endlos · Vulkan', titel: 'Wie weit kommst du?' } },
  ],
  online: [
    { dauer: sek(3.2), szene: { mehr: { modus: 'vs', skins: VIER }, seed: 21, feld: 13, vorher: 16000, unter: 'Online · Gegeneinander', titel: 'Bis zu 4 Spieler' } },
    { dauer: sek(3.2), szene: { mehr: { modus: 'royale', skins: VIER }, seed: 22, feld: 10, vorher: 40000, unter: 'Online · Zone', titel: 'Die Karte schrumpft' } },
    { dauer: sek(3.2), szene: { mehr: { modus: 'jagd', skins: VIER }, seed: 23, feld: 13, vorher: 14000, unter: 'Online · Apfeljagd', titel: 'Wer hat die meisten?' } },
  ],
  kampagne: [
    { dauer: sek(2.4), szene: { mission: 5, laenge: 6, feld: 22, vorlauf: 1500, unter: 'Mission 5 · Schatz', titel: 'Hinter dem Tor' } },
    { dauer: sek(2.4), szene: { mission: 21, laenge: 8, feld: 20, vorlauf: 1500, unter: 'Mission 21', titel: 'Unter der Erde' } },
    { dauer: sek(2.6), szene: { mission: 27, laenge: 8, feld: 20, vorlauf: 1500, unter: 'Mission 27', titel: 'Die drei Siegel' } },
  ],
  'bosse-kampagne': CLIPS.kampagne,
  'bosse-endlos': CLIPS.endlos,
}

/** Je Welt ein Ausschnitt, in dem man viel von ihr sieht (Level und Startwert ausprobiert) */
const WELT_SZENE = {
  winter: { level: 100, seed: 5 },
}

const ff = (...a) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...a])
// Farben wie im Spiel (BT.709, sonst wirken sie blasser)
const FARBE = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv']
function kodieren(name, tmp, standbild) {
  mkdirSync(ZIEL, { recursive: true })
  const ein = ['-framerate', String(FPS), '-i', join(tmp, 'f%04d.png'), '-vf', 'scale=out_color_matrix=bt709:out_range=tv']
  ff(...ein, ...FARBE, '-c:v', 'libx264', '-preset', 'slow', '-crf', '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', join(ZIEL, `${name}.mp4`))
  ff(...ein, ...FARBE, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '42', '-row-mt', '1', '-pix_fmt', 'yuv420p', '-an', join(ZIEL, `${name}.webm`))
  ff('-i', join(tmp, `f${String(standbild).padStart(4, '0')}.png`), '-c:v', 'libwebp', '-quality', '80', join(ZIEL, `${name}.webp`))
  const kb = ['mp4', 'webm', 'webp'].map((e) => `${e} ${(statSync(join(ZIEL, `${name}.${e}`)).size / 1024).toFixed(0)} KB`).join(', ')
  console.log(`${name.padEnd(9)} ${kb}`)
}

const schrift = (datei, name, gewicht) =>
  `@font-face{font-family:'${name}';src:url(data:font/woff2;base64,${readFileSync(datei).toString('base64')}) format('woff2');font-weight:${gewicht}}`

/** Seite mit Spiel und Renderer (scripts/patch-szene.ts) zum Filmen */
async function spielSeite(browser) {
  const { outputFiles } = await build({ entryPoints: ['scripts/patch-szene.ts'], bundle: true, write: false, format: 'iife', define: { 'import.meta.env.DEV': 'false' } })
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DPR })
  page.on('pageerror', (e) => console.error('Fehler im Browser:', e.message))
  await page.setContent(
    `<!doctype html><style>${schrift('src/fonts/Newsreader-opsz.woff2', 'Newsreader', '400 650')}${schrift('src/fonts/LibreFranklin.woff2', 'Libre Franklin', '100 900')}body{margin:0;background:#1d1b19}</style><canvas id="c" style="display:block"></canvas>`,
  )
  await page.evaluate(() => Promise.all([document.fonts.load('500 30px Newsreader'), document.fonts.load('700 12px "Libre Franklin"')]))
  await page.addScriptTag({ content: outputFiles[0].text })
  return page
}

/** Szenen Bild fuer Bild in tmp schreiben, ab Bild n; gibt die naechste Bildnummer zurueck */
async function segmenteFilmen(page, segmente, tmp, n = 0) {
  for (const seg of segmente) {
    await page.evaluate(([s, w, h]) => window.szene(s, w, h), [seg.szene, W, H])
    const bilder = Math.round((seg.dauer / 1000) * FPS)
    for (let i = 0; i < bilder; i++) {
      const t = (i * 1000) / FPS
      const ein = Math.max(0, Math.min(1, t / BLENDE, (seg.dauer - t - 1000 / FPS) / BLENDE))
      const png = await page.evaluate(([dt, e]) => (window.schritt(dt, true, e), window.bild()), [1000 / FPS, ein])
      writeFileSync(join(tmp, `f${String(n++).padStart(4, '0')}.png`), Buffer.from(png, 'base64'))
    }
  }
  return n
}

async function spielClips(browser, namen) {
  if (!namen.length) return
  const page = await spielSeite(browser)
  for (const name of namen) {
    const segmente =
      name === 'welten'
        ? (await page.evaluate(() => window.WELTEN_IDS)).map((w, i, alle) => ({
            dauer: sek(3),
            szene: { welt: w.id, level: 75, seed: 11 + i, laenge: 18, feld: 18, vorlauf: 1200, ...WELT_SZENE[w.id], unter: `Welt ${i + 1} von ${alle.length}`, titel: w.name },
          }))
        : (HILFE ? HILFE_CLIPS : CLIPS)[name]
    const tmp = mkdtempSync(join(tmpdir(), `patch-${name}-`))
    await segmenteFilmen(page, segmente, tmp)
    // Standbild: aus der ersten Szene, wenn der Titel steht
    kodieren(name, tmp, Math.round(FPS * 1.2))
    rmSync(tmp, { recursive: true, force: true })
  }
  await page.close()
}

/** Feedback: die echte App (Dev-Server), oben der Knopf, dann werden zwei Punkte getippt und abgeschickt */
async function feedbackClip(browser) {
  const { createServer } = await import('vite')
  const server = await createServer({ server: { port: 5199, strictPort: true, watch: null }, logLevel: 'error' })
  await server.listen()
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DPR })
  // Patchnotes schon gesehen, sonst liegen sie ueber allem
  await page.goto('http://localhost:5199/')
  await page.evaluate(() => document.fonts.ready)
  // Die Patchnotes selbst liegen sonst ueber allem
  await page.evaluate(() => document.getElementById('patchnotes').removeAttribute('data-open'))
  await page.waitForTimeout(1500)
  const tmp = mkdtempSync(join(tmpdir(), 'patch-feedback-'))
  let n = 0
  const foto = async (mal = 1) => {
    const png = await page.screenshot({ type: 'png' })
    for (let i = 0; i < mal; i++) writeFileSync(join(tmp, `f${String(n++).padStart(4, '0')}.png`), png)
  }
  // Ein Finger tippt auf das orange Ausrufezeichen
  await page.evaluate(() => {
    const b = document.getElementById('btn-feedback').getBoundingClientRect()
    const f = document.createElement('div')
    f.id = 'finger'
    f.style.cssText = `position:fixed;z-index:99;left:${b.left + b.width / 2 - 22}px;top:${b.top + b.height / 2 - 22}px;width:44px;height:44px;border-radius:50%;background:rgba(245,239,230,.35);box-shadow:0 0 0 0 rgba(242,154,76,.6);transform:scale(1.6);opacity:0;transition:transform .35s,opacity .35s,box-shadow .5s`
    document.body.append(f)
  })
  await foto(20)
  await page.evaluate(() => {
    const f = document.getElementById('finger')
    f.style.opacity = '1'
    f.style.transform = 'scale(1)'
  })
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(33)
    await foto()
  }
  await page.evaluate(() => (document.getElementById('finger').style.boxShadow = '0 0 0 18px rgba(242,154,76,0)'))
  await foto(4)
  await page.evaluate(() => {
    document.getElementById('finger').remove()
    document.getElementById('btn-feedback').click()
  })
  for (let i = 0; i < 14; i++) {
    await page.waitForTimeout(33)
    await foto()
  }
  await foto(10)
  const tippen = async (feld, text) => {
    for (let i = 1; i <= text.length; i++) {
      await page.locator(feld).fill(text.slice(0, i))
      await foto(text[i - 1] === ' ' ? 2 : 1)
    }
    await foto(12)
  }
  await page.locator('#feedback-punkte textarea').first().focus()
  await tippen('#feedback-punkte .feedback-punkt:nth-child(1) textarea', 'Mehr Bosse, die sind mega!')
  await page.evaluate(() => document.getElementById('feedback-plus').click())
  await foto(6)
  await tippen('#feedback-punkte .feedback-punkt:nth-child(2) textarea', 'Eine Welt unter Wasser?')
  // Abschicken (im Video ohne Datenbank: die Antwort wird gesetzt)
  await page.evaluate(() => {
    document.activeElement?.blur()
    document.getElementById('feedback-info').textContent = 'Danke! Dein Feedback ist angekommen.'
    document.getElementById('feedback-senden').animate([{ transform: 'scale(0.96)' }, { transform: 'none' }], { duration: 250 })
  })
  await foto(FPS * 2)
  kodieren('feedback', tmp, 40)
  rmSync(tmp, { recursive: true, force: true })
  await page.close()
  await server.close()
}

/* ================= Die echte App filmen (Spielfuehrer) ================= */

/** Dev-Server mit der echten App; Spielstand vorher in den Speicher, Patchnotes zu */
async function appSeite(browser, port, speicher) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DPR })
  page.on('pageerror', (e) => console.error('Fehler in der App:', e.message))
  await page.addInitScript((daten) => {
    for (const [k, v] of Object.entries(daten)) localStorage.setItem(k, JSON.stringify(v))
  }, speicher)
  await page.goto(`http://localhost:${port}/`)
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(() => document.getElementById('patchnotes').removeAttribute('data-open'))
  await page.waitForTimeout(1200)
  return page
}

/** Aufnahme in Echtzeit: jedes Foto fuellt so viele Bilder, wie seit dem Start vergangen sind (Animationen behalten ihr Tempo) */
function appKamera(page, tmp, n0) {
  let n = n0
  let start = 0
  const k = {
    get n() {
      return n
    },
    los() {
      start = performance.now() - ((n - n0) * 1000) / FPS
    },
    async foto() {
      const png = await page.screenshot({ type: 'png' })
      const soll = n0 + Math.round(((performance.now() - start) / 1000) * FPS)
      do writeFileSync(join(tmp, `f${String(n++).padStart(4, '0')}.png`), png)
      while (n < soll)
    },
    async warten(ms) {
      const ende = performance.now() + ms
      while (performance.now() < ende) await k.foto()
    },
  }
  return k
}

/** Ein Finger tippt auf den Punkt (sichtbarer Kreis, dann ein echter Klick) */
async function tippen(page, kam, p) {
  await page.evaluate(([x, y]) => {
    const f = document.createElement('div')
    f.id = 'finger'
    f.style.cssText = `position:fixed;z-index:999;pointer-events:none;left:${x - 22}px;top:${y - 22}px;width:44px;height:44px;border-radius:50%;background:rgba(245,239,230,.38);box-shadow:0 0 0 0 rgba(242,154,76,.6);transform:scale(1.6);opacity:0;transition:transform .3s,opacity .3s,box-shadow .45s`
    document.body.append(f)
    requestAnimationFrame(() => requestAnimationFrame(() => Object.assign(f.style, { opacity: '1', transform: 'scale(1)' })))
  }, [p.x, p.y])
  await kam.warten(380)
  await page.evaluate(() => (document.getElementById('finger').style.boxShadow = '0 0 0 18px rgba(242,154,76,0)'))
  await kam.warten(120)
  await page.evaluate(() => document.getElementById('finger')?.remove())
  await page.mouse.click(p.x, p.y)
}

const mitte = async (page, sel, nr = 0) => {
  const b = await page.locator(sel).nth(nr).boundingBox()
  // nur der sichtbare Teil zaehlt (Kachel halb unter dem Bildrand)
  return { x: b.x + b.width / 2, y: Math.min(b.y + b.height / 2, H - 40) }
}

/** Langsam scrollen (px je Bild) */
async function scrollen(page, kam, sel, px, ms) {
  const ende = performance.now() + ms
  while (performance.now() < ende) {
    await page.evaluate(([s, d]) => document.querySelector(s).scrollBy(0, d), [sel, px])
    await kam.foto()
  }
}

/** Kampagne: die Karte mit vier geschafften Missionen, Mission 5 wird angetippt, die Schlange waechst hin; dann Missionen */
async function kampagneClip(browser, port, spiel) {
  const page = await appSeite(browser, port, {
    'snake-kampagne': { geschafft: ['wiese-1', 'wiese-2', 'wiese-3', 'wiese-4'], erreicht: { wiese: 4 } },
    'snake.wallet.v1': { aepfel: 1250, skins: ['klassik'], skin: 'klassik', trophaeen: 0, verdient: 1250 },
  })
  await page.evaluate(() => document.getElementById('btn-kampagne').click())
  await page.waitForTimeout(900)
  const tmp = mkdtempSync(join(tmpdir(), 'hilfe-kampagne-'))
  const kam = appKamera(page, tmp, 0)
  kam.los()
  await kam.warten(1500)
  await tippen(page, kam, await page.evaluate(() => window.missionFeld(5)))
  // bis die Schlange angekommen ist (danach startet die Mission)
  await kam.warten(700)
  await page.close()
  const n = await segmenteFilmen(spiel, HILFE_CLIPS.kampagne, tmp, kam.n)
  kodieren('kampagne', tmp, 30)
  rmSync(tmp, { recursive: true, force: true })
  return n
}

/** Aussehen: Skins (einer wird gekauft), Accessoires (eins wird angelegt), Effekte */
async function aussehenClip(browser, port) {
  const page = await appSeite(browser, port, {
    'snake.wallet.v1': { aepfel: 24000, skins: ['klassik'], skin: 'klassik', trophaeen: 3, verdient: 30000 },
  })
  await page.evaluate(() => document.querySelector('[data-go="shop"]').click())
  await page.waitForTimeout(700)
  const tmp = mkdtempSync(join(tmpdir(), 'hilfe-aussehen-'))
  const kam = appKamera(page, tmp, 0)
  kam.los()
  await kam.warten(1200)
  const teil = async (nr, wahl, weit) => {
    // Kachel unter dem Bildrand: erst hinscrollen
    if (nr >= 4) await scrollen(page, kam, '#shop .page__body', 7, 1000)
    await tippen(page, kam, await mitte(page, '.aussehen__kachel', nr))
    await kam.warten(900)
    await scrollen(page, kam, '#shopteil .page__body', 5, weit)
    await kam.warten(300)
    if (wahl !== null) {
      await tippen(page, kam, await mitte(page, '#skins > button', wahl))
      await kam.warten(700)
    }
    await page.evaluate(() => document.querySelector('#shopteil [data-back]').click())
    await kam.warten(500)
  }
  await teil(1, 2, 500)
  await teil(2, 1, 300)
  await teil(4, null, 1400)
  await page.close()
  kodieren('aussehen', tmp, 20)
  rmSync(tmp, { recursive: true, force: true })
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] })
const nur = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const alle = HILFE ? Object.keys(HILFE_CLIPS).concat('aussehen') : ['kampagne', 'endlos', 'feedback', 'welten']
const welche = alle.filter((n) => !nur.length || nur.includes(n))
const app = ['feedback', ...(HILFE ? ['kampagne', 'aussehen'] : [])]
await spielClips(browser, welche.filter((n) => !app.includes(n)))
if (welche.includes('feedback')) await feedbackClip(browser)
if (HILFE && (welche.includes('kampagne') || welche.includes('aussehen'))) {
  const { createServer } = await import('vite')
  const server = await createServer({ server: { port: 5198, strictPort: true, watch: null }, logLevel: 'error' })
  await server.listen()
  if (welche.includes('kampagne')) {
    const spiel = await spielSeite(browser)
    await kampagneClip(browser, 5198, spiel)
    await spiel.close()
  }
  if (welche.includes('aussehen')) await aussehenClip(browser, 5198)
  await server.close()
}
await browser.close()
writeFileSync(join(ZIEL, 'LIESMICH.txt'), `Erzeugt mit: npm run ${HILFE ? 'hilfe' : 'patch'}-videos (scripts/patch-videos.mjs). Nicht von Hand bearbeiten.\n`)
