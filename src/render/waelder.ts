/**
 * Zauberwald und Gruselwald: Spiegelfluch, Ranken, wandernde Baeume, Sporen, Irrlicht, Einhorn mit Regenbogen, Fee, Ent,
 * Pilzringe, Zombiehaende, Skelett, Werwolf und Vollmond, Kraehenschwarm, Gespenst, Riesenspinne, Kraehe.
 * Spiellogik in game.ts (zauberNachApfel, gruselNachApfel, zauberTakt, wesenFliegt).
 */
import type { P } from '../game/types'

const TAU = Math.PI * 2
const h2 = (x: number, y: number, s = 0) => {
  const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453
  return v - Math.floor(v)
}
const schatten = (ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) => {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)'
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU)
  ctx.fill()
}

/* ================= Zauberwald ================= */

/** Spiegelfluch (Bildschirm): erst lila Schimmer (k = 0..1), dann ein pulsierender lila Rahmen und gespiegelte Pfeile */
export function drawSpiegelfluch(ctx: CanvasRenderingContext2D, vw: number, vh: number, now: number, k: number, an: boolean) {
  const p = 0.5 + 0.5 * Math.sin(now / (an ? 160 : 90))
  const a = an ? 0.35 + 0.2 * p : 0.25 * k * p
  ctx.strokeStyle = `rgba(190, 110, 255, ${a})`
  ctx.lineWidth = an ? 14 : 8
  ctx.strokeRect(0, 0, vw, vh)
  if (!an) return
  ctx.save()
  ctx.translate(vw / 2, 70)
  ctx.globalAlpha = 0.6 + 0.3 * p
  ctx.strokeStyle = '#E8C8FF'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-26, 0)
  ctx.lineTo(26, 0)
  ctx.moveTo(-26, 0)
  ctx.lineTo(-16, -8)
  ctx.moveTo(-26, 0)
  ctx.lineTo(-16, 8)
  ctx.moveTo(26, 0)
  ctx.lineTo(16, -8)
  ctx.moveTo(26, 0)
  ctx.lineTo(16, 8)
  ctx.stroke()
  ctx.restore()
}

/** Ranke auf einem Feld: gewundener Stiel, Blaetter, Dornen; s = Wachsen (0..1), spitze = vorderstes Feld */
export function drawRanke(ctx: CanvasRenderingContext2D, p: P, von: P, cell: number, s: number, now: number) {
  const x = (p.x + 0.5) * cell
  const y = (p.y + 0.5) * cell
  const fx = (von.x + 0.5) * cell
  const fy = (von.y + 0.5) * cell
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#2E6B3A'
  ctx.lineWidth = Math.max(2, cell * 0.16)
  ctx.beginPath()
  ctx.moveTo(fx, fy)
  const wx = (x - fx) * s
  const wy = (y - fy) * s
  ctx.quadraticCurveTo(fx + wx * 0.5 + wy * 0.3, fy + wy * 0.5 - wx * 0.3, fx + wx, fy + wy)
  ctx.stroke()
  ctx.fillStyle = '#3F8A4A'
  for (let i = 0; i < 3; i++) {
    const a = h2(p.x, p.y, i) * TAU + Math.sin(now / 900 + i) * 0.2
    ctx.beginPath()
    ctx.ellipse(x + Math.cos(a) * cell * 0.25 * s, y + Math.sin(a) * cell * 0.25 * s, cell * 0.16 * s, cell * 0.08 * s, a, 0, TAU)
    ctx.fill()
  }
  ctx.fillStyle = '#C8F0A0'
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + h2(p.y, p.x)
    ctx.fillRect(x + Math.cos(a) * cell * 0.3 * s, y + Math.sin(a) * cell * 0.3 * s, 2, 2)
  }
}

/** Kleiner wandernder Baum: runde Krone mit Gesicht, Wurzelbeine (k = 0..1 der letzte Schritt) */
export function drawWanderbaum(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, now: number, k: number) {
  const hops = Math.sin(Math.min(1, k) * Math.PI) * cell * 0.15
  schatten(ctx, x, y + cell * 0.28, cell * 0.36, cell * 0.14)
  ctx.strokeStyle = '#5A3A22'
  ctx.lineWidth = Math.max(1.5, cell * 0.07)
  ctx.beginPath()
  for (const sx of [-1, 1]) {
    ctx.moveTo(x + sx * cell * 0.08, y + cell * 0.05 - hops)
    ctx.lineTo(x + sx * cell * 0.22, y + cell * 0.3)
  }
  ctx.stroke()
  ctx.fillStyle = '#4FA07A'
  ctx.beginPath()
  ctx.arc(x, y - cell * 0.12 - hops, cell * 0.36, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#7FD0A8'
  ctx.beginPath()
  ctx.arc(x - cell * 0.1, y - cell * 0.22 - hops, cell * 0.14, 0, TAU)
  ctx.fill()
  const zw = now % 3800 < 140 ? 0.2 : 1
  ctx.fillStyle = '#1E2A22'
  for (const sx of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(x + sx * cell * 0.11, y - cell * 0.1 - hops, cell * 0.04, cell * 0.05 * zw, 0, 0, TAU)
    ctx.fill()
  }
}

/** Sporenwolke: leuchtende Sporen schweben ueber den Feldern (a = Deckkraft) */
export function drawSporen(ctx: CanvasRenderingContext2D, cells: P[], cell: number, now: number, a: number) {
  for (const c of cells) {
    for (let i = 0; i < 3; i++) {
      const z = (now / (1800 + i * 300) + h2(c.x, c.y, i)) % 1
      const x = (c.x + 0.2 + h2(c.x, c.y, i + 3) * 0.6) * cell + Math.sin(now / 500 + i + c.x) * cell * 0.1
      const y = (c.y + 0.9 - z * 0.8) * cell
      ctx.fillStyle = `rgba(200, 255, 140, ${a * (1 - z) * 0.9})`
      ctx.beginPath()
      ctx.arc(x, y, cell * 0.06, 0, TAU)
      ctx.fill()
    }
    ctx.fillStyle = `rgba(160, 230, 120, ${a * 0.12})`
    ctx.fillRect(c.x * cell, c.y * cell, cell, cell)
  }
}

/** Regenbogen-Spur (Einhorn): bunte Punkte, verblassen (alter = ms) */
export function drawRegenbogen(ctx: CanvasRenderingContext2D, p: P, cell: number, alter: number, now: number) {
  const a = Math.max(0, 1 - alter / 5000)
  const farben = ['#FF6B6B', '#FFB347', '#FFE66D', '#7BE495', '#6EC6FF', '#B48CFF']
  for (let i = 0; i < farben.length; i++) {
    ctx.fillStyle = farben[i]
    ctx.globalAlpha = a * 0.85
    ctx.beginPath()
    ctx.arc((p.x + 0.5) * cell + Math.cos(i + now / 400) * cell * 0.18, (p.y + 0.5) * cell + Math.sin(i * 1.3 + now / 400) * cell * 0.18, cell * 0.07, 0, TAU)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

/** Einhorn von oben: weiss, bunte Maehne, goldenes Horn */
export function drawEinhorn(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, ang: number, lauf: number, s: number, a = 1, now = 0) {
  if (s <= 0 || a <= 0) return
  const u = cell * 0.55 * s
  ctx.save()
  ctx.globalAlpha *= a
  schatten(ctx, x, y + cell * 0.12, u * 1.0, u * 0.5)
  ctx.translate(x, y)
  ctx.rotate(ang)
  const schw = lauf >= 0 ? Math.sin(lauf * TAU) * u * 0.2 : 0
  ctx.fillStyle = '#F1F1FA'
  for (const [px, py, k] of [[0.45, -0.38, 1], [0.45, 0.38, -1], [-0.5, -0.38, -1], [-0.5, 0.38, 1]] as const) {
    ctx.beginPath()
    ctx.ellipse(px * u + schw * k, py * u, u * 0.16, u * 0.11, 0, 0, TAU)
    ctx.fill()
  }
  ctx.fillStyle = '#FFFFFF'
  ctx.beginPath()
  ctx.ellipse(-u * 0.05, 0, u * 0.7, u * 0.38, 0, 0, TAU)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(u * 0.72, 0, u * 0.3, u * 0.22, 0, 0, TAU)
  ctx.fill()
  const farben = ['#FF6B6B', '#FFB347', '#FFE66D', '#7BE495', '#6EC6FF', '#B48CFF']
  farben.forEach((f, i) => {
    ctx.fillStyle = f
    ctx.beginPath()
    ctx.ellipse(u * (0.45 - i * 0.18), Math.sin(now / 200 + i) * u * 0.05, u * 0.1, u * 0.07, 0, 0, TAU)
    ctx.fill()
  })
  ctx.fillStyle = '#F2C14E'
  ctx.beginPath()
  ctx.moveTo(u * 0.9, -u * 0.06)
  ctx.lineTo(u * 1.35, 0)
  ctx.lineTo(u * 0.9, u * 0.06)
  ctx.fill()
  ctx.restore()
}

/** Fee: kleiner leuchtender Koerper, flatternde Fluegel, Glitzer */
export function drawFee(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, s: number, a = 1, now = 0) {
  if (s <= 0 || a <= 0) return
  const u = cell * 0.4 * s
  const yy = y - cell * 0.25 + Math.sin(now / 250) * cell * 0.08
  ctx.save()
  ctx.globalAlpha *= a
  ctx.fillStyle = 'rgba(255, 230, 140, 0.25)'
  ctx.beginPath()
  ctx.arc(x, yy, u * 1.3, 0, TAU)
  ctx.fill()
  const f = Math.abs(Math.sin(now / 45))
  ctx.fillStyle = 'rgba(210, 240, 255, 0.75)'
  for (const sx of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(x + sx * u * 0.5, yy - u * 0.15, u * 0.55 * (0.4 + 0.6 * f), u * 0.3, sx * 0.5, 0, TAU)
    ctx.fill()
  }
  ctx.fillStyle = '#FFF3C0'
  ctx.beginPath()
  ctx.arc(x, yy, u * 0.28, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#FFFFFF'
  for (let i = 0; i < 3; i++) ctx.fillRect(x + Math.cos(now / 300 + i * 2) * u, yy + u * 0.6 + i * 2, 1.5, 1.5)
  ctx.restore()
}

/** Ent: Baumwesen von oben (Rindenkoerper, Aeste als Arme, Moos) */
export function drawEnt(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, ang: number, lauf: number, s: number, a = 1) {
  if (s <= 0 || a <= 0) return
  const u = cell * 0.6 * s
  ctx.save()
  ctx.globalAlpha *= a
  schatten(ctx, x, y + cell * 0.14, u * 0.95, u * 0.7)
  ctx.translate(x, y)
  ctx.rotate(ang)
  const schw = lauf >= 0 ? Math.sin(lauf * TAU) * 0.3 : 0
  ctx.strokeStyle = '#5A3A22'
  ctx.lineWidth = Math.max(2, cell * 0.09)
  ctx.lineCap = 'round'
  for (const sy of [-1, 1]) {
    ctx.save()
    ctx.rotate(sy * (0.9 + schw))
    ctx.beginPath()
    ctx.moveTo(u * 0.2, 0)
    ctx.lineTo(u * 0.95, 0)
    ctx.moveTo(u * 0.7, 0)
    ctx.lineTo(u * 0.9, u * 0.2 * sy)
    ctx.stroke()
    ctx.restore()
  }
  ctx.fillStyle = '#6B4A2C'
  ctx.beginPath()
  ctx.ellipse(0, 0, u * 0.55, u * 0.48, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#4FA07A'
  ctx.beginPath()
  ctx.arc(-u * 0.1, -u * 0.05, u * 0.38, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#9BF0C0'
  for (const sy of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(u * 0.38, sy * u * 0.14, u * 0.06, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}

/** Pilzring: Kreis aus kleinen Leuchtpilzen, die Mitte schimmert */
export function drawPilzring(ctx: CanvasRenderingContext2D, p: P, cell: number, now: number, a = 1) {
  const x = (p.x + 0.5) * cell
  const y = (p.y + 0.5) * cell
  const pu = 0.5 + 0.5 * Math.sin(now / 300 + p.x)
  ctx.save()
  ctx.globalAlpha *= a
  ctx.fillStyle = `rgba(190, 120, 255, ${0.18 + 0.2 * pu})`
  ctx.beginPath()
  ctx.arc(x, y, cell * 0.42, 0, TAU)
  ctx.fill()
  for (let i = 0; i < 8; i++) {
    const w = (i / 8) * TAU
    const mx = x + Math.cos(w) * cell * 0.4
    const my = y + Math.sin(w) * cell * 0.4
    ctx.fillStyle = '#E8DCC8'
    ctx.fillRect(mx - cell * 0.02, my, cell * 0.04, cell * 0.07)
    ctx.fillStyle = i % 2 ? '#B48CFF' : '#6EC6FF'
    ctx.beginPath()
    ctx.arc(mx, my, cell * 0.08, Math.PI, 0)
    ctx.fill()
  }
  ctx.restore()
}

/** Irrlicht-Apfel: halb durchsichtig, schwebt und flackert (das Futter zeichnet der Aufrufer, hier der Schein) */
export function drawIrrlichtSchein(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, now: number) {
  const p = 0.5 + 0.5 * Math.sin(now / 120)
  ctx.fillStyle = `rgba(150, 255, 210, ${0.15 + 0.15 * p})`
  ctx.beginPath()
  ctx.arc(x, y, cell * (0.55 + 0.1 * p), 0, TAU)
  ctx.fill()
}

/* ================= Gruselwald ================= */

/** Zombiehand: erst wackelt der Boden (k = 0..1), dann greift eine Hand heraus (an) */
export function drawZombiehand(ctx: CanvasRenderingContext2D, p: P, cell: number, k: number, an: boolean, now: number) {
  const x = (p.x + 0.5) * cell
  const y = (p.y + 0.5) * cell
  const w = Math.sin(now / 40) * cell * 0.04 * k
  ctx.fillStyle = `rgba(30, 20, 15, ${0.3 + 0.4 * k})`
  ctx.beginPath()
  ctx.ellipse(x + w, y + cell * 0.1, cell * 0.36, cell * 0.22, 0, 0, TAU)
  ctx.fill()
  if (!an) {
    ctx.fillStyle = 'rgba(90, 70, 50, 0.8)'
    for (let i = 0; i < 4; i++) ctx.fillRect(x + (h2(p.x, p.y, i) - 0.5) * cell * 0.6 + w, y + (h2(p.y, p.x, i) - 0.3) * cell * 0.3, 2.5, 2.5)
    return
  }
  ctx.fillStyle = '#8FA67A'
  ctx.strokeStyle = '#4A5A3A'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.ellipse(x, y - cell * 0.05, cell * 0.16, cell * 0.2, 0, 0, TAU)
  ctx.fill()
  ctx.stroke()
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI * 0.95 + (i / 4) * Math.PI * 0.9
    const greif = Math.sin(now / 120) * 0.2
    ctx.lineWidth = Math.max(1.5, cell * 0.06)
    ctx.strokeStyle = '#8FA67A'
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x + Math.cos(a) * cell * 0.12, y - cell * 0.05 + Math.sin(a) * cell * 0.14)
    ctx.lineTo(x + Math.cos(a + greif) * cell * 0.32, y - cell * 0.05 + Math.sin(a + greif) * cell * 0.34)
    ctx.stroke()
  }
}

/** Skelett von oben: Schaedel, Rippen, Knochenarme */
export function drawSkelett(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, ang: number, lauf: number, s: number, a = 1) {
  if (s <= 0 || a <= 0) return
  const u = cell * 0.5 * s
  ctx.save()
  ctx.globalAlpha *= a
  schatten(ctx, x, y + cell * 0.12, u * 0.8, u * 0.5)
  ctx.translate(x, y)
  ctx.rotate(ang)
  const schw = lauf >= 0 ? Math.sin(lauf * TAU) * 0.4 : 0
  ctx.strokeStyle = '#EDE6D6'
  ctx.lineCap = 'round'
  ctx.lineWidth = Math.max(1.5, cell * 0.06)
  ctx.beginPath()
  for (const sy of [-1, 1]) {
    ctx.moveTo(u * 0.1, sy * u * 0.3)
    ctx.lineTo(u * (0.6 + schw * sy * 0.3), sy * u * 0.6)
  }
  for (let i = 0; i < 3; i++) {
    ctx.moveTo(-u * (0.1 + i * 0.18), -u * 0.3)
    ctx.lineTo(-u * (0.1 + i * 0.18), u * 0.3)
  }
  ctx.moveTo(u * 0.2, 0)
  ctx.lineTo(-u * 0.6, 0)
  ctx.stroke()
  ctx.fillStyle = '#F4EEDF'
  ctx.beginPath()
  ctx.arc(u * 0.45, 0, u * 0.3, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#1A1418'
  for (const sy of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(u * 0.52, sy * u * 0.12, u * 0.08, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}

/** Werwolf von oben: grau-braunes Fell, spitze Ohren, gelbe Augen */
export function drawWerwolf(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, ang: number, lauf: number, s: number, a = 1) {
  if (s <= 0 || a <= 0) return
  const u = cell * 0.6 * s
  ctx.save()
  ctx.globalAlpha *= a
  schatten(ctx, x, y + cell * 0.12, u * 1.0, u * 0.55)
  ctx.translate(x, y)
  ctx.rotate(ang)
  const schw = lauf >= 0 ? Math.sin(lauf * TAU) * u * 0.22 : 0
  ctx.fillStyle = '#4A4038'
  for (const [px, py, k] of [[0.4, -0.42, 1], [0.4, 0.42, -1], [-0.5, -0.4, -1], [-0.5, 0.4, 1]] as const) {
    ctx.beginPath()
    ctx.ellipse(px * u + schw * k, py * u, u * 0.18, u * 0.12, 0, 0, TAU)
    ctx.fill()
  }
  ctx.fillStyle = '#6B5E52'
  ctx.beginPath()
  ctx.ellipse(-u * 0.05, 0, u * 0.72, u * 0.42, 0, 0, TAU)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(-u * 0.7, -u * 0.12)
  ctx.lineTo(-u * 1.15, 0)
  ctx.lineTo(-u * 0.7, u * 0.12)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(u * 0.62, 0, u * 0.32, u * 0.26, 0, 0, TAU)
  ctx.fill()
  for (const sy of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(u * 0.5, sy * u * 0.15)
    ctx.lineTo(u * 0.42, sy * u * 0.42)
    ctx.lineTo(u * 0.65, sy * u * 0.22)
    ctx.fill()
  }
  ctx.fillStyle = '#FFD84A'
  for (const sy of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(u * 0.75, sy * u * 0.1, u * 0.05, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}

/** Vollmond (Bildschirm): grosser Mond oben, leiser blauer Schimmer (staerke 0..1) */
export function drawVollmond(ctx: CanvasRenderingContext2D, vw: number, vh: number, staerke: number) {
  if (staerke <= 0) return
  ctx.save()
  ctx.globalAlpha = staerke
  ctx.fillStyle = 'rgba(120, 150, 220, 0.12)'
  ctx.fillRect(0, 0, vw, vh)
  const r = Math.min(vw, vh) * 0.09
  const x = vw * 0.78
  const y = vh * 0.14
  ctx.fillStyle = 'rgba(230, 235, 255, 0.25)'
  ctx.beginPath()
  ctx.arc(x, y, r * 1.6, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#F2F0E6'
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
  ctx.fill()
  ctx.fillStyle = 'rgba(180, 175, 160, 0.6)'
  for (const [dx, dy, rr] of [[-0.3, -0.2, 0.22], [0.25, 0.15, 0.16], [-0.1, 0.35, 0.12]] as const) {
    ctx.beginPath()
    ctx.arc(x + dx * r, y + dy * r, rr * r, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}

/** Kraehen (Schwarm oder einzeln): schwarzer Vogel von oben mit schlagenden Fluegeln */
export function drawKraehe(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, ang: number, now: number, s = 1, a = 1) {
  if (s <= 0 || a <= 0) return
  const u = cell * 0.42 * s
  const f = Math.sin(now / 50 + x * 0.1)
  ctx.save()
  ctx.globalAlpha *= a
  ctx.translate(x, y)
  ctx.rotate(ang)
  ctx.fillStyle = '#141018'
  ctx.beginPath()
  ctx.moveTo(u * 0.1, 0)
  ctx.quadraticCurveTo(-u * 0.1, -u * (0.7 + 0.3 * f), -u * 0.35, -u * (0.9 + 0.3 * f))
  ctx.quadraticCurveTo(-u * 0.2, -u * 0.2, -u * 0.5, 0)
  ctx.quadraticCurveTo(-u * 0.2, u * 0.2, -u * 0.35, u * (0.9 + 0.3 * f))
  ctx.quadraticCurveTo(-u * 0.1, u * (0.7 + 0.3 * f), u * 0.1, 0)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(0, 0, u * 0.45, u * 0.18, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#E8A020'
  ctx.beginPath()
  ctx.moveTo(u * 0.45, -u * 0.05)
  ctx.lineTo(u * 0.65, 0)
  ctx.lineTo(u * 0.45, u * 0.05)
  ctx.fill()
  ctx.restore()
}

/** Kraehenschwarm in einem Band (felder = gerade bedeckt): dicht an dicht, verdeckt die Sicht */
export function drawKraehenschwarm(ctx: CanvasRenderingContext2D, felder: P[], cell: number, dir: number, achse: 'x' | 'y', now: number) {
  const ang = achse === 'x' ? (dir > 0 ? 0 : Math.PI) : dir > 0 ? Math.PI / 2 : -Math.PI / 2
  for (const c of felder) {
    ctx.fillStyle = 'rgba(15, 10, 20, 0.35)'
    ctx.fillRect(c.x * cell, c.y * cell, cell, cell)
    for (let i = 0; i < 2; i++) drawKraehe(ctx, (c.x + 0.3 + h2(c.x, c.y, i) * 0.4) * cell, (c.y + 0.3 + h2(c.y, c.x, i) * 0.4) * cell, cell, ang + (h2(c.x, i) - 0.5) * 0.6, now, 1.1)
  }
}

/** Gespenst: weisses Tuch, wehender Saum, durchscheinend */
export function drawGespenst(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, s: number, a = 1, now = 0) {
  if (s <= 0 || a <= 0) return
  const u = cell * 0.55 * s
  const yy = y - cell * 0.15 + Math.sin(now / 400) * cell * 0.06
  ctx.save()
  ctx.globalAlpha *= a * 0.82
  ctx.fillStyle = 'rgba(200, 210, 255, 0.18)'
  ctx.beginPath()
  ctx.arc(x, yy, u * 1.2, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#F4F6FF'
  ctx.beginPath()
  ctx.arc(x, yy - u * 0.15, u * 0.55, Math.PI, 0)
  ctx.lineTo(x + u * 0.55, yy + u * 0.45)
  for (let i = 0; i <= 6; i++) ctx.lineTo(x + u * 0.55 - (i / 6) * u * 1.1, yy + u * (0.45 + (i % 2 ? -0.12 : 0.05) + Math.sin(now / 150 + i) * 0.04))
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#1A1A28'
  for (const sx of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(x + sx * u * 0.2, yy - u * 0.15, u * 0.08, u * 0.12, 0, 0, TAU)
    ctx.fill()
  }
  ctx.beginPath()
  ctx.ellipse(x, yy + u * 0.1, u * 0.1, u * 0.07, 0, 0, TAU)
  ctx.fill()
  ctx.restore()
}

/** Riesenspinne von oben: schwarzer Koerper, acht Beine, rote Augen */
export function drawRiesenspinne(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, ang: number, lauf: number, s: number, a = 1) {
  if (s <= 0 || a <= 0) return
  const u = cell * 0.62 * s
  ctx.save()
  ctx.globalAlpha *= a
  schatten(ctx, x, y + cell * 0.1, u * 0.9, u * 0.7)
  ctx.translate(x, y)
  ctx.rotate(ang)
  const schw = lauf >= 0 ? Math.sin(lauf * TAU * 2) * 0.25 : 0
  ctx.strokeStyle = '#141014'
  ctx.lineWidth = Math.max(1.5, cell * 0.06)
  ctx.lineCap = 'round'
  ctx.beginPath()
  for (let i = 0; i < 4; i++)
    for (const sy of [-1, 1]) {
      const a0 = sy * (0.5 + i * 0.4 + (i % 2 ? schw : -schw))
      ctx.moveTo(0, 0)
      const kx = Math.cos(a0) * u * 0.6
      const ky = Math.sin(a0) * u * 0.6
      ctx.lineTo(kx, ky)
      ctx.lineTo(kx * 1.5 - u * 0.1, ky * 1.5)
    }
  ctx.stroke()
  ctx.fillStyle = '#1E1820'
  ctx.beginPath()
  ctx.ellipse(-u * 0.25, 0, u * 0.42, u * 0.34, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#2A2028'
  ctx.beginPath()
  ctx.arc(u * 0.25, 0, u * 0.22, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#FF3B3B'
  for (const [px, py] of [[0.38, -0.08], [0.38, 0.08], [0.33, -0.15], [0.33, 0.15]] as const) {
    ctx.beginPath()
    ctx.arc(px * u, py * u, u * 0.035, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}
