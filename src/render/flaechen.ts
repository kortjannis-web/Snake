/**
 * Zusammenhaengende Flaechen: Lava, Wasser (je nach Welt) und Eis werden nicht Feld fuer Feld gezeichnet,
 * sondern als eine Flaeche mit weichem Rand und ausgerundeten Innenecken. Das Bild jeder Flaeche wird
 * einmal Pixel fuer Pixel berechnet (Abstandsfeld) und danach nur kopiert; bewegt wird eine kachelbare
 * Textur, die nur innerhalb der Flaeche liegt.
 */
import type { P } from '../game/types'

/* ================= Rauschen und Abstandsfelder ================= */

const hash2 = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}
const glatt = (t: number) => t * t * (3 - 2 * t)
/** Wertrauschen 0..1, optional periodisch (fuer kachelbare Texturen) */
export function rauschen(x: number, y: number, per = 0) {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const w = (v: number) => (per ? ((v % per) + per) % per : v)
  const fx = glatt(x - x0)
  const fy = glatt(y - y0)
  const a = hash2(w(x0), w(y0))
  const b = hash2(w(x0 + 1), w(y0))
  const c = hash2(w(x0), w(y0 + 1))
  const d = hash2(w(x0 + 1), w(y0 + 1))
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}
export function fbm(x: number, y: number, okt = 4, per = 0) {
  let s = 0
  let a = 0.5
  let f = 1
  let n = 0
  for (let i = 0; i < okt; i++) {
    s += a * rauschen(x * f, y * f, per ? per * f : 0)
    n += a
    a *= 0.5
    f *= 2
  }
  return s / n
}

const sdBox = (px: number, py: number, h: number) => {
  const dx = Math.abs(px) - h
  const dy = Math.abs(py) - h
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0)
}
const smin = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}

/** Abstand zum Rand (Felder, innen negativ): Aussenecken mit Radius rund, Innenecken weich (k), Rand etwas unruhig (wackel) */
function abstand(cells: P[], rund: number, k: number, wackel: number, o: P) {
  const set = new Set(cells.map((c) => c.x * 4096 + c.y))
  return (x: number, y: number) => {
    const cx = Math.floor(x)
    const cy = Math.floor(y)
    let d = 9
    for (let j = -2; j <= 2; j++)
      for (let i = -2; i <= 2; i++) {
        if (!set.has((cx + i) * 4096 + cy + j)) continue
        d = smin(d, sdBox(x - (cx + i + 0.5), y - (cy + j + 0.5), 0.5 - rund) - rund, k)
      }
    return wackel ? d + (rauschen((x - o.x) * 2.3, (y - o.y) * 2.3) - 0.5) * wackel : d
  }
}
/** Echte Tiefe innen: Abstand zum naechsten Feld, das nicht dazugehoert (aussen 0, hoechstens bis) */
function tiefe(cells: P[], bis: number) {
  const set = new Set(cells.map((c) => c.x * 4096 + c.y))
  const R = Math.ceil(bis) + 1
  return (x: number, y: number) => {
    const cx = Math.floor(x)
    const cy = Math.floor(y)
    if (!set.has(cx * 4096 + cy)) return 0
    let d = bis
    for (let j = -R; j <= R; j++)
      for (let i = -R; i <= R; i++) {
        if (set.has((cx + i) * 4096 + cy + j)) continue
        const dd = Math.max(0, sdBox(x - (cx + i + 0.5), y - (cy + j + 0.5), 0.5))
        if (dd < d) d = dd
      }
    return d
  }
}

type Bild = { cv: HTMLCanvasElement; x0: number; y0: number; w: number; h: number }
type Farbe4 = readonly [number, number, number, number]

/** Flaeche Pixel fuer Pixel faerben (Aufloesung: px Pixel je Feld). farbe bekommt Abstand, Tiefe und Position in Feldern */
function raster(cells: P[], px: number, pad: number, d: (x: number, y: number) => number, t: (x: number, y: number) => number, farbe: (d: number, t: number, x: number, y: number) => Farbe4 | null): Bild {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const c of cells) {
    x0 = Math.min(x0, c.x)
    y0 = Math.min(y0, c.y)
    x1 = Math.max(x1, c.x)
    y1 = Math.max(y1, c.y)
  }
  x0 -= pad
  y0 -= pad
  const w = x1 + 1 + pad - x0
  const h = y1 + 1 + pad - y0
  const cv = document.createElement('canvas')
  cv.width = Math.max(1, Math.ceil(w * px))
  cv.height = Math.max(1, Math.ceil(h * px))
  const c = cv.getContext('2d')!
  const img = c.createImageData(cv.width, cv.height)
  const s = 1 / px
  for (let py = 0; py < cv.height; py++)
    for (let pxx = 0; pxx < cv.width; pxx++) {
      const x = x0 + (pxx + 0.5) * s
      const y = y0 + (py + 0.5) * s
      const dd = d(x, y)
      if (dd > pad) continue
      const f = farbe(dd, dd < 0 ? t(x, y) : 0, x, y)
      if (!f) continue
      const o = (py * cv.width + pxx) * 4
      img.data[o] = f[0]
      img.data[o + 1] = f[1]
      img.data[o + 2] = f[2]
      img.data[o + 3] = Math.round(Math.min(1, Math.max(0, f[3])) * 255)
    }
  c.putImageData(img, 0, 0)
  return { cv, x0, y0, w, h }
}

/** Kachelbare Textur (n x n px) aus periodischem Rauschen */
function textur(n: number, per: number, farbe: (v: number, u: number, w: number) => Farbe4) {
  const cv = document.createElement('canvas')
  cv.width = n
  cv.height = n
  const c = cv.getContext('2d')!
  const img = c.createImageData(n, n)
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const u = (x / n) * per
      const w = (y / n) * per
      const f = farbe(fbm(u, w, 4, per), u, w)
      const o = (y * n + x) * 4
      img.data[o] = f[0]
      img.data[o + 1] = f[1]
      img.data[o + 2] = f[2]
      img.data[o + 3] = Math.round(f[3] * 255)
    }
  c.putImageData(img, 0, 0)
  return cv
}

let zwischen: HTMLCanvasElement | null = null
/** Bewegte Fuellung: Textur verschoben (dx/dy in Pixeln der Textur), nur innerhalb der Maske */
function fuellung(ctx: CanvasRenderingContext2D, maske: Bild, tex: HTMLCanvasElement, cell: number, dx: number, dy: number, alpha: number, skal = 1) {
  zwischen ??= document.createElement('canvas')
  if (zwischen.width !== maske.cv.width || zwischen.height !== maske.cv.height) {
    zwischen.width = maske.cv.width
    zwischen.height = maske.cv.height
  }
  const o = zwischen.getContext('2d')!
  o.globalCompositeOperation = 'copy'
  o.drawImage(maske.cv, 0, 0)
  o.globalCompositeOperation = 'source-in'
  const t = tex.width * skal
  const pat = o.createPattern(tex, 'repeat')!
  pat.setTransform(new DOMMatrix().translate(-(((dx % t) + t) % t), -(((dy % t) + t) % t)).scale(skal))
  o.fillStyle = pat
  o.fillRect(0, 0, zwischen.width, zwischen.height)
  o.globalCompositeOperation = 'source-over'
  const a = ctx.globalAlpha
  ctx.globalAlpha = a * alpha
  ctx.drawImage(zwischen, maske.x0 * cell, maske.y0 * cell, maske.w * cell, maske.h * cell)
  ctx.globalAlpha = a
}

/* ================= Arten ================= */

/** Wasser je Welt: tief (Seerosen), klar (Sand und Kiesel), gras (klar, Ufer bemoost), winter (kalt, Eisschollen),
 *  hoehle (dunkel, Kristalle am Ufer), zauber (leuchtende Punkte), sumpf (truebe, Blasen) */
export type WasserArt = 'tief' | 'klar' | 'gras' | 'winter' | 'hoehle' | 'zauber' | 'sumpf'
export type FlaechenArt = 'lava' | 'eis' | 'eisNacht' | WasserArt

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const cl = (t: number) => Math.min(1, Math.max(0, t))
const mixA = (a: Farbe4, b: Farbe4, t: number): Farbe4 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)]
const sstep = (a: number, b: number, x: number) => {
  const t = cl((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

/** Texturen erst bei Bedarf bauen */
const texturen = new Map<string, HTMLCanvasElement>()
const tex = (name: string) => {
  let t = texturen.get(name)
  if (t) return t
  if (name === 'lava')
    t = textur(160, 5, (v, u, w) => {
      const s = 0.5 + 0.5 * Math.sin((u + w * 0.3) * 2.5 + v * 9)
      return s > 0.7 ? [70, 16, 8, (s - 0.7) * 2.6] : [255, 230, 140, (0.7 - s) * 0.45]
    })
  else if (name === 'kaustik')
    t = textur(160, 4, (v) => {
      const s = Math.abs(v - 0.5)
      return s < 0.05 ? [255, 255, 255, (0.05 - s) * 12] : [255, 255, 255, 0]
    })
  else if (name === 'wellen')
    t = textur(160, 3, (v, u) => {
      const s = Math.sin(u * 6 + v * 8)
      return s > 0.93 ? [255, 255, 255, (s - 0.93) * 9] : [0, 0, 0, 0]
    })
  else if (name === 'sumpf')
    t = textur(160, 4, (v) => (v > 0.62 ? [40, 60, 20, (v - 0.62) * 2] : [0, 0, 0, 0]))
  else
    t = textur(160, 3, (v, u, w) => {
      // Eis: diagonaler, leiser Glanz
      const s = Math.sin((u + w) * 2.2 + v * 3)
      return s > 0.9 ? [255, 255, 255, (s - 0.9) * 3] : [0, 0, 0, 0]
    })
  texturen.set(name, t)
  return t
}

type Koerper = { basis: Bild; maske: Bild; cells: P[]; art: FlaechenArt; T: (x: number, y: number) => number; benutzt: number }

/** Bild einer Flaeche berechnen */
function baue(cells: P[], art: FlaechenArt, px: number, o: P): Koerper {
  const W = (x: number, y: number) => ({ x: x - o.x, y: y - o.y })
  if (art === 'lava') {
    const d = abstand(cells, 0.3, 0.7, 0.12, o)
    const T = tiefe(cells, 1.6)
    const basis = raster(cells, px, 0.5, d, T, (dd, tt, x, y) => {
      if (dd > 0.45) return null
      if (dd > 0.02) {
        const t = 1 - dd / 0.45
        return [255, 110, 30, 0.32 * t * t]
      }
      const aa = cl((0.02 - dd) / 0.04)
      if (dd > -0.12) {
        const c = mixA([58, 20, 12, 1], [120, 30, 14, 1], cl(-dd / 0.12))
        return [c[0], c[1], c[2], aa]
      }
      const w = W(x, y)
      const t = cl((tt - 0.1) / 1.1 + (fbm(w.x * 0.9, w.y * 0.9, 2) - 0.5) * 0.25)
      const n = fbm(w.x * 1.6, w.y * 1.6, 3)
      let c = t < 0.5 ? mixA([194, 54, 26, 1], [255, 140, 40, 1], t * 2) : mixA([255, 140, 40, 1], [255, 226, 122, 1], (t - 0.5) * 2)
      c = mixA(c, [150, 30, 14, 1], (1 - n) * 0.35 * (1 - t))
      return [c[0], c[1], c[2], 1]
    })
    const maske = raster(cells, px, 0.5, d, T, (dd) => (dd > -0.12 ? null : [255, 255, 255, cl((-0.12 - dd) / 0.08)]))
    return { basis, maske, cells, art, T, benutzt: 0 }
  }
  if (art === 'eis' || art === 'eisNacht') {
    // Nachts (dunkler Boden): bläulich und durchsichtiger, sonst wirkt es wie Nebel
    const nacht = art === 'eisNacht'
    const innen: Farbe4 = nacht ? [120, 175, 215, 0.42] : [218, 240, 250, 0.6]
    const tiefInnen: Farbe4 = nacht ? [90, 150, 205, 0.6] : [190, 226, 245, 0.85]
    const reif = nacht ? 0.16 : 0.38
    const d = abstand(cells, 0.45, 1.0, 0.35, o)
    const T = tiefe(cells, 1.6)
    const basis = raster(cells, px, 0.6, d, T, (dd, tt, x, y) => {
      // Weicher Uebergang: Reif liegt schon auf dem Gras, nach innen wird das Eis langsam dichter
      if (dd > 0.5) return null
      const w = W(x, y)
      const n = fbm(w.x * 2.2, w.y * 2.2, 4)
      if (dd > 0) {
        const t = 1 - dd / 0.5
        return nacht ? [160, 205, 235, reif * t * t * (0.5 + n)] : [236, 248, 252, reif * t * t * (0.5 + n)]
      }
      const t = cl(tt / 1.3)
      let c = mixA(innen, tiefInnen, t)
      c = mixA(c, nacht ? [190, 225, 250, c[3]] : [250, 254, 255, c[3]], (n - 0.45) * 0.7)
      // ein, zwei feine Risse (sehr leise)
      const r = Math.abs(rauschen(w.x * 0.9 + 40, w.y * 0.9) - 0.5)
      if (r < 0.006 && t > 0.35) c = mixA(c, [150, 198, 224, c[3]], 0.5)
      return [c[0], c[1], c[2], c[3] + (reif * (0.5 + n) - c[3]) * (1 - sstep(0, 0.3, -dd))]
    })
    const maske = raster(cells, px, 0.6, d, T, (dd) => (dd > -0.1 ? null : [255, 255, 255, cl((-0.1 - dd) / 0.4)]))
    return { basis, maske, cells, art, T, benutzt: 0 }
  }
  // Wasser
  const d = abstand(cells, 0.34, 0.7, 0.1, o)
  const T = tiefe(cells, 1.6)
  // rb = Breite des Uferstreifens (Felder), nass = feuchter Hof ausserhalb
  const P: Record<WasserArt, { rand: Farbe4; flach: Farbe4; mitte: Farbe4; tief: Farbe4; nass: Farbe4; rb?: number }> = {
    tief: { rand: [224, 244, 248, 0.95], flach: [124, 200, 222, 1], mitte: [63, 147, 181, 1], tief: [31, 92, 128, 1], nass: [150, 138, 88, 0.28], rb: 0.09 },
    gras: { rand: [190, 178, 126, 0.85], flach: [120, 190, 175, 1], mitte: [70, 160, 180, 1], tief: [40, 115, 150, 1], nass: [140, 128, 80, 0.3], rb: 0.1 },
    klar: { rand: [214, 196, 140, 1], flach: [170, 205, 165, 1], mitte: [70, 165, 185, 1], tief: [40, 120, 150, 1], nass: [150, 110, 60, 0.25] },
    winter: { rand: [250, 252, 255, 1], flach: [120, 175, 210, 1], mitte: [50, 100, 160, 1], tief: [24, 52, 104, 1], nass: [200, 220, 235, 0.4] },
    hoehle: { rand: [90, 210, 230, 0.9], flach: [40, 100, 130, 1], mitte: [18, 52, 82, 1], tief: [6, 20, 40, 1], nass: [60, 180, 220, 0.2] },
    zauber: { rand: [210, 140, 255, 0.85], flach: [60, 170, 170, 1], mitte: [24, 100, 120, 1], tief: [10, 46, 70, 1], nass: [150, 90, 220, 0.22] },
    sumpf: { rand: [90, 100, 50, 1], flach: [95, 110, 55, 1], mitte: [60, 80, 40, 1], tief: [34, 48, 26, 1], nass: [40, 50, 20, 0.35] },
  }
  const p = P[art as WasserArt]
  const rb = p.rb ?? 0.08
  const basis = raster(cells, px, 0.3, d, T, (dd, tt, x, y) => {
    if (dd > rb) return null
    if (dd > 0) return [p.nass[0], p.nass[1], p.nass[2], p.nass[3] * (1 - dd / rb)]
    const aa = cl(-dd / 0.04)
    const w = W(x, y)
    if (dd > -rb) return [p.rand[0], p.rand[1], p.rand[2], p.rand[3] * aa]
    const t = cl(tt / 1.2 + (fbm(w.x, w.y, 2) - 0.5) * 0.15)
    let c = t < 0.35 ? mixA(p.flach, p.mitte, t / 0.35) : mixA(p.mitte, p.tief, (t - 0.35) / 0.65)
    c = mixA(c, mixA(p.tief, [0, 0, 0, 1], 0.2), (fbm(w.x * 1.3, w.y * 1.3, 3) - 0.5) * 0.4)
    if ((art === 'klar' || art === 'gras') && t < 0.7 && rauschen(w.x * 7, w.y * 7) > 0.84) c = mixA(c, art === 'klar' ? [150, 145, 125, 1] : [100, 125, 105, 1], 0.45)
    return [c[0], c[1], c[2], 1]
  })
  const maske = raster(cells, px, 0.3, d, T, (dd) => (dd > -rb ? null : [255, 255, 255, cl((-rb - dd) / 0.06)]))
  return { basis, maske, cells, art, T, benutzt: 0 }
}

const koerper = new Map<string, Koerper>()
let bildNr = 0
/** Pixel je Feld fuers Berechnen (Feldgroesse in CSS-Pixeln, hoechstens 48: danach wird weich vergroessert) */
const aufloesung = (cell: number) => Math.max(8, Math.min(48, Math.round(cell)))

function holen(cells: P[], art: FlaechenArt, cell: number, o: P) {
  const px = aufloesung(cell)
  const key = `${art}|${px}|${o.x},${o.y}|${cells.map((c) => `${c.x},${c.y}`).join(';')}`
  let k = koerper.get(key)
  if (!k) {
    k = baue(cells, art, px, o)
    koerper.set(key, k)
  }
  k.benutzt = bildNr
  return k
}

/** Einmal je Bild aufrufen: lange nicht gebrauchte Flaechen vergessen */
export function flaechenAufraeumen() {
  bildNr++
  if (koerper.size < 40) return
  for (const [key, k] of koerper) if (bildNr - k.benutzt > 600) koerper.delete(key)
}

const TAU = Math.PI * 2

/** Eine Flaeche zeichnen. o = Ursprung der Welt (damit das Rauschen beim Wachsen der Karte nicht springt) */
export function drawFlaeche(ctx: CanvasRenderingContext2D, cells: P[], art: FlaechenArt, cell: number, now: number, o: P, reduce = false) {
  if (!cells.length) return
  const k = holen(cells, art, cell, o)
  const { basis, maske } = k
  ctx.drawImage(basis.cv, basis.x0 * cell, basis.y0 * cell, basis.w * cell, basis.h * cell)
  if (reduce) return
  const t0 = now
  switch (art) {
    case 'lava':
      // Langsam fliessende Schlieren, dazu Blasen in der Tiefe
      fuellung(ctx, maske, tex('lava'), cell, t0 / 54, t0 / 120, 0.85)
      cells.forEach((c, i) => {
        if (k.T(c.x + 0.5, c.y + 0.5) < 0.9) return
        const z = (now / 1500 + hash(c.x * 7 + c.y * 13)) % 1
        const x = (c.x + 0.3 + hash(i + c.x) * 0.4) * cell
        const y = (c.y + 0.3 + hash(i + c.y * 3) * 0.4) * cell
        if (z < 0.75) {
          ctx.strokeStyle = 'rgba(255, 240, 170, 0.85)'
          ctx.lineWidth = Math.max(1, cell * 0.035)
          ctx.beginPath()
          ctx.arc(x, y, cell * 0.12 * (z / 0.75), 0, TAU)
          ctx.stroke()
        } else {
          ctx.fillStyle = `rgba(255, 240, 170, ${(1 - z) * 3})`
          for (let j = 0; j < 4; j++) {
            ctx.beginPath()
            ctx.arc(x + Math.cos(j * 1.6) * cell * 0.18 * (z - 0.6), y + Math.sin(j * 1.6) * cell * 0.18 * (z - 0.6), cell * 0.025, 0, TAU)
            ctx.fill()
          }
        }
      })
      break
    case 'eis':
    case 'eisNacht': {
      fuellung(ctx, maske, tex('eis'), cell, t0 / 70, t0 / 110, 0.5, 1.2)
      // Ab und zu blitzt ein diagonaler Lichtstreifen ueber das Eis (wie Sonne, die sich spiegelt)
      const z = (now % 5200) / 5200
      if (z < 0.3) {
        const xs = cells.map((c) => c.x)
        const ys = cells.map((c) => c.y)
        const x0 = Math.min(...xs) - 1
        const y0 = Math.min(...ys) - 1
        const span = Math.max(...xs) + Math.max(...ys) - x0 - y0 + 3
        const pos = (z / 0.3) * span
        const off = zwischenGlanz(maske, cell, x0, y0, pos)
        ctx.drawImage(off, maske.x0 * cell, maske.y0 * cell, maske.w * cell, maske.h * cell)
      }
      break
    }
    case 'tief':
    case 'gras':
      fuellung(ctx, maske, tex('kaustik'), cell, t0 / 60, t0 / 90, 0.32)
      fuellung(ctx, maske, tex('kaustik'), cell, -t0 / 80, t0 / 70, 0.22, 1.3)
      if (art === 'tief') seerosen(ctx, k, cell, now)
      break
    case 'klar':
      fuellung(ctx, maske, tex('wellen'), cell, t0 / 40, t0 / 120, 0.7)
      fuellung(ctx, maske, tex('kaustik'), cell, t0 / 70, -t0 / 90, 0.2, 0.8)
      break
    case 'winter':
      fuellung(ctx, maske, tex('wellen'), cell, t0 / 70, t0 / 160, 0.45)
      schollen(ctx, k, cell, now)
      break
    case 'hoehle':
      fuellung(ctx, maske, tex('kaustik'), cell, t0 / 90, t0 / 120, 0.18)
      leuchtpunkte(ctx, k, cell, now, [120, 230, 255])
      break
    case 'zauber':
      fuellung(ctx, maske, tex('kaustik'), cell, t0 / 70, -t0 / 100, 0.22)
      leuchtpunkte(ctx, k, cell, now, [200, 140, 255])
      leuchtpunkte(ctx, k, cell, now + 777, [120, 255, 220])
      break
    case 'sumpf':
      fuellung(ctx, maske, tex('sumpf'), cell, t0 / 200, t0 / 260, 0.9)
      sumpfBlasen(ctx, k, cell, now)
      break
  }
}

let glanzCv: HTMLCanvasElement | null = null
/** Diagonaler Glanzstreifen, nur innerhalb der Maske */
function zwischenGlanz(maske: Bild, _cell: number, x0: number, y0: number, pos: number) {
  glanzCv ??= document.createElement('canvas')
  const c = glanzCv
  if (c.width !== maske.cv.width || c.height !== maske.cv.height) {
    c.width = maske.cv.width
    c.height = maske.cv.height
  }
  const o = c.getContext('2d')!
  o.globalCompositeOperation = 'copy'
  o.drawImage(maske.cv, 0, 0)
  o.globalCompositeOperation = 'source-in'
  const s = c.width / maske.w
  // Streifen entlang x + y = konst (diagonal), Position in Feldern ab der linken oberen Ecke
  const m = (x0 + y0 + pos - maske.x0 - maske.y0) * s
  const len = c.width + c.height
  const g = o.createLinearGradient(0, 0, len / 2, len / 2)
  const a = Math.max(0, Math.min(1, (m - s * 0.7) / len))
  const b = Math.max(0, Math.min(1, m / len))
  const e = Math.max(0, Math.min(1, (m + s * 0.7) / len))
  g.addColorStop(0, 'rgba(255,255,255,0)')
  if (a > 0) g.addColorStop(a, 'rgba(255,255,255,0)')
  g.addColorStop(b, 'rgba(255,255,255,0.55)')
  if (e < 1) g.addColorStop(e, 'rgba(255,255,255,0)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  o.fillStyle = g
  o.fillRect(0, 0, c.width, c.height)
  o.globalCompositeOperation = 'source-over'
  return c
}

function seerosen(ctx: CanvasRenderingContext2D, k: Koerper, cell: number, now: number) {
  k.cells.forEach((c, i) => {
    if (hash(c.x * 3.3 + c.y * 7.1) > 0.4 || k.T(c.x + 0.5, c.y + 0.5) < 0.9) return
    const x = (c.x + 0.5 + Math.sin(now / 1800 + i) * 0.06) * cell
    const y = (c.y + 0.5) * cell
    const dreh = hash(c.x + c.y * 9) * TAU
    ctx.fillStyle = '#4FA65A'
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.arc(x, y, cell * 0.28, 0.4 + dreh, TAU - 0.2 + dreh)
    ctx.fill()
    ctx.fillStyle = '#2F7A3E'
    ctx.beginPath()
    ctx.arc(x, y, cell * 0.06, 0, TAU)
    ctx.fill()
    if (hash(c.x * 5 + c.y) > 0.5) {
      ctx.fillStyle = '#FFC1DA'
      for (let j = 0; j < 5; j++) {
        ctx.beginPath()
        ctx.ellipse(x + Math.cos(j * 1.26) * cell * 0.08, y + Math.sin(j * 1.26) * cell * 0.08, cell * 0.08, cell * 0.045, j * 1.26, 0, TAU)
        ctx.fill()
      }
      ctx.fillStyle = '#FFE066'
      ctx.beginPath()
      ctx.arc(x, y, cell * 0.04, 0, TAU)
      ctx.fill()
    }
  })
}

function schollen(ctx: CanvasRenderingContext2D, k: Koerper, cell: number, now: number) {
  k.cells.forEach((c) => {
    if (hash(c.x * 2.7 + c.y * 5.3) > 0.45 || k.T(c.x + 0.5, c.y + 0.5) < 0.8) return
    const x = (c.x + 0.5 + Math.sin(now / 2600 + c.x) * 0.1) * cell
    const y = (c.y + 0.5 + Math.cos(now / 3100 + c.y) * 0.08) * cell
    const r = cell * (0.18 + hash(c.x + c.y) * 0.12)
    ctx.fillStyle = 'rgba(240, 248, 255, 0.92)'
    ctx.beginPath()
    for (let j = 0; j < 6; j++) {
      const a = (j / 6) * TAU + hash(c.x * 9 + j)
      const rr = r * (0.7 + hash(c.y * 7 + j) * 0.4)
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
    }
    ctx.fill()
    ctx.fillStyle = 'rgba(160, 200, 230, 0.6)'
    ctx.beginPath()
    ctx.ellipse(x + r * 0.15, y + r * 0.2, r * 0.4, r * 0.2, 0.3, 0, TAU)
    ctx.fill()
  })
}

function leuchtpunkte(ctx: CanvasRenderingContext2D, k: Koerper, cell: number, now: number, f: readonly [number, number, number]) {
  k.cells.forEach((c, i) => {
    for (let j = 0; j < 2; j++) {
      const z = 0.5 + 0.5 * Math.sin(now / 600 + i * 2.3 + j * 4)
      if (z < 0.3) continue
      const x = (c.x + 0.2 + hash(c.x * 13 + c.y + j) * 0.6) * cell
      const y = (c.y + 0.2 + hash(c.y * 11 + c.x + j * 3) * 0.6) * cell
      const g = ctx.createRadialGradient(x, y, 0, x, y, cell * 0.16)
      g.addColorStop(0, `rgba(${f[0]},${f[1]},${f[2]},${0.9 * z})`)
      g.addColorStop(1, `rgba(${f[0]},${f[1]},${f[2]},0)`)
      ctx.fillStyle = g
      ctx.fillRect(x - cell * 0.16, y - cell * 0.16, cell * 0.32, cell * 0.32)
    }
  })
}

function sumpfBlasen(ctx: CanvasRenderingContext2D, k: Koerper, cell: number, now: number) {
  k.cells.forEach((c) => {
    const z = (now / 1900 + hash(c.x * 7 + c.y * 3)) % 1
    if (z > 0.8) return
    const x = (c.x + 0.25 + hash(c.x + c.y * 5) * 0.5) * cell
    const y = (c.y + 0.25 + hash(c.y + c.x * 5) * 0.5) * cell
    ctx.strokeStyle = `rgba(180, 200, 120, ${0.8 * (1 - z / 0.8)})`
    ctx.lineWidth = Math.max(1, cell * 0.03)
    ctx.beginPath()
    ctx.arc(x, y, cell * 0.1 * (z / 0.8), 0, TAU)
    ctx.stroke()
  })
}
