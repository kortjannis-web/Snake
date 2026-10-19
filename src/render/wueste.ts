/**
 * Wueste (Insel): Flut am Rand, Sandwurm und Sandsturm zeichnen. Spiellogik in game.ts (wuesteNachApfel).
 */
import type { P } from '../game/types'

const TAU = Math.PI * 2
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

/**
 * Flut. warnung: die Wellen schlagen am Rand hoeher (Gischt laeuft ins Feld und zieht sich zurueck).
 * aktiv: die Felder stehen unter Wasser. rand(p) = Feld liegt direkt am Kartenrand
 */
export function drawFlut(ctx: CanvasRenderingContext2D, zellen: P[], aktiv: boolean, seit: number, cell: number, now: number, rand: (p: P) => boolean) {
  if (aktiv) {
    // Wasser steigt in 0,6 s an
    const an = Math.min(1, seit / 600)
    for (const c of zellen) {
      const x = c.x * cell
      const y = c.y * cell
      const z = hash(c.x * 7.3 + c.y * 3.1)
      ctx.fillStyle = rand(c) ? `rgba(46, 132, 178, ${0.92 * an})` : `rgba(70, 168, 200, ${0.85 * an})`
      ctx.fillRect(x - 0.3, y - 0.3, cell + 0.6, cell + 0.6)
      // Wellen ziehen ueber das Wasser
      const ph = now / 500 + z * 6
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.35 * an})`
      ctx.lineWidth = Math.max(1, cell * 0.045)
      ctx.beginPath()
      const by = y + cell * (0.35 + 0.3 * ((z * 3) % 1))
      const bx = x + cell * 0.1 + Math.sin(ph) * cell * 0.08
      ctx.moveTo(bx, by)
      ctx.quadraticCurveTo(bx + cell * 0.2, by - cell * 0.08, bx + cell * 0.4, by)
      ctx.quadraticCurveTo(bx + cell * 0.6, by + cell * 0.08, bx + cell * 0.8, by)
      ctx.stroke()
    }
    return
  }
  // Warnung: Gischt am aeussersten Ring, pulsiert und wird mit der Zeit kraeftiger
  const st = Math.min(1, 0.4 + seit / 6000)
  for (const c of zellen) {
    if (!rand(c)) continue
    const x = c.x * cell
    const y = c.y * cell
    const z = hash(c.x * 5.7 + c.y * 9.1)
    const welle = Math.max(0, Math.sin(now / 420 + z * 4))
    ctx.fillStyle = `rgba(90, 185, 215, ${0.45 * welle * st})`
    ctx.fillRect(x - 0.3, y - 0.3, cell + 0.6, cell + 0.6)
    ctx.fillStyle = `rgba(255, 255, 255, ${0.75 * welle * st})`
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.arc(x + cell * (0.2 + 0.3 * i), y + cell * (0.3 + 0.4 * hash(z * 10 + i)), cell * 0.08 * welle, 0, TAU)
      ctx.fill()
    }
  }
}

/** Sandwurm kuendigt sich an: die Reihe brodelt (Sandblasen platzen, Staub steigt), immer heftiger */
export function drawSandwurmWarnung(ctx: CanvasRenderingContext2D, felder: P[], cell: number, now: number, fortschritt: number) {
  const st = 0.35 + 0.65 * fortschritt
  for (const c of felder) {
    const x = (c.x + 0.5) * cell
    const y = (c.y + 0.5) * cell
    const z = hash(c.x * 3.3 + c.y * 7.7)
    // dunkler, aufgewuehlter Sand
    ctx.fillStyle = `rgba(150, 105, 50, ${0.22 * st})`
    ctx.fillRect(c.x * cell - 0.3, c.y * cell - 0.3, cell + 0.6, cell + 0.6)
    for (let i = 0; i < 2; i++) {
      const t = ((now / (700 - 300 * fortschritt) + z + i * 0.5) % 1 + 1) % 1
      const bx = x + (hash(z * 13 + i) - 0.5) * cell * 0.7
      const by = y + (hash(z * 17 + i) - 0.5) * cell * 0.6
      ctx.fillStyle = `rgba(110, 72, 30, ${0.6 * st * (1 - t)})`
      ctx.beginPath()
      ctx.arc(bx, by, cell * (0.05 + 0.13 * t), 0, TAU)
      ctx.fill()
      ctx.fillStyle = `rgba(235, 205, 150, ${0.5 * st * (1 - t)})`
      ctx.beginPath()
      ctx.arc(bx, by - t * cell * 0.35, cell * 0.04 * (1 + t), 0, TAU)
      ctx.fill()
    }
  }
}

/** Der Sandwurm: dicke Ringe, vorne ein runder Schlund mit Zaehnen, Sand spritzt. felder = Kopf zuerst */
export function drawSandwurm(ctx: CanvasRenderingContext2D, felder: P[], dx: number, dy: number, cell: number, now: number) {
  if (!felder.length) return
  const n = felder.length
  // Schatten und Koerper vom Ende zum Kopf
  for (let i = n - 1; i >= 0; i--) {
    const c = felder[i]
    const x = (c.x + 0.5) * cell
    const y = (c.y + 0.5) * cell
    const r = cell * (0.62 - 0.03 * i)
    ctx.fillStyle = 'rgba(60, 35, 10, 0.3)'
    ctx.beginPath()
    ctx.arc(x + cell * 0.08, y + cell * 0.14, r, 0, TAU)
    ctx.fill()
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r)
    g.addColorStop(0, '#E2B878')
    g.addColorStop(0.7, '#B9834A')
    g.addColorStop(1, '#7C4F25')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, TAU)
    ctx.fill()
    // Ringe quer zur Laufrichtung
    ctx.strokeStyle = 'rgba(90, 55, 20, 0.55)'
    ctx.lineWidth = Math.max(1, cell * 0.06)
    ctx.beginPath()
    ctx.moveTo(x - dy * r * 0.9 - dx * r * 0.3, y - dx * r * 0.9 - dy * r * 0.3)
    ctx.lineTo(x + dy * r * 0.9 - dx * r * 0.3, y + dx * r * 0.9 - dy * r * 0.3)
    ctx.stroke()
  }
  // Schlund mit Zaehnen
  const k = felder[0]
  const hx = (k.x + 0.5) * cell + dx * cell * 0.2
  const hy = (k.y + 0.5) * cell + dy * cell * 0.2
  const auf = 0.75 + 0.25 * Math.sin(now / 60)
  ctx.fillStyle = '#3A1A0C'
  ctx.beginPath()
  ctx.arc(hx, hy, cell * 0.42 * auf, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#F4EAD2'
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + now / 400
    const r0 = cell * 0.42 * auf
    ctx.beginPath()
    ctx.moveTo(hx + Math.cos(a - 0.15) * r0, hy + Math.sin(a - 0.15) * r0)
    ctx.lineTo(hx + Math.cos(a) * r0 * 0.55, hy + Math.sin(a) * r0 * 0.55)
    ctx.lineTo(hx + Math.cos(a + 0.15) * r0, hy + Math.sin(a + 0.15) * r0)
    ctx.fill()
  }
  // Sand spritzt vor dem Kopf auf
  for (let i = 0; i < 10; i++) {
    const t = ((now / 300 + i / 10) % 1 + 1) % 1
    const a = (hash(i) - 0.5) * 2.2
    const vx = dx * Math.cos(a) - dy * Math.sin(a)
    const vy = dy * Math.cos(a) + dx * Math.sin(a)
    ctx.fillStyle = `rgba(214, 178, 118, ${0.8 * (1 - t)})`
    ctx.beginPath()
    ctx.arc(hx + vx * t * cell * 1.1, hy + vy * t * cell * 1.1, cell * 0.07 * (1 - t * 0.5), 0, TAU)
    ctx.fill()
  }
}

/**
 * Sandsturm ueber dem Bild (Bildschirmkoordinaten): rund um den Kopf bleibt etwas Sicht, weiter weg wird es
 * dicht; Sandschlieren ziehen schraeg durchs Bild. staerke 0..1 (blendet ein und aus)
 */
export function drawSandsturm(ctx: CanvasRenderingContext2D, vw: number, vh: number, kx: number, ky: number, cell: number, staerke: number, now: number) {
  if (staerke <= 0) return
  const r0 = cell * 2.6
  const r1 = cell * 6.5
  const g = ctx.createRadialGradient(kx, ky, r0, kx, ky, r1)
  g.addColorStop(0, `rgba(205, 165, 105, ${0.12 * staerke})`)
  g.addColorStop(1, `rgba(196, 150, 90, ${0.82 * staerke})`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, vw, vh)
  // Schlieren
  ctx.strokeStyle = `rgba(240, 210, 160, ${0.35 * staerke})`
  ctx.lineWidth = 1.5
  for (let i = 0; i < 60; i++) {
    const sp = 0.25 + hash(i) * 0.35
    const x = ((hash(i + 3) * (vw + 200) + now * sp) % (vw + 200)) - 100
    const y = ((hash(i + 7) * (vh + 100) + now * sp * 0.35) % (vh + 100)) - 50
    const l = 20 + hash(i + 11) * 40
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + l, y + l * 0.35)
    ctx.stroke()
  }
  ctx.fillStyle = `rgba(250, 225, 180, ${0.5 * staerke})`
  for (let i = 0; i < 90; i++) {
    const x = ((hash(i + 21) * vw + now * (0.4 + hash(i) * 0.5)) % vw + vw) % vw
    const y = ((hash(i + 27) * vh + now * 0.12 + Math.sin(now / 300 + i) * 6) % vh + vh) % vh
    ctx.fillRect(x, y, 2, 1.5)
  }
}
