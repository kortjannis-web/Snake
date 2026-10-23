/**
 * Tiere der Wiese (Bienenstock mit Schwarm, Igel, Maulwurfshuegel) und der Wueste (Kamelkarawane, Geier, Klapperschlange).
 * Einfache Formen ohne Verlaeufe. Spiellogik in game.ts (wieseNachApfel, tiereTakt, wuesteNachApfel).
 */
import type { P } from '../game/types'

const TAU = Math.PI * 2
const h2 = (x: number, y: number, s = 0) => {
  const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453
  return v - Math.floor(v)
}
const schatten = (ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, a = 0.28) => {
  ctx.fillStyle = `rgba(0, 0, 0, ${a})`
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU)
  ctx.fill()
}

/* ================= Wiese ================= */

/** Bienenstock (Korb): gestreift, mit Flugloch; ein paar Bienen summen drumherum */
export function drawBienenstock(ctx: CanvasRenderingContext2D, p: P, cell: number, now: number, a: number) {
  const x = (p.x + 0.5) * cell
  const y = (p.y + 0.5) * cell
  const u = cell * 0.46
  ctx.globalAlpha = a
  schatten(ctx, x, y + u * 0.7, u * 0.9, u * 0.35)
  ctx.fillStyle = '#C8902E'
  ctx.beginPath()
  ctx.ellipse(x, y, u * 0.82, u * 0.9, 0, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = '#8A5A18'
  ctx.lineWidth = Math.max(1, cell * 0.05)
  for (let i = -2; i <= 2; i++) {
    const yy = y + i * u * 0.32
    const w = Math.sqrt(Math.max(0, 1 - (i * 0.32 / 0.9) ** 2)) * u * 0.82
    ctx.beginPath()
    ctx.moveTo(x - w, yy)
    ctx.lineTo(x + w, yy)
    ctx.stroke()
  }
  ctx.fillStyle = '#3A2410'
  ctx.beginPath()
  ctx.arc(x, y + u * 0.45, u * 0.16, 0, TAU)
  ctx.fill()
  for (let i = 0; i < 3; i++) {
    const w = now / (300 + i * 70) + i * 2.1
    ctx.fillStyle = '#F2C230'
    ctx.beginPath()
    ctx.arc(x + Math.cos(w) * u * 1.15, y + Math.sin(w * 1.3) * u * 0.9, Math.max(1.2, cell * 0.05), 0, TAU)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

/** Bienenschwarm: viele kleine Punkte, die wild um die Mitte schwirren */
export function drawBienen(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, now: number, a: number) {
  ctx.globalAlpha = a
  for (let i = 0; i < 12; i++) {
    const w = now / (110 + (i % 4) * 35) + i * 1.7
    const r = cell * (0.15 + 0.3 * h2(i, 3))
    const bx = x + Math.cos(w) * r
    const by = y + Math.sin(w * 1.4) * r - cell * 0.2
    ctx.fillStyle = '#2A1E0A'
    ctx.beginPath()
    ctx.ellipse(bx, by, cell * 0.06, cell * 0.045, w, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#F2C230'
    ctx.beginPath()
    ctx.arc(bx, by, cell * 0.035, 0, TAU)
    ctx.fill()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
    ctx.fillRect(bx - cell * 0.03, by - cell * 0.06, cell * 0.06, cell * 0.025)
  }
  ctx.globalAlpha = 1
}

/** Igel von oben; kugel = 0..1 (eingerollt: runde Stachelkugel, die leicht zittert) */
export function drawIgel(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, ang: number, lauf: number, s: number, a: number, kugel: number, now: number) {
  if (s <= 0 || a <= 0) return
  const u = cell * 0.42 * s
  ctx.save()
  ctx.globalAlpha *= a
  schatten(ctx, x, y + cell * 0.1, u * 1.0, u * 0.6)
  ctx.translate(x + (kugel > 0.5 ? Math.sin(now / 30) * cell * 0.02 : 0), y)
  ctx.rotate(ang)
  const schw = lauf >= 0 ? Math.sin(lauf * TAU) * u * 0.15 : 0
  const lang = 1 - 0.3 * kugel
  if (kugel < 0.5) {
    ctx.fillStyle = '#C8A888'
    ctx.beginPath()
    ctx.ellipse(u * 0.75, 0, u * 0.32, u * 0.22, 0, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#2A1A12'
    ctx.beginPath()
    ctx.arc(u * 1.05, 0, u * 0.07, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#8A6A50'
    for (const sy of [-1, 1]) ctx.fillRect(u * 0.1 + schw * sy, sy * u * 0.6 - u * 0.08, u * 0.2, u * 0.16)
  }
  // Stacheln
  ctx.fillStyle = '#4A3628'
  ctx.beginPath()
  const n = 16
  for (let i = 0; i <= n; i++) {
    const w = (i / n) * TAU
    const r = (i % 2 ? 0.75 : 1.0 + 0.15 * kugel) * u
    const px = Math.cos(w) * r * lang
    const py = Math.sin(w) * r * (0.8 + 0.2 * kugel)
    if (i) ctx.lineTo(px, py)
    else ctx.moveTo(px, py)
  }
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#6E5440'
  ctx.beginPath()
  ctx.ellipse(-u * 0.05, 0, u * 0.6 * lang, u * 0.5, 0, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = '#E8DCCB'
  ctx.lineWidth = Math.max(0.8, cell * 0.025)
  for (let i = 0; i < 7; i++) {
    const w = h2(i, 1) * TAU
    ctx.beginPath()
    ctx.moveTo(Math.cos(w) * u * 0.2, Math.sin(w) * u * 0.2)
    ctx.lineTo(Math.cos(w) * u * 0.55, Math.sin(w) * u * 0.45)
    ctx.stroke()
  }
  ctx.restore()
}

/** Maulwurf kuendigt sich an: die Erde wackelt und kruemelt (k = 0..1) */
export function drawHuegelWarnung(ctx: CanvasRenderingContext2D, p: P, cell: number, k: number, now: number) {
  const x = (p.x + 0.5) * cell
  const y = (p.y + 0.5) * cell
  const w = Math.sin(now / 45) * cell * 0.05 * k
  ctx.fillStyle = `rgba(90, 60, 35, ${0.25 + 0.4 * k})`
  ctx.beginPath()
  ctx.ellipse(x + w, y, cell * 0.3 * (0.5 + 0.5 * k), cell * 0.22 * (0.5 + 0.5 * k), 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = 'rgba(120, 85, 50, 0.9)'
  for (let i = 0; i < 4; i++) ctx.fillRect(x + (h2(p.x, p.y, i) - 0.5) * cell * 0.7 + w, y + (h2(p.y, p.x, i) - 0.5) * cell * 0.5, 2.5, 2.5)
}

/** Maulwurfshuegel: Erdhaufen, waechst schnell auf (auf = 0..1) und sinkt am Ende wieder ein (a) */
export function drawHuegel(ctx: CanvasRenderingContext2D, p: P, cell: number, auf: number, a: number) {
  const x = (p.x + 0.5) * cell
  const y = (p.y + 0.5) * cell
  const s = auf * a
  if (s <= 0) return
  schatten(ctx, x, y + cell * 0.2, cell * 0.48 * s, cell * 0.2 * s)
  ctx.fillStyle = '#6E4A2A'
  ctx.beginPath()
  ctx.ellipse(x, y + cell * 0.08, cell * 0.46 * s, cell * 0.36 * s, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#8C6238'
  ctx.beginPath()
  ctx.ellipse(x - cell * 0.06, y - cell * 0.02, cell * 0.3 * s, cell * 0.24 * s, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#A87C4C'
  for (let i = 0; i < 5; i++) ctx.fillRect(x + (h2(p.x, i) - 0.5) * cell * 0.6 * s, y + (h2(i, p.y) - 0.6) * cell * 0.4 * s, 2.5, 2.5)
}

/* ================= Wueste ================= */

/** Staubwolke am Rand, wo die Karawane gleich hereinkommt (k = 0..1) */
export function drawKarawaneWarnung(ctx: CanvasRenderingContext2D, p: P, cell: number, k: number, now: number) {
  const x = (p.x + 0.5) * cell
  const y = (p.y + 0.5) * cell
  for (let i = 0; i < 6; i++) {
    const t = ((now / 900 + i / 6) % 1 + 1) % 1
    ctx.fillStyle = `rgba(225, 190, 130, ${(0.25 + 0.4 * k) * (1 - t)})`
    ctx.beginPath()
    ctx.arc(x + (h2(i, 2) - 0.5) * cell * 1.6, y + (h2(3, i) - 0.5) * cell * 1.6 - t * cell * 0.5, cell * (0.2 + 0.4 * t), 0, TAU)
    ctx.fill()
  }
}

/** Kamel von oben (ang = Laufrichtung); erstes = mit Treiber */
export function drawKamel(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, ang: number, lauf: number, erste: boolean) {
  const u = cell * 0.55
  ctx.save()
  schatten(ctx, x + cell * 0.08, y + cell * 0.14, u * 1.0, u * 0.5)
  ctx.translate(x, y)
  ctx.rotate(ang)
  const schw = Math.sin(lauf * TAU) * u * 0.18
  ctx.fillStyle = '#9A6E3E'
  for (const [px, py, k] of [[0.45, -0.38, 1], [0.45, 0.38, -1], [-0.5, -0.36, -1], [-0.5, 0.36, 1]] as const) ctx.fillRect(px * u + schw * k - u * 0.08, py * u - u * 0.07, u * 0.16, u * 0.14)
  ctx.fillStyle = '#C4945A'
  ctx.beginPath()
  ctx.ellipse(0, 0, u * 0.78, u * 0.4, 0, 0, TAU)
  ctx.fill()
  // Hoecker
  ctx.fillStyle = '#D8AA6C'
  ctx.beginPath()
  ctx.ellipse(-u * 0.22, 0, u * 0.24, u * 0.24, 0, 0, TAU)
  ctx.ellipse(u * 0.2, 0, u * 0.22, u * 0.22, 0, 0, TAU)
  ctx.fill()
  // Hals und Kopf
  ctx.fillStyle = '#C4945A'
  ctx.fillRect(u * 0.6, -u * 0.1, u * 0.45, u * 0.2)
  ctx.beginPath()
  ctx.ellipse(u * 1.12, 0, u * 0.22, u * 0.14, 0, 0, TAU)
  ctx.fill()
  // Decke mit Muster, beim ersten der Treiber mit Turban
  ctx.fillStyle = erste ? '#2E6FA8' : '#B8322A'
  ctx.fillRect(-u * 0.05, -u * 0.32, u * 0.1, u * 0.64)
  if (erste) {
    ctx.fillStyle = '#F0EBDF'
    ctx.beginPath()
    ctx.arc(-u * 0.2, 0, u * 0.17, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}

/** Geier kreist ueber dem Feld (k = 0..1 bis zum Stoss): Schatten am Boden wird groesser, der Vogel zieht enger */
export function drawGeierKreis(ctx: CanvasRenderingContext2D, p: P, cell: number, k: number, now: number) {
  const x = (p.x + 0.5) * cell
  const y = (p.y + 0.5) * cell
  ctx.fillStyle = `rgba(40, 20, 5, ${0.15 + 0.35 * k})`
  ctx.beginPath()
  ctx.ellipse(x, y, cell * (0.2 + 0.25 * k), cell * (0.12 + 0.15 * k), 0, 0, TAU)
  ctx.fill()
  const r = cell * (2.2 - 1.8 * k)
  const w = now / 420
  const gx = x + Math.cos(w) * r
  const gy = y + Math.sin(w) * r * 0.6 - cell * (1.6 - 1.4 * k)
  drawGeier(ctx, gx, gy, cell, w + Math.PI / 2, now, 0.8 + 0.4 * k)
}

/** Geier im Flug (oder sitzend, wenn fluegel = false): breite Schwingen, kahler Kopf */
export function drawGeier(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, ang: number, now: number, s = 1, a = 1) {
  const u = cell * 0.5 * s
  ctx.save()
  ctx.globalAlpha *= a
  ctx.translate(x, y)
  ctx.rotate(ang)
  const schlag = Math.sin(now / 180) * 0.15
  ctx.fillStyle = '#3A2A20'
  for (const sy of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(u * 0.2, 0)
    ctx.lineTo(-u * 0.1, sy * u * (1.3 + schlag))
    ctx.lineTo(-u * 0.45, sy * u * (1.1 + schlag))
    ctx.lineTo(-u * 0.3, 0)
    ctx.closePath()
    ctx.fill()
  }
  ctx.fillStyle = '#4A382C'
  ctx.beginPath()
  ctx.ellipse(0, 0, u * 0.55, u * 0.26, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#F0E6D8'
  ctx.beginPath()
  ctx.arc(u * 0.38, 0, u * 0.2, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#D89A9A'
  ctx.beginPath()
  ctx.arc(u * 0.62, 0, u * 0.14, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#E8C060'
  ctx.beginPath()
  ctx.moveTo(u * 0.72, -u * 0.06)
  ctx.lineTo(u * 0.92, 0)
  ctx.lineTo(u * 0.72, u * 0.06)
  ctx.fill()
  ctx.restore()
}

/** Klapperschlange von oben: Zickzack-Muster, die Rassel am Schwanz zittert beim Warnen */
export function drawKlapperschlange(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, ang: number, lauf: number, s: number, a: number, rassel: boolean, now: number) {
  if (s <= 0 || a <= 0) return
  const u = cell * 0.5 * s
  ctx.save()
  ctx.globalAlpha *= a
  ctx.translate(x, y)
  ctx.rotate(ang)
  const welle = lauf >= 0 ? lauf * TAU : now / 400
  const pts: [number, number][] = []
  for (let i = 0; i <= 10; i++) {
    const t = i / 10
    pts.push([u * (0.9 - t * 1.9), Math.sin(welle + t * 6) * u * 0.3 * (rassel ? 0.5 : 1)])
  }
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)'
  ctx.lineWidth = u * 0.42
  ctx.beginPath()
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px + 2, py + 3) : ctx.moveTo(px + 2, py + 3)))
  ctx.stroke()
  ctx.strokeStyle = '#B08A52'
  ctx.lineWidth = u * 0.36
  ctx.beginPath()
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)))
  ctx.stroke()
  // Rautenmuster
  ctx.fillStyle = '#5E4426'
  for (let i = 1; i < 9; i += 2) {
    const [px, py] = pts[i]
    ctx.beginPath()
    ctx.moveTo(px - u * 0.1, py)
    ctx.lineTo(px, py - u * 0.12)
    ctx.lineTo(px + u * 0.1, py)
    ctx.lineTo(px, py + u * 0.12)
    ctx.fill()
  }
  // Kopf
  ctx.fillStyle = '#9A7444'
  ctx.beginPath()
  ctx.ellipse(u * 1.0, pts[0][1], u * 0.24, u * 0.18, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#1A1208'
  for (const sy of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(u * 1.08, pts[0][1] + sy * u * 0.09, u * 0.04, 0, TAU)
    ctx.fill()
  }
  // Rassel
  const [rx, ry] = pts[10]
  const zit = rassel ? Math.sin(now / 18) * u * 0.12 : 0
  ctx.fillStyle = '#D8C49A'
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.ellipse(rx - i * u * 0.12, ry + zit, u * 0.08, u * 0.1, 0, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
  if (rassel) {
    // Warnzeichen ueber ihr
    ctx.strokeStyle = `rgba(255, 220, 120, ${0.5 + 0.5 * Math.sin(now / 60)})`
    ctx.lineWidth = Math.max(1, cell * 0.04)
    for (let i = 1; i <= 2; i++) {
      ctx.beginPath()
      ctx.arc(x, y, cell * (0.35 + i * 0.15), -2.4, -0.7)
      ctx.stroke()
    }
  }
}

/** Riesenskorpion von oben: Scheren vorn, der Schwanz biegt sich ueber den Ruecken; stich 0..1 = Schwanz erhoben (Warnung) */
export function drawRiesenskorpion(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, ang: number, lauf: number, s: number, a: number, stich: number, now: number) {
  if (s <= 0 || a <= 0) return
  const u = cell * 0.55 * s
  ctx.save()
  ctx.globalAlpha *= a
  schatten(ctx, x, y + cell * 0.1, u * 1.0, u * 0.55)
  ctx.translate(x, y)
  ctx.rotate(ang)
  const schw = lauf >= 0 ? Math.sin(lauf * TAU) * u * 0.12 : 0
  // Beine
  ctx.strokeStyle = '#5A3A1E'
  ctx.lineWidth = Math.max(1, cell * 0.04)
  ctx.lineCap = 'round'
  for (let i = 0; i < 4; i++)
    for (const sy of [-1, 1]) {
      const bx = u * (0.25 - i * 0.18)
      ctx.beginPath()
      ctx.moveTo(bx, sy * u * 0.18)
      ctx.lineTo(bx + (i % 2 ? schw : -schw) * sy, sy * u * 0.55)
      ctx.stroke()
    }
  // Scheren
  ctx.fillStyle = '#8A5A2C'
  for (const sy of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(u * 0.35, sy * u * 0.15)
    ctx.lineTo(u * 0.75, sy * u * 0.4)
    ctx.lineTo(u * 0.95, sy * u * 0.28)
    ctx.lineTo(u * 0.8, sy * u * 0.18)
    ctx.closePath()
    ctx.fill()
  }
  ctx.fillStyle = '#7A4C24'
  ctx.beginPath()
  ctx.ellipse(0, 0, u * 0.45, u * 0.24, 0, 0, TAU)
  ctx.fill()
  // Schwanz: Glieder nach hinten, erhoben kruemmt er sich nach vorn ueber den Koerper
  const gl = 5
  for (let i = 0; i < gl; i++) {
    const t = (i + 1) / gl
    const zurueck = -u * (0.45 + t * 0.55)
    const vor = stich * u * 0.9 * t * t
    ctx.fillStyle = i === gl - 1 ? '#C43A2A' : '#8A5A2C'
    ctx.beginPath()
    ctx.arc(zurueck + vor * 1.6, 0, u * (0.13 - t * 0.03) * (1 + stich * 0.2), 0, TAU)
    ctx.fill()
  }
  ctx.restore()
  if (stich > 0) {
    ctx.strokeStyle = `rgba(255, 90, 60, ${0.5 + 0.5 * Math.sin(now / 50)})`
    ctx.lineWidth = Math.max(1.2, cell * 0.05)
    ctx.beginPath()
    ctx.arc(x, y, cell * (0.6 + 0.15 * stich), 0, TAU)
    ctx.stroke()
  }
}

/** Sandkrabbe von oben: rund, Scheren zur Seite, laeuft seitwaerts (zappelt dabei) */
export function drawSandkrabbe(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, lauf: number, s: number, a: number) {
  if (s <= 0 || a <= 0) return
  const u = cell * 0.42 * s
  ctx.save()
  ctx.globalAlpha *= a
  schatten(ctx, x, y + cell * 0.08, u * 1.0, u * 0.55)
  ctx.translate(x, y)
  const zap = lauf >= 0 ? Math.sin(lauf * TAU * 2) * u * 0.1 : 0
  ctx.strokeStyle = '#B8442A'
  ctx.lineWidth = Math.max(1, cell * 0.04)
  ctx.lineCap = 'round'
  for (const sx of [-1, 1])
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.moveTo(sx * u * 0.4, (i - 1) * u * 0.2)
      ctx.lineTo(sx * u * 0.85, (i - 1) * u * 0.35 + zap * (i % 2 ? 1 : -1))
      ctx.stroke()
    }
  ctx.fillStyle = '#D85A34'
  for (const sx of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(sx * u * 0.55, -u * 0.55, u * 0.22, u * 0.16, sx * 0.6, 0, TAU)
    ctx.fill()
  }
  ctx.fillStyle = '#E2683C'
  ctx.beginPath()
  ctx.ellipse(0, 0, u * 0.55, u * 0.42, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#FFFFFF'
  for (const sx of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(sx * u * 0.18, -u * 0.42, u * 0.1, 0, TAU)
    ctx.fill()
  }
  ctx.fillStyle = '#1A1208'
  for (const sx of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(sx * u * 0.18, -u * 0.44, u * 0.05, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}

/** Erdmaennchen-Loch: unten nur das Loch, beim Gucken schaut der Kopf heraus, oben steht es aufrecht (Hindernis) */
export function drawErdmannLoch(ctx: CanvasRenderingContext2D, p: P, cell: number, zustand: 'unten' | 'gucken' | 'oben', a: number) {
  const x = (p.x + 0.5) * cell
  const y = (p.y + 0.5) * cell
  ctx.globalAlpha = a
  ctx.fillStyle = '#C89E62'
  ctx.beginPath()
  ctx.ellipse(x, y + cell * 0.12, cell * 0.36, cell * 0.2, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#3A2614'
  ctx.beginPath()
  ctx.ellipse(x, y + cell * 0.12, cell * 0.24, cell * 0.12, 0, 0, TAU)
  ctx.fill()
  if (zustand !== 'unten') {
    const hoch = zustand === 'oben' ? 1 : 0.35
    const u = cell * 0.5
    // Koerper (nur wenn es steht), Kopf mit dunklen Augenringen
    if (hoch >= 1) {
      ctx.fillStyle = '#C8A070'
      ctx.beginPath()
      ctx.ellipse(x, y - u * 0.15, u * 0.26, u * 0.5, 0, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#E8CDA0'
      ctx.beginPath()
      ctx.ellipse(x, y - u * 0.05, u * 0.14, u * 0.32, 0, 0, TAU)
      ctx.fill()
    }
    const ky = y + cell * 0.08 - u * 1.0 * hoch
    ctx.fillStyle = '#C8A070'
    ctx.beginPath()
    ctx.ellipse(x, ky, u * 0.22, u * 0.2, 0, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#3A2614'
    for (const sx of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(x + sx * u * 0.09, ky - u * 0.02, u * 0.06, 0, TAU)
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1
}

/** Sarkophag: goldener Deckel mit Gesicht; offen = Deckel liegt schief daneben, dunkles Inneres */
export function drawSarkophag(ctx: CanvasRenderingContext2D, p: P, cell: number, offen: number, a: number, now: number) {
  const x = (p.x + 0.5) * cell
  const y = (p.y + 0.5) * cell
  const w = cell * 0.36
  const hh = cell * 0.46
  ctx.globalAlpha = a
  schatten(ctx, x + cell * 0.06, y + cell * 0.1, w * 1.1, hh * 0.9)
  ctx.fillStyle = '#6A4A1E'
  ctx.fillRect(x - w, y - hh, w * 2, hh * 2)
  if (offen > 0) {
    ctx.fillStyle = '#140C06'
    ctx.fillRect(x - w * 0.75, y - hh * 0.8, w * 1.5, hh * 1.6)
  }
  // Deckel (rutscht beim Oeffnen zur Seite)
  ctx.save()
  ctx.translate(x + offen * w * 1.1, y + offen * hh * 0.2)
  ctx.rotate(offen * 0.5)
  ctx.globalAlpha = a * (1 - offen * 0.2)
  ctx.fillStyle = '#D8A838'
  ctx.fillRect(-w * 0.85, -hh * 0.92, w * 1.7, hh * 1.84)
  ctx.fillStyle = '#2E6FA8'
  for (let i = 0; i < 4; i++) ctx.fillRect(-w * 0.85, -hh * 0.3 + i * hh * 0.3, w * 1.7, hh * 0.1)
  ctx.fillStyle = '#F0D070'
  ctx.beginPath()
  ctx.ellipse(0, -hh * 0.55, w * 0.42, hh * 0.3, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#1A1208'
  for (const sx of [-1, 1]) ctx.fillRect(sx * w * 0.18 - w * 0.06, -hh * 0.6, w * 0.12, hh * 0.06)
  ctx.restore()
  if (offen <= 0) {
    // Kurz vor dem Oeffnen ruckelt er
    ctx.fillStyle = `rgba(230, 200, 140, ${0.3 + 0.3 * Math.sin(now / 70)})`
    ctx.fillRect(x - w, y + hh * 0.9, w * 2, hh * 0.12)
  }
  ctx.globalAlpha = 1
}

/** Mumie von oben: Binden quer, Arme nach vorn gestreckt, gruene Augen */
export function drawMumie(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, ang: number, lauf: number, s: number, a: number) {
  if (s <= 0 || a <= 0) return
  const u = cell * 0.55 * s
  ctx.save()
  ctx.globalAlpha *= a
  schatten(ctx, x, y + cell * 0.12, u * 0.8, u * 0.5)
  ctx.translate(x, y)
  ctx.rotate(ang)
  const schw = lauf >= 0 ? Math.sin(lauf * TAU) * u * 0.08 : 0
  ctx.fillStyle = '#E8DEC4'
  for (const sy of [-1, 1]) ctx.fillRect(u * 0.1 + schw * sy, sy * u * 0.36 - u * 0.08, u * 0.65, u * 0.16)
  ctx.beginPath()
  ctx.ellipse(-u * 0.1, 0, u * 0.42, u * 0.5, 0, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = '#B8AC8E'
  ctx.lineWidth = Math.max(1, cell * 0.035)
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath()
    ctx.moveTo(-u * 0.45, i * u * 0.18)
    ctx.lineTo(u * 0.25, i * u * 0.18 + u * 0.08)
    ctx.stroke()
  }
  ctx.fillStyle = '#F0E8D2'
  ctx.beginPath()
  ctx.arc(u * 0.32, 0, u * 0.24, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#7CE060'
  for (const sy of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(u * 0.42, sy * u * 0.09, u * 0.05, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}

/** Fata Morgana: flimmernde, halb durchsichtige Oase; in der Mitte eine Kaktusfeige, die zittert (zeichnen: frucht) */
export function drawFataMorgana(ctx: CanvasRenderingContext2D, cells: P[], cell: number, now: number, a: number) {
  for (const c of cells) {
    const x = (c.x + 0.5) * cell
    const y = (c.y + 0.5) * cell
    const fl = 0.5 + 0.5 * Math.sin(now / 180 + c.x * 1.7 + c.y)
    ctx.fillStyle = `rgba(90, 190, 220, ${(0.16 + 0.12 * fl) * a})`
    ctx.beginPath()
    ctx.ellipse(x + Math.sin(now / 240 + c.y) * cell * 0.06, y, cell * 0.55, cell * 0.42, 0, 0, TAU)
    ctx.fill()
  }
  // Hitzeflimmern: waagrechte Schlieren
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.25 * a})`
  ctx.lineWidth = 1.5
  const c0 = cells[Math.floor(cells.length / 2)] ?? cells[0]
  if (!c0) return
  for (let i = 0; i < 4; i++) {
    const yy = (c0.y - 0.6 + i * 0.45) * cell
    const xx = (c0.x + 0.5) * cell + Math.sin(now / 200 + i) * cell * 0.3
    ctx.beginPath()
    ctx.moveTo(xx - cell * 0.8, yy)
    ctx.lineTo(xx + cell * 0.8, yy)
    ctx.stroke()
  }
}
