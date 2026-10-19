/**
 * Zeichnungen fuer das Spielfeld (Canvas). Mauer und Teich stammen aus dem
 * Snake im Hero-Telefon, Apfel, Giftapfel, Falle, Wolke, Frosch, Baum, Haus und Turm sind neu.
 * Alle Funktionen zeichnen um die Feldmitte (x, y) bzw. die linke obere Ecke.
 */
import type { Dir, P } from '../game/types'

export const C = {
  hell: '#B4E3C1',
  dunkel: '#A5D7B3',
  neuHell: '#C3EBCD',
  kopf: [47, 143, 116] as const,
  schwanz: [18, 66, 55] as const,
  giftKopf: [126, 116, 60] as const,
  giftSchwanz: [70, 52, 70] as const,
  mauer: '#1C5446',
  mauerHell: '#2C7A64',
  wasser: '#3F93B5',
  wasserHell: '#7CC3DD',
  wasserTief: '#2B6F8C',
  fuge: 'rgba(168, 218, 181, 0.32)',
  stiel: '#6B4A2A',
  blatt: '#4FA65A',
  blattTief: '#2F7A3E',
  schatten: 'rgba(12, 40, 32, 0.22)',
}

export const backOut = (t: number) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2)
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
export const clamp01 = (t: number) => Math.min(1, Math.max(0, t))

export function rund(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Farben der Apfel-Stufen (Wert x1, x2, x3 ...) je [hell, mitte, tief].
 *  Rot, Orange, Gelb, Gruen, Tuerkis, Blau, Lila, Rosa, dann Uebergaenge Blau-Rosa und Lila-Rosa */
type Farbe = readonly [string, string, string]
const ROT_: Farbe = ['#FF7A66', '#E5463B', '#A3241D']
const ORANGE: Farbe = ['#FFB36B', '#F28A2E', '#B35A10']
const GELB: Farbe = ['#FFF19A', '#F5CF2E', '#B08A0C']
const GRUEN: Farbe = ['#B4F08A', '#5DBF3A', '#2C7419']
const TUERKIS: Farbe = ['#9AF2E4', '#25BFAA', '#11756B']
const BLAU: Farbe = ['#93C6FF', '#3A80E6', '#1B4896']
const LILA: Farbe = ['#CFA6FF', '#8D52E0', '#512996']
const ROSA: Farbe = ['#FFB8DD', '#F06AB0', '#AD3677']
export const APFEL_STUFEN: readonly (readonly Farbe[])[] = [[ROT_], [ORANGE], [GELB], [GRUEN], [TUERKIS], [BLAU], [LILA], [ROSA], [BLAU, ROSA], [LILA, ROSA]]
/** Farben fuer eine Stufe (ab der letzten bleibt es bei Lila-Rosa) */
export const apfelFarben = (stufe: number) => APFEL_STUFEN[Math.min(APFEL_STUFEN.length, Math.max(1, Math.floor(stufe))) - 1]
/** Farbe fuer Anzeigen (Pfeil, Minikarte, Funken) */
export const apfelFarbe = (stufe: number, i = 0) => {
  const f = apfelFarben(stufe)
  return f[Math.min(i, f.length - 1)][1]
}
export const apfelPartikel = (stufe: number) => {
  const f = apfelFarben(stufe)
  return [f[0][1], f[f.length - 1][0], '#F5EFE6', C.blatt, f[f.length - 1][1]]
}

/** Apfelform (ohne Fuellung): zwei Backen, oben eine kleine Delle */
function apfelPfad(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x, y - r * 0.62)
  ctx.bezierCurveTo(x + r * 0.35, y - r * 1.02, x + r * 1.08, y - r * 0.92, x + r * 1.0, y - r * 0.05)
  ctx.bezierCurveTo(x + r * 0.95, y + r * 0.62, x + r * 0.55, y + r * 1.0, x + r * 0.22, y + r * 0.94)
  ctx.bezierCurveTo(x + r * 0.08, y + r * 0.9, x - r * 0.08, y + r * 0.9, x - r * 0.22, y + r * 0.94)
  ctx.bezierCurveTo(x - r * 0.55, y + r * 1.0, x - r * 0.95, y + r * 0.62, x - r * 1.0, y - r * 0.05)
  ctx.bezierCurveTo(x - r * 1.08, y - r * 0.92, x - r * 0.35, y - r * 1.02, x, y - r * 0.62)
  ctx.closePath()
}

/** Apfel mit Stiel, Blatt und Glanz. s = Ploppen (0 bis 1+), wipp = leichtes Wippen,
 *  schimmel = Winkel der verschimmelten Ecke (Giftapfel), stufe = Wert (Farbe) */
export function drawApfel(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, s: number, wipp = 0, schimmel?: number, stufe = 1) {
  if (s <= 0) return
  const r = cell * 0.36 * s
  y += cell * 0.04
  // Schatten am Boden
  ctx.fillStyle = C.schatten
  ctx.beginPath()
  ctx.ellipse(x, y + r * 0.95, r * 0.85, r * 0.25, 0, 0, Math.PI * 2)
  ctx.fill()
  y -= wipp
  // Koerper: eine Farbe mit Licht und Schatten, oder ein Uebergang zwischen zwei Farben
  const f = apfelFarben(stufe)
  apfelPfad(ctx, x, y, r)
  if (f.length === 1) {
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r * 1.15)
    g.addColorStop(0, f[0][0])
    g.addColorStop(0.45, f[0][1])
    g.addColorStop(1, f[0][2])
    ctx.fillStyle = g
    ctx.fill()
  } else {
    const lg = ctx.createLinearGradient(x - r, y - r, x + r, y + r)
    lg.addColorStop(0.1, f[0][1])
    lg.addColorStop(0.9, f[1][1])
    ctx.fillStyle = lg
    ctx.fill()
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r * 1.15)
    g.addColorStop(0, 'rgba(255, 255, 255, 0.45)')
    g.addColorStop(0.45, 'rgba(255, 255, 255, 0)')
    g.addColorStop(0.7, 'rgba(0, 0, 0, 0)')
    g.addColorStop(1, 'rgba(40, 0, 40, 0.38)')
    ctx.fillStyle = g
    ctx.fill()
  }

  // Verschimmelte Ecke (Giftapfel): im Apfel abgeschnitten, an einer Seite
  if (schimmel !== undefined) {
    ctx.save()
    apfelPfad(ctx, x, y, r)
    ctx.clip()
    const mx = x + Math.cos(schimmel) * r * 0.72
    const my = y + Math.sin(schimmel) * r * 0.72
    // brauner Faulrand
    const fr = ctx.createRadialGradient(mx, my, 0, mx, my, r * 0.75)
    fr.addColorStop(0, 'rgba(92, 70, 38, 0.95)')
    fr.addColorStop(0.55, 'rgba(120, 78, 40, 0.75)')
    fr.addColorStop(1, 'rgba(120, 60, 40, 0)')
    ctx.fillStyle = fr
    ctx.beginPath()
    ctx.arc(mx, my, r * 0.75, 0, Math.PI * 2)
    ctx.fill()
    // Schimmelfleck: graugruen, unregelmaessig
    ctx.fillStyle = '#8E9A62'
    for (let i = 0; i < 6; i++) {
      const a = schimmel + i * 1.05
      const d = r * (0.12 + (i % 3) * 0.1)
      ctx.beginPath()
      ctx.arc(mx + Math.cos(a) * d, my + Math.sin(a) * d, r * (0.2 - (i % 2) * 0.05), 0, Math.PI * 2)
      ctx.fill()
    }
    // Flaum: helle Punkte
    ctx.fillStyle = 'rgba(236, 240, 220, 0.9)'
    for (let i = 0; i < 7; i++) {
      const a = schimmel * 1.7 + i * 2.4
      const d = r * (0.05 + ((i * 37) % 10) / 30)
      ctx.beginPath()
      ctx.arc(mx + Math.cos(a) * d, my + Math.sin(a) * d, r * 0.06, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  // Glanz
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
  ctx.beginPath()
  ctx.ellipse(x - r * 0.45, y - r * 0.28, r * 0.16, r * 0.26, -0.5, 0, Math.PI * 2)
  ctx.fill()
  // Stiel
  ctx.strokeStyle = C.stiel
  ctx.lineWidth = Math.max(1.5, r * 0.14)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x, y - r * 0.55)
  ctx.quadraticCurveTo(x + r * 0.05, y - r * 0.95, x + r * 0.22, y - r * 1.12)
  ctx.stroke()
  // Blatt
  ctx.save()
  ctx.translate(x + r * 0.12, y - r * 0.92)
  ctx.rotate(-0.5)
  const bg = ctx.createLinearGradient(0, -r * 0.2, r * 0.7, r * 0.2)
  bg.addColorStop(0, C.blatt)
  bg.addColorStop(1, C.blattTief)
  ctx.fillStyle = bg
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(r * 0.35, -r * 0.32, r * 0.72, -r * 0.05)
  ctx.quadraticCurveTo(r * 0.35, r * 0.22, 0, 0)
  ctx.fill()
  ctx.restore()
}

/** Mauerstein: Feld in Tanne mit hellerer Oberkante und Fugen, s = Ploppen 0 bis 1 */
export function drawStein(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, s: number) {
  if (s <= 0) return
  const sz = cell * 0.92 * s
  const ox = x + (cell - sz) / 2
  const oy = y + (cell - sz) / 2
  const r = cell * 0.16 * s
  ctx.fillStyle = C.schatten
  rund(ctx, ox, oy + cell * 0.1, sz, sz, r)
  ctx.fill()
  ctx.fillStyle = C.mauer
  rund(ctx, ox, oy, sz, sz, r)
  ctx.fill()
  ctx.fillStyle = C.mauerHell
  rund(ctx, ox, oy, sz, sz * 0.32, r)
  ctx.fill()
  ctx.strokeStyle = C.fuge
  ctx.lineWidth = Math.max(1, cell * 0.05)
  ctx.beginPath()
  ctx.moveTo(ox + sz * 0.08, oy + sz * 0.55)
  ctx.lineTo(ox + sz * 0.92, oy + sz * 0.55)
  ctx.moveTo(ox + sz * 0.5, oy + sz * 0.12)
  ctx.lineTo(ox + sz * 0.5, oy + sz * 0.55)
  ctx.moveTo(ox + sz * 0.28, oy + sz * 0.55)
  ctx.lineTo(ox + sz * 0.28, oy + sz * 0.9)
  ctx.moveTo(ox + sz * 0.74, oy + sz * 0.55)
  ctx.lineTo(ox + sz * 0.74, oy + sz * 0.9)
  ctx.stroke()
}

/** Teich: zusammenhaengende Felder Wasser mit hellem Ufer und leichten Wellen */
export function drawTeich(ctx: CanvasRenderingContext2D, cells: P[], cell: number, s: number, now: number) {
  if (s <= 0 || !cells.length) return
  const sz = cell * 0.94 * s
  const off = (cell - sz) / 2
  const r = cell * 0.36 * s
  const ufer = sz * 0.1
  const set = new Set(cells.map((c) => c.x * 10000 + c.y))
  const paare: [P, P][] = []
  for (const a of cells) {
    if (set.has((a.x + 1) * 10000 + a.y)) paare.push([a, { x: a.x + 1, y: a.y }])
    if (set.has(a.x * 10000 + a.y + 1)) paare.push([a, { x: a.x, y: a.y + 1 }])
  }
  const ys = cells.map((c) => c.y)
  const grad = ctx.createLinearGradient(0, Math.min(...ys) * cell, 0, (Math.max(...ys) + 1) * cell)
  grad.addColorStop(0, C.wasser)
  grad.addColorStop(1, C.wasserTief)
  for (const [fill, i] of [[C.wasserHell, 0], [grad, ufer]] as const) {
    ctx.fillStyle = fill
    for (const c of cells) {
      rund(ctx, c.x * cell + off + i, c.y * cell + off + i, sz - 2 * i, sz - 2 * i, Math.max(0, r - i * 0.6))
      ctx.fill()
    }
    for (const [a, b] of paare) {
      const quer = b.x !== a.x
      const x = quer ? (a.x + 0.5) * cell : a.x * cell + off + i
      const y = quer ? a.y * cell + off + i : (a.y + 0.5) * cell
      ctx.fillRect(x, y, quer ? cell : sz - 2 * i, quer ? sz - 2 * i : cell)
    }
    // Viererblock: Loch in der Mitte schliessen
    for (const a of cells)
      if (set.has((a.x + 1) * 10000 + a.y) && set.has(a.x * 10000 + a.y + 1) && set.has((a.x + 1) * 10000 + a.y + 1))
        ctx.fillRect((a.x + 0.5) * cell, (a.y + 0.5) * cell, cell, cell)
  }
  const w = Math.sin(now / 600) * sz * 0.04
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)'
  ctx.lineWidth = Math.max(1, cell * 0.05)
  ctx.lineCap = 'round'
  cells.forEach((c, k) => {
    const [fy, fx] = k % 2 ? [0.62, 0.4] : [0.42, 0.3]
    const wx = c.x * cell + off + sz * fx + w
    const wy = c.y * cell + off + sz * fy
    ctx.beginPath()
    ctx.moveTo(wx, wy)
    ctx.quadraticCurveTo(wx + sz * 0.08, wy - sz * 0.07, wx + sz * 0.16, wy)
    ctx.quadraticCurveTo(wx + sz * 0.24, wy + sz * 0.07, wx + sz * 0.32, wy)
    ctx.stroke()
  })
}

/** Baerenfalle von oben: zwei halbrunde Stahlbuegel mit grossen Zaehnen, seitlich die Federn, in der
 *  Mitte die Trittplatte, eine Kette mit Pflock. zu = 0 offen bis 1 zugeschnappt (die Buegel klappen
 *  hoch und die Zaehne greifen in der Mitte ineinander), s = Ploppen, warn = Warnschein */
export function drawFalle(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, s: number, zu = 0, warn = 0) {
  if (s <= 0) return
  const R = cell * 0.42 * s
  ctx.save()
  ctx.translate(x, y)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (warn > 0) {
    ctx.fillStyle = `rgba(242, 119, 76, ${0.3 * warn})`
    ctx.beginPath()
    ctx.arc(0, 0, R * 1.3, 0, Math.PI * 2)
    ctx.fill()
  }
  // Schatten
  ctx.fillStyle = 'rgba(12, 40, 32, 0.3)'
  ctx.beginPath()
  ctx.ellipse(0, R * 0.16, R * 1.15, R * 0.9, 0, 0, Math.PI * 2)
  ctx.fill()
  // Kette mit Pflock (unten rechts)
  ctx.strokeStyle = '#6B7076'
  ctx.lineWidth = Math.max(1, R * 0.07)
  for (let i = 0; i < 4; i++) {
    ctx.beginPath()
    ctx.ellipse(R * (0.55 + i * 0.16), R * (0.62 + i * 0.12), R * 0.09, R * 0.055, 0.6 + (i % 2) * 1.2, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.fillStyle = '#8A5A33'
  ctx.beginPath()
  ctx.arc(R * 1.18, R * 1.08, R * 0.12, 0, Math.PI * 2)
  ctx.fill()
  // Federn links und rechts (Buegel mit Windungen)
  for (const sx of [-1, 1]) {
    ctx.fillStyle = '#4A4F55'
    rund(ctx, sx > 0 ? R * 0.55 : -R * 1.25, -R * 0.13, R * 0.7, R * 0.26, R * 0.12)
    ctx.fill()
    ctx.strokeStyle = '#9AA1A8'
    ctx.lineWidth = Math.max(1, R * 0.05)
    for (let i = 0; i < 4; i++) {
      const fx = sx * R * (0.68 + i * 0.13)
      ctx.beginPath()
      ctx.moveTo(fx, -R * 0.12)
      ctx.lineTo(fx + sx * R * 0.06, R * 0.12)
      ctx.stroke()
    }
  }
  // Grundring
  ctx.strokeStyle = '#3A3F44'
  ctx.lineWidth = R * 0.12
  ctx.beginPath()
  ctx.arc(0, 0, R * 0.62, 0, Math.PI * 2)
  ctx.stroke()
  // Zwei Buegel (oben, unten): beim Zuschnappen klappen sie hoch, von oben werden sie flacher
  const h = 1 - zu * 0.9
  for (const sy of [-1, 1]) {
    ctx.save()
    ctx.scale(1, h)
    // Buegel
    const g = ctx.createLinearGradient(0, sy * R * 0.4, 0, sy * R * 1.0)
    g.addColorStop(0, '#C9CFD5')
    g.addColorStop(1, '#5F666D')
    ctx.strokeStyle = g
    ctx.lineWidth = R * 0.2
    ctx.beginPath()
    ctx.arc(0, 0, R * 0.86, sy < 0 ? Math.PI : 0, sy < 0 ? Math.PI * 2 : Math.PI)
    ctx.stroke()
    // Grosse Zaehne nach innen, hell mit dunklem Rand
    ctx.fillStyle = '#F2F4F6'
    ctx.strokeStyle = '#2A2D31'
    ctx.lineWidth = Math.max(1, R * 0.05)
    for (let i = 0; i < 7; i++) {
      const a = (sy < 0 ? Math.PI : 0) + (Math.PI * (i + 0.5)) / 7
      const ox = Math.cos(a) * R * 0.78
      const oy = Math.sin(a) * R * 0.78
      const ix = Math.cos(a) * R * (0.42 - zu * 0.4)
      const iy = Math.sin(a) * R * (0.42 - zu * 0.4)
      const px = -Math.sin(a) * R * 0.13
      const py = Math.cos(a) * R * 0.13
      ctx.beginPath()
      ctx.moveTo(ox + px, oy + py)
      ctx.lineTo(ix, iy)
      ctx.lineTo(ox - px, oy - py)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
    ctx.restore()
  }
  // Trittplatte (Koeder-Platte) in der Mitte
  if (zu < 0.6) {
    ctx.globalAlpha *= 1 - zu / 0.6
    ctx.fillStyle = '#C9A253'
    ctx.strokeStyle = '#7A5A22'
    ctx.lineWidth = Math.max(1, R * 0.05)
    ctx.beginPath()
    ctx.arc(0, 0, R * 0.26, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.beginPath()
    ctx.arc(-R * 0.08, -R * 0.08, R * 0.08, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/** Giftwolke: weiche, gelbgruene Schwaden je Feld, leicht wabernd. a = Deckkraft */
export function drawWolkenFeld(ctx: CanvasRenderingContext2D, cx: number, cy: number, cell: number, s: number, a: number, now: number, seed: number) {
  if (s <= 0 || a <= 0) return
  const wob = Math.sin(now / 520 + seed) * cell * 0.06
  const wob2 = Math.cos(now / 610 + seed * 1.7) * cell * 0.06
  const r = cell * 0.78 * s
  const g = ctx.createRadialGradient(cx + wob, cy + wob2, 0, cx + wob, cy + wob2, r)
  g.addColorStop(0, `rgba(170, 196, 52, ${0.82 * a})`)
  g.addColorStop(0.55, `rgba(138, 170, 40, ${0.55 * a})`)
  g.addColorStop(1, 'rgba(120, 150, 40, 0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx + wob, cy + wob2, r, 0, Math.PI * 2)
  ctx.fill()
  // dunklere Schliere
  ctx.fillStyle = `rgba(205, 225, 110, ${0.3 * a})`
  ctx.beginPath()
  ctx.arc(cx - wob * 1.4 + cell * 0.12, cy + wob * 0.8 - cell * 0.08, r * 0.32, 0, Math.PI * 2)
  ctx.fill()
}

/** Kleine Blasen und ein Totenkopf-Hauch in der Mitte der Wolke */
export function drawWolkenKern(ctx: CanvasRenderingContext2D, cx: number, cy: number, cell: number, a: number, now: number) {
  if (a <= 0) return
  ctx.fillStyle = `rgba(230, 240, 180, ${0.55 * a})`
  for (let i = 0; i < 4; i++) {
    const t = ((now / 1400 + i / 4) % 1)
    const bx = cx + Math.sin(i * 2.1 + now / 800) * cell * 0.3
    const by = cy + cell * 0.3 - t * cell * 0.7
    ctx.globalAlpha = (1 - t) * a
    ctx.beginPath()
    ctx.arc(bx, by, cell * (0.05 + 0.03 * (i % 2)), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

const ROT: Record<Dir, number> = { r: 0, d: Math.PI / 2, l: Math.PI, u: -Math.PI / 2 }

/** Liegende Tanne (1-1-3-1): Stamm mit Schnittflaeche, Krone als Dreieck in drei
 *  Lagen, symmetrisch. Gezeichnet entlang `dir`. `kipp` (0 bis 1) = beim Umfallen: so weit
 *  ist sie von oben gesehen schon ausgestreckt (am Stammende festgehalten) */
export function drawBaum(ctx: CanvasRenderingContext2D, root: P, dir: Dir, cell: number, s: number, kipp = 1) {
  if (s <= 0 || kipp <= 0) return
  const u = cell
  ctx.save()
  ctx.translate((root.x + 0.5) * u, (root.y + 0.5) * u)
  ctx.rotate(ROT[dir])
  if (kipp < 1) {
    ctx.translate(-0.45 * u, 0)
    ctx.scale(kipp, 1)
    ctx.translate(0.45 * u, 0)
  }
  // waechst aus dem Stamm heraus
  ctx.scale(Math.min(1, s), Math.min(1, s))
  // Schatten nach unten (unabhaengig von der Drehung)
  const m = ctx.getTransform()
  const k = Math.hypot(m.a, m.b)
  ctx.shadowColor = 'rgba(12, 40, 32, 0.3)'
  ctx.shadowOffsetY = u * 0.12 * k
  // Stamm
  const st = ctx.createLinearGradient(0, -0.22 * u, 0, 0.22 * u)
  st.addColorStop(0, '#94653D')
  st.addColorStop(1, '#5C3B22')
  ctx.fillStyle = st
  rund(ctx, -0.45 * u, -0.21 * u, 2.2 * u, 0.42 * u, 0.12 * u)
  ctx.fill()
  ctx.strokeStyle = 'rgba(40, 24, 12, 0.45)'
  ctx.lineWidth = Math.max(1, u * 0.035)
  ctx.lineCap = 'round'
  ctx.beginPath()
  for (const [x0, y0, l] of [[-0.1, -0.08, 0.5], [0.55, 0.06, 0.6], [1.0, -0.1, 0.35]]) {
    ctx.moveTo(x0 * u, y0 * u)
    ctx.lineTo((x0 + l) * u, y0 * u)
  }
  ctx.stroke()
  ctx.shadowColor = 'transparent'
  // Schnittflaeche mit Jahresringen
  ctx.fillStyle = '#D8AE74'
  ctx.beginPath()
  ctx.ellipse(-0.45 * u, 0, 0.12 * u, 0.21 * u, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(120, 78, 40, 0.6)'
  ctx.beginPath()
  ctx.ellipse(-0.45 * u, 0, 0.06 * u, 0.11 * u, 0, 0, Math.PI * 2)
  ctx.stroke()
  // Krone: Reihe 2 drei Felder breit, Reihe 3 die Spitze. Beide Kanten knicken
  // zur Spitze ein, damit nichts ueber die freien Nachbarfelder ragt
  const lagen: [number, string][] = [
    [0, '#1F6B3A'],
    [0.5, '#2A8148'],
    [1.0, '#3A9A57'],
  ]
  ctx.shadowColor = 'rgba(12, 40, 32, 0.3)'
  for (const [off, col] of lagen) {
    if (off > 0) ctx.shadowColor = 'transparent'
    const bx = (1.5 + off * 0.5) * u
    // Breite Reihe wie eine Tannen-Etage (bis zur Schulter), dann die schmale Spitze
    const half = 1.47 * u - off * 0.3 * u
    const top = -half
    const bot = half
    const schulterX = 2.45 * u
    const schulterY = half * 0.55
    const halsY = (0.45 - off * 0.12) * u
    ctx.fillStyle = col
    ctx.beginPath()
    ctx.moveTo(bx, top)
    ctx.lineTo(schulterX, -schulterY)
    ctx.lineTo(2.5 * u, -halsY)
    ctx.lineTo(3.48 * u, 0)
    ctx.lineTo(2.5 * u, halsY)
    ctx.lineTo(schulterX, schulterY)
    ctx.lineTo(bx, bot)
    // Zacken an der Basis (Aeste)
    ctx.lineTo(bx - 0.12 * u, (top + bot) / 2 + 0.3 * u)
    ctx.lineTo(bx, (top + bot) / 2)
    ctx.lineTo(bx - 0.12 * u, (top + bot) / 2 - 0.3 * u)
    ctx.closePath()
    ctx.fill()
  }
  ctx.shadowColor = 'transparent'
  // Glanz an der oberen Kante
  ctx.strokeStyle = 'rgba(200, 240, 190, 0.35)'
  ctx.lineWidth = Math.max(1, u * 0.05)
  ctx.beginPath()
  ctx.moveTo(1.6 * u, -1.32 * u)
  ctx.lineTo(2.4 * u, -0.8 * u)
  ctx.moveTo(2.6 * u, -0.38 * u)
  ctx.lineTo(3.3 * u, -0.06 * u)
  ctx.stroke()
  ctx.restore()
}

/** Stehende Tanne von oben: die Krone als Plus (Stern mit vier Spitzen in die Nachbarfelder) in
 *  drei Lagen, in der Mitte die Spitze. `off` = Versatz in Feldern (beim Umfallen) */
export function drawBaumStehend(ctx: CanvasRenderingContext2D, root: P, cell: number, s: number, off: P = { x: 0, y: 0 }) {
  if (s <= 0) return
  const u = cell
  ctx.save()
  ctx.translate((root.x + 0.5 + off.x) * u, (root.y + 0.5 + off.y) * u)
  ctx.scale(s, s)
  const lagen: [number, string][] = [
    [1, '#1F6B3A'],
    [0.72, '#2A8148'],
    [0.45, '#3A9A57'],
  ]
  ctx.shadowColor = 'rgba(12, 40, 32, 0.32)'
  const m = ctx.getTransform()
  ctx.shadowOffsetY = u * 0.16 * Math.hypot(m.a, m.b)
  for (const [k, col] of lagen) {
    const spitze = 1.45 * u * k
    const ecke = 0.64 * u * k
    ctx.fillStyle = col
    ctx.beginPath()
    for (let i = 0; i < 4; i++) {
      const w = (i * Math.PI) / 2
      // Spitze, kleiner Zacken (Ast), Ecke zwischen zwei Spitzen
      ctx.lineTo(Math.cos(w) * spitze, Math.sin(w) * spitze)
      const z = w + Math.PI / 8
      ctx.lineTo(Math.cos(z) * spitze * 0.62, Math.sin(z) * spitze * 0.62)
      ctx.lineTo(Math.cos(w + Math.PI / 4) * ecke, Math.sin(w + Math.PI / 4) * ecke)
      const z2 = w + (Math.PI * 3) / 8
      ctx.lineTo(Math.cos(z2) * spitze * 0.62, Math.sin(z2) * spitze * 0.62)
    }
    ctx.closePath()
    ctx.fill()
    ctx.shadowColor = 'transparent'
  }
  // Spitze in der Mitte
  ctx.fillStyle = '#5DBB74'
  ctx.beginPath()
  ctx.arc(0, 0, u * 0.13, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/** Haus von oben: Ziegeldach ueber alle Felder, Kamin mit Rauch, vier Fenster an
 *  den Seiten. Das leuchtende Fenster ist gelb. s = Ploppen */
export function drawHaus(
  ctx: CanvasRenderingContext2D,
  cells: P[],
  fenster: { p: P; d: Dir }[],
  licht: number,
  kamin: number,
  cell: number,
  s: number,
  now: number,
) {
  if (s <= 0) return
  const u = cell
  const set = new Set(cells.map((c) => c.x * 10000 + c.y))
  const has = (x: number, y: number) => set.has(x * 10000 + y)
  const xs = cells.map((c) => c.x)
  const ys = cells.map((c) => c.y)
  const cx = ((Math.min(...xs) + Math.max(...xs) + 1) / 2) * u
  const cy = ((Math.min(...ys) + Math.max(...ys) + 1) / 2) * u
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(Math.min(1.05, s), Math.min(1.05, s))
  ctx.translate(-cx, -cy)
  // Schatten
  ctx.fillStyle = 'rgba(12, 40, 32, 0.3)'
  for (const c of cells) ctx.fillRect(c.x * u + 0.04 * u, c.y * u + 0.16 * u, u, u)
  // Dach
  const g = ctx.createLinearGradient(0, Math.min(...ys) * u, 0, (Math.max(...ys) + 1) * u)
  g.addColorStop(0, '#C9654A')
  g.addColorStop(1, '#A4462F')
  ctx.fillStyle = g
  for (const c of cells) ctx.fillRect(c.x * u - 0.3, c.y * u - 0.3, u + 0.6, u + 0.6)
  // Ziegelreihen
  ctx.strokeStyle = 'rgba(90, 30, 18, 0.28)'
  ctx.lineWidth = Math.max(1, u * 0.04)
  ctx.beginPath()
  for (const c of cells)
    for (const f of [0.33, 0.66]) {
      ctx.moveTo(c.x * u + 0.06 * u, (c.y + f) * u)
      ctx.lineTo((c.x + 1) * u - 0.06 * u, (c.y + f) * u)
    }
  ctx.stroke()
  // Aussenkante: dunkler Rand, oben/links eine helle Lichtkante
  ctx.lineCap = 'round'
  for (const c of cells) {
    const x = c.x * u
    const y = c.y * u
    const kanten: [boolean, number, number, number, number, string][] = [
      [!has(c.x, c.y - 1), x, y, x + u, y, '#E9876A'],
      [!has(c.x - 1, c.y), x, y, x, y + u, '#E9876A'],
      [!has(c.x, c.y + 1), x, y + u, x + u, y + u, '#6E2A1C'],
      [!has(c.x + 1, c.y), x + u, y, x + u, y + u, '#6E2A1C'],
    ]
    ctx.lineWidth = Math.max(1.5, u * 0.09)
    for (const [an, x0, y0, x1, y1, col] of kanten) {
      if (!an) continue
      ctx.strokeStyle = col
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      ctx.stroke()
    }
  }
  // Kamin mit Rauch
  const k = cells[kamin] ?? cells[0]
  const kx = (k.x + 0.32) * u
  const ky = (k.y + 0.28) * u
  ctx.fillStyle = '#4E3B30'
  ctx.fillRect(kx - 0.14 * u, ky - 0.14 * u, 0.28 * u, 0.28 * u)
  ctx.fillStyle = '#2A1F19'
  ctx.fillRect(kx - 0.08 * u, ky - 0.08 * u, 0.16 * u, 0.16 * u)
  for (let i = 0; i < 3; i++) {
    const t = (now / 1600 + i / 3) % 1
    ctx.fillStyle = `rgba(235, 230, 220, ${0.45 * (1 - t)})`
    ctx.beginPath()
    ctx.arc(kx + t * 0.35 * u, ky - t * 0.7 * u, (0.07 + t * 0.12) * u, 0, Math.PI * 2)
    ctx.fill()
  }
  // Fenster
  fenster.forEach((f, i) => {
    const d = STEP_LOCAL[f.d]
    const fx = (f.p.x + 0.5 + d.x * 0.4) * u
    const fy = (f.p.y + 0.5 + d.y * 0.4) * u
    const w = (d.x ? 0.16 : 0.44) * u
    const h = (d.x ? 0.44 : 0.16) * u
    const an = i === licht
    if (an) {
      ctx.fillStyle = 'rgba(255, 209, 102, 0.45)'
      ctx.beginPath()
      ctx.arc(fx, fy, 0.38 * u, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = '#EFE3CF'
    ctx.fillRect(fx - w / 2 - 0.04 * u, fy - h / 2 - 0.04 * u, w + 0.08 * u, h + 0.08 * u)
    ctx.fillStyle = an ? '#FFD166' : '#33424D'
    ctx.fillRect(fx - w / 2, fy - h / 2, w, h)
  })
  ctx.restore()
}

const STEP_LOCAL: Record<Dir, P> = { u: { x: 0, y: -1 }, d: { x: 0, y: 1 }, l: { x: -1, y: 0 }, r: { x: 1, y: 0 } }

/** Lichtstrahl aus einem Fenster: wird nach aussen breiter und blasser, flackert leicht */
export function drawLicht(ctx: CanvasRenderingContext2D, from: P, d: Dir, len: number, cell: number, a: number, now: number) {
  if (len <= 0 || a <= 0) return
  const u = cell
  const s = STEP_LOCAL[d]
  const x0 = (from.x + 0.5 + s.x * 0.5) * u
  const y0 = (from.y + 0.5 + s.y * 0.5) * u
  const x1 = x0 + s.x * len * u
  const y1 = y0 + s.y * len * u
  const px = -s.y
  const py = s.x
  const w0 = 0.24 * u
  const w1 = 0.5 * u
  const flacker = 0.88 + 0.12 * Math.sin(now / 90) * Math.sin(now / 37)
  const g = ctx.createLinearGradient(x0, y0, x1, y1)
  g.addColorStop(0, `rgba(255, 196, 64, ${0.9 * a * flacker})`)
  g.addColorStop(1, `rgba(255, 196, 64, ${0.4 * a * flacker})`)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(x0 + px * w0, y0 + py * w0)
  ctx.lineTo(x1 + px * w1, y1 + py * w1)
  ctx.lineTo(x1 - px * w1, y1 - py * w1)
  ctx.lineTo(x0 - px * w0, y0 - py * w0)
  ctx.closePath()
  ctx.fill()
  // Lichtflecken auf dem Boden
  ctx.fillStyle = `rgba(255, 210, 90, ${0.42 * a})`
  for (let k = 1; k <= len; k++) {
    ctx.beginPath()
    ctx.ellipse(x0 + s.x * (k - 0.5) * u, y0 + s.y * (k - 0.5) * u, 0.42 * u, 0.42 * u, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** Frosch von oben, Kopf in Richtung `ang` (Bogenmass, 0 = rechts).
 *  anlauf 0..1: macht sich bereit (Hinterbeine spreizen sich, Koerper duckt sich nach hinten).
 *  flug 0..1 (oder <0): im Sprung mit gestreckten Hinterbeinen, hebt ab (Schatten bleibt am Boden). */
export function drawFrosch(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, ang: number, anlauf: number, flug: number, s: number, a = 1) {
  if (s <= 0 || a <= 0) return
  const L = cell * 0.74 * s
  const imFlug = flug >= 0 && flug <= 1
  const hoch = imFlug ? Math.sin(Math.PI * flug) : 0
  // Streckung der Beine im Sprung: schnell raus, zur Landung wieder angezogen
  const streck = imFlug ? Math.sin(Math.PI * Math.min(1, flug * 1.3)) : 0
  const duck = imFlug ? 0 : anlauf
  const hell = '#6CBF55'
  const mittel = '#4C9E42'
  const dunkel = '#2F7334'
  const oval = (cx: number, cy: number, rx: number, ry: number, rot: number, col: string) => {
    ctx.fillStyle = col
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2)
    ctx.fill()
  }
  const fuss = (fx: number, fy: number, rot: number, sd: number) => {
    ctx.save()
    ctx.translate(fx, fy)
    ctx.rotate(rot)
    ctx.fillStyle = dunkel
    ctx.beginPath()
    ctx.moveTo(-L * 0.08, 0)
    ctx.lineTo(L * 0.2, -sd * L * 0.14)
    ctx.lineTo(L * 0.24, 0)
    ctx.lineTo(L * 0.2, sd * L * 0.14)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  ctx.save()
  ctx.globalAlpha = a
  // Schatten am Boden (wird im Sprung kleiner und blasser)
  oval(x, y + L * 0.28, L * (0.8 - hoch * 0.25), L * (0.5 - hoch * 0.15), 0, `rgba(12, 40, 32, ${0.26 - hoch * 0.12})`)
  ctx.translate(x, y - hoch * cell * 0.55)
  ctx.rotate(ang)
  const gross = 1 + hoch * 0.3
  ctx.scale(gross * (1 - duck * 0.08), gross * (1 + duck * 0.05))
  ctx.translate(-duck * L * 0.12, 0)

  for (const sd of [-1, 1]) {
    if (streck > 0.05) {
      // Sprung: Ober- und Unterschenkel nach hinten gestreckt
      const e = streck
      oval(-L * (0.4 + 0.2 * e), sd * L * (0.3 - 0.06 * e), L * (0.3 + 0.08 * e), L * 0.13, sd * (0.5 - 0.4 * e), mittel)
      oval(-L * (0.62 + 0.45 * e), sd * L * (0.42 - 0.18 * e), L * (0.3 + 0.1 * e), L * 0.09, -sd * (0.5 - 0.5 * e), dunkel)
      fuss(-L * (0.9 + 0.6 * e), sd * L * (0.3 - 0.1 * e), Math.PI, sd)
    } else {
      // Sitzen: Beine seitlich angelegt; beim Anlauf weiter gespreizt und zurueckgezogen
      const k = duck
      oval(-L * (0.32 + 0.06 * k), sd * L * (0.38 + 0.06 * k), L * 0.3, L * 0.14, sd * (0.55 + 0.35 * k), mittel)
      oval(-L * (0.1 + 0.08 * k), sd * L * (0.58 + 0.06 * k), L * 0.28, L * 0.1, -sd * (0.25 + 0.2 * k), dunkel)
      fuss(L * (0.12 - 0.1 * k), sd * L * (0.6 + 0.05 * k), -sd * 0.2, sd)
    }
    // Vorderbeine
    oval(L * 0.38, sd * L * 0.38, L * 0.15, L * 0.07, sd * 0.9, mittel)
    fuss(L * 0.46, sd * L * 0.5, sd * 0.6, sd)
  }
  // Koerper und Kopf
  const g = ctx.createRadialGradient(-L * 0.1, -L * 0.12, L * 0.05, 0, 0, L * 0.65)
  g.addColorStop(0, '#8FD877')
  g.addColorStop(1, hell)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(-L * 0.08, 0, L * 0.5, L * 0.4, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(L * 0.32, 0, L * 0.3, L * 0.34, 0, 0, Math.PI * 2)
  ctx.fill()
  // Flecken auf dem Ruecken
  for (const [fx, fy, r] of [[-L * 0.28, -L * 0.12, 0.09], [-L * 0.08, L * 0.15, 0.07], [-L * 0.36, L * 0.14, 0.06], [L * 0.05, -L * 0.18, 0.05]] as const)
    oval(fx, fy, L * r, L * r * 0.85, 0, 'rgba(40, 110, 45, 0.6)')
  // Glanz
  oval(-L * 0.2, -L * 0.2, L * 0.16, L * 0.06, -0.3, 'rgba(255, 255, 255, 0.25)')
  // Augen (vorstehend) und Maul
  for (const sd of [-1, 1]) {
    oval(L * 0.4, sd * L * 0.22, L * 0.14, L * 0.14, 0, hell)
    oval(L * 0.43, sd * L * 0.23, L * 0.1, L * 0.1, 0, '#FFF6D8')
    oval(L * 0.46, sd * L * 0.23, L * 0.04, L * 0.065, 0, '#16211d')
  }
  ctx.strokeStyle = 'rgba(30, 80, 35, 0.6)'
  ctx.lineWidth = Math.max(1, L * 0.04)
  ctx.beginPath()
  ctx.arc(L * 0.38, 0, L * 0.2, -0.9, 0.9)
  ctx.stroke()
  ctx.restore()
}

export const DIR_WINKEL: Record<Dir, number> = { r: 0, d: Math.PI / 2, l: Math.PI, u: -Math.PI / 2 }

/** Jaegerturm von oben (2x2 Felder, (x, y) = Mitte): runder Steinturm mit Zinnen,
 *  in der Mitte ein Scheinwerfer, der in Richtung `ang` zeigt */
export function drawTurm(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, ang: number, s: number, now: number) {
  if (s <= 0) return
  const R = cell * 0.95 * s
  ctx.save()
  ctx.translate(x, y)
  // Schatten
  ctx.fillStyle = 'rgba(12, 40, 32, 0.32)'
  ctx.beginPath()
  ctx.ellipse(cell * 0.06, cell * 0.16, R, R, 0, 0, Math.PI * 2)
  ctx.fill()
  // Mauerring
  const g = ctx.createLinearGradient(-R, -R, R, R)
  g.addColorStop(0, '#9AA0A7')
  g.addColorStop(1, '#5B6168')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, R, 0, Math.PI * 2)
  ctx.fill()
  // Zinnen
  ctx.fillStyle = '#B5BAC0'
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI * 2 * i) / 10
    ctx.save()
    ctx.rotate(a)
    ctx.fillRect(R * 0.74, -R * 0.11, R * 0.24, R * 0.22)
    ctx.restore()
  }
  // Plattform
  ctx.fillStyle = '#474C52'
  ctx.beginPath()
  ctx.arc(0, 0, R * 0.68, 0, Math.PI * 2)
  ctx.fill()
  // Steinfugen
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
  ctx.lineWidth = Math.max(1, cell * 0.03)
  ctx.beginPath()
  ctx.arc(0, 0, R * 0.45, 0, Math.PI * 2)
  ctx.stroke()
  // Scheinwerfer in Blickrichtung
  ctx.rotate(ang)
  ctx.fillStyle = '#2B2F33'
  rund(ctx, -R * 0.18, -R * 0.24, R * 0.52, R * 0.48, R * 0.1)
  ctx.fill()
  const p = 0.85 + 0.15 * Math.sin(now / 160)
  ctx.fillStyle = `rgba(255, 244, 196, ${p})`
  ctx.beginPath()
  ctx.ellipse(R * 0.34, 0, R * 0.08, R * 0.2, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/** Lichtkegel des Jaegerturms: helle Felder, nach aussen blasser, dazu ein Strahl vom Scheinwerfer */
export function drawKegel(ctx: CanvasRenderingContext2D, cells: P[], mitte: { x: number; y: number }, ang: number, cell: number, a: number, now: number) {
  if (!cells.length || a <= 0) return
  const u = cell
  const flacker = 0.9 + 0.1 * Math.sin(now / 70) * Math.sin(now / 23)
  ctx.save()
  ctx.beginPath()
  for (const c of cells) ctx.rect(c.x * u, c.y * u, u, u)
  ctx.clip()
  const ex = mitte.x + Math.cos(ang) * u * 8
  const ey = mitte.y + Math.sin(ang) * u * 8
  const g = ctx.createLinearGradient(mitte.x, mitte.y, ex, ey)
  g.addColorStop(0, `rgba(255, 222, 110, ${0.92 * a * flacker})`)
  g.addColorStop(1, `rgba(255, 206, 80, ${0.42 * a * flacker})`)
  ctx.fillStyle = g
  for (const c of cells) ctx.fillRect(c.x * u, c.y * u, u, u)
  // Rand des Kegels etwas heller
  // Lichtstreifen in Strahlrichtung
  ctx.strokeStyle = `rgba(255, 255, 230, ${0.35 * a * flacker})`
  ctx.lineWidth = Math.max(1, u * 0.08)
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath()
    ctx.moveTo(mitte.x - Math.sin(ang) * i * u * 0.5, mitte.y + Math.cos(ang) * i * u * 0.5)
    ctx.lineTo(ex - Math.sin(ang) * i * u * 0.9, ey + Math.cos(ang) * i * u * 0.9)
    ctx.stroke()
  }
  ctx.restore()
}

export const POWER_FARBE: Record<string, string> = {
  schild: '#4FA8E8',
  zeitlupe: '#9B7BE0',
  geist: '#B8C4CC',
  schere: '#F29A4C',
  goldschere: '#F5C518',
  fuettern: '#E0563E',
  magnet: '#D8434A',
  maulwurf: '#8A5A34',
  spitzhacke: '#7B8794',
}

/** Power-up: leuchtende Kugel mit Symbol, schwebt leicht. warn = kurz vor dem Verschwinden */
export function drawPower(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, art: string, s: number, now: number, warn = false) {
  if (s <= 0) return
  if (warn && Math.sin(now / 80) < -0.2) return
  const r = cell * 0.4 * s
  const hop = Math.sin(now / 380) * cell * 0.06
  const col = POWER_FARBE[art] ?? '#fff'
  ctx.fillStyle = 'rgba(12, 40, 32, 0.22)'
  ctx.beginPath()
  ctx.ellipse(x, y + r * 0.95, r * 0.75, r * 0.22, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.save()
  ctx.translate(x, y - hop - cell * 0.05)
  // Schein
  const glow = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 1.5)
  glow.addColorStop(0, col + 'aa')
  glow.addColorStop(1, col + '00')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = col
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.lineWidth = Math.max(1.5, cell * 0.05)
  ctx.stroke()
  // Symbol
  ctx.strokeStyle = '#fff'
  ctx.fillStyle = '#fff'
  ctx.lineWidth = Math.max(1.5, r * 0.16)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const k = r * 0.55
  ctx.beginPath()
  if (art === 'schild') {
    ctx.moveTo(0, -k)
    ctx.lineTo(k * 0.85, -k * 0.6)
    ctx.quadraticCurveTo(k * 0.8, k * 0.6, 0, k)
    ctx.quadraticCurveTo(-k * 0.8, k * 0.6, -k * 0.85, -k * 0.6)
    ctx.closePath()
    ctx.stroke()
  } else if (art === 'zeitlupe') {
    // Sanduhr
    ctx.moveTo(-k * 0.6, -k)
    ctx.lineTo(k * 0.6, -k)
    ctx.lineTo(-k * 0.6, k)
    ctx.lineTo(k * 0.6, k)
    ctx.closePath()
    ctx.stroke()
  } else if (art === 'geist') {
    ctx.moveTo(-k * 0.7, k * 0.9)
    ctx.lineTo(-k * 0.7, -k * 0.1)
    ctx.arc(0, -k * 0.1, k * 0.7, Math.PI, 0, false)
    ctx.lineTo(k * 0.7, k * 0.9)
    ctx.lineTo(k * 0.35, k * 0.6)
    ctx.lineTo(0, k * 0.9)
    ctx.lineTo(-k * 0.35, k * 0.6)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = col
    ctx.beginPath()
    ctx.arc(-k * 0.28, -k * 0.15, k * 0.14, 0, Math.PI * 2)
    ctx.arc(k * 0.28, -k * 0.15, k * 0.14, 0, Math.PI * 2)
    ctx.fill()
  } else if (art === 'schere' || art === 'goldschere') {
    ctx.moveTo(-k * 0.7, -k * 0.8)
    ctx.lineTo(k * 0.5, k * 0.4)
    ctx.moveTo(k * 0.7, -k * 0.8)
    ctx.lineTo(-k * 0.5, k * 0.4)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(-k * 0.55, k * 0.6, k * 0.25, 0, Math.PI * 2)
    ctx.moveTo(k * 0.8, k * 0.6)
    ctx.arc(k * 0.55, k * 0.6, k * 0.25, 0, Math.PI * 2)
    ctx.stroke()
  } else if (art === 'fuettern') {
    // Offenes Maul mit Zaehnen
    ctx.moveTo(k * 0.8, -k * 0.55)
    ctx.lineTo(-k * 0.1, 0)
    ctx.lineTo(k * 0.8, k * 0.55)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(-k * 0.05, 0, k * 0.85, Math.PI * 0.2, Math.PI * 1.8)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(-k * 0.25, -k * 0.45, k * 0.12, 0, Math.PI * 2)
    ctx.fill()
  } else if (art === 'magnet') {
    ctx.arc(0, -k * 0.1, k * 0.6, Math.PI, 0, false)
    ctx.moveTo(-k * 0.6, -k * 0.1)
    ctx.lineTo(-k * 0.6, k * 0.8)
    ctx.moveTo(k * 0.6, -k * 0.1)
    ctx.lineTo(k * 0.6, k * 0.8)
    ctx.stroke()
  } else if (art === 'maulwurf') {
    // Schaufel
    ctx.moveTo(k * 0.7, -k * 0.9)
    ctx.lineTo(-k * 0.15, k * 0.05)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(-k * 0.05, -k * 0.05)
    ctx.lineTo(-k * 0.75, k * 0.35)
    ctx.quadraticCurveTo(-k * 0.95, k * 0.95, -k * 0.35, k * 0.75)
    ctx.closePath()
    ctx.fill()
  } else if (art === 'spitzhacke') {
    // Spitzhacke
    ctx.moveTo(-k * 0.55, k * 0.85)
    ctx.lineTo(k * 0.35, -k * 0.35)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(-k * 0.65, -k * 0.35)
    ctx.quadraticCurveTo(k * 0.15, -k * 1.0, k * 0.9, -k * 0.15)
    ctx.stroke()
  }
  // Goldene Schere: funkelt
  if (art === 'goldschere') {
    const f = 0.75 + 0.25 * Math.sin(now / 160)
    ctx.beginPath()
    for (let i = 0; i < 8; i++) {
      const w = (i * Math.PI) / 4
      const rr = (i % 2 ? 0.1 : 0.32) * r * f
      ctx.lineTo(r * 0.72 + Math.cos(w) * rr, -r * 0.72 + Math.sin(w) * rr)
    }
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

/** Pulsierender Lavaschein in der Erde (Mitte x/y, Radius r in px, Staerke a) */
export function drawLavaSchein(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, `rgba(255, 140, 40, ${a})`)
  g.addColorStop(0.45, `rgba(230, 80, 20, ${a * 0.45})`)
  g.addColorStop(1, 'rgba(180, 40, 10, 0)')
  ctx.fillStyle = g
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
}

/** Lavasee: zusammenhaengende Felder, gluehend mit dunkler Kruste und Blasen. born = wann jedes Feld dazukam */
export function drawLava(ctx: CanvasRenderingContext2D, cells: P[], born: number[], cell: number, now: number, reduce = false) {
  if (!cells.length) return
  const set = new Set(cells.map((c) => c.x * 10000 + c.y))
  const grow = (i: number) => (reduce ? 1 : backOut(clamp01((now - born[i]) / 420)))
  // Hitzeschein
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]
    const s = grow(i)
    const g = ctx.createRadialGradient((c.x + 0.5) * cell, (c.y + 0.5) * cell, cell * 0.2, (c.x + 0.5) * cell, (c.y + 0.5) * cell, cell * 0.95 * s)
    g.addColorStop(0, 'rgba(255, 120, 30, 0.28)')
    g.addColorStop(1, 'rgba(255, 120, 30, 0)')
    ctx.fillStyle = g
    ctx.fillRect((c.x - 0.5) * cell, (c.y - 0.5) * cell, cell * 2, cell * 2)
  }
  // Kruste (dunkel) und gluehende Mitte, Nachbarfelder verbunden
  for (const [farbe, inset] of [['#5A1A0E', 0.02], ['#C2361A', 0.1]] as const) {
    ctx.fillStyle = farbe
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i]
      const s = grow(i)
      const sz = cell * (1 - inset * 2) * s
      const off = (cell - sz) / 2
      rund(ctx, c.x * cell + off, c.y * cell + off, sz, sz, cell * 0.3 * s)
      ctx.fill()
      if (s < 1) continue
      if (set.has((c.x + 1) * 10000 + c.y)) ctx.fillRect((c.x + 0.5) * cell, c.y * cell + off, cell, sz)
      if (set.has(c.x * 10000 + c.y + 1)) ctx.fillRect(c.x * cell + off, (c.y + 0.5) * cell, sz, cell)
      // Viererblock: Loch in der Mitte schliessen
      if (set.has((c.x + 1) * 10000 + c.y) && set.has(c.x * 10000 + c.y + 1) && set.has((c.x + 1) * 10000 + c.y + 1))
        ctx.fillRect((c.x + 0.5) * cell, (c.y + 0.5) * cell, cell, cell)
    }
  }
  // Fliessendes Gluehen und Blasen
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]
    const s = grow(i)
    if (s <= 0) continue
    const cx = (c.x + 0.5) * cell
    const cy = (c.y + 0.5) * cell
    const ph = now / 700 + c.x * 1.3 + c.y * 0.7
    const g = ctx.createRadialGradient(cx + Math.sin(ph) * cell * 0.15, cy + Math.cos(ph * 0.8) * cell * 0.15, 0, cx, cy, cell * 0.45 * s)
    g.addColorStop(0, '#FFE27A')
    g.addColorStop(0.45, '#FF9A2E')
    g.addColorStop(1, 'rgba(240, 90, 30, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, cy, cell * 0.45 * s, 0, Math.PI * 2)
    ctx.fill()
    if (reduce) continue
    // Blase: waechst und platzt
    // Auch fuer Felder links oder oberhalb der Karte (negative Koordinaten, Lava im Stein) zwischen 0 und 1
    const zyklus = (((now / 1300 + ((c.x * 7 + c.y * 13) % 10) / 10) % 1) + 1) % 1
    if (zyklus < 0.7) {
      const r = cell * 0.09 * (zyklus / 0.7)
      ctx.strokeStyle = 'rgba(255, 230, 150, 0.8)'
      ctx.lineWidth = Math.max(1, cell * 0.035)
      ctx.beginPath()
      ctx.arc(cx + cell * 0.18 * Math.sin(c.x + c.y), cy - cell * 0.12, r, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
}

/** Ameise von oben: Kopf, Brust, Hinterleib, sechs Beine (bewegen sich beim Laufen), Fuehler.
 *  ang = Blickrichtung, lauf = 0..1 Schrittphase (-1 steht), alarm = 0..1 (Ausrufezeichen) */
export function drawAmeise(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, ang: number, lauf: number, s: number, alarm = 0, a = 1, farben: readonly [string, string, string] = ['#3B2218', '#4A2A1D', '#2A1A14']) {
  if (s <= 0 || a <= 0) return
  const u = cell * 0.5 * s
  ctx.save()
  ctx.globalAlpha *= a
  ctx.fillStyle = 'rgba(12, 40, 32, 0.22)'
  ctx.beginPath()
  ctx.ellipse(x, y + u * 0.25, u * 0.75, u * 0.35, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.translate(x, y)
  ctx.rotate(ang)
  const wackel = lauf >= 0 ? Math.sin(lauf * Math.PI * 2) * 0.35 : 0
  // Beine
  ctx.strokeStyle = farben[2]
  ctx.lineWidth = Math.max(1, u * 0.09)
  ctx.lineCap = 'round'
  for (const [bx, w0] of [[u * 0.12, -0.5], [-u * 0.05, 0], [-u * 0.22, 0.5]] as const)
    for (const seite of [-1, 1]) {
      const w = w0 + (seite > 0 ? wackel : -wackel) * (bx > 0 ? 1 : -1)
      ctx.beginPath()
      ctx.moveTo(bx, 0)
      ctx.lineTo(bx + Math.sin(w) * u * 0.25, seite * u * 0.32)
      ctx.lineTo(bx + Math.sin(w) * u * 0.45 - u * 0.05, seite * u * 0.5)
      ctx.stroke()
    }
  // Koerper
  const koerper = (cx: number, rx: number, ry: number, farbe: string) => {
    ctx.fillStyle = farbe
    ctx.beginPath()
    ctx.ellipse(cx, 0, rx, ry, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  koerper(-u * 0.48, u * 0.32, u * 0.24, farben[0])
  koerper(-u * 0.05, u * 0.17, u * 0.12, farben[1])
  koerper(u * 0.3, u * 0.17, u * 0.16, farben[0])
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
  ctx.beginPath()
  ctx.ellipse(-u * 0.55, -u * 0.08, u * 0.1, u * 0.06, 0, 0, Math.PI * 2)
  ctx.fill()
  // Fuehler
  ctx.beginPath()
  ctx.moveTo(u * 0.42, -u * 0.06)
  ctx.quadraticCurveTo(u * 0.62, -u * 0.12, u * 0.72, -u * 0.3)
  ctx.moveTo(u * 0.42, u * 0.06)
  ctx.quadraticCurveTo(u * 0.62, u * 0.12, u * 0.72, u * 0.3)
  ctx.stroke()
  ctx.restore()
  // Aufmerksam: rotes Ausrufezeichen ueber der Ameise
  if (alarm > 0) {
    ctx.save()
    ctx.globalAlpha *= a * alarm
    ctx.fillStyle = '#E5463B'
    ctx.font = `800 ${Math.round(cell * 0.5)}px "Libre Franklin", system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
    ctx.strokeText('!', x, y - cell * 0.42)
    ctx.fillText('!', x, y - cell * 0.42)
    ctx.restore()
  }
}

/** Eisfeld: hellblau, glatt, mit Glanzstreifen und Rissen. Nachbarfelder verbunden */
export function drawEis(ctx: CanvasRenderingContext2D, cells: P[], cell: number, s: number, now: number) {
  if (s <= 0 || !cells.length) return
  const set = new Set(cells.map((c) => c.x * 10000 + c.y))
  const sz = cell * 0.96 * s
  const off = (cell - sz) / 2
  for (const [farbe, i] of [['#E8F7FF', 0], ['#BFE6F7', sz * 0.07]] as const) {
    ctx.fillStyle = farbe
    for (const c of cells) {
      rund(ctx, c.x * cell + off + i, c.y * cell + off + i, sz - 2 * i, sz - 2 * i, cell * 0.22)
      ctx.fill()
      if (set.has((c.x + 1) * 10000 + c.y)) ctx.fillRect((c.x + 0.5) * cell, c.y * cell + off + i, cell, sz - 2 * i)
      if (set.has(c.x * 10000 + c.y + 1)) ctx.fillRect(c.x * cell + off + i, (c.y + 0.5) * cell, sz - 2 * i, cell)
      if (set.has((c.x + 1) * 10000 + c.y) && set.has(c.x * 10000 + c.y + 1) && set.has((c.x + 1) * 10000 + c.y + 1))
        ctx.fillRect((c.x + 0.5) * cell, (c.y + 0.5) * cell, cell, cell)
    }
  }
  // Glanz wandert langsam ueber das Eis, feine Risse
  ctx.lineCap = 'round'
  for (const c of cells) {
    const x = c.x * cell
    const y = c.y * cell
    const ph = ((now / 2600 + (c.x + c.y) * 0.13) % 1) * 1.6 - 0.3
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)'
    ctx.lineWidth = Math.max(1, cell * 0.06)
    ctx.beginPath()
    ctx.moveTo(x + cell * (0.2 + ph * 0.5), y + cell * 0.25)
    ctx.lineTo(x + cell * (0.05 + ph * 0.5), y + cell * 0.55)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(120, 170, 200, 0.45)'
    ctx.lineWidth = Math.max(0.8, cell * 0.025)
    const h = ((c.x * 13 + c.y * 7) % 5) / 5
    ctx.beginPath()
    ctx.moveTo(x + cell * (0.55 + h * 0.2), y + cell * 0.6)
    ctx.lineTo(x + cell * 0.72, y + cell * (0.78 - h * 0.1))
    ctx.lineTo(x + cell * 0.85, y + cell * 0.74)
    ctx.stroke()
  }
}

/** Erzbrocken: grauer Stein mit Gold, Diamant, Rubin oder Opal. glanz = 0..1 Funkeln.
 *  Opal schimmert zwischen Pink und Lila und leuchtet */
export function drawErz(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, art: 'gold' | 'dia' | 'rubin' | 'opal', s: number, glanz = 0, now = 0, schein = true) {
  if (s <= 0) return
  const r = cell * 0.38 * s
  // In der Erde ohne Schein: dort glueht nur Lava
  if (art === 'opal' && schein) {
    // Leuchten drumherum, wechselt zwischen Pink und Lila
    const t = 0.5 + 0.5 * Math.sin(now / 420)
    const g = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 1.9)
    g.addColorStop(0, `rgba(${Math.round(255 - 70 * t)}, ${Math.round(110 - 30 * t)}, ${Math.round(200 + 55 * t)}, 0.55)`)
    g.addColorStop(1, 'rgba(200, 90, 255, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r * 1.9, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = '#6E6A66'
  ctx.beginPath()
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2
    const rr = r * (0.85 + ((i * 37) % 10) / 50)
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
  }
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
  ctx.beginPath()
  ctx.ellipse(x - r * 0.3, y - r * 0.35, r * 0.4, r * 0.22, -0.4, 0, Math.PI * 2)
  ctx.fill()
  const t = 0.5 + 0.5 * Math.sin(now / 420)
  const farbe =
    art === 'gold'
      ? ['#FFE07A', '#E0A81E']
      : art === 'dia'
        ? ['#B9FBFF', '#3ED6E6']
        : art === 'rubin'
          ? ['#FF9AA8', '#D3122E']
          : [`rgb(255, ${Math.round(200 - 40 * t)}, ${Math.round(240 + 15 * t)})`, `rgb(${Math.round(240 - 90 * t)}, ${Math.round(70 + 10 * t)}, ${Math.round(190 + 60 * t)})`]
  for (const [dx, dy, g] of [[-0.35, 0.1, 0.24], [0.25, -0.25, 0.2], [0.2, 0.35, 0.18], [-0.05, -0.45, 0.13]] as const) {
    const cx = x + dx * r
    const cy = y + dy * r
    const gr = g * r * 1.4
    ctx.fillStyle = farbe[1]
    ctx.beginPath()
    if (art !== 'gold') {
      ctx.moveTo(cx, cy - gr)
      ctx.lineTo(cx + gr * 0.8, cy)
      ctx.lineTo(cx, cy + gr)
      ctx.lineTo(cx - gr * 0.8, cy)
    } else ctx.arc(cx, cy, gr * 0.8, 0, Math.PI * 2)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = farbe[0]
    ctx.beginPath()
    ctx.arc(cx - gr * 0.2, cy - gr * 0.25, gr * 0.3, 0, Math.PI * 2)
    ctx.fill()
  }
  if (glanz > 0) {
    ctx.strokeStyle = `rgba(255, 255, 255, ${glanz})`
    ctx.lineWidth = Math.max(1, cell * 0.04)
    const sx = x + r * 0.35
    const sy = y - r * 0.4
    ctx.beginPath()
    ctx.moveTo(sx - r * 0.25, sy)
    ctx.lineTo(sx + r * 0.25, sy)
    ctx.moveTo(sx, sy - r * 0.25)
    ctx.lineTo(sx, sy + r * 0.25)
    ctx.stroke()
  }
}

/** Erde ausserhalb der Karte: dunkelbraun, nahe am Spielfeld heller (Erdkante).
 *  ring = 1 direkt am Rand, 2 eins weiter, 0 tiefer. z = fester Zufall des Felds (0..1) */
export function drawErdFeld(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, ring: number, z: number) {
  const basis = ring === 1 ? [92, 63, 38] : ring === 2 ? [70, 48, 30] : [44, 30, 20]
  const v = (z - 0.5) * 10
  ctx.fillStyle = `rgb(${basis[0] + v},${basis[1] + v * 0.7},${basis[2] + v * 0.5})`
  ctx.fillRect(x - 0.3, y - 0.3, cell + 0.6, cell + 0.6)
  // Kruemel
  ctx.fillStyle = ring === 1 ? 'rgba(130, 92, 58, 0.6)' : 'rgba(20, 12, 8, 0.35)'
  for (let i = 0; i < 3; i++) {
    const a = (z * 977 + i * 331) % 1
    const b = (z * 613 + i * 197) % 1
    ctx.fillRect(x + a * cell * 0.85, y + b * cell * 0.85, cell * 0.08, cell * 0.06)
  }
}

/** Deko in der Erde: Stein, Kohle, Schlangenskelett, Lavatasche */
export function drawErdDeko(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, art: 'stein' | 'kohle' | 'skelett' | 'lava', z: number, now: number) {
  const cx = x + cell / 2
  const cy = y + cell / 2
  if (art === 'stein') {
    ctx.fillStyle = '#6B6460'
    ctx.beginPath()
    ctx.ellipse(cx + (z - 0.5) * cell * 0.3, cy, cell * (0.18 + z * 0.12), cell * 0.14, z * 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
    ctx.beginPath()
    ctx.ellipse(cx + (z - 0.5) * cell * 0.3 - cell * 0.05, cy - cell * 0.04, cell * 0.07, cell * 0.04, 0, 0, Math.PI * 2)
    ctx.fill()
  } else if (art === 'kohle') {
    ctx.fillStyle = '#161210'
    for (let i = 0; i < 4; i++) {
      const a = (z * 991 + i * 271) % 1
      const b = (z * 457 + i * 389) % 1
      ctx.beginPath()
      ctx.arc(x + cell * (0.25 + a * 0.5), y + cell * (0.25 + b * 0.5), cell * (0.07 + ((a + b) % 0.06)), 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (art === 'skelett') {
    // Wirbelsaeule in S-Form mit Rippen und kleinem Schaedel
    ctx.strokeStyle = 'rgba(232, 222, 200, 0.85)'
    ctx.fillStyle = 'rgba(232, 222, 200, 0.85)'
    ctx.lineWidth = Math.max(1, cell * 0.05)
    ctx.lineCap = 'round'
    const pts: [number, number][] = []
    for (let i = 0; i <= 6; i++) pts.push([x + cell * (0.12 + i * 0.12), cy + Math.sin(i * 1.1 + z * 6) * cell * 0.14])
    ctx.beginPath()
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)))
    ctx.stroke()
    for (let i = 1; i < 6; i++) {
      const [px, py] = pts[i]
      ctx.beginPath()
      ctx.moveTo(px, py - cell * 0.09)
      ctx.lineTo(px, py + cell * 0.09)
      ctx.stroke()
    }
    const [hx, hy] = pts[6]
    ctx.beginPath()
    ctx.ellipse(hx + cell * 0.05, hy, cell * 0.08, cell * 0.06, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#2C1E14'
    ctx.beginPath()
    ctx.arc(hx + cell * 0.07, hy - cell * 0.02, cell * 0.018, 0, Math.PI * 2)
    ctx.fill()
  } else {
    const p = 0.7 + 0.3 * Math.sin(now / 500 + z * 10)
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, cell * 0.45)
    g.addColorStop(0, `rgba(255, 210, 90, ${p})`)
    g.addColorStop(0.5, `rgba(240, 100, 30, ${0.85 * p})`)
    g.addColorStop(1, 'rgba(120, 30, 10, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(cx, cy, cell * 0.42, cell * 0.3, z * 2, 0, Math.PI * 2)
    ctx.fill()
  }
}
