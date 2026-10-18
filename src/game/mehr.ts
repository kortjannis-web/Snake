/**
 * Mehrspieler-Spiellogik auf Grundlage von `Game` (laeuft im Browser und im Test, ohne Darstellung).
 *
 * Mehrere Schlangen teilen sich eine Welt. `Game` kennt nur eine Schlange (`body`, `dir`, `queue` ...):
 * deshalb liegt der Zustand jeder Schlange in `schlangen`, und vor allem, was eine bestimmte Schlange
 * betrifft (Schritt, Lenken, Tod), wird sie mit `wechsel(i)` in die Felder von `Game` geladen.
 * Die Welt sieht ueber die Einhakpunkte von `Game` alle Schlangen (Platzsuche, Gegner, Ameisen).
 *
 * Modi:
 * - vs: ein Feld, Schlangen sind fuereinander Hindernisse. Jeder hat 3 Leben. Raus ist, wer keine Leben
 *   mehr hat oder zu weit hinter dem Fuehrenden liegt (5 Aepfel, alle 20 Aepfel des Fuehrenden einer mehr).
 *   Der Letzte gewinnt. Erweitern abwechselnd alle 10 / 5 / 3 Aepfel (2 / 3 / 4 Spieler).
 * - koop: ein Feld, man faehrt durcheinander hindurch, Aepfel zaehlen gemeinsam, 3 gemeinsame Leben.
 *   Erweitern abwechselnd alle 15 Level.
 * - rennen: jeder hat seine eigene Welt (dieses Objekt enthaelt dann nur die eigene Schlange), die
 *   anderen sieht man als Geist. Das naechste Gebiet waehlt abwechselnd einer, es kommt bei allen an
 *   dieselbe Stelle (siehe `gebietVonAussen`). Abstand und Sieger bestimmt der Server.
 */
import { Game, type GameOpts } from './game'
import * as R from './rules'
import type { Cause, Dir, GameEvent, P } from './types'

export type Modus = 'vs' | 'koop' | 'rennen'
export type SpielerInfo = { id: string; name: string; skin: string }

/** Sekunden bis zur Rueckkehr nach einem Tod */
export const ZURUECK_MS = 5000
/** So lange gleitet eine zurueckgekehrte Schlange als Geist (ms) */
export const SCHUTZ_MS = 2500
export const LEBEN = 3

/** Felder, die jede Schlange fuer sich hat (werden beim Wechsel in `Game` geladen) */
const TAUSCH = ['body', 'prev', 'dir', 'prevDir', 'ate', 'halt', 'gnade', 'gnadeVorbei', 'queue', 'wachsRest', 'effekt', 'rueckSchritte', 'tunnel', 'schutzBis', 'last'] as const
export const TAUSCH_FELDER: readonly string[] = TAUSCH

export type Schlange = SpielerInfo & {
  body: P[]
  prev: P[]
  dir: Dir
  prevDir: Dir
  ate: boolean
  halt: boolean
  gnade: { cause: Cause; bis: number } | null
  gnadeVorbei: boolean
  queue: Dir[]
  wachsRest: number
  effekt: Game['effekt']
  rueckSchritte: number
  tunnel: P[]
  schutzBis: number
  last: number
  /** Eigene Aepfel (im Rennen: eigener Level - 1) */
  aepfel: number
  /** Eigene Leben (im Koop zaehlt der gemeinsame Pool) */
  leben: number
  tot: boolean
  raus: boolean
  grund: 'leben' | 'abstand' | null
  /** Wann ausgeschieden (fuer die Rangliste) */
  rausBei: number
  cause: Cause | null
  deathAt: number
  zurueckBei: number
}

export type MehrOpts = GameOpts & { modus: Modus; spieler: SpielerInfo[] }
export type Ergebnis = { sieger: number | null; reihenfolge: number[] }

const neuEffekt = (): Game['effekt'] => ({ schild: 0, zeitlupeBis: 0, geistBis: 0, fuetternBis: 0, magnetBis: 0, maulwurfBis: 0 })
const same = (a: P, b: P) => a.x === b.x && a.y === b.y
const manhattan = (a: P, b: P) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)

/** Erlaubter Apfel-Abstand zum Fuehrenden: 5, alle 20 Aepfel des Fuehrenden einer mehr */
export const abstandGrenze = (fuehrend: number) => 5 + Math.floor(fuehrend / 20)
/** Alle wie viele Aepfel ein Gebiet dazukommt */
export const gebietTakt = (modus: Modus, spieler: number) => (modus === 'koop' ? 15 : spieler >= 4 ? 3 : spieler === 3 ? 5 : 10)

export class MehrGame extends Game {
  readonly modus: Modus
  schlangen: Schlange[]
  /** Welche Schlange gerade in den Feldern von Game steckt */
  aktiv = 0
  /** Gemeinsame Leben im Koop */
  pool = LEBEN
  /** Gegessene Aepfel aller Spieler (fuer den Gebiets-Takt) */
  zuege = 0
  /** Wer die offene Wahl hat (-1 = niemand) und wer als Naechster dran ist */
  wahlSpieler = -1
  waehlerNaechster = 0
  /** Rennen: diese Welt darf das naechste Gebiet waehlen (sagt der Server) */
  rennenWaehler = false
  ergebnis: Ergebnis | null = null
  /** Kopf an Kopf: diese Schlange stirbt mit */
  protected stossMit = -1
  /** Anzahl Spieler beim Start (fuer den Gebiets-Takt) */
  readonly anzahl: number

  constructor(o: MehrOpts) {
    super({ ...o, startLevel: 1, kreativ: null, sandbox: null })
    this.modus = o.modus
    this.anzahl = o.spieler.length
    this.schlangen = o.spieler.map((s, i) => this.neueSchlange(s, i, o.spieler.length))
    // Base hat schon eine Schlange in der Mitte gesetzt: durch die erste ersetzen
    this.laden(0)
    if (o.modus !== 'rennen') this.neuerApfel()
    this.events = []
  }

  /** Startplatz: jede Schlange in einer eigenen Reihe, abwechselnd von links und rechts */
  protected neueSchlange(s: SpielerInfo, i: number, n: number): Schlange {
    let body: P[]
    let dir: Dir
    if (this.modus === 'rennen' || n === 1) {
      body = this.body.map((p) => ({ ...p }))
      dir = 'r'
    } else {
      const y = Math.min(this.h - 2, Math.max(1, Math.round((this.h * (i + 1)) / (n + 1))))
      if (i % 2 === 0) {
        body = [{ x: 3, y }, { x: 2, y }, { x: 1, y }]
        dir = 'r'
      } else {
        const x = this.w - 4
        body = [{ x, y }, { x: x + 1, y }, { x: x + 2, y }]
        dir = 'l'
      }
    }
    return {
      ...s,
      body,
      prev: body.map((p) => ({ ...p })),
      dir,
      prevDir: dir,
      ate: false,
      halt: false,
      gnade: null,
      gnadeVorbei: false,
      queue: [],
      wachsRest: 0,
      effekt: neuEffekt(),
      rueckSchritte: 0,
      tunnel: [],
      schutzBis: 0,
      last: 0,
      aepfel: 0,
      leben: LEBEN,
      tot: false,
      raus: false,
      grund: null,
      rausBei: 0,
      cause: null,
      deathAt: 0,
      zurueckBei: 0,
    }
  }

  /* ================= Wechsel zwischen den Schlangen ================= */

  protected get felder_() {
    return this as unknown as Record<string, unknown>
  }

  /** Schlange i in die Felder von Game laden (ohne die aktive vorher zu sichern) */
  protected laden(i: number) {
    const s = this.schlangen[i] as unknown as Record<string, unknown>
    for (const k of TAUSCH) this.felder_[k] = s[k]
    this.aktiv = i
  }

  /** Die aktive Schlange aus den Feldern von Game zurueck in `schlangen` schreiben */
  sichern() {
    const s = this.schlangen[this.aktiv] as unknown as Record<string, unknown>
    if (!s) return
    for (const k of TAUSCH) s[k] = this.felder_[k]
  }

  wechsel(i: number) {
    if (i === this.aktiv) return
    this.sichern()
    this.laden(i)
  }

  get ich(): Schlange {
    return this.schlangen[this.aktiv]
  }

  protected lebend(i: number) {
    const s = this.schlangen[i]
    return !!s && !s.tot && !s.raus
  }

  /* ================= Einhakpunkte von Game ================= */

  protected lebt() {
    return this.status === 'play' && this.lebend(this.aktiv)
  }

  protected andereSchlangen(): P[][] {
    const out: P[][] = []
    for (let i = 0; i < this.schlangen.length; i++) if (i !== this.aktiv && this.lebend(i)) out.push(this.schlangen[i].body)
    return out
  }

  protected koepfe(): P[] {
    const out: P[] = this.lebend(this.aktiv) ? [this.body[0]] : []
    for (const b of this.andereSchlangen()) out.push(b[0])
    return out.length ? out : [this.body[0]]
  }

  protected koerperSet() {
    const set = new Set<number>()
    const add = (p: P) => set.add((p.y + 1) * 4096 + (p.x + 1))
    if (this.lebend(this.aktiv)) this.body.forEach(add)
    for (const b of this.andereSchlangen()) b.forEach(add)
    return set
  }

  /** Auch vor den Koepfen der anderen nichts hinsetzen */
  imWeg(c: P, weit = Infinity) {
    if (this.lebend(this.aktiv) && super.imWeg(c, weit)) return true
    for (let i = 0; i < this.schlangen.length; i++) {
      if (i === this.aktiv || !this.lebend(i)) continue
      const s = this.schlangen[i]
      const head = s.body[0]
      const hit = [s.dir, ...s.queue].some((dir) => {
        const d = R.STEP[dir]
        const vor = (c.x - head.x) * d.x + (c.y - head.y) * d.y
        const quer = Math.abs((c.x - head.x) * d.y - (c.y - head.y) * d.x)
        return vor > 0 && vor <= weit && quer <= 1
      })
      if (hit) return true
    }
    return false
  }

  protected andereTreffen(n: P): Cause | null {
    if (this.modus !== 'vs') return null
    for (let i = 0; i < this.schlangen.length; i++) {
      if (i === this.aktiv || !this.lebend(i)) continue
      const b = this.schlangen[i].body
      // Das Schwanzende zieht im selben Takt weiter (ausser beim Wachsen): darauf darf man fahren
      const rest = this.schlangen[i].wachsRest > 0 ? b : b.slice(0, -1)
      if (rest.some((p) => same(p, n))) {
        this.stossMit = same(b[0], n) ? i : -1
        return 'spieler'
      }
    }
    return null
  }

  protected darfWaehlen() {
    return this.wahlSpieler === this.aktiv
  }

  /** Gebiete kommen im Mehrspieler nach eigenem Takt (siehe eat), nie ueber den Level */
  protected gebietFaellig(_l: number) {
    return false
  }

  protected levelHoch() {
    // Gegeneinander: die Welt waechst mit dem Fuehrenden (Level = meiste Aepfel + 1)
    if (this.modus === 'vs') return this.ich.aepfel + 1 > this.level
    return true
  }

  protected wachsLevel() {
    return this.modus === 'rennen' ? this.level : this.ich.aepfel + 1
  }

  protected mitSchlangeBei(p: P, f: () => void) {
    let best = -1
    let bestD = Infinity
    for (let i = 0; i < this.schlangen.length; i++) {
      if (!this.lebend(i)) continue
      const b = i === this.aktiv ? this.body : this.schlangen[i].body
      for (const q of b) {
        const d = manhattan(q, p)
        if (d < bestD) {
          bestD = d
          best = i
        }
      }
    }
    if (best < 0) return
    const vorher = this.aktiv
    this.wechsel(best)
    f()
    this.wechsel(vorher)
  }

  /** Jedes Ereignis bekommt den Spieler, um den es geht (fuer Toene und Anzeige auf den anderen Geraeten) */
  protected emit(e: GameEvent) {
    const m = e as GameEvent & { wer?: number }
    if (m.wer === undefined) m.wer = this.aktiv
    super.emit(e)
  }

  /** Die Karte rueckt (links oder oben angebaut): alle Schlangen mitnehmen */
  protected shift(dx: number, dy: number) {
    super.shift(dx, dy)
    for (let i = 0; i < this.schlangen.length; i++) {
      if (i === this.aktiv) continue
      const s = this.schlangen[i]
      for (const p of [...s.body, ...s.prev, ...s.tunnel]) {
        p.x += dx
        p.y += dy
      }
    }
  }

  /* ================= Ablauf ================= */

  protected schritte() {
    for (let i = 0; i < this.schlangen.length; i++) {
      const s = this.schlangen[i]
      if (s.raus) continue
      if (s.tot) {
        if (this.time >= s.zurueckBei) this.wiederbeleben(i)
        continue
      }
      this.wechsel(i)
      super.schritte()
      if (this.status !== 'play') return
    }
  }

  protected weltTakt() {
    // Power-ups, Magnet, Erde: fuer jede lebende Schlange
    for (let i = 0; i < this.schlangen.length; i++) {
      if (!this.lebend(i)) continue
      this.wechsel(i)
      this.effekteTakt()
      if (this.status !== 'play') return
    }
    // Die Welt einmal, mit einer lebenden Schlange (alle anderen sieht sie ueber die Einhakpunkte)
    const erste = this.schlangen.findIndex((_, i) => this.lebend(i))
    if (erste >= 0) this.wechsel(erste)
    this.umweltTakt()
  }

  /** Spieler i lenkt */
  lenke(i: number, d: Dir) {
    if (!this.lebend(i) || this.status !== 'play') return
    this.wechsel(i)
    this.turn(d, true)
  }

  protected die(cause: Cause) {
    const i = this.aktiv
    const s = this.schlangen[i]
    if (s.tot || s.raus) return
    this.gnade = null
    this.queue = []
    s.tot = true
    s.cause = cause
    s.deathAt = this.time
    s.zurueckBei = this.time + ZURUECK_MS
    this.emit({ type: 'die', cause, wer: i })
    if (this.modus === 'koop') {
      this.pool = Math.max(0, this.pool - 1)
      if (this.pool <= 0) {
        for (let j = 0; j < this.schlangen.length; j++) this.ausscheiden(j, 'leben')
      }
    } else {
      s.leben = Math.max(0, s.leben - 1)
      if (s.leben <= 0) this.ausscheiden(i, 'leben')
    }
    // Kopf an Kopf: der andere ist auch hin
    const mit = this.stossMit
    this.stossMit = -1
    if (cause === 'spieler' && mit >= 0 && this.lebend(mit)) {
      this.wechsel(mit)
      this.die('spieler')
      this.wechsel(i)
    }
    this.pruefeEnde()
  }

  protected ausscheiden(i: number, grund: 'leben' | 'abstand') {
    const s = this.schlangen[i]
    if (s.raus) return
    s.raus = true
    s.grund = grund
    s.rausBei = this.time
    if (this.wahlSpieler === i && this.wahl > 0) this.wahlSpieler = this.naechsterWaehler()
    this.emit({ type: 'raus', wer: i, grund })
  }

  /** Nach dem Tod: an einem sicheren Platz mit 3 Gliedern wieder einsetzen (kurz als Geist) */
  protected wiederbeleben(i: number) {
    if (this.status !== 'play') return
    const s = this.schlangen[i]
    const platz = this.startPlatz(i)
    if (!platz) {
      s.zurueckBei = this.time + 400
      return
    }
    this.wechsel(i)
    this.body = platz.body
    this.prev = platz.body.map((p) => ({ ...p }))
    this.dir = platz.dir
    this.prevDir = platz.dir
    this.queue = []
    this.ate = false
    this.halt = false
    this.gnade = null
    this.gnadeVorbei = false
    this.wachsRest = 0
    this.tunnel = []
    this.rueckSchritte = 0
    this.effekt = { ...neuEffekt(), geistBis: this.time + SCHUTZ_MS }
    this.schutzBis = this.time + SCHUTZ_MS
    this.last = this.time
    s.tot = false
    s.cause = null
    this.emit({ type: 'zurueck', wer: i })
  }

  /** Freier Platz: 3 Felder Koerper und 4 Felder davor frei, moeglichst weit weg von den anderen Koepfen */
  protected startPlatz(i: number): { body: P[]; dir: Dir } | null {
    const wand = this.hindernisse()
    for (const h of this.haeuser) for (const p of h.strahl) wand.add((p.y + 1) * 4096 + (p.x + 1))
    for (const t of this.tuerme) for (const p of t.kegel) wand.add((p.y + 1) * 4096 + (p.x + 1))
    const koerper = new Set<number>()
    const koepfe: P[] = []
    for (let j = 0; j < this.schlangen.length; j++) {
      if (j === i || !this.lebend(j)) continue
      const b = j === this.aktiv ? this.body : this.schlangen[j].body
      b.forEach((p) => koerper.add((p.y + 1) * 4096 + (p.x + 1)))
      koepfe.push(b[0])
    }
    const frei = (p: P) => this.inside(p) && !wand.has((p.y + 1) * 4096 + (p.x + 1)) && !koerper.has((p.y + 1) * 4096 + (p.x + 1)) && !this.gift.some((g) => same(g.p, p))
    let best: { body: P[]; dir: Dir } | null = null
    let bestS = -Infinity
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const c = { x, y }
        if (!frei(c)) continue
        for (const dir of R.DIRS) {
          const d = R.STEP[dir]
          const body = [0, 1, 2].map((k) => ({ x: x - d.x * k, y: y - d.y * k }))
          const vor = [1, 2, 3, 4].map((k) => ({ x: x + d.x * k, y: y + d.y * k }))
          if (!body.every(frei) || !vor.every(frei)) continue
          const weg = koepfe.length ? Math.min(...koepfe.map((k) => manhattan(k, c))) : 20
          const sc = Math.min(weg, 20) + this.r.next() * 3
          if (sc > bestS) {
            bestS = sc
            best = { body, dir }
          }
        }
      }
    return best
  }

  protected eat(n: P) {
    const s = this.ich
    s.aepfel++
    super.eat(n)
    if (this.modus === 'rennen') {
      s.aepfel = this.level - 1
      this.pruefeRennenGebiet()
      return
    }
    this.zuege++
    if (this.zuege % gebietTakt(this.modus, this.anzahl) === 0) this.starteWahl()
    if (this.modus === 'vs') this.pruefeAbstand()
  }

  setback(n: number, grund: 'wolke' | 'licht' | 'kegel' | 'ameise') {
    if (this.modus !== 'vs') {
      super.setback(n, grund)
      if (this.modus === 'rennen') this.ich.aepfel = this.level - 1
      return
    }
    if (n <= 0) return
    const s = this.ich
    const von = s.aepfel + 1
    const auf = Math.max(1, von - n)
    this.kuerzen(auf, von)
    s.aepfel = auf - 1
    this.schutzBis = this.time + this.cfg.schutz * 1000
    this.emit({ type: 'setback', von, auf, grund })
    this.pruefeAbstand()
  }

  /* ================= Gebiete ================= */

  protected naechsterWaehler() {
    const n = this.schlangen.length
    for (let k = 0; k < n; k++) {
      const i = (this.waehlerNaechster + k) % n
      if (this.lebend(i)) {
        this.waehlerNaechster = i + 1
        return i
      }
    }
    for (let k = 0; k < n; k++) {
      const i = (this.waehlerNaechster + k) % n
      if (!this.schlangen[i].raus) {
        this.waehlerNaechster = i + 1
        return i
      }
    }
    return -1
  }

  /** Neues Gebiet: einer (abwechselnd) sieht die leuchtenden Waende und darf waehlen */
  protected starteWahl() {
    if (this.wahl > 0) {
      this.wahl = 0
      this.expand()
    }
    const wer = this.naechsterWaehler()
    if (wer < 0) return this.expand()
    this.wahl = 1
    this.wahlBis = this.time + this.cfg.wahlZeit * 1000
    this.wahlSpieler = wer
    this.emit({ type: 'wahl', offen: 1, wer })
  }

  /** Level, ab dem das k-te Gebiet kommt (wie im Einzelspiel) */
  static schwelle(cfg: R.Config, k: number) {
    let n = 0
    for (let l = 2; l < 100_000; l++) if (R.neuesGebiet(cfg, l) && ++n === k) return l
    return Infinity
  }

  /** Rennen: diese Welt ist dran und hat den Level erreicht: Waende leuchten */
  pruefeRennenGebiet() {
    if (this.modus !== 'rennen' || !this.rennenWaehler || this.wahl > 0 || this.status !== 'play') return
    if (this.level < MehrGame.schwelle(this.cfg, this.expansions + 1)) return
    this.wahl = 1
    this.wahlBis = this.time + this.cfg.wahlZeit * 1000
    this.wahlSpieler = this.aktiv
    this.emit({ type: 'wahl', offen: 1, wer: this.aktiv })
  }

  /** Rennen: ein anderer hat das Gebiet k gewaehlt (Block in Weltkoordinaten) */
  gebietVonAussen(k: number, wb: P, d: Dir) {
    if (this.expansions >= k) return
    if (this.wahl > 0) this.wahl = 0
    const p = { x: wb.x + this.ursprung.x / this.bw, y: wb.y + this.ursprung.y / this.bh }
    if (this.blocks.some((b) => same(b, p))) {
      this.expansions++
      return
    }
    this.expand({ p, d })
  }

  /** Weltkoordinaten eines Kartenblocks (gleich in allen Welten des Rennens) */
  blockWelt(b: P): P {
    return { x: b.x - this.ursprung.x / this.bw, y: b.y - this.ursprung.y / this.bh }
  }

  /* ================= Ende ================= */

  /** Gegeneinander: wer zu weit hinter dem Fuehrenden liegt, ist raus */
  protected pruefeAbstand() {
    const im = this.schlangen.map((s, i) => ({ s, i })).filter(({ s }) => !s.raus)
    if (im.length < 2) return
    const best = Math.max(...im.map(({ s }) => s.aepfel))
    const grenze = abstandGrenze(best)
    for (const { s, i } of im) if (best - s.aepfel >= grenze) this.ausscheiden(i, 'abstand')
    this.pruefeEnde()
  }

  protected pruefeEnde() {
    if (this.status !== 'play') return
    const im = this.schlangen.map((_, i) => i).filter((i) => !this.schlangen[i].raus)
    if (this.modus === 'koop') {
      if (im.length === 0) this.beenden(null)
      return
    }
    if (this.modus === 'vs' && this.schlangen.length > 1 && im.length <= 1) this.beenden(im[0] ?? null)
    if (this.modus === 'rennen' && im.length === 0) this.beenden(null)
  }

  /** Rangliste: wer laenger drin war, dann mehr Aepfel */
  rangliste(): number[] {
    return this.schlangen
      .map((s, i) => ({ s, i }))
      .sort((a, b) => (a.s.raus ? a.s.rausBei : Infinity) - (b.s.raus ? b.s.rausBei : Infinity) || a.s.aepfel - b.s.aepfel)
      .reverse()
      .map(({ i }) => i)
  }

  beenden(sieger: number | null) {
    if (this.status !== 'play') return
    this.sichern()
    this.status = 'over'
    this.deathAt = this.time
    this.ergebnis = { sieger, reihenfolge: this.rangliste() }
    this.emit({ type: 'ende' })
  }
}
