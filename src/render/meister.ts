/**
 * Der Kaefigmeister (Mission 30) von oben: ein hagerer Gelehrter in langer dunkler Robe, der Kopf in einem grossen runden
 * Eisenkaefig, vor sich ein aufgeschlagenes Buch mit leuchtenden Runen. Dazu seine Angriffe (Ankuendigung rot, Strahlen
 * violett, Runenkreise), die Flammen im Raum, ihr Flug zu ihm und die Leiste unten. Spiellogik in game/kaefigboss.ts.
 */
import { MEISTER, type MeisterAngriff, type Meisterkampf } from '../game/meisterkampf'
import type { P } from '../game/types'

const TAU = Math.PI * 2
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const easeOut = (t: number) => 1 - (1 - t) * (1 - t)
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}
const RUNE = (a: number) => `rgba(196, 160, 255, ${a})`

/** Kleine Rune (ein Zeichen aus Strichen, je Nummer anders) */
function rune(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, n: number) {
  ctx.beginPath()
  ctx.moveTo(x, y - s)
  ctx.lineTo(x, y + s)
  const a = hash(n) > 0.5 ? 1 : -1
  ctx.moveTo(x, y - s * 0.4)
  ctx.lineTo(x + a * s * 0.7, y - s * (0.9 - hash(n + 3) * 0.6))
  if (hash(n + 7) > 0.4) {
    ctx.moveTo(x, y + s * 0.2)
    ctx.lineTo(x - a * s * 0.6, y + s * 0.7)
  }
  ctx.stroke()
}

/**
 * Der Kaefigmeister, Blick nach +x (winkel dreht). sicht: 0..1 (erscheinen, Teleport), laden: 0..1 (holt aus, das Buch
 * gluehen), blitz: 0..1 nach einem Flammentreffer, lachen: 0..1 (legt den Kopf in den Nacken, man sieht sein Gesicht im Kaefig)
 */
export function drawMeister(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, winkel: number, sicht: number, laden: number, blitz: number, now: number, reduce: boolean, lachen = 0) {
  if (sicht <= 0) return
  const u = cell * 0.9
  // Beim Lachen bebt er (Schultern zucken), statt zu schweben
  const beben = lachen > 0 && !reduce ? Math.abs(Math.sin(now / 95)) * cell * 0.05 * lachen : 0
  const schweb = (reduce ? 0 : Math.sin(now / 600) * cell * 0.04 * (1 - lachen)) - beben
  ctx.save()
  ctx.globalAlpha = sicht
  // Schatten und violetter Schein am Boden
  const sg = ctx.createRadialGradient(x, y, 0, x, y, u * 2)
  sg.addColorStop(0, RUNE(0.22 + 0.25 * laden))
  sg.addColorStop(1, RUNE(0))
  ctx.fillStyle = sg
  ctx.beginPath()
  ctx.arc(x, y, u * 2, 0, TAU)
  ctx.fill()
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
  ctx.beginPath()
  ctx.ellipse(x + u * 0.12, y + u * 0.25, u * 1.05, u * 0.9, 0, 0, TAU)
  ctx.fill()
  ctx.translate(x, y + schweb)
  ctx.rotate(winkel)
  ctx.scale(0.7 + 0.3 * sicht, 0.7 + 0.3 * sicht)
  // Robe: lang, nach hinten schleifend, mit Saum
  const rg = ctx.createRadialGradient(-u * 0.3, -u * 0.25, u * 0.1, -u * 0.1, 0, u * 1.1)
  rg.addColorStop(0, '#4A3A5C')
  rg.addColorStop(0.65, '#2E2240')
  rg.addColorStop(1, '#1A1226')
  ctx.fillStyle = rg
  ctx.beginPath()
  ctx.moveTo(u * 0.45, -u * 0.55)
  ctx.quadraticCurveTo(-u * 0.2, -u * 0.95, -u * 0.95, -u * 0.6)
  for (let i = 0; i <= 6; i++) {
    const a = -0.6 + (i / 6) * 1.2
    const r = u * (1 + (i % 2 ? 0.08 : 0) + (reduce ? 0 : Math.sin(now / 300 + i) * 0.03))
    ctx.lineTo(-Math.cos(a) * r, Math.sin(a) * r)
  }
  ctx.quadraticCurveTo(-u * 0.2, u * 0.95, u * 0.45, u * 0.55)
  ctx.closePath()
  ctx.fill()
  // Saum und Stola
  ctx.strokeStyle = '#8A6A3A'
  ctx.lineWidth = Math.max(1, u * 0.06)
  ctx.beginPath()
  ctx.moveTo(u * 0.3, -u * 0.45)
  ctx.lineTo(-u * 0.6, -u * 0.25)
  ctx.moveTo(u * 0.3, u * 0.45)
  ctx.lineTo(-u * 0.6, u * 0.25)
  ctx.stroke()
  // Arme halten das Buch vor der Brust
  ctx.strokeStyle = '#2E2240'
  ctx.lineWidth = u * 0.22
  ctx.lineCap = 'round'
  for (const sy of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(u * 0.1, sy * u * 0.5)
    ctx.quadraticCurveTo(u * 0.55, sy * u * 0.55, u * 0.72, sy * u * 0.28)
    ctx.stroke()
  }
  // Das Buch: aufgeschlagen, zwei Seiten, Runen gluehen (beim Ausholen hell)
  const bx = u * 0.82
  ctx.fillStyle = '#3B2414'
  ctx.fillRect(bx - u * 0.2, -u * 0.36, u * 0.4, u * 0.72)
  ctx.fillStyle = '#E9DCC0'
  ctx.fillRect(bx - u * 0.16, -u * 0.32, u * 0.32, u * 0.3)
  ctx.fillRect(bx - u * 0.16, u * 0.02, u * 0.32, u * 0.3)
  ctx.strokeStyle = RUNE(0.55 + 0.45 * laden)
  ctx.lineWidth = Math.max(0.8, u * 0.035)
  for (let i = 0; i < 4; i++) rune(ctx, bx - u * 0.07 + (i % 2) * u * 0.14, (i < 2 ? -0.17 : 0.17) * u, u * 0.07, i + Math.floor(now / 700))
  // Haende
  ctx.fillStyle = '#C9BFA8'
  for (const sy of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(u * 0.74, sy * u * 0.3, u * 0.1, 0, TAU)
    ctx.fill()
  }
  // Runen steigen aus dem Buch (beim Ausholen mehr)
  if (!reduce)
    for (let i = 0; i < 3 + Math.round(laden * 4); i++) {
      const k = (now / 1400 + hash(i)) % 1
      ctx.strokeStyle = RUNE(0.8 * (1 - k))
      rune(ctx, bx + u * (0.2 + k * 0.9), (hash(i + 5) - 0.5) * u * 1.2, u * 0.08, i * 3)
    }
  // Kopf im grossen Kaefig: dunkler Kopf, Augen glimmen, ein Ring und viele Staebe, oben ein Knauf.
  // Lacht er, liegt der Kopf im Nacken (nach hinten geschoben) und man sieht von vorn durch die Staebe sein Gesicht
  const kr = u * 0.52
  if (lachen > 0) {
    ctx.save()
    ctx.translate(-kr * 0.45 * lachen, 0)
    ctx.globalAlpha = sicht * lachen
    lachKopf(ctx, kr, winkel, now, reduce)
    ctx.restore()
    if (lachen >= 1) {
      ctx.restore()
      return
    }
    ctx.globalAlpha = sicht * (1 - lachen)
  }
  ctx.fillStyle = '#2A2420'
  ctx.beginPath()
  ctx.arc(0, 0, kr * 0.72, 0, TAU)
  ctx.fill()
  for (const sy of [-1, 1]) {
    const g = ctx.createRadialGradient(kr * 0.38, sy * kr * 0.25, 0, kr * 0.38, sy * kr * 0.25, kr * 0.4)
    g.addColorStop(0, `rgba(240, 225, 255, ${0.6 + 0.4 * laden})`)
    g.addColorStop(1, RUNE(0))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(kr * 0.38, sy * kr * 0.25, kr * 0.4, 0, TAU)
    ctx.fill()
  }
  ctx.strokeStyle = '#9C9890'
  ctx.lineWidth = Math.max(1.2, u * 0.06)
  ctx.beginPath()
  ctx.arc(0, 0, kr, 0, TAU)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, 0, kr * 0.6, 0, TAU)
  ctx.stroke()
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * kr * 0.15, Math.sin(a) * kr * 0.15)
    ctx.lineTo(Math.cos(a) * kr, Math.sin(a) * kr)
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(240, 236, 226, 0.6)'
  ctx.lineWidth = Math.max(0.8, u * 0.035)
  ctx.beginPath()
  ctx.arc(0, 0, kr, Math.PI * 1.05, Math.PI * 1.6)
  ctx.stroke()
  ctx.fillStyle = '#7C7870'
  ctx.beginPath()
  ctx.arc(0, 0, kr * 0.18, 0, TAU)
  ctx.fill()
  // Getroffen: weiss-orange aufblitzen
  if (blitz > 0) {
    ctx.globalAlpha = sicht * blitz * 0.8
    ctx.fillStyle = '#FFE2B0'
    ctx.beginPath()
    ctx.arc(0, 0, u * 1.05, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}

/** Der Kopf von vorn im Kaefig (er lacht, den Kopf im Nacken): fahles Gesicht mit zugekniffenen, gluehenden Augen und
 *  offenem Mund, davor senkrechte Staebe, die sich zum Rand hin woelben, ein Ring um die Mitte, oben der Knauf. Das Gesicht
 *  steht aufrecht im Bild (gegen die Drehung des Koerpers), damit man es erkennt */
function lachKopf(ctx: CanvasRenderingContext2D, kr: number, winkel: number, now: number, reduce: boolean) {
  ctx.rotate(-winkel)
  const r = kr * 1.12
  const ha = reduce ? 0 : Math.sin(now / 95) * r * 0.06
  // Kaefig hinten (dunkler Grund) und das Gesicht
  ctx.fillStyle = '#1C1714'
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#8F8473'
  ctx.beginPath()
  ctx.ellipse(0, r * 0.05, r * 0.66, r * 0.8, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = 'rgba(40, 30, 26, 0.35)'
  ctx.beginPath()
  ctx.ellipse(0, r * 0.35, r * 0.55, r * 0.42, 0, 0, Math.PI)
  ctx.fill()
  // Augen: zugekniffen vor Lachen, violett gluehend
  ctx.strokeStyle = RUNE(0.95)
  ctx.lineWidth = Math.max(1, r * 0.09)
  ctx.lineCap = 'round'
  for (const sx of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(sx * r * 0.27, -r * 0.12, r * 0.13, Math.PI * 1.1, Math.PI * 1.9)
    ctx.stroke()
  }
  // Offener Mund, bebt mit dem Lachen
  ctx.fillStyle = '#2A0E14'
  ctx.beginPath()
  ctx.ellipse(0, r * 0.33 + ha * 0.5, r * 0.28, r * 0.17 + Math.abs(ha), 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#D9D0BC'
  ctx.fillRect(-r * 0.18, r * 0.18 + ha * 0.5, r * 0.36, r * 0.06)
  // Staebe von vorn: senkrecht, zum Rand hin enger (wie auf einer Kugel), dazu der Ring um die Mitte
  ctx.strokeStyle = '#A9A49A'
  ctx.lineWidth = Math.max(1.2, r * 0.07)
  for (let i = -3; i <= 3; i++) {
    const sx = Math.sin((i / 3.6) * (Math.PI / 2)) * r
    const h = Math.sqrt(Math.max(0, r * r - sx * sx))
    ctx.beginPath()
    ctx.moveTo(sx, -h)
    ctx.quadraticCurveTo(sx * 1.08, 0, sx, h)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.ellipse(0, r * 0.02, r, r * 0.22, 0, 0, Math.PI)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, TAU)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(240, 236, 226, 0.55)'
  ctx.lineWidth = Math.max(0.8, r * 0.035)
  ctx.beginPath()
  ctx.arc(0, 0, r, Math.PI * 1.1, Math.PI * 1.55)
  ctx.stroke()
  // Knauf oben
  ctx.fillStyle = '#7C7870'
  ctx.beginPath()
  ctx.arc(0, -r * 1.02, r * 0.14, 0, TAU)
  ctx.fill()
}

/** Erscheinen und Verschwinden: ein Runenkreis am Boden und violetter Rauch (k = 0..1) */
export function drawMeisterKreis(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, k: number, now: number) {
  if (k <= 0 || k >= 1) return
  const r = cell * (0.8 + 1.4 * easeOut(k))
  ctx.save()
  ctx.globalAlpha = 1 - k
  ctx.strokeStyle = RUNE(0.9)
  ctx.lineWidth = Math.max(1.5, cell * 0.08)
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
  ctx.stroke()
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + now / 900
    rune(ctx, x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75, cell * 0.12, i)
  }
  ctx.restore()
}

/** Ankuendigung (rot) und der Angriff selbst: Strahl violett, Runenkreise platzen */
export function drawMeisterAngriff(ctx: CanvasRenderingContext2D, a: MeisterAngriff, von: P, cell: number, now: number, reduce: boolean) {
  if (a.art === 'teleport') return
  ctx.save()
  if (now < a.los) {
    const k = clamp01((now - a.ab) / Math.max(1, a.los - a.ab))
    const puls = reduce ? 0.5 : 0.5 + 0.5 * Math.sin(now / 70)
    ctx.fillStyle = `rgba(229, 70, 59, ${0.16 + 0.24 * k + 0.08 * puls})`
    for (const c of a.cells) ctx.fillRect(c.x * cell + 1, c.y * cell + 1, cell - 2, cell - 2)
    if (a.art === 'aoe') {
      ctx.strokeStyle = `rgba(255, 210, 200, ${0.4 + 0.4 * k})`
      ctx.lineWidth = Math.max(1, cell * 0.07)
      for (const m of a.kreise) {
        ctx.beginPath()
        ctx.arc((m.x + 0.5) * cell, (m.y + 0.5) * cell, cell * 1.4 * (1 - 0.3 * k), 0, TAU)
        ctx.stroke()
        rune(ctx, (m.x + 0.5) * cell, (m.y + 0.5) * cell, cell * 0.35, m.x * 7 + m.y)
      }
    } else {
      // Helle Linie waechst zum Ende: so lange laedt er noch
      const e = a.cells[a.cells.length - 1]
      if (e) {
        ctx.strokeStyle = `rgba(255, 210, 200, ${0.35 + 0.45 * k})`
        ctx.lineWidth = Math.max(1, cell * (a.art === 'dick' ? 0.14 : 0.08))
        ctx.setLineDash([cell * 0.25, cell * 0.2])
        ctx.lineDashOffset = reduce ? 0 : -now / 30
        const ax = (von.x + 0.5) * cell
        const ay = (von.y + 0.5) * cell
        ctx.beginPath()
        ctx.moveTo(ax, ay)
        ctx.lineTo(ax + ((e.x + 0.5) * cell - ax) * k, ay + ((e.y + 0.5) * cell - ay) * k)
        ctx.stroke()
      }
    }
  } else if (now < a.bis) {
    const f = 1 - clamp01((now - a.los) / Math.max(1, a.bis - a.los))
    if (a.art === 'aoe') {
      for (const c of a.cells) {
        ctx.fillStyle = RUNE(0.75 * f)
        ctx.fillRect(c.x * cell, c.y * cell, cell, cell)
      }
      ctx.fillStyle = `rgba(255, 255, 255, ${0.6 * f})`
      for (const m of a.kreise) {
        ctx.beginPath()
        ctx.arc((m.x + 0.5) * cell, (m.y + 0.5) * cell, cell * 0.9, 0, TAU)
        ctx.fill()
      }
    } else {
      for (const c of a.cells) {
        ctx.fillStyle = RUNE(0.55 * f)
        ctx.fillRect(c.x * cell, c.y * cell, cell, cell)
      }
      const e = a.cells[a.cells.length - 1]
      if (e) {
        const ax = (von.x + 0.5) * cell
        const ay = (von.y + 0.5) * cell
        const ex = (e.x + 0.5) * cell
        const ey = (e.y + 0.5) * cell
        ctx.lineCap = 'round'
        ctx.strokeStyle = RUNE(0.85 * f)
        ctx.lineWidth = cell * (a.art === 'dick' ? 1.6 : 0.5)
        ctx.beginPath()
        ctx.moveTo(ax, ay)
        ctx.lineTo(ex, ey)
        ctx.stroke()
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.9 * f})`
        ctx.lineWidth = cell * (a.art === 'dick' ? 0.5 : 0.16)
        ctx.stroke()
      }
    }
  }
  ctx.restore()
}

/** Flamme am Boden (zum Einsammeln): flackert, warmer Schein */
export function drawMeisterFlamme(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, auf: number, now: number, reduce: boolean) {
  if (auf <= 0) return
  const s = cell * 0.42 * auf
  const f = reduce ? 0 : Math.sin(now / 90 + x) * 0.08
  ctx.save()
  const g = ctx.createRadialGradient(x, y, 0, x, y, s * 2.6)
  g.addColorStop(0, 'rgba(255, 170, 70, 0.5)')
  g.addColorStop(1, 'rgba(255, 120, 40, 0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, s * 2.6, 0, TAU)
  ctx.fill()
  const zunge = (r: number, farbe: string) => {
    ctx.fillStyle = farbe
    ctx.beginPath()
    ctx.moveTo(x, y - r * (1.25 + f))
    ctx.quadraticCurveTo(x + r * 0.85, y - r * 0.1, x + r * 0.55, y + r * 0.55)
    ctx.quadraticCurveTo(x, y + r * 0.95, x - r * 0.55, y + r * 0.55)
    ctx.quadraticCurveTo(x - r * 0.85, y - r * 0.1, x, y - r * (1.25 + f))
    ctx.fill()
  }
  zunge(s, '#E8572A')
  zunge(s * 0.7, '#FFA53D')
  zunge(s * 0.4, '#FFF0B0')
  ctx.restore()
}

/** Flamme im Flug: im Bogen vom Einsammeln zu ihm (k = 0..1) */
export function drawMeisterFlug(ctx: CanvasRenderingContext2D, von: P, nach: P, k: number, cell: number, now: number) {
  if (k >= 1) return
  const e = easeOut(clamp01(k))
  const ax = (von.x + 0.5) * cell
  const ay = (von.y + 0.5) * cell
  const bx = (nach.x + 0.5) * cell
  const by = (nach.y + 0.5) * cell
  const hoch = Math.sin(e * Math.PI) * cell * 2
  const x = ax + (bx - ax) * e
  const y = ay + (by - ay) * e - hoch
  // Schweif
  ctx.save()
  for (let i = 1; i <= 5; i++) {
    const t = Math.max(0, e - i * 0.05)
    ctx.fillStyle = `rgba(255, 160, 60, ${0.35 - i * 0.06})`
    ctx.beginPath()
    ctx.arc(ax + (bx - ax) * t, ay + (by - ay) * t - Math.sin(t * Math.PI) * cell * 2, cell * (0.3 - i * 0.04), 0, TAU)
    ctx.fill()
  }
  ctx.restore()
  drawMeisterFlamme(ctx, x, y, cell * 0.9, 1, now, false)
}

function rundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/** Leiste unten: Name, drei Leben, darunter die Flammen dieses Lebens (x / 5) */
export function drawMeisterHud(ctx: CanvasRenderingContext2D, g: Meisterkampf, vw: number, vh: number, now: number) {
  const M = g.meister
  const w = Math.min(220, vw * 0.48)
  const x0 = (vw - w) / 2
  const y0 = vh - 40
  ctx.save()
  ctx.font = '800 12px "Libre Franklin", system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  // Wo er ist, verraet die Leiste nicht: man muss ihn suchen
  const ort = M.zustand === 'tot' ? 'BESIEGT' : M.zustand === 'kampf' ? 'GEFUNDEN' : 'IRGENDWO …'
  const name = `KÄFIGMEISTER · ${ort}`
  ctx.fillStyle = 'rgba(23, 21, 19, 0.75)'
  ctx.fillText(name, vw / 2 + 1, y0 + 11)
  ctx.fillStyle = '#E6DAFF'
  ctx.fillText(name, vw / 2, y0 + 10)
  const by = y0 + 16
  const bh = 10
  ctx.fillStyle = 'rgba(23, 21, 19, 0.8)'
  rundRect(ctx, x0 - 3, by - 3, w + 6, bh + 6, 7)
  ctx.fill()
  const n = MEISTER.leben
  const teil = (w - 4 * (n - 1)) / n
  for (let i = 0; i < n; i++) {
    const voll = i < M.leben
    const x = x0 + i * (teil + 4)
    // Das aktuelle Leben schrumpft mit jeder Flamme
    const anteil = voll && i === M.leben - 1 ? 1 - M.treffer / g.flammenJeLeben : voll ? 1 : 0
    ctx.fillStyle = 'rgba(245, 239, 230, 0.12)'
    rundRect(ctx, x, by, teil, bh, 4)
    ctx.fill()
    if (anteil > 0) {
      ctx.fillStyle = now - M.trefferT < 250 ? '#FFE2B0' : '#9A6BFF'
      rundRect(ctx, x, by, Math.max(4, teil * anteil), bh, 4)
      ctx.fill()
    }
  }
  // Links: Flammen dieses Lebens
  ctx.fillStyle = 'rgba(23, 21, 19, 0.6)'
  rundRect(ctx, 10, by - 6, 22 + g.flammenJeLeben * 13, bh + 12, 10)
  ctx.fill()
  for (let i = 0; i < g.flammenJeLeben; i++) {
    ctx.fillStyle = i < M.treffer ? '#FF9A3D' : 'rgba(245, 239, 230, 0.2)'
    ctx.beginPath()
    ctx.arc(22 + i * 13, by + bh / 2, 4.5, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}
