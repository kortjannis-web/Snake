/**
 * Skins der Schlange und ihre Zeichnung (Spiel und Shop-Vorschau nutzen dieselbe Funktion).
 * Klassik ist gratis, die anderen kosten Muenzen.
 */
import { STEP } from '../game/rules'
import type { Dir, P } from '../game/types'

type RGB = readonly [number, number, number]
export type Skin = {
  id: string
  name: string
  preis: number
  kopf: RGB
  schwanz: RGB
  muster?: 'sterne' | 'streifen' | 'glanz' | 'regenbogen'
}

export const SKINS: Skin[] = [
  { id: 'klassik', name: 'Klassik', preis: 0, kopf: [47, 143, 116], schwanz: [18, 66, 55] },
  { id: 'koralle', name: 'Koralle', preis: 300, kopf: [244, 128, 96], schwanz: [160, 52, 66] },
  { id: 'nacht', name: 'Nacht', preis: 800, kopf: [70, 96, 170], schwanz: [22, 24, 60], muster: 'sterne' },
  { id: 'tiger', name: 'Tiger', preis: 1600, kopf: [246, 160, 70], schwanz: [200, 104, 36], muster: 'streifen' },
  { id: 'gold', name: 'Gold', preis: 3500, kopf: [255, 214, 102], schwanz: [170, 118, 28], muster: 'glanz' },
  { id: 'regenbogen', name: 'Regenbogen', preis: 7500, kopf: [255, 255, 255], schwanz: [255, 255, 255], muster: 'regenbogen' },
]
export const skinVon = (id: string) => SKINS.find((s) => s.id === id) ?? SKINS[0]

const GIFT_KOPF: RGB = [126, 116, 60]
const GIFT_SCHWANZ: RGB = [70, 52, 70]
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export type SchlangeOpts = {
  tot?: boolean
  /** 0..1: faerbt sich nach einem Giftapfel kraenklich */
  vergiftet?: number
  zunge?: boolean
  blinzeln?: boolean
}

/** Schlange zeichnen. pts = Glieder in Feldkoordinaten, Kopf zuerst (bereits weich interpoliert). */
export function drawSchlange(ctx: CanvasRenderingContext2D, pts: P[], cell: number, dir: Dir, skin: Skin, now: number, o: SchlangeOpts = {}) {
  if (!pts.length) return
  const px = (v: number) => (v + 0.5) * cell
  const w = cell * 0.74
  const vg = o.vergiftet ?? 0
  const farbe = (k: number, i: number): string => {
    if (skin.muster === 'regenbogen' && !vg) return `hsl(${(now / 12 + i * 14) % 360}, 72%, ${58 - k * 14}%)`
    const c = skin.kopf.map((v, j) => lerp(lerp(v, skin.schwanz[j], k), lerp(GIFT_KOPF[j], GIFT_SCHWANZ[j], k), vg))
    return `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`
  }
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Schatten
  ctx.strokeStyle = 'rgba(12, 40, 32, 0.22)'
  ctx.lineWidth = w
  ctx.beginPath()
  pts.forEach((p, i) => (i ? ctx.lineTo(px(p.x), px(p.y) + cell * 0.12) : ctx.moveTo(px(p.x), px(p.y) + cell * 0.12)))
  ctx.stroke()

  // Koerper vom Schwanz zum Kopf
  const n = pts.length
  for (let i = n - 2; i >= 0; i--) {
    const k = n > 2 ? i / (n - 2) : 0
    ctx.strokeStyle = farbe(k, i)
    ctx.lineWidth = w * (1 - k * 0.18)
    ctx.beginPath()
    ctx.moveTo(px(pts[i].x), px(pts[i].y))
    ctx.lineTo(px(pts[i + 1].x), px(pts[i + 1].y))
    ctx.stroke()
  }

  // Muster
  if (skin.muster === 'streifen') {
    // Tiger: dunkle Querstreifen jedes zweite Glied
    ctx.strokeStyle = 'rgba(40, 22, 10, 0.75)'
    ctx.lineWidth = Math.max(1.5, cell * 0.12)
    for (let i = 1; i < n - 1; i += 2) {
      const a = pts[i]
      const b = pts[i + 1]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const len = Math.hypot(dx, dy) || 1
      const qx = (-dy / len) * w * 0.42 * (1 - (i / n) * 0.18)
      const qy = (dx / len) * w * 0.42 * (1 - (i / n) * 0.18)
      const mx = px((a.x + b.x) / 2)
      const my = px((a.y + b.y) / 2)
      ctx.beginPath()
      ctx.moveTo(mx - qx, my - qy)
      ctx.quadraticCurveTo(mx + (dx / len) * cell * 0.12, my + (dy / len) * cell * 0.12, mx + qx, my + qy)
      ctx.stroke()
    }
  } else if (skin.muster === 'sterne') {
    // Nacht: kleine Sterne, die funkeln
    for (let i = 1; i < n; i++) {
      const tw = 0.5 + 0.5 * Math.sin(now / 300 + i * 1.7)
      ctx.fillStyle = `rgba(255, 255, 255, ${0.35 + 0.55 * tw})`
      const off = ((i * 37) % 10) / 10 - 0.5
      ctx.beginPath()
      ctx.arc(px(pts[i].x) + off * w * 0.4, px(pts[i].y) - off * w * 0.3, cell * (0.04 + 0.03 * tw), 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (skin.muster === 'glanz') {
    // Gold: ein heller Glanz laeuft vom Kopf zum Schwanz
    const pos = ((now / 30) % (n + 8)) - 4
    for (let i = 0; i < n - 1; i++) {
      const d = Math.abs(i - pos)
      if (d > 3) continue
      ctx.strokeStyle = `rgba(255, 252, 230, ${0.55 * (1 - d / 3)})`
      ctx.lineWidth = w * 0.5
      ctx.beginPath()
      ctx.moveTo(px(pts[i].x), px(pts[i].y))
      ctx.lineTo(px(pts[i + 1].x), px(pts[i + 1].y))
      ctx.stroke()
    }
  }

  // Lichtkante auf dem Ruecken
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.13)'
  ctx.lineWidth = w * 0.22
  ctx.beginPath()
  pts.slice(0, Math.min(n, 60)).forEach((p, i) => (i ? ctx.lineTo(px(p.x) - cell * 0.08, px(p.y) - cell * 0.1) : ctx.moveTo(px(p.x) - cell * 0.08, px(p.y) - cell * 0.1)))
  ctx.stroke()

  const hx = px(pts[0].x)
  const hy = px(pts[0].y)
  const d = STEP[dir]

  // Zunge
  if (o.zunge) {
    const l = cell * (0.45 + 0.1 * Math.sin(now / 30))
    const bx = hx + d.x * w * 0.5
    const by = hy + d.y * w * 0.5
    const ex = bx + d.x * l
    const ey = by + d.y * l
    ctx.strokeStyle = '#D9443A'
    ctx.lineWidth = Math.max(1.2, cell * 0.05)
    ctx.beginPath()
    ctx.moveTo(bx, by)
    ctx.lineTo(ex, ey)
    ctx.moveTo(ex, ey)
    ctx.lineTo(ex + d.x * cell * 0.1 + d.y * cell * 0.08, ey + d.y * cell * 0.1 + d.x * cell * 0.08)
    ctx.moveTo(ex, ey)
    ctx.lineTo(ex + d.x * cell * 0.1 - d.y * cell * 0.08, ey + d.y * cell * 0.1 - d.x * cell * 0.08)
    ctx.stroke()
  }

  // Kopf mit Augen in Laufrichtung
  ctx.fillStyle = farbe(0, 0)
  ctx.beginPath()
  ctx.arc(hx, hy, w * 0.56, 0, Math.PI * 2)
  ctx.fill()
  if (skin.id === 'gold' && !vg) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
    ctx.beginPath()
    ctx.arc(hx - w * 0.15, hy - w * 0.18, w * 0.16, 0, Math.PI * 2)
    ctx.fill()
  }
  const ox = d.y !== 0 ? cell * 0.2 : 0
  const oy = d.x !== 0 ? cell * 0.2 : 0
  for (const s of [-1, 1]) {
    const ex = hx + ox * s + d.x * cell * 0.1
    const ey = hy + oy * s + d.y * cell * 0.1
    if (o.tot) {
      ctx.strokeStyle = '#16211d'
      ctx.lineWidth = Math.max(1.5, cell * 0.06)
      const r = cell * 0.1
      ctx.beginPath()
      ctx.moveTo(ex - r, ey - r)
      ctx.lineTo(ex + r, ey + r)
      ctx.moveTo(ex + r, ey - r)
      ctx.lineTo(ex - r, ey + r)
      ctx.stroke()
      continue
    }
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    if (o.blinzeln) ctx.ellipse(ex, ey, cell * 0.15, cell * 0.03, d.x ? Math.PI / 2 : 0, 0, Math.PI * 2)
    else ctx.arc(ex, ey, cell * 0.15, 0, Math.PI * 2)
    ctx.fill()
    if (o.blinzeln) continue
    ctx.fillStyle = '#16211d'
    ctx.beginPath()
    ctx.arc(ex + d.x * cell * 0.06, ey + d.y * cell * 0.06, cell * 0.075, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** Vorschau fuer den Shop: kurze S-Kurve auf Schachbrett */
export function drawSkinVorschau(cv: HTMLCanvasElement, skin: Skin, now: number) {
  const dpr = Math.min(2.5, window.devicePixelRatio || 1)
  const w = cv.clientWidth || 120
  const h = cv.clientHeight || 80
  if (cv.width !== Math.round(w * dpr)) {
    cv.width = Math.round(w * dpr)
    cv.height = Math.round(h * dpr)
  }
  const ctx = cv.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const cell = h / 4
  const cols = Math.ceil(w / cell)
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < cols; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#A5D7B3' : '#B4E3C1'
      ctx.fillRect(x * cell, y * cell, cell, cell)
    }
  const ox = (w / cell - 6) / 2
  const pts: P[] = [
    { x: ox + 5, y: 1 },
    { x: ox + 4, y: 1 },
    { x: ox + 3, y: 1 },
    { x: ox + 3, y: 2 },
    { x: ox + 2, y: 2 },
    { x: ox + 1, y: 2 },
    { x: ox + 0, y: 2 },
  ]
  drawSchlange(ctx, pts, cell, 'r', skin, now, { blinzeln: now % 3000 < 120 })
}
