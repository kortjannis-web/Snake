/**
 * Wueste (Insel): Flut am Rand, Sandwurm und Sandsturm zeichnen. Spiellogik in game.ts (wuesteNachApfel).
 */
import type { P } from '../game/types'

const TAU = Math.PI * 2
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

/** Sandwurm kuendigt sich an: die Reihe brodelt (Sandblasen platzen, Staub steigt), immer heftiger */
export function drawSandwurmWarnung(ctx: CanvasRenderingContext2D, felder: P[], cell: number, now: number, fortschritt: number) {
  const st = 0.35 + 0.65 * fortschritt
  for (const c of felder) {
    const x = (c.x + 0.5) * cell
    const y = (c.y + 0.5) * cell
    const z = hash(c.x * 3.3 + c.y * 7.7)
    // dunkler, aufgewuehlter Sand
    ctx.fillStyle = `rgba(150, 105, 50, ${0.22 * st})`
    ctx.fillRect(c.x * cell - 0.3, c.y * cell - 0.3, cell + 0.6, cell + 0.6)
    for (let i = 0; i < 2; i++) {
      const t = ((now / (700 - 300 * fortschritt) + z + i * 0.5) % 1 + 1) % 1
      const bx = x + (hash(z * 13 + i) - 0.5) * cell * 0.7
      const by = y + (hash(z * 17 + i) - 0.5) * cell * 0.6
      ctx.fillStyle = `rgba(110, 72, 30, ${0.6 * st * (1 - t)})`
      ctx.beginPath()
      ctx.arc(bx, by, cell * (0.05 + 0.13 * t), 0, TAU)
      ctx.fill()
      ctx.fillStyle = `rgba(235, 205, 150, ${0.5 * st * (1 - t)})`
      ctx.beginPath()
      ctx.arc(bx, by - t * cell * 0.35, cell * 0.04 * (1 + t), 0, TAU)
      ctx.fill()
    }
  }
}

/** Wo der Sandwurm aus dem Sand ragt: Boegen fest im Boden (alle BOGEN Felder einer), der Koerper gleitet hindurch */
const BOGEN = 5
const BOGEN_HALB = 1.7

/**
 * Der Sandwurm, zwei Felder breit und sehr lang: Er taucht in Boegen auf und wieder ab (die Boegen stehen fest,
 * der Koerper gleitet hindurch), dazwischen wuehlt er unter dem Sand. Vorne immer der Kopf mit rundem Schlund.
 * mitte = Mitte quer (in Feldern, zwischen den beiden Reihen), kopf = laengs (Felder), dir = Laufrichtung
 */
export function drawSandwurm(ctx: CanvasRenderingContext2D, achse: 'x' | 'y', mitte: number, kopf: number, dir: 1 | -1, laenge: number, von: number, bis: number, cell: number, now: number) {
  const pt = (v: number, q = 0) => (achse === 'x' ? { x: (v + 0.5) * cell, y: (mitte + q) * cell } : { x: (mitte + q) * cell, y: (v + 0.5) * cell })
  const r0 = cell * 0.95
  // Hoehe ueber dem Sand (0 = darunter, 1 = ganz oben), vorne ist der Kopf immer draussen
  const hoehe = (v: number) => {
    const n = Math.round((v - 2) / BOGEN) * BOGEN + 2
    const d = Math.abs(v - n) / BOGEN_HALB
    const bogen = Math.max(0, 1 - d * d)
    const vorn = Math.max(0, 1 - Math.abs(kopf - v) / 1.6)
    return Math.max(bogen, vorn)
  }
  const ende = kopf - dir * laenge
  const lo = Math.max(Math.min(kopf, ende), von - 1.5)
  const hi = Math.min(Math.max(kopf, ende), bis + 1.5)
  if (lo > hi) return
  // Unter dem Sand: aufgeworfener Wall mit Rissen, wo der Koerper gerade wuehlt
  for (let v = lo; v <= hi; v += 0.25) {
    if (hoehe(v) > 0.15) continue
    const p = pt(v)
    const w = Math.sin(v * 7.3) * cell * 0.08
    ctx.fillStyle = 'rgba(160, 112, 58, 0.45)'
    ctx.beginPath()
    ctx.ellipse(p.x + (achse === 'y' ? w : 0), p.y + (achse === 'x' ? w : 0), cell * 0.55, cell * 0.55, 0, 0, TAU)
    ctx.fill()
  }
  // Krater, wo der Wurm ein- und auftaucht (an den Enden der Boegen)
  for (let n = Math.floor((lo - 2) / BOGEN) * BOGEN + 2; n <= hi + BOGEN; n += BOGEN)
    for (const e of [n - BOGEN_HALB * 0.85, n + BOGEN_HALB * 0.85]) {
      if (e < lo || e > hi) continue
      const p = pt(e)
      ctx.fillStyle = 'rgba(120, 78, 34, 0.55)'
      ctx.beginPath()
      ctx.ellipse(p.x, p.y, cell * (achse === 'x' ? 0.75 : 1.15), cell * (achse === 'x' ? 1.15 : 0.75), 0, 0, TAU)
      ctx.fill()
      ctx.strokeStyle = 'rgba(235, 205, 150, 0.6)'
      ctx.lineWidth = Math.max(1, cell * 0.06)
      ctx.stroke()
    }
  // Koerper vom Schwanz zum Kopf: dicke Scheiben, oben heller, Ringe gleiten mit dem Koerper
  const schritt = 0.14
  const start = dir === 1 ? lo : hi
  const stop = dir === 1 ? hi : lo
  for (let i = 0; ; i++) {
    const v = start + dir * i * schritt
    if (dir === 1 ? v > stop : v < stop) break
    const h = hoehe(v)
    if (h <= 0.15) {
      // Ein- und Austauchen: Sand spritzt
      if (h > 0.02 && Math.floor(v / schritt) % 3 === 0) {
        const p = pt(v)
        const t = ((now / 260 + v) % 1 + 1) % 1
        ctx.fillStyle = `rgba(220, 186, 126, ${0.7 * (1 - t)})`
        ctx.beginPath()
        ctx.arc(p.x + (hash(v) - 0.5) * cell * 1.4, p.y + (hash(v + 3) - 0.5) * cell * 1.4 - t * cell * 0.4, cell * 0.08, 0, TAU)
        ctx.fill()
      }
      continue
    }
    const p = pt(v)
    // Zum Schwanzende hin schmaler
    const spitz = Math.min(1, 0.35 + (laenge - Math.abs(kopf - v)) / 3)
    const r = r0 * (0.55 + 0.45 * h) * spitz
    ctx.fillStyle = `rgba(70, 40, 12, ${0.25 * h})`
    ctx.beginPath()
    ctx.arc(p.x + cell * 0.12 * h, p.y + cell * 0.22 * h, r, 0, TAU)
    ctx.fill()
    const u = Math.abs(kopf - v)
    const ring = u % 0.6 < 0.13
    const hell = 0.55 + 0.45 * h
    ctx.fillStyle = ring ? `rgb(${120 * hell}, ${78 * hell}, ${36 * hell})` : `rgb(${200 * hell}, ${148 * hell}, ${86 * hell})`
    ctx.beginPath()
    ctx.arc(p.x, p.y, r, 0, TAU)
    ctx.fill()
    if (!ring) {
      ctx.fillStyle = `rgba(245, 214, 160, ${0.35 * h})`
      ctx.beginPath()
      ctx.arc(p.x - r * 0.25, p.y - r * 0.3, r * 0.45, 0, TAU)
      ctx.fill()
    }
  }
  // Kopf: runder Schlund mit Zaehnen nach vorn, Sand spritzt auf
  const k = pt(kopf + dir * 0.35)
  const dx = achse === 'x' ? dir : 0
  const dy = achse === 'y' ? dir : 0
  const auf = 0.8 + 0.2 * Math.sin(now / 70)
  ctx.fillStyle = '#3A1A0C'
  ctx.beginPath()
  ctx.arc(k.x, k.y, cell * 0.72 * auf, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#F4EAD2'
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + now / 500
    const r1 = cell * 0.72 * auf
    ctx.beginPath()
    ctx.moveTo(k.x + Math.cos(a - 0.12) * r1, k.y + Math.sin(a - 0.12) * r1)
    ctx.lineTo(k.x + Math.cos(a) * r1 * 0.5, k.y + Math.sin(a) * r1 * 0.5)
    ctx.lineTo(k.x + Math.cos(a + 0.12) * r1, k.y + Math.sin(a + 0.12) * r1)
    ctx.fill()
  }
  for (let i = 0; i < 16; i++) {
    const t = ((now / 300 + i / 16) % 1 + 1) % 1
    const a = (hash(i) - 0.5) * 2.4
    const vx = dx * Math.cos(a) - dy * Math.sin(a)
    const vy = dy * Math.cos(a) + dx * Math.sin(a)
    ctx.fillStyle = `rgba(214, 178, 118, ${0.85 * (1 - t)})`
    ctx.beginPath()
    ctx.arc(k.x + vx * t * cell * 1.6, k.y + vy * t * cell * 1.6, cell * 0.1 * (1 - t * 0.5), 0, TAU)
    ctx.fill()
  }
}

/**
 * Sandsturm ueber dem Bild (Bildschirmkoordinaten): rund um den Kopf bleibt etwas Sicht, weiter weg wird es
 * dicht; Sandschlieren ziehen schraeg durchs Bild. staerke 0..1 (blendet ein und aus)
 */
export function drawSandsturm(ctx: CanvasRenderingContext2D, vw: number, vh: number, kx: number, ky: number, cell: number, staerke: number, now: number) {
  if (staerke <= 0) return
  const r0 = cell * 2.6
  const r1 = cell * 6.5
  const g = ctx.createRadialGradient(kx, ky, r0, kx, ky, r1)
  g.addColorStop(0, `rgba(205, 165, 105, ${0.12 * staerke})`)
  g.addColorStop(1, `rgba(196, 150, 90, ${0.82 * staerke})`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, vw, vh)
  // Schlieren
  ctx.strokeStyle = `rgba(240, 210, 160, ${0.35 * staerke})`
  ctx.lineWidth = 1.5
  for (let i = 0; i < 60; i++) {
    const sp = 0.25 + hash(i) * 0.35
    const x = ((hash(i + 3) * (vw + 200) + now * sp) % (vw + 200)) - 100
    const y = ((hash(i + 7) * (vh + 100) + now * sp * 0.35) % (vh + 100)) - 50
    const l = 20 + hash(i + 11) * 40
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + l, y + l * 0.35)
    ctx.stroke()
  }
  ctx.fillStyle = `rgba(250, 225, 180, ${0.5 * staerke})`
  for (let i = 0; i < 90; i++) {
    const x = ((hash(i + 21) * vw + now * (0.4 + hash(i) * 0.5)) % vw + vw) % vw
    const y = ((hash(i + 27) * vh + now * 0.12 + Math.sin(now / 300 + i) * 6) % vh + vh) % vh
    ctx.fillRect(x, y, 2, 1.5)
  }
}
