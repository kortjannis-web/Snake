/**
 * Winterwald: Eiszapfen (Schatten, Fall, Eisblock), Risse im Eis, Schneesturm, Polarnacht mit Nordlicht,
 * Eisbaer, Robbe, Schneemann, Yeti, Schneebaelle und Iglus. Spiellogik in game.ts (winterNachApfel, wesenTakt).
 *
 * Leistung: Nordlicht und Sturm sind wenige grosse Flaechen bzw. ein fertiges Verlaufsbild, das in Streifen kopiert
 * wird (kein Verlauf je Bild); die Tiere sind ein paar einfache Formen.
 */
import type { P } from '../game/types'

const TAU = Math.PI * 2
const h2 = (x: number, y: number, s = 0) => {
  const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453
  return v - Math.floor(v)
}
/** Mitte eines Rechtecks aus Feldern (in Pixeln) und seine Groesse in Feldern */
function rahmen(cells: P[], cell: number) {
  const xs = cells.map((c) => c.x)
  const ys = cells.map((c) => c.y)
  const x0 = Math.min(...xs)
  const y0 = Math.min(...ys)
  const w = Math.max(...xs) - x0 + 1
  const h = Math.max(...ys) - y0 + 1
  return { mx: (x0 + w / 2) * cell, my: (y0 + h / 2) * cell, w, h, x0: x0 * cell, y0: y0 * cell }
}

/* ================= Eiszapfen ================= */

/** Warnung: ein blauer Schatten waechst und pulsiert (k = 0..1 bis zum Fall) */
export function drawEiszapfenSchatten(ctx: CanvasRenderingContext2D, cells: P[], cell: number, k: number, now: number) {
  const r = rahmen(cells, cell)
  const p = 0.5 + 0.5 * Math.sin(now / (k > 0.7 ? 70 : 160))
  ctx.fillStyle = `rgba(30, 60, 110, ${0.18 + 0.3 * k + 0.1 * p})`
  ctx.beginPath()
  ctx.ellipse(r.mx, r.my, (r.w * cell * (0.3 + 0.45 * k)) / 1, (r.h * cell * (0.3 + 0.45 * k)) / 1.15, 0, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = `rgba(170, 220, 255, ${0.35 + 0.45 * p})`
  ctx.lineWidth = Math.max(1.5, cell * 0.06)
  ctx.setLineDash([cell * 0.14, cell * 0.1])
  ctx.strokeRect(r.x0 + 2, r.y0 + 2, r.w * cell - 4, r.h * cell - 4)
  ctx.setLineDash([])
}

/** Der Zapfen faellt (k = 0..1 bis zum Aufschlag): von oben, waechst mit der Naehe */
export function drawEiszapfenFall(ctx: CanvasRenderingContext2D, cells: P[], cell: number, k: number) {
  const r = rahmen(cells, cell)
  const hoch = (1 - k) * (1 - k) * cell * 5
  const s = 0.6 + 0.4 * k
  ctx.save()
  ctx.translate(r.mx, r.my - hoch)
  ctx.scale(s, s)
  for (const [dx, l, b] of [[-0.45, 1.3, 0.28], [0.05, 1.7, 0.34], [0.5, 1.1, 0.26]] as const) {
    ctx.fillStyle = '#DDF3FF'
    ctx.beginPath()
    ctx.moveTo((dx - b) * cell, -l * cell * 0.5)
    ctx.lineTo((dx + b) * cell, -l * cell * 0.5)
    ctx.lineTo(dx * cell, l * cell * 0.5)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = 'rgba(120, 180, 230, 0.7)'
    ctx.beginPath()
    ctx.moveTo(dx * cell, -l * cell * 0.5)
    ctx.lineTo((dx + b) * cell, -l * cell * 0.5)
    ctx.lineTo(dx * cell, l * cell * 0.5)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

/** Liegender Eisblock (2 x 2): Facetten, Glanz, beim Aufschlag kurz groesser (seit = ms seit dem Aufschlag) */
export function drawEisblock(ctx: CanvasRenderingContext2D, cells: P[], cell: number, seit: number) {
  const r = rahmen(cells, cell)
  const s = seit < 220 ? 1.12 - 0.12 * (seit / 220) : 1
  const w = r.w * cell * 0.9 * s
  const h = r.h * cell * 0.9 * s
  const x = r.mx - w / 2
  const y = r.my - h / 2
  ctx.fillStyle = 'rgba(20, 40, 70, 0.25)'
  ctx.fillRect(x + cell * 0.08, y + cell * 0.14, w, h)
  ctx.fillStyle = '#A8D8F5'
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = '#CFEBFB'
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + w, y)
  ctx.lineTo(x + w * 0.7, y + h * 0.35)
  ctx.lineTo(x + w * 0.2, y + h * 0.3)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#7FB8DE'
  ctx.beginPath()
  ctx.moveTo(x + w, y)
  ctx.lineTo(x + w, y + h)
  ctx.lineTo(x + w * 0.62, y + h * 0.7)
  ctx.lineTo(x + w * 0.7, y + h * 0.35)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.lineWidth = Math.max(1, cell * 0.05)
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2)
  ctx.beginPath()
  ctx.moveTo(x + w * 0.15, y + h * 0.55)
  ctx.lineTo(x + w * 0.35, y + h * 0.75)
  ctx.stroke()
}

/* ================= Risse im Eis ================= */

/** Risse (stufe 1: ein paar, 2: viele), zufaellig je Eisfeld (salz), fest fuer dasselbe Feld */
export function drawEisRisse(ctx: CanvasRenderingContext2D, cells: P[], cell: number, stufe: number, salz: number, o: P) {
  if (stufe <= 0) return
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const n = stufe >= 2 ? 0.75 : 0.35
  for (const k of cells) {
    // Zufall nach Weltfeld (bleibt gleich, wenn die Karte rutscht)
    const c = { x: k.x - o.x, y: k.y - o.y }
    if (h2(c.x, c.y, salz) > n) continue
    const ax = (k.x + 0.2 + h2(c.x, c.y, salz + 1) * 0.6) * cell
    const ay = (k.y + 0.2 + h2(c.x, c.y, salz + 2) * 0.6) * cell
    const arme = stufe >= 2 ? 4 : 2
    for (let i = 0; i < arme; i++) {
      let a = h2(c.x + i, c.y, salz + 3) * TAU
      let x = ax
      let y = ay
      ctx.strokeStyle = stufe >= 2 ? 'rgba(40, 80, 120, 0.75)' : 'rgba(70, 110, 150, 0.55)'
      ctx.lineWidth = Math.max(1, cell * (stufe >= 2 ? 0.045 : 0.03))
      ctx.beginPath()
      ctx.moveTo(x, y)
      const teile = stufe >= 2 ? 4 : 3
      for (let j = 0; j < teile; j++) {
        a += (h2(c.x, c.y + j, salz + i) - 0.5) * 1.4
        const l = cell * (0.16 + h2(c.x + j, c.y + i, salz) * 0.16)
        x += Math.cos(a) * l
        y += Math.sin(a) * l
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  }
}

/* ================= Schneesturm ================= */

/**
 * Schneesturm (Bildschirm): k = Ankuendigung 0..1 (Schnee wird dichter, Wind), voll = 0..1 Sicht weg (fast ganz weiss).
 * Wenige grosse Flaechen und Striche, kein Verlauf je Bild
 */
export function drawSchneesturm(ctx: CanvasRenderingContext2D, vw: number, vh: number, now: number, k: number, voll: number) {
  const dicht = Math.max(k * 0.55, voll)
  if (dicht <= 0) return
  ctx.fillStyle = `rgba(232, 240, 248, ${0.12 * k + 0.82 * voll})`
  ctx.fillRect(0, 0, vw, vh)
  // Schneestreifen, schraeg vom Wind
  const n = Math.round(30 + 90 * dicht)
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 + 0.4 * dicht})`
  ctx.lineWidth = 1.6
  ctx.beginPath()
  for (let i = 0; i < n; i++) {
    const sp = 0.4 + h2(i, 1) * 0.6
    const x = ((h2(i, 2) * vw * 1.4 + now * sp * 0.9) % (vw * 1.4)) - vw * 0.2
    const y = (h2(i, 3) * vh + now * sp * 0.35) % vh
    const l = 10 + 24 * dicht * sp
    ctx.moveTo(x, y)
    ctx.lineTo(x + l, y + l * 0.35)
  }
  ctx.stroke()
  ctx.fillStyle = `rgba(255, 255, 255, ${0.75})`
  for (let i = 0; i < n; i++) {
    const sp = 0.5 + h2(i, 4) * 0.5
    const x = ((h2(i, 5) * vw * 1.4 + now * sp * 0.7) % (vw * 1.4)) - vw * 0.2
    const y = (h2(i, 6) * vh + now * sp * 0.25) % vh
    ctx.fillRect(x, y, 2.5, 2.5)
  }
}

/* ================= Polarnacht mit Nordlicht ================= */

let streifen: HTMLCanvasElement | null = null
/** Ein senkrechter Lichtvorhang (einmal gezeichnet): unten hell gruen, nach oben tuerkis und lila, ausfransend */
function vorhang() {
  if (!streifen) {
    streifen = document.createElement('canvas')
    streifen.width = 8
    streifen.height = 256
    const c = streifen.getContext('2d')!
    const g = c.createLinearGradient(0, 256, 0, 0)
    g.addColorStop(0, 'rgba(120, 255, 170, 0)')
    g.addColorStop(0.06, 'rgba(140, 255, 180, 0.95)')
    g.addColorStop(0.3, 'rgba(70, 230, 190, 0.6)')
    g.addColorStop(0.65, 'rgba(90, 150, 255, 0.3)')
    g.addColorStop(0.88, 'rgba(190, 110, 255, 0.18)')
    g.addColorStop(1, 'rgba(190, 110, 255, 0)')
    c.fillStyle = g
    c.fillRect(0, 0, 8, 256)
  }
  return streifen
}

let himmel: HTMLCanvasElement | null = null
let himmelZeit = -1e9
/**
 * Nordlicht: drei Lichtvorhaenge, die sich langsam wellen, mit feinen Strahlen und wanderndem Schimmer (staerke 0..1).
 * Gerechnet wird klein (ein Viertel der Aufloesung, alle 60 ms neu, nur die oberen 60 %) aus Streifen eines fertigen Verlaufsbildes;
 * aufs Bild kommt es weich hochskaliert. Das kostet nur waehrend der seltenen Polarnacht etwas
 */
export function drawNordlicht(ctx: CanvasRenderingContext2D, vw: number, vh: number, now: number, staerke: number, ox: number) {
  if (staerke <= 0) return
  // Nur die oberen 60 %: dort haengen die Vorhaenge
  const W = Math.max(8, Math.ceil(vw / 4))
  const H = Math.max(8, Math.ceil((vh * 0.62) / 4))
  himmel ??= document.createElement('canvas')
  if (himmel.width !== W || himmel.height !== H) {
    himmel.width = W
    himmel.height = H
    himmelZeit = -1e9
  }
  if (Math.abs(now - himmelZeit) >= 60) {
    himmelZeit = now
    const c = himmel.getContext('2d')!
    c.globalCompositeOperation = 'source-over'
    c.clearRect(0, 0, W, H)
    c.globalCompositeOperation = 'lighter'
    const bild = vorhang()
    const S = Math.ceil(W / 3)
    const sw = W / S
    for (let r = 0; r < 3; r++) {
      const basis = H * (0.38 + r * 0.22)
      const hoehe = H * (0.44 - r * 0.08)
      for (let i = 0; i <= S; i++) {
        const u = i / S
        const wx = u * 5 + ox * 0.0015 + r * 1.3
        const welle = Math.sin(wx * 1.2 + now / (2900 + r * 800) + r * 2) * H * 0.07 + Math.sin(wx * 2.9 - now / (1900 + r * 500)) * H * 0.025
        // Schimmer wandert langsam entlang, dazu feine Strahlen
        const schimmer = 0.5 + 0.5 * Math.sin(wx * 2.1 - now / 900 + r * 1.7)
        const strahl = 0.75 + 0.25 * Math.sin(i * 1.7 + now / 260 + r) * Math.sin(i * 0.43 - now / 700)
        const h = hoehe * (0.7 + 0.3 * Math.sin(wx * 1.8 + now / 2500 + r))
        c.globalAlpha = (0.25 + 0.45 * schimmer) * strahl * (r === 0 ? 1 : 0.7)
        c.drawImage(bild, i * sw, basis + welle - h, sw * 1.6, h)
      }
    }
  }
  // Normal ueberblenden: auf dem dunklen Himmel sieht das wie Leuchten aus und ist viel billiger als 'lighter'
  ctx.save()
  ctx.globalAlpha = Math.min(1, staerke)
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(himmel, 0, 0, vw, vh * 0.62)
  ctx.restore()
}

/* ================= Tiere und Gestalten ================= */

/** Eisbaer von oben: weisser Koerper, Kopf mit Ohren und schwarzer Nase, Tatzen im Gang (lauf 0..1, -1 = steht) */
export function drawEisbaer(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, ang: number, lauf: number, s: number, a = 1) {
  if (s <= 0 || a <= 0) return
  const u = cell * 0.58 * s
  ctx.save()
  ctx.globalAlpha *= a
  ctx.fillStyle = 'rgba(20, 40, 70, 0.22)'
  ctx.beginPath()
  ctx.ellipse(x, y + cell * 0.12, u * 1.05, u * 0.6, 0, 0, TAU)
  ctx.fill()
  ctx.translate(x, y)
  ctx.rotate(ang)
  const schw = lauf >= 0 ? Math.sin(lauf * TAU) * u * 0.18 : 0
  ctx.fillStyle = '#E6EEF2'
  for (const [px, py, k] of [[0.45, -0.5, 1], [0.45, 0.5, -1], [-0.55, -0.5, -1], [-0.55, 0.5, 1]] as const) {
    ctx.beginPath()
    ctx.ellipse(px * u + schw * k, py * u, u * 0.2, u * 0.17, 0, 0, TAU)
    ctx.fill()
  }
  // Leicht cremefarben mit grauer Kontur, damit er sich vom Schnee abhebt
  ctx.fillStyle = '#F3EEDF'
  ctx.strokeStyle = 'rgba(95, 105, 115, 0.7)'
  ctx.lineWidth = Math.max(1, cell * 0.04)
  ctx.beginPath()
  ctx.ellipse(-u * 0.1, 0, u * 0.78, u * 0.55, 0, 0, TAU)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(u * 0.62, 0, u * 0.36, u * 0.32, 0, 0, TAU)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#DCE6EC'
  for (const sy of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(u * 0.5, sy * u * 0.3, u * 0.1, 0, TAU)
    ctx.fill()
  }
  ctx.fillStyle = '#1C2228'
  ctx.beginPath()
  ctx.arc(u * 0.96, 0, u * 0.08, 0, TAU)
  ctx.fill()
  for (const sy of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(u * 0.72, sy * u * 0.14, u * 0.045, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}

/** Robbe von oben: grau gefleckter Tropfen, Flossen, Schnurrhaare */
export function drawRobbe(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, ang: number, lauf: number, s: number, a = 1) {
  if (s <= 0 || a <= 0) return
  const u = cell * 0.5 * s
  ctx.save()
  ctx.globalAlpha *= a
  ctx.fillStyle = 'rgba(20, 40, 70, 0.2)'
  ctx.beginPath()
  ctx.ellipse(x, y + cell * 0.1, u * 0.95, u * 0.45, 0, 0, TAU)
  ctx.fill()
  ctx.translate(x, y)
  ctx.rotate(ang)
  const fl = lauf >= 0 ? Math.sin(lauf * TAU) * 0.4 : 0
  ctx.fillStyle = '#6F7C88'
  for (const sy of [-1, 1]) {
    ctx.save()
    ctx.translate(u * 0.1, sy * u * 0.38)
    ctx.rotate(sy * (0.6 + fl))
    ctx.beginPath()
    ctx.ellipse(0, sy * u * 0.12, u * 0.24, u * 0.1, 0, 0, TAU)
    ctx.fill()
    ctx.restore()
  }
  ctx.beginPath()
  ctx.moveTo(-u * 0.95, -u * 0.18)
  ctx.lineTo(-u * 0.95, u * 0.18)
  ctx.lineTo(-u * 0.55, 0)
  ctx.fill()
  ctx.fillStyle = '#8C98A4'
  ctx.beginPath()
  ctx.ellipse(0, 0, u * 0.7, u * 0.4, 0, 0, TAU)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(u * 0.62, 0, u * 0.27, 0, TAU)
  ctx.fill()
  ctx.fillStyle = 'rgba(60, 70, 80, 0.5)'
  for (const [px, py] of [[-0.3, -0.15], [0.05, 0.18], [-0.1, -0.05]] as const) {
    ctx.beginPath()
    ctx.arc(px * u, py * u, u * 0.07, 0, TAU)
    ctx.fill()
  }
  ctx.fillStyle = '#1C2228'
  for (const sy of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(u * 0.68, sy * u * 0.12, u * 0.05, 0, TAU)
    ctx.fill()
  }
  ctx.strokeStyle = 'rgba(240, 240, 240, 0.8)'
  ctx.lineWidth = Math.max(0.8, cell * 0.015)
  ctx.beginPath()
  for (const sy of [-1, 1]) {
    ctx.moveTo(u * 0.82, sy * u * 0.05)
    ctx.lineTo(u * 1.05, sy * u * 0.18)
  }
  ctx.stroke()
  ctx.restore()
}

/** Schneemann von oben: drei Kugeln, Kopf mit Karottennase und Hut, Aeste als Arme */
export function drawSchneemann(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, ang: number, s: number, a = 1) {
  if (s <= 0 || a <= 0) return
  const u = cell * 0.5 * s
  ctx.save()
  ctx.globalAlpha *= a
  ctx.fillStyle = 'rgba(20, 40, 70, 0.22)'
  ctx.beginPath()
  ctx.ellipse(x + u * 0.1, y + u * 0.2, u * 0.9, u * 0.8, 0, 0, TAU)
  ctx.fill()
  ctx.translate(x, y)
  ctx.strokeStyle = '#6A4A2A'
  ctx.lineWidth = Math.max(1, cell * 0.05)
  ctx.beginPath()
  ctx.moveTo(-u * 0.5, 0)
  ctx.lineTo(-u * 1.05, -u * 0.25)
  ctx.moveTo(u * 0.5, 0)
  ctx.lineTo(u * 1.05, -u * 0.3)
  ctx.stroke()
  for (const [r, f] of [[0.8, '#F4F8FB'], [0.58, '#FFFFFF'], [0.4, '#FFFFFF']] as const) {
    ctx.fillStyle = f
    ctx.beginPath()
    ctx.arc(0, (0.8 - r) * -u * 0.6, r * u, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = 'rgba(150, 180, 210, 0.6)'
    ctx.lineWidth = 1
    ctx.stroke()
  }
  ctx.fillStyle = '#26282C'
  ctx.beginPath()
  ctx.arc(0, -u * 0.25, u * 0.26, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#C0392B'
  ctx.fillRect(-u * 0.26, -u * 0.3, u * 0.52, u * 0.08)
  ctx.rotate(ang)
  ctx.fillStyle = '#F28C28'
  ctx.beginPath()
  ctx.moveTo(u * 0.25, -u * 0.07)
  ctx.lineTo(u * 0.6, 0)
  ctx.lineTo(u * 0.25, u * 0.07)
  ctx.fill()
  ctx.restore()
}

/** Yeti von oben: gross, zottelig weiss-blau, Arme schwingen, dunkles Gesicht mit Hoernern */
export function drawYeti(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, ang: number, lauf: number, s: number, a = 1, now = 0) {
  if (s <= 0 || a <= 0) return
  const u = cell * 0.72 * s
  ctx.save()
  ctx.globalAlpha *= a
  ctx.fillStyle = 'rgba(20, 40, 70, 0.25)'
  ctx.beginPath()
  ctx.ellipse(x, y + cell * 0.15, u * 1.05, u * 0.75, 0, 0, TAU)
  ctx.fill()
  ctx.translate(x, y)
  ctx.rotate(ang)
  const schw = lauf >= 0 ? Math.sin(lauf * TAU) * 0.5 : Math.sin(now / 400) * 0.1
  ctx.fillStyle = '#C8DCEA'
  for (const sy of [-1, 1]) {
    ctx.save()
    ctx.translate(u * 0.05, sy * u * 0.62)
    ctx.rotate(sy * schw)
    ctx.beginPath()
    ctx.ellipse(u * 0.25, 0, u * 0.42, u * 0.18, 0, 0, TAU)
    ctx.fill()
    ctx.restore()
  }
  // Zotteliger Koerper: Kreis mit Zacken
  ctx.fillStyle = '#EEF5FA'
  ctx.beginPath()
  for (let i = 0; i < 18; i++) {
    const w = (i / 18) * TAU
    const r = u * (i % 2 ? 0.66 : 0.76)
    ctx.lineTo(Math.cos(w) * r * 1.05, Math.sin(w) * r * 0.9)
  }
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(80, 110, 140, 0.75)'
  ctx.lineWidth = Math.max(1, cell * 0.045)
  ctx.stroke()
  ctx.fillStyle = '#D6E6F0'
  ctx.beginPath()
  ctx.ellipse(-u * 0.15, 0, u * 0.4, u * 0.35, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#4A6A8A'
  ctx.beginPath()
  ctx.ellipse(u * 0.55, 0, u * 0.24, u * 0.28, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#E8F0F6'
  for (const sy of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(u * 0.45, sy * u * 0.22)
    ctx.lineTo(u * 0.3, sy * u * 0.5)
    ctx.lineTo(u * 0.55, sy * u * 0.3)
    ctx.fill()
  }
  ctx.fillStyle = '#9FE3FF'
  for (const sy of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(u * 0.66, sy * u * 0.1, u * 0.05, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}

/** Schneeball (fliegt leicht huepfend) */
export function drawSchneeball(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, k: number) {
  const hoch = Math.sin(k * Math.PI) * cell * 0.08
  ctx.fillStyle = 'rgba(20, 40, 70, 0.22)'
  ctx.beginPath()
  ctx.ellipse(x, y + cell * 0.12, cell * 0.16, cell * 0.07, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#FFFFFF'
  ctx.beginPath()
  ctx.arc(x, y - hoch, cell * 0.17, 0, TAU)
  ctx.fill()
  ctx.fillStyle = 'rgba(170, 200, 225, 0.8)'
  ctx.beginPath()
  ctx.arc(x + cell * 0.05, y - hoch + cell * 0.05, cell * 0.08, 0, TAU)
  ctx.fill()
}

/** Iglu ueber einer Huette (2 x 2): Schneekuppel mit Bloecken und Eingang */
export function drawIglu(ctx: CanvasRenderingContext2D, cells: P[], cell: number) {
  const r = rahmen(cells, cell)
  const R = Math.min(r.w, r.h) * cell * 0.5
  ctx.fillStyle = 'rgba(20, 40, 70, 0.25)'
  ctx.beginPath()
  ctx.ellipse(r.mx + R * 0.1, r.my + R * 0.15, R * 1.02, R * 0.95, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#F2F7FB'
  ctx.beginPath()
  ctx.arc(r.mx, r.my, R * 0.96, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = 'rgba(150, 180, 210, 0.75)'
  ctx.lineWidth = Math.max(1, cell * 0.04)
  ctx.beginPath()
  for (const f of [0.35, 0.65]) ctx.arc(r.mx, r.my, R * 0.96 * f, 0, TAU)
  for (let i = 0; i < 8; i++) {
    const w = (i / 8) * TAU + 0.2
    ctx.moveTo(r.mx + Math.cos(w) * R * 0.35, r.my + Math.sin(w) * R * 0.35)
    ctx.lineTo(r.mx + Math.cos(w) * R * 0.96, r.my + Math.sin(w) * R * 0.96)
  }
  ctx.stroke()
  ctx.fillStyle = '#FFFFFF'
  ctx.beginPath()
  ctx.arc(r.mx - R * 0.25, r.my - R * 0.3, R * 0.25, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#1E3048'
  ctx.beginPath()
  ctx.ellipse(r.mx, r.my + R * 0.8, R * 0.3, R * 0.2, 0, 0, TAU)
  ctx.fill()
}

