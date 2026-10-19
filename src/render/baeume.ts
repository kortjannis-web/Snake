/**
 * Baeume je Welt, von oben gesehen. Stehend belegt ein Baum ein Plus (Mitte und vier Nachbarn), die Krone
 * fuellt die Ecken dazwischen etwas auf, damit sie rund wirkt. Liegend 1-1-3-1 Felder (Stamm, Stamm, Krone
 * drei breit, Spitze). Kurz vor dem Umfallen wackelt der Baum und verliert ein paar Blaetter in Fallrichtung.
 */
import type { Dir, P } from '../game/types'

export type BaumArt = 'laub' | 'kirsche' | 'herbst' | 'tanne' | 'weihnacht' | 'palme' | 'kaktus' | 'kristall' | 'pilz' | 'totbaum'

const TAU = Math.PI * 2
const ROT: Record<Dir, number> = { r: 0, d: Math.PI / 2, l: Math.PI, u: -Math.PI / 2 }
const STEP: Record<Dir, P> = { r: { x: 1, y: 0 }, l: { x: -1, y: 0 }, d: { x: 0, y: 1 }, u: { x: 0, y: -1 } }
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Schatten nach unten, unabhaengig von Drehung und Skalierung */
function schatten(ctx: CanvasRenderingContext2D, u: number, a = 0.3, tiefe = 0.14) {
  const m = ctx.getTransform()
  ctx.shadowColor = `rgba(12, 40, 32, ${a})`
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = u * tiefe * Math.hypot(m.a, m.b)
  ctx.shadowBlur = u * 0.05 * Math.hypot(m.a, m.b)
}
const ohneSchatten = (ctx: CanvasRenderingContext2D) => {
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
}

/* ================= Laubkronen (Laub, Kirsche, Herbst) ================= */

type Lappen = [number, number, number]
const KRONE_FARBEN: Record<string, [string, string, string, string]> = {
  laub: ['#2F7A3E', '#3E9A4E', '#58B860', '#8AD67A'],
  kirsche: ['#C9578C', '#E07CAA', '#F3A7C9', '#FFE2EE'],
  herbst: ['#A8401C', '#D2612A', '#EE9638', '#FFD27A'],
  pilz: ['#5B2A8C', '#7C3FC0', '#A86BEA', '#7CF5FF'],
}
/** Stehend: Mitte, vier Arme und kleinere Bueschel in den Ecken (rundet das Plus) */
const PLUS: Lappen[] = [
  [0, 0, 0.68],
  [0.82, 0, 0.5],
  [-0.82, 0, 0.5],
  [0, 0.82, 0.5],
  [0, -0.82, 0.5],
  [0.52, 0.52, 0.34],
  [-0.52, 0.52, 0.34],
  [0.52, -0.52, 0.34],
  [-0.52, -0.52, 0.34],
]
/** Liegend (ab Stammende, entlang +x): Krone in Feld 2 drei breit, Spitze in Feld 3, Luecken aufgefuellt */
const LIEGEND: Lappen[] = [
  [2.05, 0, 0.64],
  [2.0, -0.95, 0.5],
  [2.0, 0.95, 0.5],
  [2.95, 0, 0.5],
  [2.5, 0, 0.52],
  [1.62, 0, 0.46],
  [1.6, -0.55, 0.36],
  [1.6, 0.55, 0.36],
  [2.5, -0.55, 0.38],
  [2.5, 0.55, 0.38],
]

function krone(ctx: CanvasRenderingContext2D, u: number, art: string, lappen: Lappen[], seed: number) {
  const f = KRONE_FARBEN[art] ?? KRONE_FARBEN.laub
  ctx.save()
  schatten(ctx, u, 0.32, 0.16)
  ctx.fillStyle = f[0]
  ctx.beginPath()
  for (const [x, y, r] of lappen) {
    ctx.moveTo(x * u + r * u, y * u)
    ctx.arc(x * u, y * u, r * u, 0, TAU)
  }
  ctx.fill()
  ohneSchatten(ctx)
  // Blattbueschel, nach oben links heller (Licht von oben links)
  for (const [lage, off, kl] of [[1, -0.05, 0.8], [2, -0.11, 0.52]] as const) {
    ctx.fillStyle = f[lage]
    ctx.beginPath()
    for (const [x, y, r] of lappen) {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + x * 2 + y + seed
        const rr = r * kl * 0.55
        const cx = (x + Math.cos(a) * r * 0.32 + off) * u
        const cy = (y + Math.sin(a) * r * 0.32 + off) * u
        ctx.moveTo(cx + rr * u, cy)
        ctx.arc(cx, cy, rr * u, 0, TAU)
      }
    }
    ctx.fill()
  }
  // Akzente je Lappen: Aepfel, Blueten, Leuchtpunkte
  lappen.forEach(([x, y, r], i) => {
    if (art === 'laub') {
      if (hash(i * 7.7 + seed) > 0.45 || r < 0.4) return
      ctx.fillStyle = '#E5463B'
      ctx.beginPath()
      ctx.arc((x + r * 0.35) * u, (y - r * 0.1) * u, u * 0.08, 0, TAU)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.beginPath()
      ctx.arc((x + r * 0.32) * u, (y - r * 0.16) * u, u * 0.025, 0, TAU)
      ctx.fill()
    } else {
      ctx.fillStyle = f[3]
      for (let k = 0; k < (art === 'pilz' ? 2 : 4); k++) {
        const a = hash(i * 9 + k + seed) * TAU
        const rr = hash(i * 5 + k + 3) * r * 0.7
        ctx.beginPath()
        ctx.arc((x + Math.cos(a) * rr) * u, (y + Math.sin(a) * rr) * u, u * (art === 'pilz' ? 0.06 : 0.045), 0, TAU)
        ctx.fill()
      }
    }
  })
  ctx.restore()
}

/* ================= Tanne mit acht Spitzen ================= */

/** Tanne von oben: acht Spitzen (vier lange, vier kurze) in drei Lagen, jede Spitze mit heller und dunkler Seite.
 *  schnee: weisse Spitzen; weihnacht: Kugeln, Lichterkette und Stern */
function tanne(ctx: CanvasRenderingContext2D, u: number, schnee: boolean, weihnacht: boolean, now: number, seed: number) {
  ctx.save()
  schatten(ctx, u, 0.32, 0.16)
  const lagen: [number, string, string][] = schnee
    ? [[1, '#2E6A48', '#3F8A5E'], [0.7, '#36795A', '#E9F3F8'], [0.42, '#CFE2EC', '#FFFFFF']]
    : [[1, '#1F6234', '#2E8448'], [0.7, '#2A7A43', '#46A563'], [0.42, '#3A9256', '#62C27E']]
  // Rundes, weiches Fundament unter den Spitzen: ein Kreis mit acht Wuelsten (keine harten Winkel)
  ctx.fillStyle = lagen[0][1]
  ctx.beginPath()
  ctx.arc(0, 0, u * 0.82, 0, TAU)
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4
    const d = u * (i % 2 ? 0.72 : 0.86)
    ctx.moveTo(Math.cos(a) * d + u * 0.34, Math.sin(a) * d)
    ctx.arc(Math.cos(a) * d, Math.sin(a) * d, u * 0.34, 0, TAU)
  }
  ctx.fill()
  ohneSchatten(ctx)
  ctx.fillStyle = schnee ? 'rgba(240, 248, 252, 0.9)' : 'rgba(90, 170, 110, 0.35)'
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * 1.05 + (i / 4) * Math.PI * 0.75
    ctx.beginPath()
    ctx.arc(Math.cos(a) * u * 0.78, Math.sin(a) * u * 0.78, u * 0.2, 0, TAU)
    ctx.fill()
  }
  ctx.lineJoin = 'round'
  lagen.forEach(([k, dunkel, hell], lage) => {
    for (let i = 0; i < 8; i++) {
      const w = (i * Math.PI) / 4
      const lang = i % 2 === 0
      const sp = (lang ? 1.28 : 1.05) * u * k
      const breite = Math.PI / (lang ? 5.5 : 7)
      const ecke = 0.5 * u * k
      const tx = Math.cos(w) * sp
      const ty = Math.sin(w) * sp
      const lx = Math.cos(w - breite) * ecke
      const ly = Math.sin(w - breite) * ecke
      const rx = Math.cos(w + breite) * ecke
      const ry = Math.sin(w + breite) * ecke
      // Licht von oben links: die Seite, die dorthin zeigt, ist hell
      const links = Math.cos(w - Math.PI / 2 - Math.PI * 1.25) > 0
      // Facetten mit gleichfarbigem, rundem Rand: die Spitzen werden weicher
      ctx.lineWidth = u * 0.09 * k
      ctx.fillStyle = ctx.strokeStyle = links ? hell : dunkel
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(lx, ly)
      ctx.lineTo(tx, ty)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = ctx.strokeStyle = links ? dunkel : hell
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(rx, ry)
      ctx.lineTo(tx, ty)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      // kleine Zweige an den langen Spitzen
      if (lang && lage === 0) {
        ctx.fillStyle = dunkel
        for (const t of [0.55, 0.78]) {
          for (const s of [-1, 1]) {
            const bx = Math.cos(w) * sp * t
            const by = Math.sin(w) * sp * t
            const zx = bx + Math.cos(w + s * 1.2) * u * 0.18 * k
            const zy = by + Math.sin(w + s * 1.2) * u * 0.18 * k
            ctx.beginPath()
            ctx.moveTo(bx + Math.cos(w) * u * 0.08, by + Math.sin(w) * u * 0.08)
            ctx.lineTo(zx, zy)
            ctx.lineTo(bx - Math.cos(w) * u * 0.1, by - Math.sin(w) * u * 0.1)
            ctx.fill()
          }
        }
      }
      if (schnee && lage === 0 && lang) {
        ctx.fillStyle = 'rgba(255,255,255,0.95)'
        ctx.beginPath()
        ctx.moveTo(tx, ty)
        ctx.lineTo(lerp(tx, lx, 0.3), lerp(ty, ly, 0.3))
        ctx.lineTo(lerp(tx, 0, 0.25), lerp(ty, 0, 0.25))
        ctx.lineTo(lerp(tx, rx, 0.3), lerp(ty, ry, 0.3))
        ctx.fill()
      }
    }
    ohneSchatten(ctx)
  })
  if (weihnacht) {
    // Lichterkette als Spirale, Kugeln, Stern oben
    for (let i = 0; i < 18; i++) {
      const t = i / 18
      const a = t * TAU * 2 + seed
      const r = u * (0.25 + t * 0.95)
      const an = Math.sin(now / 300 + i * 1.7) > 0
      ctx.fillStyle = an ? ['#FFE680', '#FF9E9E', '#9EE6FF'][i % 3] : 'rgba(255,255,255,0.35)'
      ctx.beginPath()
      ctx.arc(Math.cos(a) * r, Math.sin(a) * r, u * 0.045, 0, TAU)
      ctx.fill()
    }
    const kugeln = ['#E63946', '#F5C542', '#3A86FF', '#E63946', '#B5179E', '#F5C542']
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.3 + seed
      const r = u * (0.55 + hash(i + seed) * 0.5)
      ctx.fillStyle = kugeln[i]
      ctx.beginPath()
      ctx.arc(Math.cos(a) * r, Math.sin(a) * r, u * 0.09, 0, TAU)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.beginPath()
      ctx.arc(Math.cos(a) * r - u * 0.03, Math.sin(a) * r - u * 0.03, u * 0.03, 0, TAU)
      ctx.fill()
    }
    ctx.fillStyle = '#FFD84D'
    ctx.strokeStyle = '#C9971C'
    ctx.lineWidth = Math.max(1, u * 0.03)
    ctx.beginPath()
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? u * 0.09 : u * 0.22
      const a = (i / 10) * TAU - Math.PI / 2
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
    }
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  } else {
    ctx.fillStyle = schnee ? '#FFFFFF' : '#6CC987'
    ctx.beginPath()
    ctx.arc(0, 0, u * 0.12, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}

/** Liegende Tanne: Dreieck in Etagen mit heller und dunkler Haelfte */
function tanneLiegend(ctx: CanvasRenderingContext2D, u: number, schnee: boolean, weihnacht: boolean) {
  for (const [off, k] of [[0, 1], [0.45, 0.72], [0.85, 0.45]] as const) {
    const bx = (1.5 + off) * u
    const half = 1.45 * u * k
    const spitze = 3.48 * u
    ctx.save()
    if (off === 0) schatten(ctx, u, 0.3, 0.12)
    ctx.fillStyle = schnee ? '#2E6A48' : off === 0 ? '#1F6234' : off < 0.5 ? '#2A7A43' : '#3A9256'
    ctx.beginPath()
    ctx.moveTo(bx, -half)
    ctx.lineTo(bx + 0.95 * u * (1 - off * 0.3), -half * 0.55)
    ctx.lineTo(bx + 1.0 * u * (1 - off * 0.3), -half * 0.3)
    ctx.lineTo(spitze, 0)
    ctx.lineTo(bx + 1.0 * u * (1 - off * 0.3), half * 0.3)
    ctx.lineTo(bx + 0.95 * u * (1 - off * 0.3), half * 0.55)
    ctx.lineTo(bx, half)
    ctx.lineTo(bx - 0.12 * u, 0.3 * u)
    ctx.lineTo(bx, 0)
    ctx.lineTo(bx - 0.12 * u, -0.3 * u)
    ctx.closePath()
    ctx.fill()
    ohneSchatten(ctx)
    // obere Haelfte heller
    ctx.fillStyle = schnee ? 'rgba(240, 248, 252, 0.9)' : 'rgba(110, 200, 130, 0.35)'
    ctx.beginPath()
    ctx.moveTo(bx, -half)
    ctx.lineTo(bx + 0.95 * u * (1 - off * 0.3), -half * 0.55)
    ctx.lineTo(bx + 1.0 * u * (1 - off * 0.3), -half * 0.3)
    ctx.lineTo(spitze, 0)
    ctx.lineTo(bx + 0.1 * u, 0)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  if (weihnacht) {
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = ['#E63946', '#F5C542', '#3A86FF'][i % 3]
      ctx.beginPath()
      ctx.arc((1.8 + hash(i) * 1.4) * u, (hash(i + 4) - 0.5) * 1.6 * u * (1 - hash(i) * 0.5), u * 0.08, 0, TAU)
      ctx.fill()
    }
  }
}

/* ================= Palme und Kaktus ================= */

function palmWedel(ctx: CanvasRenderingContext2D, u: number, now: number, gross = 1) {
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + Math.sin(now / 900 + i) * 0.04
    const l = (i % 2 ? 1.2 : 1.42) * u * gross
    ctx.save()
    if (i === 0) schatten(ctx, u, 0.3, 0.2)
    ctx.rotate(a)
    ctx.fillStyle = i % 2 ? '#47A447' : '#2E7D32'
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.quadraticCurveTo(l * 0.5, -u * 0.34, l, 0)
    ctx.quadraticCurveTo(l * 0.5, u * 0.34, 0, 0)
    ctx.fill()
    ohneSchatten(ctx)
    ctx.strokeStyle = 'rgba(20, 60, 20, 0.5)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(l * 0.95, 0)
    // Fiederblaetter angedeutet
    for (let k = 1; k < 5; k++) {
      ctx.moveTo(l * k * 0.2, 0)
      ctx.lineTo(l * k * 0.2 + u * 0.08, -u * 0.12 * (1 - k * 0.15))
      ctx.moveTo(l * k * 0.2, 0)
      ctx.lineTo(l * k * 0.2 + u * 0.08, u * 0.12 * (1 - k * 0.15))
    }
    ctx.stroke()
    ctx.restore()
  }
  ctx.fillStyle = '#7A5230'
  for (const [x, y] of [[0.1, 0.08], [-0.1, 0.05], [0, -0.1]]) {
    ctx.beginPath()
    ctx.arc(x * u, y * u, u * 0.1, 0, TAU)
    ctx.fill()
  }
}

function kaktus(ctx: CanvasRenderingContext2D, u: number, bluete: boolean) {
  ctx.save()
  schatten(ctx, u, 0.35, 0.14)
  ctx.fillStyle = '#3E8E4A'
  ctx.beginPath()
  ctx.arc(0, 0, u * 0.5, 0, TAU)
  for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    ctx.moveTo(x * u * 0.9 + u * 0.27, y * u * 0.9)
    ctx.arc(x * u * 0.9, y * u * 0.9, u * 0.27, 0, TAU)
  }
  ctx.fill()
  ohneSchatten(ctx)
  ctx.lineWidth = u * 0.18
  ctx.strokeStyle = '#3E8E4A'
  ctx.beginPath()
  for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    ctx.moveTo(0, 0)
    ctx.lineTo(x * u * 0.9, y * u * 0.9)
  }
  ctx.stroke()
  ctx.fillStyle = 'rgba(160, 230, 150, 0.3)'
  ctx.beginPath()
  ctx.arc(-u * 0.12, -u * 0.12, u * 0.3, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = '#2C6B37'
  ctx.lineWidth = Math.max(1, u * 0.03)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(Math.cos(a) * u * 0.47, Math.sin(a) * u * 0.47)
    ctx.stroke()
  }
  ctx.fillStyle = '#F7F1D5'
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU + 0.2
    const r = i % 2 ? 0.34 : 0.2
    ctx.fillRect(Math.cos(a) * u * r, Math.sin(a) * u * r, Math.max(1, u * 0.03), Math.max(1, u * 0.03))
  }
  for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU
      ctx.fillRect(x * u * 0.9 + Math.cos(a) * u * 0.16, y * u * 0.9 + Math.sin(a) * u * 0.16, Math.max(1, u * 0.025), Math.max(1, u * 0.025))
    }
  if (bluete) {
    ctx.fillStyle = '#FF6FA0'
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU
      ctx.beginPath()
      ctx.ellipse(Math.cos(a) * u * 0.08, Math.sin(a) * u * 0.08, u * 0.08, u * 0.05, a, 0, TAU)
      ctx.fill()
    }
    ctx.fillStyle = '#FFD84D'
    ctx.beginPath()
    ctx.arc(0, 0, u * 0.045, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}

/* ================= Kristall (Bergwerk) ================= */

const KRISTALL: [string, string, string][] = [
  ['#5A2C9C', '#9B6BEA', '#E2CCFF'],
  ['#1C6E8C', '#3FB4DA', '#C8F6FF'],
]

/** Ein Kristall, der aus dem Boden ragt (seitlich gesehen): sechseckiges Prisma mit Spitze. x/y = Fuss, h = Hoehe,
 *  b = Breite, neig = Neigung (Bogenmass), ab = abgebrochen (oben eine schraege Bruchkante statt Spitze) */
function kristallSaeule(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, b: number, neig: number, f: [string, string, string], ab = false) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(neig)
  const sp = ab ? 0 : b * 0.9
  const oben = -h + sp
  // linke helle, mittlere, rechte dunkle Flaeche
  const flaeche = (pts: [number, number][], farbe: string) => {
    ctx.fillStyle = farbe
    ctx.beginPath()
    pts.forEach(([a, c], i) => (i ? ctx.lineTo(a, c) : ctx.moveTo(a, c)))
    ctx.closePath()
    ctx.fill()
  }
  if (ab) {
    flaeche([[-b / 2, 0], [-b / 2, oben + b * 0.25], [-b * 0.1, oben - b * 0.05], [-b * 0.1, 0]], f[2])
    flaeche([[-b * 0.1, 0], [-b * 0.1, oben - b * 0.05], [b * 0.2, oben + b * 0.3], [b * 0.2, 0]], f[1])
    flaeche([[b * 0.2, 0], [b * 0.2, oben + b * 0.3], [b / 2, oben + b * 0.1], [b / 2, 0]], f[0])
    // Bruchflaeche
    flaeche([[-b / 2, oben + b * 0.25], [-b * 0.1, oben - b * 0.05], [b * 0.2, oben + b * 0.3], [b / 2, oben + b * 0.1], [b * 0.1, oben + b * 0.45]], 'rgba(255,255,255,0.75)')
  } else {
    flaeche([[-b / 2, 0], [-b / 2, oben], [0, -h], [-b * 0.1, oben], [-b * 0.1, 0]], f[2])
    flaeche([[-b * 0.1, 0], [-b * 0.1, oben], [0, -h], [b * 0.2, oben], [b * 0.2, 0]], f[1])
    flaeche([[b * 0.2, 0], [b * 0.2, oben], [0, -h], [b / 2, oben], [b / 2, 0]], f[0])
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    ctx.lineWidth = Math.max(1, b * 0.06)
    ctx.beginPath()
    ctx.moveTo(-b * 0.32, -h * 0.15)
    ctx.lineTo(-b * 0.32, oben + b * 0.1)
    ctx.stroke()
  }
  ctx.restore()
}

/** Felssockel, aus dem die Kristalle wachsen (Ellipse am Boden mit Steinen) */
function kristallSockel(ctx: CanvasRenderingContext2D, u: number, seed: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.beginPath()
  ctx.ellipse(u * 0.05, u * 0.38, u * 0.95, u * 0.32, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#4B4650'
  ctx.beginPath()
  ctx.ellipse(0, u * 0.3, u * 0.85, u * 0.28, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#6A6370'
  for (let i = 0; i < 5; i++) {
    ctx.beginPath()
    ctx.ellipse((hash(i + seed) - 0.5) * u * 1.4, u * (0.25 + hash(i * 3 + seed) * 0.12), u * 0.16, u * 0.09, 0, 0, TAU)
    ctx.fill()
  }
}

/** Kristallgruppe, die aus dem Boden ragt (Bergwerk statt Baum). Der grosse Kristall in der Mitte reicht ins Feld darueber */
function kristall(ctx: CanvasRenderingContext2D, u: number, now: number, seed: number) {
  const f = KRISTALL[hash(seed) > 0.5 ? 0 : 1]
  const puls = 0.22 + 0.1 * Math.sin(now / 700 + seed)
  const g = ctx.createRadialGradient(0, -u * 0.3, 0, 0, -u * 0.3, u * 1.7)
  g.addColorStop(0, f === KRISTALL[0] ? `rgba(190, 140, 255, ${puls})` : `rgba(110, 220, 255, ${puls})`)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(-u * 1.7, -u * 2, u * 3.4, u * 3.4)
  kristallSockel(ctx, u, seed)
  // hinten kleine, vorne grosse; der mittlere ragt bis ins obere Feld
  for (const [x, h, b, n] of [[-0.75, 0.75, 0.3, -0.5], [0.8, 0.85, 0.32, 0.45], [-0.4, 1.05, 0.38, -0.25], [0.42, 1.15, 0.4, 0.22], [0, 1.75, 0.55, 0.02], [-0.18, 0.7, 0.26, -0.1], [0.3, 0.6, 0.24, 0.35]] as const)
    kristallSaeule(ctx, x * u, u * 0.3, h * u, b * u, n, f)
  const tw = Math.max(0, Math.sin(now / 400 + seed * 3))
  ctx.strokeStyle = `rgba(255,255,255,${tw})`
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(-u * 0.12, -u * 1.35)
  ctx.lineTo(-u * 0.12, -u * 1.05)
  ctx.moveTo(-u * 0.27, -u * 1.2)
  ctx.lineTo(u * 0.03, -u * 1.2)
  ctx.stroke()
}

/** Abgebrochen und umgefallen: Stumpf am Fuss, der grosse Kristall liegt in Fallrichtung, Splitter daneben */
function kristallLiegend(ctx: CanvasRenderingContext2D, u: number, seed: number) {
  const f = KRISTALL[hash(seed) > 0.5 ? 0 : 1]
  // Stumpf (bleibt am Stamm-Feld stehen); die Zeichnung ist hier entlang +x gedreht, der Stumpf zeigt nach "oben" im Bild:
  // dafuer zurueckdrehen
  const m = ctx.getTransform()
  const dreh = Math.atan2(m.b, m.a)
  ctx.save()
  ctx.rotate(-dreh)
  ctx.scale(0.75, 0.75)
  kristallSockel(ctx, u, seed)
  for (const [x, h, b, n] of [[-0.45, 0.6, 0.3, -0.3], [0.45, 0.5, 0.3, 0.3], [0, 0.55, 0.5, 0]] as const) kristallSaeule(ctx, x * u, u * 0.3, h * u, b * u, n, f, true)
  ctx.restore()
  // Liegender Kristall: langes Prisma, Bruchkante am Stamm, Spitze am Ende
  ctx.save()
  schatten(ctx, u, 0.4, 0.12)
  ctx.fillStyle = f[1]
  ctx.beginPath()
  ctx.moveTo(0.35 * u, -0.38 * u)
  ctx.lineTo(2.85 * u, -0.42 * u)
  ctx.lineTo(3.48 * u, 0)
  ctx.lineTo(2.85 * u, 0.42 * u)
  ctx.lineTo(0.35 * u, 0.38 * u)
  ctx.lineTo(0.45 * u, 0.1 * u)
  ctx.lineTo(0.3 * u, -0.12 * u)
  ctx.closePath()
  ctx.fill()
  ohneSchatten(ctx)
  ctx.fillStyle = f[2]
  ctx.beginPath()
  ctx.moveTo(0.35 * u, -0.38 * u)
  ctx.lineTo(2.85 * u, -0.42 * u)
  ctx.lineTo(3.48 * u, 0)
  ctx.lineTo(0.35 * u, -0.06 * u)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = f[0]
  ctx.beginPath()
  ctx.moveTo(0.4 * u, 0.16 * u)
  ctx.lineTo(3.1 * u, 0.2 * u)
  ctx.lineTo(2.85 * u, 0.42 * u)
  ctx.lineTo(0.35 * u, 0.38 * u)
  ctx.closePath()
  ctx.fill()
  // Splitter in Feld 2 (drei breit)
  for (const [x, y, r] of [[2.0, -0.95, 0.28], [2.0, 0.95, 0.28], [1.5, -0.62, 0.16], [2.5, 0.68, 0.18], [1.2, 0.6, 0.12]] as const) {
    ctx.save()
    ctx.translate(x * u, y * u)
    ctx.rotate(hash(x * 7 + y + seed) * TAU)
    ctx.fillStyle = f[2]
    ctx.beginPath()
    ctx.moveTo(-r * u, 0)
    ctx.lineTo(0, -r * u * 0.5)
    ctx.lineTo(r * u, 0)
    ctx.lineTo(0, r * u * 0.5)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = f[0]
    ctx.beginPath()
    ctx.moveTo(-r * u, 0)
    ctx.lineTo(r * u, 0)
    ctx.lineTo(0, r * u * 0.5)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  ctx.restore()
}

/* ================= Fliegenpilz (Zauberwald) und toter Baum (Gruselwald) ================= */

/** Fliegenpilz-Hut von oben: rund, rot, mit weissen Tupfen und hellem Rand, leicht magisch leuchtend */
function pilzHut(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, now: number, seed: number) {
  const puls = 0.25 + 0.12 * Math.sin(now / 800 + seed)
  const g = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 1.5)
  g.addColorStop(0, `rgba(255, 120, 180, ${puls})`)
  g.addColorStop(1, 'rgba(255, 120, 180, 0)')
  ctx.fillStyle = g
  ctx.fillRect(x - r * 1.5, y - r * 1.5, r * 3, r * 3)
  ctx.save()
  schatten(ctx, r, 0.45, 0.25)
  const hut = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r)
  hut.addColorStop(0, '#FF6A55')
  hut.addColorStop(0.6, '#D62A26')
  hut.addColorStop(1, '#8E1418')
  ctx.fillStyle = hut
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
  ctx.fill()
  ohneSchatten(ctx)
  ctx.strokeStyle = 'rgba(255, 220, 200, 0.55)'
  ctx.lineWidth = Math.max(1, r * 0.06)
  ctx.beginPath()
  ctx.arc(x, y, r * 0.94, 0, TAU)
  ctx.stroke()
  // Weisse Tupfen, die groesseren zur Mitte hin
  ctx.fillStyle = '#FFF8F0'
  const tupfen: [number, number, number][] = [[0, 0, 0.17], [0.5, -0.2, 0.13], [-0.45, -0.32, 0.12], [-0.2, 0.5, 0.12], [0.35, 0.45, 0.11], [0.68, 0.25, 0.08], [-0.66, 0.15, 0.09], [0.1, -0.62, 0.1], [-0.55, 0.55, 0.07], [0.62, -0.55, 0.07]]
  for (const [dx, dy, s] of tupfen) {
    ctx.beginPath()
    ctx.ellipse(x + dx * r, y + dy * r, s * r, s * r * 0.85, hash(dx + dy + seed), 0, TAU)
    ctx.fill()
  }
  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.beginPath()
  ctx.ellipse(x - r * 0.4, y - r * 0.45, r * 0.32, r * 0.16, -0.6, 0, TAU)
  ctx.fill()
  ctx.restore()
}

function pilz(ctx: CanvasRenderingContext2D, u: number, now: number, seed: number) {
  // Ein grosser, runder Fliegenpilz (darf ueber die Ecken ragen), dazu zwei kleine an der Seite
  pilzHut(ctx, u * 0.85, u * 0.75, u * 0.32, now, seed + 1)
  pilzHut(ctx, -u * 0.9, -u * 0.6, u * 0.26, now, seed + 2)
  pilzHut(ctx, 0, 0, u * 1.3, now, seed)
}

function pilzLiegend(ctx: CanvasRenderingContext2D, u: number, now: number, seed: number) {
  // Stiel mit Ring, der Hut liegt am Ende
  ctx.save()
  schatten(ctx, u, 0.35, 0.12)
  const st = ctx.createLinearGradient(0, -0.3 * u, 0, 0.3 * u)
  st.addColorStop(0, '#FFFFFF')
  st.addColorStop(1, '#D9CFC4')
  ctx.fillStyle = st
  ctx.beginPath()
  ctx.roundRect(-0.45 * u, -0.26 * u, 2.2 * u, 0.52 * u, 0.22 * u)
  ctx.fill()
  ohneSchatten(ctx)
  ctx.fillStyle = '#EDE4D8'
  ctx.beginPath()
  ctx.ellipse(1.1 * u, 0, 0.14 * u, 0.36 * u, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#C9BFB2'
  ctx.beginPath()
  ctx.ellipse(-0.45 * u, 0, 0.12 * u, 0.24 * u, 0, 0, TAU)
  ctx.fill()
  ctx.restore()
  pilzHut(ctx, 2.3 * u, 0, u * 1.15, now, seed)
}

function totbaum(ctx: CanvasRenderingContext2D, u: number, seed: number, liegend: boolean) {
  // Kahle, krumme Aeste von oben (stehend: von der Mitte in acht Richtungen; liegend: am Stamm entlang)
  ctx.save()
  schatten(ctx, u, 0.45, 0.14)
  ctx.strokeStyle = '#3A2E33'
  ctx.lineCap = 'round'
  const ast = (x: number, y: number, a: number, l: number, d: number, tiefe: number) => {
    if (tiefe > 3 || l < 0.12) return
    const kn = (hash(x * 13 + y * 7 + tiefe + seed) - 0.5) * 0.7
    const mx = x + Math.cos(a + kn) * l * 0.5
    const my = y + Math.sin(a + kn) * l * 0.5
    const ex = x + Math.cos(a) * l
    const ey = y + Math.sin(a) * l
    ctx.lineWidth = d * u
    ctx.beginPath()
    ctx.moveTo(x * u, y * u)
    ctx.quadraticCurveTo(mx * u, my * u, ex * u, ey * u)
    ctx.stroke()
    ast(ex, ey, a - 0.5 - hash(tiefe + x) * 0.3, l * 0.58, d * 0.6, tiefe + 1)
    ast(ex, ey, a + 0.45 + hash(tiefe + y) * 0.3, l * 0.52, d * 0.6, tiefe + 1)
  }
  if (liegend) {
    ctx.lineWidth = 0.36 * u
    ctx.beginPath()
    ctx.moveTo(-0.45 * u, 0)
    ctx.quadraticCurveTo(1.2 * u, 0.12 * u, 2.2 * u, -0.05 * u)
    ctx.stroke()
    for (const [x, a, l] of [[1.6, -1.2, 1.0], [1.7, 1.3, 1.0], [2.2, -0.5, 1.0], [2.2, 0.5, 1.0], [2.0, 0, 1.3]] as const) ast(x, 0, a, l, 0.12, 0)
  } else {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + (hash(i + seed) - 0.5) * 0.3
      ast(0, 0, a, i % 2 ? 0.95 : 1.3, 0.16, 0)
    }
    ctx.fillStyle = '#2A2025'
    ctx.beginPath()
    ctx.arc(0, 0, u * 0.3, 0, TAU)
    ctx.fill()
  }
  ohneSchatten(ctx)
  // Ein paar welke Blaetter und eine Kraehe? Nur Blaetter
  ctx.fillStyle = 'rgba(120, 70, 40, 0.8)'
  for (let i = 0; i < 5; i++) {
    const a = hash(i * 3 + seed) * TAU
    const r = 0.4 + hash(i + seed * 2) * 0.8
    ctx.beginPath()
    ctx.ellipse((liegend ? 2 : 0) * u + Math.cos(a) * r * u, Math.sin(a) * r * u, u * 0.06, u * 0.035, a, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}

/* ================= Stamm (liegend) ================= */

function stamm(ctx: CanvasRenderingContext2D, u: number, farbe: [string, string], laenge = 2.1) {
  ctx.save()
  schatten(ctx, u, 0.3, 0.12)
  const st = ctx.createLinearGradient(0, -0.22 * u, 0, 0.22 * u)
  st.addColorStop(0, farbe[0])
  st.addColorStop(1, farbe[1])
  ctx.fillStyle = st
  ctx.beginPath()
  ctx.roundRect(-0.45 * u, -0.2 * u, laenge * u, 0.4 * u, 0.12 * u)
  ctx.fill()
  ohneSchatten(ctx)
  ctx.strokeStyle = 'rgba(40, 24, 12, 0.4)'
  ctx.lineWidth = Math.max(1, u * 0.03)
  ctx.lineCap = 'round'
  ctx.beginPath()
  for (const [x0, y0, l] of [[-0.1, -0.08, 0.5], [0.55, 0.06, 0.6], [1.0, -0.1, 0.35]]) {
    ctx.moveTo(x0 * u, y0 * u)
    ctx.lineTo((x0 + l) * u, y0 * u)
  }
  ctx.stroke()
  ctx.fillStyle = '#D8AE74'
  ctx.beginPath()
  ctx.ellipse(-0.45 * u, 0, 0.11 * u, 0.2 * u, 0, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = 'rgba(120, 78, 40, 0.6)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.ellipse(-0.45 * u, 0, 0.05 * u, 0.1 * u, 0, 0, TAU)
  ctx.stroke()
  ctx.restore()
}

/* ================= Oeffentlich ================= */

/** Stehender Baum um `root`. off = Versatz in Feldern (Wackeln, Umfallen) */
export function drawBaumStehend(ctx: CanvasRenderingContext2D, art: BaumArt, root: P, cell: number, s: number, now: number, off: P = { x: 0, y: 0 }) {
  if (s <= 0) return
  const u = cell
  const seed = root.x * 3.7 + root.y * 1.3
  ctx.save()
  ctx.translate((root.x + 0.5 + off.x) * u, (root.y + 0.5 + off.y) * u)
  ctx.scale(s, s)
  switch (art) {
    case 'tanne':
    case 'weihnacht':
      tanne(ctx, u, false, art === 'weihnacht', now, seed)
      break
    case 'palme':
      palmWedel(ctx, u, now)
      break
    case 'kaktus':
      kaktus(ctx, u, hash(seed) > 0.4)
      break
    case 'kristall':
      kristall(ctx, u, now, seed)
      break
    case 'pilz':
      pilz(ctx, u, now, seed)
      break
    case 'totbaum':
      totbaum(ctx, u, seed, false)
      break
    default:
      krone(ctx, u, art, PLUS, seed)
  }
  ctx.restore()
}

/** Verschneite Variante (Winter) */
export function drawBaumStehendSchnee(ctx: CanvasRenderingContext2D, weihnacht: boolean, root: P, cell: number, s: number, now: number, off: P = { x: 0, y: 0 }) {
  if (s <= 0) return
  ctx.save()
  ctx.translate((root.x + 0.5 + off.x) * cell, (root.y + 0.5 + off.y) * cell)
  ctx.scale(s, s)
  tanne(ctx, cell, true, weihnacht, now, root.x * 3.7 + root.y * 1.3)
  ctx.restore()
}

/** Liegender Baum ab Stamm `root` in Richtung `dir`. kipp (0..1): beim Umfallen, wie weit er schon ausgestreckt ist */
export function drawBaumLiegend(ctx: CanvasRenderingContext2D, art: BaumArt, root: P, dir: Dir, cell: number, s: number, now: number, kipp = 1, schnee = false) {
  if (s <= 0 || kipp <= 0) return
  const u = cell
  const seed = root.x * 3.7 + root.y * 1.3
  ctx.save()
  ctx.translate((root.x + 0.5) * u, (root.y + 0.5) * u)
  ctx.rotate(ROT[dir])
  if (kipp < 1) {
    ctx.translate(-0.45 * u, 0)
    ctx.scale(kipp, 1)
    ctx.translate(0.45 * u, 0)
  }
  ctx.scale(Math.min(1, s), Math.min(1, s))
  switch (art) {
    case 'tanne':
    case 'weihnacht':
      stamm(ctx, u, ['#94653D', '#5C3B22'], 2.0)
      tanneLiegend(ctx, u, schnee, art === 'weihnacht')
      break
    case 'palme':
      // Stamm mit Ringen, Wedel am Ende
      stamm(ctx, u, ['#B58A5A', '#7A5530'], 2.6)
      ctx.strokeStyle = 'rgba(90, 60, 30, 0.5)'
      ctx.lineWidth = Math.max(1, u * 0.03)
      for (let i = 0; i < 9; i++) {
        ctx.beginPath()
        ctx.moveTo((-0.3 + i * 0.27) * u, -0.2 * u)
        ctx.lineTo((-0.25 + i * 0.27) * u, 0.2 * u)
        ctx.stroke()
      }
      ctx.save()
      ctx.translate(2.4 * u, 0)
      palmWedel(ctx, u, now, 0.8)
      ctx.restore()
      break
    case 'kaktus': {
      ctx.save()
      schatten(ctx, u, 0.35, 0.12)
      ctx.fillStyle = '#3E8E4A'
      ctx.beginPath()
      ctx.roundRect(-0.45 * u, -0.3 * u, 3.9 * u, 0.6 * u, 0.3 * u)
      ctx.fill()
      ctx.beginPath()
      ctx.roundRect(1.8 * u, -1.25 * u, 0.42 * u, 1.0 * u, 0.2 * u)
      ctx.roundRect(1.8 * u, 0.25 * u, 0.42 * u, 1.0 * u, 0.2 * u)
      ctx.fill()
      ohneSchatten(ctx)
      ctx.strokeStyle = '#2C6B37'
      ctx.lineWidth = Math.max(1, u * 0.03)
      for (const y of [-0.12, 0.05, 0.18]) {
        ctx.beginPath()
        ctx.moveTo(-0.3 * u, y * u)
        ctx.lineTo(3.3 * u, y * u)
        ctx.stroke()
      }
      ctx.fillStyle = '#F7F1D5'
      for (let i = 0; i < 16; i++) ctx.fillRect((-0.3 + i * 0.22) * u, (i % 2 ? -0.22 : 0.2) * u, Math.max(1, u * 0.03), Math.max(1, u * 0.03))
      ctx.restore()
      break
    }
    case 'kristall':
      kristallLiegend(ctx, u, seed)
      break
    case 'pilz':
      pilzLiegend(ctx, u, now, seed)
      break
    case 'totbaum':
      totbaum(ctx, u, seed, true)
      break
    default:
      stamm(ctx, u, art === 'kirsche' ? ['#7A4A3A', '#4A2A22'] : ['#94653D', '#5C3B22'])
      krone(ctx, u, art, LIEGEND, seed)
  }
  ctx.restore()
}

/** Farbe der Blaetter, die vor dem Umfallen herunterfallen */
export function blattFarbe(art: BaumArt, schnee = false): string[] {
  if (schnee) return ['#FFFFFF', '#E8F2F8']
  switch (art) {
    case 'kirsche':
      return ['#FFC9DE', '#F3A7C9']
    case 'herbst':
      return ['#EE9638', '#D2612A', '#FFD27A']
    case 'tanne':
    case 'weihnacht':
      return ['#2E8448', '#1F6234']
    case 'palme':
      return ['#47A447', '#8B6B3E']
    case 'kaktus':
      return ['#E7C98F', '#D9B877']
    case 'kristall':
      return ['#D6B8FF', '#B8F2FF']
    case 'pilz':
      return ['#FF6A55', '#FFF8F0']
    case 'totbaum':
      return ['#7A4A2A', '#5A3A28']
    default:
      return ['#58B860', '#3E9A4E']
  }
}

/** Ankuendigung: k = 0..1 (Anteil der Warnzeit). Gibt den Versatz zum Wackeln zurueck (Felder) und zeichnet
 *  1 bis 3 Blaetter, die in Fallrichtung wegfallen */
export function wackeln(dir: Dir, k: number, now: number): P {
  const d = STEP[dir]
  const amp = 0.04 + 0.08 * k
  const w = Math.sin(now / (70 - 30 * k)) * amp + 0.07 * k
  return { x: d.x * w, y: d.y * w }
}

export function drawFallBlaetter(ctx: CanvasRenderingContext2D, farben: string[], root: P, dir: Dir, cell: number, verstrichen: number) {
  const d = STEP[dir]
  const q = { x: -d.y, y: d.x }
  for (let i = 0; i < 3; i++) {
    const start = 150 + i * 420
    const t = (verstrichen - start) / 900
    if (t < 0 || t > 1) continue
    const seite = (hash(root.x * 5 + root.y * 3 + i) - 0.5) * 1.4
    const x = root.x + 0.5 + d.x * (0.6 + t * 1.6) + q.x * (seite + Math.sin(t * 9 + i) * 0.15)
    const y = root.y + 0.5 + d.y * (0.6 + t * 1.6) + q.y * (seite + Math.sin(t * 9 + i) * 0.15)
    ctx.save()
    ctx.globalAlpha *= Math.min(1, (1 - t) * 2)
    ctx.translate(x * cell, y * cell)
    ctx.rotate(t * 7 + i)
    ctx.fillStyle = farben[i % farben.length]
    ctx.beginPath()
    ctx.ellipse(0, 0, cell * 0.16, cell * 0.085, 0, 0, TAU)
    ctx.fill()
    ctx.restore()
  }
}
