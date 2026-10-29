/**
 * Dungeon der Kampagne (ab Mission 21): Kaefigkoepfe (zombiehafte Diener, der Kopf steckt in einem Eisenkaefig), ihr
 * Energiestrahl mit Ankuendigung, die Siegel (Mission 27) und die grosse Dungeon-Tuer (zu dunkel, offen orange).
 * Alles von oben gesehen; Spiellogik in game/mission.ts. Boden und Mauern kommen als Kacheln aus berge.ts.
 */
import type { P } from '../game/types'

const TAU = Math.PI * 2
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

const hash2 = (x: number, y: number, s = 0) => {
  const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453
  return v - Math.floor(v)
}

/** Ein Feld Steinboden unter der Erde (Kampagne ab Mission 21, Kerker im freien Spiel): ruhig und kontrastarm, damit er
 *  nicht ablenkt; ein kaum sichtbares Schachbrett, ein, zwei flache Pflastersteine, ein paar Kruemel. Immer gleich je Feld */
export function drawSteinboden(c: CanvasRenderingContext2D, x: number, y: number, cell: number) {
  const hell = (x + y) % 2 === 0
  c.fillStyle = hell ? '#685F55' : '#635A51'
  c.fillRect(x * cell - 0.3, y * cell - 0.3, cell + 0.6, cell + 0.6)
  const n = 1 + Math.floor(hash2(x, y, 21) * 1.8)
  for (let i = 0; i < n; i++) {
    const sx = x * cell + cell * (0.25 + hash2(x, y, 22 + i) * 0.5)
    const sy = y * cell + cell * (0.25 + hash2(x, y, 26 + i) * 0.5)
    const r = cell * (0.15 + hash2(x, y, 30 + i) * 0.1)
    const t = hash2(x, y, 34 + i)
    c.fillStyle = `rgba(${hell ? 118 : 112}, ${hell ? 108 : 103}, ${hell ? 97 : 92}, ${0.55 + t * 0.25})`
    c.beginPath()
    c.ellipse(sx, sy, r, r * 0.8, hash2(x, y, 38 + i) * 3, 0, Math.PI * 2)
    c.fill()
  }
  c.fillStyle = 'rgba(52, 40, 30, 0.18)'
  for (let i = 0; i < 2; i++) c.fillRect(x * cell + hash2(x, y, 44 + i) * cell, y * cell + hash2(x, y, 48 + i) * cell, cell * 0.06, cell * 0.06)
}

/** Augen (Reich des Kaefigmeisters), gedeckt und unauffaellig (wie verstaubt), die Pupillen schauen zum Kopf der Schlange
 *  (kx, ky in Pixeln), ab und zu blinzelt eins. An der Wand (wand = Richtung zur Wand) schauen sie aus einem Spalt von der
 *  Seite herein, nebeneinander und halb verdeckt: nur Deko. Frei auf dem Boden (boden) liegen 2 bis 4 als Klumpen auf einem
 *  dunklen, leicht violetten Fleck und eine Spur heller: daran erkennt man das gefaehrliche Augenfeld */
export function drawAugen(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, n: number, seed: number, wand: P | null, kx: number, ky: number, now: number, reduce: boolean, boden = false) {
  const amSpalt = !boden && !!wand
  // Augen (Mitte, Radius, Stauchung zur Wand hin)
  const augen: { ax: number; ay: number; r: number }[] = []
  if (amSpalt) {
    const w = wand!
    const qx = -w.y
    const qy = w.x
    const sx = x + w.x * cell * 0.42
    const sy = y + w.y * cell * 0.42
    // Dunkler Spalt an der Wand, aus dem sie herausschauen
    ctx.fillStyle = 'rgba(14, 9, 7, 0.55)'
    ctx.beginPath()
    ctx.ellipse(sx, sy, Math.abs(qx) * cell * (0.16 + n * 0.08) + Math.abs(w.x) * cell * 0.07, Math.abs(qy) * cell * (0.16 + n * 0.08) + Math.abs(w.y) * cell * 0.07, 0, 0, TAU)
    ctx.fill()
    const versatz = (hash(seed + 3) - 0.5) * cell * 0.3
    for (let i = 0; i < n; i++) {
      const entlang = versatz + (i - (n - 1) / 2) * cell * 0.19
      const r = cell * (0.07 + hash(seed + i * 5) * 0.02)
      augen.push({ ax: x + w.x * cell * 0.33 + qx * entlang, ay: y + w.y * cell * 0.33 + qy * entlang, r })
    }
  } else {
    if (boden) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, cell * 0.5)
      g.addColorStop(0, 'rgba(60, 30, 70, 0.32)')
      g.addColorStop(0.7, 'rgba(70, 40, 90, 0.14)')
      g.addColorStop(1, 'rgba(70, 40, 90, 0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, cell * 0.5, 0, TAU)
      ctx.fill()
    }
    for (let i = 0; i < n; i++) {
      const a = (i / Math.max(1, n)) * TAU + hash(seed) * TAU
      const d = n === 1 ? 0 : cell * 0.15
      augen.push({ ax: x + Math.cos(a) * d, ay: y + Math.sin(a) * d * 0.8, r: cell * (0.085 + hash(seed + i * 5) * 0.035) * 1.2 })
    }
  }
  augen.forEach(({ ax, ay, r }, i) => {
    // An der Wand gestaucht (halb im Spalt), am Boden rund
    const rx = amSpalt && wand!.x ? r * 0.75 : r
    const ry = (amSpalt && wand!.y ? r * 0.75 : r) * (amSpalt ? 1 : 0.88)
    ctx.fillStyle = 'rgba(30, 16, 12, 0.22)'
    ctx.beginPath()
    ctx.ellipse(ax + r * 0.2, ay + r * 0.3, rx * 1.05, ry * 1.02, 0, 0, TAU)
    ctx.fill()
    const zu = !reduce && (now / 4100 + hash(seed + i)) % 1 < 0.035
    // Gedeckt: graugelblich statt weiss, damit es sich nicht vom Boden abhebt; ein gefaehrlicher Klumpen eine Spur heller
    ctx.fillStyle = boden ? '#B5AC9A' : '#A99F8C'
    ctx.beginPath()
    ctx.ellipse(ax, ay, rx, zu ? ry * 0.17 : ry, 0, 0, TAU)
    ctx.fill()
    if (zu) return
    const w = Math.atan2(ky - ay, kx - ax)
    const px = ax + Math.cos(w) * rx * 0.38
    const py = ay + Math.sin(w) * ry * 0.36
    ctx.fillStyle = hash(seed + i * 7) < 0.5 ? '#5E4F72' : '#4A5E66'
    ctx.beginPath()
    ctx.arc(px, py, r * 0.45, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#1C1416'
    ctx.beginPath()
    ctx.arc(px, py, r * 0.22, 0, TAU)
    ctx.fill()
    ctx.fillStyle = 'rgba(255, 250, 240, 0.35)'
    ctx.beginPath()
    ctx.arc(px - r * 0.14, py - r * 0.14, r * 0.08, 0, TAU)
    ctx.fill()
  })
}

/** Ein Buch am Boden (Kaefigmeister): zugeklappt oder aufgeschlagen, schraeg hingeworfen */
export function drawBuchAmBoden(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, seed: number) {
  // Gedeckt und klein, kaum heller oder dunkler als der Steinboden: soll nur beim Hinsehen auffallen
  const auf = hash(seed) < 0.4
  const farben = ['#4A403A', '#3E4248', '#43443A', '#4A4236']
  ctx.save()
  ctx.globalAlpha = 0.55
  ctx.translate(x + (hash(seed + 1) - 0.5) * cell * 0.3, y + (hash(seed + 2) - 0.5) * cell * 0.3)
  ctx.rotate((hash(seed + 3) - 0.5) * 2.4)
  ctx.scale(0.8, 0.8)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'
  ctx.fillRect(-cell * 0.26 + 1, -cell * 0.19 + 1, cell * 0.52, cell * 0.38)
  ctx.fillStyle = farben[Math.floor(hash(seed + 4) * 4)]
  if (auf) {
    ctx.fillRect(-cell * 0.3, -cell * 0.2, cell * 0.6, cell * 0.4)
    ctx.fillStyle = '#8C857A'
    ctx.fillRect(-cell * 0.27, -cell * 0.17, cell * 0.25, cell * 0.34)
    ctx.fillRect(cell * 0.02, -cell * 0.17, cell * 0.25, cell * 0.34)
    ctx.strokeStyle = 'rgba(70, 64, 60, 0.6)'
    ctx.lineWidth = Math.max(0.6, cell * 0.02)
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.moveTo(-cell * 0.23, -cell * 0.1 + i * cell * 0.08)
      ctx.lineTo(-cell * 0.06, -cell * 0.1 + i * cell * 0.08)
      ctx.moveTo(cell * 0.06, -cell * 0.1 + i * cell * 0.08)
      ctx.lineTo(cell * 0.23, -cell * 0.1 + i * cell * 0.08)
      ctx.stroke()
    }
  } else {
    ctx.fillRect(-cell * 0.22, -cell * 0.17, cell * 0.44, cell * 0.34)
    ctx.fillStyle = '#6E6150'
    ctx.fillRect(-cell * 0.22, -cell * 0.17, cell * 0.05, cell * 0.34)
  }
  ctx.restore()
}

/** Buecherschrank (Mission 30) von oben, ueber zusammenhaengende Felder: dunkles Holz, Reihen von Buchruecken */
export function drawRegal(ctx: CanvasRenderingContext2D, cells: P[], cell: number) {
  if (!cells.length) return
  const x0 = Math.min(...cells.map((c) => c.x)) * cell
  const y0 = Math.min(...cells.map((c) => c.y)) * cell
  const x1 = (Math.max(...cells.map((c) => c.x)) + 1) * cell
  const y1 = (Math.max(...cells.map((c) => c.y)) + 1) * cell
  const quer = x1 - x0 >= y1 - y0
  ctx.save()
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
  ctx.fillRect(x0 + cell * 0.12, y0 + cell * 0.18, x1 - x0, y1 - y0)
  ctx.fillStyle = '#3B2618'
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
  ctx.fillStyle = '#5A3A22'
  ctx.fillRect(x0 + cell * 0.06, y0 + cell * 0.06, x1 - x0 - cell * 0.12, y1 - y0 - cell * 0.12)
  // Buchruecken in zwei Reihen
  const farben = ['#7A2E2E', '#2E4A7A', '#4A6A32', '#8A6A2A', '#5A3A6A', '#A88A5A']
  const lang = quer ? x1 - x0 : y1 - y0
  const n = Math.floor(lang / (cell * 0.16))
  for (let reihe = 0; reihe < 2; reihe++)
    for (let i = 0; i < n; i++) {
      const z = hash(i * 13 + reihe * 101 + x0 + y0)
      ctx.fillStyle = farben[Math.floor(z * farben.length)]
      const a = cell * 0.1 + i * cell * 0.16
      const b = cell * (0.12 + reihe * 0.4)
      const t = cell * (0.3 + z * 0.08)
      if (quer) ctx.fillRect(x0 + a, y0 + b, cell * 0.12, t)
      else ctx.fillRect(x0 + b, y0 + a, t, cell * 0.12)
    }
  ctx.strokeStyle = '#24160E'
  ctx.lineWidth = Math.max(1, cell * 0.06)
  ctx.strokeRect(x0 + cell * 0.03, y0 + cell * 0.03, x1 - x0 - cell * 0.06, y1 - y0 - cell * 0.06)
  ctx.restore()
}

/** Farbe der Energie (blassviolett, wie Runenlicht) */
const ENERGIE = [186, 150, 255] as const
const energie = (a: number) => `rgba(${ENERGIE[0]}, ${ENERGIE[1]}, ${ENERGIE[2]}, ${a})`

/**
 * Kaefigkopf von oben, Blick nach +x (winkel dreht): gebeugte Schultern in Lumpen, die Arme haengen nach vorn, der Kopf
 * steckt in einem runden Eisenkaefig, darin glimmen die Augen. lauf: Schrittphase (-1 = steht, er torkelt dabei),
 * jagt: hat den Kopf gesehen (Augen glühen violett), laden: holt aus (0..1, Energie sammelt sich zwischen den Haenden),
 * neig: senkt den Kopf (0..1): er lehnt sich vor, der Kaefig kippt nach vorn und man sieht ihn schraeg von oben/hinten
 */
export function drawKaefigkopf(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, winkel: number, lauf: number, jagt: boolean, laden: number, now: number, reduce: boolean, neig = 0) {
  const u = cell * 0.56
  const schritt = lauf >= 0 ? Math.sin(lauf * TAU) : 0
  // Torkeln: der Oberkoerper schwankt (auch im Stehen ein wenig)
  const schwank = reduce ? 0 : Math.sin(now / 520 + x * 0.01) * 0.12 + schritt * 0.1
  ctx.save()
  ctx.fillStyle = 'rgba(0, 0, 0, 0.32)'
  ctx.beginPath()
  ctx.ellipse(x + u * 0.12, y + u * 0.28, u * 1.15, u * 0.95, 0, 0, TAU)
  ctx.fill()
  ctx.translate(x, y)
  ctx.rotate(winkel + schwank)
  // Fuesse, schlurfend
  ctx.fillStyle = '#2E2A26'
  for (const sy of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(-u * 0.35 + schritt * sy * u * 0.22, sy * u * 0.36, u * 0.26, u * 0.16, 0, 0, TAU)
    ctx.fill()
  }
  // Lumpen (Rumpf), unten ausgefranst
  const lg = ctx.createRadialGradient(-u * 0.25, -u * 0.2, u * 0.1, 0, 0, u * 0.95)
  lg.addColorStop(0, '#6E6858')
  lg.addColorStop(0.7, '#4A4639')
  lg.addColorStop(1, '#2F2C24')
  ctx.fillStyle = lg
  ctx.beginPath()
  for (let i = 0; i <= 18; i++) {
    const a = (i / 18) * TAU
    const r = u * (0.78 + (i % 2 ? 0.1 : 0) * (Math.cos(a) < 0 ? 1 : 0.3))
    const px = Math.cos(a) * r * 0.82 - u * 0.12
    const py = Math.sin(a) * r
    if (i) ctx.lineTo(px, py)
    else ctx.moveTo(px, py)
  }
  ctx.closePath()
  ctx.fill()
  // Riemen ueber die Schulter
  ctx.strokeStyle = 'rgba(30, 24, 18, 0.7)'
  ctx.lineWidth = u * 0.1
  ctx.beginPath()
  ctx.moveTo(-u * 0.6, -u * 0.55)
  ctx.lineTo(u * 0.35, u * 0.6)
  ctx.stroke()
  // Arme: haengen nach vorn, beim Ausholen gehen die Haende zusammen und heben sich
  const hand = 0.25 + 0.55 * (1 - laden)
  for (const sy of [-1, 1]) {
    const hx = u * (0.75 + 0.15 * laden) - schritt * sy * u * 0.12
    const hy = sy * u * hand
    ctx.strokeStyle = '#5A5446'
    ctx.lineWidth = u * 0.24
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(u * 0.05, sy * u * 0.62)
    ctx.quadraticCurveTo(u * 0.55, sy * u * 0.75, hx, hy)
    ctx.stroke()
    // Bleiche Haende
    ctx.fillStyle = '#B9B2A0'
    ctx.beginPath()
    ctx.arc(hx, hy, u * 0.14, 0, TAU)
    ctx.fill()
  }
  // Energie zwischen den Haenden
  if (laden > 0) {
    const ex = u * 0.98
    const r = u * (0.12 + 0.32 * laden) * (reduce ? 1 : 1 + 0.12 * Math.sin(now / 50))
    const g = ctx.createRadialGradient(ex, 0, 0, ex, 0, r * 2.2)
    g.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
    g.addColorStop(0.35, energie(0.85))
    g.addColorStop(1, energie(0))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(ex, 0, r * 2.2, 0, TAU)
    ctx.fill()
  }
  // Kopf im Kaefig: dunkler Kopf, darueber ein runder Kaefig aus Eisenstaeben mit Ring und Spitze.
  // Gesenkt: der Kopf rueckt vor, der Kaefig wird laenglich (gekippt), die Spitze wandert nach hinten, die Augen schauen zu Boden
  const kx = u * (0.12 + 0.4 * neig)
  const kr = u * 0.46
  const lang = 1 + 0.4 * neig
  const spitze = -kr * 0.7 * neig
  ctx.fillStyle = '#3A3530'
  ctx.beginPath()
  ctx.ellipse(kx, 0, kr * 0.78 * lang, kr * 0.78, 0, 0, TAU)
  ctx.fill()
  // Augen im Kaefig
  const glut = (jagt ? 0.75 + 0.25 * Math.sin(now / 90) : 0.35) * (1 - 0.85 * neig)
  for (const sy of [-1, 1]) {
    const g = ctx.createRadialGradient(kx + kr * 0.42, sy * kr * 0.28, 0, kx + kr * 0.42, sy * kr * 0.28, kr * 0.42)
    g.addColorStop(0, jagt ? `rgba(240, 220, 255, ${glut})` : `rgba(220, 210, 170, ${glut})`)
    g.addColorStop(1, jagt ? energie(0) : 'rgba(220, 210, 170, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(kx + kr * 0.42, sy * kr * 0.28, kr * 0.42, 0, TAU)
    ctx.fill()
  }
  // Staebe: Meridiane und ein Ring (von oben gesehen)
  ctx.strokeStyle = '#8C8A86'
  ctx.lineWidth = Math.max(1, u * 0.07)
  ctx.beginPath()
  ctx.ellipse(kx, 0, kr * lang, kr, 0, 0, TAU)
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(kx + spitze * 0.45, 0, kr * 0.55 * lang, kr * 0.55, 0, 0, TAU)
  ctx.stroke()
  // Staebe laufen zur Spitze; gekippt sieht man sie gebogen an der Seite des Kaefigs entlang
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2
    const ex = kx + Math.cos(a) * kr * lang
    const ey = Math.sin(a) * kr
    ctx.beginPath()
    ctx.moveTo(kx + spitze + Math.cos(a) * kr * 0.12, Math.sin(a) * kr * 0.12)
    ctx.quadraticCurveTo(kx + spitze * 0.3 + Math.cos(a) * kr * 0.75 * lang, Math.sin(a) * kr * (0.75 + 0.2 * neig), ex, ey)
    ctx.stroke()
  }
  // Licht auf dem Eisen und die Spitze oben
  ctx.strokeStyle = 'rgba(230, 228, 220, 0.55)'
  ctx.lineWidth = Math.max(0.8, u * 0.04)
  ctx.beginPath()
  ctx.ellipse(kx, 0, kr * lang, kr, 0, Math.PI * 1.05, Math.PI * 1.55)
  ctx.stroke()
  ctx.fillStyle = '#6E6C68'
  ctx.beginPath()
  ctx.arc(kx + spitze, 0, kr * 0.16, 0, TAU)
  ctx.fill()
  ctx.restore()
}

/** Ausrufezeichen ueber dem Kaefigkopf, wenn er den Kopf entdeckt (k = 0..1 seit dem Entdecken) */
export function drawKaefigEntdeckt(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, k: number) {
  if (k >= 1) return
  const a = k < 0.15 ? k / 0.15 : 1 - clamp01((k - 0.6) / 0.4)
  const hop = Math.sin(Math.min(1, k / 0.25) * Math.PI) * cell * 0.15
  ctx.save()
  ctx.globalAlpha = a
  ctx.fillStyle = '#B48CFF'
  ctx.strokeStyle = '#2A1840'
  ctx.lineWidth = Math.max(1, cell * 0.06)
  ctx.font = `900 ${Math.round(cell * 0.8)}px "Libre Franklin", system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.strokeText('!', x, y - cell * 0.85 - hop)
  ctx.fillText('!', x, y - cell * 0.85 - hop)
  ctx.restore()
}

/** Ankuendigung des Strahls: die Felder werden rot, eine helle Linie waechst zum Ende (k = 0..1 bis zum Strahl) */
export function drawKaefigWarnung(ctx: CanvasRenderingContext2D, von: P, cells: P[], k: number, cell: number, now: number, reduce: boolean) {
  if (!cells.length) return
  ctx.save()
  const puls = reduce ? 0.5 : 0.5 + 0.5 * Math.sin(now / 70)
  ctx.fillStyle = `rgba(229, 70, 59, ${0.16 + 0.22 * k + 0.08 * puls})`
  for (const c of cells) ctx.fillRect(c.x * cell + 1, c.y * cell + 1, cell - 2, cell - 2)
  const a = { x: (von.x + 0.5) * cell, y: (von.y + 0.5) * cell }
  const e = cells[cells.length - 1]
  const b = { x: (e.x + 0.5) * cell, y: (e.y + 0.5) * cell }
  ctx.strokeStyle = `rgba(255, 210, 200, ${0.35 + 0.4 * k})`
  ctx.lineWidth = Math.max(1, cell * 0.08)
  ctx.setLineDash([cell * 0.25, cell * 0.2])
  ctx.lineDashOffset = reduce ? 0 : -now / 30
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k)
  ctx.stroke()
  ctx.restore()
}

/** Der Strahl selbst: ein gleissendes Band aus Energie, das kurz brennt und verblasst (k = 0..1 seiner Dauer) */
export function drawKaefigStrahl(ctx: CanvasRenderingContext2D, von: P, cells: P[], k: number, cell: number, now: number) {
  if (!cells.length || k >= 1) return
  const a = { x: (von.x + 0.5) * cell, y: (von.y + 0.5) * cell }
  const e = cells[cells.length - 1]
  const b = { x: (e.x + 0.5) * cell, y: (e.y + 0.5) * cell }
  const f = 1 - k
  ctx.save()
  ctx.lineCap = 'round'
  ctx.strokeStyle = energie(0.35 * f)
  ctx.lineWidth = cell * 0.95
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
  ctx.strokeStyle = energie(0.85 * f)
  ctx.lineWidth = cell * 0.45
  ctx.stroke()
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.9 * f})`
  ctx.lineWidth = cell * 0.16
  ctx.stroke()
  // Funken entlang des Strahls
  for (let i = 0; i < cells.length; i++) {
    const t = (i + 0.5 + Math.sin(now / 60 + i) * 0.3) / cells.length
    ctx.fillStyle = `rgba(240, 225, 255, ${0.8 * f})`
    ctx.beginPath()
    ctx.arc(a.x + (b.x - a.x) * t + (hash(i) - 0.5) * cell * 0.5, a.y + (b.y - a.y) * t + (hash(i + 9) - 0.5) * cell * 0.5, cell * 0.06, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}

/** Siegel (Mission 27): eine Scheibe aus dunklem Stein mit einer leuchtenden Rune, die sich langsam dreht */
export function drawSiegel(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, auf: number, now: number, reduce: boolean, letztes: boolean) {
  if (auf <= 0) return
  const r = cell * 0.42 * auf
  const hop = reduce ? 0 : Math.sin(now / 420 + x) * cell * 0.05
  ctx.save()
  // Schein
  const sg = ctx.createRadialGradient(x, y, 0, x, y, r * (letztes ? 3 : 2.3))
  sg.addColorStop(0, 'rgba(255, 196, 92, 0.5)')
  sg.addColorStop(1, 'rgba(255, 160, 60, 0)')
  ctx.fillStyle = sg
  ctx.beginPath()
  ctx.arc(x, y, r * (letztes ? 3 : 2.3), 0, TAU)
  ctx.fill()
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
  ctx.beginPath()
  ctx.ellipse(x + r * 0.15, y + r * 0.3, r, r * 0.85, 0, 0, TAU)
  ctx.fill()
  ctx.translate(x, y - hop)
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r)
  g.addColorStop(0, '#7A6E86')
  g.addColorStop(1, '#2E2836')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = '#C9933A'
  ctx.lineWidth = Math.max(1, r * 0.14)
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.86, 0, TAU)
  ctx.stroke()
  // Rune: Dreieck mit Auge, dreht sich
  ctx.rotate(reduce ? 0 : now / 1800)
  const gl = 0.7 + (reduce ? 0 : 0.3 * Math.sin(now / 200))
  ctx.strokeStyle = `rgba(255, 210, 120, ${gl})`
  ctx.lineWidth = Math.max(1, r * 0.12)
  ctx.beginPath()
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i / 3) * TAU
    if (i) ctx.lineTo(Math.cos(a) * r * 0.58, Math.sin(a) * r * 0.58)
    else ctx.moveTo(Math.cos(a) * r * 0.58, Math.sin(a) * r * 0.58)
  }
  ctx.closePath()
  ctx.stroke()
  ctx.fillStyle = `rgba(255, 230, 170, ${gl})`
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.16, 0, TAU)
  ctx.fill()
  ctx.restore()
}

/**
 * Die grosse Dungeon-Tuer: zwei Fluegel aus dunklem Holz mit Eisenbaendern und drei Siegelmulden. offen = 0..1 seit dem
 * Oeffnen (dann gluehen Rahmen und Mulden orange und die Fluegel weichen zur Seite), gefuellt = eingesetzte Siegel
 */
export function drawTuer(ctx: CanvasRenderingContext2D, cells: P[], cell: number, offen: number, gefuellt: number, mulden: number, now: number, reduce: boolean) {
  if (!cells.length) return
  const x0 = Math.min(...cells.map((c) => c.x)) * cell
  const y0 = Math.min(...cells.map((c) => c.y)) * cell
  const x1 = (Math.max(...cells.map((c) => c.x)) + 1) * cell
  const y1 = (Math.max(...cells.map((c) => c.y)) + 1) * cell
  const w = x1 - x0
  const h = y1 - y0
  const quer = h > w
  ctx.save()
  // Rahmen (Steinbogen)
  ctx.fillStyle = '#2A2530'
  ctx.fillRect(x0 - cell * 0.1, y0 - cell * 0.1, w + cell * 0.2, h + cell * 0.2)
  if (offen > 0) {
    // Offen: dahinter gluehendes Orange, die Fluegel gleiten auseinander
    const puls = reduce ? 0.8 : 0.75 + 0.25 * Math.sin(now / 160)
    const g = ctx.createLinearGradient(x0, y0, x1, y1)
    g.addColorStop(0, `rgba(255, 150, 40, ${0.75 * puls})`)
    g.addColorStop(0.5, `rgba(255, 210, 110, ${0.95 * puls})`)
    g.addColorStop(1, `rgba(255, 150, 40, ${0.75 * puls})`)
    ctx.fillStyle = g
    ctx.fillRect(x0, y0, w, h)
  }
  const k = clamp01(offen / 0.9)
  const fluegel = (a: number, b: number) => {
    // a..b: Anteil der Tuer, den der Fluegel bedeckt (0..1 entlang der langen Seite)
    const fx = quer ? x0 : x0 + w * a
    const fy = quer ? y0 + h * a : y0
    const fw = quer ? w : w * (b - a)
    const fh = quer ? h * (b - a) : h
    if (fw <= 0.5 || fh <= 0.5) return
    const g = ctx.createLinearGradient(fx, fy, fx + (quer ? fw : 0), fy + (quer ? 0 : fh))
    g.addColorStop(0, offen > 0 ? '#7A4A26' : '#5A3A24')
    g.addColorStop(1, offen > 0 ? '#5A3216' : '#3E2616')
    ctx.fillStyle = g
    ctx.fillRect(fx, fy, fw, fh)
    // Bretter
    ctx.strokeStyle = 'rgba(20, 10, 4, 0.45)'
    ctx.lineWidth = Math.max(1, cell * 0.05)
    const n = Math.max(2, Math.round((quer ? fh : fw) / (cell * 0.5)))
    for (let i = 1; i < n; i++) {
      ctx.beginPath()
      if (quer) {
        ctx.moveTo(fx, fy + (fh * i) / n)
        ctx.lineTo(fx + fw, fy + (fh * i) / n)
      } else {
        ctx.moveTo(fx + (fw * i) / n, fy)
        ctx.lineTo(fx + (fw * i) / n, fy + fh)
      }
      ctx.stroke()
    }
    // Eisenbaender
    ctx.fillStyle = offen > 0 ? '#C07A30' : '#45424A'
    for (const t of [0.22, 0.78]) {
      if (quer) ctx.fillRect(fx + fw * t - cell * 0.07, fy, cell * 0.14, fh)
      else ctx.fillRect(fx, fy + fh * t - cell * 0.07, fw, cell * 0.14)
    }
  }
  fluegel(0, 0.5 * (1 - k))
  fluegel(0.5 + 0.5 * k, 1)
  // Siegelmulden in der Mitte (eingesetzte leuchten)
  if (k < 1) {
    for (let i = 0; i < mulden; i++) {
      const t = (i + 1) / (mulden + 1)
      const mx = quer ? x0 + w / 2 : x0 + w * (0.5 + (t - 0.5) * 0.5)
      const my = quer ? y0 + h * (0.5 + (t - 0.5) * 0.5) : y0 + h / 2
      const voll = i < gefuellt || offen > 0
      ctx.fillStyle = voll ? '#FFB347' : '#1C1820'
      ctx.beginPath()
      ctx.arc(mx, my, cell * 0.16, 0, TAU)
      ctx.fill()
      if (voll) {
        const g = ctx.createRadialGradient(mx, my, 0, mx, my, cell * 0.6)
        g.addColorStop(0, 'rgba(255, 190, 90, 0.6)')
        g.addColorStop(1, 'rgba(255, 150, 60, 0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(mx, my, cell * 0.6, 0, TAU)
        ctx.fill()
      }
    }
  }
  // Rahmen leuchtet orange, wenn sie offen ist
  ctx.strokeStyle = offen > 0 ? `rgba(255, 170, 60, ${0.6 + (reduce ? 0.2 : 0.3 * Math.sin(now / 140))})` : '#4A4452'
  ctx.lineWidth = Math.max(2, cell * 0.14)
  ctx.strokeRect(x0 - cell * 0.05, y0 - cell * 0.05, w + cell * 0.1, h + cell * 0.1)
  ctx.restore()
}
