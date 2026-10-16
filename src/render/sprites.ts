/**
 * Zeichnungen fuer das Spielfeld (Canvas). Mauer und Teich stammen aus dem
 * Snake im Hero-Telefon, Apfel, Giftapfel, Falle, Wolke und Ameise sind neu.
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
  apfel: '#E5463B',
  apfelTief: '#A3241D',
  apfelHell: '#FF7A66',
  stiel: '#6B4A2A',
  blatt: '#4FA65A',
  blattTief: '#2F7A3E',
  schatten: 'rgba(12, 40, 32, 0.22)',
  partikel: ['#E5463B', '#F29A4C', '#F5EFE6', '#4FA65A', '#FF7A66'],
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

/** Apfel mit Stiel, Blatt und Glanz. s = Ploppen (0 bis 1+), wipp = leichtes Wippen */
export function drawApfel(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, s: number, wipp = 0, schimmel?: number) {
  if (s <= 0) return
  const r = cell * 0.36 * s
  y += cell * 0.04
  // Schatten am Boden
  ctx.fillStyle = C.schatten
  ctx.beginPath()
  ctx.ellipse(x, y + r * 0.95, r * 0.85, r * 0.25, 0, 0, Math.PI * 2)
  ctx.fill()
  y -= wipp
  // Koerper
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r * 1.15)
  g.addColorStop(0, C.apfelHell)
  g.addColorStop(0.45, C.apfel)
  g.addColorStop(1, C.apfelTief)
  apfelPfad(ctx, x, y, r)
  ctx.fillStyle = g
  ctx.fill()

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

/** Baerenfalle von oben: Grundplatte, zwei Buegel mit Zaehnen.
 *  zu = 0 offen bis 1 zugeschnappt, s = Ploppen */
export function drawFalle(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, s: number, zu = 0, warn = 0) {
  if (s <= 0) return
  const R = cell * 0.42 * s
  ctx.save()
  ctx.translate(x, y)
  // Warnschein (pulsiert)
  if (warn > 0) {
    ctx.fillStyle = `rgba(242, 119, 76, ${0.28 * warn})`
    ctx.beginPath()
    ctx.arc(0, 0, R * 1.25, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = 'rgba(12, 40, 32, 0.32)'
  ctx.beginPath()
  ctx.ellipse(0, R * 0.18, R * 1.08, R * 0.95, 0, 0, Math.PI * 2)
  ctx.fill()
  // Grundplatte mit Warnring
  ctx.fillStyle = '#5B4A3A'
  ctx.beginPath()
  ctx.arc(0, 0, R * 1.0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#E8873E'
  ctx.lineWidth = R * 0.1
  ctx.setLineDash([R * 0.22, R * 0.16])
  ctx.beginPath()
  ctx.arc(0, 0, R * 0.95, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  // Feder quer
  ctx.strokeStyle = '#2A2D31'
  ctx.lineWidth = R * 0.16
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-R * 1.0, 0)
  ctx.lineTo(R * 1.0, 0)
  ctx.stroke()
  // Buegel: links und rechts, schnappen zur Mitte
  const sx = 1 - zu * 0.82
  for (const side of [-1, 1]) {
    ctx.save()
    ctx.scale(sx, 1)
    ctx.strokeStyle = '#3E444A'
    ctx.lineWidth = R * 0.2
    ctx.beginPath()
    ctx.arc(0, 0, R * 0.82, side < 0 ? Math.PI * 0.5 : -Math.PI * 0.5, side < 0 ? Math.PI * 1.5 : Math.PI * 0.5)
    ctx.stroke()
    // Zaehne nach innen
    ctx.fillStyle = '#EEF1F3'
    for (let i = 1; i < 6; i++) {
      const a = (side < 0 ? Math.PI * 0.5 : -Math.PI * 0.5) + (Math.PI * i) / 6
      const ox = Math.cos(a) * R * 0.74
      const oy = Math.sin(a) * R * 0.74
      const ix = Math.cos(a) * R * 0.5
      const iy = Math.sin(a) * R * 0.5
      const px = -Math.sin(a) * R * 0.1
      const py = Math.cos(a) * R * 0.1
      ctx.beginPath()
      ctx.moveTo(ox + px, oy + py)
      ctx.lineTo(ix, iy)
      ctx.lineTo(ox - px, oy - py)
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()
  }
  // Trittplatte
  ctx.fillStyle = '#8A9096'
  ctx.beginPath()
  ctx.arc(0, 0, R * 0.26 * (1 - zu * 0.5), 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.beginPath()
  ctx.arc(-R * 0.08, -R * 0.08, R * 0.09, 0, Math.PI * 2)
  ctx.fill()
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

/** Ameise von oben, zeigt in Laufrichtung. lauf = Beinbewegung (Phase), s = Groesse */
export function drawAmeise(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, dir: Dir, lauf: number, s: number, a = 1) {
  if (s <= 0 || a <= 0) return
  const L = cell * 0.52 * s
  ctx.save()
  ctx.globalAlpha = a
  ctx.translate(x, y)
  ctx.rotate(ROT[dir])
  // Schatten
  ctx.fillStyle = 'rgba(12, 40, 32, 0.25)'
  ctx.beginPath()
  ctx.ellipse(0, L * 0.18, L * 1.05, L * 0.42, 0, 0, Math.PI * 2)
  ctx.fill()
  // Beine: drei Paare, schwingen gegenlaeufig
  ctx.strokeStyle = '#2A1712'
  ctx.lineWidth = Math.max(1, L * 0.09)
  ctx.lineCap = 'round'
  for (let i = 0; i < 3; i++) {
    const bx = L * (0.15 - i * 0.22)
    const sw = Math.sin(lauf + i * 2.1) * L * 0.18
    for (const side of [-1, 1]) {
      const swing = side * (i % 2 ? sw : -sw)
      ctx.beginPath()
      ctx.moveTo(bx, 0)
      ctx.lineTo(bx + L * 0.12 + swing, side * L * 0.42)
      ctx.lineTo(bx - L * 0.1 + swing * 1.3, side * L * 0.72)
      ctx.stroke()
    }
  }
  // Hinterleib, Brust, Kopf
  const body = (cx: number, rx: number, ry: number, col: string) => {
    ctx.fillStyle = col
    ctx.beginPath()
    ctx.ellipse(cx, 0, rx, ry, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  body(-L * 0.62, L * 0.44, L * 0.36, '#3A1E16')
  body(-L * 0.02, L * 0.22, L * 0.17, '#4A271C')
  body(L * 0.42, L * 0.26, L * 0.25, '#3A1E16')
  // Glanz
  ctx.fillStyle = 'rgba(255, 220, 200, 0.28)'
  ctx.beginPath()
  ctx.ellipse(-L * 0.7, -L * 0.1, L * 0.16, L * 0.08, -0.3, 0, Math.PI * 2)
  ctx.fill()
  // Fuehler
  const f = Math.sin(lauf * 0.7) * L * 0.08
  ctx.beginPath()
  ctx.moveTo(L * 0.58, -L * 0.08)
  ctx.lineTo(L * 0.82, -L * 0.22 + f)
  ctx.lineTo(L * 1.02, -L * 0.18 + f)
  ctx.moveTo(L * 0.58, L * 0.08)
  ctx.lineTo(L * 0.82, L * 0.22 - f)
  ctx.lineTo(L * 1.02, L * 0.18 - f)
  ctx.stroke()
  // Augen
  ctx.fillStyle = '#F5EFE6'
  ctx.beginPath()
  ctx.arc(L * 0.52, -L * 0.1, L * 0.05, 0, Math.PI * 2)
  ctx.arc(L * 0.52, L * 0.1, L * 0.05, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/** Liegende Tanne (1-1-2-1): Stamm mit Schnittflaeche, Krone als Dreieck in drei
 *  Lagen. Gezeichnet entlang `dir`, die breite Kronenreihe auf `seite`. */
export function drawBaum(ctx: CanvasRenderingContext2D, root: P, dir: Dir, seite: number, cell: number, s: number) {
  if (s <= 0) return
  const u = cell
  ctx.save()
  ctx.translate((root.x + 0.5) * u, (root.y + 0.5) * u)
  ctx.rotate(ROT[dir])
  ctx.scale(1, seite)
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
  // Krone: Reihe 2 doppelt breit, Reihe 3 die Spitze. Die Unterkante knickt
  // zur Spitze ein, damit nichts ueber das freie Nachbarfeld ragt
  const lagen: [number, string][] = [
    [0, '#1F6B3A'],
    [0.5, '#2A8148'],
    [1.0, '#3A9A57'],
  ]
  ctx.shadowColor = 'rgba(12, 40, 32, 0.3)'
  for (const [off, col] of lagen) {
    if (off > 0) ctx.shadowColor = 'transparent'
    const bx = (1.5 + off * 0.5) * u
    const top = -0.47 * u + off * 0.16 * u
    const bot = 1.47 * u - off * 0.42 * u
    ctx.fillStyle = col
    ctx.beginPath()
    ctx.moveTo(bx, top)
    ctx.lineTo(3.48 * u, 0)
    ctx.lineTo((2.5 + off * 0.25) * u, (0.42 - off * 0.12) * u)
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
  ctx.moveTo(1.6 * u, -0.38 * u)
  ctx.lineTo(3.3 * u, -0.02 * u)
  ctx.stroke()
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
