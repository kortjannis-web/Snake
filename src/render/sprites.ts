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
