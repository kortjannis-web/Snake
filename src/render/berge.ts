/**
 * Berge rund um die Taeler einer Mission (Kampagne). Alles, was nicht zur Karte gehoert, ist Gebirge: am Fuss Wiese mit
 * Baeumen, darueber Fels, oben Schnee. Die Hoehe kommt aus dem Abstand zur naechsten Wiese (einmal je Mission berechnet).
 *
 * Die Missionen aendern sich nie: das Gebirge wird einmal in Kacheln (KACHEL x KACHEL Felder) vorgezeichnet und danach
 * nur noch kopiert. Neu gezeichnet wird nur bei einer neuen Feldgroesse oder Aufloesung.
 */

/** Kachelgroesse in Feldern */
const KACHEL = 8
/** So weit um die Karte herum wird die Hoehe berechnet (weiter draussen ist alles Gipfel) */
const RAND = 40
/** Hoechstens so viele Kacheln je Bild neu zeichnen (ausser beim ersten Bild) */
const JE_BILD = 4
/** Hoechstens so viele Kacheln merken */
const MERKEN = 60

type RGB = readonly [number, number, number]
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const rgb = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`
const hash = (x: number, y: number, s = 0) => {
  const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453
  return v - Math.floor(v)
}

/** Farben je Hoehe: Hang mit Gras, Fels, heller Fels, Schnee */
const STUFEN: { h: number; c: RGB }[] = [
  { h: 0.7, c: [98, 140, 80] },
  { h: 1.5, c: [128, 132, 96] },
  { h: 2.3, c: [142, 126, 106] },
  { h: 3.4, c: [146, 140, 132] },
  { h: 4.8, c: [176, 174, 170] },
  { h: 5.8, c: [238, 242, 246] },
]
function farbe(h: number): RGB {
  if (h <= STUFEN[0].h) return STUFEN[0].c
  for (let i = 1; i < STUFEN.length; i++) if (h <= STUFEN[i].h) return mix(STUFEN[i - 1].c, STUFEN[i].c, (h - STUFEN[i - 1].h) / (STUFEN[i].h - STUFEN[i - 1].h))
  return STUFEN[STUFEN.length - 1].c
}

export type BergKarte = { w: number; h: number; inside: (p: { x: number; y: number }) => boolean }

export class BergKacheln {
  private readonly W: number
  private readonly H: number
  /** Abstand zur naechsten Wiese je Feld (Felder, -1 = Wiese), Ausschnitt um RAND erweitert */
  private readonly dist: Int16Array
  private readonly drin: Uint8Array
  private kacheln = new Map<string, { cv: HTMLCanvasElement | null; benutzt: number }>()
  private stand = ''
  private bild = 0

  constructor(k: BergKarte) {
    this.W = k.w + 2 * RAND
    this.H = k.h + 2 * RAND
    this.dist = new Int16Array(this.W * this.H).fill(-1)
    this.drin = new Uint8Array(this.W * this.H)
    // Breitensuche von allen Wiesenfeldern nach aussen
    const q: number[] = []
    for (let y = 0; y < k.h; y++)
      for (let x = 0; x < k.w; x++)
        if (k.inside({ x, y })) {
          const i = (y + RAND) * this.W + x + RAND
          this.drin[i] = 1
          this.dist[i] = 0
          q.push(i)
        }
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi]
      const x = i % this.W
      const y = (i / this.W) | 0
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= this.W || ny >= this.H) continue
        const j = ny * this.W + nx
        if (this.dist[j] >= 0) continue
        this.dist[j] = this.dist[i] + 1
        q.push(j)
      }
    }
  }

  /** Hoehe eines Felds (Kartenkoordinaten), mit etwas Rauschen; Wiese = 0 */
  hoehe(x: number, y: number): number {
    const ix = x + RAND
    const iy = y + RAND
    const d = ix < 0 || iy < 0 || ix >= this.W || iy >= this.H ? 99 : this.dist[iy * this.W + ix]
    if (d === 0) return 0
    return Math.max(0.6, Math.min(8, (d < 0 ? 99 : d) * 1.05 + this.rauschen(x, y)))
  }

  /** Weiches Rauschen (Werte auf einem 4er-Gitter, dazwischen weich gemischt): Hoehen ohne Mosaik */
  private rauschen(x: number, y: number) {
    const gx = x / 4
    const gy = y / 4
    const ix = Math.floor(gx)
    const iy = Math.floor(gy)
    const fx = gx - ix
    const fy = gy - iy
    const sx = fx * fx * (3 - 2 * fx)
    const sy = fy * fy * (3 - 2 * fy)
    const a = hash(ix, iy, 2)
    const b = hash(ix + 1, iy, 2)
    const c = hash(ix, iy + 1, 2)
    const d = hash(ix + 1, iy + 1, 2)
    return (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy - 0.5) * 1.3
  }

  private wiese(x: number, y: number) {
    const ix = x + RAND
    const iy = y + RAND
    return ix >= 0 && iy >= 0 && ix < this.W && iy < this.H && this.drin[iy * this.W + ix] === 1
  }

  /** Sichtbare Kacheln zeichnen (ctx steht schon auf Kartenkoordinaten in CSS-Pixeln) */
  zeichnen(ctx: CanvasRenderingContext2D, cell: number, dpr: number, ex0: number, ey0: number, ex1: number, ey1: number) {
    const stand = `${cell}|${dpr}`
    if (stand !== this.stand) {
      this.stand = stand
      this.kacheln.clear()
    }
    this.bild++
    let neu = this.kacheln.size ? JE_BILD : Infinity
    const s = KACHEL * cell
    for (let ty = Math.floor(ey0 / KACHEL); ty <= Math.floor(ey1 / KACHEL); ty++)
      for (let tx = Math.floor(ex0 / KACHEL); tx <= Math.floor(ex1 / KACHEL); tx++) {
        const id = `${tx},${ty}`
        let k = this.kacheln.get(id)
        if (!k) {
          if (neu-- <= 0) continue
          k = { cv: this.kachel(tx, ty, cell, dpr), benutzt: 0 }
          this.kacheln.set(id, k)
        }
        k.benutzt = this.bild
        if (k.cv) ctx.drawImage(k.cv, tx * s, ty * s, s, s)
      }
    if (this.kacheln.size > MERKEN) {
      const alt = [...this.kacheln.entries()].sort((a, b) => a[1].benutzt - b[1].benutzt)
      for (const [id] of alt.slice(0, this.kacheln.size - MERKEN)) this.kacheln.delete(id)
    }
  }

  /** Eine Kachel vorzeichnen (null = nur Wiese, nichts zu tun) */
  private kachel(tx: number, ty: number, cell: number, dpr: number): HTMLCanvasElement | null {
    const x0 = tx * KACHEL
    const y0 = ty * KACHEL
    let berg = false
    for (let y = y0 - 1; y <= y0 + KACHEL && !berg; y++) for (let x = x0 - 1; x <= x0 + KACHEL; x++) if (!this.wiese(x, y)) berg = true
    if (!berg) return null
    const cv = document.createElement('canvas')
    cv.width = Math.ceil(KACHEL * cell * dpr)
    cv.height = cv.width
    const c = cv.getContext('2d')!
    c.setTransform(dpr, 0, 0, dpr, -x0 * cell * dpr, -y0 * cell * dpr)
    c.beginPath()
    c.rect(x0 * cell, y0 * cell, KACHEL * cell, KACHEL * cell)
    c.clip()
    const px = (v: number) => (v + 0.5) * cell
    // Etwas mehr als die Kachel: Formen der Nachbarfelder ragen herein
    const ax = x0 - 2
    const ay = y0 - 2
    const bx = x0 + KACHEL + 1
    const by = y0 + KACHEL + 1

    // 1. Grund: jedes Bergfeld in der Farbe seiner Hoehe, zur Wiese hin ein Schatten auf dem Gras
    for (let y = ay; y <= by; y++)
      for (let x = ax; x <= bx; x++) {
        if (this.wiese(x, y)) continue
        c.fillStyle = rgb(farbe(this.hoehe(x, y)))
        c.fillRect(x * cell - 0.4, y * cell - 0.4, cell + 0.8, cell + 0.8)
      }
    const sch = cell * 0.32
    for (let y = ay; y <= by; y++)
      for (let x = ax; x <= bx; x++) {
        if (!this.wiese(x, y)) continue
        const r: [boolean, number, number, number, number][] = [
          [!this.wiese(x, y - 1), x * cell, y * cell, cell, sch],
          [!this.wiese(x - 1, y), x * cell, y * cell, sch, cell],
          [!this.wiese(x + 1, y), (x + 1) * cell - sch * 0.6, y * cell, sch * 0.6, cell],
        ]
        for (const [an, rx, ry, rw, rh] of r) {
          if (!an) continue
          const gx = rw < cell ? c.createLinearGradient(rx === x * cell ? rx : rx + rw, 0, rx === x * cell ? rx + rw : rx, 0) : c.createLinearGradient(0, ry, 0, ry + rh)
          gx.addColorStop(0, 'rgba(24, 48, 20, 0.28)')
          gx.addColorStop(1, 'rgba(24, 48, 20, 0)')
          c.fillStyle = gx
          c.fillRect(rx, ry, rw, rh)
        }
      }

    // 2. Felsbrocken und Kuppen (runde Formen mit Licht oben links), oben Schnee
    for (let y = ay; y <= by; y++)
      for (let x = ax; x <= bx; x++) {
        if (this.wiese(x, y)) continue
        const h = this.hoehe(x, y)
        const z = hash(x, y, 3)
        if (h < 1.3 || z > (h < 2 ? 0.35 : 0.75)) continue
        const r = cell * (0.45 + hash(x, y, 4) * 0.4) * Math.min(1.3, 0.75 + h * 0.1)
        const cx = px(x) + (hash(x, y, 5) - 0.5) * cell * 0.5
        const cy = px(y) + (hash(x, y, 6) - 0.5) * cell * 0.5
        const f = farbe(h + 0.4)
        c.fillStyle = 'rgba(30, 26, 22, 0.22)'
        c.beginPath()
        c.ellipse(cx + r * 0.25, cy + r * 0.3, r, r * 0.9, 0, 0, Math.PI * 2)
        c.fill()
        const gr = c.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r)
        gr.addColorStop(0, rgb(mix(f, [255, 255, 255], 0.35)))
        gr.addColorStop(0.6, rgb(f))
        gr.addColorStop(1, rgb(mix(f, [40, 34, 30], 0.35)))
        c.fillStyle = gr
        c.beginPath()
        c.ellipse(cx, cy, r, r * 0.9, 0, 0, Math.PI * 2)
        c.fill()
        // Gipfel: Schneekappe
        if (h > 5.2 && this.hoehe(x - 1, y) <= h + 0.5 && this.hoehe(x, y - 1) <= h + 0.5) {
          c.fillStyle = 'rgba(250, 252, 255, 0.92)'
          c.beginPath()
          c.ellipse(cx - r * 0.18, cy - r * 0.22, r * 0.55, r * 0.42, -0.4, 0, Math.PI * 2)
          c.fill()
        }
      }

    // 3. Baeume am Fuss der Berge (von oben: runde Kronen, ab und zu eine Tanne)
    for (let y = ay; y <= by; y++)
      for (let x = ax; x <= bx; x++) {
        if (this.wiese(x, y)) continue
        const h = this.hoehe(x, y)
        if (h > 2.6 || hash(x, y, 7) > (h < 1.6 ? 0.5 : 0.18)) continue
        const cx = px(x) + (hash(x, y, 8) - 0.5) * cell * 0.4
        const cy = px(y) + (hash(x, y, 9) - 0.5) * cell * 0.4
        const r = cell * (0.34 + hash(x, y, 10) * 0.2)
        c.fillStyle = 'rgba(20, 40, 18, 0.3)'
        c.beginPath()
        c.ellipse(cx + r * 0.3, cy + r * 0.35, r, r * 0.85, 0, 0, Math.PI * 2)
        c.fill()
        if (hash(x, y, 11) < 0.35) {
          // Tanne: Stern aus Zweigen
          c.fillStyle = '#2F5D3A'
          c.beginPath()
          for (let i = 0; i < 14; i++) {
            const a = (i / 14) * Math.PI * 2
            const rr = i % 2 ? r * 0.5 : r * 1.05
            if (i) c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
            else c.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
          }
          c.closePath()
          c.fill()
          c.fillStyle = '#4C8452'
          c.beginPath()
          c.arc(cx - r * 0.12, cy - r * 0.12, r * 0.35, 0, Math.PI * 2)
          c.fill()
        } else {
          const herbst = hash(x, y, 12) < 0.07
          const gr = c.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r)
          gr.addColorStop(0, herbst ? '#E9B45A' : '#8CC66E')
          gr.addColorStop(0.7, herbst ? '#C97C33' : '#4E9A4E')
          gr.addColorStop(1, herbst ? '#9A5627' : '#356F3A')
          c.fillStyle = gr
          c.beginPath()
          c.arc(cx, cy, r, 0, Math.PI * 2)
          c.fill()
          c.fillStyle = herbst ? 'rgba(255, 230, 160, 0.35)' : 'rgba(200, 240, 170, 0.35)'
          c.beginPath()
          c.arc(cx - r * 0.3, cy - r * 0.32, r * 0.32, 0, Math.PI * 2)
          c.fill()
        }
      }
    return cv
  }
}
