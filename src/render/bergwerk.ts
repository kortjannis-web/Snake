/**
 * Bergwerk: Schienen (fest in den Boden-Kacheln), Stollen und Stolleneingaenge, Lore, Steinschlag, TNT mit Zuendschnur,
 * Erdbeben-Spalt, Fledermausschwarm, Grubenzwerg, Steingolem, Spinnennetz, abgestellte Loren.
 * Spiellogik in game.ts (bergwerkNachApfel, bergwerkTakt).
 */
import type { P } from '../game/types'

const TAU = Math.PI * 2
const h2 = (x: number, y: number, s = 0) => {
  const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453
  return v - Math.floor(v)
}

/* ================= Schienen und Stollen (fest im Boden) ================= */

/** Boden im Stollen: dunkler, festgetretener Fels mit Kies */
export function drawStollenBoden(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, z: number) {
  ctx.fillStyle = '#4A433E'
  ctx.fillRect(x - 0.3, y - 0.3, cell + 0.6, cell + 0.6)
  ctx.fillStyle = 'rgba(20, 16, 14, 0.35)'
  for (let i = 0; i < 4; i++) ctx.fillRect(x + ((z * 97 + i * 0.27) % 1) * cell * 0.85, y + ((z * 53 + i * 0.41) % 1) * cell * 0.85, cell * 0.1, cell * 0.07)
}

/** Schiene auf einem Feld: Schwellen quer, zwei Stahlschienen laengs (achse x = waagrecht) */
export function drawSchieneFeld(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, achse: 'x' | 'y') {
  ctx.save()
  ctx.translate(x + cell / 2, y + cell / 2)
  if (achse === 'y') ctx.rotate(Math.PI / 2)
  ctx.fillStyle = '#6B4A2C'
  for (const sx of [-0.28, 0.22]) ctx.fillRect(sx * cell - cell * 0.07, -cell * 0.36, cell * 0.14, cell * 0.72)
  ctx.fillStyle = '#9AA3AC'
  for (const sy of [-0.22, 0.22]) ctx.fillRect(-cell * 0.52, sy * cell - cell * 0.035, cell * 1.04, cell * 0.07)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
  for (const sy of [-0.22, 0.22]) ctx.fillRect(-cell * 0.52, sy * cell - cell * 0.035, cell * 1.04, cell * 0.02)
  ctx.restore()
}

/** Stolleneingang im Stein am Ende einer Schiene: Holzrahmen, dahinter dunkel. dir = Richtung vom Eingang zur Karte */
export function drawStolleneingang(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, winkel: number) {
  ctx.save()
  ctx.translate(x + cell / 2, y + cell / 2)
  ctx.rotate(winkel)
  ctx.fillStyle = '#0E0B0A'
  ctx.beginPath()
  ctx.ellipse(-cell * 0.05, 0, cell * 0.5, cell * 0.42, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#7A5634'
  ctx.fillRect(cell * 0.28, -cell * 0.5, cell * 0.16, cell * 1)
  ctx.fillRect(-cell * 0.4, -cell * 0.5, cell * 0.84, cell * 0.13)
  ctx.fillRect(-cell * 0.4, cell * 0.37, cell * 0.84, cell * 0.13)
  ctx.fillStyle = '#4E3620'
  ctx.fillRect(cell * 0.28, -cell * 0.5, cell * 0.05, cell * 1)
  ctx.restore()
}

/* ================= Lore ================= */

/** Warnung: die Schiene flackert, an den Eingaengen schwingt eine Glocke (k = 0..1) */
export function drawLoreWarnung(ctx: CanvasRenderingContext2D, cells: P[], cell: number, k: number, now: number) {
  const p = 0.5 + 0.5 * Math.sin(now / (k > 0.6 ? 60 : 140))
  ctx.fillStyle = `rgba(255, 210, 90, ${0.12 + 0.25 * p})`
  for (const c of cells) ctx.fillRect(c.x * cell, c.y * cell + cell * 0.3, cell, cell * 0.4)
  for (const c of [cells[0], cells[cells.length - 1]]) {
    const x = (c.x + 0.5) * cell
    const y = (c.y + 0.5) * cell - cell * 0.6
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(Math.sin(now / 90) * 0.5)
    ctx.fillStyle = '#F2B824'
    ctx.beginPath()
    ctx.moveTo(-cell * 0.22, cell * 0.18)
    ctx.quadraticCurveTo(-cell * 0.2, -cell * 0.25, 0, -cell * 0.25)
    ctx.quadraticCurveTo(cell * 0.2, -cell * 0.25, cell * 0.22, cell * 0.18)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#8A5A10'
    ctx.beginPath()
    ctx.arc(0, cell * 0.2, cell * 0.06, 0, TAU)
    ctx.fill()
    ctx.restore()
  }
}

/** Lore von oben (Holzkasten mit Eisenbeschlag, Erz darin). achse x = faehrt waagrecht, erste = vorderster Wagen */
export function drawLore(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, achse: 'x' | 'y', erste: boolean) {
  ctx.save()
  ctx.translate(x, y)
  if (achse === 'y') ctx.rotate(Math.PI / 2)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
  ctx.fillRect(-cell * 0.44, -cell * 0.36 + cell * 0.08, cell * 0.88, cell * 0.72)
  ctx.fillStyle = '#7A5634'
  ctx.fillRect(-cell * 0.44, -cell * 0.38, cell * 0.88, cell * 0.76)
  ctx.strokeStyle = '#3A3A40'
  ctx.lineWidth = Math.max(1.5, cell * 0.08)
  ctx.strokeRect(-cell * 0.44, -cell * 0.38, cell * 0.88, cell * 0.76)
  ctx.fillStyle = '#2E2622'
  ctx.fillRect(-cell * 0.32, -cell * 0.26, cell * 0.64, cell * 0.52)
  ctx.fillStyle = erste ? '#F2C14E' : '#8FA0B0'
  for (let i = 0; i < 4; i++) {
    ctx.beginPath()
    ctx.arc((i % 2 ? 0.12 : -0.12) * cell, (i < 2 ? -0.1 : 0.1) * cell, cell * 0.1, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}

/** Abgestellte Lore (leer, steht auf zwei Feldern nebeneinander) */
export function drawLoreAbgestellt(ctx: CanvasRenderingContext2D, p: P, cell: number) {
  ctx.save()
  ctx.translate((p.x + 0.5) * cell, (p.y + 0.5) * cell)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
  ctx.fillRect(-cell * 0.4, -cell * 0.34 + cell * 0.1, cell * 0.8, cell * 0.68)
  ctx.fillStyle = '#6A4A2C'
  ctx.fillRect(-cell * 0.4, -cell * 0.36, cell * 0.8, cell * 0.72)
  ctx.strokeStyle = '#2E2E34'
  ctx.lineWidth = Math.max(1.5, cell * 0.07)
  ctx.strokeRect(-cell * 0.4, -cell * 0.36, cell * 0.8, cell * 0.72)
  ctx.fillStyle = '#1E1814'
  ctx.fillRect(-cell * 0.28, -cell * 0.24, cell * 0.56, cell * 0.48)
  ctx.restore()
}

/* ================= Steinschlag, TNT, Spalt ================= */

/** Staub rieselt auf ein Feld, darunter waechst ein Schatten (k = 0..1 bis zum Fall) */
export function drawSteinWarnung(ctx: CanvasRenderingContext2D, p: P, cell: number, k: number, now: number) {
  const x = (p.x + 0.5) * cell
  const y = (p.y + 0.5) * cell
  ctx.fillStyle = `rgba(10, 8, 6, ${0.2 + 0.35 * k})`
  ctx.beginPath()
  ctx.ellipse(x, y, cell * (0.2 + 0.25 * k), cell * (0.16 + 0.2 * k), 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = 'rgba(200, 185, 160, 0.8)'
  for (let i = 0; i < 7; i++) {
    const z = (now / (500 + i * 60) + h2(p.x, p.y, i)) % 1
    ctx.fillRect(x + (h2(p.x + i, p.y, 3) - 0.5) * cell * 0.6, y - cell * 1.2 + z * cell * 1.2, 1.6, 1.6)
  }
  if (k > 0.75) {
    // Der Felsen faellt
    const f = (k - 0.75) / 0.25
    ctx.fillStyle = '#6B645E'
    ctx.beginPath()
    ctx.arc(x, y - (1 - f) * cell * 2.4, cell * (0.25 + 0.15 * f), 0, TAU)
    ctx.fill()
  }
}

/** TNT-Fass mit Zuendschnur; der Funke steht bei Index i (frac = Weg zum naechsten Feld) */
export function drawTnt(ctx: CanvasRenderingContext2D, weg: P[], fass: P, cell: number, i: number, frac: number, now: number) {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#2A2420'
  ctx.lineWidth = Math.max(1.5, cell * 0.08)
  ctx.beginPath()
  const rest = [...weg.slice(Math.max(0, i)), fass]
  rest.forEach((c, j) => (j ? ctx.lineTo((c.x + 0.5) * cell, (c.y + 0.5) * cell) : ctx.moveTo((c.x + 0.5) * cell, (c.y + 0.5) * cell)))
  ctx.stroke()
  // Funke
  const a = weg[Math.min(i, weg.length - 1)]
  const b = weg[i + 1] ?? fass
  const fx = (a.x + (b.x - a.x) * frac + 0.5) * cell
  const fy = (a.y + (b.y - a.y) * frac + 0.5) * cell
  const fl = 0.7 + 0.3 * Math.sin(now / 40)
  ctx.fillStyle = 'rgba(255, 200, 80, 0.5)'
  ctx.beginPath()
  ctx.arc(fx, fy, cell * 0.28 * fl, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#FFF3B0'
  for (let k = 0; k < 6; k++) {
    const w = k * 1.05 + now / 70
    ctx.fillRect(fx + Math.cos(w) * cell * 0.18 * fl, fy + Math.sin(w) * cell * 0.18 * fl, 2, 2)
  }
  // Fass
  const x = (fass.x + 0.5) * cell
  const y = (fass.y + 0.5) * cell
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
  ctx.beginPath()
  ctx.ellipse(x, y + cell * 0.12, cell * 0.38, cell * 0.28, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#C0392B'
  ctx.beginPath()
  ctx.arc(x, y, cell * 0.36, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = '#5A1A14'
  ctx.lineWidth = Math.max(1, cell * 0.05)
  ctx.beginPath()
  ctx.arc(x, y, cell * 0.24, 0, TAU)
  ctx.stroke()
  ctx.fillStyle = '#FFFFFF'
  ctx.font = `800 ${Math.round(cell * 0.26)}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('TNT', x, y + 1)
}

/** Erdbeben-Spalt: erst feine Risse (k = 0..1), dann offen (dunkler Abgrund mit gezackten Raendern) */
export function drawSpalt(ctx: CanvasRenderingContext2D, cells: P[], cell: number, k: number, offen: boolean, now: number) {
  ctx.lineCap = 'round'
  if (!offen) {
    const p = 0.5 + 0.5 * Math.sin(now / 70)
    ctx.strokeStyle = `rgba(20, 14, 10, ${0.4 + 0.4 * k})`
    ctx.lineWidth = Math.max(1, cell * (0.03 + 0.06 * k))
    ctx.beginPath()
    cells.forEach((c, i) => {
      const x = (c.x + 0.5 + (h2(c.x, c.y) - 0.5) * 0.4 * p) * cell
      const y = (c.y + 0.5 + (h2(c.y, c.x) - 0.5) * 0.4 * p) * cell
      if (i) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
    })
    ctx.stroke()
    return
  }
  for (const c of cells) {
    ctx.fillStyle = '#0B0807'
    ctx.beginPath()
    const x = c.x * cell
    const y = c.y * cell
    ctx.moveTo(x + cell * 0.05, y + cell * (0.15 + h2(c.x, c.y) * 0.15))
    ctx.lineTo(x + cell * 0.5, y + cell * (0.05 + h2(c.y, c.x) * 0.1))
    ctx.lineTo(x + cell * 0.95, y + cell * (0.15 + h2(c.x + 1, c.y) * 0.15))
    ctx.lineTo(x + cell * 0.95, y + cell * (0.7 + h2(c.x, c.y + 2) * 0.2))
    ctx.lineTo(x + cell * 0.5, y + cell * (0.85 + h2(c.x + 3, c.y) * 0.1))
    ctx.lineTo(x + cell * 0.05, y + cell * (0.7 + h2(c.x, c.y + 4) * 0.2))
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = 'rgba(255, 90, 30, 0.25)'
    ctx.fillRect(x + cell * 0.3, y + cell * 0.4, cell * 0.4, cell * 0.2)
  }
}

/* ================= Fledermausschwarm ================= */

/** Warnung: flatternde Schatten im Band; im Flug viele kleine Fledermaeuse (felder = gerade bedeckt) */
export function drawFledermaeuse(ctx: CanvasRenderingContext2D, felder: P[], cell: number, now: number) {
  for (const c of felder) {
    for (let i = 0; i < 2; i++) {
      const x = (c.x + 0.25 + h2(c.x, c.y, i) * 0.5) * cell
      const y = (c.y + 0.25 + h2(c.y, c.x, i) * 0.5) * cell + Math.sin(now / 60 + c.x + i) * cell * 0.08
      const f = Math.sin(now / 35 + c.x * 3 + i * 2)
      ctx.fillStyle = '#1A1418'
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.quadraticCurveTo(x - cell * 0.18, y - cell * 0.12 * f, x - cell * 0.32, y + cell * 0.02)
      ctx.quadraticCurveTo(x - cell * 0.16, y + cell * 0.04, x, y + cell * 0.06)
      ctx.quadraticCurveTo(x + cell * 0.16, y + cell * 0.04, x + cell * 0.32, y + cell * 0.02)
      ctx.quadraticCurveTo(x + cell * 0.18, y - cell * 0.12 * f, x, y)
      ctx.fill()
      ctx.fillStyle = '#FF5A5A'
      ctx.fillRect(x - 1.5, y + 0.5, 1.2, 1.2)
      ctx.fillRect(x + 0.5, y + 0.5, 1.2, 1.2)
    }
  }
}

export function drawFledermausWarnung(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, k: number, now: number) {
  const p = 0.5 + 0.5 * Math.sin(now / 80)
  ctx.fillStyle = `rgba(20, 10, 20, ${0.1 + 0.18 * p * k})`
  ctx.fillRect(x0, y0, w, h)
}

/* ================= Grubenzwerg, Golem, Netz ================= */

/** Grubenzwerg von oben: Helm mit Lampe, Bart, Spitzhacke */
export function drawZwerg(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, ang: number, lauf: number, s: number, a = 1, now = 0) {
  if (s <= 0 || a <= 0) return
  const u = cell * 0.5 * s
  ctx.save()
  ctx.globalAlpha *= a
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
  ctx.beginPath()
  ctx.ellipse(x, y + cell * 0.12, u * 0.75, u * 0.5, 0, 0, TAU)
  ctx.fill()
  ctx.translate(x, y)
  ctx.rotate(ang)
  const hack = lauf >= 0 ? Math.sin(lauf * TAU) * 0.4 : Math.sin(now / 300) * 0.6
  ctx.save()
  ctx.rotate(hack)
  ctx.strokeStyle = '#6B4A2C'
  ctx.lineWidth = Math.max(1.5, cell * 0.06)
  ctx.beginPath()
  ctx.moveTo(0, u * 0.3)
  ctx.lineTo(u * 0.75, u * 0.65)
  ctx.stroke()
  ctx.strokeStyle = '#9AA3AC'
  ctx.lineWidth = Math.max(1.5, cell * 0.07)
  ctx.beginPath()
  ctx.moveTo(u * 0.6, u * 0.35)
  ctx.quadraticCurveTo(u * 0.85, u * 0.6, u * 0.7, u * 0.95)
  ctx.stroke()
  ctx.restore()
  ctx.fillStyle = '#5A6B7A'
  ctx.beginPath()
  ctx.ellipse(-u * 0.05, 0, u * 0.5, u * 0.45, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#D9D2C5'
  ctx.beginPath()
  ctx.ellipse(u * 0.32, 0, u * 0.28, u * 0.24, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#F2C14E'
  ctx.beginPath()
  ctx.arc(-u * 0.05, 0, u * 0.36, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#FFF6C0'
  ctx.beginPath()
  ctx.arc(u * 0.22, 0, u * 0.1, 0, TAU)
  ctx.fill()
  ctx.restore()
}

/** Steingolem von oben: kantige Felsbrocken, glimmende Augen */
export function drawGolem(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, ang: number, lauf: number, s: number, a = 1, now = 0) {
  if (s <= 0 || a <= 0) return
  const u = cell * 0.62 * s
  ctx.save()
  ctx.globalAlpha *= a
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
  ctx.beginPath()
  ctx.ellipse(x, y + cell * 0.14, u * 1.0, u * 0.7, 0, 0, TAU)
  ctx.fill()
  ctx.translate(x, y)
  ctx.rotate(ang)
  const schw = lauf >= 0 ? Math.sin(lauf * TAU) * u * 0.15 : 0
  ctx.fillStyle = '#5E5751'
  for (const sy of [-1, 1]) {
    ctx.beginPath()
    ctx.rect(u * 0.05 + schw * sy, sy * u * 0.55 - u * 0.17, u * 0.45, u * 0.34)
    ctx.fill()
  }
  ctx.fillStyle = '#7A726B'
  ctx.beginPath()
  const pts = [[-0.7, -0.35], [-0.2, -0.6], [0.45, -0.45], [0.6, 0.1], [0.35, 0.5], [-0.3, 0.55], [-0.75, 0.15]]
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px * u, py * u) : ctx.moveTo(px * u, py * u)))
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#948B83'
  ctx.beginPath()
  ctx.moveTo(-0.2 * u, -0.6 * u)
  ctx.lineTo(0.45 * u, -0.45 * u)
  ctx.lineTo(0.1 * u, 0)
  ctx.closePath()
  ctx.fill()
  const gl = 0.6 + 0.4 * Math.sin(now / 250)
  ctx.fillStyle = `rgba(140, 230, 255, ${gl})`
  for (const sy of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(u * 0.42, sy * u * 0.14, u * 0.07, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}

/** Spinnennetz auf einem Feld */
export function drawNetz(ctx: CanvasRenderingContext2D, p: P, cell: number, a = 1) {
  const x = (p.x + 0.5) * cell
  const y = (p.y + 0.5) * cell
  const r = cell * 0.46
  ctx.save()
  ctx.globalAlpha *= a
  ctx.strokeStyle = 'rgba(235, 235, 240, 0.75)'
  ctx.lineWidth = Math.max(0.8, cell * 0.025)
  ctx.beginPath()
  for (let i = 0; i < 8; i++) {
    const w = (i / 8) * TAU
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(w) * r, y + Math.sin(w) * r)
  }
  for (const f of [0.35, 0.65, 0.95]) {
    for (let i = 0; i <= 8; i++) {
      const w = (i / 8) * TAU
      const px = x + Math.cos(w) * r * f
      const py = y + Math.sin(w) * r * f
      if (i) ctx.lineTo(px, py)
      else ctx.moveTo(px, py)
    }
  }
  ctx.stroke()
  ctx.restore()
}
