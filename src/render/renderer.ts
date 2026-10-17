/**
 * Zeichnet ein Spiel auf das Canvas: Kamera folgt der Schlange (die Karte
 * kann groesser als der Bildschirm werden), neue Gebiete klappen Feld fuer
 * Feld auf, Apfel ausserhalb des Bildes zeigt ein Pfeil am Rand.
 */
import { AMEISE_WEG, GEGNER_WEG, type Game } from '../game/game'
import { erdeBei, feldZufall, FROSCH_ANLAUF, FROSCH_FLUG, STEP, WOLKE_AUFLOESEN, WOLKE_WARNUNG, wolkenForm } from '../game/rules'
import type { Funke, GameEvent, Gegner, P } from '../game/types'
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
/** Sehr weiche S-Kurve (flacher Anfang und flaches Ende) */
const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
/** Kamera-Federn (1/ms): Rantasten sehr langsam und weich, Blockwechsel zuegig, Graben dazwischen */
const KAMERA_TAST = 0.0022
const KAMERA_WECHSEL = 0.013
const KAMERA_GRABEN = 0.008

export class Renderer {
  readonly canvas: HTMLCanvasElement
  readonly ctx: CanvasRenderingContext2D
  reduce = false
  skin: Skin = SKINS[0]
  private dpr = 1
  vw = 0
  vh = 0
  cell = 20
  private cam = { x: 0, y: 0 }
  /** Geschwindigkeit der Kamera (px/ms): sie faehrt wie an einer gedaempften Feder,
   *  beschleunigt also sanft und bremst sanft ab, nie ruckartig */
  private camV = { x: 0, y: 0 }
  /** Weich nachgezogenes Ziel der Feder: so setzt auch die Beschleunigung sanft ein */
  private camZiel = { x: 0, y: 0 }
  /** Federhaerte (1/ms), gleitet weich zwischen langsamer Rantast- und schneller Wechsel-Kamera */
  private camOmega = KAMERA_TAST
  private camInit = false
  /** Fester Ausschnitt (linke obere Ecke in Feldern, an Bloecken ausgerichtet) */
  private frame = { x: 0, y: 0 }
  /** Bis wann die schnelle Wechsel-Kamera laeuft */
  private wechselBis = 0
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
    this.funken = []
    this.texte = []
    this.shake = { until: 0, amp: 0 }
  }

  /** Feldgroesse so, dass genau ein Bildschirm (screenW x screenH) hineinpasst */
  cellFor(g: Game) {
    return Math.max(4, Math.floor(Math.min(this.vw / g.screenW, this.vh / g.screenH)))
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
      this.cam.x += e.dx * cell
      this.cam.y += e.dy * cell
      this.camZiel.x += e.dx * cell
      this.camZiel.y += e.dy * cell
      this.frame.x += e.dx
      this.frame.y += e.dy
    } else if (e.type === 'freigelegt') {
      this.cam.x += e.dx * cell
      this.cam.y += e.dy * cell
      this.camZiel.x += e.dx * cell
      this.camZiel.y += e.dy * cell
      this.frame.x += e.dx
      this.frame.y += e.dy
      for (const f of [...this.funken, ...this.texte]) {
        f.x += e.dx * cell
        f.y += e.dy * cell
      }
      this.funken.forEach((f) => {
        f.x += e.dx * cell
        f.y += e.dy * cell
      })
      this.texte.forEach((f) => {
        f.x += e.dx * cell
        f.y += e.dy * cell
      })
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
        schere: g.effekt.schere > 0 ? `Schere −${g.effekt.schere}` : 'Schere',
        fuettern: 'Füttern!',
        magnet: 'Magnet',
        maulwurf: 'Maulwurf',
        gold: 'Unbesiegbar!',
        spitzhacke: 'Erz!',
      }[e.art]
      this.texte.push({ x: (e.p.x + 0.5) * cell, y: e.p.y * cell, t: g.time, text: name, farbe: '#FFFFFF' })
      // Schere: an der Schnittstelle spritzen helle Funken, das Bild zuckt kurz
      const schnitt = e.art === 'schere' ? g.abgeschnitten[g.abgeschnitten.length - 1] : undefined
      if (schnitt && schnitt.t === g.time && !this.reduce) {
        const c = schnitt.cells[0]
        for (let i = 0; i < 12; i++) {
          const ang = (Math.PI * 2 * i) / 12 + Math.random() * 0.4
          const sp = cell * (0.9 + Math.random() * 0.9)
          this.funken.push({ x: (c.x + 0.5) * cell, y: (c.y + 0.5) * cell, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - cell * 0.4, born: g.time, c: i % 2 ? '#FFFFFF' : '#C9D3DC' })
        }
        this.shake = { until: g.time + 220, amp: cell * 0.1 }
      }
    } else if (e.type === 'setback') {
      if (!this.reduce) this.shake = { until: g.time + 320, amp: cell * 0.14 }
    } else if (e.type === 'halt') {
      if (!this.reduce) this.shake = { until: g.time + 140, amp: cell * 0.07 }
    }
  }

  draw(g: Game) {
    const { ctx, vw, vh } = this
    const realNow = performance.now()
    const dt = this.lastReal ? Math.min(100, realNow - this.lastReal) : 16
    this.lastReal = realNow
    const now = g.time
    const cell = (this.cell = this.cellFor(g))
    const px = (v: number) => (v + 0.5) * cell

    // Schlange (weich zwischen den Feldern)
    const a = this.reduce ? 1 : g.alpha()
    const n = g.body.length
    const h0 = g.prev[0] ?? g.body[0]
    const head = { x: lerp(h0.x, g.body[0].x, a), y: lerp(h0.y, g.body[0].y, a) }

    this.kamera(g, cell, dt, realNow, head)
    let ox = Math.round(vw / 2 - this.cam.x)
    let oy = Math.round(vh / 2 - this.cam.y)
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
        const deko = erdeBei(g.cfg, wx, wy)
        if (!deko) continue
        if (deko === 'gold' || deko === 'dia' || deko === 'rubin' || deko === 'opal') {
          if (g.erzDa(wx, wy)) drawErz(ctx, px(x), px(y), cell * 0.8, deko, 1, this.reduce ? 0 : Math.max(0, Math.sin(now / 400 + z * 20)) * 0.9, now)
        } else drawErdDeko(ctx, x * cell, y * cell, cell, deko, z, now)
      }

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

    // Lava und Eis
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

    // Baeume und Haeuser (bleiben), dazu das Licht aus den Fenstern
    for (const b of g.baeume) {
      if (!b.cells.some((c) => sicht(c, 3))) continue
      drawBaum(ctx, b.root, b.dir, b.seite, cell, this.reduce ? 1 : backOut(clamp01((now - b.t) / 520)))
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

    // Von der Schere abgeschnittener Schwanz: faellt ab
    for (const st of g.abgeschnitten) if (st.cells.some((p) => sicht(p))) this.drawAbgeschnitten(st, now)

    // Schlange
    if (n) this.drawSchlange(g, head, a)

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
    // Goldener Apfel: goldener Schein um den ganzen Koerper
    if (!tot && g.unbesiegbar()) {
      const p = 0.5 + 0.5 * Math.sin(now / 120)
      ctx.save()
      ctx.globalAlpha = 1
      ctx.strokeStyle = `rgba(255, 205, 60, ${0.35 + 0.3 * p})`
      ctx.lineWidth = cell * 1.05
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      pts.forEach((q, i) => (i ? ctx.lineTo((q.x + 0.5) * cell, (q.y + 0.5) * cell) : ctx.moveTo((q.x + 0.5) * cell, (q.y + 0.5) * cell)))
      ctx.stroke()
      ctx.restore()
    }
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
    // Schild: Blase um den Kopf
    // Kurz vor dem Ablaufen flackert sie
    const schildRest = g.effekt.schildBis - now
    if (!tot && g.effekt.schild > 0 && !(schildRest < 3000 && Math.sin(now / 70) < 0)) {
      const hx = (head.x + 0.5) * cell
      const hy = (head.y + 0.5) * cell
      const p = 0.5 + 0.5 * Math.sin(now / 240)
      ctx.strokeStyle = `rgba(120, 200, 255, ${0.55 + 0.3 * p})`
      ctx.lineWidth = Math.max(2, cell * 0.08)
      ctx.beginPath()
      ctx.arc(hx, hy, cell * (0.62 + 0.04 * p), 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = 'rgba(120, 200, 255, 0.12)'
      ctx.fill()
    }
  }

  /** Abgeschnittene Glieder: kurz weisser Schnitt, dann springen sie auseinander,
   *  fallen herunter, werden kleiner und verblassen */
  private drawAbgeschnitten(st: Game['abgeschnitten'][number], now: number) {
    const { ctx, cell } = this
    const t = Math.max(0, now - st.t) / 1000
    const k = clamp01(t / 1.4)
    const sk = this.skin
    const fall = this.reduce ? 0 : Math.max(0, t - 0.12)
    st.cells.forEach((c, i) => {
      const f = st.laenge > 1 ? (st.von + i) / (st.laenge - 1) : 1
      const rgb = sk.kopf.map((v, j) => Math.round(lerp(v, sk.schwanz[j], f)))
      // Jedes Glied fliegt etwas anders: abwechselnd zur Seite, leicht hoch, dann runter
      const seite = (i % 2 ? 1 : -1) * (0.6 + ((i * 37) % 5) * 0.15)
      const x = (c.x + 0.5) * cell + seite * cell * 1.6 * fall
      const y = (c.y + 0.5) * cell + (-2.2 * fall + 9 * fall * fall) * cell
      const r = cell * 0.37 * (1 - k * 0.55)
      ctx.globalAlpha = 1 - k * k
      ctx.fillStyle = 'rgba(12, 40, 32, 0.22)'
      ctx.beginPath()
      ctx.arc(x, y + cell * 0.1, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
      // Am Anfang weiss aufblitzen, damit man sieht, was ab ist
      if (t < 0.35) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.9 * (1 - t / 0.35)})`
        ctx.lineWidth = Math.max(1.5, cell * 0.08)
        ctx.stroke()
      }
    })
    // Schnittlinie zwischen Schlange und abgeschnittenem Stueck
    if (t < 0.4 && st.cells.length) {
      const c = st.cells[0]
      const x = (c.x + 0.5) * cell
      const y = (c.y + 0.5) * cell
      ctx.globalAlpha = 1 - t / 0.4
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

  /** Kamera mit festem Ausschnitt (ein Bildschirm, an den Kartenbloecken ausgerichtet), auch wenn
   *  die Karte groesser ist. Laeuft die Schlange auf den Rand des Ausschnitts zu und geht es dort
   *  weiter, tastet sich die Kamera langsam ein Stueck vor (Rantast-Kamera). Ist die Schlange
   *  unmittelbar davor, den Ausschnitt zu verlassen, faehrt die Kamera zuegig einen Block weiter
   *  (Wechsel-Kamera). Ist die Karte in einer Richtung kleiner als der Bildschirm: mittig. */
  private kamera(g: Game, cell: number, dt: number, now: number, kopf: P) {
    const vwC = g.screenW
    const vhC = g.screenH
    const h = g.body[0]
    const d = STEP[g.queue[0] ?? g.dir]
    // In der Erde (Maulwurf): die Kamera folgt dem Kopf
    if (!g.inside(h) && this.camInit && !this.reduce) {
      this.feder((kopf.x + 0.5) * cell, (kopf.y + 0.5) * cell, KAMERA_GRABEN, dt)
      return
    }
    // Pro Achse: Startposition des Ausschnitts, Blockgroesse, Bloecke je Bildschirm, Kartengroesse
    const achse = (pos: number, blk: number, view: number, total: number, alt: number | null) => {
      if (total <= view) return (total - view) / 2
      const max = total - view
      if (alt !== null && pos >= alt && pos < alt + view) return Math.min(max, Math.max(0, alt))
      const b = Math.floor(pos / blk)
      const nb = Math.round(view / blk)
      // Zwei Bloecke je Bildschirm: so, dass der Kopf eher in der Mitte ist
      const start = nb >= 2 && pos - b * blk < blk / 2 ? (b - 1) * blk : b * blk
      return Math.min(max, Math.max(0, start))
    }
    if (!this.camInit) {
      this.frame = { x: achse(h.x, g.bw, vwC, g.w, null), y: achse(h.y, g.bh, vhC, g.h, null) }
    } else {
      // Kopf aus dem Ausschnitt (z. B. Sprung im Kreativ-Modus): passenden Ausschnitt suchen
      const fx = achse(h.x, g.bw, vwC, g.w, this.frame.x)
      const fy = achse(h.y, g.bh, vhC, g.h, this.frame.y)
      if (fx !== this.frame.x || fy !== this.frame.y) {
        this.frame = { x: fx, y: fy }
        this.wechselBis = now + 700
      }
    }
    // Abstand zum Rand des Ausschnitts in Laufrichtung, und geht es dahinter weiter?
    const rand = d.x > 0 ? this.frame.x + vwC - 1 - h.x : d.x < 0 ? h.x - this.frame.x : d.y > 0 ? this.frame.y + vhC - 1 - h.y : h.y - this.frame.y
    const weiter = (k: number) => g.inside({ x: h.x + d.x * k, y: h.y + d.y * k })
    const kannX = g.w > vwC && d.x !== 0
    const kannY = g.h > vhC && d.y !== 0
    // Rantast-Kamera (Vorbereiten): haengt nur an der fliessenden Kopfposition, nicht an der
    // Laufrichtung, damit Abbiegen nichts ruckeln laesst. Sobald der Kopf das letzte Drittel des
    // Ausschnitts betritt und die Karte dahinter weitergeht, lehnt sich die Kamera ganz sanft hinueber
    const lehnen = (pos: number, start: number, view: number, total: number, blk: number, dahinter: (seite: 1 | -1) => boolean) => {
      if (total <= view) return 0
      const drittel = view / 3
      const max = Math.min(4, blk * 0.35)
      const zuPlus = start + view - 1 - pos
      const zuMinus = pos - start
      const k = (abstand: number) => smoother(clamp01((drittel - abstand) / (drittel - 1)))
      return max * ((dahinter(1) ? k(zuPlus) : 0) - (dahinter(-1) ? k(zuMinus) : 0))
    }
    let ox = lehnen(kopf.x, this.frame.x, vwC, g.w, g.bw, (s) => g.inside({ x: s > 0 ? this.frame.x + vwC : this.frame.x - 1, y: h.y }))
    let oy = lehnen(kopf.y, this.frame.y, vhC, g.h, g.bh, (s) => g.inside({ x: h.x, y: s > 0 ? this.frame.y + vhC : this.frame.y - 1 }))
    if ((kannX || kannY) && weiter(rand + 1)) {
      const blk = kannX ? g.bw : g.bh
      if (rand <= 1) {
        // Wechsel-Kamera: zwei Bloecke je Bildschirm -> einen Block weiter (der Kopf landet in der Mitte).
        // Ein Block je Bildschirm -> schon halb hinueber, beim Uebertritt dann ganz
        this.wechselBis = now + 700
        if (Math.round((kannX ? vwC : vhC) / blk) >= 2) {
          if (kannX) this.frame.x = Math.min(g.w - vwC, Math.max(0, this.frame.x + d.x * g.bw))
          if (kannY) this.frame.y = Math.min(g.h - vhC, Math.max(0, this.frame.y + d.y * g.bh))
        } else {
          if (kannX) ox = d.x * blk * 0.5
          if (kannY) oy = d.y * blk * 0.5
        }
      }
    }
    const tx = (this.frame.x + vwC / 2 + ox) * cell
    const ty = (this.frame.y + vhC / 2 + oy) * cell
    if (!this.camInit || this.reduce) {
      this.cam = { x: tx, y: ty }
      this.camZiel = { x: tx, y: ty }
      this.camV = { x: 0, y: 0 }
      this.camInit = true
      return
    }
    this.feder(tx, ty, now < this.wechselBis ? KAMERA_WECHSEL : KAMERA_TAST, dt)
  }

  /** Kritisch gedaempfte Feder zu einem weich nachgezogenen Ziel: Geschwindigkeit und
   *  Beschleunigung setzen sanft ein und klingen sanft aus, kein Ueberschwingen.
   *  Auch die Federhaerte wechselt weich, damit es beim Umschalten nicht ruckt */
  private feder(tx: number, ty: number, omega: number, dt: number) {
    this.camOmega += (omega - this.camOmega) * (1 - Math.exp(-dt / 180))
    const w = this.camOmega
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
