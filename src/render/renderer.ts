/**
 * Zeichnet ein Spiel auf das Canvas: Kamera folgt der Schlange (die Karte
 * kann groesser als der Bildschirm werden), neue Gebiete klappen Feld fuer
 * Feld auf, Apfel ausserhalb des Bildes zeigt ein Pfeil am Rand.
 */
import type { Game } from '../game/game'
import { FROSCH_ANLAUF, FROSCH_FLUG, STEP, WOLKE_AUFLOESEN, WOLKE_WARNUNG, wolkenForm } from '../game/rules'
import type { Funke, GameEvent, P } from '../game/types'
import {
  C,
  backOut,
  clamp01,
  DIR_WINKEL,
  drawFrosch,
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

export class Renderer {
  readonly canvas: HTMLCanvasElement
  readonly ctx: CanvasRenderingContext2D
  reduce = false
  private dpr = 1
  vw = 0
  vh = 0
  cell = 20
  private cam = { x: 0, y: 0 }
  private camInit = false
  private funken: Funke[] = []
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
    this.funken = []
    this.shake = { until: 0, amp: 0 }
  }

  /** Feldgroesse so, dass genau ein Bildschirm (screenW x screenH) hineinpasst */
  cellFor(g: Game) {
    return Math.max(4, Math.floor(Math.min(this.vw / g.screenW, this.vh / g.screenH)))
  }

  event(e: GameEvent, g: Game) {
    const cell = this.cell
    if (e.type === 'eat' && !this.reduce) {
      for (let i = 0; i < 14; i++) {
        const ang = (Math.PI * 2 * i) / 14 + Math.random() * 0.4
        const sp = cell * (1.1 + Math.random() * 1.0)
        this.funken.push({
          x: (e.p.x + 0.5) * cell,
          y: (e.p.y + 0.5) * cell,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp - cell * 0.6,
          born: g.time,
          c: C.partikel[i % C.partikel.length],
        })
      }
    } else if (e.type === 'expand') {
      // Alles ist um dx/dy gerutscht: Kamera mitnehmen, damit nichts springt
      this.cam.x += e.dx * cell
      this.cam.y += e.dy * cell
      this.funken.forEach((f) => {
        f.x += e.dx * cell
        f.y += e.dy * cell
      })
    } else if (e.type === 'die') {
      if (!this.reduce) this.shake = { until: g.time + 450, amp: cell * 0.2 }
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
    const W = g.w * cell
    const H = g.h * cell
    const px = (v: number) => (v + 0.5) * cell

    // Schlange (weich zwischen den Feldern)
    const a = this.reduce ? 1 : g.alpha()
    const n = g.body.length
    const h0 = g.prev[0] ?? g.body[0]
    const head = { x: lerp(h0.x, g.body[0].x, a), y: lerp(h0.y, g.body[0].y, a) }

    // Kamera: etwas voraus schauen, an den Kartenrand geklemmt
    const look = STEP[g.dir]
    let tx = px(head.x) + look.x * cell * 2
    let ty = px(head.y) + look.y * cell * 2
    tx = W <= vw ? W / 2 : Math.min(W - vw / 2, Math.max(vw / 2, tx))
    ty = H <= vh ? H / 2 : Math.min(H - vh / 2, Math.max(vh / 2, ty))
    if (!this.camInit || this.reduce) {
      this.cam = { x: tx, y: ty }
      this.camInit = true
    } else {
      const k = 1 - Math.exp(-dt / 170)
      this.cam.x += (tx - this.cam.x) * k
      this.cam.y += (ty - this.cam.y) * k
    }
    let ox = Math.round(vw / 2 - this.cam.x)
    let oy = Math.round(vh / 2 - this.cam.y)
    if (now < this.shake.until) {
      const f = (this.shake.until - now) / 450
      ox += Math.round((Math.random() - 0.5) * 2 * this.shake.amp * f)
      oy += Math.round((Math.random() - 0.5) * 2 * this.shake.amp * f)
    }

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    // Hintergrund ausserhalb der Karte: dunkles Mokka mit feinem Punktraster
    ctx.fillStyle = '#171513'
    ctx.fillRect(0, 0, vw, vh)
    ctx.fillStyle = 'rgba(203, 191, 177, 0.07)'
    const step = cell
    const sx = ((ox % step) + step) % step
    const sy = ((oy % step) + step) % step
    for (let y = sy - step / 2; y < vh; y += step) for (let x = sx - step / 2; x < vw; x += step) ctx.fillRect(x - 1, y - 1, 2, 2)

    ctx.translate(ox, oy)

    // Sichtbarer Bereich in Feldern
    const x0 = Math.max(0, Math.floor(-ox / cell) - 1)
    const y0 = Math.max(0, Math.floor(-oy / cell) - 1)
    const x1 = Math.min(g.w - 1, Math.ceil((vw - ox) / cell) + 1)
    const y1 = Math.min(g.h - 1, Math.ceil((vh - oy) / cell) + 1)
    const sicht = (p: P, m = 2) => p.x >= x0 - m && p.x <= x1 + m && p.y >= y0 - m && p.y <= y1 + m

    // Rahmen um jeden Block der Karte; der neue Block klappt von der Ansatzseite auf
    const gb = g.gebiet && now - g.gebiet.t < 2600 && !this.reduce ? g.gebiet : null
    const pad = Math.max(4, cell * 0.22)
    const rahmen = g.blocks.map((b) => {
      const r = { x: b.x * g.bw, y: b.y * g.bh, w: g.bw, h: g.bh }
      if (!gb || r.x !== gb.x || r.y !== gb.y) return r
      const k = easeOut(clamp01((now - gb.t) / 900))
      if (gb.side === 'top') return { ...r, y: r.y + r.h * (1 - k), h: r.h * k }
      if (gb.side === 'bottom') return { ...r, h: r.h * k }
      if (gb.side === 'left') return { ...r, x: r.x + r.w * (1 - k), w: r.w * k }
      return { ...r, w: r.w * k }
    })
    for (const [col, dy] of [['rgba(0, 0, 0, 0.45)', cell * 0.15], ['#1C5446', 0]] as const) {
      ctx.fillStyle = col
      for (const r of rahmen) {
        rund(ctx, r.x * cell - pad, r.y * cell - pad + dy, r.w * cell + pad * 2, r.h * cell + pad * 2, cell * 0.5)
        ctx.fill()
      }
    }

    // Schachbrett nur auf der Karte; neue Felder klappen als Welle auf. Erst die
    // dunkle Flaeche je Block, dann die hellen Felder etwas groesser (sonst feine Fugen)
    ctx.fillStyle = C.dunkel
    for (const b of g.blocks) {
      if (gb && b.x * g.bw === gb.x && b.y * g.bh === gb.y) continue
      ctx.fillRect(b.x * g.bw * cell, b.y * g.bh * cell, g.bw * cell, g.bh * cell)
    }
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

    // Apfel und Giftaepfel
    const wipp = this.reduce ? 0 : Math.max(0, Math.sin(now / 260)) * cell * 0.05
    drawApfel(ctx, px(g.apple.p.x), px(g.apple.p.y), cell, this.reduce ? 1 : backOut(clamp01((now - g.apple.t) / 340)), wipp)
    for (const gf of g.gift) {
      if (!sicht(gf.p)) continue
      drawApfel(ctx, px(gf.p.x), px(gf.p.y), cell, this.reduce ? 1 : backOut(clamp01((now - gf.t) / 340)), wipp * 0.6, gf.ecke)
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

    // Apfel ausserhalb des Bildes: Pfeil am Rand
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    if (g.status === 'play') this.drawZeiger(g, ox, oy, now)
  }

  private drawSchlange(g: Game, head: P, a: number) {
    const { ctx, cell } = this
    const now = g.time
    const px = (v: number) => (v + 0.5) * cell
    const n = g.body.length
    const tp = g.prev[n - 1]
    const tl = g.body[n - 1]
    const tail = tp ? { x: lerp(tp.x, tl.x, a), y: lerp(tp.y, tl.y, a) } : tl
    const pts: P[] = [head, ...g.body.slice(1), tail]
    const w = cell * 0.74
    const tot = g.status === 'over'
    const sinceDeath = now - g.deathAt
    const vergiftet = g.cause === 'gift' ? clamp01(sinceDeath / 600) : 0
    const kopf = C.kopf.map((v, j) => lerp(v, C.giftKopf[j], vergiftet))
    const schwanz = C.schwanz.map((v, j) => lerp(v, C.giftSchwanz[j], vergiftet))
    if (tot && !this.reduce && sinceDeath < 900) ctx.globalAlpha = 0.55 + 0.45 * Math.abs(Math.cos(sinceDeath / 90))
    // Nach einem Rueckschlag geschuetzt: blinkt
    else if (!tot && now < g.schutzBis) ctx.globalAlpha = Math.sin(now / 55) > 0 ? 0.9 : 0.35
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // Schatten
    ctx.strokeStyle = 'rgba(12, 40, 32, 0.22)'
    ctx.lineWidth = w
    ctx.beginPath()
    pts.forEach((p, i) => (i ? ctx.lineTo(px(p.x), px(p.y) + cell * 0.12) : ctx.moveTo(px(p.x), px(p.y) + cell * 0.12)))
    ctx.stroke()

    // Koerper vom Schwanz zum Kopf
    for (let i = pts.length - 2; i >= 0; i--) {
      const k = pts.length > 2 ? i / (pts.length - 2) : 0
      const col = kopf.map((v, j) => Math.round(lerp(v, schwanz[j], k)))
      ctx.strokeStyle = `rgb(${col[0]},${col[1]},${col[2]})`
      ctx.lineWidth = w * (1 - k * 0.18)
      ctx.beginPath()
      ctx.moveTo(px(pts[i].x), px(pts[i].y))
      ctx.lineTo(px(pts[i + 1].x), px(pts[i + 1].y))
      ctx.stroke()
    }
    // Lichtkante auf dem Ruecken
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.13)'
    ctx.lineWidth = w * 0.22
    ctx.beginPath()
    pts.slice(0, Math.min(pts.length, 60)).forEach((p, i) => (i ? ctx.lineTo(px(p.x) - cell * 0.08, px(p.y) - cell * 0.1) : ctx.moveTo(px(p.x) - cell * 0.08, px(p.y) - cell * 0.1)))
    ctx.stroke()

    const hx = px(head.x)
    const hy = px(head.y)
    const d = STEP[g.dir]

    // Zunge: zuengelt ab und zu kurz
    if (!tot && !this.reduce && now % 2800 < 220) {
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

    ctx.fillStyle = `rgb(${kopf.map(Math.round).join(',')})`
    ctx.beginPath()
    ctx.arc(hx, hy, w * 0.56, 0, Math.PI * 2)
    ctx.fill()
    const ox = d.y !== 0 ? cell * 0.2 : 0
    const oy = d.x !== 0 ? cell * 0.2 : 0
    // Blinzeln alle paar Sekunden
    const blink = !tot && now % 4300 < 120
    for (const s of [-1, 1]) {
      const ex = hx + ox * s + d.x * cell * 0.1
      const ey = hy + oy * s + d.y * cell * 0.1
      if (tot) {
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
      if (blink) ctx.ellipse(ex, ey, cell * 0.15, cell * 0.03, d.x ? Math.PI / 2 : 0, 0, Math.PI * 2)
      else ctx.arc(ex, ey, cell * 0.15, 0, Math.PI * 2)
      ctx.fill()
      if (blink) continue
      ctx.fillStyle = '#16211d'
      ctx.beginPath()
      ctx.arc(ex + d.x * cell * 0.06, ey + d.y * cell * 0.06, cell * 0.075, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
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
    ctx.strokeStyle = 'rgba(242, 154, 76, 0.9)'
    ctx.lineWidth = 2
    ctx.stroke()
    // Spitze in Richtung Apfel
    ctx.rotate(ang)
    ctx.fillStyle = '#F29A4C'
    ctx.beginPath()
    ctx.moveTo(r + 7, 0)
    ctx.lineTo(r - 1, -6)
    ctx.lineTo(r - 1, 6)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
    drawApfel(ctx, cx, cy - r * 0.04, r * 1.45, 1)
  }
}
