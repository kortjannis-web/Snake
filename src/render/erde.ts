/**
 * Grosse Details in der Erde, ueber mehrere Felder: Gesteinsschichten, Wurzeln vom Grasrand, Felsbrocken,
 * Geoden mit Kristallen, Ammoniten, Dino-Skelette, Wurmgaenge, Wasseradern, Schatztruhen und Pilzgeflecht.
 * Alles fest je Weltfeld (sieht bei jedem Neuzeichnen gleich aus) und nur dort, wo ueberall Erde ist.
 * Wird in die Boden-Kacheln gezeichnet: jede Kachel zeichnet alles, was in sie hineinragt.
 */
import type { P } from '../game/types'
import type { Welt } from './welten'

const TAU = Math.PI * 2
const h2 = (x: number, y: number, s = 0) => {
  const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453
  return v - Math.floor(v)
}

type Art = 'fels' | 'geode' | 'dino' | 'ammonit' | 'truhe' | 'wurm' | 'ader' | 'myzel' | 'kristallader'
const GROESSE: Record<Art, [number, number]> = { fels: [2, 2], geode: [2, 2], dino: [3, 2], ammonit: [1, 1], truhe: [1, 1], wurm: [4, 1], ader: [5, 1], myzel: [3, 2], kristallader: [4, 1] }
const ARTEN: Record<string, Art[]> = {
  wiese: ['fels', 'fels', 'dino', 'ammonit', 'wurm', 'ader', 'myzel', 'truhe', 'geode'],
  winter: ['fels', 'fels', 'dino', 'ammonit', 'ader', 'truhe'],
  wueste: ['fels', 'dino', 'dino', 'ammonit', 'ammonit', 'truhe'],
  bergwerk: ['geode', 'geode', 'kristallader', 'kristallader', 'fels', 'truhe'],
  zauberwald: ['myzel', 'myzel', 'geode', 'fels', 'ader'],
  gruselwald: [],
}
/** Bereich je Detail (Felder) */
const BEREICH = 6

export type ErdeInfo = {
  /** Gehoert das Feld (Kartenkoordinaten) zur Karte? */
  drin: (x: number, y: number) => boolean
  /** Ist im Weltfeld etwas, das nicht ueberdeckt werden darf (Lava im Stein, Erz)? */
  belegt: (wx: number, wy: number) => boolean
  ursprung: P
}

/** Alles Grosse fuer den Bereich x0..x1, y0..y1 (Kartenkoordinaten) zeichnen */
export function drawGrosseErde(ctx: CanvasRenderingContext2D, w: Welt, info: ErdeInfo, cell: number, x0: number, y0: number, x1: number, y1: number) {
  const { drin, belegt, ursprung: o } = info
  // Gesteinsschichten: wellige Baender in Weltkoordinaten, nur in tiefer Erde
  if (w.id !== 'gruselwald') schichten(ctx, w, info, cell, x0, y0, x1, y1)
  // Wurzeln vom Grasrand (nicht in Wueste, Bergwerk, Gruselwald)
  if (w.id === 'wiese' || w.id === 'zauberwald' || w.id === 'winter')
    for (let y = y0 - 3; y <= y1 + 3; y++)
      for (let x = x0 - 3; x <= x1 + 3; x++) {
        if (drin(x, y)) continue
        const wx = x - o.x
        const wy = y - o.y
        if (h2(wx, wy, 1) > 0.035) continue
        for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
          if (!drin(x - dx, y - dy)) continue
          if (!drin(x - dx, y - dy) || drin(x + dx, y + dy)) continue
          wurzel(ctx, w, x, y, dx, dy, cell, h2(wx, wy, 2), drin)
          break
        }
      }
  const arten = ARTEN[w.id] ?? []
  if (!arten.length) return
  const rx0 = Math.floor((x0 - o.x - 5) / BEREICH)
  const rx1 = Math.floor((x1 - o.x + 5) / BEREICH)
  const ry0 = Math.floor((y0 - o.y - 5) / BEREICH)
  const ry1 = Math.floor((y1 - o.y + 5) / BEREICH)
  for (let ry = ry0; ry <= ry1; ry++)
    for (let rx = rx0; rx <= rx1; rx++) {
      if (h2(rx, ry, 3) > 0.62) continue
      const art = arten[Math.floor(h2(rx, ry, 4) * arten.length) % arten.length]
      const [gw, gh] = GROESSE[art]
      const ax = rx * BEREICH + Math.floor(h2(rx, ry, 5) * (BEREICH - gw + 1))
      const ay = ry * BEREICH + Math.floor(h2(rx, ry, 6) * (BEREICH - gh + 1))
      // ueberall Erde, mit einem Feld Abstand zur Karte, und nichts Wichtiges darunter
      let ok = true
      for (let j = -1; j <= gh && ok; j++)
        for (let i = -1; i <= gw && ok; i++) {
          const mx = ax + i + o.x
          const my = ay + j + o.y
          if (drin(mx, my)) ok = false
          else if (i >= 0 && j >= 0 && i < gw && j < gh && belegt(ax + i, ay + j)) ok = false
        }
      if (!ok) continue
      const px = (ax + o.x) * cell
      const py = (ay + o.y) * cell
      const z = h2(ax, ay, 7)
      ctx.save()
      zeichne(ctx, w, art, px, py, cell, z)
      ctx.restore()
    }
}

function schichten(ctx: CanvasRenderingContext2D, w: Welt, info: ErdeInfo, cell: number, x0: number, y0: number, x1: number, y1: number) {
  const { drin, ursprung: o } = info
  const farben = w.id === 'wueste' ? ['#7A3E22', '#C88A55', '#5A2A18'] : w.id === 'bergwerk' ? ['#2A2624', '#6A625C', '#1A1716'] : w.id === 'winter' ? ['#2A2428', '#7A8290', '#1E1A1E'] : w.id === 'zauberwald' ? ['#2A1E3A', '#4A3A66', '#160F20'] : ['#5A3D27', '#1E140D', '#6A5A4A']
  const alpha = w.id === 'wueste' ? 0.22 : 0.16
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (drin(x, y)) continue
      // Nur tiefer als zwei Felder vom Rand
      let nah = false
      for (let j = -2; j <= 2 && !nah; j++) for (let i = -2; i <= 2 && !nah; i++) if (drin(x + i, y + j)) nah = true
      if (nah) continue
      const wx = x - o.x
      const wy = y - o.y
      ctx.save()
      ctx.beginPath()
      ctx.rect(x * cell - 0.5, y * cell - 0.5, cell + 1, cell + 1)
      ctx.clip()
      for (let k = Math.floor(wy / 4.3) - 1; k <= Math.floor(wy / 4.3) + 1; k++) {
        const mitte = (t: number) => k * 4.3 + Math.sin(t * 0.35 + k) * 0.7 + Math.sin(t * 1.3 + k * 2) * 0.12
        const dicke = 0.35 + h2(k, 0, 9) * 0.35
        ctx.fillStyle = farben[((k % 3) + 3) % 3]
        ctx.globalAlpha = alpha
        ctx.beginPath()
        for (let i = 0; i <= 4; i++) {
          const t = wx + i / 4
          ctx.lineTo((x + i / 4) * cell, (mitte(t) + o.y) * cell)
        }
        for (let i = 4; i >= 0; i--) {
          const t = wx + i / 4
          ctx.lineTo((x + i / 4) * cell, (mitte(t) + dicke + o.y) * cell)
        }
        ctx.fill()
      }
      ctx.restore()
    }
}

/** Wurzel ab dem Grasrand (zwischen Kartenfeld und Erdfeld x, y) in Richtung dx, dy, verzweigt */
function wurzel(ctx: CanvasRenderingContext2D, w: Welt, x: number, y: number, dx: number, dy: number, cell: number, z: number, drin: (x: number, y: number) => boolean) {
  const sx = x + 0.5 - dx * 0.5 + (dy ? (z - 0.5) * 0.6 : 0)
  const sy = y + 0.5 - dy * 0.5 + (dx ? (z - 0.5) * 0.6 : 0)
  const farbe = w.id === 'zauberwald' ? 'rgba(120, 255, 220, 0.55)' : w.id === 'winter' ? 'rgba(170, 150, 140, 0.7)' : 'rgba(176, 136, 92, 0.85)'
  ctx.save()
  ctx.strokeStyle = farbe
  ctx.lineCap = 'round'
  const ast = (px: number, py: number, a: number, l: number, d: number, tiefe: number) => {
    if (tiefe > 3 || l < 0.2) return
    let ex = px + Math.cos(a) * l
    let ey = py + Math.sin(a) * l
    // nicht in die Karte wachsen
    if (drin(Math.floor(ex), Math.floor(ey))) {
      ex = px + Math.cos(a) * l * 0.4
      ey = py + Math.sin(a) * l * 0.4
    }
    ctx.lineWidth = d * cell
    ctx.beginPath()
    ctx.moveTo(px * cell, py * cell)
    ctx.quadraticCurveTo(((px + ex) / 2 + Math.sin(z * 9 + tiefe) * 0.15) * cell, ((py + ey) / 2 + Math.cos(z * 7 + tiefe) * 0.15) * cell, ex * cell, ey * cell)
    ctx.stroke()
    ast(ex, ey, a - 0.45 - h2(z, tiefe) * 0.3, l * 0.62, d * 0.62, tiefe + 1)
    ast(ex, ey, a + 0.4 + h2(tiefe, z) * 0.3, l * 0.55, d * 0.58, tiefe + 1)
  }
  ast(sx, sy, Math.atan2(dy, dx) + (z - 0.5) * 0.5, 0.7 + z * 0.6, 0.075, 0)
  ctx.restore()
}

function zeichne(ctx: CanvasRenderingContext2D, w: Welt, art: Art, x: number, y: number, cell: number, z: number) {
  switch (art) {
    case 'fels': {
      // Grosser, runder Felsbrocken mit weicher Schattierung, Rissen und etwas Moos (oder Schnee)
      const cx = x + cell
      const cy = y + cell
      const r = cell * 0.88
      const pts: P[] = []
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU + z
        const rr = r * (0.82 + h2(i, z) * 0.2)
        pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr * 0.86 })
      }
      const pfad = () => {
        ctx.beginPath()
        pts.forEach((p, i) => {
          const q = pts[(i + 1) % pts.length]
          const mx = (p.x + q.x) / 2
          const my = (p.y + q.y) / 2
          if (i === 0) ctx.moveTo(mx, my)
          else ctx.quadraticCurveTo(p.x, p.y, mx, my)
        })
        const p = pts[0]
        const q = pts[1]
        ctx.quadraticCurveTo(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2)
        ctx.closePath()
      }
      const basis = w.id === 'wueste' ? ['#D2A06A', '#9A6A3E', '#6E4426'] : w.id === 'bergwerk' ? ['#8A827C', '#5A534E', '#36312E'] : w.id === 'zauberwald' ? ['#6A6280', '#433C58', '#2A2438'] : ['#9A928A', '#6B645E', '#45403C']
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.beginPath()
      ctx.ellipse(cx + cell * 0.08, cy + cell * 0.18, r, r * 0.8, 0, 0, TAU)
      ctx.fill()
      const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r * 1.1)
      g.addColorStop(0, basis[0])
      g.addColorStop(0.55, basis[1])
      g.addColorStop(1, basis[2])
      ctx.fillStyle = g
      pfad()
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,0.28)'
      ctx.lineWidth = Math.max(1, cell * 0.035)
      ctx.beginPath()
      ctx.moveTo(cx - r * 0.1, cy - r * 0.2)
      ctx.lineTo(cx + r * 0.15, cy + r * 0.15)
      ctx.lineTo(cx + r * 0.05, cy + r * 0.5)
      ctx.moveTo(cx + r * 0.15, cy + r * 0.15)
      ctx.lineTo(cx + r * 0.5, cy + r * 0.25)
      ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      ctx.beginPath()
      ctx.ellipse(cx - r * 0.35, cy - r * 0.42, r * 0.3, r * 0.14, -0.4, 0, TAU)
      ctx.fill()
      if (w.id === 'winter') {
        ctx.fillStyle = 'rgba(255,255,255,0.92)'
        ctx.beginPath()
        ctx.ellipse(cx - r * 0.15, cy - r * 0.55, r * 0.6, r * 0.25, -0.15, 0, TAU)
        ctx.fill()
      } else if (w.id === 'wiese' || w.id === 'zauberwald') {
        ctx.fillStyle = w.id === 'zauberwald' ? 'rgba(90, 255, 200, 0.35)' : 'rgba(90, 140, 60, 0.55)'
        for (let i = 0; i < 4; i++) {
          ctx.beginPath()
          ctx.arc(cx + r * (0.2 + h2(i, z, 2) * 0.4), cy + r * (0.3 + h2(z, i, 3) * 0.3), r * 0.1, 0, TAU)
          ctx.fill()
        }
      }
      break
    }
    case 'geode': {
      const cx = x + cell
      const cy = y + cell
      const lila = z > 0.5
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, cell * 1.2)
      g.addColorStop(0, lila ? 'rgba(190, 110, 255, 0.35)' : 'rgba(110, 220, 255, 0.35)')
      g.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = g
      ctx.fillRect(cx - cell * 1.3, cy - cell * 1.3, cell * 2.6, cell * 2.6)
      ctx.fillStyle = '#5B5560'
      ctx.beginPath()
      ctx.ellipse(cx, cy, cell * 0.9, cell * 0.76, z, 0, TAU)
      ctx.fill()
      ctx.fillStyle = lila ? '#2A1838' : '#132A38'
      ctx.beginPath()
      ctx.ellipse(cx, cy, cell * 0.68, cell * 0.55, z, 0, TAU)
      ctx.fill()
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU
        const bx = cx + Math.cos(a + z) * cell * 0.68
        const by = cy + Math.sin(a + z) * cell * 0.55
        const l = cell * (0.22 + h2(i, z) * 0.2)
        ctx.fillStyle = i % 2 ? (lila ? '#B57CFF' : '#56C8F0') : lila ? '#E0C2FF' : '#BFF2FF'
        ctx.beginPath()
        ctx.moveTo(bx + Math.cos(a + z + 1.57) * cell * 0.07, by + Math.sin(a + z + 1.57) * cell * 0.07)
        ctx.lineTo(bx - Math.cos(a + z) * l, by - Math.sin(a + z) * l)
        ctx.lineTo(bx - Math.cos(a + z + 1.57) * cell * 0.07, by - Math.sin(a + z + 1.57) * cell * 0.07)
        ctx.fill()
      }
      break
    }
    case 'kristallader': {
      ctx.strokeStyle = 'rgba(150, 120, 255, 0.35)'
      ctx.lineWidth = cell * 0.18
      ctx.lineCap = 'round'
      ctx.beginPath()
      for (let t = 0; t <= 1.0001; t += 0.1) ctx.lineTo(x + t * 4 * cell, y + (0.5 + Math.sin(t * 7 + z * 9) * 0.25) * cell)
      ctx.stroke()
      for (let i = 0; i < 7; i++) {
        const t = (i + 0.5) / 7
        const bx = x + t * 4 * cell
        const by = y + (0.5 + Math.sin(t * 7 + z * 9) * 0.25) * cell
        ctx.fillStyle = i % 2 ? '#B8F2FF' : '#D6B8FF'
        ctx.beginPath()
        ctx.moveTo(bx - cell * 0.08, by + cell * 0.05)
        ctx.lineTo(bx, by - cell * (0.2 + h2(i, z) * 0.15))
        ctx.lineTo(bx + cell * 0.08, by + cell * 0.05)
        ctx.fill()
      }
      break
    }
    case 'dino': {
      // Grosses Skelett: Wirbelsaeule, Rippen, Schaedel mit Zaehnen, Beine
      ctx.translate(x, y)
      const hell = w.id === 'winter' ? 'rgba(220, 235, 245, 0.9)' : 'rgba(232, 222, 200, 0.9)'
      ctx.strokeStyle = hell
      ctx.fillStyle = hell
      ctx.lineCap = 'round'
      const ruecken = (t: number) => ({ x: (0.2 + t * 2.3) * cell, y: (1.05 + Math.sin(t * 3.2 + z) * 0.28 - t * 0.35) * cell })
      ctx.lineWidth = cell * 0.08
      ctx.beginPath()
      for (let t = 0; t <= 1.0001; t += 0.05) {
        const p = ruecken(t)
        ctx.lineTo(p.x, p.y)
      }
      ctx.stroke()
      ctx.lineWidth = cell * 0.05
      for (let i = 4; i < 15; i++) {
        const p = ruecken(i / 20)
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.quadraticCurveTo(p.x + cell * 0.12, p.y + cell * 0.3, p.x - cell * 0.04, p.y + cell * 0.48)
        ctx.stroke()
      }
      // Beine
      for (const t of [0.3, 0.7]) {
        const p = ruecken(t)
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(p.x - cell * 0.15, p.y + cell * 0.55)
        ctx.lineTo(p.x + cell * 0.05, p.y + cell * 0.75)
        ctx.stroke()
      }
      // Schaedel
      const k = ruecken(1)
      ctx.beginPath()
      ctx.moveTo(k.x - cell * 0.05, k.y - cell * 0.18)
      ctx.lineTo(k.x + cell * 0.48, k.y - cell * 0.22)
      ctx.lineTo(k.x + cell * 0.55, k.y + cell * 0.05)
      ctx.lineTo(k.x + cell * 0.1, k.y + cell * 0.14)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = 'rgba(30, 20, 14, 0.85)'
      ctx.beginPath()
      ctx.arc(k.x + cell * 0.18, k.y - cell * 0.08, cell * 0.05, 0, TAU)
      ctx.fill()
      ctx.strokeStyle = 'rgba(30, 20, 14, 0.6)'
      ctx.lineWidth = Math.max(1, cell * 0.025)
      ctx.beginPath()
      for (let i = 0; i < 5; i++) {
        ctx.moveTo(k.x + cell * (0.22 + i * 0.07), k.y + cell * 0.03)
        ctx.lineTo(k.x + cell * (0.25 + i * 0.07), k.y + cell * 0.1)
      }
      ctx.stroke()
      break
    }
    case 'ammonit': {
      const cx = x + cell * 0.5
      const cy = y + cell * 0.5
      ctx.fillStyle = 'rgba(214, 196, 160, 0.9)'
      ctx.beginPath()
      ctx.arc(cx, cy, cell * 0.42, 0, TAU)
      ctx.fill()
      ctx.strokeStyle = 'rgba(120, 96, 60, 0.9)'
      ctx.lineWidth = Math.max(1, cell * 0.035)
      ctx.beginPath()
      for (let t = 0; t < 1; t += 0.01) ctx.lineTo(cx + Math.cos(t * 18 + z) * cell * 0.4 * (1 - t * 0.9), cy + Math.sin(t * 18 + z) * cell * 0.4 * (1 - t * 0.9))
      ctx.stroke()
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(a) * cell * 0.25, cy + Math.sin(a) * cell * 0.25)
        ctx.lineTo(cx + Math.cos(a) * cell * 0.4, cy + Math.sin(a) * cell * 0.4)
        ctx.stroke()
      }
      break
    }
    case 'truhe': {
      const tx = x + cell * 0.12
      const ty = y + cell * 0.25
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.fillRect(tx + cell * 0.04, ty + cell * 0.08, cell * 0.78, cell * 0.55)
      ctx.fillStyle = '#7A4A22'
      ctx.fillRect(tx, ty, cell * 0.76, cell * 0.52)
      ctx.fillStyle = '#5A3415'
      ctx.fillRect(tx, ty, cell * 0.76, cell * 0.18)
      ctx.fillStyle = '#E8B84A'
      ctx.fillRect(tx + cell * 0.33, ty + cell * 0.13, cell * 0.1, cell * 0.14)
      ctx.fillRect(tx - 1, ty + cell * 0.16, cell * 0.76 + 2, cell * 0.04)
      ctx.fillRect(tx + cell * 0.08, ty, cell * 0.05, cell * 0.52)
      ctx.fillRect(tx + cell * 0.63, ty, cell * 0.05, cell * 0.52)
      break
    }
    case 'wurm': {
      ctx.strokeStyle = 'rgba(20, 12, 8, 0.55)'
      ctx.lineWidth = cell * 0.13
      ctx.lineCap = 'round'
      ctx.beginPath()
      for (let t = 0; t <= 1.0001; t += 0.04) ctx.lineTo(x + (0.2 + t * 3.6) * cell, y + (0.5 + Math.sin(t * 9 + z * 6) * 0.3) * cell)
      ctx.stroke()
      // kleiner Wurm am Ende
      const ex = x + 3.8 * cell
      const ey = y + (0.5 + Math.sin(9 + z * 6) * 0.3) * cell
      ctx.strokeStyle = '#D98A8A'
      ctx.lineWidth = cell * 0.07
      ctx.beginPath()
      ctx.moveTo(ex - cell * 0.25, ey)
      ctx.quadraticCurveTo(ex - cell * 0.1, ey - cell * 0.12, ex, ey)
      ctx.stroke()
      break
    }
    case 'ader': {
      ctx.strokeStyle = w.id === 'zauberwald' ? 'rgba(200, 140, 255, 0.5)' : 'rgba(90, 170, 220, 0.5)'
      ctx.lineWidth = cell * 0.08
      ctx.lineCap = 'round'
      ctx.beginPath()
      for (let t = 0; t <= 1.0001; t += 0.03) ctx.lineTo(x + (0.1 + t * 4.8) * cell, y + (0.5 + Math.sin(t * 6 + z * 5) * 0.32) * cell)
      ctx.stroke()
      break
    }
    case 'myzel': {
      ctx.strokeStyle = w.id === 'zauberwald' ? 'rgba(120, 255, 220, 0.4)' : 'rgba(240, 235, 220, 0.3)'
      ctx.lineWidth = 1
      for (let i = 0; i < 16; i++) {
        const x0 = x + h2(i, z) * 3 * cell
        const y0 = y + h2(z, i) * 1.4 * cell
        ctx.beginPath()
        ctx.moveTo(x0, y0)
        ctx.quadraticCurveTo(x0 + (h2(i, 9) - 0.5) * cell, y0 + cell * 0.35, x0 + (h2(i, 19) - 0.5) * cell * 1.1, y0 + cell * 0.7)
        ctx.stroke()
      }
      // kleine Pilze
      for (let i = 0; i < 3; i++) {
        const px = x + (0.4 + i * 1.0) * cell
        const py = y + (0.3 + h2(i, z, 4) * 1.2) * cell
        ctx.fillStyle = w.id === 'zauberwald' ? '#9CF5FF' : '#C9A27A'
        ctx.beginPath()
        ctx.arc(px, py, cell * 0.1, Math.PI, 0)
        ctx.fill()
      }
      break
    }
  }
}
