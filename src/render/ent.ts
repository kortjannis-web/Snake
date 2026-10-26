/**
 * Boss des Waldes: der Ent auf seiner Lichtung (Glutschale, Holzstapel, alte Baumstuempfe, Dickicht), seine Attacken
 * (Wurzeln, Dornen, Eicheln, Rankenwaende, Setzlinge, Laubsturm, rote Warnungen), das Rueckfeuer, die Anzeige,
 * dazu die Mini-Ents mit Blaetterbomben und Griff.
 *
 * Der Ent ist von oben gezeichnet: Wurzeln am Boden, zwei knorrige Aeste als Arme, eine grosse Laubkrone und vorn,
 * wohin er schaut, ein Gesicht aus Rinde mit gluehenden Augen. Darunter sitzt der Herzknoten, der in Phase 1 frei liegt,
 * wenn die Rinde brennt. Mit jedem Treffer wird die Krone herbstlicher, am Ende zerfaellt er zu Laub.
 */
import { ENT, type EntLinie, type Entkampf } from '../game/entkampf'
import type { Pf } from '../game/golemkampf'
import type { Blaetterbombe, MiniEnt } from '../game/types'

const TAU = Math.PI * 2
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const easeOut = (t: number) => 1 - (1 - t) * (1 - t)
const hash = (n: number) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return v - Math.floor(v)
}
type RGB = readonly [number, number, number]
const rgb = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
/** Mitte eines Feldes in Pixeln */
const px = (v: number, cell: number) => (v + 0.5) * cell

const RINDE: RGB = [92, 62, 38]
const RINDE_HELL: RGB = [128, 92, 58]
const RINDE_DUNKEL: RGB = [52, 34, 22]
const LAUB: RGB = [52, 112, 58]
const LAUB_HELL: RGB = [108, 176, 86]
const LAUB_DUNKEL: RGB = [30, 74, 40]
const HERBST: RGB = [214, 120, 40]
const GLUT: RGB = [255, 140, 50]
const AUGE: RGB = [246, 222, 110]

/* ================= Warnungen ================= */

/** Rote Warnflaeche mit wandernden Streifen; k = wie weit die Zeit schon um ist */
function warnPfad(ctx: CanvasRenderingContext2D, pfad: () => void, k: number, now: number, cell: number, reduce: boolean) {
  ctx.save()
  pfad()
  ctx.fillStyle = `rgba(220, 30, 30, ${0.16 + 0.22 * k})`
  ctx.fill()
  ctx.clip()
  ctx.strokeStyle = `rgba(255, 60, 50, ${0.22 + 0.3 * k})`
  ctx.lineWidth = cell * 0.2
  ctx.beginPath()
  const o = reduce ? 0 : (now / 25) % (cell * 1.1)
  const m = ctx.getTransform()
  const x0 = -m.e / m.a - cell * 40
  const y0 = -m.f / m.d - cell * 4
  for (let i = 0; i < 90; i++) {
    const s = x0 + i * cell * 1.1 + o
    ctx.moveTo(s, y0)
    ctx.lineTo(s + cell * 44, y0 + cell * 44)
  }
  ctx.stroke()
  ctx.restore()
  ctx.save()
  pfad()
  ctx.strokeStyle = `rgba(255, 70, 60, ${0.6 + 0.4 * (reduce ? 1 : Math.abs(Math.sin(now / (k > 0.75 ? 50 : 110))))})`
  ctx.lineWidth = Math.max(2, cell * 0.1)
  ctx.stroke()
  ctx.restore()
}

const felderPfad = (ctx: CanvasRenderingContext2D, cells: Pf[], cell: number) => () => {
  ctx.beginPath()
  for (const c of cells) ctx.rect(c.x * cell, c.y * cell, cell, cell)
}

/** Alle Warnungen (unter der Schlange): Linien vor dem Losgehen, Schatten der Eicheln, kommendes Dickicht */
export function drawEntWarnungen(ctx: CanvasRenderingContext2D, k: Entkampf, cell: number, now: number, reduce: boolean) {
  for (const l of k.linien) {
    if (now >= l.los) continue
    const f = clamp01((now - l.ab) / Math.max(1, l.los - l.ab))
    warnPfad(ctx, felderPfad(ctx, l.cells, cell), f, now, cell, reduce)
    // Pfeile laufen vom Ursprung weg (wohin die Linie waechst)
    if (l.art !== 'ranke' && !reduce) {
      ctx.strokeStyle = 'rgba(255, 220, 210, 0.7)'
      ctx.lineWidth = Math.max(1.5, cell * 0.08)
      ctx.lineCap = 'round'
      const max = l.d[l.d.length - 1] ?? 0
      for (let d = ((now / 140) % 2) + 0.5; d < max; d += 2) {
        const i = l.d.findIndex((x) => x >= d)
        if (i < 0) break
        const c = l.cells[i]
        const w = Math.atan2(c.y - l.von.y, c.x - l.von.x)
        const x = px(c.x, cell)
        const y = px(c.y, cell)
        ctx.beginPath()
        ctx.moveTo(x + Math.cos(w + 2.5) * cell * 0.25, y + Math.sin(w + 2.5) * cell * 0.25)
        ctx.lineTo(x, y)
        ctx.lineTo(x + Math.cos(w - 2.5) * cell * 0.25, y + Math.sin(w - 2.5) * cell * 0.25)
        ctx.stroke()
      }
    }
  }
  for (const e of k.eicheln) {
    if (e.fertig) continue
    const f = clamp01((now - e.t) / Math.max(1, e.bis - e.t))
    warnPfad(ctx, felderPfad(ctx, k.eichelFelder(e), cell), f, now, cell, reduce)
    ctx.fillStyle = `rgba(0, 0, 0, ${0.2 + 0.4 * f})`
    ctx.beginPath()
    ctx.ellipse(px(e.p.x, cell), px(e.p.y, cell), cell * (0.25 + 0.5 * f), cell * (0.2 + 0.4 * f), 0, 0, TAU)
    ctx.fill()
  }
  // Sprosse: hier waechst gleich Dickicht
  for (const s of k.sprosse) {
    const f = clamp01((now - s.t) / Math.max(1, s.bis - s.t))
    warnPfad(ctx, felderPfad(ctx, [s.p], cell), f, now, cell, reduce)
    const x = px(s.p.x, cell)
    const y = px(s.p.y, cell)
    for (let i = 0; i < 3; i++) {
      const a = hash(s.p.x * 7 + s.p.y * 3 + i) * TAU
      blatt(ctx, x + Math.cos(a) * cell * 0.2, y + Math.sin(a) * cell * 0.2, cell * (0.12 + 0.18 * f), a, LAUB_HELL, 0.9)
    }
  }
}

/* ================= Lichtung ================= */

/** Ein Blatt (spitzes Oval mit Mittelrippe) */
function blatt(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, w: number, c: RGB, a = 1) {
  if (r <= 0 || a <= 0) return
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(w)
  ctx.fillStyle = rgb(c, a)
  ctx.beginPath()
  ctx.moveTo(-r, 0)
  ctx.quadraticCurveTo(0, -r * 0.6, r, 0)
  ctx.quadraticCurveTo(0, r * 0.6, -r, 0)
  ctx.fill()
  ctx.strokeStyle = rgb(mix(c, [20, 40, 20], 0.5), a * 0.6)
  ctx.lineWidth = Math.max(0.5, r * 0.12)
  ctx.beginPath()
  ctx.moveTo(-r * 0.8, 0)
  ctx.lineTo(r * 0.8, 0)
  ctx.stroke()
  ctx.restore()
}

/** Weicher orangener Schein, einmal gerendert (statt je Flamme und Bild einen Verlauf zu bauen) */
let scheinCv: HTMLCanvasElement | null = null
function schein(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a: number) {
  if (!scheinCv) {
    scheinCv = document.createElement('canvas')
    scheinCv.width = scheinCv.height = 64
    const c = scheinCv.getContext('2d')!
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, 'rgba(255, 160, 60, 1)')
    g.addColorStop(1, 'rgba(255, 120, 30, 0)')
    c.fillStyle = g
    c.fillRect(0, 0, 64, 64)
  }
  const alt = ctx.globalAlpha
  ctx.globalAlpha = alt * a
  ctx.drawImage(scheinCv, x - r, y - r, r * 2, r * 2)
  ctx.globalAlpha = alt
}

/** Flamme (Tropfenform, flackert) */
function flamme(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, now: number, seed: number, a = 1) {
  if (r <= 0 || a <= 0) return
  const fl = 0.85 + 0.15 * Math.sin(now / 70 + seed * 3) + 0.08 * Math.sin(now / 37 + seed)
  const h = r * 1.6 * fl
  const sw = Math.sin(now / 110 + seed) * r * 0.2
  ctx.save()
  ctx.globalAlpha *= a
  schein(ctx, x, y - h * 0.2, r * 2.2, 0.45)
  for (const [s, c] of [
    [1, '#E8501E'],
    [0.7, '#FF9A2E'],
    [0.42, '#FFE58A'],
  ] as const) {
    ctx.fillStyle = c
    ctx.beginPath()
    ctx.moveTo(x - r * s, y)
    ctx.quadraticCurveTo(x - r * s, y - h * s * 0.6, x + sw * s, y - h * s)
    ctx.quadraticCurveTo(x + r * s, y - h * s * 0.6, x + r * s, y)
    ctx.arc(x, y, r * s, 0, Math.PI)
    ctx.fill()
  }
  ctx.restore()
}

/** Alter Baumstumpf von oben (Jahresringe, Moos) */
function stumpf(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, seed: number) {
  const r = cell * 0.62
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'
  ctx.beginPath()
  ctx.ellipse(x + r * 0.12, y + r * 0.18, r * 1.05, r * 0.95, 0, 0, TAU)
  ctx.fill()
  // Wurzelansaetze
  ctx.strokeStyle = rgb(RINDE_DUNKEL)
  ctx.lineCap = 'round'
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + hash(seed + i)
    ctx.lineWidth = cell * 0.14
    ctx.beginPath()
    ctx.moveTo(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7)
    ctx.lineTo(x + Math.cos(a + 0.2) * r * 1.5, y + Math.sin(a + 0.2) * r * 1.5)
    ctx.stroke()
  }
  ctx.fillStyle = rgb(RINDE)
  ctx.beginPath()
  ctx.arc(x, y, r * 0.85, 0, TAU)
  ctx.fill()
  ctx.fillStyle = rgb(RINDE_HELL)
  ctx.beginPath()
  ctx.arc(x, y, r * 0.68, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = rgb(RINDE, 0.8)
  ctx.lineWidth = Math.max(1, cell * 0.04)
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath()
    ctx.arc(x + cell * 0.03, y - cell * 0.02, r * 0.18 * i, 0, TAU)
    ctx.stroke()
  }
  ctx.fillStyle = rgb(LAUB, 0.85)
  ctx.beginPath()
  ctx.arc(x - r * 0.55, y + r * 0.35, r * 0.22, 0, TAU)
  ctx.arc(x - r * 0.35, y + r * 0.6, r * 0.14, 0, TAU)
  ctx.fill()
}

/** Holzstapel (drei Scheite), angezuendet mit Flammen und einem Ring, wie lange er noch brennt */
function holz(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, an: boolean, rest: number, aktiv: boolean, ausK: number, now: number, seed: number) {
  ctx.save()
  if (!aktiv) ctx.globalAlpha *= 0.35
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'
  ctx.beginPath()
  ctx.ellipse(x + cell * 0.06, y + cell * 0.12, cell * 0.5, cell * 0.38, 0, 0, TAU)
  ctx.fill()
  // Steinkreis
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU
    ctx.fillStyle = i % 2 ? '#8C847A' : '#A39A8E'
    ctx.beginPath()
    ctx.arc(x + Math.cos(a) * cell * 0.44, y + Math.sin(a) * cell * 0.4, cell * 0.09, 0, TAU)
    ctx.fill()
  }
  ctx.lineCap = 'round'
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI + 0.3
    ctx.strokeStyle = rgb(an ? mix(RINDE, [30, 20, 15], 0.5) : RINDE)
    ctx.lineWidth = cell * 0.16
    ctx.beginPath()
    ctx.moveTo(x - Math.cos(a) * cell * 0.34, y - Math.sin(a) * cell * 0.34)
    ctx.lineTo(x + Math.cos(a) * cell * 0.34, y + Math.sin(a) * cell * 0.34)
    ctx.stroke()
    ctx.fillStyle = rgb(RINDE_HELL)
    ctx.beginPath()
    ctx.arc(x + Math.cos(a) * cell * 0.34, y + Math.sin(a) * cell * 0.34, cell * 0.07, 0, TAU)
    ctx.fill()
  }
  // Rauch, wenn es gerade ausgegangen ist
  if (!an && ausK < 1)
    for (let i = 0; i < 4; i++) {
      const t = (ausK + i * 0.25) % 1
      ctx.fillStyle = `rgba(120, 120, 120, ${0.35 * (1 - t) * (1 - ausK)})`
      ctx.beginPath()
      ctx.arc(x + Math.sin(i * 2 + t * 3) * cell * 0.2, y - t * cell * 1.2, cell * (0.12 + t * 0.25), 0, TAU)
      ctx.fill()
    }
  ctx.restore()
  if (!an) return
  flamme(ctx, x, y + cell * 0.08, cell * 0.3, now, seed)
  flamme(ctx, x - cell * 0.16, y + cell * 0.12, cell * 0.17, now, seed + 2)
  flamme(ctx, x + cell * 0.17, y + cell * 0.1, cell * 0.19, now, seed + 5)
  // Wie lange noch: Ring, der sich leert (die letzten 3 Sekunden blinkt er)
  const k = clamp01(rest / ENT.feuerBrennt)
  const blink = rest < 3000 ? 0.5 + 0.5 * Math.sin(now / 80) : 1
  ctx.strokeStyle = `rgba(255, 200, 80, ${0.85 * blink})`
  ctx.lineWidth = Math.max(2, cell * 0.08)
  ctx.beginPath()
  ctx.arc(x, y, cell * 0.62, -Math.PI / 2, -Math.PI / 2 + TAU * k)
  ctx.stroke()
}

/** Glutschale: Steinschale mit gluehenden Kohlen, aus der die Flamme kommt */
function schale(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, now: number, reduce: boolean) {
  const p = reduce ? 0.6 : 0.5 + 0.5 * Math.sin(now / 320)
  schein(ctx, x, y, cell * 1.6, 0.3 + 0.2 * p)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
  ctx.beginPath()
  ctx.ellipse(x + cell * 0.06, y + cell * 0.12, cell * 0.55, cell * 0.45, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#7D756C'
  ctx.beginPath()
  ctx.arc(x, y, cell * 0.5, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#4B4540'
  ctx.beginPath()
  ctx.arc(x, y, cell * 0.38, 0, TAU)
  ctx.fill()
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + 0.4
    const r = i === 0 ? 0 : cell * 0.2
    const g = 0.5 + 0.5 * Math.sin(now / 180 + i * 1.7)
    ctx.fillStyle = rgb(mix([150, 40, 10], [255, 190, 80], reduce ? 0.6 : g))
    ctx.beginPath()
    ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, cell * 0.1, 0, TAU)
    ctx.fill()
  }
  if (!reduce) flamme(ctx, x, y + cell * 0.05, cell * 0.14, now, 9, 0.6 + 0.4 * p)
}

/** Dickicht (zugewachsene Lichtung): dichte Dornenbuesche */
function dickicht(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, seed: number) {
  ctx.fillStyle = rgb(LAUB_DUNKEL)
  ctx.beginPath()
  ctx.arc(x, y, cell * 0.58, 0, TAU)
  ctx.fill()
  for (let i = 0; i < 4; i++) {
    const a = hash(seed + i) * TAU
    ctx.fillStyle = rgb(mix(LAUB_DUNKEL, LAUB, 0.5 + 0.3 * hash(seed * 3 + i)))
    ctx.beginPath()
    ctx.arc(x + Math.cos(a) * cell * 0.25, y + Math.sin(a) * cell * 0.25, cell * 0.28, 0, TAU)
    ctx.fill()
  }
  ctx.strokeStyle = 'rgba(230, 220, 180, 0.8)'
  ctx.lineWidth = Math.max(1, cell * 0.04)
  for (let i = 0; i < 5; i++) {
    const a = hash(seed * 5 + i) * TAU
    const r0 = cell * 0.3
    ctx.beginPath()
    ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0)
    ctx.lineTo(x + Math.cos(a) * r0 * 1.7, y + Math.sin(a) * r0 * 1.7)
    ctx.stroke()
  }
}

/** Waldrand und Farne aendern sich kaum: einmal in ein Bild zeichnen, dann nur noch kopieren (neu, wenn sich Feldgroesse,
 *  Lage oder das Dickicht aendern) */
let randBild: { key: string; cv: HTMLCanvasElement; x0: number; y0: number } | null = null

/** Waldrand (nur Mission: dichte Baumkronen auf den Feldern rund um die Lichtung, die nicht zur Karte gehoeren) und Farne
 *  am Rand der Lichtung, die zeigen, wie weit sie reicht */
export function drawLichtungsRand(ctx: CanvasRenderingContext2D, k: Entkampf, cell: number, karte: ((x: number, y: number) => boolean) | null) {
  const b = k.box
  const x0 = b.x0 - 3
  const y0 = b.y0 - 3
  const w = b.x1 - b.x0 + 7
  const h = b.y1 - b.y0 + 7
  const dpr = Math.min(2, Math.abs(ctx.getTransform().a) / 1 || 1)
  const key = `${cell}|${dpr}|${x0},${y0},${w},${h}|${k.dickicht.size}|${karte ? 1 : 0}`
  if (randBild?.key !== key) {
    const cv = randBild?.cv ?? document.createElement('canvas')
    cv.width = Math.ceil(w * cell * dpr)
    cv.height = Math.ceil(h * cell * dpr)
    const c = cv.getContext('2d')!
    c.setTransform(dpr, 0, 0, dpr, -x0 * cell * dpr, -y0 * cell * dpr)
    c.clearRect(x0 * cell, y0 * cell, w * cell, h * cell)
    if (karte) waldrand(c, k, cell, karte)
    farne(c, k, cell)
    randBild = { key, cv, x0, y0 }
  }
  ctx.drawImage(randBild.cv, x0 * cell, y0 * cell, w * cell, h * cell)
}

function waldrand(ctx: CanvasRenderingContext2D, k: Entkampf, cell: number, karte: (x: number, y: number) => boolean) {
  const b = k.box
  const krone = (x: number, y: number) => {
    // Nah an der Lichtung? (sonst bleibt es Erde)
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (karte(x + dx, y + dy)) return true
    return false
  }
  for (let y = b.y0 - 3; y <= b.y1 + 3; y++)
    for (let x = b.x0 - 3; x <= b.x1 + 3; x++) {
      if (karte(x, y) || !krone(x, y) || (x + y) % 2) continue
      const h = hash(x * 31 + y * 17)
      const cx = px(x, cell) + (h - 0.5) * cell * 0.6
      const cy = px(y, cell) + (hash(x * 7 + y * 3) - 0.5) * cell * 0.6
      const r = cell * (1.05 + h * 0.35)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'
      ctx.beginPath()
      ctx.arc(cx + r * 0.15, cy + r * 0.2, r, 0, TAU)
      ctx.fill()
      ctx.fillStyle = rgb(mix(LAUB_DUNKEL, LAUB, h * 0.6))
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, TAU)
      ctx.fill()
      ctx.fillStyle = rgb(mix(LAUB, LAUB_HELL, h * 0.5), 0.8)
      ctx.beginPath()
      ctx.arc(cx - r * 0.25, cy - r * 0.25, r * 0.5, 0, TAU)
      ctx.fill()
    }
}

function farne(ctx: CanvasRenderingContext2D, k: Entkampf, cell: number) {
  for (const c of k.randFelder()) {
    const h = hash(c.x * 13 + c.y * 7)
    const x = px(c.x, cell)
    const y = px(c.y, cell)
    for (let i = 0; i < 3; i++) blatt(ctx, x + (hash(c.x + i * 3) - 0.5) * cell * 0.5, y + (hash(c.y + i * 5) - 0.5) * cell * 0.5, cell * (0.2 + h * 0.1), h * TAU + i * 2.1, i === 1 ? LAUB_DUNKEL : LAUB, 0.75)
  }
}

/** Boden der Lichtung (unter der Schlange): Stuempfe, Dickicht, Holzstapel, Glutschale */
export function drawLichtung(ctx: CanvasRenderingContext2D, k: Entkampf, cell: number, now: number, reduce: boolean) {
  const e = k.ent
  // Herzknoten frei: ein Ring um den Ent zeigt, wohin man fahren muss
  if (e.zustand === 'brennt') {
    const p = reduce ? 1 : 0.5 + 0.5 * Math.sin(now / 120)
    ctx.save()
    ctx.strokeStyle = `rgba(255, 190, 80, ${0.55 + 0.4 * p})`
    ctx.lineWidth = Math.max(2, cell * 0.12)
    ctx.setLineDash([cell * 0.4, cell * 0.25])
    ctx.lineDashOffset = reduce ? 0 : -now / 40
    ctx.beginPath()
    ctx.arc(px(e.x, cell), px(e.y, cell), cell * (1.9 + 0.1 * p), 0, TAU)
    ctx.stroke()
    ctx.restore()
  }
  k.stuempfe.forEach((s, i) => {
    // Wo der Ent gerade steht, steht er auf dem Stumpf
    if (i === e.platz && e.zustand !== 'abtauchen' && e.zustand !== 'auftauchen') return
    stumpf(ctx, px(s.x, cell), px(s.y, cell), cell, i * 17 + 3)
  })
  for (const kk of k.dickicht) {
    const x = (kk % 4096) - 1
    const y = Math.floor(kk / 4096) - 1
    dickicht(ctx, px(x, cell), px(y, cell), cell, x * 31 + y * 7)
  }
  for (const f of k.feuer) holz(ctx, px(f.p.x, cell), px(f.p.y, cell), cell, f.an, f.bis - now, f.ab <= e.phase, clamp01((now - f.ausT) / 2000), now, f.p.x * 3 + f.p.y)
  schale(ctx, px(k.schale.x, cell), px(k.schale.y, cell), cell, now, reduce)
}

/* ================= Wurzeln, Dornen, Ranken ================= */

/** Laufende Linien: Wurzeln brechen aus dem Boden, Dornen fliegen, Ranken wachsen zur Wand */
export function drawEntLinien(ctx: CanvasRenderingContext2D, k: Entkampf, cell: number, now: number, reduce: boolean) {
  for (const l of k.linien) {
    if (now < l.los) continue
    const n = ((now - l.los) / 1000) * l.tempo
    if (l.art === 'ranke') drawRanke(ctx, l, n, cell, now)
    else if (l.art === 'wurzel') drawWurzel(ctx, l, n, cell, now, reduce)
    else drawDornen(ctx, l, n, cell, now)
  }
}

function drawWurzel(ctx: CanvasRenderingContext2D, l: EntLinie, n: number, cell: number, now: number, reduce: boolean) {
  const brennt = !!l.feuer
  for (let i = 0; i < l.cells.length; i++) {
    const di = l.d[i]
    if (di > n || di > l.stop) continue
    const an = l.los + (di / l.tempo) * 1000
    const t = (now - an) / l.bleibt
    if (t > 1.6) continue
    const c = l.cells[i]
    const x = px(c.x, cell)
    const y = px(c.y, cell)
    const s = t < 0.25 ? easeOut(t / 0.25) : t < 1 ? 1 : 1 - (t - 1) / 0.6
    const w = Math.atan2(c.y - l.von.y, c.x - l.von.x)
    // Aufgebrochene Erde
    ctx.fillStyle = `rgba(70, 48, 30, ${0.5 * clamp01(1.6 - t)})`
    ctx.beginPath()
    ctx.ellipse(x, y, cell * 0.55, cell * 0.45, w, 0, TAU)
    ctx.fill()
    if (s <= 0) continue
    // Knorriges Wurzelstueck, quer zur Linie leicht gebogen
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(w + (hash(c.x * 13 + c.y) - 0.5) * 0.6)
    ctx.scale(s, s)
    ctx.fillStyle = rgb(brennt ? mix(RINDE_DUNKEL, [40, 20, 10], 0.4) : RINDE)
    ctx.beginPath()
    ctx.ellipse(0, 0, cell * 0.6, cell * 0.3, 0, 0, TAU)
    ctx.fill()
    ctx.fillStyle = rgb(RINDE_HELL)
    ctx.beginPath()
    ctx.ellipse(-cell * 0.1, -cell * 0.08, cell * 0.38, cell * 0.12, 0, 0, TAU)
    ctx.fill()
    // Dorniger Seitentrieb
    ctx.strokeStyle = rgb(RINDE_DUNKEL)
    ctx.lineWidth = Math.max(1, cell * 0.08)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(cell * 0.1, 0)
    ctx.lineTo(cell * 0.32, (hash(c.x + c.y * 5) > 0.5 ? 1 : -1) * cell * 0.42)
    ctx.stroke()
    ctx.restore()
    if (brennt && !reduce) flamme(ctx, x, y, cell * 0.22 * s, now, c.x * 5 + c.y, 0.9)
  }
}

function drawDornen(ctx: CanvasRenderingContext2D, l: EntLinie, n: number, cell: number, now: number) {
  for (let i = 0; i < l.cells.length; i++) {
    const di = l.d[i]
    if (di > n || di > l.stop) continue
    const an = l.los + (di / l.tempo) * 1000
    const t = (now - an) / l.bleibt
    if (t > 1.4) continue
    const c = l.cells[i]
    const w = Math.atan2(c.y - l.von.y, c.x - l.von.x)
    const x = px(c.x, cell)
    const y = px(c.y, cell)
    const a = clamp01(1.4 - t)
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(w)
    ctx.globalAlpha *= a
    // Dorn: spitzer Pfeil mit Schweif
    ctx.strokeStyle = 'rgba(160, 200, 120, 0.5)'
    ctx.lineWidth = Math.max(1, cell * 0.08)
    ctx.beginPath()
    ctx.moveTo(-cell * 0.9, 0)
    ctx.lineTo(0, 0)
    ctx.stroke()
    ctx.fillStyle = '#2E5A2A'
    ctx.beginPath()
    ctx.moveTo(cell * 0.42, 0)
    ctx.lineTo(-cell * 0.3, -cell * 0.16)
    ctx.lineTo(-cell * 0.18, 0)
    ctx.lineTo(-cell * 0.3, cell * 0.16)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#E8E2C0'
    ctx.beginPath()
    ctx.moveTo(cell * 0.42, 0)
    ctx.lineTo(cell * 0.18, -cell * 0.05)
    ctx.lineTo(cell * 0.18, cell * 0.05)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
}

function drawRanke(ctx: CanvasRenderingContext2D, l: EntLinie, n: number, cell: number, now: number) {
  const zurueck = now >= l.weg ? clamp01((now - l.weg) / ENT.rankenWachsen) : 0
  for (let i = 0; i < l.cells.length; i++) {
    const di = l.d[i]
    if (di > n) continue
    const c = l.cells[i]
    const x = px(c.x, cell)
    const y = px(c.y, cell)
    const s = (1 - zurueck) * clamp01((n - di) * 2 + 0.2)
    if (s <= 0) continue
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(s, s)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)'
    ctx.beginPath()
    ctx.ellipse(cell * 0.08, cell * 0.12, cell * 0.55, cell * 0.45, 0, 0, TAU)
    ctx.fill()
    // Dichter Busch als Grund, darauf verdrehte Ranken
    ctx.fillStyle = rgb(LAUB_DUNKEL)
    ctx.beginPath()
    ctx.arc(-cell * 0.18, 0, cell * 0.36, 0, TAU)
    ctx.arc(cell * 0.18, 0, cell * 0.36, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = '#3E7A34'
    ctx.lineWidth = cell * 0.2
    ctx.lineCap = 'round'
    for (let j = 0; j < 2; j++) {
      ctx.beginPath()
      for (let q = 0; q <= 6; q++) {
        const u = (q / 6 - 0.5) * cell
        const v = Math.sin(q * 1.3 + j * Math.PI + c.x + c.y) * cell * 0.22
        if (q) ctx.lineTo(u, v)
        else ctx.moveTo(u, v)
      }
      ctx.stroke()
    }
    ctx.strokeStyle = '#6FAE4E'
    ctx.lineWidth = cell * 0.07
    ctx.stroke()
    for (let j = 0; j < 3; j++) blatt(ctx, (hash(c.x * 3 + j) - 0.5) * cell * 0.8, (hash(c.y * 5 + j) - 0.5) * cell * 0.7, cell * 0.18, hash(j + c.x) * TAU, LAUB_HELL)
    // Dornen
    ctx.fillStyle = '#E8E2C0'
    for (let j = 0; j < 3; j++) {
      const a = hash(c.x * 11 + c.y * 3 + j) * TAU
      ctx.beginPath()
      ctx.arc(Math.cos(a) * cell * 0.35, Math.sin(a) * cell * 0.3, cell * 0.04, 0, TAU)
      ctx.fill()
    }
    ctx.restore()
  }
}

/* ================= Eicheln und Setzlinge ================= */

/** Fallende Eicheln und ihre Einschlaege (ueber der Schlange) */
export function drawEicheln(ctx: CanvasRenderingContext2D, k: Entkampf, cell: number, now: number, reduce: boolean) {
  for (const e of k.eicheln) {
    const x = px(e.p.x, cell)
    const y = px(e.p.y, cell)
    if (!e.fertig) {
      const f = clamp01((now - e.t) / Math.max(1, e.bis - e.t))
      if (f < 0.5 || reduce) continue
      const q = (f - 0.5) / 0.5
      eichel(ctx, x, y - (1 - q * q) * cell * 7, cell * (1.1 - 0.4 * q))
      continue
    }
    const t = now - e.bis
    const a = 1 - clamp01(t / 800)
    // Splitter und Staub
    for (let i = 0; i < 6; i++) {
      const w = (i / 6) * TAU + hash(e.p.x + i)
      const d = easeOut(clamp01(t / 450)) * cell * 1.1
      ctx.globalAlpha = a
      ctx.fillStyle = i % 2 ? '#8A5A2A' : '#C9A060'
      ctx.beginPath()
      ctx.arc(x + Math.cos(w) * d, y + Math.sin(w) * d, cell * 0.1, 0, TAU)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    ctx.strokeStyle = `rgba(255, 240, 200, ${0.7 * a})`
    ctx.lineWidth = cell * 0.2 * a
    ctx.beginPath()
    ctx.arc(x, y, cell * (0.4 + 1.2 * easeOut(clamp01(t / 500))), 0, TAU)
    ctx.stroke()
  }
}

function eichel(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = '#B07A3C'
  ctx.beginPath()
  ctx.ellipse(x, y + s * 0.08, s * 0.3, s * 0.38, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#6A4524'
  ctx.beginPath()
  ctx.ellipse(x, y - s * 0.16, s * 0.34, s * 0.2, 0, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = '#4A2E18'
  ctx.lineWidth = Math.max(1, s * 0.06)
  ctx.beginPath()
  ctx.moveTo(x, y - s * 0.32)
  ctx.lineTo(x + s * 0.06, y - s * 0.46)
  ctx.stroke()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
  ctx.beginPath()
  ctx.ellipse(x - s * 0.1, y + s * 0.05, s * 0.07, s * 0.14, 0, 0, TAU)
  ctx.fill()
}

/** Setzlinge: kleine Baumwesen mit zwei Blaettern auf dem Kopf, tappen auf die Schlange zu, welken oder verbrennen */
export function drawSetzlinge(ctx: CanvasRenderingContext2D, k: Entkampf, cell: number, now: number, reduce: boolean) {
  for (const s of k.setzlinge) {
    const g = reduce ? 1 : easeOut(clamp01((now - s.schrittT) / 300))
    const x = px(lerp(s.from.x, s.p.x, g), cell)
    const y = px(lerp(s.from.y, s.p.y, g), cell)
    const auf = reduce ? 1 : easeOut(clamp01((now - s.t) / 500))
    const weg = s.weg >= 0 ? clamp01((now - s.weg) / 700) : 0
    const hop = g < 1 && !reduce ? Math.sin(g * Math.PI) * cell * 0.12 : 0
    const r = cell * 0.36 * auf * (1 - weg * 0.6)
    if (r <= 0) continue
    ctx.save()
    ctx.globalAlpha *= 1 - weg
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'
    ctx.beginPath()
    ctx.ellipse(x + r * 0.1, y + r * 0.35, r * 0.9, r * 0.6, 0, 0, TAU)
    ctx.fill()
    ctx.fillStyle = rgb(RINDE)
    ctx.beginPath()
    ctx.arc(x, y - hop, r * 0.7, 0, TAU)
    ctx.fill()
    const welk = s.weg >= 0 ? HERBST : LAUB_HELL
    blatt(ctx, x - r * 0.5, y - hop - r * 0.6, r * 0.7, -0.7, welk)
    blatt(ctx, x + r * 0.5, y - hop - r * 0.6, r * 0.7, 0.7 + Math.PI, welk)
    ctx.fillStyle = rgb(AUGE)
    for (const sx of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(x + sx * r * 0.25, y - hop, r * 0.12, 0, TAU)
      ctx.fill()
    }
    ctx.restore()
  }
}

/* ================= Der Ent ================= */

/** Der Ent (ueber der Schlange, er ist riesig) */
export function drawEntBoss(ctx: CanvasRenderingContext2D, k: Entkampf, cell: number, now: number, reduce: boolean) {
  const e = k.ent
  const x = px(e.x, cell)
  const y = px(e.y, cell)
  const h = k.hoehe()
  const z = e.zustand
  // Wandert er, wirft er Erde auf
  if (h < 1) {
    ctx.fillStyle = `rgba(70, 48, 30, ${0.55 * (1 - h)})`
    ctx.beginPath()
    ctx.ellipse(x, y, cell * 1.5, cell * 1.3, 0, 0, TAU)
    ctx.fill()
    if (!reduce)
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + now / 400
        ctx.fillStyle = `rgba(110, 80, 50, ${0.6 * (1 - h)})`
        ctx.beginPath()
        ctx.arc(x + Math.cos(a) * cell * 1.2, y + Math.sin(a) * cell * 1.0, cell * 0.16, 0, TAU)
        ctx.fill()
      }
  }
  if (h <= 0.03) return
  const tot = z === 'tot' ? clamp01((now - e.seit) / ENT.tot) : 0
  const blitz = clamp01(1 - (now - e.trefferT) / 450)
  const brennt = z === 'brennt'
  const zorn = z === 'zorn' ? clamp01(1 - (now - e.seit) / ENT.zorn) : 0
  // Mit jedem Treffer herbstlicher
  const herbst = clamp01((k.entLeben - e.hp) / Math.max(1, k.entLeben)) * 0.75 + tot * 0.25
  const laub = mix(LAUB, HERBST, herbst)
  const laubHell = mix(LAUB_HELL, [240, 170, 70], herbst)
  const laubDunkel = mix(LAUB_DUNKEL, [120, 60, 20], herbst)
  const R = cell * 1.6 * (0.35 + 0.65 * h)
  const wiegen = reduce ? 0 : Math.sin(now / 900) * 0.04 + zorn * Math.sin(now / 40) * 0.05
  ctx.save()
  ctx.globalAlpha *= 1 - tot * 0.85
  // Schatten
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
  ctx.beginPath()
  ctx.ellipse(x + R * 0.18, y + R * 0.28, R * 1.25, R * 1.05, 0, 0, TAU)
  ctx.fill()
  // Wurzeln am Boden (fest, drehen nicht mit)
  ctx.strokeStyle = rgb(RINDE_DUNKEL)
  ctx.lineCap = 'round'
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + hash(i * 3) * 0.4
    const l = R * (1.05 + hash(i) * 0.35)
    ctx.lineWidth = cell * (0.28 - hash(i * 7) * 0.08) * h
    ctx.beginPath()
    ctx.moveTo(x + Math.cos(a) * R * 0.4, y + Math.sin(a) * R * 0.4)
    ctx.quadraticCurveTo(x + Math.cos(a + 0.25) * l * 0.8, y + Math.sin(a + 0.25) * l * 0.8, x + Math.cos(a - 0.1) * l, y + Math.sin(a - 0.1) * l)
    ctx.stroke()
  }
  ctx.translate(x, y)
  ctx.rotate(e.winkel + wiegen)
  // Aeste als Arme, zur Seite, leicht nach vorn; vor einer Attacke hebt er sie
  const warnt = z === 'bereit' && k.linien.some((l) => now < l.los)
  for (const sy of [-1, 1]) {
    const hub = warnt ? 0.35 : 0
    const sw = reduce ? 0 : Math.sin(now / 700 + sy) * 0.08
    ctx.save()
    ctx.rotate(sy * (1.25 - hub + sw))
    ctx.strokeStyle = rgb(RINDE)
    ctx.lineWidth = cell * 0.34
    ctx.beginPath()
    ctx.moveTo(R * 0.3, 0)
    ctx.quadraticCurveTo(R * 0.9, sy * R * 0.15, R * 1.35, 0)
    ctx.stroke()
    ctx.lineWidth = cell * 0.16
    ctx.beginPath()
    ctx.moveTo(R * 1.0, sy * R * 0.06)
    ctx.lineTo(R * 1.3, sy * R * 0.38)
    ctx.moveTo(R * 1.2, 0)
    ctx.lineTo(R * 1.55, -sy * R * 0.18)
    ctx.stroke()
    // Ein paar Blaetter an den Zweigspitzen
    blatt(ctx, R * 1.55, -sy * R * 0.18, cell * 0.22, 0.4 * sy, laubHell)
    blatt(ctx, R * 1.32, sy * R * 0.4, cell * 0.2, -0.6 * sy, laub)
    ctx.restore()
  }
  // Krone: viele Laubballen, hinten dunkler
  const ballen = 11
  for (let i = 0; i < ballen; i++) {
    const a = (i / ballen) * TAU + hash(i) * 0.3
    const d = R * (0.48 + hash(i * 5) * 0.12)
    const r = R * (0.42 + hash(i * 9) * 0.12) * (1 - tot * 0.5)
    const fall = tot * R * 0.8 * hash(i * 13)
    ctx.fillStyle = rgb(i % 3 === 0 ? laubDunkel : laub)
    ctx.beginPath()
    ctx.arc(Math.cos(a) * (d + fall), Math.sin(a) * (d + fall), r, 0, TAU)
    ctx.fill()
  }
  ctx.fillStyle = rgb(laub)
  ctx.beginPath()
  ctx.arc(-R * 0.1, 0, R * 0.62, 0, TAU)
  ctx.fill()
  // Lichter auf der Krone
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + 0.5
    ctx.fillStyle = rgb(laubHell, 0.85)
    ctx.beginPath()
    ctx.arc(Math.cos(a) * R * 0.45 - R * 0.12, Math.sin(a) * R * 0.45 - R * 0.1, R * 0.16, 0, TAU)
    ctx.fill()
  }
  // Moos und kleine Blueten
  ctx.fillStyle = 'rgba(255, 240, 200, 0.9)'
  for (let i = 0; i < 5; i++) {
    const a = hash(i * 21) * TAU
    ctx.beginPath()
    ctx.arc(Math.cos(a) * R * 0.6, Math.sin(a) * R * 0.6, cell * 0.05, 0, TAU)
    ctx.fill()
  }
  // Gesicht vorn: Rindenplatte, Brauen, Augen, Mund
  const fx = R * 0.72
  ctx.fillStyle = rgb(RINDE)
  ctx.beginPath()
  ctx.ellipse(fx, 0, R * 0.36, R * 0.46, 0, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = rgb(RINDE_DUNKEL, 0.8)
  ctx.lineWidth = Math.max(1, cell * 0.05)
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath()
    ctx.moveTo(fx - R * 0.28, i * R * 0.12)
    ctx.quadraticCurveTo(fx, i * R * 0.12 + R * 0.04, fx + R * 0.28, i * R * 0.1)
    ctx.stroke()
  }
  const wut = warnt || zorn > 0 || brennt
  const augen: RGB = brennt ? [255, 120, 60] : wut ? [255, 190, 70] : AUGE
  const glanz = reduce ? 0.85 : 0.7 + 0.3 * Math.sin(now / 300)
  for (const sy of [-1, 1]) {
    const ax = fx + R * 0.12
    const ay = sy * R * 0.18
    const gl = ctx.createRadialGradient(ax, ay, 0, ax, ay, R * 0.2)
    gl.addColorStop(0, rgb(augen, 0.9 * glanz))
    gl.addColorStop(1, rgb(augen, 0))
    ctx.fillStyle = gl
    ctx.beginPath()
    ctx.arc(ax, ay, R * 0.2, 0, TAU)
    ctx.fill()
    ctx.fillStyle = rgb(mix(augen, [255, 255, 255], 0.5))
    ctx.beginPath()
    ctx.arc(ax, ay, R * 0.055, 0, TAU)
    ctx.fill()
    // Braue
    ctx.strokeStyle = rgb(RINDE_DUNKEL)
    ctx.lineWidth = cell * 0.1
    ctx.beginPath()
    ctx.moveTo(ax + R * 0.1, ay + sy * R * 0.02 * (wut ? -2 : 1))
    ctx.lineTo(ax + R * 0.02, ay + sy * R * 0.14)
    ctx.stroke()
  }
  // Mund: beim Gebruell weit offen
  ctx.fillStyle = rgb(RINDE_DUNKEL)
  ctx.beginPath()
  ctx.ellipse(fx + R * 0.3, 0, R * (0.04 + 0.06 * zorn), R * (0.14 + 0.06 * zorn), 0, 0, TAU)
  ctx.fill()
  // Herzknoten am Stamm: glimmt immer schwach, liegt frei, wenn die Rinde brennt
  const hx = fx - R * 0.38
  const puls = reduce ? 1 : 0.5 + 0.5 * Math.sin(now / (brennt ? 90 : 500))
  const hr = R * (brennt ? 0.26 + 0.06 * puls : 0.14)
  const hg = ctx.createRadialGradient(hx, 0, 0, hx, 0, hr * 2.4)
  hg.addColorStop(0, rgb(brennt ? [255, 230, 140] : GLUT, brennt ? 0.95 : 0.35 + 0.15 * puls))
  hg.addColorStop(1, rgb(GLUT, 0))
  ctx.fillStyle = hg
  ctx.beginPath()
  ctx.arc(hx, 0, hr * 2.4, 0, TAU)
  ctx.fill()
  ctx.fillStyle = rgb(brennt ? [255, 120, 50] : [140, 70, 30])
  ctx.beginPath()
  ctx.arc(hx, 0, hr * 0.7, 0, TAU)
  ctx.fill()
  ctx.restore()
  // Rinde brennt: Flammen auf der Krone, Funken
  if (brennt && !reduce)
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + hash(i * 4)
      const d = R * (0.3 + hash(i * 8) * 0.6)
      flamme(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, cell * (0.22 + hash(i) * 0.14), now, i * 7)
    }
  // Getroffen: weisses Aufblitzen, Blaetter stieben
  if (blitz > 0) {
    ctx.fillStyle = `rgba(255, 245, 210, ${0.55 * blitz})`
    ctx.beginPath()
    ctx.arc(x, y, R * 1.15, 0, TAU)
    ctx.fill()
    if (!reduce)
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU + hash(e.trefferT + i)
        const d = R * (0.9 + (1 - blitz) * 1.4)
        blatt(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, cell * 0.2, a + now / 200, i % 2 ? HERBST : LAUB_HELL, blitz)
      }
  }
  // Zerfall: das Laub rieselt auseinander
  if (tot > 0 && !reduce)
    for (let i = 0; i < 26; i++) {
      const a = hash(i * 3) * TAU
      const d = R * (0.3 + tot * 2.2 * hash(i * 7))
      blatt(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d + tot * cell * hash(i), cell * 0.22, a + tot * 6, i % 3 ? HERBST : laub, 1 - tot)
    }
}

/** Flamme, die eine brennende Wurzel zum Ent zuruecklaeuft */
export function drawRueckfeuer(ctx: CanvasRenderingContext2D, k: Entkampf, cell: number, now: number) {
  const r = k.rueckfeuer
  if (!r) return
  const f = clamp01((now - r.t) / Math.max(1, r.ankunft - r.t))
  const lang: number[] = [0]
  for (let i = 1; i < r.pfad.length; i++) lang.push(lang[i - 1] + Math.hypot(r.pfad[i].x - r.pfad[i - 1].x, r.pfad[i].y - r.pfad[i - 1].y))
  const ges = lang[lang.length - 1] || 1
  const an = (s: number): Pf => {
    const d = clamp01(s) * ges
    let i = 1
    while (i < lang.length - 1 && lang[i] < d) i++
    const a = r.pfad[i - 1]
    const b = r.pfad[i]
    const q = (d - lang[i - 1]) / Math.max(1e-6, lang[i] - lang[i - 1])
    return { x: lerp(a.x, b.x, clamp01(q)), y: lerp(a.y, b.y, clamp01(q)) }
  }
  // Glutspur hinter der Flamme
  for (let i = 0; i < 10; i++) {
    const p = an(f - i * 0.03)
    ctx.fillStyle = `rgba(255, ${120 + i * 10}, 40, ${0.6 * (1 - i / 10)})`
    ctx.beginPath()
    ctx.arc(px(p.x, cell), px(p.y, cell), cell * (0.22 - i * 0.015), 0, TAU)
    ctx.fill()
  }
  const p = an(f)
  flamme(ctx, px(p.x, cell), px(p.y, cell) + cell * 0.15, cell * 0.36, now, 3)
}

/** Getragene Flamme am Kopf der Schlange */
export function drawGetrageneFlamme(ctx: CanvasRenderingContext2D, k: Entkampf, kopf: Pf, cell: number, now: number) {
  if (!k.traegt) return
  const auf = easeOut(clamp01((now - k.flammeT) / 300))
  flamme(ctx, px(kopf.x, cell), px(kopf.y, cell) - cell * 0.35, cell * 0.24 * auf, now, 1)
}

/** Laubsturm: Blaetter treiben quer uebers Bild und nehmen die Sicht (in Bildschirmkoordinaten) */
export function drawLaubsturm(ctx: CanvasRenderingContext2D, k: Entkampf, vw: number, vh: number, now: number, reduce: boolean) {
  const s = k.sturm
  if (!s) return
  const vor = now < s.los
  const ein = vor ? clamp01((now - s.ab) / Math.max(1, s.los - s.ab)) * 0.3 : 1
  const aus = clamp01((s.bis - now) / 600)
  const st = ein * aus
  if (st <= 0) return
  ctx.save()
  if (!vor) {
    ctx.fillStyle = `rgba(46, 70, 34, ${0.38 * st})`
    ctx.fillRect(0, 0, vw, vh)
  }
  const n = reduce ? 30 : 80
  const cell = Math.max(vw, vh) / 30
  for (let i = 0; i < n; i++) {
    const tempo = 0.35 + hash(i) * 0.5
    const lauf = ((now / 1000) * tempo + hash(i * 3)) % 1
    const xx = s.richtung > 0 ? lauf * (vw + 80) - 40 : vw + 40 - lauf * (vw + 80)
    const yy = hash(i * 7) * vh + Math.sin(now / 300 + i) * 18
    const c = i % 4 === 0 ? HERBST : i % 3 === 0 ? LAUB_DUNKEL : LAUB_HELL
    if (i / n > st) continue
    blatt(ctx, xx, yy, cell * (0.25 + hash(i * 11) * 0.3), now / 160 + i, c, 0.85)
  }
  ctx.restore()
}

/* ================= Anzeige ================= */

function rundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Name, Lebensleiste des Ents (seine drei Leben), links die getragene Flamme und wie viele Feuer brennen */
export function drawEntHud(ctx: CanvasRenderingContext2D, k: Entkampf, vw: number, vh: number, now: number) {
  const e = k.ent
  const w = Math.min(220, vw * 0.48)
  const x0 = (vw - w) / 2
  const y0 = vh - 40
  ctx.save()
  ctx.font = '800 12px "Libre Franklin", system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  const name = k.entLeben > 1 ? `ENT · PHASE ${Math.min(k.entLeben, e.phase + 1)}/${k.entLeben}` : 'ENT'
  ctx.fillStyle = 'rgba(23, 21, 19, 0.75)'
  ctx.fillText(name, vw / 2 + 1, y0 + 11)
  ctx.fillStyle = e.zustand === 'brennt' ? '#FFC36B' : '#F5EFE6'
  ctx.fillText(name, vw / 2, y0 + 10)
  const by = y0 + 16
  const bh = 10
  ctx.fillStyle = 'rgba(23, 21, 19, 0.8)'
  rundRect(ctx, x0 - 3, by - 3, w + 6, bh + 6, 7)
  ctx.fill()
  const teil = (w - 4 * (k.entLeben - 1)) / k.entLeben
  for (let i = 0; i < k.entLeben; i++) {
    const voll = i < e.hp
    const verloren = i === e.hp && now - e.trefferT < 700
    const x = x0 + i * (teil + 4)
    ctx.fillStyle = voll ? (e.zustand === 'brennt' ? '#FF9A3D' : '#5DB85A') : verloren ? `rgba(255, 255, 255, ${1 - (now - e.trefferT) / 700})` : 'rgba(245, 239, 230, 0.12)'
    rundRect(ctx, x, by, teil, bh, 4)
    ctx.fill()
    if (voll) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)'
      rundRect(ctx, x + 2, by + 1, teil - 4, 3, 2)
      ctx.fill()
    }
  }
  // Links: Flamme getragen? Feuer, die brennen
  const akt = k.aktiveFeuer
  const an = akt.filter((f) => f.an).length
  ctx.fillStyle = 'rgba(23, 21, 19, 0.6)'
  rundRect(ctx, 10, by - 6, 30 + akt.length * 14, bh + 12, 10)
  ctx.fill()
  flamme(ctx, 24, by + bh / 2 + 5, k.traegt ? 5 : 3.5, now, 2, k.traegt ? 1 : 0.35)
  for (let i = 0; i < akt.length; i++) {
    ctx.fillStyle = i < an ? '#FF9A3D' : 'rgba(245, 239, 230, 0.2)'
    ctx.beginPath()
    ctx.arc(40 + i * 14, by + bh / 2 + 1, 4.5, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}

/* ================= Mini-Ents ================= */

/** Mini-Ent von oben: Laubkrone mit Gesicht, zwei Zweigarme (beim Werfen schwingt einer, beim Greifen strecken sich beide) */
export function drawMiniEnt(ctx: CanvasRenderingContext2D, e: MiniEnt, cell: number, now: number, packt: boolean, reduce: boolean) {
  const x = px(e.p.x, cell)
  const y = px(e.p.y, cell)
  const u = cell * 0.62
  const wurf = clamp01((now - e.wurfT) / 450)
  const schwung = wurf < 1 ? Math.sin(wurf * Math.PI) : 0
  const griff = packt ? 1 : clamp01(1 - (now - e.griffT) / 400)
  ctx.save()
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)'
  ctx.beginPath()
  ctx.ellipse(x + u * 0.12, y + u * 0.25, u * 1.15, u * 0.95, 0, 0, TAU)
  ctx.fill()
  // Wurzeln
  ctx.strokeStyle = rgb(RINDE_DUNKEL)
  ctx.lineCap = 'round'
  ctx.lineWidth = cell * 0.1
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + 0.3
    ctx.beginPath()
    ctx.moveTo(x + Math.cos(a) * u * 0.5, y + Math.sin(a) * u * 0.5)
    ctx.lineTo(x + Math.cos(a + 0.3) * u * 1.05, y + Math.sin(a + 0.3) * u * 1.05)
    ctx.stroke()
  }
  ctx.translate(x, y)
  ctx.rotate(e.winkel + (reduce ? 0 : Math.sin(now / 800 + e.p.x) * 0.05))
  for (const sy of [-1, 1]) {
    ctx.save()
    const arm = sy > 0 ? schwung * 0.9 : 0
    ctx.rotate(sy * (1.3 - arm - griff * 0.9))
    ctx.strokeStyle = rgb(RINDE)
    ctx.lineWidth = cell * 0.14
    ctx.beginPath()
    ctx.moveTo(u * 0.3, 0)
    ctx.lineTo(u * (1.05 + griff * 0.35), 0)
    ctx.stroke()
    ctx.lineWidth = cell * 0.07
    ctx.beginPath()
    ctx.moveTo(u * 0.85, 0)
    ctx.lineTo(u * 1.1, sy * u * 0.22)
    ctx.stroke()
    ctx.restore()
  }
  // Krone wie beim grossen Ent: runde Laubballen, hinten dunkler, Lichter oben
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.5
    ctx.fillStyle = rgb(i % 2 ? LAUB : LAUB_DUNKEL)
    ctx.beginPath()
    ctx.arc(Math.cos(a) * u * 0.42 - u * 0.12, Math.sin(a) * u * 0.42, u * 0.36, 0, TAU)
    ctx.fill()
  }
  ctx.fillStyle = rgb(LAUB)
  ctx.beginPath()
  ctx.arc(-u * 0.12, 0, u * 0.48, 0, TAU)
  ctx.fill()
  ctx.fillStyle = rgb(LAUB_HELL, 0.9)
  for (const [lx, ly, lr] of [
    [-0.3, -0.22, 0.2],
    [0.0, 0.2, 0.14],
    [-0.42, 0.18, 0.12],
  ] as const) {
    ctx.beginPath()
    ctx.arc(lx * u, ly * u, lr * u, 0, TAU)
    ctx.fill()
  }
  // Gesicht aus Rinde vorn, mit Maserung, Brauen und gluehenden Augen
  ctx.fillStyle = rgb(RINDE)
  ctx.beginPath()
  ctx.ellipse(u * 0.5, 0, u * 0.28, u * 0.36, 0, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = rgb(RINDE_DUNKEL, 0.7)
  ctx.lineWidth = Math.max(1, cell * 0.03)
  for (const q of [-0.18, 0.18]) {
    ctx.beginPath()
    ctx.moveTo(u * 0.3, q * u)
    ctx.quadraticCurveTo(u * 0.5, q * u + u * 0.04, u * 0.7, q * u * 0.8)
    ctx.stroke()
  }
  const boese = packt || schwung > 0
  const augen: RGB = boese ? [255, 170, 60] : AUGE
  for (const sy of [-1, 1]) {
    const ax = u * 0.6
    const ay = sy * u * 0.14
    const gl = ctx.createRadialGradient(ax, ay, 0, ax, ay, u * 0.16)
    gl.addColorStop(0, rgb(augen, 0.9))
    gl.addColorStop(1, rgb(augen, 0))
    ctx.fillStyle = gl
    ctx.beginPath()
    ctx.arc(ax, ay, u * 0.16, 0, TAU)
    ctx.fill()
    ctx.fillStyle = rgb(mix(augen, [255, 255, 255], 0.5))
    ctx.beginPath()
    ctx.arc(ax, ay, u * 0.055, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = rgb(RINDE_DUNKEL)
    ctx.lineWidth = Math.max(1, cell * 0.06)
    ctx.beginPath()
    ctx.moveTo(ax + u * 0.08, ay + sy * u * (boese ? -0.04 : 0.02))
    ctx.lineTo(ax - u * 0.02, ay + sy * u * 0.12)
    ctx.stroke()
  }
  // Blaetterbombe in der Hand, kurz bevor sie fliegt
  if (schwung > 0 && wurf < 0.5) {
    ctx.fillStyle = rgb(LAUB_HELL)
    ctx.beginPath()
    ctx.arc(u * 0.9, u * 0.6, u * 0.22, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}

/** Blaetterbomben: Schatten und rote Plus-Flaeche am Ziel (unter der Schlange) */
export function drawBombenWarnung(ctx: CanvasRenderingContext2D, bomben: Blaetterbombe[], felder: (b: Blaetterbombe) => Pf[], cell: number, now: number, reduce: boolean) {
  for (const b of bomben) {
    if (b.fertig) continue
    const f = clamp01((now - b.t) / Math.max(1, b.bis - b.t))
    warnPfad(ctx, felderPfad(ctx, felder(b), cell), f, now, cell, reduce)
    ctx.fillStyle = `rgba(0, 0, 0, ${0.15 + 0.35 * f})`
    ctx.beginPath()
    ctx.ellipse(px(b.p.x, cell), px(b.p.y, cell), cell * (0.2 + 0.4 * f), cell * (0.16 + 0.32 * f), 0, 0, TAU)
    ctx.fill()
  }
}

/** Blaetterbomben im Flug (im Bogen) und wenn sie platzen (ueber der Schlange) */
export function drawBomben(ctx: CanvasRenderingContext2D, bomben: Blaetterbombe[], cell: number, now: number, reduce: boolean) {
  for (const b of bomben) {
    if (!b.fertig) {
      const f = clamp01((now - b.t) / Math.max(1, b.bis - b.t))
      const x = px(lerp(b.von.x, b.p.x, f), cell)
      const y = px(lerp(b.von.y, b.p.y, f), cell) - Math.sin(f * Math.PI) * cell * 2.2
      const r = cell * (0.3 + Math.sin(f * Math.PI) * 0.12)
      ctx.fillStyle = rgb(LAUB_DUNKEL)
      ctx.beginPath()
      ctx.arc(x, y, r, 0, TAU)
      ctx.fill()
      for (let i = 0; i < 5; i++) blatt(ctx, x + Math.cos(i * 1.3 + now / 120) * r * 0.6, y + Math.sin(i * 1.3 + now / 120) * r * 0.6, r * 0.55, i * 1.3 + now / 120, i % 2 ? LAUB_HELL : LAUB)
      continue
    }
    const t = clamp01((now - b.bis) / 700)
    if (reduce && t > 0.3) continue
    const x = px(b.p.x, cell)
    const y = px(b.p.y, cell)
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU + hash(b.p.x * 3 + i)
      const d = easeOut(t) * cell * (1 + hash(i + b.p.y) * 0.8)
      blatt(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, cell * 0.2, a + t * 5, i % 3 ? LAUB_HELL : HERBST, 1 - t)
    }
  }
}

/** Mini-Ent hat gepackt: Ranken zum Kopf, ein Ring, der sich leert, und ein Pfeil, wohin man wischen muss */
export function drawGriff(ctx: CanvasRenderingContext2D, von: Pf, kopf: Pf, weg: { x: number; y: number }, k: number, cell: number, now: number) {
  const ax = px(von.x, cell)
  const ay = px(von.y, cell)
  const bx = px(kopf.x, cell)
  const by = px(kopf.y, cell)
  ctx.save()
  ctx.strokeStyle = '#3E7A34'
  ctx.lineCap = 'round'
  for (let j = 0; j < 3; j++) {
    ctx.lineWidth = cell * (0.12 - j * 0.02)
    ctx.beginPath()
    for (let q = 0; q <= 8; q++) {
      const t = q / 8
      const nx = -(by - ay)
      const ny = bx - ax
      const l = Math.hypot(nx, ny) || 1
      const s = Math.sin(t * Math.PI * 2 + j * 2 + now / 120) * cell * 0.12
      const x = lerp(ax, bx, t) + (nx / l) * s
      const y = lerp(ay, by, t) + (ny / l) * s
      if (q) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
    }
    ctx.stroke()
  }
  // Ring um den Kopf: so viel Zeit ist noch
  ctx.strokeStyle = 'rgba(255, 70, 60, 0.95)'
  ctx.lineWidth = Math.max(2, cell * 0.12)
  ctx.beginPath()
  ctx.arc(bx, by, cell * 0.7, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - clamp01(k)))
  ctx.stroke()
  // Pfeil: in diese Richtung wischen
  const p = 0.5 + 0.5 * Math.sin(now / 60)
  const w = Math.atan2(weg.y, weg.x)
  ctx.translate(bx + weg.x * cell * (1.1 + 0.15 * p), by + weg.y * cell * (1.1 + 0.15 * p))
  ctx.rotate(w)
  ctx.fillStyle = '#FFFFFF'
  ctx.strokeStyle = 'rgba(23, 21, 19, 0.8)'
  ctx.lineWidth = Math.max(1.5, cell * 0.06)
  ctx.beginPath()
  ctx.moveTo(cell * 0.4, 0)
  ctx.lineTo(-cell * 0.15, -cell * 0.32)
  ctx.lineTo(-cell * 0.15, -cell * 0.12)
  ctx.lineTo(-cell * 0.4, -cell * 0.12)
  ctx.lineTo(-cell * 0.4, cell * 0.12)
  ctx.lineTo(-cell * 0.15, cell * 0.12)
  ctx.lineTo(-cell * 0.15, cell * 0.32)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}
