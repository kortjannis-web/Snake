/**
 * Spiellogik Endlos-Modus (und Kreativ-Modus), ohne Darstellung (laeuft auch im Test).
 *
 * Grundlage ist das Snake aus dem Hero-Telefon der Website: weicher Takt,
 * gepufferte Eingaben, Sofort-Wende, Gnadenschritt, Mauern Feld fuer Feld,
 * Teiche, keine Sackgassen und alle freien Felder bleiben erreichbar.
 *
 * Karte: besteht aus Bloecken von je einem halben Bildschirm (am Handy fast
 * quadratisch). Am Anfang zwei Bloecke = ein Bildschirm, dann kommt alle
 * `gebietAlle` Level ein Block an einer zufaelligen freien Stelle dazu, wie
 * bei Minecraft. Die Karte ist dadurch kein Rechteck mehr: `mask` sagt, welche
 * Felder im Rechteck drumherum wirklich zur Karte gehoeren.
 *
 * Zeit: `time` laeuft nur, solange `update()` aufgerufen wird (Pause = nicht
 * aufrufen). Alle Zeitpunkte im Spiel beziehen sich auf `time`.
 */
import { rng, type Rng } from './rng'
import * as R from './rules'
import type { Baum, Cause, Dir, Falle, Fenster, Frosch, GameEvent, Gift, Haus, Kreativ, Mauer, P, Side, Status, Teich, Turm, Wolke } from './types'

const { STEP, OPP, DIRS } = R

export type GameOpts = {
  screenW: number
  screenH: number
  tempo?: R.Tempo
  seed?: number
  startLevel?: number
  cfg?: Partial<R.Config>
  kreativ?: Kreativ | null
}

/** Schluessel fuer Sets (funktioniert auch fuer -1 und Karten bis 4000 Felder Kante) */
export const key = (x: number, y: number) => (y + 1) * 4096 + (x + 1)
const same = (a: P, b: P) => a.x === b.x && a.y === b.y
const manhattan = (a: P, b: P) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
const cheb = (a: P, b: P) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
const SIDE: Record<Dir, Side> = { u: 'top', d: 'bottom', l: 'left', r: 'right' }

type Art = 'falle' | 'wolke' | 'frosch'

export class Game {
  readonly cfg: R.Config
  /** Kreativ-Einstellungen (null = normales Endlos-Spiel) */
  kreativ: Kreativ | null
  screenW: number
  screenH: number
  readonly tempo: R.Tempo
  readonly r: Rng

  /* Karte aus Bloecken */
  readonly bw: number
  readonly bh: number
  blocks: P[]
  w = 0
  h = 0
  mask = new Uint8Array(0)

  body: P[] = []
  prev: P[] = []
  dir: Dir = 'r'
  prevDir: Dir = 'r'
  ate = false
  halt = false
  queue: Dir[] = []
  /** So viele Schritte bleibt das Schwanzende noch stehen (Wachsen) */
  wachsRest = 0

  apple: { p: P; t: number } = { p: { x: 0, y: 0 }, t: 0 }
  gift: Gift[] = []
  mauern: Mauer[] = []
  /** Alte Mauern, die gerade verschwinden */
  weg: { cells: P[]; t: number }[] = []
  teiche: Teich[] = []
  fallen: Falle[] = []
  /** Fallen, die zuschnappen und verschwinden */
  fallenWeg: { p: P; t: number }[] = []
  wolken: Wolke[] = []
  wolkenWeg: Wolke[] = []
  froesche: Frosch[] = []
  baeume: Baum[] = []
  haeuser: Haus[] = []
  tuerme: Turm[] = []

  time = 0
  last = 0
  tick: number
  level = 1
  apples = 0
  maxLen = 3
  /** Hoechster Level in dieser Runde (Rueckschlaege senken nur `level`) */
  maxLevel = 1
  /** Alle gegessenen Aepfel dieser Runde (auch die, deren Level verloren gingen) */
  gegessen = 0
  /** Nach einem Rueckschlag kurz geschuetzt (Wolke und Licht treffen nicht) */
  schutzBis = 0
  /** Verlorene Level durch Wolken und Licht */
  zurueck = 0
  status: Status = 'play'
  cause: Cause | null = null
  deathAt = 0
  /** Letzter neuer Block (fuer die Einblendung): Rechteck in Feldern und Seite, an der er angesetzt wurde */
  gebiet: { side: Side; t: number; x: number; y: number; w: number; h: number } | null = null
  expansions = 0
  events: GameEvent[] = []

  private next: Record<Art, number>
  private lastSpawn = -1e9
  /** Faellige Baeume, Haeuser und Tuerme, die noch keinen Platz gefunden haben */
  private offen = { baum: 0, haus: 0, turm: 0 }

  constructor(o: GameOpts) {
    this.cfg = { ...R.DEFAULTS, ...(o.cfg ?? {}) }
    this.kreativ = o.kreativ ?? null
    this.tempo = o.tempo ?? 'normal'
    this.r = rng(o.seed)
    // Block = halber Bildschirm, am Handy (hochkant) uebereinander, quer nebeneinander
    if (o.screenH >= o.screenW) {
      this.bw = o.screenW
      this.bh = Math.max(4, Math.floor(o.screenH / 2))
      this.blocks = [{ x: 0, y: 0 }, { x: 0, y: 1 }]
    } else {
      this.bh = o.screenH
      this.bw = Math.max(4, Math.floor(o.screenW / 2))
      this.blocks = [{ x: 0, y: 0 }, { x: 1, y: 0 }]
    }
    this.baueMaske()
    this.screenW = this.w
    this.screenH = this.h
    this.next = { falle: this.cfg.falleAb, wolke: this.cfg.wolkeAb, frosch: this.cfg.froschAb }
    this.tick = R.takt(this.cfg, this.tempo, 1)

    const y = Math.floor(this.h / 2)
    const x = Math.max(3, Math.floor(this.w / 2) - 3)
    this.body = [
      { x, y },
      { x: x - 1, y },
      { x: x - 2, y },
    ]
    this.apple = { p: { x: Math.min(this.w - 2, x + 5), y }, t: 0 }

    // Mit hoeherem Level starten: die Welt so aufbauen, wie sie bis dahin
    // ungefaehr entstanden waere (Bloecke, Teiche, Baeume, Haeuser, Tuerme)
    const start = Math.max(1, Math.floor(o.startLevel ?? 1))
    for (let l = 2; l <= start; l++) {
      this.level = l
      this.welt(l)
      if (this.waechstJetzt(l)) this.wachsRest++
    }
    this.level = start
    this.maxLevel = start
    this.apples = start - 1
    this.tick = R.takt(this.cfg, this.tempo, this.level)
    for (const k of ['falle', 'wolke', 'frosch'] as const) this.next[k] = Math.max(this.next[k], start + 1)
    if (start > 1) {
      this.gebiet = null
      this.layout()
      this.events = []
    }
  }

  /* ================= Ablauf ================= */

  /** Spielzeit weiterdrehen (dt in ms). Logik nur im Spiel, Zeit laeuft fuer Animationen weiter */
  update(dt: number) {
    this.time += Math.min(dt, 100)
    this.weg = this.weg.filter((m) => this.time - m.t < 240)
    this.teiche = this.teiche.filter((t) => t.drying === undefined || this.time - t.drying < 1500)
    if (this.status !== 'play') return
    // Nach einem Haenger nicht mehrere Schritte nachholen
    if (this.time - this.last > this.tick * 3) this.last = this.time - this.tick
    while (this.status === 'play' && this.time - this.last >= this.tick) {
      this.last += this.tick
      this.step()
    }
    if (this.status !== 'play') return
    this.wachsen()
    this.wolkenTakt()
    this.froschTakt()
    this.fallenTakt()
    this.regie()
  }

  /** Fortschritt zwischen zwei Feldern (0 bis 1) fuer die weiche Darstellung */
  alpha() {
    if (this.status !== 'play') return 1
    return Math.min(1, Math.max(0, (this.time - this.last) / this.tick))
  }

  private emit(e: GameEvent) {
    this.events.push(e)
  }

  /** Richtung in die Warteschlange (max. 3), keine Kehrtwende, keine Doppelung,
   *  Sofort-Wende im ersten Drittel eines Schritts (wie im Telefon) */
  turn(d: Dir, sofort = true) {
    if (this.status !== 'play') return
    if (
      sofort &&
      !this.queue.length &&
      !this.ate &&
      !this.halt &&
      this.prev.length === this.body.length &&
      this.time - this.last < this.tick * 0.34 &&
      d !== this.prevDir &&
      d !== OPP[this.prevDir]
    ) {
      this.body = this.prev.map((p) => ({ ...p }))
      this.dir = this.prevDir
      this.queue.push(d)
      this.step()
      return
    }
    const last = this.queue.length ? this.queue[this.queue.length - 1] : this.dir
    if (d === last || d === OPP[last] || this.queue.length >= 3) return
    this.queue.push(d)
  }

  /** Blickrichtungen (aktuell und schon gedrueckt) */
  blick(): Dir[] {
    return [this.dir, ...this.queue]
  }

  private waechstJetzt(level: number) {
    if (this.kreativ && !this.kreativ.wachsen) return false
    return R.waechst(this.cfg, level)
  }

  private step() {
    this.prev = this.body.map((p) => ({ ...p }))
    this.prevDir = this.dir
    this.ate = false
    const nd = this.queue.shift()
    if (nd) this.dir = nd
    const k = this.kreativ
    const h = this.body[0]
    const n = { x: h.x + STEP[this.dir].x, y: h.y + STEP[this.dir].y }
    const eats = same(n, this.apple.p)
    // Wachsen: das Schwanzende bleibt stehen. Kreativ mit fester Laenge: auf die Laenge bringen
    const fest = k && !k.wachsen ? Math.max(1, Math.floor(k.laenge)) : 0
    const grows = fest ? this.body.length < fest : this.wachsRest > 0
    const rest = grows ? this.body : this.body.slice(0, -1)

    // Giftapfel essen: sofort vorbei (kein Gnadenschritt, man hat ihn ja gegessen)
    const gi = this.gift.findIndex((g) => same(g.p, n))
    if (gi >= 0 && (!k || k.tod === 'an')) {
      this.body.unshift(n)
      this.body.pop()
      this.gift.splice(gi, 1)
      this.die('gift')
      return
    }

    const cause = this.gefahr(n, rest) ?? (gi >= 0 && k?.tod === 'anhalten' ? 'gift' : null)
    if (cause) {
      // Kreativ: nicht sterben, nur stehen bleiben
      if (k && k.tod !== 'an') {
        if (!this.halt) this.emit({ type: 'halt' })
        this.halt = true
        this.prev = this.body.map((p) => ({ ...p }))
        return
      }
      if (!this.halt) {
        // Erster Anlauf: stehen bleiben, abbiegen rettet noch
        this.halt = true
        this.prev = this.body.map((p) => ({ ...p }))
        this.last += this.tick * (this.cfg.gnade - 1)
        this.emit({ type: 'halt' })
        return
      }
      this.prev = this.body.map((p) => ({ ...p }))
      this.die(cause)
      return
    }
    this.halt = false
    this.body.unshift(n)
    if (!grows) this.body.pop()
    if (fest && this.body.length > fest) this.body.pop()
    if (grows && !fest && this.wachsRest > 0) this.wachsRest--
    this.maxLen = Math.max(this.maxLen, this.body.length)
    this.wachsen()
    this.wolkenNachruecken()
    if (eats) this.eat(n)
    else this.treffer(n)
  }

  /** Kopf in Giftwolke, Fensterlicht oder Lichtkegel: Level zurueck (nicht toedlich) */
  private treffer(n: P) {
    if (this.time < this.schutzBis) return
    if (this.kreativ && (!this.kreativ.rueckschlag || this.kreativ.tod === 'geist')) return
    if (this.wolken.some((w) => w.cells.some((p) => same(p, n)))) this.setback(this.cfg.wolkeZurueck, 'wolke')
    else if (this.imLicht(n)) this.setback(this.cfg.lichtZurueck, 'licht')
    else if (this.imKegel(n)) this.setback(this.cfg.kegelZurueck, 'kegel')
  }

  imLicht(n: P) {
    return this.haeuser.some((h) => h.strahl.some((p) => same(p, n)))
  }
  imKegel(n: P) {
    return this.tuerme.some((t) => t.kegel.some((p) => same(p, n)))
  }

  /** n Level zurueck: Schlange wird um das kuerzer, was sie in diesen Leveln gewachsen war */
  setback(n: number, grund: 'wolke' | 'licht' | 'kegel') {
    if (n <= 0) return
    const von = this.level
    const auf = Math.max(1, von - n)
    this.kuerzen(auf, von)
    this.level = auf
    this.apples = auf - 1
    this.zurueck += von - auf
    this.tick = R.takt(this.cfg, this.tempo, this.level)
    this.schutzBis = this.time + this.cfg.schutz * 1000
    this.emit({ type: 'setback', von, auf, grund })
  }

  private kuerzen(auf: number, von: number) {
    if (this.kreativ && !this.kreativ.wachsen) return
    let kuerzer = 0
    for (let l = auf + 1; l <= von; l++) if (R.waechst(this.cfg, l)) kuerzer++
    const ausRest = Math.min(this.wachsRest, kuerzer)
    this.wachsRest -= ausRest
    kuerzer -= ausRest
    const len = Math.max(3, this.body.length - kuerzer)
    this.body = this.body.slice(0, len)
    this.prev = this.prev.slice(0, len)
  }

  /** Was liegt auf diesem Feld (fuer den Kopf)? */
  gefahr(n: P, rest: P[] = this.body): Cause | null {
    if (!this.inside(n)) return 'rand'
    const k = this.kreativ
    if (k?.tod === 'geist') return null
    if (this.mauern.some((m) => m.cells.slice(0, m.grown).some((p) => same(p, n)))) return 'mauer'
    if (this.teiche.some((t) => t.drying === undefined && t.cells.some((p) => same(p, n)))) return 'teich'
    if (this.fallen.some((f) => same(f.p, n))) return 'falle'
    if (this.froesche.some((f) => f.gone === undefined && same(f.p, n))) return 'frosch'
    if (this.baeume.some((b) => b.cells.some((p) => same(p, n)))) return 'baum'
    if (this.haeuser.some((h) => h.cells.some((p) => same(p, n)))) return 'haus'
    if (this.tuerme.some((t) => t.cells.some((p) => same(p, n)))) return 'turm'
    if (!k?.durchSelbst && rest.some((p) => same(p, n))) return 'selbst'
    return null
  }

  private die(cause: Cause) {
    this.status = 'over'
    this.cause = cause
    this.deathAt = this.time
    this.queue = []
    this.emit({ type: 'die', cause })
  }

  private eat(n: P) {
    this.ate = true
    this.apples++
    this.gegessen++
    this.level++
    // Nur beim ersten Erreichen eines Levels: neuer Block, Teich, Baum, Haus, Turm, Hinweise
    const neu = this.level > this.maxLevel
    if (neu) this.maxLevel = this.level
    if (this.waechstJetzt(this.level)) this.wachsRest++
    this.emit({ type: 'eat', level: this.level, p: { ...n } })
    if (neu && this.level % 10 === 0) this.emit({ type: 'milestone', level: this.level })
    if (neu) {
      for (const u of R.unlocks(this.cfg)) if (u.level === this.level) this.emit({ type: 'unlock', what: u.what, level: this.level })
      this.welt(this.level)
    }
    this.layout()
    this.tick = R.takt(this.cfg, this.tempo, this.level)
  }

  /** Was beim ersten Erreichen eines Levels dazukommt und bleibt */
  private welt(l: number) {
    const c = this.cfg
    if (R.neuesGebiet(c, l)) this.expand()
    if (R.neuerTeich(c, l)) this.neuerTeich(R.teichGroesse(c, l))
    if (R.neuerBaum(c, l)) this.offen.baum++
    if (R.neuesHaus(c, l)) this.offen.haus++
    if (R.neuerTurm(c, l)) this.offen.turm++
    this.bauten()
  }

  /** Faellige Baeume, Haeuser und Tuerme setzen, soweit Platz ist */
  private bauten() {
    const felder = this.felder()
    while (this.offen.baum > 0 && this.baeume.length < R.baumMax(this.cfg, felder) && this.neuerBaum()) this.offen.baum--
    while (this.offen.haus > 0 && this.haeuser.length < R.hausMax(this.cfg, felder) && this.neuesHaus()) this.offen.haus--
    while (this.offen.turm > 0 && this.tuerme.length < R.turmMax(this.cfg, felder) && this.neuerTurm()) this.offen.turm--
  }

  /** Nach jedem Apfel: Mauern neu, Licht und Kegel weiter, Apfel, Giftaepfel, Ereignisse */
  private layout() {
    if (this.mauern.length) {
      this.weg.push(...this.mauern.map((m) => ({ cells: m.cells.slice(0, m.grown), t: this.time })))
      this.mauern = []
    }
    this.bauten()
    const plan = R.mauern(this.cfg, this.level, this.felder())
    for (const len of plan) this.neueMauer(len)
    if (plan.length) this.emit({ type: 'wall' })
    this.lichtWechsel()
    this.tuermeDrehen()
    this.neuerApfel()
    this.neueGifte()
    for (const k of ['falle', 'wolke', 'frosch'] as const) {
      if (this.level < R.ab(this.cfg, k) || this.level < this.next[k]) continue
      const [a, b] = R.pause(this.cfg, k, this.level)
      this.next[k] = this.level + this.r.int(a, b)
      this.spawn(k)
    }
  }

  /** Kreativ: direkt auf einen Level springen (hoeher: Welt waechst mit, niedriger: kuerzer) */
  springeZu(ziel: number) {
    const auf = Math.max(1, Math.floor(ziel))
    if (auf === this.level) return
    if (auf > this.level) {
      for (let l = this.level + 1; l <= auf; l++) {
        if (this.waechstJetzt(l)) this.wachsRest++
        if (l > this.maxLevel) {
          this.maxLevel = l
          this.welt(l)
        }
      }
    } else this.kuerzen(auf, this.level)
    this.level = auf
    this.apples = auf - 1
    this.tick = R.takt(this.cfg, this.tempo, this.level)
    this.layout()
  }

  /* ================= Karte aus Bloecken ================= */

  felder() {
    return this.blocks.length * this.bw * this.bh
  }

  private baueMaske() {
    this.w = (Math.max(...this.blocks.map((b) => b.x)) + 1) * this.bw
    this.h = (Math.max(...this.blocks.map((b) => b.y)) + 1) * this.bh
    this.mask = new Uint8Array(this.w * this.h)
    for (const b of this.blocks)
      for (let y = 0; y < this.bh; y++) this.mask.fill(1, (b.y * this.bh + y) * this.w + b.x * this.bw, (b.y * this.bh + y) * this.w + (b.x + 1) * this.bw)
  }

  /** Ein neuer Block (halber Bildschirm) an einer zufaelligen freien Stelle neben der Karte */
  expand() {
    const belegt = new Set(this.blocks.map((b) => key(b.x, b.y)))
    const cand: { p: P; d: Dir }[] = []
    const seen = new Set<number>()
    for (const b of this.blocks)
      for (const d of DIRS) {
        const p = { x: b.x + STEP[d].x, y: b.y + STEP[d].y }
        const k = key(p.x, p.y)
        if (belegt.has(k) || seen.has(k)) continue
        seen.add(k)
        cand.push({ p, d })
      }
    const { p, d } = this.r.pick(cand)
    let dx = 0
    let dy = 0
    if (p.x < 0) {
      this.blocks.forEach((b) => b.x++)
      p.x = 0
      dx = this.bw
    }
    if (p.y < 0) {
      this.blocks.forEach((b) => b.y++)
      p.y = 0
      dy = this.bh
    }
    this.blocks.push(p)
    this.baueMaske()
    if (dx || dy) this.shift(dx, dy)
    this.expansions++
    const side = SIDE[d]
    this.gebiet = { side, t: this.time, x: p.x * this.bw, y: p.y * this.bh, w: this.bw, h: this.bh }
    this.emit({ type: 'expand', side, add: this.bw * this.bh, dx, dy })
  }

  private shift(dx: number, dy: number) {
    const mv = (p: P) => {
      p.x += dx
      p.y += dy
    }
    this.body.forEach(mv)
    this.prev.forEach(mv)
    mv(this.apple.p)
    this.gift.forEach((g) => mv(g.p))
    this.mauern.forEach((m) => m.cells.forEach(mv))
    this.weg.forEach((m) => m.cells.forEach(mv))
    this.teiche.forEach((t) => t.cells.forEach(mv))
    this.fallen.forEach((f) => mv(f.p))
    this.fallenWeg.forEach((f) => mv(f.p))
    for (const w of [...this.wolken, ...this.wolkenWeg]) {
      mv(w.c)
      w.cells.forEach(mv)
      w.pending.forEach(mv)
    }
    this.froesche.forEach((f) => {
      mv(f.p)
      mv(f.from)
    })
    this.baeume.forEach((b) => {
      b.cells.forEach(mv)
      mv(b.root)
    })
    this.haeuser.forEach((h) => {
      h.cells.forEach(mv)
      h.fenster.forEach((f) => mv(f.p))
      h.strahl.forEach(mv)
    })
    this.tuerme.forEach((t) => {
      mv(t.c)
      t.cells.forEach(mv)
      t.kegel.forEach(mv)
    })
  }

  /* ================= Platz finden ================= */

  inside(c: P) {
    return c.x >= 0 && c.y >= 0 && c.x < this.w && c.y < this.h && this.mask[c.y * this.w + c.x] === 1
  }

  /** Feld mit allen vier Nachbarn auf der Karte (nicht am Rand) */
  private innen(c: P) {
    return this.inside(c) && DIRS.every((d) => this.inside({ x: c.x + STEP[d].x, y: c.y + STEP[d].y }))
  }

  /** Alle Hindernisse (fuer Platzsuche und Erreichbarkeit). Mauern mit allen geplanten Feldern */
  hindernisse(): Set<number> {
    const s = new Set<number>()
    const add = (p: P) => s.add(key(p.x, p.y))
    this.mauern.forEach((m) => m.cells.forEach(add))
    this.teiche.forEach((t) => t.cells.forEach(add))
    this.fallen.forEach((f) => add(f.p))
    this.wolken.forEach((w) => {
      w.cells.forEach(add)
      w.pending.forEach(add)
    })
    this.froesche.forEach((f) => f.gone === undefined && add(f.p))
    this.gift.forEach((g) => add(g.p))
    this.baeume.forEach((b) => b.cells.forEach(add))
    this.haeuser.forEach((h) => h.cells.forEach(add))
    this.tuerme.forEach((t) => t.cells.forEach(add))
    return s
  }

  /** Feste Bauten (Haeuser, Baeume, Tuerme): da endet Licht */
  private bauSet() {
    const s = new Set<number>()
    for (const o of this.haeuser) o.cells.forEach((c) => s.add(key(c.x, c.y)))
    for (const b of this.baeume) b.cells.forEach((c) => s.add(key(c.x, c.y)))
    for (const t of this.tuerme) t.cells.forEach((c) => s.add(key(c.x, c.y)))
    return s
  }

  private freieNachbarn(c: P, wand: Set<number>) {
    let n = 0
    for (const d of DIRS) {
      const p = { x: c.x + STEP[d].x, y: c.y + STEP[d].y }
      if (this.inside(p) && !wand.has(key(p.x, p.y))) n++
    }
    return n
  }

  /** Breitensuche vom Kopf (der Koerper zaehlt als frei, er zieht ja weiter).
   *  Mit Typed Arrays, weil sie bei grossen Karten oft laeuft */
  erreichbar(wand: Set<number>): { size: number; has: (k: number) => boolean } {
    const { w, h, mask } = this
    const zu = new Uint8Array(w * h)
    for (let i = 0; i < zu.length; i++) zu[i] = mask[i] ? 0 : 1
    for (const k of wand) {
      const x = (k % 4096) - 1
      const y = Math.floor(k / 4096) - 1
      if (x >= 0 && y >= 0 && x < w && y < h) zu[y * w + x] = 1
    }
    const seen = new Uint8Array(w * h)
    const queue = new Int32Array(w * h)
    const start = this.body[0]
    let head = 0
    let tail = 0
    let size = 0
    if (this.inside(start)) {
      const s0 = start.y * w + start.x
      seen[s0] = 1
      queue[tail++] = s0
      size = 1
    }
    while (head < tail) {
      const i = queue[head++]
      const x = i % w
      const y = (i - x) / w
      const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]
      for (const n of nb) {
        if (n < 0 || seen[n] || zu[n]) continue
        seen[n] = 1
        queue[tail++] = n
        size++
      }
    }
    return {
      size,
      has: (k: number) => {
        const x = (k % 4096) - 1
        const y = Math.floor(k / 4096) - 1
        return x >= 0 && y >= 0 && x < w && y < h && seen[y * w + x] === 1
      },
    }
  }

  /** Neue Hindernis-Felder: schliessen nichts ab und bauen keine Sackgasse
   *  (freies Feld mit nur einem freien Nachbarn). Geprueft wird nur, was sich
   *  aendert, damit voruebergehende Gefahren (Wolken) nichts blockieren. */
  private keinAbschluss(cells: P[], wand: Set<number>) {
    const neu = new Set(wand)
    for (const c of cells) neu.add(key(c.x, c.y))
    for (const c of cells)
      for (const d of DIRS) {
        const nb = { x: c.x + STEP[d].x, y: c.y + STEP[d].y }
        if (!this.inside(nb) || neu.has(key(nb.x, nb.y))) continue
        if (this.freieNachbarn(nb, neu) <= 1) return false
      }
    const vorher = this.erreichbar(wand)
    const nachher = this.erreichbar(neu)
    const weg = cells.filter((c) => vorher.has(key(c.x, c.y))).length
    return nachher.size === vorher.size - weg
  }

  /** Liegt das Feld im Streifen (3 breit) vor dem Kopf in Blickrichtung? */
  imWeg(c: P, weit = Infinity) {
    const head = this.body[0]
    return this.blick().some((dir) => {
      const d = STEP[dir]
      const vor = (c.x - head.x) * d.x + (c.y - head.y) * d.y
      const quer = Math.abs((c.x - head.x) * d.y - (c.y - head.y) * d.x)
      return vor > 0 && vor <= weit && quer <= 1
    })
  }

  aufSchlange(c: P) {
    return this.body.some((p) => same(p, c))
  }

  /** Gemeinsame Pruefung fuer Mauern, Teiche und Bauten */
  private platzOk(cells: P[], art: 'mauer' | 'teich') {
    const head = this.body[0]
    // Ein Feld Luft zu anderen festen Hindernissen
    const luft = new Set<number>()
    for (const p of [
      ...this.teiche.flatMap((t) => t.cells),
      ...this.mauern.flatMap((m) => m.cells),
      ...this.baeume.flatMap((b) => b.cells),
      ...this.haeuser.flatMap((h) => h.cells),
      ...this.tuerme.flatMap((t) => t.cells),
    ])
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) luft.add(key(p.x + dx, p.y + dy))
    const wand = this.hindernisse()
    const seen = new Set<number>()
    for (const c of cells) {
      const k = key(c.x, c.y)
      if (!this.inside(c) || luft.has(k) || wand.has(k) || seen.has(k)) return false
      seen.add(k)
      if (same(c, this.apple.p)) return false
      if (art === 'teich' ? cheb(c, head) < 3 : manhattan(c, head) < 5) return false
      if (this.body.some((p) => cheb(p, c) < 2)) return false
      if (this.imWeg(c)) return false
    }
    return this.keinAbschluss(cells, wand)
  }

  private neueMauer(len: number) {
    const r = this.r
    for (let versuch = 0; versuch < 400; versuch++) {
      const spaet = versuch > 250
      const l = spaet ? 2 : len
      const knickBei = !spaet && l > 2 && r.next() < R.knick(l) ? r.int(1, l - 1) : -1
      let d = STEP[r.pick(DIRS)]
      let cur = { x: r.int(0, this.w - 1), y: r.int(0, this.h - 1) }
      const cells: P[] = [cur]
      for (let i = 1; i < l; i++) {
        if (i === knickBei) d = r.next() < 0.5 ? { x: d.y, y: -d.x } : { x: -d.y, y: d.x }
        cur = { x: cur.x + d.x, y: cur.y + d.y }
        cells.push(cur)
      }
      // Die ersten Versuche nur im Inneren (nicht am Rand)
      if (versuch < 220 && !cells.every((c) => this.innen(c))) continue
      if (!this.platzOk(cells, 'mauer')) continue
      this.mauern.push({ cells, grown: 0, t: [], next: this.time + 25 })
      return true
    }
    return false
  }

  /** Mauern wachsen um ein Feld je 25 ms, aber nie unter die Schlange */
  private wachsen() {
    for (const m of this.mauern)
      while (m.grown < m.cells.length && this.time >= m.next) {
        const c = m.cells[m.grown]
        if (this.aufSchlange(c)) break
        m.t[m.grown] = this.time
        m.grown++
        m.next = this.time + 25
      }
  }

  private neuerTeich(n: number) {
    const r = this.r
    for (let versuch = 0; versuch < 500; versuch++) {
      // Gelingt es lange nicht, etwas kleiner
      const size = Math.max(2, n - Math.floor(versuch / 120))
      const cells: P[] = [{ x: r.int(0, this.w - 1), y: r.int(0, this.h - 1) }]
      let guard = 0
      while (cells.length < size && guard++ < 60) {
        const von = r.pick(cells)
        const d = STEP[r.pick(DIRS)]
        const c = { x: von.x + d.x, y: von.y + d.y }
        if (!cells.some((o) => same(o, c))) cells.push(c)
      }
      if (cells.length < size || !this.platzOk(cells, 'teich')) continue
      this.teiche.push({ cells, t: this.time })
      this.emit({ type: 'pond' })
      // Zu viele Teiche: der aelteste trocknet aus
      const lebend = this.teiche.filter((t) => t.drying === undefined)
      if (lebend.length > R.teichMax(this.cfg, this.felder())) lebend[0].drying = this.time
      return true
    }
    return false
  }

  /** Freie Felder fuer Aepfel und Giftaepfel: erreichbar, keine Sackgasse, nicht im Licht */
  private freieFelder(extra: (c: P) => boolean) {
    const wand = this.hindernisse()
    // Kuenftige Wolkenstufe meiden (sonst wird der Apfel gleich verschluckt)
    for (const w of this.wolken)
      for (const o of R.wolkenForm(w.stage + 1)) wand.add(key(w.c.x + o.x, w.c.y + o.y))
    for (const h of this.haeuser) for (const p of h.strahl) wand.add(key(p.x, p.y))
    for (const t of this.tuerme) for (const p of t.kegel) wand.add(key(p.x, p.y))
    const reach = this.erreichbar(wand)
    const out: P[] = []
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const c = { x, y }
        const k = key(x, y)
        if (!this.mask[y * this.w + x] || wand.has(k) || !reach.has(k) || this.aufSchlange(c) || same(c, this.apple.p)) continue
        if (this.freieNachbarn(c, wand) <= 1 || !extra(c)) continue
        out.push(c)
      }
    return out
  }

  /** Neuer Apfel: zufaellig, auf grossen Karten eher in Reichweite (ca. ein Bildschirm) */
  neuerApfel() {
    const head = this.body[0]
    const nah = this.screenW + this.screenH
    let cand = this.freieFelder((c) => manhattan(c, head) >= 3 && manhattan(c, head) <= nah)
    if (!cand.length) cand = this.freieFelder(() => true)
    if (!cand.length) cand = this.freieFelderNotfall()
    if (!cand.length) return
    this.apple = { p: this.r.pick(cand), t: this.time }
  }

  private freieFelderNotfall() {
    const wand = this.hindernisse()
    const out: P[] = []
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        if (this.mask[y * this.w + x] && !wand.has(key(x, y)) && !this.aufSchlange({ x, y }) && !same({ x, y }, this.apple.p)) out.push({ x, y })
    return out
  }

  /** Giftaepfel neu verteilen, einer davon gern in der Naehe des echten Apfels */
  private neueGifte() {
    this.gift = []
    const n = R.giftAnzahl(this.cfg, this.level)
    const head = this.body[0]
    for (let i = 0; i < n; i++) {
      const nahApfel = i === 0 && this.r.next() < 0.6
      const ok = (c: P) =>
        manhattan(c, head) >= 4 &&
        !this.imWeg(c, 6) &&
        cheb(c, this.apple.p) >= 2 &&
        (!nahApfel || manhattan(c, this.apple.p) <= 5)
      let cand = this.freieFelder(ok)
      if (!cand.length && nahApfel) cand = this.freieFelder((c) => manhattan(c, head) >= 4 && !this.imWeg(c, 6) && cheb(c, this.apple.p) >= 2)
      // Ein Giftapfel ist ein Hindernis: darf nichts abschliessen
      let wahl: P | null = null
      const wand = this.hindernisse()
      for (let v = 0; v < 30 && cand.length && !wahl; v++) {
        const c = this.r.pick(cand)
        if (this.keinAbschluss([c], wand)) wahl = c
        else cand = cand.filter((o) => o !== c)
      }
      if (!wahl) break
      this.gift.push({ p: wahl, t: this.time, ecke: this.r.next() * Math.PI * 2 })
    }
  }

  /* ================= Baeume, Haeuser, Tuerme ================= */

  /** Liegende Tanne (1-1-2-1) irgendwo mit Abstand, bleibt fuer immer */
  private neuerBaum() {
    const r = this.r
    for (let versuch = 0; versuch < 500; versuch++) {
      const dir = r.pick(DIRS)
      const d = STEP[dir]
      const seite = r.next() < 0.5 ? 1 : -1
      const q = { x: -d.y * seite, y: d.x * seite }
      const root = { x: r.int(0, this.w - 1), y: r.int(0, this.h - 1) }
      const cells = R.BAUM_FORM.map((f) => ({ x: root.x + d.x * f.a + q.x * f.q, y: root.y + d.y * f.a + q.y * f.q }))
      if (!this.platzOk(cells, 'mauer')) continue
      this.baeume.push({ cells, root, dir, seite: seite as 1 | -1, t: this.time })
      this.emit({ type: 'tree' })
      return true
    }
    return false
  }

  /** Haus (2x3 oder mit Ecke), gedreht/gespiegelt, mit vier Fenstern (eins je Seite) */
  private neuesHaus() {
    const r = this.r
    for (let versuch = 0; versuch < 500; versuch++) {
      let form = r.pick(R.HAUS_FORMEN).map((p) => ({ ...p }))
      if (r.next() < 0.5) form = form.map((p) => ({ x: -p.x, y: p.y }))
      for (let k = r.int(0, 3); k > 0; k--) form = form.map((p) => ({ x: -p.y, y: p.x }))
      const mx = Math.min(...form.map((p) => p.x))
      const my = Math.min(...form.map((p) => p.y))
      form = form.map((p) => ({ x: p.x - mx, y: p.y - my }))
      const ox = r.int(0, this.w - 1)
      const oy = r.int(0, this.h - 1)
      const cells = form.map((p) => ({ x: p.x + ox, y: p.y + oy }))
      if (!this.platzOk(cells, 'mauer')) continue
      const drin = new Set(cells.map((c) => key(c.x, c.y)))
      const fenster: Fenster[] = DIRS.map((d) => {
        const rand = cells.filter((c) => !drin.has(key(c.x + STEP[d].x, c.y + STEP[d].y)))
        return { p: { ...r.pick(rand) }, d }
      })
      const h: Haus = { cells, t: this.time, fenster, licht: -1, lichtT: this.time, strahl: [], kamin: r.int(0, cells.length - 1) }
      this.haeuser.push(h)
      this.lichtFuer(h, true)
      this.emit({ type: 'house' })
      return true
    }
    return false
  }

  /** Lichtfelder vor einem Fenster (bis `lichtWeite`, endet an Kartenrand, Haus, Baum oder Turm) */
  private strahlVon(h: Haus, i: number, bau = this.bauSet()) {
    const f = h.fenster[i]
    const out: P[] = []
    for (let k = 1; k <= this.cfg.lichtWeite; k++) {
      const c = { x: f.p.x + STEP[f.d].x * k, y: f.p.y + STEP[f.d].y * k }
      if (!this.inside(c) || bau.has(key(c.x, c.y))) break
      out.push(c)
    }
    return out
  }

  /** Neues Fenster fuer ein Haus: Das Licht darf nirgends auf der Schlange liegen.
   *  Moeglichst ein anderes Fenster als vorher und nicht direkt vor dem Kopf.
   *  Passt keins (alle Seiten zugebaut oder die Schlange liegt davor), bleibt
   *  das Haus diese Runde dunkel. */
  private lichtFuer(h: Haus, erstes = false) {
    const head = this.body[0]
    const bau = this.bauSet()
    const andere = this.r.shuffle([0, 1, 2, 3].filter((i) => erstes || i !== h.licht))
    const reihe = h.licht >= 0 && !erstes ? [...andere, h.licht] : andere
    let gut = -1
    let ok = -1
    let strahl: P[] = []
    for (const i of reihe) {
      const s = this.strahlVon(h, i, bau)
      if (!s.length || s.some((p) => this.aufSchlange(p))) continue
      if (ok < 0) {
        ok = i
        strahl = s
      }
      if (s.every((p) => manhattan(p, head) > 2)) {
        gut = i
        strahl = s
        break
      }
    }
    h.licht = gut >= 0 ? gut : ok
    h.strahl = h.licht >= 0 ? strahl : []
    h.lichtT = this.time
  }

  private lichtWechsel() {
    if (!this.haeuser.length) return
    for (const h of this.haeuser) this.lichtFuer(h)
    this.emit({ type: 'light' })
  }

  /** Jaegerturm 2x2 mit Lichtkegel in eine zufaellige Richtung */
  private neuerTurm() {
    const r = this.r
    for (let versuch = 0; versuch < 500; versuch++) {
      const c = { x: r.int(0, this.w - 2), y: r.int(0, this.h - 2) }
      const cells = [c, { x: c.x + 1, y: c.y }, { x: c.x, y: c.y + 1 }, { x: c.x + 1, y: c.y + 1 }]
      if (!this.platzOk(cells, 'mauer')) continue
      const dir = r.pick(DIRS)
      const t: Turm = { c: { ...c }, cells, dir, t: this.time, kegel: [], kegelT: this.time, altDir: dir }
      this.tuerme.push(t)
      this.kegel(t)
      this.emit({ type: 'tower' })
      return true
    }
    return false
  }

  /** Kegel: 2 breit, `kegelLaenge` lang. Endet am Kartenrand, an Bauten und vor
   *  der Schlange (sie wirft Schatten, so gibt es nie einen Sofort-Treffer) */
  private kegel(t: Turm) {
    const d = STEP[t.dir]
    const drin = new Set(t.cells.map((c) => key(c.x, c.y)))
    const vorn = t.cells.filter((c) => !drin.has(key(c.x + d.x, c.y + d.y)))
    const bau = this.bauSet()
    t.kegel = []
    for (const s of vorn)
      for (let k = 1; k <= this.cfg.kegelLaenge; k++) {
        const c = { x: s.x + d.x * k, y: s.y + d.y * k }
        if (!this.inside(c) || bau.has(key(c.x, c.y)) || this.aufSchlange(c)) break
        t.kegel.push(c)
      }
    t.kegelT = this.time
  }

  /** Jede Runde dreht sich jeder Turm eine Vierteldrehung im Uhrzeigersinn */
  private tuermeDrehen() {
    for (const t of this.tuerme) {
      t.altDir = t.dir
      t.dir = R.CW[t.dir]
      this.kegel(t)
    }
  }

  /* ================= Ereignisse ================= */

  get aktiveFroesche() {
    return this.froesche.filter((f) => f.gone === undefined)
  }

  aktiveEreignisse() {
    return this.fallen.length + this.wolken.length + this.aktiveFroesche.length
  }

  /** Haelt die Mindestzahl an Ereignissen (Fallen, Wolken, Froesche) */
  private regie() {
    const min = R.mindestEreignisse(this.cfg, this.level)
    if (this.aktiveEreignisse() >= min || this.time - this.lastSpawn < 2500) return
    const arten = (['falle', 'wolke', 'frosch'] as const).filter((k) => this.level >= R.ab(this.cfg, k))
    if (!arten.length) return
    const anzahl = { falle: this.fallen.length, wolke: this.wolken.length, frosch: this.aktiveFroesche.length }
    const wenig = Math.min(...arten.map((k) => anzahl[k]))
    const wahl = this.r.pick(arten.filter((k) => anzahl[k] === wenig))
    if (!this.spawn(wahl)) this.lastSpawn = this.time // nicht in jedem Bild neu versuchen
  }

  spawn(k: Art) {
    const ok = k === 'falle' ? this.neueFalle() : k === 'wolke' ? this.neueWolke() : this.neuerFrosch()
    if (ok) this.lastSpawn = this.time
    return ok
  }

  /** Baerenfalle genau in der Bahn: 5 bis 8 Felder vor dem Kopf */
  neueFalle() {
    const head = this.body[0]
    const dir = this.queue.length ? this.queue[this.queue.length - 1] : this.dir
    const d = STEP[dir]
    const lo = Math.min(this.cfg.falleAbstandMin, this.cfg.falleAbstandMax)
    const hi = Math.max(this.cfg.falleAbstandMin, this.cfg.falleAbstandMax)
    const ks = this.r.shuffle(Array.from({ length: hi - lo + 1 }, (_, i) => lo + i))
    const wand = this.hindernisse()
    for (const k of ks) {
      const c = { x: head.x + d.x * k, y: head.y + d.y * k }
      if (!this.inside(c) || wand.has(key(c.x, c.y)) || this.aufSchlange(c) || same(c, this.apple.p)) continue
      if (!this.keinAbschluss([c], wand)) continue
      this.fallen.push({ p: c, t: this.time, until: this.time + this.cfg.falleDauer * 1000 })
      this.emit({ type: 'trap' })
      return true
    }
    return false
  }

  private fallenTakt() {
    const zu = this.fallen.filter((f) => this.time >= f.until)
    if (zu.length) {
      this.fallen = this.fallen.filter((f) => this.time < f.until)
      this.fallenWeg.push(...zu.map((f) => ({ p: f.p, t: this.time })))
    }
    this.fallenWeg = this.fallenWeg.filter((f) => this.time - f.t < 1000)
  }

  neueWolke() {
    const head = this.body[0]
    const wand = this.hindernisse()
    const cand: P[] = []
    for (let y = 1; y < this.h - 1; y++)
      for (let x = 1; x < this.w - 1; x++) {
        const c = { x, y }
        if (!this.innen(c) || wand.has(key(x, y)) || this.aufSchlange(c) || same(c, this.apple.p)) continue
        if (manhattan(c, head) < 7 || this.imWeg(c, 10)) continue
        cand.push(c)
      }
    if (!cand.length) return false
    const c = this.r.pick(cand)
    this.wolken.push({
      c,
      t: this.time,
      stage: 0,
      maxStage: R.wolkeMaxStufe(this.cfg, this.level),
      nextAt: this.time + this.cfg.wolkeTakt * 1000,
      until: Infinity,
      cells: [{ ...c }],
      pending: [],
      bornAt: [this.time],
    })
    this.emit({ type: 'cloud' })
    return true
  }

  private wolkenTakt() {
    for (const w of this.wolken) {
      if (w.stage < w.maxStage && this.time >= w.nextAt) {
        w.stage++
        w.nextAt = this.time + this.cfg.wolkeTakt * 1000
        if (w.stage === w.maxStage) w.until = this.time + R.WOLKE_VERWEILEN
        const has = new Set([...w.cells, ...w.pending].map((p) => key(p.x, p.y)))
        for (const o of R.wolkenForm(w.stage)) {
          const c = { x: w.c.x + o.x, y: w.c.y + o.y }
          if (!this.inside(c) || has.has(key(c.x, c.y))) continue
          if (this.aufSchlange(c)) w.pending.push(c)
          else {
            w.cells.push(c)
            w.bornAt.push(this.time)
          }
        }
        this.emit({ type: 'cloudGrow' })
        this.wolkeVerschluckt(w)
      }
      if (w.stage >= w.maxStage && w.until === Infinity) w.until = this.time + R.WOLKE_VERWEILEN
    }
    const weg = this.wolken.filter((w) => this.time >= w.until)
    if (weg.length) {
      this.wolken = this.wolken.filter((w) => this.time < w.until)
      this.wolkenWeg.push(...weg)
    }
    this.wolkenWeg = this.wolkenWeg.filter((w) => this.time - w.until < R.WOLKE_AUFLOESEN)
  }

  /** Felder, die unter der Schlange lagen, kommen dazu, sobald sie frei sind */
  private wolkenNachruecken() {
    for (const w of this.wolken) {
      if (!w.pending.length) continue
      const frei = w.pending.filter((c) => !this.aufSchlange(c))
      if (!frei.length) continue
      w.pending = w.pending.filter((c) => this.aufSchlange(c))
      for (const c of frei) {
        w.cells.push(c)
        w.bornAt.push(this.time)
      }
      this.wolkeVerschluckt(w)
    }
  }

  /** Was die Wolke ueberdeckt: Apfel springt woandershin, Giftaepfel verschwinden */
  private wolkeVerschluckt(w: Wolke) {
    const in_ = (p: P) => w.cells.some((c) => same(c, p))
    if (in_(this.apple.p)) this.neuerApfel()
    this.gift = this.gift.filter((g) => !in_(g.p))
  }

  /** Frosch: irgendwo mit Abstand zum Kopf, schaut in eine Richtung mit Platz */
  neuerFrosch() {
    if (this.aktiveFroesche.length >= this.cfg.froschAnzahl) return false
    const head = this.body[0]
    const wand = this.hindernisse()
    const cand: { p: P; dir: Dir }[] = []
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const p = { x, y }
        if (!this.mask[y * this.w + x] || wand.has(key(x, y)) || this.aufSchlange(p) || same(p, this.apple.p)) continue
        if (manhattan(p, head) < 6 || this.imWeg(p, 8)) continue
        const dirs = DIRS.filter((d) => this.inside({ x: x + STEP[d].x, y: y + STEP[d].y }))
        if (dirs.length) cand.push({ p, dir: this.r.pick(dirs) })
      }
    if (!cand.length) return false
    const c = this.r.pick(cand)
    this.froesche.push({
      p: c.p,
      from: { ...c.p },
      dir: c.dir,
      altDir: c.dir,
      drehT: -1e9,
      t: this.time,
      flugAb: -1e9,
      hopAt: this.time + Math.max(R.FROSCH_ANLAUF + 400, this.cfg.froschSprung * 1000),
    })
    this.emit({ type: 'frog' })
    return true
  }

  /** Kann der Frosch auf dieses Feld? (nicht auf Hindernisse, nicht in die Schlange; durch Wolken schon) */
  private froschFrei(c: P, f: Frosch, wand: Set<number>) {
    if (!this.inside(c) || this.aufSchlange(c)) return false
    const k = key(c.x, c.y)
    return k === key(f.p.x, f.p.y) || !wand.has(k)
  }

  private froschWand() {
    const wand = this.hindernisse()
    for (const w of this.wolken) for (const p of [...w.cells, ...w.pending]) wand.delete(key(p.x, p.y))
    return wand
  }

  private froschTakt() {
    const c = this.cfg
    let wand: Set<number> | null = null
    for (const f of this.froesche) {
      if (f.gone !== undefined) continue
      // Wende 0,25 s nach der Landung
      if (f.drehAt !== undefined && this.time >= f.drehAt && f.neuDir) {
        f.altDir = f.dir
        f.dir = f.neuDir
        f.drehT = this.time
        f.drehAt = undefined
        f.neuDir = undefined
      }
      if (this.time < f.hopAt) continue
      const ziel = { x: f.p.x + STEP[f.dir].x, y: f.p.y + STEP[f.dir].y }
      if (!this.inside(ziel)) {
        // Ueber den Kartenrand: huepft weg und verschwindet
        f.from = { ...f.p }
        f.p = ziel
        f.flugAb = this.time
        f.gone = this.time
        this.emit({ type: 'hop', p: { ...f.from } })
        continue
      }
      wand ??= this.froschWand()
      if (!this.froschFrei(ziel, f, wand)) {
        // Versperrt (oder die Schlange liegt davor): in eine freie Richtung drehen, gleich nochmal Anlauf
        const w = wand
        const frei = this.r.shuffle(DIRS.filter((d) => d !== f.dir)).find((d) => this.froschFrei({ x: f.p.x + STEP[d].x, y: f.p.y + STEP[d].y }, f, w))
        if (frei) {
          f.altDir = f.dir
          f.dir = frei
          f.drehT = this.time
        }
        f.hopAt = this.time + R.FROSCH_ANLAUF + 300
        continue
      }
      wand.delete(key(f.p.x, f.p.y))
      wand.add(key(ziel.x, ziel.y))
      f.from = { ...f.p }
      f.p = ziel
      f.flugAb = this.time
      f.hopAt = this.time + Math.max(R.FROSCH_FLUG + R.FROSCH_DREHEN + 200, c.froschSprung * 1000)
      this.emit({ type: 'hop', p: { ...ziel } })
      if (same(ziel, this.apple.p)) {
        this.neuerApfel()
        this.emit({ type: 'stolen' })
      }
      // Mit etwas Glueck schaut er nach der Landung in eine andere Richtung
      if (this.r.next() * 100 < c.froschWende) {
        f.drehAt = this.time + R.FROSCH_FLUG + R.FROSCH_DREHEN
        f.neuDir = this.r.pick(DIRS.filter((d) => d !== f.dir))
      }
    }
    this.froesche = this.froesche.filter((f) => f.gone === undefined || this.time - f.gone < R.FROSCH_FLUG + 300)
  }

  /** Events abholen */
  drain(): GameEvent[] {
    const e = this.events
    this.events = []
    return e
  }
}
