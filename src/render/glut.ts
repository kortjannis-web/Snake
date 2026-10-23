/**
 * Vulkan: Abbruchkante, Lavabomben (Ausbruch), Feuerregen, Lavastrom, Lavafisch, Lavabruecke, Obsidian-Kristall, Glutgolem
 * mit Glutspur. Nur einfache Formen und der fertige Glutschein, keine Verlaeufe je Bild.
 * Spiellogik in game.ts (vulkanNachApfel, vulkanTakt).
 */
import type { Dir, P } from '../game/types'
import { glutSchein } from './vulkan'

const TAU = Math.PI * 2
const h2 = (x: number, y: number, s = 0) => {
  const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453
  return v - Math.floor(v)
}
const schein = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a: number) => {
  if (a <= 0) return
  ctx.globalAlpha = a
  ctx.drawImage(glutSchein(), x - r, y - r, r * 2, r * 2)
  ctx.globalAlpha = 1
}

/* ================= Abbruchkante ================= */

/** Risse an der Kante (k = 0..1 bis zum Abbruch): dunkle Linien mit Glut, kurz vorher bebt es */
export function drawAbbruchWarnung(ctx: CanvasRenderingContext2D, cells: P[], cell: number, k: number, now: number) {
  const beben = k > 0.75 ? Math.sin(now / 25) * cell * 0.04 * (k - 0.75) * 4 : 0
  ctx.lineCap = 'round'
  for (const c of cells) {
    const x = c.x * cell + beben
    const y = c.y * cell
    ctx.fillStyle = `rgba(20, 8, 4, ${0.12 + 0.25 * k})`
    ctx.fillRect(x, y, cell, cell)
    // 3 Risse je Feld, die mit k laenger werden
    for (let i = 0; i < 3; i++) {
      const x0 = x + h2(c.x, c.y, i) * cell
      const y0 = y + h2(c.y, c.x, i + 4) * cell
      const w = h2(c.x + i, c.y, 9) * TAU
      const l = cell * (0.25 + 0.5 * k)
      const xm = x0 + Math.cos(w) * l * 0.5 + Math.cos(w + 1.3) * cell * 0.08
      const ym = y0 + Math.sin(w) * l * 0.5 + Math.sin(w + 1.3) * cell * 0.08
      ctx.strokeStyle = 'rgba(25, 10, 6, 0.9)'
      ctx.lineWidth = Math.max(1.5, cell * 0.07)
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(xm, ym)
      ctx.lineTo(x0 + Math.cos(w) * l, y0 + Math.sin(w) * l)
      ctx.stroke()
      ctx.strokeStyle = `rgba(255, 120, 30, ${0.3 + 0.6 * k * (0.7 + 0.3 * Math.sin(now / 90 + i))})`
      ctx.lineWidth = Math.max(0.8, cell * 0.025)
      ctx.stroke()
    }
  }
}

/** Weggebrochenes Stueck: tiefes Loch mit Glut unten; in den ersten 450 ms faellt die Scholle hinein */
export function drawAbbruchLoch(ctx: CanvasRenderingContext2D, cells: P[], cell: number, alter: number, now: number) {
  for (const c of cells) {
    const x = c.x * cell
    const y = c.y * cell
    // Tiefes Loch, unten glueht die Lava; am Rand haengen Basaltbrocken
    ctx.fillStyle = '#1C0D08'
    ctx.fillRect(x - 0.3, y - 0.3, cell + 0.6, cell + 0.6)
    const f = 0.55 + 0.2 * Math.sin(now / 300 + c.x)
    schein(ctx, x + cell / 2, y + cell / 2, cell * 0.62, f)
    ctx.fillStyle = `rgba(160, 40, 10, ${f})`
    ctx.beginPath()
    ctx.ellipse(x + cell / 2, y + cell * 0.55, cell * 0.28, cell * 0.2, 0, 0, TAU)
    ctx.fill()
    ctx.fillStyle = `rgba(255, 150, 50, ${f})`
    ctx.beginPath()
    ctx.ellipse(x + cell / 2, y + cell * 0.55, cell * 0.13, cell * 0.08, 0, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#564A43'
    for (let i = 0; i < 4; i++) {
      const rand = h2(c.x, c.y, i + 20)
      const bx = i < 2 ? x + rand * cell * 0.8 : x + (i === 2 ? 0 : cell * 0.85)
      const by = i < 2 ? y + (i === 0 ? 0 : cell * 0.85) : y + rand * cell * 0.8
      ctx.fillRect(bx, by, cell * 0.15, cell * 0.15)
    }
    if (alter < 450) {
      const k = alter / 450
      const s = 1 - k * 0.8
      ctx.fillStyle = `rgba(86, 74, 67, ${1 - k})`
      ctx.fillRect(x + (cell * (1 - s)) / 2, y + (cell * (1 - s)) / 2 + k * cell * 0.2, cell * s, cell * s)
    }
  }
}

/* ================= Lavabomben, Meteore ================= */

/** Landestelle gluehen lassen (k = 0..1 bis zum Einschlag), dazu ein Ring, der sich zusammenzieht */
export function drawGlutZiel(ctx: CanvasRenderingContext2D, p: P, cell: number, k: number, now: number, farbe: 'lava' | 'meteor') {
  const x = (p.x + 0.5) * cell
  const y = (p.y + 0.5) * cell
  const puls = 0.5 + 0.5 * Math.sin(now / (110 - 60 * k))
  if (farbe === 'meteor') {
    // Schatten des Meteors waechst
    ctx.fillStyle = `rgba(10, 4, 2, ${0.15 + 0.45 * k})`
    ctx.beginPath()
    ctx.ellipse(x, y + cell * 0.06, cell * (0.15 + 0.35 * k), cell * (0.1 + 0.25 * k), 0, 0, TAU)
    ctx.fill()
  }
  schein(ctx, x, y, cell * (0.5 + 0.4 * k), 0.25 + 0.45 * k * puls)
  ctx.strokeStyle = `rgba(255, ${farbe === 'lava' ? 110 : 180}, 40, ${0.4 + 0.5 * puls})`
  ctx.lineWidth = Math.max(1.5, cell * 0.06)
  ctx.beginPath()
  ctx.arc(x, y, cell * (0.62 - 0.3 * k), 0, TAU)
  ctx.stroke()
}

/** Lavabombe im Flug vom Krater (von) zur Landestelle (f = 0..1), in hohem Bogen */
export function drawLavabombeFlug(ctx: CanvasRenderingContext2D, von: P, nach: P, cell: number, f: number, now: number) {
  const x = (von.x + (nach.x - von.x) * f + 0.5) * cell
  const yb = (von.y + (nach.y - von.y) * f + 0.5) * cell
  const y = yb - Math.sin(Math.PI * f) * cell * 2.4
  // Rauchspur
  for (let i = 1; i <= 4; i++) {
    const g = Math.max(0, f - i * 0.06)
    const sx = (von.x + (nach.x - von.x) * g + 0.5) * cell
    const sy = (von.y + (nach.y - von.y) * g + 0.5) * cell - Math.sin(Math.PI * g) * cell * 2.4
    ctx.fillStyle = `rgba(60, 50, 45, ${0.35 - i * 0.07})`
    ctx.beginPath()
    ctx.arc(sx, sy, cell * (0.1 + i * 0.03), 0, TAU)
    ctx.fill()
  }
  schein(ctx, x, y, cell * 0.6, 0.8)
  ctx.fillStyle = '#3A1A0C'
  ctx.beginPath()
  ctx.arc(x, y, cell * 0.2, 0, TAU)
  ctx.fill()
  ctx.fillStyle = Math.sin(now / 40) > 0 ? '#FFB040' : '#FF7A1A'
  ctx.beginPath()
  ctx.arc(x - cell * 0.05, y - cell * 0.05, cell * 0.11, 0, TAU)
  ctx.fill()
}

/** Meteor im Fall (f = 0..1): schraeg von oben mit Feuerschweif */
export function drawMeteorFall(ctx: CanvasRenderingContext2D, p: P, cell: number, f: number) {
  const x1 = (p.x + 0.5) * cell
  const y1 = (p.y + 0.5) * cell
  const x = x1 + (1 - f) * cell * 3
  const y = y1 - (1 - f) * cell * 6
  ctx.strokeStyle = 'rgba(255, 140, 40, 0.55)'
  ctx.lineCap = 'round'
  ctx.lineWidth = cell * 0.28
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + cell * 1.1, y - cell * 2.2)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255, 230, 160, 0.8)'
  ctx.lineWidth = cell * 0.1
  ctx.stroke()
  schein(ctx, x, y, cell * 0.7, 0.9)
  ctx.fillStyle = '#4A2A18'
  ctx.beginPath()
  ctx.arc(x, y, cell * 0.22, 0, TAU)
  ctx.fill()
}

/** Nach dem Einschlag: brennender Fleck (alter in ms, bis 1500) */
export function drawGlutFleck(ctx: CanvasRenderingContext2D, p: P, cell: number, alter: number, now: number) {
  const x = (p.x + 0.5) * cell
  const y = (p.y + 0.5) * cell
  const a = 1 - Math.min(1, alter / 1500) * 0.6
  ctx.fillStyle = `rgba(30, 14, 8, ${0.8 * a})`
  ctx.beginPath()
  ctx.arc(x, y, cell * 0.46, 0, TAU)
  ctx.fill()
  schein(ctx, x, y, cell * 0.7, 0.7 * a)
  ctx.fillStyle = `rgba(255, 120, 30, ${a})`
  for (let i = 0; i < 4; i++) {
    const w = (i / 4) * TAU + h2(p.x, p.y, i)
    const f = 0.5 + 0.5 * Math.sin(now / 70 + i * 1.7)
    ctx.beginPath()
    ctx.ellipse(x + Math.cos(w) * cell * 0.15, y + Math.sin(w) * cell * 0.15 - f * cell * 0.12, cell * 0.08, cell * (0.12 + 0.1 * f), 0, 0, TAU)
    ctx.fill()
  }
  ctx.fillStyle = `rgba(255, 230, 150, ${a})`
  ctx.beginPath()
  ctx.arc(x, y, cell * 0.1, 0, TAU)
  ctx.fill()
}

/* ================= Lavastrom ================= */

/** Lavastrom: fliessende Lava auf den gewachsenen Feldern (das vorderste schwillt an), erkaltet = dunkle Kruste (kalt 0..1) */
export function drawLavastrom(ctx: CanvasRenderingContext2D, cells: P[], grown: number, cell: number, vorn: number, kalt: number, now: number) {
  const r = cell * 0.5
  for (let i = 0; i < grown; i++) {
    const c = cells[i]
    const x = (c.x + 0.5) * cell
    const y = (c.y + 0.5) * cell
    const s = i === grown - 1 ? vorn : 1
    if (kalt > 0) {
      ctx.globalAlpha = 1 - kalt
      ctx.fillStyle = '#2E2420'
      ctx.beginPath()
      ctx.arc(x, y, r * 0.95, 0, TAU)
      ctx.fill()
      ctx.strokeStyle = `rgba(255, 90, 20, ${0.5 * (1 - kalt)})`
      ctx.lineWidth = Math.max(1, cell * 0.03)
      ctx.beginPath()
      ctx.moveTo(x - r * 0.5, y - r * 0.2)
      ctx.lineTo(x + r * 0.1, y + r * 0.1)
      ctx.lineTo(x + r * 0.5, y - r * 0.3)
      ctx.stroke()
      ctx.globalAlpha = 1
      continue
    }
    // Verbindung zum vorigen Feld, damit es ein Strom ist
    if (i > 0) {
      const p = cells[i - 1]
      ctx.fillStyle = '#B8320E'
      ctx.fillRect(Math.min(p.x, c.x) * cell + cell * 0.12, Math.min(p.y, c.y) * cell + cell * 0.12, (Math.abs(p.x - c.x) + 1) * cell - cell * 0.24, (Math.abs(p.y - c.y) + 1) * cell - cell * 0.24)
    }
    schein(ctx, x, y, cell * 0.75 * s, 0.35)
    ctx.fillStyle = '#7A1E08'
    ctx.beginPath()
    ctx.arc(x, y, r * 1.0 * s, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#B8320E'
    ctx.beginPath()
    ctx.arc(x, y, r * 0.88 * s, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#FF7A1A'
    ctx.beginPath()
    ctx.arc(x, y, r * 0.7 * s, 0, TAU)
    ctx.fill()
    // Schlieren fliessen Richtung Spitze
    const t = ((now / 700 - i * 0.25) % 1 + 1) % 1
    ctx.fillStyle = '#FFC24A'
    ctx.beginPath()
    ctx.ellipse(x + Math.cos(t * TAU) * r * 0.25, y + Math.sin(t * TAU) * r * 0.25, r * 0.28 * s, r * 0.16 * s, t * TAU, 0, TAU)
    ctx.fill()
    // Kruste: dunkle Schollen treiben auf der Lava
    ctx.fillStyle = 'rgba(60, 28, 18, 0.6)'
    for (let j = 0; j < 2; j++) {
      ctx.beginPath()
      ctx.ellipse(x + r * (0.45 * h2(c.x, c.y, j) - 0.2), y + r * (0.45 * h2(c.y, c.x, j) - 0.25), r * 0.2 * s, r * 0.13 * s, j, 0, TAU)
      ctx.fill()
    }
  }
}

/* ================= Lavafisch ================= */

/** Vor dem Sprung: es brodelt am Absprung, die Bahn leuchtet gepunktet (k = 0..1) */
export function drawFischWarnung(ctx: CanvasRenderingContext2D, von: P, cells: P[], cell: number, k: number, now: number) {
  const x = (von.x + 0.5) * cell
  const y = (von.y + 0.5) * cell
  schein(ctx, x, y, cell * (0.6 + 0.3 * k), 0.5 + 0.4 * k)
  for (let i = 0; i < 3; i++) {
    const z = ((now / 400 + i / 3) % 1 + 1) % 1
    ctx.fillStyle = `rgba(255, 210, 120, ${(1 - z) * 0.9})`
    ctx.beginPath()
    ctx.arc(x + (h2(i, von.x) - 0.5) * cell * 0.6, y + (h2(von.y, i) - 0.5) * cell * 0.6, cell * 0.06 * (1 + z * 2), 0, TAU)
    ctx.fill()
  }
  ctx.fillStyle = `rgba(255, 140, 40, ${0.25 + 0.45 * k})`
  for (const c of cells) {
    ctx.beginPath()
    ctx.arc((c.x + 0.5) * cell, (c.y + 0.5) * cell, cell * 0.08, 0, TAU)
    ctx.fill()
  }
}

/** Lavafisch im Sprung: Position f (Felder entlang der Bahn, -1 = Absprung), springt im Bogen und tropft */
export function drawLavafisch(ctx: CanvasRenderingContext2D, von: P, nach: P, n: number, f: number, cell: number, now: number) {
  const g = (f + 1) / (n + 1)
  const x = (von.x + (nach.x - von.x) * g + 0.5) * cell
  const yb = (von.y + (nach.y - von.y) * g + 0.5) * cell
  const hoch = Math.sin(Math.PI * g) * cell * 1.1
  const y = yb - hoch
  const ang = Math.atan2(nach.y - von.y - Math.cos(Math.PI * g) * 1.6, nach.x - von.x)
  // Schatten am Boden
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
  ctx.beginPath()
  ctx.ellipse(x, yb + cell * 0.1, cell * 0.35, cell * 0.14, 0, 0, TAU)
  ctx.fill()
  schein(ctx, x, y, cell * 0.8, 0.6)
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(ang)
  const u = cell * 0.5
  ctx.fillStyle = '#C8400F'
  ctx.beginPath()
  ctx.moveTo(-u * 0.6, 0)
  ctx.lineTo(-u * 1.0, -u * 0.32)
  ctx.lineTo(-u * 1.0, u * 0.32)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#FF7A1A'
  ctx.beginPath()
  ctx.ellipse(0, 0, u * 0.7, u * 0.32, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#FFD27A'
  ctx.beginPath()
  ctx.ellipse(u * 0.1, -u * 0.08, u * 0.4, u * 0.12, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#2A0E06'
  ctx.beginPath()
  ctx.arc(u * 0.45, -u * 0.08, u * 0.07, 0, TAU)
  ctx.fill()
  ctx.restore()
  // Lavatropfen fallen ab
  for (let i = 0; i < 3; i++) {
    const t = ((now / 260 + i / 3) % 1 + 1) % 1
    ctx.fillStyle = `rgba(255, 150, 40, ${1 - t})`
    ctx.beginPath()
    ctx.arc(x - Math.cos(ang) * cell * 0.3, y + t * hoch, cell * 0.05, 0, TAU)
    ctx.fill()
  }
}

/* ================= Lavabruecke ================= */

/** Bruecke aus Basaltplatten ueber dem Krater; je oefter ueberquert, desto mehr Risse (schaden 0..1) */
export function drawBruecke(ctx: CanvasRenderingContext2D, cells: P[], cell: number, schaden: number, k: number) {
  if (cells.length < 1) return
  const quer = cells.length > 1 && cells[0].y === cells[1].y ? 'x' : 'y'
  ctx.globalAlpha = k
  for (const c of cells) {
    const x = c.x * cell
    const y = c.y * cell
    // Seile/Kanten
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
    if (quer === 'x') ctx.fillRect(x - 1, y + cell * 0.1, cell + 2, cell * 0.85)
    else ctx.fillRect(x + cell * 0.1, y - 1, cell * 0.85, cell + 2)
    ctx.fillStyle = '#6A5C55'
    if (quer === 'x') ctx.fillRect(x - 0.5, y + cell * 0.08, cell + 1, cell * 0.84)
    else ctx.fillRect(x + cell * 0.08, y - 0.5, cell * 0.84, cell + 1)
    // Platten
    ctx.fillStyle = '#867670'
    for (let i = 0; i < 2; i++) {
      if (quer === 'x') ctx.fillRect(x + i * cell * 0.5 + cell * 0.04, y + cell * 0.12, cell * 0.42, cell * 0.76)
      else ctx.fillRect(x + cell * 0.12, y + i * cell * 0.5 + cell * 0.04, cell * 0.76, cell * 0.42)
    }
    // Glut von unten durch die Fugen
    ctx.fillStyle = 'rgba(255, 110, 30, 0.6)'
    if (quer === 'x') ctx.fillRect(x + cell * 0.47, y + cell * 0.12, cell * 0.04, cell * 0.76)
    else ctx.fillRect(x + cell * 0.12, y + cell * 0.47, cell * 0.76, cell * 0.04)
    if (schaden > 0) {
      ctx.strokeStyle = `rgba(30, 14, 8, ${0.5 + 0.5 * schaden})`
      ctx.lineWidth = Math.max(1, cell * 0.04)
      ctx.beginPath()
      ctx.moveTo(x + cell * h2(c.x, c.y), y + cell * 0.15)
      ctx.lineTo(x + cell * 0.5, y + cell * 0.5)
      ctx.lineTo(x + cell * h2(c.y, c.x, 2), y + cell * 0.85)
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 1
}

/* ================= Obsidian ================= */

const DIR_W: Record<Dir, number> = { r: 0, d: Math.PI / 2, l: Math.PI, u: -Math.PI / 2 }

/** Obsidian-Kristall: schwarz glaenzend, die offene Seite leuchtet (dort einsammeln) */
export function drawObsidian(ctx: CanvasRenderingContext2D, p: P, offen: Dir, cell: number, now: number, a: number) {
  const x = (p.x + 0.5) * cell
  const y = (p.y + 0.5) * cell
  const u = cell * 0.45
  ctx.globalAlpha = a
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
  ctx.beginPath()
  ctx.ellipse(x, y + u * 0.6, u * 0.8, u * 0.3, 0, 0, TAU)
  ctx.fill()
  // Offene Seite: leuchtender Pfeil auf dem Boden davor
  const w = DIR_W[offen]
  const puls = 0.5 + 0.5 * Math.sin(now / 160)
  ctx.globalAlpha = a
  schein(ctx, x + Math.cos(w) * u * 0.9, y + Math.sin(w) * u * 0.9, u * 0.9, (0.4 + 0.4 * puls) * a)
  ctx.globalAlpha = a
  ctx.fillStyle = '#18121A'
  ctx.beginPath()
  ctx.moveTo(x, y - u * 1.1)
  ctx.lineTo(x + u * 0.62, y - u * 0.2)
  ctx.lineTo(x + u * 0.4, y + u * 0.6)
  ctx.lineTo(x - u * 0.4, y + u * 0.6)
  ctx.lineTo(x - u * 0.62, y - u * 0.2)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#3A2E44'
  ctx.beginPath()
  ctx.moveTo(x, y - u * 1.1)
  ctx.lineTo(x + u * 0.62, y - u * 0.2)
  ctx.lineTo(x, y + u * 0.1)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = `rgba(200, 170, 255, ${0.5 + 0.4 * puls})`
  ctx.beginPath()
  ctx.moveTo(x - u * 0.12, y - u * 0.8)
  ctx.lineTo(x + u * 0.08, y - u * 0.55)
  ctx.lineTo(x - u * 0.2, y - u * 0.35)
  ctx.closePath()
  ctx.fill()
  // Glut-Kante auf der offenen Seite
  ctx.strokeStyle = `rgba(255, 170, 60, ${0.6 + 0.4 * puls})`
  ctx.lineWidth = Math.max(1.5, cell * 0.07)
  ctx.lineCap = 'round'
  ctx.beginPath()
  const ex = x + Math.cos(w) * u * 0.62
  const ey = y + Math.sin(w) * u * 0.62
  ctx.moveTo(ex - Math.sin(w) * u * 0.45, ey + Math.cos(w) * u * 0.45)
  ctx.lineTo(ex + Math.sin(w) * u * 0.45, ey - Math.cos(w) * u * 0.45)
  ctx.stroke()
  ctx.globalAlpha = 1
}

/* ================= Glutgolem ================= */

/** Glutspur: gluehender Boden, der verglimmt (rest = 1 frisch .. 0 kalt) */
export function drawGlut(ctx: CanvasRenderingContext2D, p: P, cell: number, rest: number, now: number) {
  const x = (p.x + 0.5) * cell
  const y = (p.y + 0.5) * cell
  // Verkohlter Fleck, darin gluehende Brocken, die flackern
  ctx.fillStyle = `rgba(30, 12, 6, ${0.65 * rest})`
  ctx.beginPath()
  ctx.ellipse(x, y, cell * 0.44, cell * 0.38, h2(p.x, p.y) * 3, 0, TAU)
  ctx.fill()
  schein(ctx, x, y, cell * 0.55, rest * (0.5 + 0.2 * Math.sin(now / 120 + p.x)))
  for (let i = 0; i < 4; i++) {
    const w = (i / 4) * TAU + h2(p.x, p.y, i) * 1.5
    const f = 0.6 + 0.4 * Math.sin(now / (60 + i * 17) + i)
    ctx.fillStyle = i % 2 ? `rgba(255, 120, 30, ${rest * f})` : `rgba(255, 200, 90, ${rest * f})`
    ctx.beginPath()
    ctx.ellipse(x + Math.cos(w) * cell * 0.18, y + Math.sin(w) * cell * 0.15, cell * 0.09, cell * 0.06, w, 0, TAU)
    ctx.fill()
  }
}

/** Glutgolem von oben: Basaltbrocken mit gluehenden Fugen und Augen */
export function drawGlutgolem(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, ang: number, lauf: number, s: number, a = 1, now = 0) {
  if (s <= 0 || a <= 0) return
  const u = cell * 0.64 * s
  ctx.save()
  ctx.globalAlpha *= a
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
  ctx.beginPath()
  ctx.ellipse(x, y + cell * 0.14, u * 1.0, u * 0.7, 0, 0, TAU)
  ctx.fill()
  ctx.drawImage(glutSchein(), x - u * 1.4, y - u * 1.4, u * 2.8, u * 2.8)
  ctx.translate(x, y)
  ctx.rotate(ang)
  const schw = lauf >= 0 ? Math.sin(lauf * TAU) * u * 0.15 : 0
  ctx.fillStyle = '#2E2622'
  for (const sy of [-1, 1]) ctx.fillRect(u * 0.05 + schw * sy, sy * u * 0.55 - u * 0.17, u * 0.45, u * 0.34)
  ctx.fillStyle = '#3E3430'
  ctx.beginPath()
  const pts = [[-0.7, -0.35], [-0.2, -0.6], [0.45, -0.45], [0.6, 0.1], [0.35, 0.5], [-0.3, 0.55], [-0.75, 0.15]]
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px * u, py * u) : ctx.moveTo(px * u, py * u)))
  ctx.closePath()
  ctx.fill()
  // Gluehende Fugen
  const gl = 0.6 + 0.4 * Math.sin(now / 200)
  ctx.strokeStyle = `rgba(255, 120, 30, ${gl})`
  ctx.lineWidth = Math.max(1.2, cell * 0.05)
  ctx.beginPath()
  ctx.moveTo(-0.55 * u, -0.1 * u)
  ctx.lineTo(-0.1 * u, 0.05 * u)
  ctx.lineTo(0.3 * u, -0.3 * u)
  ctx.moveTo(-0.1 * u, 0.05 * u)
  ctx.lineTo(0.05 * u, 0.45 * u)
  ctx.stroke()
  ctx.fillStyle = `rgba(255, 220, 120, ${gl})`
  for (const sy of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(u * 0.42, sy * u * 0.14, u * 0.08, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}
