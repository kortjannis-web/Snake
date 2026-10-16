/**
 * Erzeugt alle App-Icons aus einer SVG-Vorlage (Schlange und Apfel auf Mokka):
 * PWA (public/icons) und, falls vorhanden, Android (android/app/src/main/res).
 * Aufruf: npm run icons
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

const motiv = (s = 1) => {
  const t = `translate(256 256) scale(${s}) translate(-256 -256)`
  return `
  <defs>
    <linearGradient id="sn" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#124237"/>
      <stop offset="1" stop-color="#2F8F74"/>
    </linearGradient>
    <radialGradient id="ap" cx="0.35" cy="0.3" r="0.8">
      <stop offset="0" stop-color="#FF7A66"/>
      <stop offset="0.45" stop-color="#E5463B"/>
      <stop offset="1" stop-color="#A3241D"/>
    </radialGradient>
  </defs>
  <g transform="${t}">
    <path d="M110 392 L318 392 Q398 392 398 318 L398 306 Q398 232 318 232 L206 232 Q132 232 132 172 Q132 122 196 122 L222 122"
      fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="74" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 10)"/>
    <path d="M110 392 L318 392 Q398 392 398 318 L398 306 Q398 232 318 232 L206 232 Q132 232 132 172 Q132 122 196 122 L222 122"
      fill="none" stroke="url(#sn)" stroke-width="74" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="226" cy="122" r="44" fill="#2F8F74"/>
    <circle cx="238" cy="104" r="13" fill="#fff"/><circle cx="242" cy="104" r="6.5" fill="#16211d"/>
    <circle cx="238" cy="140" r="13" fill="#fff"/><circle cx="242" cy="140" r="6.5" fill="#16211d"/>
    <g transform="translate(360 132)">
      <ellipse cx="0" cy="62" rx="50" ry="13" fill="rgba(0,0,0,0.3)"/>
      <path d="M0 -38 C21 -63 66 -57 61 -3 C58 38 34 61 13 57 C5 55 -5 55 -13 57 C-34 61 -58 38 -61 -3 C-66 -57 -21 -63 0 -38 Z" fill="url(#ap)"/>
      <ellipse cx="-27" cy="-17" rx="10" ry="16" fill="rgba(255,255,255,0.5)" transform="rotate(-28 -27 -17)"/>
      <path d="M0 -34 Q3 -58 13 -69" stroke="#6B4A2A" stroke-width="8" fill="none" stroke-linecap="round"/>
      <path d="M7 -56 Q30 -78 52 -60 Q28 -44 7 -56 Z" fill="#4FA65A"/>
    </g>
  </g>`
}

const bg = (r) => `<rect width="512" height="512" rx="${r}" fill="#1D1B19"/>
  <rect width="512" height="512" rx="${r}" fill="url(#glow)"/>
  <defs><radialGradient id="glow" cx="0.5" cy="0.35" r="0.7"><stop offset="0" stop-color="#2a3a33"/><stop offset="1" stop-color="#1D1B19" stop-opacity="0"/></radialGradient></defs>`

const svg = (inner) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${inner}</svg>`)
const voll = svg(bg(112) + motiv(0.92))
const maskable = svg(bg(0) + motiv(0.7))
const vordergrund = svg(motiv(0.6))
const rund = svg(`<circle cx="256" cy="256" r="256" fill="#1D1B19"/>` + motiv(0.74))

const png = (src, size, out) => sharp(src, { density: 384 }).resize(size, size).png().toFile(out)

mkdirSync('public/icons', { recursive: true })
await png(voll, 192, 'public/icons/icon-192.png')
await png(voll, 512, 'public/icons/icon-512.png')
await png(maskable, 512, 'public/icons/icon-maskable-512.png')
await png(maskable, 180, 'public/icons/apple-touch-icon.png')
writeFileSync('public/icons/icon.svg', voll)
console.log('PWA-Icons erzeugt')

const res = 'android/app/src/main/res'
if (existsSync(res)) {
  const dichten = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
  for (const [d, f] of Object.entries(dichten)) {
    const dir = `${res}/mipmap-${d}`
    mkdirSync(dir, { recursive: true })
    await png(maskable, Math.round(48 * f), `${dir}/ic_launcher.png`)
    await png(rund, Math.round(48 * f), `${dir}/ic_launcher_round.png`)
    await png(vordergrund, Math.round(108 * f), `${dir}/ic_launcher_foreground.png`)
  }
  mkdirSync(`${res}/values`, { recursive: true })
  writeFileSync(
    `${res}/values/ic_launcher_background.xml`,
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#1D1B19</color>\n</resources>\n`,
  )
  // Startbild (Splash): Motiv mittig auf Mokka
  const splash = (w, h) =>
    sharp({ create: { width: w, height: h, channels: 4, background: '#171513' } })
      .composite([{ input: svg(motiv(0.9)), density: 384, gravity: 'center' }])
      .png()
  const splashes = { '': [480, 800], 'port-mdpi': [320, 480], 'port-hdpi': [480, 800], 'port-xhdpi': [720, 1280], 'port-xxhdpi': [960, 1600], 'port-xxxhdpi': [1280, 1920], 'land-mdpi': [480, 320], 'land-hdpi': [800, 480], 'land-xhdpi': [1280, 720], 'land-xxhdpi': [1600, 960], 'land-xxxhdpi': [1920, 1280] }
  for (const [k, [w, h]] of Object.entries(splashes)) {
    const dir = `${res}/drawable${k ? '-' + k : ''}`
    if (!existsSync(dir)) continue
    const logo = await sharp(svg(motiv(0.9)), { density: 384 }).resize(Math.round(Math.min(w, h) * 0.45)).png().toBuffer()
    await sharp({ create: { width: w, height: h, channels: 4, background: '#171513' } }).composite([{ input: logo, gravity: 'center' }]).png().toFile(`${dir}/splash.png`)
    void splash
  }
  console.log('Android-Icons erzeugt')
}
