/**
 * Zeichnet ein Spiel auf das Canvas: Kamera folgt der Schlange (die Karte
 * kann groesser als der Bildschirm werden), neue Gebiete klappen Feld fuer
 * Feld auf, Apfel ausserhalb des Bildes zeigt ein Pfeil am Rand.
 */
import { ABGESCHNITTEN_LIEGT, ABGESCHNITTEN_WEG, AMEISE_WEG, GEGNER_WEG, type Game } from '../game/game'
import { BAUM_FALL, erdeBei, feldZufall, FROSCH_ANLAUF, FROSCH_FLUG, OPP, STEP, WOLKE_AUFLOESEN, WOLKE_WARNUNG, wolkenForm } from '../game/rules'
import type { Dir, Funke, GameEvent, Gegner, P } from '../game/types'
import { drawSchlange, GEGNER_SKIN, LILA_SKIN, SKINS, type Skin } from './skins'
import {
  C,
  apfelFarbe,
  apfelFarben,
  apfelPartikel,
  backOut,
  clamp01,
  DIR_WINKEL,
  drawAmeise,
  drawEis,
  drawErdDeko,
  drawErdFeld,
  drawErz,
  drawFrosch,
  drawLava,
  drawPower,
  drawKegel,
  drawTurm,
  drawApfel,
  drawBaum,
  drawBaumStehend,
  drawHaus,
  drawLicht,
  drawFalle,
  drawStein,
  drawTeich,
  drawWolkenFeld,
  drawWolkenKern,
  easeOut,
  rund,
} from './sprites'

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
/** S-Kurve mit flachem Anfang und Ende (auch die Beschleunigung setzt weich ein) */
const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
/** Weiches Maximum: wie Math.max, nur ohne Knick an der Uebergabestelle */
const weichMax = (a: number, b: number, k: number) => (a + b + Math.sqrt((a - b) * (a - b) + k * k)) / 2
/** Kamera: Bereich-Kamera mit festem Ausschnitt, die neue Bereiche frueh und weich vorwegnimmt,
 *  oder Drohne, die weich und in lockeren Boegen hinterherfliegt */
export type KameraArt = 'bereich' | 'dynamisch'
/** Die Kamera zeigt je Richtung so viele Felder mehr als ein Bildschirm der Spiellogik */
const MEHR_SICHT = 2
/** Drohnen-Kamera: Federhaerte (1/ms) und wie weit sie vor dem Kopf schwebt (Felder) */
const DROHNE = 0.0038
const DROHNE_VORAUS = 1.5
/** Bereich-Kamera: Federhaerte (1/ms) und Dauer des weichen Wechsels in den neuen Ausschnitt (ms) */
const BEREICH = 0.013
const BEREICH_WECHSEL = 1100
/** Mindestabstand Kopf (Mitte) zum Bildrand in Feldern, wo Karte ist: auf der Seite, von der die
 *  Schlange wegfaehrt, und auf der, auf die sie zufaehrt (quer dazwischen) */
const RAND_HINTEN = 6
const RAND_VORN = 7.2
/** Letzte Sicherung in Laufrichtung (Felder ab Kopfmitte): 5 ganze Felder vor dem Kopf */
const RAND_SICHER = 5.5
/** Seite des Ausschnitts je Achse und Richtung */
const SEITE: Record<'x' | 'y', Record<1 | -1, Dir>> = { x: { 1: 'r', [-1]: 'l' }, y: { 1: 'd', [-1]: 'u' } }

export class Renderer {
  readonly canvas: HTMLCanvasElement
  readonly ctx: CanvasRenderingContext2D
  reduce = false
  skin: Skin = SKINS[0]
  private dpr = 1
  vw = 0
  vh = 0
  cell = 20
  kameraArt: KameraArt = 'bereich'
  private cam = { x: 0, y: 0 }
  /** Geschwindigkeit der Kamera (px/ms): sie faehrt wie an einer gedaempften Feder,
   *  beschleunigt also sanft und bremst sanft ab, nie ruckartig */
  private camV = { x: 0, y: 0 }
  /** Weich nachgezogenes Ziel der Feder: so setzt auch die Beschleunigung sanft ein */
  private camZiel = { x: 0, y: 0 }
  private camInit = false
  /** Spielzeit beim letzten Bild (steht sie, laeuft das Spiel gerade nicht) */
  private camZeit = -1
  /** Bereich-Kamera: aktueller Ausschnitt (linke obere Ecke in Feldern) */
  private frame = { x: 0, y: 0 }
  private frameOk = false
  /** Ziel beim letzten Bild (Felder) und wodurch es bestimmt war: aendert sich das
   *  (neuer Ausschnitt, Karte gewachsen, Erde), gleitet die Kamera mit Ease hinueber */
  private bLetzt: P | null = null
  /** Ziel samt Mindestsicht beim letzten Bild (Felder) */
  private bAus: P | null = null
  private bSig = ''
  private bSigKarte = ''
  private uebergaenge: { x: number; y: number; t: number; nach: boolean }[] = []
  private uhr = 0
  /** Weich nachgezogene Laufrichtung je Seite (0 weg, 1 darauf zu) in zwei Stufen, und Tempo (Felder/ms) */
  private bRicht: Record<Dir, [number, number]> = { u: [0, 0], d: [0, 0], l: [0, 0], r: [0, 0] }
  /** Geister-Feder (Felder): dieselbe Feder wie die Kamera, nur dass sie dem Kopf folgt. Wie weit
   *  sie hinter dem Kopf haengt, so weit haengt auch die Kamera hinterher, wenn sie dem Kopf folgen
   *  muss, auch beim Abbiegen und Umkehren (haengt nicht von der Kamera ab, schaukelt also nichts auf) */
  private geist = { x: 0, y: 0, zx: 0, zy: 0, vx: 0, vy: 0 }
  /** Weich nachgezogene Verschiebung durch die Sicherung (px, zwei Stufen je Achse) */
  private sichtGlatt = { x: [0, 0], y: [0, 0] }
  /** Was die Sicherung zu jeder Seite mindestens sehen will (Felder ab Kopfmitte) */
  private sichtNoetig = { x: { plus: 0, minus: 0 }, y: { plus: 0, minus: 0 } }
  private funken: Funke[] = []
  /** Aufsteigende Zahlen (+12) und Namen beim Einsammeln */
  private texte: { x: number; y: number; t: number; text: string; farbe: string }[] = []
  /** Minikarte unten links anzeigen */
  minikarte = true
  private shake = { until: 0, amp: 0 }
  private lastReal = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d', { alpha: false })!
  }

  resize(vw: number, vh: number) {
    this.dpr = Math.min(2.5, window.devicePixelRatio || 1)
    this.vw = vw
    this.vh = vh
    this.canvas.width = Math.round(vw * this.dpr)
    this.canvas.height = Math.round(vh * this.dpr)
    this.canvas.style.width = `${vw}px`
    this.canvas.style.height = `${vh}px`
  }

  /** Neues Spiel: Kamera springt sofort an die richtige Stelle */
  reset() {
    this.camInit = false
    this.camV = { x: 0, y: 0 }
    this.frameOk = false
    this.sichtGlatt = { x: [0, 0], y: [0, 0] }
    this.funken = []
    this.texte = []
    this.shake = { until: 0, amp: 0 }
  }

  /** Feldgroesse so, dass ein Bildschirm (screenW x screenH) und je Richtung 2 Felder mehr hineinpassen */
  cellFor(g: Game) {
    return Math.max(4, Math.floor(Math.min(this.vw / (g.screenW + MEHR_SICHT), this.vh / (g.screenH + MEHR_SICHT))))
  }

  /** Neue Feldgroesse (Fenster geaendert): alles, was in Pixeln gespeichert ist, mitskalieren */
  private neueFeldgroesse(g: Game) {
    const neu = this.cellFor(g)
    if (neu !== this.cell && this.camInit) {
      const r = neu / this.cell
      for (const v of [this.cam, this.camZiel, this.camV]) {
        v.x *= r
        v.y *= r
      }
      for (const a of [this.sichtGlatt.x, this.sichtGlatt.y]) {
        a[0] *= r
        a[1] *= r
      }
      for (const f of this.funken) {
        f.x *= r
        f.y *= r
        f.vx *= r
        f.vy *= r
      }
      for (const t of this.texte) {
        t.x *= r
        t.y *= r
      }
    }
    this.cell = neu
  }

  event(e: GameEvent, g: Game) {
    const cell = this.cell
    if (e.type === 'eat' && !this.reduce) {
      const farben = apfelPartikel(e.stufe)
      for (let i = 0; i < 14; i++) {
        const ang = (Math.PI * 2 * i) / 14 + Math.random() * 0.4
        const sp = cell * (1.1 + Math.random() * 1.0)
        this.funken.push({
          x: (e.p.x + 0.5) * cell,
          y: (e.p.y + 0.5) * cell,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp - cell * 0.6,
          born: g.time,
          c: farben[i % farben.length],
        })
      }
    } else if (e.type === 'gegnerWeg' && !this.reduce) {
      // Gegner zerplatzt: rote Funken
      const farben = ['#E84A3C', '#FF8A73', '#801A22', '#F5EFE6']
      for (let i = 0; i < 18; i++) {
        const ang = (Math.PI * 2 * i) / 18 + Math.random() * 0.3
        const sp = cell * (1.3 + Math.random() * 1.3)
        this.funken.push({
          x: (e.p.x + 0.5) * cell,
          y: (e.p.y + 0.5) * cell,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp - cell * 0.5,
          born: g.time,
          c: farben[i % farben.length],
        })
      }
    } else if (e.type === 'expand') {
      // Alles ist um dx/dy gerutscht: Kamera mitnehmen, damit nichts springt
      this.kameraRutschen(e.dx, e.dy)
    } else if (e.type === 'freigelegt') {
      this.kameraRutschen(e.dx, e.dy)
      for (const f of [...this.funken, ...this.texte]) {
        f.x += e.dx * cell
        f.y += e.dy * cell
      }
    } else if (e.type === 'die') {
      if (!this.reduce) this.shake = { until: g.time + 450, amp: cell * 0.2 }
    } else if (e.type === 'fund') {
      this.texte.push({ x: (e.p.x + 0.5) * cell, y: e.p.y * cell, t: g.time, text: `+${e.wert}`, farbe: { gold: '#FFD86B', dia: '#9DF6FF', rubin: '#FF7D8F', opal: '#E99CFF' }[e.art] })
    } else if (e.type === 'geld' && e.quelle === 'futter') {
      this.texte.push({ x: (e.p.x + 0.5) * cell, y: e.p.y * cell, t: g.time, text: `+${e.wert}`, farbe: '#FFB38A' })
    } else if (e.type === 'geld' && e.quelle === 'gegner') {
      this.texte.push({ x: (e.p.x + 0.5) * cell, y: e.p.y * cell, t: g.time, text: `+${e.wert}`, farbe: apfelFarben(g.apfelStufe())[0][0] })
    } else if (e.type === 'power') {
      const name = {
        schild: 'Schild',
        zeitlupe: 'Zeitlupe',
        geist: 'Geist',
        schere: 'Schere',
        goldschere: 'Goldschere',
        fuettern: 'Füttern!',
        magnet: 'Magnet',
        maulwurf: 'Maulwurf',
        spitzhacke: 'Erz!',
      }[e.art]
      // Schere: an der Schnittstelle spritzen helle Funken (goldene: goldene), das Bild zuckt kurz
      const gold = e.art === 'goldschere'
      const schnitt = e.art === 'schere' || gold ? g.abgeschnitten[g.abgeschnitten.length - 1] : undefined
      const ab = schnitt && schnitt.t === g.time ? ` −${schnitt.cells.length}` : ''
      this.texte.push({ x: (e.p.x + 0.5) * cell, y: e.p.y * cell, t: g.time, text: name + (e.art === 'schere' || gold ? ab : ''), farbe: '#FFFFFF' })
      if (schnitt && schnitt.t === g.time && !this.reduce) {
        const c = schnitt.cells[0]
        for (let i = 0; i < (gold ? 20 : 12); i++) {
          const ang = (Math.PI * 2 * i) / (gold ? 20 : 12) + Math.random() * 0.4
          const sp = cell * (0.9 + Math.random() * 0.9)
          const farbe = gold ? (i % 2 ? '#FFE08A' : '#F2B824') : i % 2 ? '#FFFFFF' : '#C9D3DC'
          this.funken.push({ x: (c.x + 0.5) * cell, y: (c.y + 0.5) * cell, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - cell * 0.4, born: g.time, c: farbe })
        }
        this.shake = { until: g.time + 220, amp: cell * (gold ? 0.14 : 0.1) }
      }
    } else if (e.type === 'setback') {
      if (!this.reduce) this.shake = { until: g.time + 320, amp: cell * 0.14 }
    } else if (e.type === 'halt') {
      if (!this.reduce) this.shake = { until: g.time + 140, amp: cell * 0.07 }
    } else if (e.type === 'tree') {
      // Baum schlaegt auf: kurzes Beben, wenn man es sieht
      const nah = Math.abs((e.p.x + 0.5) * cell - this.cam.x) < this.vw / 2 + 3 * cell && Math.abs((e.p.y + 0.5) * cell - this.cam.y) < this.vh / 2 + 3 * cell
      if (nah && !this.reduce) this.shake = { until: g.time + 260, amp: cell * 0.09 }
    }
  }

  /** Die Karte ist um dx/dy Felder gerutscht: alles, was die Kamera sich merkt, mitnehmen */
  private kameraRutschen(dx: number, dy: number) {
    const { cell } = this
    for (const v of [this.cam, this.camZiel]) {
      v.x += dx * cell
      v.y += dy * cell
    }
    for (const v of [this.frame, this.bLetzt, this.bAus]) {
      if (!v) continue
      v.x += dx
      v.y += dy
    }
    this.geist.x += dx
    this.geist.zx += dx
    this.geist.y += dy
    this.geist.zy += dy
  }

  draw(g: Game) {
    const { ctx, vw, vh } = this
    const realNow = performance.now()
    const dt = this.lastReal ? Math.min(100, realNow - this.lastReal) : 16
    this.lastReal = realNow
    const now = g.time
    this.neueFeldgroesse(g)
    const cell = this.cell
    const px = (v: number) => (v + 0.5) * cell

    // Schlange (weich zwischen den Feldern)
    const a = this.reduce ? 1 : g.alpha()
    const n = g.body.length
    const h0 = g.prev[0] ?? g.body[0]
    const head = { x: lerp(h0.x, g.body[0].x, a), y: lerp(h0.y, g.body[0].y, a) }

    const cam = this.kamera(g, cell, dt, head)
    let ox = Math.round(vw / 2 - cam.x)
    let oy = Math.round(vh / 2 - cam.y)
    if (now < this.shake.until) {
      const f = (this.shake.until - now) / 450
      ox += Math.round((Math.random() - 0.5) * 2 * this.shake.amp * f)
      oy += Math.round((Math.random() - 0.5) * 2 * this.shake.amp * f)
    }

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    // Erde rund um die Karte: dunkelbraun, am Spielfeld eine hellere Erdkante.
    // Darin Steine, Kohle, Schlangenskelette, Lavataschen und Erze (fest je Weltfeld)
    ctx.fillStyle = '#2C1E14'
    ctx.fillRect(0, 0, vw, vh)
    ctx.translate(ox, oy)

    // Sichtbarer Bereich in Feldern (ex/ey auch ausserhalb der Karte)
    const ex0 = Math.floor(-ox / cell) - 1
    const ey0 = Math.floor(-oy / cell) - 1
    const ex1 = Math.ceil((vw - ox) / cell) + 1
    const ey1 = Math.ceil((vh - oy) / cell) + 1
    const x0 = Math.max(0, ex0)
    const y0 = Math.max(0, ey0)
    const x1 = Math.min(g.w - 1, ex1)
    const y1 = Math.min(g.h - 1, ey1)
    const sicht = (p: P, m = 2) => p.x >= x0 - m && p.x <= x1 + m && p.y >= y0 - m && p.y <= y1 + m
    const drin = (x: number, y: number) => g.inside({ x, y })
    const tunnel = new Set(g.tunnel.map((t) => t.x * 100_003 + t.y))
    const lavaStein: P[] = []
    for (let y = ey0; y <= ey1; y++)
      for (let x = ex0; x <= ex1; x++) {
        if (drin(x, y)) continue
        const wx = x - g.ursprung.x
        const wy = y - g.ursprung.y
        const z = feldZufall(wx, wy)
        if (tunnel.has(x * 100_003 + y)) {
          // Gegrabener Gang (Maulwurf)
          ctx.fillStyle = '#7A5434'
          ctx.fillRect(x * cell - 0.3, y * cell - 0.3, cell + 0.6, cell + 0.6)
          ctx.fillStyle = 'rgba(40, 24, 14, 0.4)'
          ctx.fillRect(x * cell + cell * z * 0.6, y * cell + cell * 0.3, cell * 0.12, cell * 0.08)
          continue
        }
        const ring = drin(x + 1, y) || drin(x - 1, y) || drin(x, y + 1) || drin(x, y - 1) ? 1 : drin(x + 1, y + 1) || drin(x - 1, y - 1) || drin(x + 1, y - 1) || drin(x - 1, y + 1) || drin(x + 2, y) || drin(x - 2, y) || drin(x, y + 2) || drin(x, y - 2) ? 2 : 0
        drawErdFeld(ctx, x * cell, y * cell, cell, ring, z)
        if (g.lavaImStein(wx, wy)) {
          lavaStein.push({ x, y })
          continue
        }
        const deko = erdeBei(g.cfg, wx, wy)
        if (!deko) continue
        if (deko === 'gold' || deko === 'dia' || deko === 'rubin' || deko === 'opal') {
          if (g.erzDa(wx, wy)) drawErz(ctx, px(x), px(y), cell * 0.8, deko, 1, this.reduce ? 0 : Math.max(0, Math.sin(now / 400 + z * 20)) * 0.9, now)
        } else drawErdDeko(ctx, x * cell, y * cell, cell, deko, z, now)
      }
    // Lava im Stein: einzelne Felder, die beim Freilegen ausbrechen
    for (const p of lavaStein) drawLava(ctx, [p], [-1e9], cell, now, this.reduce)

    // Schachbrett nur auf der Karte; der neue Block klappt als Welle auf. Erst die
    // dunkle Flaeche je Block, dann die hellen Felder etwas groesser (sonst feine Fugen)
    const gb = g.gebiet && now - g.gebiet.t < 2600 && !this.reduce ? g.gebiet : null
    ctx.fillStyle = C.dunkel
    for (const b of g.blocks) {
      if (gb && b.x * g.bw === gb.x && b.y * g.bh === gb.y) continue
      ctx.fillRect(b.x * g.bw * cell, b.y * g.bh * cell, g.bw * cell, g.bh * cell)
    }
    for (const c of g.extra) if (sicht(c)) ctx.fillRect(c.x * cell - 0.3, c.y * cell - 0.3, cell + 0.6, cell + 0.6)
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        if (!g.mask[y * g.w + x]) continue
        const neu = gb && x >= gb.x && x < gb.x + gb.w && y >= gb.y && y < gb.y + gb.h
        if (neu) {
          const dist = gb.side === 'top' ? gb.y + gb.h - 1 - y : gb.side === 'bottom' ? y - gb.y : gb.side === 'left' ? gb.x + gb.w - 1 - x : x - gb.x
          const p = clamp01((now - gb.t - 150 - dist * 45) / 380)
          if (p <= 0) continue
          const sz = cell * Math.min(1.08, backOut(p))
          ctx.fillStyle = p < 1 ? ((x + y) % 2 ? '#BFE8CB' : C.neuHell) : (x + y) % 2 ? C.dunkel : C.hell
          ctx.fillRect(x * cell + (cell - sz) / 2, y * cell + (cell - sz) / 2, sz, sz)
          continue
        }
        if ((x + y) % 2) continue
        ctx.fillStyle = C.hell
        ctx.fillRect(x * cell - 0.3, y * cell - 0.3, cell + 0.6, cell + 0.6)
      }
    // Grasrand am Uebergang zur Erde
    ctx.fillStyle = 'rgba(46, 96, 58, 0.7)'
    const kante = Math.max(2, cell * 0.1)
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        if (!g.mask[y * g.w + x]) continue
        if (!drin(x, y - 1)) ctx.fillRect(x * cell, y * cell, cell, kante)
        if (!drin(x, y + 1)) ctx.fillRect(x * cell, (y + 1) * cell - kante, cell, kante)
        if (!drin(x - 1, y)) ctx.fillRect(x * cell, y * cell, kante, cell)
        if (!drin(x + 1, y)) ctx.fillRect((x + 1) * cell - kante, y * cell, kante, cell)
      }

    // Neues Gebiet waehlen: die Waende, an die ein Block passt, gluehen (die letzten 5 s blinken sie)
    const blinkt = g.wahlBis - now < 5000 && !this.reduce && Math.sin(now / 70) < 0
    if (g.wahl > 0 && g.status === 'play' && !blinkt) {
      const belegt = new Set(g.blocks.map((b) => b.x * 1000 + b.y))
      const puls = this.reduce ? 1 : 0.5 + 0.5 * Math.sin(now / 170)
      for (const b of g.blocks)
        for (const d of ['u', 'd', 'l', 'r'] as const) {
          const st = STEP[d]
          if (belegt.has((b.x + st.x) * 1000 + b.y + st.y)) continue
          const bx = b.x * g.bw * cell
          const by = b.y * g.bh * cell
          const bw = g.bw * cell
          const bh = g.bh * cell
          const [ax, ay, zx, zy] =
            d === 'u' ? [bx, by, bx + bw, by] : d === 'd' ? [bx, by + bh, bx + bw, by + bh] : d === 'l' ? [bx, by, bx, by + bh] : [bx + bw, by, bx + bw, by + bh]
          ctx.lineCap = 'round'
          ctx.strokeStyle = `rgba(255, 180, 60, ${0.18 + 0.25 * puls})`
          ctx.lineWidth = cell * 0.7
          ctx.beginPath()
          ctx.moveTo(ax, ay)
          ctx.lineTo(zx, zy)
          ctx.stroke()
          ctx.strokeStyle = `rgba(255, 226, 120, ${0.7 + 0.3 * puls})`
          ctx.lineWidth = Math.max(2, cell * 0.14)
          ctx.stroke()
        }
    }

    // Lava und Eis. Freigelegte Lava, die noch nicht ausbrechen konnte, glimmt schon
    for (const p of g.lavaOffen) if (sicht(p)) drawErdDeko(ctx, p.x * cell, p.y * cell, cell, 'lava', feldZufall(p.x, p.y), now)
    for (const l of g.lava) if (l.cells.some((c) => sicht(c))) drawLava(ctx, l.cells, l.t, cell, now, this.reduce)
    for (const e of g.eis) if (e.cells.some((c) => sicht(c))) drawEis(ctx, e.cells, cell, this.reduce ? 1 : backOut(clamp01((now - e.t) / 500)), now)

    // Teiche (trocknen ggf. aus)
    for (const t of g.teiche) {
      if (!t.cells.some((c) => sicht(c))) continue
      let s = this.reduce ? 1 : backOut(clamp01((now - t.t) / 360))
      if (t.drying !== undefined) s *= 1 - clamp01((now - t.drying) / 1500)
      drawTeich(ctx, t.cells, cell, s, now)
    }

    // Alte Mauern schrumpfen weg, neue wachsen Feld fuer Feld
    if (!this.reduce) for (const m of g.weg) for (const c of m.cells) if (sicht(c)) drawStein(ctx, c.x * cell, c.y * cell, cell, 1 - (now - m.t) / 240)
    for (const m of g.mauern)
      for (let i = 0; i < m.grown; i++) {
        if (!sicht(m.cells[i])) continue
        const s = this.reduce ? 1 : backOut(clamp01((now - m.t[i]) / 320))
        drawStein(ctx, m.cells[i].x * cell, m.cells[i].y * cell, cell, s)
      }

    // Baeume und Haeuser (bleiben), dazu das Licht aus den Fenstern.
    // Baeume stehen erst (von oben ein Plus) und fallen dann langsam um
    for (const b of g.baeume) {
      if (!b.cells.some((c) => sicht(c, 3))) continue
      const s = this.reduce ? 1 : backOut(clamp01((now - b.t) / 520))
      if (b.kippBei !== null) {
        drawBaumStehend(ctx, b.root, cell, s)
        continue
      }
      const p = this.reduce ? 1 : clamp01((now - b.fallT) / BAUM_FALL)
      if (p >= 1) {
        drawBaum(ctx, b.root, b.dir, cell, s)
        continue
      }
      // Faellt: immer schneller (wie mit Schwerkraft). Von oben gesehen wird der liegende Baum
      // laenger (sin des Kippwinkels), die Krone von oben wandert mit und verschwindet.
      // Sein Schatten zeigt sofort, wo er landet
      const k = Math.sin((Math.PI / 2) * p * p)
      ctx.fillStyle = `rgba(12, 40, 32, ${0.2 * clamp01(p * 6) * (1 - k * 0.6)})`
      for (const c of b.cells) ctx.fillRect(c.x * cell, c.y * cell, cell, cell)
      drawBaum(ctx, b.root, b.dir, cell, 1, k)
      const d = STEP[b.dir]
      ctx.globalAlpha = 1 - k
      drawBaumStehend(ctx, b.root, cell, 1, { x: d.x * k * 2, y: d.y * k * 2 })
      ctx.globalAlpha = 1
    }
    for (const h of g.haeuser) {
      if (!h.cells.some((c) => sicht(c, 3))) continue
      const f = h.fenster[h.licht]
      const an = this.reduce ? 1 : clamp01((now - h.lichtT) / 450)
      if (f) drawLicht(ctx, f.p, f.d, h.strahl.length, cell, an * clamp01((now - h.t) / 600), now)
      drawHaus(ctx, h.cells, h.fenster, h.licht, h.kamin, cell, this.reduce ? 1 : backOut(clamp01((now - h.t) / 520)), now)
    }

    // Jaegertuerme: Kegel dreht sich mit, blendet nach jedem Wechsel ein
    for (const t of g.tuerme) {
      if (!t.cells.some((c) => sicht(c, 8))) continue
      const k = this.reduce ? 1 : easeOut(clamp01((now - t.kegelT) / 500))
      const a0 = DIR_WINKEL[t.altDir]
      let a1 = DIR_WINKEL[t.dir]
      while (a1 - a0 > Math.PI) a1 -= Math.PI * 2
      while (a1 - a0 < -Math.PI) a1 += Math.PI * 2
      const ang = lerp(a0, a1, k)
      const mitte = { x: (t.c.x + 1) * cell, y: (t.c.y + 1) * cell }
      drawKegel(ctx, t.kegel, mitte, DIR_WINKEL[t.dir], cell, k * clamp01((now - t.t) / 600), now)
      drawTurm(ctx, mitte.x, mitte.y, cell, ang, this.reduce ? 1 : backOut(clamp01((now - t.t) / 520)), now)
    }

    // Fallen: ploppen auf, blinken kurz vor dem Ende, schnappen zu
    for (const f of g.fallen) {
      if (!sicht(f.p)) continue
      const s = this.reduce ? 1 : backOut(clamp01((now - f.t) / 380))
      const rest = f.until - now
      const warn = (now - f.t < 1600 ? 1 - (now - f.t) / 1600 : 0) + (rest < 3000 ? 0.5 + 0.5 * Math.sin(now / 90) : 0)
      drawFalle(ctx, px(f.p.x), px(f.p.y), cell, s, 0, Math.min(1, warn))
    }
    for (const f of g.fallenWeg) {
      if (!sicht(f.p)) continue
      const k = clamp01((now - f.t) / 1000)
      drawFalle(ctx, px(f.p.x), px(f.p.y), cell, 1 - easeOut(clamp01((k - 0.5) * 2)), easeOut(clamp01(k * 4)))
    }

    // Apfel (Farbe nach Wert) und Giftaepfel (tarnen sich in derselben Farbe)
    const stufe = g.apfelStufe()
    const wipp = this.reduce ? 0 : Math.max(0, Math.sin(now / 260)) * cell * 0.05
    drawApfel(ctx, px(g.apple.p.x), px(g.apple.p.y), cell, this.reduce ? 1 : backOut(clamp01((now - g.apple.t) / 340)), wipp, undefined, stufe)
    for (const pw of g.powers) {
      if (!sicht(pw.p)) continue
      drawPower(ctx, px(pw.p.x), px(pw.p.y), cell, pw.art, this.reduce ? 1 : backOut(clamp01((now - pw.t) / 380)), now, pw.until - now < 3000)
    }
    for (const f of g.funde) {
      if (!sicht(f.p)) continue
      const hop = this.reduce ? 0 : Math.sin(now / 300 + f.p.x) * cell * 0.04
      drawErz(ctx, px(f.p.x), px(f.p.y) - hop, cell, f.art, this.reduce ? 1 : backOut(clamp01((now - f.t) / 400)), this.reduce ? 0 : Math.max(0, Math.sin(now / 250 + f.p.y)), now)
    }
    for (const gf of g.gift) {
      if (!sicht(gf.p)) continue
      drawApfel(ctx, px(gf.p.x), px(gf.p.y), cell, this.reduce ? 1 : backOut(clamp01((now - gf.t) / 340)), wipp * 0.6, gf.ecke, stufe)
    }

    // Froesche: Anlauf 1 s vor dem Sprung, Sprung im Bogen, Drehen nach der Landung
    for (const f of g.froesche) {
      const flug = (now - f.flugAb) / FROSCH_FLUG
      const k = clamp01(flug)
      const x = lerp(f.from.x, f.p.x, k)
      const y = lerp(f.from.y, f.p.y, k)
      if (!sicht({ x: Math.round(x), y: Math.round(y) })) continue
      const s = this.reduce ? 1 : backOut(clamp01((now - f.t) / 420))
      const fade = f.gone !== undefined ? 1 - clamp01((now - f.gone - FROSCH_FLUG * 0.5) / 400) : 1
      const anlauf = f.gone === undefined ? clamp01(1 - (f.hopAt - now) / FROSCH_ANLAUF) : 0
      const a0 = DIR_WINKEL[f.altDir]
      let a1 = DIR_WINKEL[f.dir]
      while (a1 - a0 > Math.PI) a1 -= Math.PI * 2
      while (a1 - a0 < -Math.PI) a1 += Math.PI * 2
      const ang = lerp(a0, a1, easeOut(clamp01((now - f.drehT) / 220)))
      drawFrosch(ctx, px(x), px(y), cell, ang, this.reduce ? 0 : anlauf, this.reduce || flug > 1 ? -1 : k, s, fade)
    }

    // Ameisen: krabbeln Feld fuer Feld, Ausrufezeichen wenn sie die Schlange bemerkt haben
    for (const am of g.ameisen) {
      if (!sicht(am.p)) continue
      const k = this.reduce ? 1 : easeOut(clamp01((now - am.schrittT) / 260))
      const x = lerp(am.from.x, am.p.x, k)
      const y = lerp(am.from.y, am.p.y, k)
      const lauf = k < 1 ? (now / 160) % 1 : -1
      const alarm = am.alarm >= 0 ? 0.6 + 0.4 * Math.sin(now / 90) : 0
      drawAmeise(ctx, px(x), px(y), cell, DIR_WINKEL[am.dir], lauf, this.reduce ? 1 : backOut(clamp01((now - am.t) / 380)), alarm)
    }
    for (const am of g.ameisenWeg) {
      if (!sicht(am.p)) continue
      const k = clamp01((now - am.t) / AMEISE_WEG)
      drawAmeise(ctx, px(am.p.x), px(am.p.y), cell * (1 + k * 0.4), DIR_WINKEL[am.dir], -1, 1, 0, 1 - k)
    }

    // Gegner-Schlangen (und besiegte, die zerfallen)
    for (const e of g.gegner) if (e.body.some((p) => sicht(p))) this.drawGegner(g, e, now)
    for (const w of g.gegnerWeg) if (w.g.body.some((p) => sicht(p))) this.drawGegner(g, w.g, now, w.t)

    // Von der Schere abgeschnittener Schwanz: bleibt kurz liegen, dann verblasst er
    for (const st of g.abgeschnitten) if (st.cells.some((p) => sicht(p))) this.drawAbgeschnitten(st, now)

    // Schlange
    if (n) this.drawSchlange(g, head, a)
    this.drawGrabWarnung(g, head, now)

    // Giftwolken ueber allem (mit Warnung vor dem Wachsen)
    for (const w of [...g.wolken, ...g.wolkenWeg]) {
      if (!sicht(w.c, 4)) continue
      const auf = w.until !== Infinity && now >= w.until ? 1 - clamp01((now - w.until) / WOLKE_AUFLOESEN) : 1
      w.cells.forEach((c, i) => {
        const s = this.reduce ? 1 : easeOut(clamp01((now - w.bornAt[i]) / 520))
        drawWolkenFeld(ctx, px(c.x), px(c.y), cell, s * (0.6 + 0.4 * auf), auf, now, c.x * 3.1 + c.y * 1.7)
      })
      for (const c of w.pending) drawWolkenFeld(ctx, px(c.x), px(c.y), cell, 0.7, 0.35 * auf, now, c.x + c.y)
      if (w.stage < w.maxStage && w.nextAt - now < WOLKE_WARNUNG && auf === 1) {
        const p = 0.5 + 0.5 * Math.sin(now / 80)
        const has = new Set(w.cells.map((c) => c.x * 10000 + c.y))
        ctx.strokeStyle = `rgba(150, 180, 40, ${0.35 + 0.45 * p})`
        ctx.lineWidth = Math.max(1.5, cell * 0.06)
        ctx.setLineDash([cell * 0.12, cell * 0.1])
        for (const o of wolkenForm(w.stage + 1)) {
          const c = { x: w.c.x + o.x, y: w.c.y + o.y }
          if (has.has(c.x * 10000 + c.y) || !g.inside(c)) continue
          ctx.beginPath()
          ctx.arc(px(c.x), px(c.y), cell * 0.36, 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.setLineDash([])
      }
      drawWolkenKern(ctx, px(w.c.x), px(w.c.y), cell, auf, now)
    }

    // Funken beim Fressen
    this.funken = this.funken.filter((f) => now - f.born < 560)
    for (const f of this.funken) {
      const t = (now - f.born) / 560
      ctx.globalAlpha = 1 - t
      ctx.fillStyle = f.c
      ctx.beginPath()
      ctx.arc(f.x + f.vx * t, f.y + f.vy * t + cell * 0.9 * t * t, cell * 0.12 * (1 - t * 0.5), 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // Aufsteigende Zahlen und Namen
    this.texte = this.texte.filter((t) => now - t.t < 900)
    ctx.textAlign = 'center'
    ctx.font = `700 ${Math.round(cell * 0.45)}px "Libre Franklin", system-ui, sans-serif`
    for (const t of this.texte) {
      const k = (now - t.t) / 900
      ctx.globalAlpha = 1 - k * k
      ctx.lineWidth = 3
      ctx.strokeStyle = 'rgba(23, 21, 19, 0.7)'
      ctx.strokeText(t.text, t.x, t.y - k * cell)
      ctx.fillStyle = t.farbe
      ctx.fillText(t.text, t.x, t.y - k * cell)
    }
    ctx.globalAlpha = 1

    // Apfel ausserhalb des Bildes: Pfeil am Rand
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    if (g.status === 'play') this.drawZeiger(g, ox, oy, now)
    if (this.minikarte) this.drawMinikarte(g, head)
  }

  private drawSchlange(g: Game, head: P, a: number) {
    const { ctx, cell } = this
    const now = g.time
    const n = g.body.length
    const tp = g.prev[n - 1]
    const tl = g.body[n - 1]
    const tail = tp ? { x: lerp(tp.x, tl.x, a), y: lerp(tp.y, tl.y, a) } : tl
    const pts: P[] = [head, ...g.body.slice(1), tail]
    const tot = g.status === 'over'
    const sinceDeath = now - g.deathAt
    if (tot && !this.reduce && sinceDeath < 900) ctx.globalAlpha = 0.55 + 0.45 * Math.abs(Math.cos(sinceDeath / 90))
    // Nach einem Rueckschlag geschuetzt: blinkt
    else if (!tot && now < g.schutzBis) ctx.globalAlpha = Math.sin(now / 55) > 0 ? 0.9 : 0.35
    // Geist (Power-up): durchscheinend, kurz vor dem Ende flackernd
    else if (!tot && now < g.effekt.geistBis) ctx.globalAlpha = g.effekt.geistBis - now < 1500 && Math.sin(now / 70) > 0 ? 0.75 : 0.45
    drawSchlange(ctx, pts, cell, g.dir, this.skin, now, {
      tot,
      vergiftet: g.cause === 'gift' ? clamp01(sinceDeath / 600) : 0,
      zunge: !tot && !this.reduce && now % 2800 < 220,
      blinzeln: !tot && now % 4300 < 120,
    })
    ctx.globalAlpha = 1
    const hx0 = (head.x + 0.5) * cell
    const hy0 = (head.y + 0.5) * cell
    // Fuettern: hungriger roter Schein um den Kopf
    if (!tot && now < g.effekt.fuetternBis) {
      const p = 0.5 + 0.5 * Math.sin(now / 90)
      ctx.strokeStyle = `rgba(240, 90, 60, ${0.45 + 0.35 * p})`
      ctx.lineWidth = Math.max(2, cell * 0.1)
      ctx.beginPath()
      ctx.arc(hx0, hy0, cell * (0.55 + 0.08 * p), 0, Math.PI * 2)
      ctx.stroke()
    }
    // Magnet: Reichweite als gestrichelter Kreis
    if (!tot && now < g.effekt.magnetBis) {
      ctx.strokeStyle = 'rgba(216, 67, 74, 0.55)'
      ctx.lineWidth = Math.max(1.5, cell * 0.05)
      ctx.setLineDash([cell * 0.2, cell * 0.15])
      ctx.lineDashOffset = -now / 40
      ctx.beginPath()
      ctx.arc(hx0, hy0, cell * (g.cfg.magnetRadius + 0.5), 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
    }
    // Maulwurf: Erdkruemel fliegen vom Kopf
    if (!tot && g.graebt() && !this.reduce) {
      ctx.fillStyle = 'rgba(122, 84, 52, 0.9)'
      for (let i = 0; i < 5; i++) {
        const t = ((now / 500 + i / 5) % 1)
        const a = i * 2.4 + Math.floor(now / 500) * 0.7
        ctx.beginPath()
        ctx.arc(hx0 + Math.cos(a) * cell * 0.6 * t, hy0 + Math.sin(a) * cell * 0.6 * t - cell * 0.2 * t, cell * 0.06 * (1 - t), 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  /** Abgeschnittene Glieder: kurz weisser Schnitt, dann bleiben sie eine Sekunde liegen
   *  (etwas blasser als die Schlange) und verblassen dann, dabei werden sie kleiner */
  private drawAbgeschnitten(st: Game['abgeschnitten'][number], now: number) {
    const { ctx, cell } = this
    const t = Math.max(0, now - st.t)
    const weg = this.reduce ? 0 : clamp01((t - ABGESCHNITTEN_LIEGT) / ABGESCHNITTEN_WEG)
    const sk = this.skin
    st.cells.forEach((c, i) => {
      const f = st.laenge > 1 ? (st.von + i) / (st.laenge - 1) : 1
      const rgb = sk.kopf.map((v, j) => Math.round(lerp(lerp(v, sk.schwanz[j], f), 120, 0.25)))
      const x = (c.x + 0.5) * cell
      const y = (c.y + 0.5) * cell
      const r = cell * 0.37 * (1 - weg * 0.5)
      ctx.globalAlpha = 1 - weg
      ctx.fillStyle = 'rgba(12, 40, 32, 0.22)'
      ctx.beginPath()
      ctx.arc(x, y + cell * 0.1, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
      // Am Anfang weiss aufblitzen, damit man sieht, was ab ist
      if (t < 350) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.9 * (1 - t / 350)})`
        ctx.lineWidth = Math.max(1.5, cell * 0.08)
        ctx.stroke()
      }
    })
    // Schnittlinie zwischen Schlange und abgeschnittenem Stueck
    if (t < 400 && st.cells.length) {
      const c = st.cells[0]
      const x = (c.x + 0.5) * cell
      const y = (c.y + 0.5) * cell
      ctx.globalAlpha = 1 - t / 400
      ctx.strokeStyle = '#FFFFFF'
      ctx.lineWidth = Math.max(2, cell * 0.1)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(x - cell * 0.5, y - cell * 0.5)
      ctx.lineTo(x + cell * 0.5, y + cell * 0.5)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  /** Maulwurf: kleines Warndreieck mit Ausrufezeichen ueber dem Kopf, wenn es Zeit wird umzukehren */
  private drawGrabWarnung(g: Game, head: P, now: number) {
    if (!g.grabWarnung()) return
    const { ctx, cell } = this
    const x = (head.x + 0.5) * cell
    const y = (head.y - 0.55) * cell
    const s = cell * 0.62
    ctx.save()
    ctx.globalAlpha = this.reduce ? 0.95 : 0.8 + 0.15 * Math.sin(now / 220)
    ctx.translate(x, y)
    ctx.lineJoin = 'round'
    ctx.fillStyle = '#F2C14E'
    ctx.strokeStyle = 'rgba(40, 28, 10, 0.75)'
    ctx.lineWidth = Math.max(1.5, cell * 0.06)
    ctx.beginPath()
    ctx.moveTo(0, -s * 0.5)
    ctx.lineTo(s * 0.55, s * 0.45)
    ctx.lineTo(-s * 0.55, s * 0.45)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#3A2A10'
    ctx.fillRect(-s * 0.05, -s * 0.22, s * 0.1, s * 0.38)
    ctx.beginPath()
    ctx.arc(0, s * 0.3, s * 0.06, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  /** Kamera. Bereich: fester Ausschnitt, der neue Bereiche frueh und weich vorwegnimmt (siehe
   *  bereichZiel). Dynamisch: eine Drohne, die frei hinterherfliegt. Sie haengt an einer gedaempften
   *  Feder vor dem Kopf (in Laufrichtung), so dass sie im Lauf knapp vor ihm schwebt. Biegt die
   *  Schlange ab, springt nur das Ziel: die Kamera selbst fliegt in einem lockeren Bogen hinueber,
   *  nie um eine Ecke. Steht die Schlange, gleitet sie zum Kopf. Mit "Bewegung reduzieren" haftet
   *  die Kamera immer genau am Kopf.
   *  Bei jeder Art gilt: Solange die Karte nur aus den Startbloecken besteht (bis das erste neue
   *  Gebiet freigeschaltet ist), steht das Bild still, die ganze Karte in der Mitte. Danach faehrt
   *  die Kamera weich von dort los */
  private kamera(g: Game, cell: number, dt: number, kopf: P): P {
    let tx = (kopf.x + 0.5) * cell
    let ty = (kopf.y + 0.5) * cell
    const lief = g.time !== this.camZeit
    this.camZeit = g.time
    if (this.standbild(g)) {
      this.cam = { x: (g.w / 2) * cell, y: (g.h / 2) * cell }
      this.camZiel = { ...this.cam }
      this.camV = { x: 0, y: 0 }
      this.camInit = true
      this.frameOk = false
      this.sichtGlatt = { x: [0, 0], y: [0, 0] }
      return this.cam
    }
    const laeuft = lief && g.status === 'play' && !g.halt && !g.gnade
    const art = this.reduce ? 'kopf' : this.kameraArt
    if (art !== 'bereich') {
      this.frameOk = false
      this.sichtGlatt = { x: [0, 0], y: [0, 0] }
    }
    if (art === 'bereich') {
      const b = this.bereichZiel(g, dt, kopf)
      tx = b.x * cell
      ty = b.y * cell
    } else if (art === 'dynamisch' && this.camInit) {
      // Feder samt weichem Ziel haengt bei Tempo v um 3 v / omega hinterher: so weit plus ein Stueck voraus
      const v = laeuft ? cell / g.takt : 0
      const voraus = laeuft ? (3 * v) / DROHNE + DROHNE_VORAUS * cell : 0
      const d = STEP[g.dir]
      tx += d.x * voraus
      ty += d.y * voraus
    }
    if (art === 'kopf' || !this.camInit) {
      this.cam = { x: tx, y: ty }
      this.camZiel = { x: tx, y: ty }
      this.camV = { x: 0, y: 0 }
      this.camInit = true
    } else this.feder(tx, ty, art === 'bereich' ? BEREICH : DROHNE, dt)
    if (art !== 'bereich') return this.cam
    // Letzte Sicherung, weich nachgezogen (zwei Stufen): so loest sie sich auch beim Abbiegen ohne Ruck
    const soll = this.sichtVoraus(g, kopf)
    const k = 1 - Math.exp(-dt / 90)
    for (const ax of ['x', 'y'] as const) {
      const s = this.sichtGlatt[ax]
      s[0] += (soll[ax] - this.cam[ax] - s[0]) * k
      s[1] += (s[0] - s[1]) * k
    }
    return { x: this.cam.x + this.sichtGlatt.x[1], y: this.cam.y + this.sichtGlatt.y[1] }
  }

  /** Standbild: die Karte ist noch die vom Start (kein neues Gebiet, nichts freigegraben) und passt ganz ins Bild */
  private standbild(g: Game) {
    return g.blocks.length <= 2 && !g.extra.length && g.inside(g.body[0]) && g.w <= this.vw / this.cell && g.h <= this.vh / this.cell
  }

  /** Bereich-Kamera, letzte Sicherung: zu jeder Seite sieht man immer mindestens 5 ganze Felder
   *  am Kopf vorbei, soweit dort Karte ist. Greift nur in seltenen Momenten (etwa wenn die Kamera
   *  nach dem Abbiegen noch Fahrt aufnimmt), setzt weich ein und ist sonst genau 0 */
  private sichtVoraus(g: Game, kopf: P): P {
    const aus = { ...this.cam }
    // Solange ein neuer Block aufklappt, gleitet die Kamera ohnehin hinein
    if (!g.inside(g.body[0]) || (g.gebiet && g.time - g.gebiet.t < BEREICH_WECHSEL)) return aus
    const w = 0.5
    const schub = (fehlt: number) => (fehlt <= -w ? 0 : fehlt >= w ? fehlt : ((fehlt + w) * (fehlt + w)) / (4 * w))
    for (const ax of ['x', 'y'] as const) {
      const halb = (ax === 'x' ? this.vw : this.vh) / (2 * this.cell)
      const ab = aus[ax] / this.cell - (kopf[ax] + 0.5)
      const n = this.sichtNoetig[ax]
      aus[ax] += (schub(n.plus - (halb + ab)) - schub(n.minus - (halb - ab))) * this.cell
    }
    return aus
  }

  /** Bereich-Kamera (Ziel in Feldern), in drei Schichten:
   *  1. Kasten: Der Ausschnitt ist so gross wie das Bild, an den Kartenbloecken ausgerichtet, und
   *     steht. Ueberschreitet der Kopf seinen Rand, kommt der naechste (einen Block weiter).
   *  2. Vorwegnehmen: Ab der Mittellinie lehnt sich die Kamera zu jeder Oeffnung hinueber (dort, wo
   *     die Karte hinter dem Rand weitergeht, auch hinter Erde oder um die Ecke), je naeher, desto
   *     mehr: an der Schwelle steht sie halb im neuen Bereich. Faehrt die Schlange darauf zu, zieht
   *     es voll, quer etwas weniger, faehrt sie weg, nur halb (wie an einem Gummiseil, das immer
   *     dorthin zieht, wohin die Schlange gerade will). Spruenge im Ziel (Wechsel, Erde, wachsende
   *     Karte) gleiten mit Ease-in/out.
   *  3. Mindestabstand: zum Bildrand bleiben immer RAND_HINTEN bis RAND_VORN Felder, ueberall
   *     dort, wo in der Naehe Karte ist, gerechnet fuer die Stelle, an der die Kamera wirklich ist
   *     (siehe Geister-Feder). Dazu die letzte Sicherung in sichtVoraus.
   *  Darauf folgt die Kamera an einer zweistufigen Feder (Gummiseil an einem Gummiseil) */
  private bereichZiel(g: Game, dt: number, kopf: P): P {
    this.uhr += dt
    const vx = this.vw / this.cell
    const vy = this.vh / this.cell
    const view = { x: vx, y: vy }
    const kx = kopf.x + 0.5
    const ky = kopf.y + 0.5
    const kp = { x: kx, y: ky }
    // Laufrichtung weich nachziehen (0 weg, 0,7 quer, 1 darauf zu)
    const dir = g.queue[0] ?? g.dir
    const kr = 1 - Math.exp(-dt / 100)
    for (const s of ['u', 'd', 'l', 'r'] as const) {
      const r = this.bRicht[s]
      r[0] += ((s === dir ? 1 : s === OPP[dir] ? 0 : 0.7) - r[0]) * kr
      r[1] += (r[0] - r[1]) * kr
    }
    const zu = (ax: 'x' | 'y', sg: 1 | -1) => this.bRicht[SEITE[ax][sg]][1]

    // 1. Kasten: halten, solange der Kopf drin ist; ueber der Schwelle einen Block weiter
    const achse = (pos: number, blk: number, view: number, total: number, alt: number | null) => {
      if (total <= view) return (total - view) / 2
      const lim = (f: number) => Math.min(total - view, Math.max(0, f))
      if (alt !== null) {
        let f = lim(alt)
        for (let i = 0; i < 50 && (pos < f || pos > f + view); i++) f = lim(f + (pos > f + view ? blk : -blk))
        if (pos >= f && pos <= f + view) return f
      }
      // Neu: so, dass der Kopf moeglichst mittig ist
      return lim(Math.round((pos - view / 2) / blk) * blk)
    }
    const erde = !g.inside(g.body[0])
    if (!this.frameOk) {
      this.frame = { x: achse(kx, g.bw, vx, g.w, null), y: achse(ky, g.bh, vy, g.h, null) }
      this.frameOk = true
      this.geist = { x: kx, y: ky, zx: kx, zy: ky, vx: 0, vy: 0 }
      this.bLetzt = null
      this.bAus = null
      this.uebergaenge = []
    } else if (!erde) {
      this.frame = { x: achse(kx, g.bw, vx, g.w, this.frame.x), y: achse(ky, g.bh, vy, g.h, this.frame.y) }
    }
    const feld = (ax: 'x' | 'y', a: number, q: number) => g.inside(ax === 'x' ? { x: a, y: q } : { x: q, y: a })

    // 2. Vorwegnehmen: wie weit sich die Kamera zu einer Seite des Ausschnitts hinueberlehnt (Felder)
    const lehnen = (ax: 'x' | 'y', sg: 1 | -1) => {
      const quer = ax === 'x' ? 'y' : 'x'
      const f = this.frame[ax]
      const total = ax === 'x' ? g.w : g.h
      if (total <= view[ax]) return 0
      // So weit rueckt der naechste Ausschnitt weiter (am Kartenende weniger)
      const blk = ax === 'x' ? g.bw : g.bh
      const neu = Math.abs(Math.min(total - view[ax], Math.max(0, f + sg * blk)) - f)
      if (neu < 0.01) return 0
      // Naechste Karte im Streifen, den der naechste Ausschnitt dazunimmt (Erde dazwischen egal),
      // quer auch ein Stueck ueber die Ecken hinaus
      const rand = sg > 0 ? f + view[ax] : f
      const a0 = sg > 0 ? Math.floor(rand + 1e-6) : Math.floor(rand - neu + 1e-6)
      const a1 = sg > 0 ? Math.ceil(rand + neu - 1e-6) - 1 : Math.ceil(rand - 1e-6) - 1
      const fq = this.frame[quer]
      const q0 = Math.max(0, Math.floor(fq) - 6)
      const q1 = Math.min((quer === 'x' ? g.w : g.h) - 1, Math.ceil(fq + view[quer]) - 1 + 6)
      const k = kp[ax]
      const kq = kp[quer]
      let d2 = Infinity
      for (let q = q0; q <= q1; q++) {
        const dq = Math.max(0, Math.abs(kq - (q + 0.5)) - 0.5)
        // Vom Rand aus nach aussen: das erste Feld Karte ist das naechste
        for (let i = 0; i <= a1 - a0; i++) {
          const a = sg > 0 ? a0 + i : a1 - i
          if (!feld(ax, a, q)) continue
          const da = Math.max(0, sg > 0 ? Math.max(a, rand) - k : k - Math.min(a + 1, rand))
          d2 = Math.min(d2, da * da + dq * dq)
          break
        }
      }
      if (d2 === Infinity) return 0
      // Ab der Mittellinie (halbe Ausschnittbreite Abstand) sanft einsetzend, an der Schwelle halb
      // im neuen Bereich und dort noch in Fahrt, damit der Wechsel ohne Halt durchgeht
      const u = clamp01(1 - Math.sqrt(d2) / (view[ax] / 2))
      return (neu / 2) * u * u * (2 - u) * (0.5 + 0.5 * zu(ax, sg))
    }

    // 3. Mindestabstand: wie weit man vom Kopf aus zu einer Seite sehen muss (Felder ab Kopfmitte):
    // die Karte in der Naehe (auch hinter Erde oder um die Ecke) bis hoechstens `soll` Felder weit.
    // Weit entfernte Felder, Felder seitlich und Reihen am Rand des Bands blenden weich aus
    const sichtBis = (ax: 'x' | 'y', sg: 1 | -1, soll: number) => {
      const quer = ax === 'x' ? 'y' : 'x'
      const k = kp[ax]
      const kq = kp[quer]
      const start = Math.floor(k)
      let brauche = 0
      for (let q = Math.floor(kq - 5); q <= Math.floor(kq + 5); q++) {
        const dq = Math.max(0, Math.abs(kq - (q + 0.5)) - 0.5)
        const wq = 1 - smoother(clamp01((dq - 1) / 3.5))
        if (wq <= 0) continue
        for (let i = 0; i <= Math.ceil(soll) + 2; i++) {
          const a = start + sg * i
          if (!feld(ax, a, q)) continue
          const e = sg > 0 ? a + 1 - k : k - a
          brauche = Math.max(brauche, wq * clamp01((soll + 2 - e) / 1.5) * Math.min(soll, e))
        }
      }
      return brauche
    }
    const rand = (ax: 'x' | 'y', sg: 1 | -1) => sichtBis(ax, sg, RAND_HINTEN + (RAND_VORN - RAND_HINTEN) * zu(ax, sg))
    // Folgt die Kamera dem Kopf, haengt sie so weit hinterher wie die Geister-Feder (im Lauf 3 v / omega).
    // Der Mindestabstand gilt fuer die Stelle, an der die Kamera wirklich ist: beide Grenzen ruecken
    // um dieses Nachhinken mit
    const gs = this.geist
    for (let rest = dt; rest > 0; rest -= 8) {
      const h = Math.min(8, rest)
      const kz = 1 - Math.exp(-h * BEREICH)
      gs.zx += (kx - gs.zx) * kz
      gs.zy += (ky - gs.zy) * kz
      gs.vx += (BEREICH * BEREICH * (gs.zx - gs.x) - 2 * BEREICH * gs.vx) * h
      gs.vy += (BEREICH * BEREICH * (gs.zy - gs.y) - 2 * BEREICH * gs.vy) * h
      gs.x += gs.vx * h
      gs.y += gs.vy * h
    }
    const lag = { x: kx - gs.x, y: ky - gs.y }
    for (const ax of ['x', 'y'] as const)
      this.sichtNoetig[ax] = erde ? { plus: 0, minus: 0 } : { plus: sichtBis(ax, 1, RAND_SICHER), minus: sichtBis(ax, -1, RAND_SICHER) }

    const mitte = { x: this.frame.x + vx / 2, y: this.frame.y + vy / 2 }
    const roh = erde ? { ...kp } : { x: mitte.x + lehnen('x', 1) - lehnen('x', -1), y: mitte.y + lehnen('y', 1) - lehnen('y', -1) }
    const grenze = erde
      ? null
      : {
          x: { plus: rand('x', 1), minus: rand('x', -1) },
          y: { plus: rand('y', 1), minus: rand('y', -1) },
        }
    // Mindestabstand anwenden; reicht das Bild nicht fuer beide Seiten, gewinnt die, auf die die
    // Schlange eher zufaehrt
    const halten = (p: P) => {
      const q = { ...p }
      if (!grenze) return q
      for (const ax of ['x', 'y'] as const) {
        const lo = kp[ax] + grenze[ax].plus - view[ax] / 2 + lag[ax]
        const hi = kp[ax] - grenze[ax].minus + view[ax] / 2 + lag[ax]
        const plusZuletzt = zu(ax, 1) >= zu(ax, -1)
        for (const plus of plusZuletzt ? [false, true] : [true, false]) q[ax] = plus ? weichMax(q[ax], lo, 1.2) : -weichMax(-q[ax], -hi, 1.2)
      }
      return q
    }

    // Spruenge im Ziel gleiten weich hinueber. Neuer Ausschnitt, Erde, Fenstergroesse: das Hinueber-
    // lehnen mit Ease, der Mindestabstand gilt sofort. Karte gewachsen: alles, passend zur Welle,
    // mit der der neue Block aufklappt
    const sigRahmen = [this.frame.x, this.frame.y, erde, this.cell].join()
    const sigKarte = [g.w, g.h, g.blocks.length, g.extra.length].join()
    const karte = this.bLetzt !== null && sigKarte !== this.bSigKarte
    if (this.bLetzt && !karte && sigRahmen !== this.bSig) this.uebergang(this.bLetzt.x - roh.x, this.bLetzt.y - roh.y, false)
    this.bSig = sigRahmen
    this.bSigKarte = sigKarte
    this.bLetzt = roh
    const rest = (nach: boolean) => {
      const r = { x: 0, y: 0 }
      for (const u of this.uebergaenge) {
        if (u.nach !== nach) continue
        const t = 1 - smoother(clamp01((this.uhr - u.t) / BEREICH_WECHSEL))
        r.x += u.x * t
        r.y += u.y * t
      }
      return r
    }
    const vor = rest(false)
    const ziel = halten({ x: roh.x + vor.x, y: roh.y + vor.y })
    if (karte && this.bAus) this.uebergang(this.bAus.x - ziel.x, this.bAus.y - ziel.y, true)
    this.bAus = { ...ziel }
    const nach = rest(true)
    this.uebergaenge = this.uebergaenge.filter((u) => this.uhr - u.t < BEREICH_WECHSEL)
    return { x: ziel.x + nach.x, y: ziel.y + nach.y }
  }

  private uebergang(x: number, y: number, nach: boolean) {
    if (Math.abs(x) + Math.abs(y) > 0.01) this.uebergaenge.push({ x, y, t: this.uhr, nach })
  }

  /** Kritisch gedaempfte Feder zu einem weich nachgezogenen Ziel: Geschwindigkeit und
   *  Beschleunigung setzen sanft ein und klingen sanft aus, kein Ueberschwingen */
  private feder(tx: number, ty: number, w: number, dt: number) {
    // In kleinen Schritten rechnen, damit es auch bei langen Frames stabil bleibt
    for (let rest = dt; rest > 0; rest -= 8) {
      const h = Math.min(8, rest)
      const kz = 1 - Math.exp(-h * w)
      for (const a of ['x', 'y'] as const) {
        this.camZiel[a] += ((a === 'x' ? tx : ty) - this.camZiel[a]) * kz
        const acc = w * w * (this.camZiel[a] - this.cam[a]) - 2 * w * this.camV[a]
        this.camV[a] += acc * h
        this.cam[a] += this.camV[a] * h
      }
    }
  }

  /** Gegner-Schlange: rot, weich zwischen den Feldern, erscheint sanft. `weg` = besiegt seit */
  private drawGegner(g: Game, e: Gegner, now: number, weg?: number) {
    const { ctx, cell } = this
    const n = e.body.length
    const a = weg !== undefined || this.reduce ? 1 : clamp01((now - e.last) / g.schrittzeitVon(e))
    const ip = (i: number) => {
      const p = e.prev[i]
      const b = e.body[i]
      return p ? { x: lerp(p.x, b.x, a), y: lerp(p.y, b.y, a) } : b
    }
    const pts: P[] = [ip(0), ...e.body.slice(1), ip(n - 1)]
    const k = weg !== undefined ? clamp01((now - weg) / GEGNER_WEG) : 0
    ctx.globalAlpha = (this.reduce ? 1 : clamp01((now - e.t) / 450)) * (1 - k)
    const lila = e.art === 'lila'
    drawSchlange(ctx, pts, cell * (1 - k * 0.3), e.dir, lila ? LILA_SKIN : GEGNER_SKIN, now, {
      tot: weg !== undefined,
      brauen: lila ? 2 : true,
      angst: e.angst,
      blinzeln: weg === undefined && (now + e.t) % 3700 < 110,
    })
    ctx.globalAlpha = 1
    // Gerade ein Glied laenger geworden: kurzer Schimmer um den Kopf
    if (weg === undefined && now - e.wuchsT < 700) {
      const t = (now - e.wuchsT) / 700
      ctx.strokeStyle = `rgba(255, 138, 115, ${0.8 * (1 - t)})`
      ctx.lineWidth = Math.max(1.5, cell * 0.06)
      ctx.beginPath()
      ctx.arc((pts[0].x + 0.5) * cell, (pts[0].y + 0.5) * cell, cell * (0.45 + 0.35 * t), 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  /** Minikarte unten links: nur die Kartenblöcke. Grün der Block mit der Schlange,
   *  in Apfelfarbe der Block mit dem Apfel (keine genauen Positionen).
   *  Erst sichtbar, wenn die Karte groesser als der Bildschirm ist */
  private drawMinikarte(g: Game, head: P) {
    if (g.blocks.length <= 2) return
    const { ctx, vh } = this
    const max = 50
    const s = Math.min(max / g.w, max / g.h)
    const mw = g.w * s
    const mh = g.h * s
    const pad = 4
    const x0 = 10 + pad
    // Ueber dem Schalter und dem Pause-Knopf unten links
    const y0 = vh - 10 - pad - mh - 42
    ctx.fillStyle = 'rgba(23, 21, 19, 0.55)'
    rund(ctx, x0 - pad, y0 - pad, mw + pad * 2, mh + pad * 2, 6)
    ctx.fill()
    const block = (p: P) => ({ x: Math.floor(p.x / g.bw), y: Math.floor(p.y / g.bh) })
    const sb = block({ x: Math.round(head.x), y: Math.round(head.y) })
    const ab = block(g.apple.p)
    const farbe = apfelFarbe(g.apfelStufe())
    for (const b of g.blocks) {
      const x = x0 + b.x * g.bw * s
      const y = y0 + b.y * g.bh * s
      const bw = g.bw * s - 1
      const bh = g.bh * s - 1
      const schlange = b.x === sb.x && b.y === sb.y
      const apfel = b.x === ab.x && b.y === ab.y
      ctx.fillStyle = schlange ? '#4CC38A' : apfel ? farbe : 'rgba(245, 239, 230, 0.2)'
      ctx.fillRect(x, y, bw, bh)
      if (!apfel) continue
      // Apfel-Block mit hellem Rand (auch ein gruener Apfel bleibt so erkennbar);
      // liegt der Apfel im Block der Schlange, steckt ein Kaestchen in Apfelfarbe darin
      if (schlange) {
        ctx.fillStyle = farbe
        ctx.fillRect(x + bw * 0.28, y + bh * 0.28, bw * 0.44, bh * 0.44)
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
      ctx.lineWidth = 1
      if (schlange) ctx.strokeRect(x + bw * 0.28, y + bh * 0.28, bw * 0.44, bh * 0.44)
      else ctx.strokeRect(x + 0.5, y + 0.5, bw - 1, bh - 1)
    }
    // Freigegrabene Felder ausserhalb der Bloecke
    ctx.fillStyle = 'rgba(245, 239, 230, 0.2)'
    for (const c of g.extra) ctx.fillRect(x0 + c.x * s, y0 + c.y * s, Math.max(1, s), Math.max(1, s))
  }

  /** Pfeil am Bildrand, wenn der Apfel ausserhalb liegt */
  private drawZeiger(g: Game, ox: number, oy: number, now: number) {
    const { ctx, cell, vw, vh } = this
    const ax = (g.apple.p.x + 0.5) * cell + ox
    const ay = (g.apple.p.y + 0.5) * cell + oy
    const m = cell * 0.5
    if (ax > m && ax < vw - m && ay > m && ay < vh - m) return
    const r = Math.max(15, cell * 0.55)
    const edge = r + 8
    const cx = Math.min(vw - edge, Math.max(edge, ax))
    const cy = Math.min(vh - edge, Math.max(edge, ay))
    const ang = Math.atan2(ay - cy, ax - cx)
    const puls = this.reduce ? 0 : Math.sin(now / 200) * 2
    ctx.save()
    ctx.translate(cx + Math.cos(ang) * puls, cy + Math.sin(ang) * puls)
    ctx.fillStyle = 'rgba(23, 21, 19, 0.82)'
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fill()
    const farbe = apfelFarbe(g.apfelStufe())
    ctx.strokeStyle = farbe
    ctx.lineWidth = 2
    ctx.stroke()
    // Spitze in Richtung Apfel
    ctx.rotate(ang)
    ctx.fillStyle = farbe
    ctx.beginPath()
    ctx.moveTo(r + 7, 0)
    ctx.lineTo(r - 1, -6)
    ctx.lineTo(r - 1, 6)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
    drawApfel(ctx, cx, cy - r * 0.04, r * 1.45, 1, 0, undefined, g.apfelStufe())
  }
}
