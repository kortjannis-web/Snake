/**
 * Boss der Wiese (Mission 10): der Steingolem in drei Raeumen. Statt Aepfeln gibt es Kristalle:
 * - Raum 1 hat 3 Sockel, Raum 2 hat 4, Raum 3 hat 6 (dort liegen die Kristalle in Kammern und Gassen, man muss sie holen).
 *   Kristalle (bis zu drei auf einmal) einsammeln und zum Sockel der gleichen Farbe bringen
 * - leuchten alle Sockel des Raums, wird sein Bannkreis aktiv: tritt der Golem hinein, ist er gebannt (er wird blaeulich,
 *   Lichtketten halten ihn) und verwundbar. Dann faehrt die Schlange durch ihn hindurch: der eine Treffer dieses Raums
 * - danach springt der Golem in den naechsten Raum, das Steintor geht auf; ist die Schlange durch, schliesst es sich hinter
 *   ihr, der Golem bruellt und der Kampf geht weiter, schneller und boeser. Drei Treffer = besiegt
 * Der Golem stapft immer auf die Schlange zu und greift an, jede Attacke wird rot angekuendigt:
 * - Stampfen: Kreis um ihn herum
 * - Ansturm: ein langer Streifen bis zur Wand, er rennt hindurch, prallt auf und Felsbrocken fallen
 * - Sprung: er springt hoch, ein roter Kreis folgt der Schlange, bleibt stehen, dann landet er dort
 * Die Schlange hat drei Herzen: ein Treffer kostet eins (danach kurz geschuetzt), jeder Treffer am Golem gibt eins zurueck.
 * Es zaehlen Kopf und Hals (der Schwanz darf noch in der roten Flaeche haengen). Berge und Tore sind wie immer toedlich.
 */
import { key } from './game'
import { MissionGame } from './mission'
import type { MissionDef } from './missionen'
import { DIRS, STEP } from './rules'
import type { GolemEreignis, P } from './types'

/** wechsel = springt in den naechsten Raum, wartet = steht dort, bis die Schlange hereinkommt */
export type GolemZustand = 'schlaf' | 'erwachen' | 'laufen' | 'stampfen' | 'ansturm' | 'benommen' | 'sprung' | 'gebannt' | 'getroffen' | 'wechsel' | 'wartet' | 'zorn' | 'tot'
export type GolemAngriffArt = 'stampfen' | 'ansturm' | 'sprung'

/** Punkt in Feldern (Mitte eines Feldes = ganze Zahl), auch zwischen den Feldern */
export type Pf = { x: number; y: number }

export type GolemAngriff =
  /** Stampfen: Kreis mit Radius r um ihn, Einschlag bei `schlag` */
  | { art: 'stampfen'; r: number; ab: number; schlag: number; fertig: boolean }
  /** Ansturm von `von` bis `nach` (Wand), losrennen bei `los` */
  | { art: 'ansturm'; von: Pf; nach: Pf; dir: Pf; ab: number; los: number }
  /** Sprung: abheben bei `ab`, Kreis folgt der Schlange bis `halt`, faellt ab `fall`, landet bei `landung`.
   *  wechsel = Sprung in den naechsten Raum (ohne Zielkreis, tut niemandem weh) */
  | { art: 'sprung'; ziel: Pf; r: number; von: Pf; duck: number; ab: number; halt: number; fall: number; landung: number; fertig: boolean; combo: boolean; wechsel: boolean }

export type Golem = {
  x: number
  y: number
  /** Blickrichtung (Bogenmass, 0 = rechts) */
  winkel: number
  zustand: GolemZustand
  seit: number
  bis: number
  /** 0, 1, 2: wird mit jedem Treffer schneller und boeser */
  phase: number
  hp: number
  angriff: GolemAngriff | null
  letzter: GolemAngriffArt | null
  /** Gelaufene Strecke (fuer die Schritte) */
  weg: number
  /** Letzter Treffer (Aufblitzen, Brocken) */
  trefferT: number
  /** Bannkreis wirkt erst wieder ab */
  kreisPause: number
}

export type Kristall = { p: P; farbe: number; t: number }
export type Sockel = { p: P; farbe: number; an: boolean; t: number }
/** Fallender Felsbrocken nach dem Aufprall des Ansturms (Schatten bis `bis`, dann Einschlag) */
export type Brocken = { p: P; t: number; bis: number; fertig: boolean }
/** Sichtbare Druckwelle (nur Darstellung) */
export type Welle = { x: number; y: number; t: number; r: number; art: 'stampfen' | 'landung' | 'aufprall' | 'treffer' | 'zorn' }
/** Steintor zwischen zwei Raeumen: zu (toedlich), geht nach dem Treffer auf und hinter der Schlange wieder zu */
export type Tor = { cells: P[]; offen: boolean; t: number }
/** Ein Raum der Arena: Zeilen y0 bis y1, Bannkreis, Sockel, Start des Golems, feste Kristallplaetze, Tor nach oben */
export type Raum = { nr: number; y0: number; y1: number; kreis: { p: P; r: number }; sockel: Sockel[]; golem: P; plaetze: P[]; tor: Tor | null }

/** So hoch ist ein Raum (zwei Bloecke der Boss-Bildgroesse) */
export const RAUM_H = 32

/** Kristallfarben (Index = Sockel 1 bis 6) */
export const KRISTALL_FARBEN = ['#FF4D5E', '#FFA032', '#FFE14A', '#5BE37A', '#4FB6FF', '#B57BFF'] as const
export const KRISTALL_NAMEN = ['Rot', 'Orange', 'Gelb', 'Grün', 'Blau', 'Lila'] as const

/** Alle Zeiten in ms, Tempo in Feldern je Sekunde. Je Phase: Tempo steigt, Warnungen werden kuerzer */
export const GOLEM = {
  leben: 3,
  herzen: 3,
  /** Nach einem Treffer am Spieler so lange geschuetzt */
  schutz: 1900,
  /** Von Attacken und Beruehrung zaehlen Kopf und Hals (so viele Glieder vorn) */
  trifftGlieder: 2,
  tempo: [2.2, 2.65, 3.1],
  warnFaktor: [1, 0.84, 0.7],
  erwachen: 2400,
  laufenMin: 1300,
  laufenMax: 2400,
  stampfenWarn: 1300,
  stampfenR: [3.6, 3.8, 4.2],
  stampfenNach: 700,
  ansturmWarn: 1250,
  ansturmTempo: 14,
  benommen: 1200,
  brocken: [3, 4, 5],
  brockenWarn: 1050,
  sprungDuck: 420,
  sprungAuf: 450,
  sprungZielen: 2000,
  sprungZielTempo: [6, 7, 8],
  sprungHalt: 800,
  sprungFall: 260,
  sprungR: 2.6,
  sprungNach: 750,
  bann: [6500, 5600, 4800],
  bannR: 2.6,
  kreisPause: 4000,
  getroffen: 1100,
  zorn: 1600,
  /** Sprung in den naechsten Raum: hoch, Flug, Landung */
  wechselAuf: 500,
  wechselFlug: 900,
  /** Tor sinkt in den Boden (und steigt wieder auf) */
  tor: 700,
  tot: 3400,
  kristallPause: 1600,
} as const

const dist = (a: Pf, b: Pf) => Math.hypot(a.x - b.x, a.y - b.y)
const winkelVon = (a: Pf, b: Pf) => Math.atan2(b.y - a.y, b.x - a.x)
/** Unterschied zweier Winkel (-PI bis PI) */
export const winkelDiff = (a: number, b: number) => {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

export class BossGame extends MissionGame {
  golem: Golem
  kristalle: Kristall[] = []
  /** Getragene Kristalle (Farben) */
  traegt: number[] = []
  /** Die Raeume von unten (0, Start) nach oben; `raumNr` = in welchem der Golem gerade kaempft */
  raeume: Raum[]
  raumNr = 0
  /** Felder, auf die der Golem nicht tritt */
  protected sperre: Set<number>
  /** Herzen der Schlange */
  leben: number = GOLEM.herzen
  brocken: Brocken[] = []
  wellen: Welle[] = []
  /** Naechste Kristalle fruehestens ab */
  protected kristallAb = 0

  constructor(m: MissionDef) {
    super(m)
    const k = this.karte
    // Raeume: je RAUM_H Zeilen, Raum 0 ganz unten
    const n = Math.max(1, Math.round(k.h / RAUM_H))
    const imBand = (p: P, y0: number) => p.y >= y0 && p.y < y0 + RAUM_H
    this.raeume = Array.from({ length: n }, (_, nr) => {
      const y0 = k.h - RAUM_H * (nr + 1)
      const kreis = k.kreise.find((p) => imBand(p, y0)) ?? { x: Math.floor(k.w / 2), y: y0 + RAUM_H / 2 }
      const golem = k.golems.find((p) => imBand(p, y0)) ?? { x: Math.floor(k.w / 2), y: y0 + 5 }
      // Tor nach oben: liegt auf den beiden Randzeilen zwischen diesem und dem naechsten Raum
      const tor = k.tore.filter((p) => p.y === y0 || p.y === y0 - 1)
      return {
        nr,
        y0,
        y1: y0 + RAUM_H - 1,
        kreis: { p: { ...kreis }, r: GOLEM.bannR },
        sockel: k.sockel.filter((s) => imBand(s.p, y0)).sort((a, b) => a.i - b.i).map((s) => ({ p: { ...s.p }, farbe: s.i, an: false, t: -1e9 })),
        golem: { ...golem },
        plaetze: k.plaetze.filter((p) => imBand(p, y0)).map((p) => ({ ...p })),
        tor: tor.length ? { cells: tor.map((p) => ({ ...p })), offen: false, t: -1e9 } : null,
      }
    })
    this.sperre = new Set(k.sperre.map((p) => key(p.x, p.y)))
    const g = this.raeume[0].golem
    this.golem = { x: g.x, y: g.y, winkel: Math.PI / 2, zustand: 'schlaf', seit: 0, bis: 0, phase: 0, hp: GOLEM.leben, angriff: null, letzter: null, weg: 0, trefferT: -1e9, kreisPause: 0 }
    this.kristallAb = 700
  }

  /** Der Raum, in dem gekaempft wird */
  get aktuell(): Raum {
    return this.raeume[this.raumNr]
  }
  /** Sockel und Bannkreis des aktuellen Raums */
  get sockel(): Sockel[] {
    return this.aktuell.sockel
  }
  get kreis() {
    return this.aktuell.kreis
  }
  /** In welchem Raum liegt diese Zeile? (-1 = auf einem Tor zwischen zwei Raeumen) */
  raumBei(y: number) {
    return this.raeume.findIndex((r) => y > r.y0 && y < r.y1)
  }
  /** Liegt das Feld im aktuellen Raum (nicht auf den Randzeilen, nicht im Tor)? */
  imRaum(c: P, r = this.raumNr) {
    const ra = this.raeume[r]
    return !!ra && c.y > ra.y0 && c.y < ra.y1 && this.inside(c)
  }
  /** Ist hier ein geschlossenes Tor? */
  torZu(c: P) {
    return this.raeume.some((r) => r.tor && !r.tor.offen && r.tor.cells.some((t) => t.x === c.x && t.y === c.y))
  }

  /** Geschlossene Tore sind wie Wand */
  override gefahr(n: P, rest: P[] = this.body) {
    if (this.torZu(n)) return 'steintor' as const
    return super.gefahr(n, rest)
  }

  /** Mitte des Raums, den die Kamera zeigen soll (der, in dem der Kopf ist; auf dem Tor der, aus dem er kommt) */
  kameraZiel(kopf: Pf): Pf {
    let r = this.raumBei(Math.round(kopf.y))
    if (r < 0) r = this.raeume.findIndex((ra) => kopf.y >= ra.y0 - 1 && kopf.y <= ra.y1 + 1)
    const ra = this.raeume[Math.max(0, r)]
    return { x: this.w / 2, y: (ra.y0 + ra.y1 + 1) / 2 }
  }

  /** Boss-Level: es gibt keine Aepfel, gezaehlt werden die Treffer am Golem */
  override get uebrig() {
    return this.golem?.hp ?? GOLEM.leben
  }

  get kreisAktiv() {
    return this.raumAktiv(this.aktuell)
  }
  raumAktiv(r: Raum) {
    return r.sockel.length > 0 && r.sockel.every((s) => s.an)
  }
  get verwundbar() {
    return this.golem.zustand === 'gebannt'
  }
  /** Hoch in der Luft (Sprung): trifft niemanden und wird nicht gebannt */
  get fliegt() {
    const a = this.golem.angriff
    return (this.golem.zustand === 'sprung' || this.golem.zustand === 'wechsel') && a?.art === 'sprung' && this.time >= a.ab && this.time < a.landung
  }
  /** Wie hoch der Golem gerade springt (0 am Boden bis 1 ganz oben, fuer die Darstellung) */
  hoehe() {
    const a = this.golem.angriff
    if ((this.golem.zustand !== 'sprung' && this.golem.zustand !== 'wechsel') || a?.art !== 'sprung' || this.time < a.ab) return 0
    if (this.time < a.ab + GOLEM.sprungAuf) return (this.time - a.ab) / GOLEM.sprungAuf
    if (this.time < a.fall) return 1
    return Math.max(0, 1 - (this.time - a.fall) / Math.max(1, a.landung - a.fall))
  }

  /** Die 3 x 3 Felder unter dem Golem */
  golemFelder(x = this.golem.x, y = this.golem.y): P[] {
    const cx = Math.round(x)
    const cy = Math.round(y)
    const out: P[] = []
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) out.push({ x: cx + dx, y: cy + dy })
    return out
  }
  /** Passt der Golem hierhin (alle 9 Felder in seinem Raum, keins in einem Durchgang zu den Kammern)? */
  protected golemPasst(x: number, y: number) {
    return this.golemFelder(x, y).every((c) => this.imRaum(c) && !this.sperre.has(key(c.x, c.y)))
  }
  protected aufGolem(c: P) {
    const g = this.golem
    return Math.abs(c.x - Math.round(g.x)) <= 1 && Math.abs(c.y - Math.round(g.y)) <= 1
  }
  protected get kopf(): Pf {
    return this.body[0]
  }
  protected get f() {
    return GOLEM.warnFaktor[this.golem.phase] ?? 1
  }

  /* ================= Ablauf ================= */

  override update(dt: number) {
    const vorher = this.time
    super.update(dt)
    const d = this.time - vorher
    this.wellen = this.wellen.filter((w) => this.time - w.t < 1200)
    if (this.status !== 'play' || d <= 0) return
    this.bossTakt(d)
  }

  /** Nichts von der normalen Welt (keine Froesche, Gegner ...), nur der Golem */
  protected override umweltTakt() {}

  protected setze(z: GolemZustand, dauer: number) {
    const g = this.golem
    g.zustand = z
    g.seit = this.time
    g.bis = this.time + dauer
  }

  protected ereignis(was: GolemEreignis, p: Pf = this.golem) {
    this.emit({ type: 'golem', was, p: { x: p.x, y: p.y } })
  }

  protected bossTakt(dt: number) {
    const g = this.golem
    const t = this.time
    // Der Golem erwacht, sobald es losgeht
    if (g.zustand === 'schlaf') {
      this.setze('erwachen', GOLEM.erwachen)
      this.ereignis('erwachen')
    }
    switch (g.zustand) {
      case 'erwachen':
        this.drehen(winkelVon(g, this.kopf), dt, 1.5)
        if (t >= g.bis) this.laufenLos()
        break
      case 'laufen':
        this.laufen(dt)
        if (t >= g.bis) this.angreifen()
        break
      case 'stampfen':
        this.stampfenTakt()
        break
      case 'ansturm':
        this.ansturmTakt(dt)
        break
      case 'benommen':
        if (t >= g.bis) this.laufenLos()
        break
      case 'sprung':
        this.sprungTakt(dt)
        break
      case 'gebannt':
        if (t >= g.bis) {
          // Losgerissen: der Kreis braucht eine Weile, bis er wieder bannt
          g.kreisPause = t + GOLEM.kreisPause
          this.ereignis('frei')
          this.laufenLos()
        }
        break
      case 'getroffen':
        if (t >= g.bis) {
          if (g.hp <= 0 || this.raumNr >= this.raeume.length - 1) {
            this.setze('tot', GOLEM.tot)
            this.ereignis('tot')
          } else this.wechseln()
        }
        break
      case 'wechsel':
        this.sprungTakt(dt)
        break
      case 'wartet':
        // Erst wenn die Schlange im Raum ist, geht es weiter: Gebruell, dann Kampf
        this.drehen(winkelVon(g, this.kopf), dt, 1.5)
        if (this.imRaum(this.body[0])) {
          g.phase = Math.min(2, this.raumNr)
          this.setze('zorn', GOLEM.zorn)
          this.ereignis('zorn')
          this.wellen.push({ x: g.x, y: g.y, t, r: 5, art: 'zorn' })
          this.kristallAb = t + GOLEM.zorn + GOLEM.kristallPause * 0.5
        }
        break
      case 'zorn':
        if (t >= g.bis) this.laufenLos()
        break
      case 'tot':
        if (t >= g.bis) this.geschafft()
        return
    }
    this.brockenTakt()
    this.toreTakt()
    this.bannen()
    this.beruehrt()
    this.kristalleTakt()
  }

  /** Nach dem Treffer: das Tor nach oben geht auf, der Golem springt in den naechsten Raum */
  protected wechseln() {
    const g = this.golem
    const t = this.time
    const tor = this.aktuell.tor
    if (tor) {
      tor.offen = true
      tor.t = t
      this.ereignis('torAuf', tor.cells[1] ?? tor.cells[0])
    }
    this.raumNr++
    const ziel = this.aktuell.golem
    const ab = t + GOLEM.sprungDuck
    const fall = ab + GOLEM.wechselAuf + GOLEM.wechselFlug
    g.angriff = { art: 'sprung', ziel: { ...ziel }, r: GOLEM.sprungR, von: { x: g.x, y: g.y }, duck: t, ab, halt: ab, fall, landung: fall + GOLEM.sprungFall, fertig: false, combo: false, wechsel: true }
    this.setze('wechsel', 1e9)
    this.ereignis('wechsel')
    // Bis die Schlange im neuen Raum ist, gibt es keine Kristalle
    this.kristallAb = Infinity
  }

  /** Offene Tore hinter der Schlange gehen wieder zu, sobald sie ganz im neuen Raum ist */
  protected toreTakt() {
    for (const r of this.raeume) {
      const tor = r.tor
      if (!tor?.offen || r.nr >= this.raumNr) continue
      if (!this.body.every((b) => this.imRaum(b, this.raumNr))) continue
      tor.offen = false
      tor.t = this.time
      this.ereignis('torZu', tor.cells[1] ?? tor.cells[0])
    }
  }

  protected laufenLos() {
    const r = this.r.next()
    this.setze('laufen', (GOLEM.laufenMin + r * (GOLEM.laufenMax - GOLEM.laufenMin)) * this.f)
    this.golem.angriff = null
  }

  /** Blickrichtung weich zum Ziel drehen (rad je Sekunde) */
  protected drehen(ziel: number, dt: number, tempo = 3.4) {
    const g = this.golem
    const d = winkelDiff(g.winkel, ziel)
    const max = (tempo * dt) / 1000
    g.winkel += Math.max(-max, Math.min(max, d))
  }

  /** Schwer stapfend auf die Schlange zu: dreht sich, geht vor allem in Blickrichtung */
  protected laufen(dt: number) {
    const g = this.golem
    const ziel = winkelVon(g, this.kopf)
    this.drehen(ziel, dt)
    const v = (GOLEM.tempo[g.phase] * dt) / 1000
    const vor = Math.max(0.25, Math.cos(winkelDiff(g.winkel, ziel)))
    if (dist(g, this.kopf) < 1.2) return
    this.bewegen(Math.cos(g.winkel) * v * vor, Math.sin(g.winkel) * v * vor)
  }

  /** Verschieben, an der Wand entlang gleiten. Gibt false, wenn es gar nicht weitergeht */
  protected bewegen(dx: number, dy: number) {
    const g = this.golem
    if (this.golemPasst(g.x + dx, g.y + dy)) {
      g.x += dx
      g.y += dy
    } else if (this.golemPasst(g.x + dx, g.y)) g.x += dx
    else if (this.golemPasst(g.x, g.y + dy)) g.y += dy
    else return false
    g.weg += Math.hypot(dx, dy)
    return true
  }

  /** Naechste Attacke: nah eher Stampfen, weit eher Ansturm und Sprung, nie zweimal dieselbe */
  protected angreifen() {
    const g = this.golem
    const d = dist(g, this.kopf)
    const gewicht: Record<GolemAngriffArt, number> =
      d < 4.5 ? { stampfen: 5, ansturm: 1, sprung: 2 } : d < 9 ? { stampfen: 1, ansturm: 3, sprung: 3 } : { stampfen: 0, ansturm: 4, sprung: 4 }
    if (g.letzter) gewicht[g.letzter] = 0
    const arten = (Object.keys(gewicht) as GolemAngriffArt[]).filter((a) => gewicht[a] > 0)
    let z = this.r.next() * arten.reduce((s, a) => s + gewicht[a], 0)
    let art = arten[arten.length - 1]
    for (const a of arten) {
      z -= gewicht[a]
      if (z < 0) {
        art = a
        break
      }
    }
    this.starte(art)
  }

  starte(art: GolemAngriffArt, warn = 1) {
    const g = this.golem
    const t = this.time
    const f = this.f * warn
    g.letzter = art
    if (art === 'stampfen') {
      const dauer = GOLEM.stampfenWarn * f
      g.angriff = { art, r: GOLEM.stampfenR[g.phase], ab: t, schlag: t + dauer, fertig: false }
      this.setze('stampfen', dauer + GOLEM.stampfenNach)
    } else if (art === 'ansturm') {
      const dir0 = winkelVon(g, this.kopf)
      const dir = { x: Math.cos(dir0), y: Math.sin(dir0) }
      const nach = { x: g.x, y: g.y }
      // Bis zur Wand
      for (let i = 0; i < 200 && this.golemPasst(nach.x + dir.x * 0.25, nach.y + dir.y * 0.25); i++) {
        nach.x += dir.x * 0.25
        nach.y += dir.y * 0.25
      }
      const dauer = GOLEM.ansturmWarn * f
      g.angriff = { art, von: { x: g.x, y: g.y }, nach, dir, ab: t, los: t + dauer }
      g.winkel = dir0
      this.setze('ansturm', 1e9)
    } else {
      const duck = GOLEM.sprungDuck * Math.max(0.75, f)
      const ab = t + duck
      const halt = ab + GOLEM.sprungAuf + GOLEM.sprungZielen * this.f
      const fall = halt + GOLEM.sprungHalt * this.f
      g.angriff = { art, ziel: { ...this.kopf }, r: GOLEM.sprungR, von: { x: g.x, y: g.y }, duck: t, ab, halt, fall, landung: fall + GOLEM.sprungFall, fertig: false, combo: g.phase >= 2, wechsel: false }
      this.setze('sprung', 1e9)
    }
    this.ereignis('warnung')
  }

  /* ---------------- Attacken ---------------- */

  /** Felder im Kreis um m (Radius r) */
  kreisFelder(m: Pf, r: number): P[] {
    const out: P[] = []
    for (let y = Math.floor(m.y - r); y <= Math.ceil(m.y + r); y++)
      for (let x = Math.floor(m.x - r); x <= Math.ceil(m.x + r); x++) if (Math.hypot(x - m.x, y - m.y) <= r && this.imRaum({ x, y })) out.push({ x, y })
    return out
  }
  /** Streifen des Ansturms: 3 Felder breit von a nach b */
  streifenFelder(a: Pf, b: Pf): P[] {
    const out: P[] = []
    const lx = b.x - a.x
    const ly = b.y - a.y
    const l2 = Math.max(1e-6, lx * lx + ly * ly)
    for (let y = Math.floor(Math.min(a.y, b.y) - 2); y <= Math.ceil(Math.max(a.y, b.y) + 2); y++)
      for (let x = Math.floor(Math.min(a.x, b.x) - 2); x <= Math.ceil(Math.max(a.x, b.x) + 2); x++) {
        if (!this.imRaum({ x, y })) continue
        const u = Math.max(0, Math.min(1, ((x - a.x) * lx + (y - a.y) * ly) / l2))
        if (Math.hypot(x - (a.x + lx * u), y - (a.y + ly * u)) <= 1.5) out.push({ x, y })
      }
    return out
  }

  /** Liegen Kopf oder Hals in diesen Feldern? Dann ein Herz weniger (der Schwanz darf noch in der Flaeche haengen) */
  protected trifft(felder: P[], p: Pf) {
    const s = new Set(felder.map((c) => key(c.x, c.y)))
    if (this.body.slice(0, GOLEM.trifftGlieder).some((b) => s.has(key(b.x, b.y)))) this.schaden(p)
  }

  /** Die Schlange wird getroffen: ein Herz weniger, kurz geschuetzt; ohne Herzen vorbei */
  schaden(p: Pf = this.kopf) {
    if (this.time < this.schutzBis || this.status !== 'play') return false
    this.leben--
    this.schutzBis = this.time + GOLEM.schutz
    this.emit({ type: 'bossSchaden', leben: this.leben, p: { x: Math.round(p.x), y: Math.round(p.y) } })
    if (this.leben <= 0) this.die('steingolem')
    return true
  }

  protected stampfenTakt() {
    const g = this.golem
    const a = g.angriff
    if (a?.art !== 'stampfen') return this.laufenLos()
    if (!a.fertig && this.time >= a.schlag) {
      a.fertig = true
      this.ereignis('schlag')
      this.wellen.push({ x: g.x, y: g.y, t: this.time, r: a.r, art: 'stampfen' })
      this.trifft(this.kreisFelder(g, a.r), g)
    }
    if (this.time >= g.bis) this.laufenLos()
  }

  protected ansturmTakt(dt: number) {
    const g = this.golem
    const a = g.angriff
    if (a?.art !== 'ansturm') return this.laufenLos()
    if (this.time < a.los) return
    if (g.seit < a.los) {
      g.seit = a.los
      this.ereignis('ansturm')
    }
    // Rennt in kleinen Schritten (so trifft er auch bei hohem Tempo jedes Feld)
    let rest = (GOLEM.ansturmTempo * dt) / 1000
    while (rest > 0) {
      const s = Math.min(0.25, rest)
      rest -= s
      const weiter = dist(g, a.nach) > 0.05 && this.golemPasst(g.x + a.dir.x * s, g.y + a.dir.y * s)
      if (!weiter) return this.aufprall()
      g.x += a.dir.x * s
      g.y += a.dir.y * s
      g.weg += s
      if (this.body.slice(0, GOLEM.trifftGlieder).some((b) => this.aufGolem(b))) this.schaden(g)
      // Kann mitten im Lauf in den Bannkreis geraten
      if (this.bannen()) return
    }
  }

  /** An der Wand aufgeprallt: kurz benommen, von der Decke fallen Brocken */
  protected aufprall() {
    const g = this.golem
    this.ereignis('aufprall')
    this.wellen.push({ x: g.x + Math.cos(g.winkel) * 1.4, y: g.y + Math.sin(g.winkel) * 1.4, t: this.time, r: 2.5, art: 'aufprall' })
    const n = GOLEM.brocken[g.phase]
    const zu = new Set(this.golemFelder().map((c) => key(c.x, c.y)))
    const h = this.kopf
    for (let i = 0; i < n; i++) {
      // In der Naehe der Schlange (einer genau dort, wo sie hinfaehrt)
      const vor = i === 0 ? { x: h.x + STEP[this.dir].x * 4, y: h.y + STEP[this.dir].y * 4 } : { x: h.x + this.r.int(-5, 5), y: h.y + this.r.int(-5, 5) }
      let p: P | null = null
      for (let v = 0; v < 20 && !p; v++) {
        const c = v === 0 ? { x: Math.round(vor.x), y: Math.round(vor.y) } : { x: h.x + this.r.int(-6, 6), y: h.y + this.r.int(-6, 6) }
        if (this.imRaum(c) && !zu.has(key(c.x, c.y)) && !this.brocken.some((b) => Math.abs(b.p.x - c.x) + Math.abs(b.p.y - c.y) < 3)) p = c
      }
      if (p) this.brocken.push({ p, t: this.time, bis: this.time + GOLEM.brockenWarn + i * 180, fertig: false })
    }
    g.angriff = null
    this.setze('benommen', GOLEM.benommen)
  }

  /** Felder, die ein Brocken trifft (ein Plus) */
  brockenFelder(b: Brocken): P[] {
    return [b.p, ...DIRS.map((d) => ({ x: b.p.x + STEP[d].x, y: b.p.y + STEP[d].y }))].filter((c) => this.imRaum(c))
  }

  protected brockenTakt() {
    for (const b of this.brocken) {
      if (b.fertig || this.time < b.bis) continue
      b.fertig = true
      this.ereignis('stein', b.p)
      this.trifft(this.brockenFelder(b), b.p)
    }
    this.brocken = this.brocken.filter((b) => !b.fertig || this.time - b.bis < 900)
  }

  protected sprungTakt(dt: number) {
    const g = this.golem
    const a = g.angriff
    if (a?.art !== 'sprung') return this.laufenLos()
    const t = this.time
    if (t < a.ab) return this.drehen(a.wechsel ? -Math.PI / 2 : winkelVon(g, this.kopf), dt, 2)
    if (g.seit < a.ab) {
      g.seit = a.ab
      this.ereignis('sprung')
    }
    // Hoch oben: der Kreis folgt der Schlange (etwas traege), dann bleibt er stehen
    if (t < a.halt && !a.wechsel) {
      const v = (GOLEM.sprungZielTempo[g.phase] * dt) / 1000
      const d = dist(a.ziel, this.kopf)
      if (d > 1e-3) {
        const k = Math.min(1, v / d)
        a.ziel.x += (this.kopf.x - a.ziel.x) * k
        a.ziel.y += (this.kopf.y - a.ziel.y) * k
      }
    }
    if (!a.fertig && t >= a.landung) {
      a.fertig = true
      // Landet so nah am Kreis, wie er in die Arena passt
      const p = this.platzNahe(a.ziel)
      g.x = p.x
      g.y = p.y
      this.ereignis('landung')
      this.wellen.push({ x: a.ziel.x, y: a.ziel.y, t, r: a.r, art: 'landung' })
      if (a.wechsel) {
        // Im neuen Raum angekommen: dort wartet er auf die Schlange
        g.winkel = Math.PI / 2
        g.angriff = null
        this.setze('wartet', 1e9)
        return
      }
      g.winkel = winkelVon(g, this.kopf)
      this.trifft(this.kreisFelder(a.ziel, a.r), a.ziel)
      if (this.bannen()) return
      g.bis = t + GOLEM.sprungNach
    }
    if (a.fertig && t >= g.bis) {
      // Letzte Phase: gleich nach der Landung noch ein Stampfer
      if (a.combo) this.starte('stampfen', 0.7)
      else this.laufenLos()
    }
  }

  /** Naechste Stelle, an die der Golem passt */
  protected platzNahe(z: Pf): Pf {
    if (this.golemPasst(z.x, z.y)) return { x: z.x, y: z.y }
    let best: Pf = { x: this.golem.x, y: this.golem.y }
    let bd = Infinity
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (!this.golemPasst(x, y)) continue
        const d = Math.hypot(x - z.x, y - z.y)
        if (d < bd) {
          bd = d
          best = { x, y }
        }
      }
    return best
  }

  /* ---------------- Bannkreis, Treffer ---------------- */

  /** Steht der Golem im aktiven Bannkreis, wird er gebannt (verwundbar). Gibt true, wenn es gerade passiert ist */
  protected bannen() {
    const g = this.golem
    if (!this.kreisAktiv || this.time < g.kreisPause || this.fliegt) return false
    if (g.zustand === 'gebannt' || g.zustand === 'getroffen' || g.zustand === 'zorn' || g.zustand === 'tot' || g.zustand === 'erwachen' || g.zustand === 'wechsel' || g.zustand === 'wartet') return false
    if (dist(g, this.kreis.p) > this.kreis.r - 0.3) return false
    g.angriff = null
    g.x = g.x + (this.kreis.p.x - g.x) * 0.5
    g.y = g.y + (this.kreis.p.y - g.y) * 0.5
    if (!this.golemPasst(g.x, g.y)) {
      g.x = this.kreis.p.x
      g.y = this.kreis.p.y
    }
    this.setze('gebannt', GOLEM.bann[g.phase])
    this.ereignis('bann')
    return true
  }

  /** Beruehrt die Schlange den Golem? Gebannt: der Kopf trifft ihn. Sonst kostet die Beruehrung ein Herz */
  protected beruehrt() {
    const g = this.golem
    if (g.zustand === 'gebannt') {
      if (this.aufGolem(this.body[0])) this.golemTreffer()
      return
    }
    if (g.zustand === 'getroffen' || g.zustand === 'tot' || g.zustand === 'schlaf' || g.zustand === 'wechsel' || g.zustand === 'wartet' || this.fliegt) return
    if (this.body.slice(0, GOLEM.trifftGlieder).some((b) => this.aufGolem(b))) this.schaden(g)
  }

  /** Durch den gebannten Golem gefahren: der Treffer dieses Raums. Danach geht es in den naechsten */
  protected golemTreffer() {
    const g = this.golem
    g.hp--
    g.trefferT = this.time
    g.angriff = null
    this.schutzBis = Math.max(this.schutzBis, this.time + 1500)
    this.setze('getroffen', GOLEM.getroffen)
    this.ereignis('treffer')
    this.wellen.push({ x: g.x, y: g.y, t: this.time, r: 3, art: 'treffer' })
    // Belohnung: ein Herz zurueck
    this.leben = Math.min(GOLEM.herzen, this.leben + 1)
    this.kristalle = []
    this.traegt = []
    this.brocken = []
    this.kristallAb = Infinity
  }

  /* ---------------- Kristalle und Sockel ---------------- */

  /** Kopf auf einem Kristall: aufheben. Auf einem Sockel: passenden Kristall einsetzen. Durch den gebannten Golem: Treffer */
  protected override einsammeln(n: P) {
    super.einsammeln(n)
    const ki = this.kristalle.findIndex((k) => k.p.x === n.x && k.p.y === n.y)
    if (ki >= 0) {
      const k = this.kristalle.splice(ki, 1)[0]
      this.traegt.push(k.farbe)
      this.emit({ type: 'kristall', was: 'auf', p: { ...n }, farbe: k.farbe })
    }
    const s = this.sockel.find((o) => o.p.x === n.x && o.p.y === n.y)
    if (s && !s.an && this.traegt.includes(s.farbe)) {
      this.traegt.splice(this.traegt.indexOf(s.farbe), 1)
      s.an = true
      s.t = this.time
      this.emit({ type: 'kristall', was: 'sockel', p: { ...n }, farbe: s.farbe })
      if (this.kreisAktiv) this.emit({ type: 'kristall', was: 'alle', p: { ...this.kreis.p }, farbe: s.farbe })
    }
    if (this.golem?.zustand === 'gebannt' && this.aufGolem(n)) this.golemTreffer()
  }

  /** Liegt nichts mehr da: neue Kristalle (bis zu drei) fuer die dunklen Sockel des Raums, deren Kristall die Schlange
   *  noch nicht traegt. Hat der Raum feste Plaetze (Raum 3: in Kammern und Gassen), liegen sie dort, sonst irgendwo frei */
  protected kristalleTakt() {
    if (this.kristalle.length || this.time < this.kristallAb) return
    const z = this.golem.zustand
    if (z === 'getroffen' || z === 'zorn' || z === 'tot' || z === 'wechsel' || z === 'wartet') return
    const dunkel = this.r.shuffle(this.sockel.filter((s) => !s.an && !this.traegt.includes(s.farbe)).map((s) => s.farbe))
    if (!dunkel.length) return
    const zu = new Set<number>()
    for (const c of this.golemFelder()) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) zu.add(key(c.x + dx, c.y + dy))
    for (const s of this.sockel) zu.add(key(s.p.x, s.p.y))
    for (const b of this.body) zu.add(key(b.x, b.y))
    const h = this.kopf
    const feste = this.aktuell.plaetze
    const cand: P[] = feste.length
      ? feste.filter((c) => !zu.has(key(c.x, c.y)))
      : []
    if (!feste.length)
      for (let y = this.aktuell.y0 + 1; y < this.aktuell.y1; y++)
        for (let x = 0; x < this.w; x++) {
          const c = { x, y }
          if (!this.imRaum(c) || zu.has(key(x, y))) continue
          // Nicht direkt an der Wand, nicht im Bannkreis, nicht gleich vor dem Kopf
          if (DIRS.some((d) => !this.imRaum({ x: x + STEP[d].x, y: y + STEP[d].y }))) continue
          if (Math.hypot(x - this.kreis.p.x, y - this.kreis.p.y) <= this.kreis.r + 0.5) continue
          if (Math.abs(x - h.x) + Math.abs(y - h.y) < 4) continue
          cand.push(c)
        }
    for (const farbe of dunkel.slice(0, 3)) {
      const frei = cand.filter((c) => this.kristalle.every((k) => Math.abs(k.p.x - c.x) + Math.abs(k.p.y - c.y) >= 5))
      if (!frei.length) break
      const p = this.r.pick(frei)
      this.kristalle.push({ p, farbe, t: this.time })
      this.emit({ type: 'kristall', was: 'neu', p: { ...p }, farbe })
    }
  }
}

/** Das passende Spiel zur Mission: Boss-Level mit Golem, sonst die normale Mission */
export const missionSpiel = (m: MissionDef): MissionGame => (m.art === 'boss' ? new BossGame(m) : new MissionGame(m))
