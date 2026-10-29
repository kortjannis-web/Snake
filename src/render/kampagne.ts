/**
 * Kampagnen-Karte einer Welt: eine weite Wiese, die nur nach oben und unten scrollt (links und rechts laeuft sie aus dem
 * Bild). Darauf 10 runde Missionsfelder auf einem geschwungenen Weg, Mission 5 mit Schatztruhe, Mission 10 mit
 * Totenschaedel, darueber "Coming Soon". Die Schlange des Spielers liegt als weicher Pfad von Feld zu Feld und waechst
 * mit jeder neuen Mission ein Stueck weiter.
 *
 * Leistung: Wiese, Huegel, Baeume und Weg werden einmal in ein Bild gezeichnet (nur neu bei anderer Breite), die
 * Missionsfelder einmal je Zustand als kleine Bilder. Je Bild werden nur der sichtbare Ausschnitt kopiert und die
 * Schlange gezeichnet.
 */
import type { MissionDef } from '../game/missionen'
import type { Dir, P } from '../game/types'
import { drawEffekt } from './effekte'
import { drawSchlange, spurTeil, type Skin } from './skins'

/** Abstand der Missionsfelder (CSS-Pixel) */
const ABSTAND = 132
/** Platz oben fuer "Coming Soon" und unten fuer den Start */
const OBEN = 300
const UNTEN = 210
/** Feldgroesse der Schlange auf der Karte (CSS-Pixel) */
const ZELLE = 24
/** Effekte und Spur auf der Karte etwas schwaecher als im Spiel */
const EFFEKT_STAERKE = 0.75
/** So schnell waechst die Schlange zur naechsten Mission (Pixel je ms) */
const WACHSEN = 0.32

export type FeldZustand = 'zu' | 'offen' | 'geschafft'

const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

export class KampagnenKarte {
  /** Breite und Hoehe der ganzen Karte (CSS-Pixel) */
  w = 0
  h = 0
  /** Missionsfelder (Mitte, Radius) */
  felder: { p: P; r: number }[] = []
  private start: P = { x: 0, y: 0 }
  /** Weg als dichte Punktliste mit Bogenlaenge */
  private weg: { x: number; y: number; s: number }[] = []
  /** Bogenlaenge bis zu jedem Missionsfeld */
  private feldS: number[] = []
  private bg: HTMLCanvasElement | null = null
  private bgStand = ''
  private sprites = new Map<string, HTMLCanvasElement>()
  /** Kopf der Schlange (Bogenlaenge) und wohin er waechst */
  private kopf = 0
  private kopfZiel = 0
  private fertig: (() => void) | null = null

  constructor(private readonly missionen: MissionDef[]) {}

  /** Groesse setzen (Breite des Bildschirms); baut Weg und Felder neu */
  messen(breite: number) {
    const w = Math.round(breite)
    if (w === this.w) return
    this.w = w
    const n = this.missionen.length
    this.h = OBEN + (n - 1) * ABSTAND + UNTEN
    const a = Math.min(w * 0.26, 120)
    this.felder = this.missionen.map((m, i) => ({
      p: { x: w / 2 + Math.sin(i * 1.2 + 0.5) * a, y: this.h - UNTEN - i * ABSTAND },
      r: m.art === 'boss' ? 36 : m.art === 'schatz' ? 32 : 28,
    }))
    this.start = { x: this.felder[0].p.x - a * 0.5, y: this.felder[0].p.y + 92 }
    // Catmull-Rom durch Start und alle Felder, dicht abgetastet
    const pts = [this.start, ...this.felder.map((f) => f.p)]
    const at = (i: number) => pts[Math.max(0, Math.min(pts.length - 1, i))]
    this.weg = [{ ...this.start, s: 0 }]
    this.feldS = []
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = at(i - 1)
      const p1 = at(i)
      const p2 = at(i + 1)
      const p3 = at(i + 2)
      for (let k = 1; k <= 30; k++) {
        const t = k / 30
        const t2 = t * t
        const t3 = t2 * t
        const x = 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3)
        const y = 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
        const l = this.weg[this.weg.length - 1]
        this.weg.push({ x, y, s: l.s + Math.hypot(x - l.x, y - l.y) })
      }
      this.feldS.push(this.weg[this.weg.length - 1].s)
    }
    this.bg = null
  }

  /** Punkt auf dem Weg bei Bogenlaenge s */
  private bei(s: number): P {
    const wg = this.weg
    if (s <= 0) return { x: wg[0].x, y: wg[0].y }
    let lo = 0
    let hi = wg.length - 1
    if (s >= wg[hi].s) return { x: wg[hi].x, y: wg[hi].y }
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1
      if (wg[m].s < s) lo = m
      else hi = m
    }
    const a = wg[lo]
    const b = wg[hi]
    const t = (s - a.s) / Math.max(1e-6, b.s - a.s)
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
  }

  /** Wo der Kopf steht, wenn die Schlange bis Mission nr (0 = keine) gewachsen ist: knapp vor dem Feld */
  private kopfBei(nr: number) {
    if (nr <= 0) return 10
    return this.feldS[nr - 1] - this.felder[nr - 1].r - 2
  }

  /** Schlange ohne Animation auf einen Stand setzen */
  setzen(nr: number) {
    this.kopf = this.kopfZiel = this.kopfBei(nr)
    this.fertig = null
  }

  /** Schlange bis Mission nr wachsen lassen, danach fertig() */
  wachsen(nr: number, fertig: () => void) {
    this.kopfZiel = this.kopfBei(nr)
    if (this.kopfZiel <= this.kopf + 0.5) {
      this.kopf = this.kopfZiel
      fertig()
      return
    }
    this.fertig = fertig
    this.wachsVon = this.kopf
    this.wachsT = -1
  }
  private wachsVon = 0
  private wachsT = -1

  /** Waechst die Schlange gerade? */
  get waechst() {
    return this.fertig !== null
  }

  /** Feld unter einem Punkt der Karte (oder -1) */
  treffer(x: number, y: number) {
    return this.felder.findIndex((f) => Math.hypot(f.p.x - x, f.p.y - y) <= f.r + 12)
  }

  /** Mitte des Felds von Mission nr in Kartenpixeln (fuer die Videos des Spielfuehrers) */
  feldMitte(nr: number) {
    return { ...this.felder[nr - 1].p }
  }

  /** Scrollposition, bei der Mission nr gut im Bild ist */
  scrollFuer(nr: number, vh: number) {
    const f = this.felder[Math.max(0, Math.min(this.felder.length - 1, nr - 1))]
    return Math.max(0, Math.min(this.h - vh, f.p.y - vh * 0.6))
  }

  /**
   * Ein Bild: sichtbarer Ausschnitt (scroll = oberer Rand in Kartenpixeln, vw x vh CSS-Pixel), Schlange, Felder.
   * zustand(i) sagt, wie Feld i aussieht; markiert = das Feld, das gerade dran ist (pulsiert)
   */
  zeichnen(ctx: CanvasRenderingContext2D, dpr: number, vw: number, vh: number, scroll: number, now: number, skin: Skin, zustand: (i: number) => FeldZustand, markiert: number, reduce: boolean) {
    if (this.fertig) {
      if (this.wachsT < 0) this.wachsT = now
      const dauer = Math.max(350, (this.kopfZiel - this.wachsVon) / WACHSEN)
      const t = reduce ? 1 : Math.min(1, (now - this.wachsT) / dauer)
      this.kopf = this.wachsVon + (this.kopfZiel - this.wachsVon) * easeInOut(t)
      if (t >= 1) {
        const f = this.fertig
        this.fertig = null
        f()
      }
    }
    const bdpr = Math.min(2, dpr)
    const stand = `${this.w}|${bdpr}`
    if (!this.bg || stand !== this.bgStand) {
      this.bgStand = stand
      this.bg = this.hintergrund(bdpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#8FC77E'
    ctx.fillRect(0, 0, vw, vh)
    // Nur den sichtbaren Teil des Hintergrunds kopieren
    const sy = Math.max(0, scroll)
    const sh = Math.min(this.h - sy, vh)
    if (sh > 0) ctx.drawImage(this.bg, 0, sy * bdpr, this.w * bdpr, sh * bdpr, (vw - this.w) / 2, sy - scroll, this.w, sh)
    ctx.translate((vw - this.w) / 2, -scroll)

    this.schlange(ctx, skin, now, reduce)

    // Missionsfelder (fertige Bilder), das aktuelle pulsiert
    this.felder.forEach((f, i) => {
      if (f.p.y + f.r + 20 < scroll || f.p.y - f.r - 20 > scroll + vh) return
      const z = zustand(i)
      const sp = this.sprite(i, z, bdpr)
      const g = sp.width / bdpr
      if (i === markiert && !reduce) {
        const p = 0.5 + 0.5 * Math.sin(now / 260)
        ctx.strokeStyle = `rgba(255, 236, 150, ${0.35 + 0.45 * p})`
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.arc(f.p.x, f.p.y, f.r + 7 + p * 5, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.drawImage(sp, f.p.x - g / 2, f.p.y - g / 2, g, g)
    })
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  }

  /** Die Schlange auf dem Weg: Schwanz am Start, Kopf bei this.kopf. Effekte und Spur gedaempft */
  private schlange(ctx: CanvasRenderingContext2D, skin: Skin, now: number, reduce: boolean) {
    const c = ZELLE
    const laenge = Math.max(c * 0.6, this.kopf)
    // Dicht abgetastet (weiche Kurven), Kopf zuerst, in Feldkoordinaten der Schlange
    const fein: P[] = []
    const schritt = c * 0.35
    for (let s = laenge; s > 0; s -= schritt) {
      const p = this.bei(s)
      fein.push({ x: p.x / c - 0.5, y: p.y / c - 0.5 })
    }
    const ende = this.bei(0)
    fein.push({ x: ende.x / c - 0.5, y: ende.y / c - 0.5 })
    if (fein.length < 2) return
    const k0 = this.bei(laenge)
    const k1 = this.bei(laenge - 4)
    const dx = k0.x - k1.x
    const dy = k0.y - k1.y
    const dir: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : dy > 0 ? 'd' : 'u'
    // Grob (ein Glied je Feld) fuer Effekte, die je Glied zeichnen
    const grob: P[] = []
    for (let s = laenge; s > 0; s -= c) {
      const p = this.bei(s)
      grob.push({ x: p.x / c - 0.5, y: p.y / c - 0.5 })
    }
    const e = skin.effekt
    if (e && !reduce) {
      ctx.globalAlpha = EFFEKT_STAERKE
      drawEffekt(ctx, e, grob, c, Math.atan2(dy, dx), now, 'hinten')
      ctx.globalAlpha = 1
    }
    // Spur: Teilchen ziehen langsam am Koerper entlang nach hinten
    if (skin.spur && !reduce) {
      const n = Math.min(48, Math.max(6, Math.round(laenge / (c * 0.9))))
      ctx.globalAlpha = EFFEKT_STAERKE
      for (let i = 0; i < n; i++) {
        const z = (now / 2400 + hash(i)) % 1
        const s = ((i / n + 1 - ((now / 9000) % 1)) % 1) * laenge - z * c
        const p = this.bei(s)
        const q = (hash(i + 7) - 0.5) * c * 0.8
        spurTeil(ctx, skin.spur.id, p.x + q, p.y - q * 0.5, c * 0.24, z * 0.9, i, now)
      }
      ctx.globalAlpha = 1
    }
    drawSchlange(ctx, fein, c, dir, e ? { ...skin, effekt: undefined } : skin, now, { blinzeln: now % 3000 < 120, zunge: !reduce && now % 2800 < 220 })
    if (e && !reduce) {
      ctx.globalAlpha = EFFEKT_STAERKE
      drawEffekt(ctx, e, grob, c, Math.atan2(dy, dx), now, 'vorn')
      ctx.globalAlpha = 1
    }
  }

  /** Missionsfeld als kleines Bild (je Zustand einmal) */
  private sprite(i: number, z: FeldZustand, dpr: number): HTMLCanvasElement {
    const id = `${i}|${z}|${dpr}`
    let cv = this.sprites.get(id)
    if (cv) return cv
    const m = this.missionen[i]
    const r = this.felder[i].r
    const g = Math.ceil((r + 14) * 2)
    cv = document.createElement('canvas')
    cv.width = Math.ceil(g * dpr)
    cv.height = cv.width
    const c = cv.getContext('2d')!
    c.setTransform(dpr, 0, 0, dpr, 0, 0)
    const x = g / 2
    const y = g / 2
    const zu = z === 'zu'
    const boss = m.art === 'boss'
    const schatz = m.art === 'schatz'
    // Schatten
    c.fillStyle = 'rgba(20, 50, 20, 0.28)'
    c.beginPath()
    c.ellipse(x + 2, y + 5, r + 1, r * 0.92, 0, 0, Math.PI * 2)
    c.fill()
    // Rand
    const rand = zu ? '#8E938A' : boss ? '#B23A3A' : schatz ? '#F2C14C' : z === 'geschafft' ? '#FFFFFF' : '#F2C14C'
    c.fillStyle = rand
    c.beginPath()
    c.arc(x, y, r, 0, Math.PI * 2)
    c.fill()
    // Flaeche
    const gr = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r)
    if (zu) {
      gr.addColorStop(0, '#D3D6CF')
      gr.addColorStop(1, '#A9ADA4')
    } else if (boss) {
      gr.addColorStop(0, '#5A3A44')
      gr.addColorStop(1, '#2A1A22')
    } else if (z === 'geschafft') {
      gr.addColorStop(0, '#8FD88F')
      gr.addColorStop(1, '#3E9A52')
    } else {
      gr.addColorStop(0, '#FFFBEF')
      gr.addColorStop(1, '#F1E2BC')
    }
    c.fillStyle = gr
    c.beginPath()
    c.arc(x, y, r - 4, 0, Math.PI * 2)
    c.fill()
    // Inhalt: Zahl, Schatztruhe oder Totenschaedel
    if (schatz) truhe(c, x, y - 1, r * 0.95, zu)
    else if (boss && m.boss === 'ent') entKopf(c, x, y - 1, r * 0.95, zu)
    else if (boss && m.dungeonBoss) kaefigKopf(c, x, y - 1, r * 0.95, zu)
    else if (boss) schaedel(c, x, y - 1, r * 0.95, zu)
    else {
      c.fillStyle = zu ? '#6E736B' : z === 'geschafft' ? '#FFFFFF' : '#2C1E14'
      c.font = `800 ${Math.round(r * 0.95)}px "Libre Franklin", system-ui, sans-serif`
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillText(String(m.nr), x, y + 1)
    }
    // Zahl als Plakette unten (Schatz und Boss)
    if (schatz || boss) {
      c.fillStyle = zu ? '#8E938A' : boss ? '#B23A3A' : '#C99A2E'
      c.beginPath()
      c.arc(x + r * 0.72, y + r * 0.72, 11, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = '#FFFFFF'
      c.font = '800 12px "Libre Franklin", system-ui, sans-serif'
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillText(String(m.nr), x + r * 0.72, y + r * 0.72 + 0.5)
    }
    // Geschafft: kleiner Stern
    if (z === 'geschafft') {
      c.fillStyle = '#F2C14C'
      c.strokeStyle = '#8A5A12'
      c.lineWidth = 1.2
      c.beginPath()
      const sx = x - r * 0.72
      const sy = y - r * 0.72
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + (k / 10) * Math.PI * 2
        const rr = k % 2 ? 4.5 : 10
        if (k) c.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr)
        else c.moveTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr)
      }
      c.closePath()
      c.fill()
      c.stroke()
    }
    this.sprites.set(id, cv)
    return cv
  }

  /** Wiese mit Huegeln, Baeumen, Blumen, einem Teich, dem Trampelpfad und oben "Coming Soon" */
  private hintergrund(dpr: number): HTMLCanvasElement {
    const { w, h } = this
    const cv = this.bg && this.bg.width === Math.ceil(w * dpr) && this.bg.height === Math.ceil(h * dpr) ? this.bg : document.createElement('canvas')
    cv.width = Math.ceil(w * dpr)
    cv.height = Math.ceil(h * dpr)
    const c = cv.getContext('2d')!
    c.setTransform(dpr, 0, 0, dpr, 0, 0)
    const bg = c.createLinearGradient(0, 0, 0, h)
    bg.addColorStop(0, '#A6D592')
    bg.addColorStop(1, '#86C076')
    c.fillStyle = bg
    c.fillRect(0, 0, w, h)
    let z = 1
    const r = () => hash(z++)
    // Abstand zum Weg (fuer Deko, die nicht auf dem Weg liegen soll)
    const wegAbstand = (x: number, y: number) => {
      let d = Infinity
      for (let i = 0; i < this.weg.length; i += 3) d = Math.min(d, Math.hypot(this.weg[i].x - x, this.weg[i].y - y))
      return d
    }
    // Hellere und dunklere Flecken im Gras
    for (let i = 0; i < Math.round(h / 22); i++) {
      const x = r() * w
      const y = r() * h
      const rr = 40 + r() * 90
      const g = c.createRadialGradient(x, y, 0, x, y, rr)
      const hell = r() < 0.5
      g.addColorStop(0, hell ? 'rgba(200, 236, 160, 0.35)' : 'rgba(70, 130, 60, 0.22)')
      g.addColorStop(1, 'rgba(0, 0, 0, 0)')
      c.fillStyle = g
      c.fillRect(x - rr, y - rr, rr * 2, rr * 2)
    }
    // Huegel: sanfte Kuppen mit Licht oben links
    for (let i = 0; i < Math.round(h / 150); i++) {
      const x = r() * w
      const y = r() * h
      const rx = 70 + r() * 90
      const ry = rx * (0.55 + r() * 0.2)
      c.fillStyle = 'rgba(40, 90, 40, 0.18)'
      c.beginPath()
      c.ellipse(x + 10, y + 12, rx, ry, 0, 0, Math.PI * 2)
      c.fill()
      const g = c.createRadialGradient(x - rx * 0.35, y - ry * 0.45, 4, x, y, rx)
      g.addColorStop(0, 'rgba(206, 238, 170, 0.75)')
      g.addColorStop(0.6, 'rgba(150, 204, 120, 0.55)')
      g.addColorStop(1, 'rgba(120, 180, 100, 0)')
      c.fillStyle = g
      c.beginPath()
      c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
      c.fill()
    }
    // Trampelpfad unter der Schlange
    c.lineCap = 'round'
    c.lineJoin = 'round'
    c.strokeStyle = 'rgba(176, 142, 92, 0.35)'
    c.lineWidth = 30
    c.beginPath()
    this.weg.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)))
    c.stroke()
    c.strokeStyle = 'rgba(214, 186, 130, 0.35)'
    c.lineWidth = 16
    c.stroke()
    // Teich
    for (let i = 0; i < 2; i++) {
      for (let v = 0; v < 20; v++) {
        const x = r() * w
        const y = OBEN + r() * (h - OBEN - 60)
        if (wegAbstand(x, y) < 95) continue
        const rx = 34 + r() * 22
        const ry = rx * 0.62
        c.fillStyle = '#6FA866'
        c.beginPath()
        c.ellipse(x, y, rx + 5, ry + 5, 0.2, 0, Math.PI * 2)
        c.fill()
        const g = c.createRadialGradient(x - rx * 0.3, y - ry * 0.3, 2, x, y, rx)
        g.addColorStop(0, '#9FDCEB')
        g.addColorStop(1, '#4C9FC0')
        c.fillStyle = g
        c.beginPath()
        c.ellipse(x, y, rx, ry, 0.2, 0, Math.PI * 2)
        c.fill()
        for (let k = 0; k < 3; k++) {
          c.fillStyle = '#5DAA58'
          c.beginPath()
          c.arc(x + (r() - 0.5) * rx, y + (r() - 0.5) * ry, 5, 0.4, Math.PI * 2 - 0.1)
          c.fill()
        }
        break
      }
    }
    // Blumen
    const bl = ['#FFFFFF', '#FFE27A', '#FF9FC8', '#C9B6FF']
    for (let i = 0; i < Math.round((w * h) / 2600); i++) {
      const x = r() * w
      const y = r() * h
      if (wegAbstand(x, y) < 22) continue
      c.fillStyle = bl[Math.floor(r() * bl.length)]
      c.beginPath()
      c.arc(x, y, 1.6 + r() * 1.4, 0, Math.PI * 2)
      c.fill()
    }
    // Steine
    for (let i = 0; i < Math.round(h / 90); i++) {
      const x = r() * w
      const y = r() * h
      if (wegAbstand(x, y) < 30) continue
      const rr = 4 + r() * 6
      c.fillStyle = 'rgba(40, 60, 40, 0.25)'
      c.beginPath()
      c.ellipse(x + 2, y + 2, rr, rr * 0.75, 0, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = '#B9B6AA'
      c.beginPath()
      c.ellipse(x, y, rr, rr * 0.75, 0, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = 'rgba(255, 255, 255, 0.35)'
      c.beginPath()
      c.ellipse(x - rr * 0.3, y - rr * 0.25, rr * 0.4, rr * 0.25, 0, 0, Math.PI * 2)
      c.fill()
    }
    // Baeume: runde Kronen und Tannen, nie auf dem Weg und den Feldern; zum Rand hin dichter (Wald)
    const baeume: { x: number; y: number; r: number; tanne: boolean; herbst: boolean }[] = []
    for (let i = 0; i < Math.round(h / 9); i++) {
      const rand = r() < 0.6
      const x = rand ? (r() < 0.5 ? r() * w * 0.2 : w - r() * w * 0.2) : r() * w
      const y = r() * h
      if (wegAbstand(x, y) < 44) continue
      baeume.push({ x, y, r: 11 + r() * 9, tanne: r() < 0.3, herbst: r() < 0.06 })
    }
    baeume.sort((a, b) => a.y - b.y)
    for (const b of baeume) {
      c.fillStyle = 'rgba(20, 50, 20, 0.28)'
      c.beginPath()
      c.ellipse(b.x + b.r * 0.35, b.y + b.r * 0.4, b.r, b.r * 0.85, 0, 0, Math.PI * 2)
      c.fill()
      if (b.tanne) {
        c.fillStyle = '#2F5D3A'
        c.beginPath()
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2
          const rr = k % 2 ? b.r * 0.55 : b.r * 1.05
          if (k) c.lineTo(b.x + Math.cos(a) * rr, b.y + Math.sin(a) * rr)
          else c.moveTo(b.x + Math.cos(a) * rr, b.y + Math.sin(a) * rr)
        }
        c.closePath()
        c.fill()
        c.fillStyle = '#4C8452'
        c.beginPath()
        c.arc(b.x - b.r * 0.12, b.y - b.r * 0.12, b.r * 0.4, 0, Math.PI * 2)
        c.fill()
        continue
      }
      const g = c.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.35, 1, b.x, b.y, b.r)
      g.addColorStop(0, b.herbst ? '#F0BC62' : '#93CC72')
      g.addColorStop(0.7, b.herbst ? '#CF8236' : '#4F9C4F')
      g.addColorStop(1, b.herbst ? '#9E5A28' : '#356F3A')
      c.fillStyle = g
      c.beginPath()
      c.arc(b.x, b.y, b.r, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = 'rgba(210, 245, 180, 0.3)'
      c.beginPath()
      c.arc(b.x - b.r * 0.32, b.y - b.r * 0.32, b.r * 0.35, 0, Math.PI * 2)
      c.fill()
    }
    // Startpunkt: kleines Nest aus Gras
    c.fillStyle = 'rgba(120, 90, 50, 0.35)'
    c.beginPath()
    c.ellipse(this.start.x, this.start.y, 22, 14, 0, 0, Math.PI * 2)
    c.fill()
    // Oben: Nebel und "Coming Soon"
    const oben = this.felder[this.felder.length - 1].p.y - 70
    const nebel = c.createLinearGradient(0, 0, 0, oben)
    nebel.addColorStop(0, 'rgba(244, 248, 240, 0.92)')
    nebel.addColorStop(0.75, 'rgba(244, 248, 240, 0.7)')
    nebel.addColorStop(1, 'rgba(244, 248, 240, 0)')
    c.fillStyle = nebel
    c.fillRect(0, 0, w, oben)
    for (let i = 0; i < 9; i++) {
      const x = r() * w
      const y = 40 + r() * (oben - 80)
      const rr = 40 + r() * 50
      const g = c.createRadialGradient(x, y, 0, x, y, rr)
      g.addColorStop(0, 'rgba(255, 255, 255, 0.75)')
      g.addColorStop(1, 'rgba(255, 255, 255, 0)')
      c.fillStyle = g
      c.fillRect(x - rr, y - rr, rr * 2, rr * 2)
    }
    const ty = Math.max(90, oben * 0.5)
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillStyle = '#3E5A3A'
    c.font = '500 34px "Newsreader", Georgia, serif'
    c.fillText('Coming Soon', w / 2, ty)
    c.fillStyle = 'rgba(62, 90, 58, 0.75)'
    c.font = '600 13px "Libre Franklin", system-ui, sans-serif'
    c.fillText('Hinter den Wolken geht es weiter', w / 2, ty + 30)
    return cv
  }
}

/** Schatztruhe (Mission 5, Schatz-Level) */
function truhe(c: CanvasRenderingContext2D, x: number, y: number, r: number, grau: boolean) {
  const b = r * 0.95
  const hh = r * 0.55
  const holz = grau ? '#8D8F88' : '#8A5A2B'
  const dunkel = grau ? '#6F716B' : '#5E3A1A'
  const gold = grau ? '#C4C6C0' : '#F2C14C'
  // Schein
  if (!grau) {
    const g = c.createRadialGradient(x, y - r * 0.1, 1, x, y, r * 0.95)
    g.addColorStop(0, 'rgba(255, 226, 120, 0.85)')
    g.addColorStop(1, 'rgba(255, 226, 120, 0)')
    c.fillStyle = g
    c.beginPath()
    c.arc(x, y, r * 0.95, 0, Math.PI * 2)
    c.fill()
  }
  // Kasten
  c.fillStyle = holz
  c.fillRect(x - b / 2, y - hh * 0.05, b, hh * 0.7)
  // Deckel (Bogen)
  c.fillStyle = dunkel
  c.beginPath()
  c.moveTo(x - b / 2, y)
  c.quadraticCurveTo(x, y - hh * 0.95, x + b / 2, y)
  c.closePath()
  c.fill()
  // Beschlaege
  c.fillStyle = gold
  c.fillRect(x - b / 2, y - hh * 0.08, b, hh * 0.12)
  c.fillRect(x - b * 0.32, y - hh * 0.45, b * 0.09, hh * 1.1)
  c.fillRect(x + b * 0.23, y - hh * 0.45, b * 0.09, hh * 1.1)
  c.beginPath()
  c.arc(x, y + hh * 0.18, hh * 0.17, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = dunkel
  c.fillRect(x - hh * 0.04, y + hh * 0.18, hh * 0.08, hh * 0.18)
}

/** Totenschaedel (Mission 10, Boss-Level) */
/** Boss des Waldes: Kopf des Ents (Laubkrone, Rindengesicht, gluehende Augen) */
function entKopf(c: CanvasRenderingContext2D, x: number, y: number, r: number, grau: boolean) {
  const k = r * 0.5
  const laub = grau ? ['#AEB2AA', '#C5C8C0'] : ['#2F6B3A', '#5DA552']
  // Krone aus Laubballen
  for (let i = 0; i < 7; i++) {
    const a = Math.PI + (i / 6) * Math.PI
    c.fillStyle = laub[i % 2]
    c.beginPath()
    c.arc(x + Math.cos(a) * k * 0.75, y - k * 0.1 + Math.sin(a) * k * 0.7, k * 0.42, 0, Math.PI * 2)
    c.fill()
  }
  // Gesicht aus Rinde
  c.fillStyle = grau ? '#8E918A' : '#6B4A2C'
  c.beginPath()
  c.ellipse(x, y + k * 0.25, k * 0.62, k * 0.78, 0, 0, Math.PI * 2)
  c.fill()
  c.strokeStyle = grau ? '#7C7F78' : '#3E2816'
  c.lineWidth = k * 0.08
  c.lineCap = 'round'
  for (const dx of [-0.32, 0, 0.32]) {
    c.beginPath()
    c.moveTo(x + dx * k, y + k * 0.75)
    c.lineTo(x + dx * k * 0.8, y + k * 0.95)
    c.stroke()
  }
  // Brauen und Augen
  c.lineWidth = k * 0.14
  c.beginPath()
  c.moveTo(x - k * 0.5, y - k * 0.08)
  c.lineTo(x - k * 0.12, y + k * 0.06)
  c.moveTo(x + k * 0.5, y - k * 0.08)
  c.lineTo(x + k * 0.12, y + k * 0.06)
  c.stroke()
  c.fillStyle = grau ? '#D9DBD5' : '#F6DE6E'
  c.beginPath()
  c.arc(x - k * 0.28, y + k * 0.22, k * 0.13, 0, Math.PI * 2)
  c.arc(x + k * 0.28, y + k * 0.22, k * 0.13, 0, Math.PI * 2)
  c.fill()
  // Mund
  c.fillStyle = grau ? '#7C7F78' : '#2A1A10'
  c.beginPath()
  c.ellipse(x, y + k * 0.58, k * 0.2, k * 0.08, 0, 0, Math.PI * 2)
  c.fill()
}

/** Boss der Dungeons (Mission 30): ein Kopf im runden Eisenkaefig, die Augen glimmen violett */
function kaefigKopf(c: CanvasRenderingContext2D, x: number, y: number, r: number, grau: boolean) {
  const k = r * 0.5
  c.fillStyle = grau ? '#8E918A' : '#3A3530'
  c.beginPath()
  c.ellipse(x, y + k * 0.1, k * 0.55, k * 0.68, 0, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = grau ? '#D9DBD5' : '#C9A8FF'
  c.beginPath()
  c.arc(x - k * 0.22, y + k * 0.02, k * 0.11, 0, Math.PI * 2)
  c.arc(x + k * 0.22, y + k * 0.02, k * 0.11, 0, Math.PI * 2)
  c.fill()
  c.strokeStyle = grau ? '#7C7F78' : '#9A968E'
  c.lineWidth = k * 0.1
  c.beginPath()
  c.ellipse(x, y + k * 0.1, k * 0.82, k * 0.92, 0, 0, Math.PI * 2)
  c.stroke()
  for (const dx of [-0.45, 0, 0.45]) {
    c.beginPath()
    c.ellipse(x, y + k * 0.1, Math.abs(dx) * k * 1.8 + 0.01, k * 0.92, 0, -Math.PI / 2, Math.PI / 2, dx < 0)
    c.stroke()
  }
  c.beginPath()
  c.moveTo(x - k * 0.82, y + k * 0.1)
  c.lineTo(x + k * 0.82, y + k * 0.1)
  c.stroke()
  c.fillStyle = grau ? '#7C7F78' : '#6E6C68'
  c.beginPath()
  c.arc(x, y - k * 0.86, k * 0.14, 0, Math.PI * 2)
  c.fill()
}

function schaedel(c: CanvasRenderingContext2D, x: number, y: number, r: number, grau: boolean) {
  const k = r * 0.5
  const knochen = grau ? '#D9DBD5' : '#F4EFE2'
  const loch = grau ? '#7C7F78' : '#2A1A22'
  // Gekreuzte Knochen
  c.strokeStyle = knochen
  c.lineCap = 'round'
  c.lineWidth = k * 0.22
  c.beginPath()
  c.moveTo(x - k * 1.1, y + k * 0.35)
  c.lineTo(x + k * 1.1, y + k * 1.15)
  c.moveTo(x + k * 1.1, y + k * 0.35)
  c.lineTo(x - k * 1.1, y + k * 1.15)
  c.stroke()
  c.fillStyle = knochen
  // Kopf und Kiefer
  c.beginPath()
  c.arc(x, y - k * 0.15, k * 0.82, Math.PI * 0.85, Math.PI * 2.15)
  c.lineTo(x + k * 0.45, y + k * 0.75)
  c.lineTo(x - k * 0.45, y + k * 0.75)
  c.closePath()
  c.fill()
  // Augen und Nase
  c.fillStyle = loch
  c.beginPath()
  c.ellipse(x - k * 0.33, y - k * 0.1, k * 0.22, k * 0.26, 0, 0, Math.PI * 2)
  c.ellipse(x + k * 0.33, y - k * 0.1, k * 0.22, k * 0.26, 0, 0, Math.PI * 2)
  c.fill()
  c.beginPath()
  c.moveTo(x, y + k * 0.18)
  c.lineTo(x - k * 0.1, y + k * 0.36)
  c.lineTo(x + k * 0.1, y + k * 0.36)
  c.closePath()
  c.fill()
  // Zaehne
  c.fillRect(x - k * 0.04, y + k * 0.5, k * 0.08, k * 0.25)
  c.fillRect(x - k * 0.24, y + k * 0.5, k * 0.08, k * 0.25)
  c.fillRect(x + k * 0.16, y + k * 0.5, k * 0.08, k * 0.25)
  if (!grau) {
    c.fillStyle = 'rgba(255, 80, 60, 0.85)'
    c.beginPath()
    c.arc(x - k * 0.33, y - k * 0.08, k * 0.07, 0, Math.PI * 2)
    c.arc(x + k * 0.33, y - k * 0.08, k * 0.07, 0, Math.PI * 2)
    c.fill()
  }
}
