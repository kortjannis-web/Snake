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

/** Goldmuenze, dreht sich langsam (Breite schwankt), mit Glanz */
export function drawMuenze(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, s: number, now: number) {
  if (s <= 0) return
  const r = cell * 0.3 * s
  const dreh = Math.abs(Math.cos(now / 420))
  const rx = r * (0.25 + 0.75 * dreh)
  const hop = Math.max(0, Math.sin(now / 300)) * cell * 0.06
  ctx.fillStyle = 'rgba(12, 40, 32, 0.22)'
  ctx.beginPath()
  ctx.ellipse(x, y + r * 0.95, r * 0.8, r * 0.25, 0, 0, Math.PI * 2)
  ctx.fill()
  y -= hop
  ctx.fillStyle = '#B9861E'
  ctx.beginPath()
  ctx.ellipse(x + r * 0.08 * dreh, y + r * 0.06, rx, r, 0, 0, Math.PI * 2)
  ctx.fill()
  const g = ctx.createLinearGradient(x - rx, y - r, x + rx, y + r)
  g.addColorStop(0, '#FFE58A')
  g.addColorStop(0.5, '#F6C343')
  g.addColorStop(1, '#D99A1E')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(x, y, rx, r, 0, 0, Math.PI * 2)
  ctx.fill()
  if (dreh > 0.4) {
    ctx.strokeStyle = 'rgba(150, 100, 20, 0.6)'
    ctx.lineWidth = Math.max(1, cell * 0.04)
    ctx.beginPath()
    ctx.ellipse(x, y, rx * 0.65, r * 0.65, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
  ctx.beginPath()
  ctx.ellipse(x - rx * 0.35, y - r * 0.4, rx * 0.18, r * 0.22, -0.4, 0, Math.PI * 2)
  ctx.fill()
}

export const POWER_FARBE: Record<string, string> = {
  schild: '#4FA8E8',
  zeitlupe: '#9B7BE0',
  magnet: '#E5544A',
  geist: '#B8C4CC',
  schere: '#F29A4C',
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
  } else if (art === 'magnet') {
    ctx.arc(0, -k * 0.1, k * 0.6, Math.PI, 0, false)
    ctx.moveTo(-k * 0.6, -k * 0.1)
    ctx.lineTo(-k * 0.6, k * 0.8)
    ctx.moveTo(k * 0.6, -k * 0.1)
    ctx.lineTo(k * 0.6, k * 0.8)
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
  } else if (art === 'schere') {
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
  }
  ctx.restore()
}
