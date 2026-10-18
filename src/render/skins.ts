/**
 * Skins der Schlange und ihre Zeichnung (Spiel und Shop-Vorschau nutzen dieselbe Funktion).
 * Klassik ist gratis, die anderen kosten Aepfel.
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
  muster?: 'sterne' | 'streifen' | 'glanz' | 'regenbogen' | 'punkte' | 'glut' | 'funkeln' | 'aurora'
  /** Farbe fuer Streifen, Punkte, Glanz (sonst Standard des Musters) */
  musterFarbe?: string
}

/** Preisstufen im Shop (in Aepfeln) mit Namen */
export const STUFEN: { preis: number; name: string }[] = [
  { preis: 0, name: 'Grundfarben (gratis)' },
  { preis: 250, name: 'Einfarbig' },
  { preis: 600, name: 'Kräftig' },
  { preis: 1200, name: 'Muster' },
  { preis: 2500, name: 'Elemente' },
  { preis: 4000, name: 'Edelmetall' },
  { preis: 6000, name: 'Kosmisch' },
  { preis: 9000, name: 'Legendär' },
]

/** Alle Skins. Die vier Grundfarben hat jeder, alles andere kauft man mit Aepfeln.
 *  Alte Ids (koralle, nacht, tiger, gold, regenbogen) bleiben, wer sie gekauft hat, behaelt sie */
export const SKINS: Skin[] = [
  // Grundfarben
  { id: 'klassik', name: 'Grün', preis: 0, kopf: [47, 143, 116], schwanz: [18, 66, 55] },
  { id: 'ozean', name: 'Blau', preis: 0, kopf: [64, 140, 220], schwanz: [24, 56, 120] },
  { id: 'sonne', name: 'Gelb', preis: 0, kopf: [246, 206, 72], schwanz: [190, 128, 20] },
  { id: 'kohle', name: 'Schwarz', preis: 0, kopf: [78, 78, 84], schwanz: [24, 24, 28] },
  // Einfarbig
  { id: 'minze', name: 'Minze', preis: 250, kopf: [150, 230, 190], schwanz: [50, 150, 120] },
  { id: 'himmel', name: 'Himmel', preis: 250, kopf: [150, 210, 250], schwanz: [60, 130, 200] },
  { id: 'pfirsich', name: 'Pfirsich', preis: 250, kopf: [255, 190, 150], schwanz: [210, 110, 80] },
  { id: 'flieder', name: 'Flieder', preis: 250, kopf: [210, 180, 240], schwanz: [130, 100, 180] },
  { id: 'sand', name: 'Sand', preis: 250, kopf: [232, 210, 160], schwanz: [160, 130, 80] },
  // Kraeftig
  { id: 'koralle', name: 'Koralle', preis: 600, kopf: [244, 128, 96], schwanz: [160, 52, 66] },
  { id: 'smaragd', name: 'Smaragd', preis: 600, kopf: [40, 200, 120], schwanz: [6, 90, 60] },
  { id: 'pink', name: 'Pink', preis: 600, kopf: [255, 110, 180], schwanz: [170, 30, 110] },
  { id: 'tuerkis', name: 'Türkis', preis: 600, kopf: [60, 220, 210], schwanz: [10, 110, 120] },
  { id: 'orange', name: 'Orange', preis: 600, kopf: [255, 150, 50], schwanz: [190, 80, 10] },
  // Muster
  { id: 'nacht', name: 'Nacht', preis: 1200, kopf: [70, 96, 170], schwanz: [22, 24, 60], muster: 'sterne' },
  { id: 'tiger', name: 'Tiger', preis: 1200, kopf: [246, 160, 70], schwanz: [200, 104, 36], muster: 'streifen' },
  { id: 'zebra', name: 'Zebra', preis: 1200, kopf: [245, 245, 240], schwanz: [200, 200, 195], muster: 'streifen', musterFarbe: 'rgba(20, 20, 24, 0.85)' },
  { id: 'leopard', name: 'Leopard', preis: 1200, kopf: [240, 200, 120], schwanz: [190, 140, 60], muster: 'punkte' },
  { id: 'marienkaefer', name: 'Käfer', preis: 1200, kopf: [230, 60, 50], schwanz: [150, 20, 20], muster: 'punkte', musterFarbe: 'rgba(15, 10, 10, 0.9)' },
  // Elemente
  { id: 'glut', name: 'Glut', preis: 2500, kopf: [255, 140, 40], schwanz: [120, 20, 10], muster: 'glut' },
  { id: 'eis', name: 'Eis', preis: 2500, kopf: [220, 245, 255], schwanz: [110, 180, 220], muster: 'funkeln' },
  { id: 'gift', name: 'Gift', preis: 2500, kopf: [170, 255, 60], schwanz: [40, 120, 20], muster: 'punkte', musterFarbe: 'rgba(230, 255, 160, 0.8)' },
  { id: 'tiefsee', name: 'Tiefsee', preis: 2500, kopf: [30, 110, 160], schwanz: [6, 20, 50], muster: 'funkeln', musterFarbe: '#7FE8FF' },
  // Edelmetall
  { id: 'gold', name: 'Gold', preis: 4000, kopf: [255, 214, 102], schwanz: [170, 118, 28], muster: 'glanz' },
  { id: 'silber', name: 'Silber', preis: 4000, kopf: [225, 228, 235], schwanz: [120, 125, 140], muster: 'glanz' },
  { id: 'rosegold', name: 'Roségold', preis: 4000, kopf: [245, 190, 170], schwanz: [170, 100, 90], muster: 'glanz' },
  // Kosmisch
  { id: 'galaxie', name: 'Galaxie', preis: 6000, kopf: [120, 60, 200], schwanz: [20, 10, 60], muster: 'sterne' },
  { id: 'aurora', name: 'Aurora', preis: 6000, kopf: [255, 255, 255], schwanz: [255, 255, 255], muster: 'aurora' },
  // Legendaer
  { id: 'regenbogen', name: 'Regenbogen', preis: 9000, kopf: [255, 255, 255], schwanz: [255, 255, 255], muster: 'regenbogen' },
  { id: 'diamant', name: 'Diamant', preis: 9000, kopf: [200, 250, 255], schwanz: [90, 180, 220], muster: 'funkeln', musterFarbe: '#FFFFFF' },
]
/** Gratis-Skins hat jeder */
export const hatSkin = (besitz: string[], id: string) => skinVon(id).preis === 0 || besitz.includes(id)
export const skinVon = (id: string) => SKINS.find((s) => s.id === id) ?? SKINS[0]
/** Gegner-Schlangen: rot (nicht im Shop) */
export const GEGNER_SKIN: Skin = { id: 'gegner', name: 'Gegner', preis: 0, kopf: [232, 74, 60], schwanz: [128, 26, 34] }
/** Lila Gegner: laenger, schneller, boeser */
export const LILA_SKIN: Skin = { id: 'lila', name: 'Lila', preis: 0, kopf: [150, 72, 214], schwanz: [62, 20, 96] }

/**
 * Dauer der Muster-Animationen in ms. Ganze Teiler von SCHLEIFE, damit die vorgerenderten Shop-Videos nahtlos
 * wiederholen (siehe scripts/skin-videos.mjs). Der Glanz laeuft in der Vorschau (7 Glieder) alle 450 ms durch.
 */
export const TAKT = { regenbogen: 4000, aurora: 6000, sterne: 2000, glut: 1000, funkeln: 1500, blinzeln: 3000, glanzVorschau: 450 }
const welle = (now: number, takt: number) => ((now % takt) / takt) * Math.PI * 2
/** Wie lang ein Video sein muss, damit alles darin genau einmal (oder ganzzahlig oft) durchlaeuft */
export function schleifeMs(skin: Skin): number {
  const ggt = (a: number, b: number): number => (b ? ggt(b, a % b) : a)
  const kgv = (a: number, b: number) => (a / ggt(a, b)) * b
  const t = skin.muster === 'regenbogen' ? TAKT.regenbogen : skin.muster === 'aurora' ? TAKT.aurora : skin.muster === 'sterne' ? TAKT.sterne : skin.muster === 'glut' ? TAKT.glut : skin.muster === 'funkeln' ? TAKT.funkeln : skin.muster === 'glanz' ? TAKT.glanzVorschau : TAKT.blinzeln
  return kgv(t, TAKT.blinzeln)
}

const GIFT_KOPF: RGB = [126, 116, 60]
const GIFT_SCHWANZ: RGB = [70, 52, 70]
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export type SchlangeOpts = {
  tot?: boolean
  /** 0..1: faerbt sich nach einem Giftapfel kraenklich */
  vergiftet?: number
  zunge?: boolean
  blinzeln?: boolean
  /** Boese Augenbrauen (Gegner). 2 = noch boeser: dicke, steile Brauen und gluehende Augen */
  brauen?: boolean | 2
  /** 0..1: Pupillen weit, Brauen hochgezogen (Gegner auf der Flucht) */
  angst?: number
}

/** Schlange zeichnen. pts = Glieder in Feldkoordinaten, Kopf zuerst (bereits weich interpoliert). */
export function drawSchlange(ctx: CanvasRenderingContext2D, pts: P[], cell: number, dir: Dir, skin: Skin, now: number, o: SchlangeOpts = {}) {
  if (!pts.length) return
  const px = (v: number) => (v + 0.5) * cell
  const w = cell * 0.74
  const vg = o.vergiftet ?? 0
  const farbe = (k: number, i: number): string => {
    if (skin.muster === 'regenbogen' && !vg) return `hsl(${((now * 360) / TAKT.regenbogen + i * 14) % 360}, 72%, ${58 - k * 14}%)`
    // Aurora: Gruen, Tuerkis, Violett wandern ueber den Koerper
    if (skin.muster === 'aurora' && !vg) return `hsl(${150 + 70 * Math.sin(welle(now, TAKT.aurora) + i * 0.35) + 40}, 70%, ${60 - k * 18}%)`
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
    // Tiger/Zebra: dunkle Querstreifen jedes zweite Glied
    ctx.strokeStyle = skin.musterFarbe ?? 'rgba(40, 22, 10, 0.75)'
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
      const tw = 0.5 + 0.5 * Math.sin(welle(now, TAKT.sterne) + i * 1.7)
      ctx.fillStyle = `rgba(255, 255, 255, ${0.35 + 0.55 * tw})`
      const off = ((i * 37) % 10) / 10 - 0.5
      ctx.beginPath()
      ctx.arc(px(pts[i].x) + off * w * 0.4, px(pts[i].y) - off * w * 0.3, cell * (0.04 + 0.03 * tw), 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (skin.muster === 'punkte') {
    // Leopard, Kaefer, Gift: Flecken
    ctx.fillStyle = skin.musterFarbe ?? 'rgba(70, 40, 15, 0.8)'
    for (let i = 1; i < n; i++) {
      const off = ((i * 53) % 10) / 10 - 0.5
      ctx.beginPath()
      ctx.arc(px(pts[i].x) + off * w * 0.45, px(pts[i].y) - off * w * 0.35, w * (0.13 + ((i * 7) % 3) * 0.03), 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (skin.muster === 'glut') {
    // Glut: helle Hitzewellen laufen den Koerper entlang
    for (let i = 0; i < n - 1; i++) {
      const p = 0.5 + 0.5 * Math.sin(welle(now, TAKT.glut) - i * 0.7)
      ctx.strokeStyle = `rgba(255, 230, 120, ${0.15 + 0.45 * p * (1 - i / n)})`
      ctx.lineWidth = w * 0.45
      ctx.beginPath()
      ctx.moveTo(px(pts[i].x), px(pts[i].y))
      ctx.lineTo(px(pts[i + 1].x), px(pts[i + 1].y))
      ctx.stroke()
    }
  } else if (skin.muster === 'funkeln') {
    // Eis, Tiefsee, Diamant: kleine Kreuz-Funkeln
    ctx.strokeStyle = skin.musterFarbe ?? '#FFFFFF'
    ctx.lineWidth = Math.max(1, cell * 0.035)
    for (let i = 1; i < n; i++) {
      const tw = Math.max(0, Math.sin(welle(now, TAKT.funkeln) + i * 2.1))
      if (tw < 0.3) continue
      const r = cell * 0.12 * tw
      const off = ((i * 37) % 10) / 10 - 0.5
      const x = px(pts[i].x) + off * w * 0.4
      const y = px(pts[i].y) - off * w * 0.3
      ctx.beginPath()
      ctx.moveTo(x - r, y)
      ctx.lineTo(x + r, y)
      ctx.moveTo(x, y - r)
      ctx.lineTo(x, y + r)
      ctx.stroke()
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
  if (skin.muster === 'glanz' && !vg) {
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
    ctx.fillStyle = o.brauen === 2 ? '#FFE3A3' : '#fff'
    ctx.beginPath()
    if (o.blinzeln) ctx.ellipse(ex, ey, cell * 0.15, cell * 0.03, d.x ? Math.PI / 2 : 0, 0, Math.PI * 2)
    else ctx.arc(ex, ey, cell * 0.15, 0, Math.PI * 2)
    ctx.fill()
    if (o.blinzeln) continue
    ctx.fillStyle = o.brauen === 2 ? '#B3121F' : '#16211d'
    ctx.beginPath()
    ctx.arc(ex + d.x * cell * 0.06, ey + d.y * cell * 0.06, cell * (0.075 - 0.025 * (o.angst ?? 0)), 0, Math.PI * 2)
    ctx.fill()
    if (o.brauen) {
      // Braue vor dem Auge: innen tief (boese), auf der Flucht innen hochgezogen
      const a = o.angst ?? 0
      const q = { x: ox ? s : 0, y: oy ? s : 0 }
      // Lila: steiler und dicker (innen bleibt die Braue ueber dem Auge)
      const steil = o.brauen === 2 ? 0.06 : 0
      const vi = cell * (0.17 + 0.1 * a)
      const va = cell * (0.22 + steil)
      ctx.beginPath()
      ctx.moveTo(ex - q.x * cell * 0.1 + d.x * vi, ey - q.y * cell * 0.1 + d.y * vi)
      ctx.lineTo(ex + q.x * cell * 0.1 + d.x * va, ey + q.y * cell * 0.1 + d.y * va)
      ctx.strokeStyle = o.brauen === 2 ? '#1A0526' : '#3A0A0E'
      ctx.lineWidth = Math.max(1.4, cell * (o.brauen === 2 ? 0.09 : 0.06))
      ctx.lineCap = 'round'
      ctx.stroke()
    }
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
  drawSchlange(ctx, pts, cell, 'r', skin, now, { blinzeln: now % TAKT.blinzeln < 120 })
}
