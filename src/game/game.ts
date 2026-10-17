/**
 * Spiellogik Endlos-Modus (und Kreativ-Modus), ohne Darstellung (laeuft auch im Test).
 *
 * Grundlage ist das Snake aus dem Hero-Telefon der Website: weicher Takt,
 * gepufferte Eingaben, Sofort-Wende, Mauern Feld fuer Feld,
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
import type { Ameise, Baum, Cause, Dir, Eis, Falle, Fenster, Frosch, Fund, GameEvent, Gegner, Gift, Haus, Kreativ, Lava, Mauer, P, Power, PowerArt, Sandbox, SandboxObjekt, Side, Status, Teich, Turm, Wolke } from './types'

const { STEP, OPP, DIRS } = R

export type GameOpts = {
  screenW: number
  screenH: number
  tempo?: R.Tempo
  seed?: number
  startLevel?: number
  cfg?: Partial<R.Config>
  kreativ?: Kreativ | null
  /** Kreativ-Sandbox: eigene Karte, Laenge und Objekte */
  sandbox?: Sandbox | null
}

/** Schluessel fuer Sets (funktioniert auch fuer -1 und Karten bis 4000 Felder Kante) */
export const key = (x: number, y: number) => (y + 1) * 4096 + (x + 1)
const same = (a: P, b: P) => a.x === b.x && a.y === b.y
const manhattan = (a: P, b: P) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
const cheb = (a: P, b: P) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
const SIDE: Record<Dir, Side> = { u: 'top', d: 'bottom', l: 'left', r: 'right' }
const istErz = (e: R.Erde | null): e is R.ErzArt => e === 'gold' || e === 'dia' || e === 'rubin' || e === 'opal'
/** Schluessel fuer Weltkoordinaten (auch weit negativ) */
const weltKey = (x: number, y: number) => (x + 100_000) * 200_003 + (y + 100_000)

type Art = R.EreignisArt

/** Was eine Gegner-Schlange beim Ausweichen sieht (einmal je Takt berechnet) */
type Sicht = {
  /** Feste Hindernisse (ohne Schlangen) */
  wand: Set<number>
  /** Schritte, die die Schlange bis zu jedem Feld braucht (-1 = kommt nicht hin) */
  dist: Int32Array
  /** Feld vor dem Kopf der Schlange */
  vorKopf: P
}
/** So lange zerfaellt eine besiegte Gegner-Schlange (ms) */
export const GEGNER_WEG = 700
/** So lange sieht man eine zertretene Ameise (ms) */
export const AMEISE_WEG = 600

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
  /** Freigelegte Felder ausserhalb der Bloecke (Maulwurf), in Kartenkoordinaten */
  extra: P[] = []
  /** Gesamte Verschiebung seit dem Start: Weltkoordinate = Karte - ursprung (fuer Erde, Erze, Deko) */
  ursprung = { x: 0, y: 0 }
  /** Abgebaute Erze (Weltkoordinaten) */
  abgebaut = new Set<number>()
  /** Freigelegte Erze auf der Karte */
  funde: Fund[] = []
  /** Gerade gegrabener Tunnel (Maulwurf): wird beim Zurueckkommen auf die Karte freigelegt */
  tunnel: P[] = []
  /** Offene Gebiets-Wahl: die Waende leuchten, beruehren baut dort einen Block an */
  wahl = 0
  /** Bis dahin darf gewaehlt werden (danach kommt der Block zufaellig) */
  wahlBis = 0
  /** Aepfel seit dem letzten Power-up (Garantie) */
  private ohnePower = 0
  /** Welt wird aufgebaut (Startlevel, Springen): keine Wahl, keine Funde */
  private aufbau = false

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
  lava: Lava[] = []
  eis: Eis[] = []
  ameisen: Ameise[] = []
  ameisenWeg: { p: P; dir: Dir; t: number }[] = []
  /** Sandbox ohne Fortschritt: Welt bleibt, wie sie ist (nur der Apfel wandert) */
  statisch = false
  /** Power-ups auf der Karte */
  powers: Power[] = []
  /** Aktive Power-ups: Schild (Anzahl, haelt bis schildBis), bis wann die anderen wirken,
   *  Schere = so viele Glieder kommen mit dem naechsten Apfel zurueck */
  effekt = { schild: 0, schildBis: 0, zeitlupeBis: 0, geistBis: 0, schere: 0, fuetternBis: 0, magnetBis: 0, maulwurfBis: 0, goldBis: 0 }
  /** Von der Schere abgeschnittene Glieder (fallen ab und verschwinden) */
  abgeschnitten: { cells: P[]; von: number; laenge: number; t: number }[] = []
  /** Gegner-Schlangen und besiegte (zerfallen gerade) */
  gegner: Gegner[] = []
  gegnerWeg: { g: Gegner; t: number }[] = []
  /** In dieser Runde besiegte Gegner */
  besiegt = 0
  /** In dieser Runde verdiente Aepfel (Waehrung) */
  verdient = 0

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
  private offen = { baum: 0, haus: 0, turm: 0, lava: 0, eis: 0 }

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
    // Ein Bildschirm = die zwei Startbloecke
    this.screenW = this.w
    this.screenH = this.h
    const sb = o.sandbox ?? null
    if (sb) {
      // Sandbox: rechteckige Karte aus breite x hoehe Bloecken
      this.blocks = []
      for (let y = 0; y < Math.max(1, Math.min(8, Math.round(sb.hoehe))); y++)
        for (let x = 0; x < Math.max(1, Math.min(8, Math.round(sb.breite))); x++) this.blocks.push({ x, y })
      this.baueMaske()
    }
    this.next = { falle: this.cfg.falleAb, wolke: this.cfg.wolkeAb, frosch: this.cfg.froschAb, gegner: this.cfg.gegnerAb, ameise: this.cfg.ameiseAb }
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
    this.aufbau = true
    if (!sb)
      for (let l = 2; l <= start; l++) {
        this.level = l
        this.welt(l)
        if (l % Math.max(1, this.cfg.lavaWachsen) === 0) this.lavaWachsen()
        if (this.waechstJetzt(l)) this.wachsRest++
      }
    this.level = start
    this.maxLevel = start
    this.apples = start - 1
    this.tick = R.takt(this.cfg, this.tempo, this.level)
    for (const k of ['falle', 'wolke', 'frosch', 'gegner', 'ameise'] as const) this.next[k] = Math.max(this.next[k], start + 1)
    if (sb) {
      this.statisch = !sb.weiter
      this.wachsRest = Math.max(0, Math.round(sb.laenge) - this.body.length)
      if (sb.laenge < 3) this.body = this.body.slice(0, Math.max(1, Math.round(sb.laenge)))
      for (const art of Object.keys(sb.objekte) as SandboxObjekt[])
        for (let i = 0; i < Math.min(200, sb.objekte[art] ?? 0); i++) this.objektDazu(art)
      this.neuerApfel()
      this.events = []
      this.aufbau = false
    } else if (start > 1) {
      this.gebiet = null
      this.layout()
      this.events = []
    }
    this.aufbau = false
  }

  /* ================= Ablauf ================= */

  /** Spielzeit weiterdrehen (dt in ms). Logik nur im Spiel, Zeit laeuft fuer Animationen weiter */
  update(dt: number) {
    this.time += Math.min(dt, 100)
    this.weg = this.weg.filter((m) => this.time - m.t < 240)
    this.teiche = this.teiche.filter((t) => t.drying === undefined || this.time - t.drying < 1500)
    this.abgeschnitten = this.abgeschnitten.filter((a) => this.time - a.t < 1400)
    if (this.status !== 'play') return
    // Nach einem Haenger nicht mehrere Schritte nachholen
    if (this.time - this.last > this.takt * 3) this.last = this.time - this.takt
    while (this.status === 'play' && this.time - this.last >= this.takt) {
      this.last += this.takt
      this.step()
    }
    if (this.status !== 'play') return
    this.effekteTakt()
    this.wachsen()
    this.wolkenTakt()
    this.froschTakt()
    this.gegnerTakt()
    this.ameisenTakt()
    this.fallenTakt()
    this.regie()
  }

  /** Fortschritt zwischen zwei Feldern (0 bis 1) fuer die weiche Darstellung */
  alpha() {
    if (this.status !== 'play') return 1
    return Math.min(1, Math.max(0, (this.time - this.last) / this.takt))
  }

  /** Aktueller Takt je Feld (Zeitlupe macht ihn laenger) */
  get takt() {
    return this.time < this.effekt.zeitlupeBis ? this.tick * R.zeitlupe(this.cfg) : this.tick
  }

  /** Geist: durch Hindernisse (Kreativ, Power-up Geist oder goldener Apfel) */
  geist() {
    return this.kreativ?.tod === 'geist' || this.time < this.effekt.geistBis || this.unbesiegbar()
  }
  /** Goldener Apfel: nichts kann der Schlange etwas anhaben, sie faehrt auch ueber sich selbst */
  unbesiegbar() {
    return this.time < this.effekt.goldBis
  }
  /** Fuettern (oder goldener Apfel): Tiere und andere Schlangen fressen */
  frisst() {
    return this.time < this.effekt.fuetternBis || this.unbesiegbar()
  }
  /** Maulwurf: durch die Erde graben */
  graebt() {
    return this.time < this.effekt.maulwurfBis
  }
  aufEis(p: P) {
    return this.eis.some((e) => e.cells.some((c) => same(c, p)))
  }

  private emit(e: GameEvent) {
    this.events.push(e)
  }

  /** Richtung in die Warteschlange (max. 3), keine Kehrtwende, keine Doppelung,
   *  Sofort-Wende im ersten Drittel eines Schritts (wie im Telefon) */
  turn(d: Dir, sofort = true) {
    if (this.status !== 'play') return
    // Auf Eis laesst sich nicht lenken (ausser im Kreativ-Modus, wenn die Schlange vor einem Hindernis steht)
    if (!this.halt && this.aufEis(this.body[0])) return
    if (
      sofort &&
      !this.queue.length &&
      !this.ate &&
      !this.halt &&
      this.prev.length === this.body.length &&
      this.time - this.last < this.takt * 0.34 &&
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
    const k = this.kreativ
    const h = this.body[0]
    // Auf Eis rutscht die Schlange geradeaus (gedrueckte Richtungen verfallen)
    if (!this.halt && this.aufEis(h)) this.queue = []
    const nd = this.queue.shift()
    if (nd) this.dir = nd
    let n = { x: h.x + STEP[this.dir].x, y: h.y + STEP[this.dir].y }
    // Leuchtende Wand beruehrt: dort kommt der neue Block hin
    if (!this.inside(n) && this.wahl > 0) {
      const neu = this.wahlAn(n)
      if (neu) n = neu
    }
    // Maulwurf: ausserhalb der Karte durch die Erde graben (bis grabWeite)
    const graben = !this.inside(n) && this.graebt() && this.grabbar(n)
    // Fuettern / goldener Apfel: Tiere und Gegner werden gefressen statt gerammt
    if (this.frisst()) this.fressen(n)
    if (this.unbesiegbar()) this.zerschlagen(n)
    const eats = same(n, this.apple.p)
    // Wachsen: das Schwanzende bleibt stehen. Kreativ mit fester Laenge: auf die Laenge bringen
    const fest = k && !k.wachsen ? Math.max(1, Math.floor(k.laenge)) : 0
    const grows = fest ? this.body.length < fest : this.wachsRest > 0
    const rest = grows ? this.body : this.body.slice(0, -1)

    // Giftapfel essen: sofort vorbei
    let gi = this.gift.findIndex((g) => same(g.p, n))
    if (gi >= 0 && !this.geist() && (!k || k.tod === 'an')) {
      if (this.schildBrechen()) {
        this.gift.splice(gi, 1)
        gi = -1
      } else {
        this.body.unshift(n)
        this.body.pop()
        this.gift.splice(gi, 1)
        this.die('gift')
        return
      }
    }

    let cause: Cause | null = graben
      ? !k?.durchSelbst && !this.geist() && rest.some((p) => same(p, n))
        ? 'selbst'
        : null
      : (this.gefahr(n, rest) ?? (gi >= 0 && k?.tod === 'anhalten' && !this.geist() ? 'gift' : null))
    // Schild: faengt den Aufprall ab, kurz danach gleitet die Schlange hindurch (nicht am Kartenrand)
    if (cause && cause !== 'rand' && (!k || k.tod === 'an') && this.schildBrechen()) cause = this.gefahr(n, rest)
    if (cause) {
      // Kreativ: nicht sterben, nur stehen bleiben
      if (k && k.tod !== 'an') {
        if (!this.halt) this.emit({ type: 'halt' })
        this.halt = true
        this.prev = this.body.map((p) => ({ ...p }))
        return
      }
      // Gegen jedes Hindernis: sofort vorbei (kein Gnadenschritt)
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
    if (graben) this.graben(n)
    // Zurueck auf der Karte: Tunnel und eingeschlossene Erde werden freigelegt
    else if (this.tunnel.length && this.inside(n)) this.freilegen()
    // Ameise unter dem Kopf: zertreten
    const ai = this.ameisen.findIndex((a) => same(a.p, n))
    if (ai >= 0) {
      const a = this.ameisen.splice(ai, 1)[0]
      this.ameisenWeg.push({ p: { ...a.p }, dir: a.dir, t: this.time })
      this.emit({ type: 'ameiseWeg', p: { ...a.p } })
    }
    this.wachsen()
    this.wolkenNachruecken()
    this.einsammeln(n)
    if (eats) this.eat(n)
    else this.treffer(n)
  }

  /** Schild verbrauchen (falls vorhanden): kurz Geist, damit die Schlange hindurchgleitet */
  private schildBrechen() {
    if (this.effekt.schild <= 0) return false
    this.effekt.schild--
    this.effekt.geistBis = Math.max(this.effekt.geistBis, this.time + 1500)
    this.emit({ type: 'schild' })
    return true
  }

  /** Power-ups und Erze unter dem Kopf aufheben */
  private einsammeln(n: P) {
    const pi = this.powers.findIndex((p) => same(p.p, n))
    if (pi >= 0) this.powerAn(this.powers.splice(pi, 1)[0].art, n)
    const fi = this.funde.findIndex((f) => same(f.p, n))
    if (fi >= 0) this.fundNehmen(this.funde.splice(fi, 1)[0].art, n)
  }

  /** Erz eingesammelt: Gold 3, Diamant 6, Rubin 10, Opal 20 mal aktueller Apfel */
  private fundNehmen(art: R.ErzArt, p: P) {
    const c = this.cfg
    const wert = Math.round(R.erzWert(c, art) * c.apfelWert * this.apfelStufe())
    this.verdient += wert
    this.emit({ type: 'fund', art, p: { ...p }, wert })
    if (wert > 0) this.emit({ type: 'geld', wert, p: { ...p }, quelle: 'erz' })
  }

  /** Fuettern: Frosch, Ameise oder Gegner an diesem Feld fressen (bringt Aepfel) */
  private fressen(n: P) {
    const c = this.cfg
    const stufe = this.apfelStufe()
    const lohn = (was: 'frosch' | 'ameise' | 'gegner', anzahl: number, art?: 'rot' | 'lila') => {
      const wert = anzahl * c.apfelWert * stufe
      this.verdient += wert
      this.emit({ type: 'gefressen', was, p: { ...n }, wert, art })
      if (wert > 0) this.emit({ type: 'geld', wert, p: { ...n }, quelle: 'futter' })
    }
    const fi = this.froesche.findIndex((f) => f.gone === undefined && same(f.p, n))
    if (fi >= 0) {
      this.froesche.splice(fi, 1)
      lohn('frosch', 2)
    }
    const ai = this.ameisen.findIndex((a) => same(a.p, n))
    if (ai >= 0) {
      const a = this.ameisen.splice(ai, 1)[0]
      this.ameisenWeg.push({ p: { ...a.p }, dir: a.dir, t: this.time })
      lohn('ameise', 1)
    }
    const e = this.gegner.find((o) => o.body.some((p) => same(p, n)))
    if (e) {
      this.gegner = this.gegner.filter((o) => o !== e)
      e.prev = e.body.map((p) => ({ ...p }))
      this.gegnerWeg.push({ g: e, t: this.time })
      this.besiegt++
      lohn('gegner', e.body.length, e.art)
    }
  }

  /** Goldener Apfel: Mauersteine, Fallen und Giftaepfel im Weg werden weggeraeumt */
  private zerschlagen(n: P) {
    for (const m of this.mauern) {
      const i = m.cells.findIndex((p) => same(p, n))
      if (i < 0) continue
      this.weg.push({ cells: [{ ...n }], t: this.time })
      m.cells.splice(i, 1)
      m.t.splice(i, 1)
      if (i < m.grown) m.grown--
    }
    this.mauern = this.mauern.filter((m) => m.cells.length)
    const fi = this.fallen.findIndex((f) => same(f.p, n))
    if (fi >= 0) this.fallenWeg.push({ p: { ...n }, t: this.time }), this.fallen.splice(fi, 1)
    this.gift = this.gift.filter((g) => !same(g.p, n))
  }

  powerAn(art: PowerArt, p: P = this.body[0]) {
    const c = this.cfg
    if (art === 'schild') {
      this.effekt.schild = Math.min(3, this.effekt.schild + 1)
      this.effekt.schildBis = this.time + c.schildDauer * 1000
    }
    if (art === 'zeitlupe') this.effekt.zeitlupeBis = this.time + c.effektDauer * 1000
    if (art === 'geist') this.effekt.geistBis = this.time + c.geistDauer * 1000
    if (art === 'fuettern') this.effekt.fuetternBis = this.time + c.fuetternDauer * 1000
    if (art === 'magnet') this.effekt.magnetBis = this.time + c.magnetDauer * 1000
    if (art === 'maulwurf') this.effekt.maulwurfBis = this.time + c.maulwurfDauer * 1000
    if (art === 'gold') this.effekt.goldBis = this.time + c.goldDauer * 1000
    if (art === 'spitzhacke') this.erzSetzen()
    if (art === 'schere') {
      // Nur fuer einen Apfel: die Glieder wachsen mit dem naechsten Apfel wieder nach
      const weg = Math.min(Math.max(0, Math.round(c.schereLaenge)), Math.max(0, this.body.length - 3))
      const len = this.body.length - weg
      if (weg > 0) this.abgeschnitten.push({ cells: this.body.slice(len).map((q) => ({ ...q })), von: len, laenge: this.body.length, t: this.time })
      this.body = this.body.slice(0, len)
      this.prev = this.prev.slice(0, len)
      this.effekt.schere += weg
    }
    this.emit({ type: 'power', art, p: { ...p } })
  }

  /** Laufende Power-ups: Magnet holt, Maulwurf endet (in der Erde = Tod), abgelaufene verschwinden */
  private effekteTakt() {
    const e = this.effekt
    // Schild haelt nicht ewig
    if (e.schild > 0 && this.time >= e.schildBis) {
      e.schild = 0
      e.schildBis = 0
      this.emit({ type: 'powerEnde', art: 'schild' })
    }
    for (const art of ['zeitlupe', 'geist', 'fuettern', 'magnet', 'maulwurf', 'gold'] as const) {
      const feld = `${art}Bis` as const
      if (e[feld] > 0 && this.time >= e[feld]) {
        e[feld] = 0
        this.emit({ type: 'powerEnde', art })
      }
    }
    this.powers = this.powers.filter((p) => this.time < p.until)
    // Gebiets-Wahl verpasst: der Block kommt an eine zufaellige Stelle
    if (this.wahl > 0 && this.time >= this.wahlBis) {
      this.wahl = 0
      this.expand()
      this.emit({ type: 'wahlVorbei' })
    }
    const head = this.body[0]
    // Maulwurf vorbei, aber noch in der Erde: erstickt (Kreativ ohne Tod: Tunnel wird freigelegt)
    if (!this.inside(head) && !this.graebt()) {
      if (this.kreativ && this.kreativ.tod !== 'an') this.freilegen()
      else return this.die('erde')
    }
    // Magnet: alles Gute im Umkreis kommt sofort, als waere es eingesammelt
    if (this.time < e.magnetBis) {
      const r = this.cfg.magnetRadius
      const nah = (p: P) => cheb(p, head) <= r
      for (const pw of this.powers.filter((pw) => nah(pw.p))) {
        this.powers = this.powers.filter((o) => o !== pw)
        this.powerAn(pw.art, pw.p)
      }
      for (const f of this.funde.filter((f) => nah(f.p))) {
        this.funde = this.funde.filter((o) => o !== f)
        this.fundNehmen(f.art, f.p)
      }
      if (nah(this.apple.p) && !same(this.apple.p, head)) this.eat({ ...this.apple.p })
    }
  }

  /** Kopf in Giftwolke, Fensterlicht oder Lichtkegel: Level zurueck (nicht toedlich) */
  private treffer(n: P) {
    if (this.time < this.schutzBis || this.geist()) return
    if (this.kreativ && !this.kreativ.rueckschlag) return
    const grund = this.wolken.some((w) => w.cells.some((p) => same(p, n))) ? 'wolke' : this.imLicht(n) ? 'licht' : this.imKegel(n) ? 'kegel' : null
    if (!grund) return
    // Schild faengt auch Rueckschlaege ab
    if (this.schildBrechen()) {
      this.schutzBis = this.time + this.cfg.schutz * 1000
      return
    }
    this.setback(grund === 'wolke' ? this.cfg.wolkeZurueck : grund === 'licht' ? this.cfg.lichtZurueck : this.cfg.kegelZurueck, grund)
  }

  imLicht(n: P) {
    return this.haeuser.some((h) => h.strahl.some((p) => same(p, n)))
  }
  imKegel(n: P) {
    return this.tuerme.some((t) => t.kegel.some((p) => same(p, n)))
  }

  /** n Level zurueck: Schlange wird um das kuerzer, was sie in diesen Leveln gewachsen war */
  setback(n: number, grund: 'wolke' | 'licht' | 'kegel' | 'ameise') {
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
    if (this.geist()) return null
    if (this.mauern.some((m) => m.cells.slice(0, m.grown).some((p) => same(p, n)))) return 'mauer'
    if (this.teiche.some((t) => t.drying === undefined && t.cells.some((p) => same(p, n)))) return 'teich'
    if (this.fallen.some((f) => same(f.p, n))) return 'falle'
    if (this.froesche.some((f) => f.gone === undefined && same(f.p, n))) return 'frosch'
    if (this.baeume.some((b) => b.cells.some((p) => same(p, n)))) return 'baum'
    if (this.haeuser.some((h) => h.cells.some((p) => same(p, n)))) return 'haus'
    if (this.tuerme.some((t) => t.cells.some((p) => same(p, n)))) return 'turm'
    if (this.lava.some((l) => l.cells.some((p) => same(p, n)))) return 'lava'
    if (this.aufGegner(n)) return 'gegner'
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

  /** Wie viel der Apfel gerade wert ist (Stufe = Farbe) */
  apfelStufe() {
    return R.apfelFaktor(this.cfg, this.level)
  }

  private eat(n: P) {
    // Wert nach dem Level, auf dem der Apfel lag (so passt er zu seiner Farbe)
    const stufe = this.apfelStufe()
    this.ate = true
    this.apples++
    this.gegessen++
    this.level++
    // Nur beim ersten Erreichen eines Levels: neuer Block, Teich, Baum, Haus, Turm, Hinweise
    const neu = this.level > this.maxLevel
    if (neu) this.maxLevel = this.level
    if (this.waechstJetzt(this.level)) this.wachsRest++
    // Schere wirkt nur einen Apfel lang: die Glieder wachsen wieder nach
    if (this.effekt.schere > 0) {
      this.wachsRest += this.effekt.schere
      this.effekt.schere = 0
      this.emit({ type: 'powerEnde', art: 'schere' })
    }
    this.emit({ type: 'eat', level: this.level, p: { ...n }, stufe })
    if (this.cfg.apfelWert > 0) {
      const wert = this.cfg.apfelWert * stufe
      this.verdient += wert
      this.emit({ type: 'geld', wert, p: { ...n }, quelle: 'apfel' })
    }
    if (neu && this.level % Math.max(1, this.cfg.apfelWertAlle) === 0) this.emit({ type: 'faktor', faktor: this.apfelStufe() })
    if (neu && this.level % 10 === 0) this.emit({ type: 'milestone', level: this.level })
    if (neu && !this.statisch) {
      for (const u of R.unlocks(this.cfg)) if (u.level === this.level) this.emit({ type: 'unlock', what: u.what, level: this.level })
      this.welt(this.level)
    }
    // Lava breitet sich jeden 2. Apfel aus (auch in der festen Sandbox: das ist eine Mechanik)
    if (this.level % Math.max(1, this.cfg.lavaWachsen) === 0) this.lavaWachsen()
    this.layout()
    this.tick = R.takt(this.cfg, this.tempo, this.level)
  }

  /** Was beim ersten Erreichen eines Levels dazukommt und bleibt */
  private welt(l: number) {
    const c = this.cfg
    if (R.neuesGebiet(c, l)) {
      // Beim Aufbau zufaellig, im Spiel darf man waehlen (eine alte offene Wahl wird dann zufaellig gesetzt)
      if (this.aufbau) this.expand()
      else {
        if (this.wahl > 0) this.expand()
        this.wahl = 1
        this.wahlBis = this.time + c.wahlZeit * 1000
        this.emit({ type: 'wahl', offen: 1 })
      }
    }
    if (R.neuesEis(c, l)) this.offen.eis++
    if (R.neuerTeich(c, l)) this.neuerTeich(R.teichGroesse(c, l))
    if (R.neuerBaum(c, l)) this.offen.baum++
    if (R.neuesHaus(c, l)) this.offen.haus++
    if (R.neuerTurm(c, l)) this.offen.turm++
    if (R.neueLava(c, l)) this.offen.lava++
    this.bauten()
  }

  /** Faellige Baeume, Haeuser und Tuerme setzen, soweit Platz ist */
  private bauten() {
    const felder = this.felder()
    while (this.offen.baum > 0 && this.baeume.length < R.baumMax(this.cfg, felder) && this.neuerBaum()) this.offen.baum--
    while (this.offen.haus > 0 && this.haeuser.length < R.hausMax(this.cfg, felder) && this.neuesHaus()) this.offen.haus--
    while (this.offen.turm > 0 && this.tuerme.length < R.turmMax(this.cfg, felder) && this.neuerTurm()) this.offen.turm--
    while (this.offen.lava > 0 && this.lava.length < R.lavaMax(this.cfg, felder) && this.neuerLavaSee()) this.offen.lava--
    while (this.offen.eis > 0 && this.eis.length < R.eisMax(this.cfg, felder) && this.neuesEisFeld()) this.offen.eis--
  }

  /** Nach jedem Apfel: Mauern neu, Licht und Kegel weiter, Apfel, Giftaepfel, Ereignisse */
  private layout() {
    // Feste Sandbox: nichts Neues, nur Licht und Tuerme drehen weiter, der Apfel wandert
    if (this.statisch) {
      this.lichtWechsel()
      this.tuermeDrehen()
      this.neuerApfel()
      return
    }
    if (this.mauern.length) {
      this.weg.push(...this.mauern.map((m) => ({ cells: m.cells.slice(0, m.grown), t: this.time })))
      this.mauern = []
    }
    this.bauten()
    const plan = R.mauern(this.cfg, this.level, this.felder())
    // Ein Platz-Kontext fuer alle Mauern dieser Runde (jede neue Mauer wird darin nachgetragen)
    const ctx = plan.length ? this.platzKontext() : null
    for (const len of plan) this.neueMauer(len, ctx!)
    if (plan.length) this.emit({ type: 'wall' })
    this.lichtWechsel()
    this.tuermeDrehen()
    this.neuerApfel()
    this.neueGifte()
    this.gegenstaende()
    for (const k of ['falle', 'wolke', 'frosch', 'gegner', 'ameise'] as const) {
      if (this.level < R.ab(this.cfg, k) || this.level < this.next[k]) continue
      const [a, b] = R.pause(this.cfg, k, this.level)
      this.next[k] = this.level + this.r.int(a, b)
      this.spawn(k)
    }
  }

  /** Nach einem Apfel vielleicht ein Power-up (auf einem freien Feld in Reichweite) */
  private gegenstaende() {
    const c = this.cfg
    const head = this.body[0]
    const nah = this.screenW + this.screenH
    if (this.level < c.powerAb || this.powers.length) return
    // Garantie: spaetestens nach powerGarantie Aepfeln ohne Power-up kommt eins
    this.ohnePower++
    if (this.ohnePower < c.powerGarantie && this.r.next() * 100 >= c.powerChance) return
    const cand = this.freieFelder((p) => manhattan(p, head) >= 4 && manhattan(p, head) <= nah && !this.imWeg(p, 3))
    const p = cand.length ? this.r.pick(cand) : null
    if (!p) return
    this.powers.push({ p, t: this.time, until: this.time + c.powerDauer * 1000, art: this.powerWahl() })
    this.ohnePower = 0
  }

  /** Spitzhacke: ein zufaelliges Erz (Gold haeufig, Opal selten) irgendwo auf die Karte, in Reichweite */
  private erzSetzen() {
    const head = this.body[0]
    const nah = this.screenW + this.screenH
    let cand = this.freieFelder((p) => manhattan(p, head) >= 4 && manhattan(p, head) <= nah)
    if (!cand.length) cand = this.freieFelder(() => true)
    if (!cand.length) return false
    let z = this.r.next() * R.ERZ_ARTEN.reduce((s, a) => s + R.SPITZHACKE_GEWICHT[a], 0)
    let art: R.ErzArt = 'gold'
    for (const a of R.ERZ_ARTEN) {
      z -= R.SPITZHACKE_GEWICHT[a]
      if (z < 0) {
        art = a
        break
      }
    }
    const p = this.r.pick(cand)
    this.funde.push({ p, art, t: this.time })
    this.emit({ type: 'erzGesetzt', art, p: { ...p } })
    return true
  }

  /** Welches Power-up? Nach Gewicht; Maulwurf erst ab maulwurfAb, Fuettern nur, wenn es etwas zu fressen gibt */
  private powerWahl(): PowerArt {
    const tiere = this.aktiveFroesche.length + this.ameisen.length + this.gegner.length > 0
    const arten = R.POWER_ARTEN.filter((a) => (a !== 'maulwurf' || this.level >= this.cfg.maulwurfAb) && (a !== 'fuettern' || tiere))
    let z = this.r.next() * arten.reduce((s, a) => s + R.POWER_GEWICHT[a], 0)
    for (const a of arten) {
      z -= R.POWER_GEWICHT[a]
      if (z < 0) return a
    }
    return arten[arten.length - 1]
  }

  /** Kreativ: direkt auf einen Level springen (hoeher: Welt waechst mit, niedriger: kuerzer) */
  springeZu(ziel: number) {
    const auf = Math.max(1, Math.floor(ziel))
    if (auf === this.level) return
    if (auf > this.level) {
      this.aufbau = true
      for (let l = this.level + 1; l <= auf; l++) {
        if (this.waechstJetzt(l)) this.wachsRest++
        if (l % Math.max(1, this.cfg.lavaWachsen) === 0) this.lavaWachsen()
        if (l > this.maxLevel) {
          this.maxLevel = l
          if (!this.statisch) this.welt(l)
        }
      }
      this.aufbau = false
    } else this.kuerzen(auf, this.level)
    this.level = auf
    this.apples = auf - 1
    this.tick = R.takt(this.cfg, this.tempo, this.level)
    this.layout()
  }

  /* ================= Karte aus Bloecken ================= */

  felder() {
    return this.blocks.length * this.bw * this.bh + this.extra.length
  }

  private baueMaske() {
    this.w = Math.max((Math.max(...this.blocks.map((b) => b.x)) + 1) * this.bw, ...this.extra.map((c) => c.x + 1))
    this.h = Math.max((Math.max(...this.blocks.map((b) => b.y)) + 1) * this.bh, ...this.extra.map((c) => c.y + 1))
    this.mask = new Uint8Array(this.w * this.h)
    for (const b of this.blocks)
      for (let y = 0; y < this.bh; y++) this.mask.fill(1, (b.y * this.bh + y) * this.w + b.x * this.bw, (b.y * this.bh + y) * this.w + (b.x + 1) * this.bw)
    for (const c of this.extra) this.mask[c.y * this.w + c.x] = 1
  }

  /** Weltkoordinaten eines Kartenfelds (bleiben gleich, auch wenn die Karte verschoben wird) */
  welt_(p: P) {
    return { x: p.x - this.ursprung.x, y: p.y - this.ursprung.y }
  }

  /** Ein neuer Block (halber Bildschirm): an der gewaehlten Stelle oder zufaellig neben der Karte */
  expand(ziel?: { p: P; d: Dir }) {
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
    const { p, d } = ziel ? { p: { ...ziel.p }, d: ziel.d } : this.r.pick(cand)
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
    if (dx || dy) {
      this.shift(dx, dy)
      this.baueMaske()
    }
    // Was vorher Erde war, wird freigelegt (Erze darin liegen dann auf der Karte)
    const neu: P[] = []
    for (let y = p.y * this.bh; y < (p.y + 1) * this.bh; y++) for (let x = p.x * this.bw; x < (p.x + 1) * this.bw; x++) if (!this.inside({ x, y })) neu.push({ x, y })
    this.blocks.push(p)
    this.baueMaske()
    this.erzeFrei(neu)
    this.expansions++
    const side = SIDE[d]
    this.gebiet = { side, t: this.time, x: p.x * this.bw, y: p.y * this.bh, w: this.bw, h: this.bh }
    this.emit({ type: 'expand', side, add: this.bw * this.bh, dx, dy })
  }

  /** Leuchtende Wand beruehrt: Block in Laufrichtung anbauen. Gibt das Zielfeld (ggf. verschoben) zurueck */
  private wahlAn(n: P): P | null {
    const b = { x: Math.floor(n.x / this.bw), y: Math.floor(n.y / this.bh) }
    const von = { x: b.x - STEP[this.dir].x, y: b.y - STEP[this.dir].y }
    if (this.blocks.some((o) => same(o, b)) || !this.blocks.some((o) => same(o, von))) return null
    const vorher = { ...this.ursprung }
    this.expand({ p: b, d: this.dir })
    this.wahl = Math.max(0, this.wahl - 1)
    this.emit({ type: 'wahl', offen: this.wahl })
    return { x: n.x + this.ursprung.x - vorher.x, y: n.y + this.ursprung.y - vorher.y }
  }

  /** Darf hier gegraben werden? (Erde bis grabWeite um die Karte herum) */
  private grabbar(n: P) {
    const g = this.cfg.grabWeite
    return n.x >= -g && n.y >= -g && n.x < this.w + g && n.y < this.h + g
  }

  /** Ein Feld Erde gegraben: Tunnel merken, Erz darin gleich einsammeln */
  private graben(n: P) {
    if (!this.tunnel.some((t) => same(t, n))) this.tunnel.push({ ...n })
    const w = this.welt_(n)
    const erz = R.erdeBei(this.cfg, w.x, w.y)
    const k = weltKey(w.x, w.y)
    if (istErz(erz) && !this.abgebaut.has(k)) {
      this.abgebaut.add(k)
      this.fundNehmen(erz, n)
    }
  }

  /** Zurueck aus der Erde: der Tunnel und alles, was er mit der Karte einschliesst, wird Karte */
  private freilegen() {
    if (!this.tunnel.length) return
    const g = this.cfg.grabWeite + 1
    const x0 = -g
    const y0 = -g
    const W = this.w + 2 * g
    const H = this.h + 2 * g
    const wand = new Uint8Array(W * H)
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.mask[y * this.w + x]) wand[(y - y0) * W + (x - x0)] = 1
    for (const t of this.tunnel) if (t.x >= x0 && t.y >= y0 && t.x < x0 + W && t.y < y0 + H) wand[(t.y - y0) * W + (t.x - x0)] = 1
    // Von aussen fluten: was nicht erreicht wird, ist eingeschlossen
    const seen = new Uint8Array(W * H)
    const q: number[] = []
    for (let x = 0; x < W; x++) q.push(x, (H - 1) * W + x)
    for (let y = 0; y < H; y++) q.push(y * W, y * W + W - 1)
    for (const i of q) seen[i] = 1
    for (let i = 0; i < q.length; i++) {
      const j = q[i]
      if (wand[j]) continue
      const x = j % W
      const y = (j - x) / W
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
        const k = ny * W + nx
        if (seen[k] || wand[k]) continue
        seen[k] = 1
        q.push(k)
      }
    }
    const cells: P[] = this.tunnel.map((t) => ({ ...t }))
    for (let j = 0; j < W * H; j++) if (!wand[j] && !seen[j]) cells.push({ x: (j % W) + x0, y: Math.floor(j / W) + y0 })
    this.tunnel = []
    this.zellenDazu(cells)
  }

  /** Einzelne Felder zur Karte hinzufuegen (links/oben: Karte um ganze Bloecke verschieben) */
  private zellenDazu(cells: P[]) {
    if (!cells.length) return
    const minX = Math.min(...cells.map((c) => c.x))
    const minY = Math.min(...cells.map((c) => c.y))
    const bx = minX < 0 ? Math.ceil(-minX / this.bw) : 0
    const by = minY < 0 ? Math.ceil(-minY / this.bh) : 0
    const dx = bx * this.bw
    const dy = by * this.bh
    if (dx || dy) {
      this.blocks.forEach((b) => {
        b.x += bx
        b.y += by
      })
      this.shift(dx, dy)
      cells = cells.map((c) => ({ x: c.x + dx, y: c.y + dy }))
      this.baueMaske()
    }
    const neu = cells.filter((c, i) => !this.inside(c) && cells.findIndex((o) => same(o, c)) === i)
    this.extra.push(...neu)
    this.baueMaske()
    this.erzeFrei(neu)
    this.emit({ type: 'freigelegt', dx, dy, anzahl: neu.length })
  }

  /** Frisch freigelegte Felder: Gold und Diamant darin liegen jetzt als Fund auf der Karte */
  private erzeFrei(cells: P[]) {
    if (this.aufbau) return
    for (const c of cells) {
      const w = this.welt_(c)
      const k = weltKey(w.x, w.y)
      const erz = R.erdeBei(this.cfg, w.x, w.y)
      if (!istErz(erz) || this.abgebaut.has(k)) continue
      this.abgebaut.add(k)
      if (this.aufSchlange(c)) {
        this.fundNehmen(erz, c)
        continue
      }
      this.funde.push({ p: { ...c }, art: erz, t: this.time })
    }
  }

  /** Erdfeld (Weltkoordinaten) noch nicht abgebaut? (fuer die Darstellung der Erze) */
  erzDa(wx: number, wy: number) {
    return !this.abgebaut.has(weltKey(wx, wy))
  }

  private shift(dx: number, dy: number) {
    const mv = (p: P) => {
      p.x += dx
      p.y += dy
    }
    mv(this.ursprung)
    this.extra.forEach(mv)
    this.funde.forEach((f) => mv(f.p))
    this.tunnel.forEach(mv)
    this.eis.forEach((e) => e.cells.forEach(mv))
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
    this.powers.forEach((p) => mv(p.p))
    for (const e of [...this.gegner, ...this.gegnerWeg.map((w) => w.g)]) {
      e.body.forEach(mv)
      e.prev.forEach(mv)
    }
    this.lava.forEach((l) => l.cells.forEach(mv))
    this.ameisen.forEach((a) => {
      mv(a.p)
      mv(a.from)
      mv(a.heim)
    })
    this.ameisenWeg.forEach((a) => mv(a.p))
    this.abgeschnitten.forEach((a) => a.cells.forEach(mv))
  }

  /* ================= Platz finden ================= */

  inside(c: P) {
    return c.x >= 0 && c.y >= 0 && c.x < this.w && c.y < this.h && this.mask[c.y * this.w + c.x] === 1
  }

  /** Feld mit allen vier Nachbarn auf der Karte (nicht am Rand) */
  private innen(c: P) {
    return this.inside(c) && DIRS.every((d) => this.inside({ x: c.x + STEP[d].x, y: c.y + STEP[d].y }))
  }

  /** Alle Hindernisse (fuer Platzsuche und Erreichbarkeit). Mauern mit allen geplanten Feldern.
   *  Gegner-Schlangen zaehlen dazu, ausser fuer ihre eigene Wegsuche */
  hindernisse(mitGegnern = true): Set<number> {
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
    this.lava.forEach((l) => l.cells.forEach(add))
    this.ameisen.forEach((a) => add(a.p))
    if (mitGegnern) this.gegner.forEach((e) => e.body.forEach(add))
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
  erreichbar(wand: Set<number>): { size: number; has: (k: number) => boolean; seen: Uint8Array; zu: Uint8Array } {
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
      seen,
      zu,
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
  private keinAbschluss(cells: P[], wand: Set<number>, vorher = this.erreichbar(wand)) {
    const neu = new Set(cells.map((c) => key(c.x, c.y)))
    const zu = (x: number, y: number) => !this.inside({ x, y }) || wand.has(key(x, y)) || neu.has(key(x, y))
    const frei = (x: number, y: number) => DIRS.reduce((n, d) => n + (zu(x + STEP[d].x, y + STEP[d].y) ? 0 : 1), 0)
    // Freie Nachbarn der neuen Felder: keine Sackgasse, und alle muessen untereinander verbunden bleiben
    const nbs: number[] = []
    for (const c of cells)
      for (const d of DIRS) {
        const x = c.x + STEP[d].x
        const y = c.y + STEP[d].y
        if (zu(x, y)) continue
        if (frei(x, y) <= 1) return false
        const i = y * this.w + x
        if (vorher.has(key(x, y)) && !nbs.includes(i)) nbs.push(i)
      }
    if (nbs.length <= 1) return true
    // Breitensuche vom ersten Nachbarn, bis alle anderen gefunden sind (meist nach wenigen Schritten)
    const { w, h } = this
    if (this.stempel.length !== w * h) this.stempel = new Int32Array(w * h)
    const st = ++this.stempelNr
    const ziel = new Set(nbs)
    const q = [nbs[0]]
    this.stempel[nbs[0]] = st
    ziel.delete(nbs[0])
    for (let qi = 0; qi < q.length && ziel.size; qi++) {
      const i = q[qi]
      const x = i % w
      const y = (i - x) / w
      for (const d of DIRS) {
        const nx = x + STEP[d].x
        const ny = y + STEP[d].y
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const j = ny * w + nx
        if (this.stempel[j] === st || zu(nx, ny)) continue
        this.stempel[j] = st
        ziel.delete(j)
        q.push(j)
      }
    }
    return ziel.size === 0
  }
  /** Besucht-Markierung fuer Breitensuchen (spart das Leeren je Suche) */
  private stempel = new Int32Array(0)
  private stempelNr = 0

  /** Schlange als Menge, nur neu gebaut, wenn sie sich bewegt hat */
  private schlangeMenge: { ref: P[]; n: number; hx: number; hy: number; tx: number; ty: number; set: Set<number> } | null = null
  private koerperSet() {
    const b = this.body
    const m = this.schlangeMenge
    const h = b[0]
    const t = b[b.length - 1]
    if (m && m.ref === b && m.n === b.length && m.hx === h.x && m.hy === h.y && m.tx === t.x && m.ty === t.y) return m.set
    const set = new Set(b.map((p) => key(p.x, p.y)))
    this.schlangeMenge = { ref: b, n: b.length, hx: h.x, hy: h.y, tx: t.x, ty: t.y, set }
    return set
  }

  /** Was fuer neue Mauern, Teiche und Bauten gilt, einmal je Suche berechnet */
  private platzKontext() {
    const luft = new Set<number>()
    for (const p of [
      ...this.teiche.flatMap((t) => t.cells),
      ...this.mauern.flatMap((m) => m.cells),
      ...this.baeume.flatMap((b) => b.cells),
      ...this.haeuser.flatMap((h) => h.cells),
      ...this.tuerme.flatMap((t) => t.cells),
      ...this.lava.flatMap((l) => l.cells),
      ...this.eis.flatMap((e) => e.cells),
    ])
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) luft.add(key(p.x + dx, p.y + dy))
    const nah = new Set<number>()
    for (const p of this.body) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) nah.add(key(p.x + dx, p.y + dy))
    const besetzt = new Set<number>([key(this.apple.p.x, this.apple.p.y), ...this.powers.map((o) => key(o.p.x, o.p.y)), ...this.funde.map((f) => key(f.p.x, f.p.y)), ...this.eis.flatMap((e) => e.cells.map((c) => key(c.x, c.y)))])
    const wand = this.hindernisse()
    return { wand, luft, nah, besetzt, reach: this.erreichbar(wand) }
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
    return this.koerperSet().has(key(c.x, c.y))
  }

  /** Gemeinsame Pruefung fuer Mauern, Teiche und Bauten */
  private platzOk(cells: P[], art: 'mauer' | 'teich', ctx = this.platzKontext()) {
    const head = this.body[0]
    const seen = new Set<number>()
    for (const c of cells) {
      const k = key(c.x, c.y)
      // Ein Feld Luft zu anderen festen Hindernissen und zur Schlange
      if (!this.inside(c) || ctx.luft.has(k) || ctx.wand.has(k) || seen.has(k) || ctx.besetzt.has(k) || ctx.nah.has(k)) return false
      seen.add(k)
      if (art === 'teich' ? cheb(c, head) < 3 : manhattan(c, head) < 5) return false
      if (this.imWeg(c)) return false
    }
    return this.keinAbschluss(cells, ctx.wand, ctx.reach)
  }

  private neueMauer(len: number, ctx = this.platzKontext()) {
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
      if (!this.platzOk(cells, 'mauer', ctx)) continue
      this.mauern.push({ cells, grown: 0, t: [], next: this.time + 25 })
      // Fuer die naechste Mauer: ist jetzt Hindernis mit einem Feld Luft
      for (const c of cells) {
        ctx.wand.add(key(c.x, c.y))
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) ctx.luft.add(key(c.x + dx, c.y + dy))
      }
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
    const ctx = this.platzKontext()
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
      if (cells.length < size || !this.platzOk(cells, 'teich', ctx)) continue
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
    const { seen, zu } = this.erreichbar(wand)
    const { w, h } = this
    const belegt = new Set([...this.powers.map((p) => key(p.p.x, p.p.y)), ...this.funde.map((f) => key(f.p.x, f.p.y)), key(this.apple.p.x, this.apple.p.y)])
    const koerper = this.koerperSet()
    const out: P[] = []
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        if (zu[i] || !seen[i]) continue
        const k = key(x, y)
        if (belegt.has(k) || koerper.has(k)) continue
        // Keine Sackgasse: mindestens zwei freie Nachbarn
        const frei = (x > 0 && !zu[i - 1] ? 1 : 0) + (x < w - 1 && !zu[i + 1] ? 1 : 0) + (y > 0 && !zu[i - w] ? 1 : 0) + (y < h - 1 && !zu[i + w] ? 1 : 0)
        if (frei <= 1) continue
        const c = { x, y }
        if (!extra(c)) continue
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
    if (!n) return
    // Freie Felder nur einmal suchen; nach jedem Giftapfel fallen er und seine Nachbarn heraus
    let basis = this.freieFelder(() => true)
    for (let i = 0; i < n; i++) {
      const g = this.neuesGift(i === 0, basis)
      if (!g) break
      basis = basis.filter((c) => manhattan(c, g) > 1)
    }
  }

  /** Ein Giftapfel mehr (gern nah am Apfel). basis = schon gesuchte freie Felder */
  private neuesGift(erster = false, basis?: P[]): P | null {
    const head = this.body[0]
    const nahApfel = erster && this.r.next() < 0.6
    const grund = (c: P) => manhattan(c, head) >= 4 && !this.imWeg(c, 6) && cheb(c, this.apple.p) >= 2
    const ok = (c: P) => grund(c) && (!nahApfel || manhattan(c, this.apple.p) <= 5)
    let cand = basis ? basis.filter(ok) : this.freieFelder(ok)
    if (!cand.length && nahApfel) cand = basis ? basis.filter(grund) : this.freieFelder(grund)
    // Ein Giftapfel ist ein Hindernis: darf nichts abschliessen
    let wahl: P | null = null
    const wand = this.hindernisse()
    const vorher = this.erreichbar(wand)
    for (let v = 0; v < 30 && cand.length && !wahl; v++) {
      const c = this.r.pick(cand)
      if (this.keinAbschluss([c], wand, vorher)) wahl = c
      else cand = cand.filter((o) => o !== c)
    }
    if (!wahl) return null
    this.gift.push({ p: wahl, t: this.time, ecke: this.r.next() * Math.PI * 2 })
    return wahl
  }

  /* ================= Baeume, Haeuser, Tuerme ================= */

  /** Liegende Tanne (1-1-2-1) irgendwo mit Abstand, bleibt fuer immer */
  private neuerBaum() {
    const r = this.r
    const ctx = this.platzKontext()
    for (let versuch = 0; versuch < 500; versuch++) {
      const dir = r.pick(DIRS)
      const d = STEP[dir]
      const seite = r.next() < 0.5 ? 1 : -1
      const q = { x: -d.y * seite, y: d.x * seite }
      const root = { x: r.int(0, this.w - 1), y: r.int(0, this.h - 1) }
      const cells = R.BAUM_FORM.map((f) => ({ x: root.x + d.x * f.a + q.x * f.q, y: root.y + d.y * f.a + q.y * f.q }))
      if (!this.platzOk(cells, 'mauer', ctx)) continue
      this.baeume.push({ cells, root, dir, seite: seite as 1 | -1, t: this.time })
      this.emit({ type: 'tree' })
      return true
    }
    return false
  }

  /** Haus mit vier Fenstern (eins je Seite): vor `hausGrossAb` eine kleine Huette 2x2,
   *  danach 2x3 oder mit Ecke, gedreht/gespiegelt */
  private neuesHaus(klein = this.level < this.cfg.hausGrossAb) {
    const r = this.r
    const ctx = this.platzKontext()
    for (let versuch = 0; versuch < 500; versuch++) {
      let form = (klein ? R.HUETTE_FORM : r.pick(R.HAUS_FORMEN)).map((p) => ({ ...p }))
      if (r.next() < 0.5) form = form.map((p) => ({ x: -p.x, y: p.y }))
      for (let k = r.int(0, 3); k > 0; k--) form = form.map((p) => ({ x: -p.y, y: p.x }))
      const mx = Math.min(...form.map((p) => p.x))
      const my = Math.min(...form.map((p) => p.y))
      form = form.map((p) => ({ x: p.x - mx, y: p.y - my }))
      const ox = r.int(0, this.w - 1)
      const oy = r.int(0, this.h - 1)
      const cells = form.map((p) => ({ x: p.x + ox, y: p.y + oy }))
      if (!this.platzOk(cells, 'mauer', ctx)) continue
      const drin = new Set(cells.map((c) => key(c.x, c.y)))
      const fenster: Fenster[] = DIRS.map((d) => {
        const rand = cells.filter((c) => !drin.has(key(c.x + STEP[d].x, c.y + STEP[d].y)))
        return { p: { ...r.pick(rand) }, d }
      })
      const h: Haus = { cells, t: this.time, fenster, licht: -1, lichtT: this.time, strahl: [], kamin: r.int(0, cells.length - 1), klein }
      this.haeuser.push(h)
      this.lichtFuer(h, true)
      this.emit({ type: 'house' })
      return true
    }
    return false
  }

  /** Lichtfelder vor einem Fenster (bis `lichtWeite`, bei Huetten eins weniger; endet an Kartenrand, Haus, Baum oder Turm) */
  private strahlVon(h: Haus, i: number, bau = this.bauSet()) {
    const f = h.fenster[i]
    const out: P[] = []
    const weite = h.klein ? Math.max(1, this.cfg.lichtWeite - 1) : this.cfg.lichtWeite
    for (let k = 1; k <= weite; k++) {
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
    const ctx = this.platzKontext()
    for (let versuch = 0; versuch < 500; versuch++) {
      const c = { x: r.int(0, this.w - 2), y: r.int(0, this.h - 2) }
      const cells = [c, { x: c.x + 1, y: c.y }, { x: c.x, y: c.y + 1 }, { x: c.x + 1, y: c.y + 1 }]
      if (!this.platzOk(cells, 'mauer', ctx)) continue
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
    const ok =
      k === 'falle' ? this.neueFalle() : k === 'wolke' ? this.neueWolke() : k === 'frosch' ? this.neuerFrosch() : k === 'gegner' ? this.neuerGegner() : this.neueAmeise()
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
          if (this.aufSchlange(c) || this.aufGegner(c)) w.pending.push(c)
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
      const belegt = (c: P) => this.aufSchlange(c) || this.aufGegner(c)
      const frei = w.pending.filter((c) => !belegt(c))
      if (!frei.length) continue
      w.pending = w.pending.filter(belegt)
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
  neuerFrosch(egal = false) {
    if (!egal && this.aktiveFroesche.length >= this.cfg.froschAnzahl) return false
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

  /* ================= Gegner-Schlangen ================= */

  aufGegner(c: P) {
    return this.gegner.some((e) => e.body.some((p) => same(p, c)))
  }

  /** Takt der roten Gegner: halb so schnell wie die Schlange (Zeitlupe bremst nur die Schlange) */
  get gegnerSchrittzeit() {
    return this.tick * R.GEGNER_TEMPO
  }
  /** Takt eines Gegners (lila ist schneller) */
  schrittzeitVon(e: Gegner) {
    return this.tick * R.gegnerTakte(this.cfg, e.art)
  }

  /** Freie Felder ab `start` (Flutfuellung, hoechstens `cap`) */
  private raum(start: P, zu: (c: P) => boolean, cap: number) {
    const seen = new Set<number>([key(start.x, start.y)])
    const q = [start]
    for (let i = 0; i < q.length && seen.size < cap; i++)
      for (const d of DIRS) {
        const n = { x: q[i].x + STEP[d].x, y: q[i].y + STEP[d].y }
        const k = key(n.x, n.y)
        if (seen.has(k) || zu(n)) continue
        seen.add(k)
        q.push(n)
      }
    return seen.size
  }

  /** Neue Gegner-Schlange, weit weg vom Kopf, irgendwo, wo die Schlange hinkommt.
   *  Rot 3 bis 4 lang; ab `lilaAb` ist sie mit `lilaChance` lila (laenger, schneller).
   *  `egal` = ohne Hoechstzahl (Sandbox) */
  neuerGegner(art?: 'rot' | 'lila', egal = false) {
    const c0 = this.cfg
    const max = this.kreativ ? Math.max(1, c0.gegnerAnzahl) : R.gegnerMax(c0, this.level)
    if (!egal && this.gegner.length >= max) return false
    art ??= this.level >= c0.lilaAb && this.r.next() * 100 < c0.lilaChance ? 'lila' : 'rot'
    const head = this.body[0]
    const wand = this.hindernisse()
    const reach = this.erreichbar(wand)
    const frei = (c: P) =>
      this.inside(c) && !wand.has(key(c.x, c.y)) && !this.aufSchlange(c) && !same(c, this.apple.p) && !this.powers.some((p) => same(p.p, c))
    const weit = Math.max(6, Math.min(12, Math.floor((this.screenW + this.screenH) / 3)))
    const cand: P[] = []
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const c = { x, y }
        if (!frei(c) || !reach.has(key(x, y)) || manhattan(c, head) < weit || this.imWeg(c, 12)) continue
        if (this.freieNachbarn(c, wand) < 3) continue
        cand.push(c)
      }
    const len = art === 'lila' ? Math.max(2, Math.round(c0.lilaLaenge)) : this.r.int(3, 4)
    for (let v = 0; v < 60 && cand.length; v++) {
      const c = cand.splice(this.r.int(0, cand.length - 1), 1)[0]
      // Koerper vom Kopf aus nach hinten legen, gern gerade
      const body = [c]
      let d = this.r.pick(DIRS)
      for (let i = 1; i < len; i++) {
        const last = body[body.length - 1]
        const reihe = [d, ...this.r.shuffle(DIRS.filter((o) => o !== d))]
        const nd = reihe.find((o) => {
          const p = { x: last.x + STEP[o].x, y: last.y + STEP[o].y }
          return frei(p) && !body.some((b) => same(b, p))
        })
        if (!nd) break
        d = nd
        body.push({ x: last.x + STEP[nd].x, y: last.y + STEP[nd].y })
      }
      if (body.length < len) continue
      // Genug Platz drumherum, damit sie nicht gleich eingekesselt ist
      if (this.raum(c, (p) => !frei(p) || body.some((b) => same(b, p)), 4 * len) < 4 * len) continue
      const dir = DIRS.find((o) => body[1].x + STEP[o].x === c.x && body[1].y + STEP[o].y === c.y)!
      const t = this.time
      this.gegner.push({
        art,
        body,
        prev: body.map((p) => ({ ...p })),
        dir,
        t,
        // Erst kurz erscheinen, dann loslaufen
        last: t + 500,
        wachsAt: t + this.cfg.gegnerWachsen * 1000,
        wachsRest: 0,
        wuchsT: -1e9,
        eng: 0,
        angst: 0,
      })
      this.emit({ type: 'gegner', p: { ...c }, art })
      return true
    }
    return false
  }

  private gegnerTakt() {
    this.gegnerWeg = this.gegnerWeg.filter((w) => this.time - w.t < GEGNER_WEG)
    if (!this.gegner.length) return
    const c = this.cfg
    let sicht: Sicht | null = null
    for (const e of [...this.gegner]) {
      const takt = this.schrittzeitVon(e)
      // Wer lange ueberlebt, wird laenger
      if (this.time >= e.wachsAt) {
        e.wachsAt = this.time + c.gegnerWachsen * 1000
        if (e.body.length + e.wachsRest < (e.art === 'lila' ? c.lilaMaxLaenge : c.gegnerMaxLaenge)) {
          e.wachsRest++
          e.wuchsT = this.time
        }
      }
      if (this.time - e.last < takt - 1e-6) continue
      e.last += takt
      if (this.time - e.last > takt) e.last = this.time
      sicht ??= this.gegnerSicht()
      this.gegnerSchritt(e, sicht)
    }
  }

  /** Wie weit hat es die Schlange bis zu jedem Feld? (Breitensuche vom Kopf, ihr Koerper ist im Weg) */
  private gegnerSicht(): Sicht {
    const { w, h, mask } = this
    const wand = this.hindernisse(false)
    const dist = new Int32Array(w * h).fill(-1)
    const q = new Int32Array(w * h)
    const koerper = new Set(this.body.slice(1).map((p) => key(p.x, p.y)))
    const head = this.body[0]
    let qh = 0
    let qt = 0
    if (this.inside(head)) {
      dist[head.y * w + head.x] = 0
      q[qt++] = head.y * w + head.x
    }
    while (qh < qt) {
      const i = q[qh++]
      const x = i % w
      const y = (i - x) / w
      for (const d of DIRS) {
        const nx = x + STEP[d].x
        const ny = y + STEP[d].y
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const j = ny * w + nx
        if (dist[j] >= 0 || !mask[j]) continue
        const k = key(nx, ny)
        if (wand.has(k) || koerper.has(k)) continue
        dist[j] = dist[i] + 1
        q[qt++] = j
      }
    }
    const dir = this.queue[0] ?? this.dir
    return { wand, dist, vorKopf: { x: head.x + STEP[dir].x, y: head.y + STEP[dir].y } }
  }

  /** Felder, die der Gegner sicher vor der Schlange erreicht (er ist halb so schnell).
   *  Gesucht wird nur durch solche Felder: so viel Platz bleibt ihm wirklich */
  private gebietVon(start: P, zu: (p: P) => boolean, dist: Int32Array, cap: number, tempo: number) {
    const w = this.w
    const zuerst = (p: P, tiefe: number) => {
      const d = dist[p.y * w + p.x]
      return d < 0 || tiefe * tempo < d
    }
    if (!zuerst(start, 1)) return 0
    const tiefe = new Map<number, number>([[key(start.x, start.y), 1]])
    const q = [start]
    for (let i = 0; i < q.length && q.length < cap; i++) {
      const t = tiefe.get(key(q[i].x, q[i].y))! + 1
      for (const d of DIRS) {
        const p = { x: q[i].x + STEP[d].x, y: q[i].y + STEP[d].y }
        const k = key(p.x, p.y)
        if (tiefe.has(k) || zu(p) || !zuerst(p, t)) continue
        tiefe.set(k, t)
        q.push(p)
      }
    }
    return q.length
  }

  /** Ein Schritt einer Gegner-Schlange. Sie bewertet jede freie Richtung:
   *  - Gebiet: wie viele Felder sie sicher vor der Schlange erreicht (der wichtigste Wert,
   *    so flieht sie in offene Bereiche und durch Luecken, bevor sie sich schliessen)
   *  - Platz: keine Sackgassen, in denen sie sich selbst einsperrt
   *  - Abstand zur Schlange (Weg, nicht Luftlinie), nie direkt vor oder neben den Kopf
   *  - Bewegungsfreiheit (freie Nachbarn), gern geradeaus, ein wenig Zufall
   *  Ist niemand in der Naehe, schlaengelt sie gemuetlich herum.
   *  Eingekesselt (kein Zug mehr, oder ihr Bereich ist kaum groesser als sie selbst) stirbt sie. */
  private gegnerSchritt(e: Gegner, s: Sicht) {
    const w = this.w
    e.prev = e.body.map((p) => ({ ...p }))
    const head = e.body[0]
    const len = e.body.length
    const eigen = new Set((e.wachsRest > 0 ? e.body : e.body.slice(0, -1)).map((p) => key(p.x, p.y)))
    const andere = new Set<number>()
    for (const o of this.gegner) if (o !== e) o.body.forEach((p) => andere.add(key(p.x, p.y)))
    const schlange = new Set(this.body.map((p) => key(p.x, p.y)))
    const fremd = (p: P) => {
      if (!this.inside(p)) return true
      const k = key(p.x, p.y)
      return s.wand.has(k) || schlange.has(k) || andere.has(k)
    }
    const zu = (p: P) => fremd(p) || eigen.has(key(p.x, p.y))
    const moves = DIRS.map((d) => ({ d, p: { x: head.x + STEP[d].x, y: head.y + STEP[d].y } })).filter((m) => !zu(m.p))

    // Eingekesselt? Der ganze Bereich (mit ihr selbst) ist kaum groesser als sie: dann ist es vorbei
    const bereich = this.raum(head, fremd, len + 2)
    e.eng = !moves.length || bereich <= len + 1 ? e.eng + 1 : 0
    if (!moves.length || e.eng >= 2) {
      this.gegnerBesiegt(e)
      return
    }

    const ph = this.body[0]
    const dKopf = s.dist[head.y * w + head.x]
    const gejagt = dKopf >= 0 && dKopf <= 14
    e.angst = gejagt ? 1 - dKopf / 15 : Math.max(0, e.angst - 0.25)
    let best = moves[0]
    let bestS = -Infinity
    for (const m of moves) {
      const dP = s.dist[m.p.y * w + m.p.x]
      const gebiet = this.gebietVon(m.p, zu, s.dist, 120, R.gegnerTakte(this.cfg, e.art))
      const platz = this.raum(m.p, zu, 40)
      const frei = DIRS.filter((d) => !zu({ x: m.p.x + STEP[d].x, y: m.p.y + STEP[d].y })).length
      let sc = gebiet
      sc += platz * (platz <= len + 2 ? 3 : 0.3)
      if (platz <= len + 1) sc -= 60
      sc += (dP < 0 ? 20 : Math.min(dP, 20)) * (gejagt ? 2.5 : 0.4)
      sc += frei * 1.2
      if (manhattan(m.p, ph) <= 1) sc -= 40
      if (same(m.p, s.vorKopf)) sc -= 40
      if (m.d === e.dir) sc += gejagt ? 0.8 : 3
      if (same(m.p, this.apple.p) || this.powers.some((p) => same(p.p, m.p))) sc -= 6
      sc += this.r.next() * (gejagt ? 0.8 : 3)
      if (sc > bestS) {
        bestS = sc
        best = m
      }
    }
    e.dir = best.d
    e.body.unshift({ ...best.p })
    if (e.wachsRest > 0) e.wachsRest--
    else e.body.pop()
    // Laeuft sie ueber den Apfel, rollt er woandershin
    if (same(best.p, this.apple.p)) this.neuerApfel()
  }

  /** Gegner eingekesselt: zerfaellt. Hat die Schlange ihn eingekesselt (sie ist ganz nah),
   *  bringt er so viele Aepfel, wie er lang ist (mal Apfel-Stufe) */
  private gegnerBesiegt(e: Gegner) {
    this.gegner = this.gegner.filter((o) => o !== e)
    e.prev = e.body.map((p) => ({ ...p }))
    this.gegnerWeg.push({ g: e, t: this.time })
    const kopf = { ...e.body[0] }
    const dabei = e.body.some((g) => this.body.some((p) => cheb(p, g) <= 2))
    const wert = dabei ? e.body.length * this.cfg.apfelWert * this.apfelStufe() : 0
    if (dabei) this.besiegt++
    this.emit({ type: 'gegnerWeg', p: kopf, laenge: e.body.length, wert, art: e.art })
    if (wert > 0) {
      this.verdient += wert
      this.emit({ type: 'geld', wert, p: kopf, quelle: 'gegner' })
    }
  }

  /* ================= Lava ================= */

  /** Neuer Lavasee: beginnt mit einem Feld, hoert zwischen lavaMin und lavaMax Feldern auf zu wachsen */
  neuerLavaSee() {
    const c = this.cfg
    const r = this.r
    const ctx = this.platzKontext()
    for (let versuch = 0; versuch < 400; versuch++) {
      const p = { x: r.int(0, this.w - 1), y: r.int(0, this.h - 1) }
      if (!this.platzOk([p], 'teich', ctx)) continue
      const lo = Math.max(1, Math.min(c.lavaMin, c.lavaMax))
      this.lava.push({ cells: [p], t: [this.time], ziel: r.int(lo, Math.max(lo, c.lavaMin, c.lavaMax)) })
      this.emit({ type: 'lava', p: { ...p } })
      return true
    }
    return false
  }

  /** Jeder Lavasee, der noch nicht fertig ist, breitet sich um ein Feld in eine zufaellige Richtung aus.
   *  Nie in die Schlange, nie direkt vor oder neben den Kopf, nichts abschliessen */
  private lavaWachsen() {
    const head = this.body[0]
    for (const l of this.lava) {
      if (l.cells.length >= l.ziel) continue
      const wand = this.hindernisse()
      const eigen = new Set(l.cells.map((p) => key(p.x, p.y)))
      const cand: P[] = []
      const seen = new Set<number>()
      for (const p of l.cells)
        for (const d of DIRS) {
          const c = { x: p.x + STEP[d].x, y: p.y + STEP[d].y }
          const k = key(c.x, c.y)
          if (seen.has(k) || eigen.has(k)) continue
          seen.add(k)
          if (!this.inside(c) || wand.has(k) || this.aufSchlange(c) || same(c, this.apple.p) || this.powers.some((o) => same(o.p, c))) continue
          if (cheb(c, head) < 2 || this.imWeg(c, 3) || this.aufEis(c) || this.funde.some((f) => same(f.p, c))) continue
          cand.push(c)
        }
      const vorher = this.erreichbar(wand)
      for (const c of this.r.shuffle(cand)) {
        if (!this.keinAbschluss([c], wand, vorher)) continue
        l.cells.push(c)
        l.t.push(this.time)
        this.gift = this.gift.filter((g) => !same(g.p, c))
        this.emit({ type: 'lavaWachsen', p: { ...c } })
        break
      }
    }
  }

  /* ================= Ameisen ================= */

  /** Neue Ameise: sitzt irgendwo mit Abstand zur Schlange */
  neueAmeise(egal = false) {
    const c = this.cfg
    if (!egal && this.ameisen.length >= c.ameiseAnzahl) return false
    const head = this.body[0]
    const wand = this.hindernisse()
    const reach = this.erreichbar(wand)
    const nahe = new Set<number>()
    const rr = c.ameiseRadius + 1
    for (const b of this.body) for (let dx = -rr; dx <= rr; dx++) for (let dy = -rr; dy <= rr; dy++) nahe.add(key(b.x + dx, b.y + dy))
    const cand: P[] = []
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const p = { x, y }
        const k = key(x, y)
        if (!this.mask[y * this.w + x] || wand.has(k) || !reach.has(k) || same(p, this.apple.p) || this.powers.some((o) => same(o.p, p))) continue
        if (manhattan(p, head) < 6 || this.imWeg(p, 8) || this.freieNachbarn(p, wand) < 3) continue
        if (nahe.has(k)) continue
        cand.push(p)
      }
    if (!cand.length) return false
    const p = this.r.pick(cand)
    this.ameisen.push({ p, from: { ...p }, heim: { ...p }, dir: this.r.pick(DIRS), t: this.time, schrittT: -1e9, next: this.time + c.ameiseTakt * 1000, alarm: -1, sattBis: 0 })
    this.emit({ type: 'ameise', p: { ...p } })
    return true
  }

  /** Ameisen: ruhig, bis die Schlange im Umkreis ist (ameiseRadius, auch schraeg). Dann kurz aufmerksam,
   *  krabbelt langsam auf das naechste Glied zu und beisst, wenn sie direkt daneben ist (Level zurueck).
   *  Ist die Schlange wieder weg (oder hat sie gebissen), geht sie heim. Der Kopf zertritt sie. */
  private ameisenTakt() {
    this.ameisenWeg = this.ameisenWeg.filter((a) => this.time - a.t < AMEISE_WEG)
    if (!this.ameisen.length) return
    const c = this.cfg
    let wand: Set<number> | null = null
    for (const a of this.ameisen) {
      if (this.time < a.next) continue
      a.next = this.time + c.ameiseTakt * 1000
      wand ??= this.hindernisse()
      const satt = this.time < a.sattBis
      let ziel: P | null = null
      let best = Infinity
      if (!satt)
        for (const b of this.body) {
          if (cheb(b, a.p) > c.ameiseRadius) continue
          const d = manhattan(b, a.p)
          if (d < best) {
            best = d
            ziel = b
          }
        }
      if (ziel) {
        // Erst bemerken (ein Takt Vorwarnung), dann losgehen
        if (a.alarm < 0) {
          a.alarm = this.time
          this.emit({ type: 'ameiseAlarm', p: { ...a.p } })
          continue
        }
        if (best <= 1) {
          this.ameiseBeisst(a)
          continue
        }
        this.ameiseLaeuft(a, ziel, wand)
      } else {
        a.alarm = -1
        if (!same(a.p, a.heim)) this.ameiseLaeuft(a, a.heim, wand)
      }
    }
  }

  /** Ein Feld naeher ans Ziel (nur auf freie Felder, nie in die Schlange) */
  private ameiseLaeuft(a: Ameise, ziel: P, wand: Set<number>) {
    const hier = manhattan(a.p, ziel)
    const opts = this.r
      .shuffle(DIRS.slice())
      .map((d) => ({ d, p: { x: a.p.x + STEP[d].x, y: a.p.y + STEP[d].y } }))
      .filter(({ p }) => this.inside(p) && !wand.has(key(p.x, p.y)) && !this.aufSchlange(p) && !same(p, this.apple.p))
      .sort((x, y) => manhattan(x.p, ziel) - manhattan(y.p, ziel))
    const m = opts[0]
    const heim = same(ziel, a.heim)
    // Heimweg versperrt: dann ist eben hier das neue Zuhause. Beim Verfolgen darf sie seitlich ausweichen
    if (!m || manhattan(m.p, ziel) > hier || (heim && manhattan(m.p, ziel) === hier)) {
      if (heim) a.heim = { ...a.p }
      return
    }
    wand.delete(key(a.p.x, a.p.y))
    wand.add(key(m.p.x, m.p.y))
    a.from = { ...a.p }
    a.p = m.p
    a.dir = m.d
    a.schrittT = this.time
  }

  /** Biss: kostet ameiseZurueck Level (Schild faengt ab, nach einem Rueckschlag und als Geist nicht) */
  private ameiseBeisst(a: Ameise) {
    if (this.time < this.schutzBis || this.geist()) return
    if (this.kreativ && !this.kreativ.rueckschlag) return
    a.sattBis = this.time + 5000
    a.alarm = -1
    if (this.schildBrechen()) {
      this.schutzBis = this.time + this.cfg.schutz * 1000
      return
    }
    this.setback(this.cfg.ameiseZurueck, 'ameise')
  }

  /* ================= Eis ================= */

  /** Eisfeld (eisMin bis eisMax Felder), bleibt liegen. Mit einem Feld Luft zu festen Hindernissen
   *  und nicht am Rand, damit man nicht direkt in etwas hineinrutscht */
  neuesEisFeld() {
    const c = this.cfg
    const r = this.r
    const head = this.body[0]
    const lo = Math.max(1, Math.min(c.eisMin, c.eisMax))
    const hi = Math.max(lo, c.eisMin, c.eisMax)
    const wand = this.hindernisse()
    const luft = new Set<number>()
    for (const p of [...this.teiche.flatMap((t) => t.cells), ...this.mauern.flatMap((m) => m.cells), ...this.baeume.flatMap((b) => b.cells), ...this.haeuser.flatMap((h) => h.cells), ...this.tuerme.flatMap((t) => t.cells), ...this.lava.flatMap((l) => l.cells), ...this.eis.flatMap((e) => e.cells)])
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) luft.add(key(p.x + dx, p.y + dy))
    for (let versuch = 0; versuch < 400; versuch++) {
      const size = Math.max(lo, r.int(lo, hi) - Math.floor(versuch / 100))
      const cells: P[] = [{ x: r.int(1, this.w - 2), y: r.int(1, this.h - 2) }]
      let guard = 0
      while (cells.length < size && guard++ < 80) {
        const von = r.pick(cells)
        const d = STEP[r.pick(DIRS)]
        const n = { x: von.x + d.x, y: von.y + d.y }
        if (!cells.some((o) => same(o, n))) cells.push(n)
      }
      if (cells.length < size) continue
      const ok = cells.every((p) => {
        const k = key(p.x, p.y)
        return this.innen(p) && !wand.has(k) && !luft.has(k) && !this.aufSchlange(p) && cheb(p, head) >= 3 && !this.imWeg(p, 6) && !this.funde.some((f) => same(f.p, p))
      })
      if (!ok) continue
      this.eis.push({ cells, t: this.time })
      this.emit({ type: 'eis' })
      return true
    }
    return false
  }

  /* ================= Sandbox ================= */

  /** Ein Objekt dazu (Sandbox und Kreativ), ohne Level- und Anzahlgrenzen. false = kein Platz */
  objektDazu(art: SandboxObjekt): boolean {
    const r = this.r
    const ok = (() => {
      switch (art) {
        case 'mauer':
          return this.neueMauer(r.int(2, Math.max(2, this.cfg.mauerMax)))
        case 'teich':
          return this.neuerTeich(r.int(2, 6))
        case 'gift':
          return !!this.neuesGift()
        case 'baum':
          return this.neuerBaum()
        case 'haus':
          return this.neuesHaus(r.next() < 0.4)
        case 'turm':
          return this.neuerTurm()
        case 'falle':
          return this.neueFalle()
        case 'wolke':
          return this.neueWolke()
        case 'frosch':
          return this.neuerFrosch(true)
        case 'gegner':
          return this.neuerGegner('rot', true)
        case 'lila':
          return this.neuerGegner('lila', true)
        case 'ameise':
          return this.neueAmeise(true)
        case 'lava':
          return this.neuerLavaSee()
        case 'eis':
          return this.neuesEisFeld()
      }
    })()
    if (ok) this.lastSpawn = this.time
    return ok
  }

  /** Kreativ: alles von der Karte raeumen (Karte und Schlange bleiben) */
  allesWeg() {
    this.mauern = []
    this.teiche = []
    this.gift = []
    this.fallen = []
    this.wolken = []
    this.froesche = []
    this.baeume = []
    this.haeuser = []
    this.tuerme = []
    this.gegner = []
    this.ameisen = []
    this.lava = []
    this.eis = []
    this.funde = []
    this.powers = []
  }

  /** Events abholen */
  drain(): GameEvent[] {
    const e = this.events
    this.events = []
    return e
  }
}
