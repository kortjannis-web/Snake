/**
 * Boss der Wiese (Mission 10): der Steingolem in seiner Arena. Statt Aepfeln gibt es Kristalle:
 * - Kristalle (drei auf einmal, sind sie aufgehoben, kommen die naechsten) einsammeln und zum Sockel der gleichen Farbe bringen (sechs Sockel rund um den Bannkreis)
 * - leuchten alle sechs, wird der Bannkreis in der Mitte aktiv: tritt der Golem hinein, ist er gebannt (er wird blaeulich,
 *   die Risse leuchten) und verwundbar. Dann fuehrt die Schlange durch ihn hindurch: ein Treffer
 * - nach jedem Treffer erlischen die Sockel, der Golem tobt und wird schneller (drei Phasen). Drei Treffer = besiegt
 * Der Golem stapft immer auf die Schlange zu und greift an, jede Attacke wird rot angekuendigt:
 * - Stampfen: Kreis um ihn herum
 * - Prankenhieb: dreimal hintereinander ein Kegel dorthin, wo die Schlange gerade ist
 * - Ansturm: ein langer Streifen bis zur Wand, er rennt hindurch, prallt auf und Felsbrocken fallen
 * - Sprung: er springt hoch, ein roter Kreis folgt der Schlange, bleibt stehen, dann landet er dort
 * Die Schlange hat drei Herzen: ein Treffer kostet eins (danach kurz geschuetzt), jeder Treffer am Golem gibt eins zurueck.
 * Es zaehlen Kopf und Hals (der Schwanz darf noch in der roten Flaeche haengen). Berge sind wie immer toedlich.
 */
import { key } from './game'
import { MissionGame } from './mission'
import type { MissionDef } from './missionen'
import { DIRS, STEP } from './rules'
import type { GolemEreignis, P } from './types'

export type GolemZustand = 'schlaf' | 'erwachen' | 'laufen' | 'stampfen' | 'kegel' | 'ansturm' | 'benommen' | 'sprung' | 'gebannt' | 'getroffen' | 'zorn' | 'tot'
export type GolemAngriffArt = 'stampfen' | 'kegel' | 'ansturm' | 'sprung'

/** Punkt in Feldern (Mitte eines Feldes = ganze Zahl), auch zwischen den Feldern */
export type Pf = { x: number; y: number }

export type GolemAngriff =
  /** Stampfen: Kreis mit Radius r um ihn, Einschlag bei `schlag` */
  | { art: 'stampfen'; r: number; ab: number; schlag: number; fertig: boolean }
  /** Prankenhieb nr (0 bis 2): Kegel in Richtung `winkel`, angekuendigt ab `ab`, Hieb bei `schlag` */
  | { art: 'kegel'; nr: number; winkel: number; ab: number; schlag: number; fertig: boolean }
  /** Ansturm von `von` bis `nach` (Wand), losrennen bei `los` */
  | { art: 'ansturm'; von: Pf; nach: Pf; dir: Pf; ab: number; los: number }
  /** Sprung: abheben bei `ab`, Kreis folgt der Schlange bis `halt`, faellt ab `fall`, landet bei `landung` */
  | { art: 'sprung'; ziel: Pf; r: number; von: Pf; duck: number; ab: number; halt: number; fall: number; landung: number; fertig: boolean; combo: boolean }

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
export type Welle = { x: number; y: number; t: number; r: number; art: 'stampfen' | 'landung' | 'aufprall' | 'kegel' | 'treffer' | 'zorn' }

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
  kegelWarn: 900,
  kegelFolge: 0.85,
  kegelPause: 260,
  kegelLaenge: 6.5,
  kegelHalb: 0.52,
  kegelNach: 550,
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
  sockel: Sockel[]
  kreis: { p: P; r: number }
  /** Herzen der Schlange */
  leben: number = GOLEM.herzen
  brocken: Brocken[] = []
  wellen: Welle[] = []
  /** Naechste Kristalle fruehestens ab */
  protected kristallAb = 0

  constructor(m: MissionDef) {
    super(m)
    const k = this.karte
    const g = k.golem ?? { x: Math.floor(k.w / 2), y: 4 }
    this.golem = { x: g.x, y: g.y, winkel: Math.PI / 2, zustand: 'schlaf', seit: 0, bis: 0, phase: 0, hp: GOLEM.leben, angriff: null, letzter: null, weg: 0, trefferT: -1e9, kreisPause: 0 }
    this.sockel = k.sockel.map((p, i) => ({ p: { ...p }, farbe: i, an: false, t: -1e9 }))
    this.kreis = { p: { ...(k.kreis ?? { x: Math.floor(k.w / 2), y: Math.floor(k.h / 2) }) }, r: GOLEM.bannR }
    this.kristallAb = 700
  }

  /** Boss-Level: es gibt keine Aepfel, gezaehlt werden die Treffer am Golem */
  override get uebrig() {
    return this.golem?.hp ?? GOLEM.leben
  }

  get kreisAktiv() {
    return this.sockel.length > 0 && this.sockel.every((s) => s.an)
  }
  get verwundbar() {
    return this.golem.zustand === 'gebannt'
  }
  /** Hoch in der Luft (Sprung): trifft niemanden und wird nicht gebannt */
  get fliegt() {
    const a = this.golem.angriff
    return this.golem.zustand === 'sprung' && a?.art === 'sprung' && this.time >= a.ab && this.time < a.landung
  }
  /** Wie hoch der Golem gerade springt (0 am Boden bis 1 ganz oben, fuer die Darstellung) */
  hoehe() {
    const a = this.golem.angriff
    if (this.golem.zustand !== 'sprung' || a?.art !== 'sprung' || this.time < a.ab) return 0
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
  /** Passt der Golem hierhin (alle 9 Felder in der Arena)? */
  protected golemPasst(x: number, y: number) {
    return this.golemFelder(x, y).every((c) => this.inside(c))
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
      case 'kegel':
        this.kegelTakt(dt)
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
          if (g.hp <= 0) {
            this.setze('tot', GOLEM.tot)
            this.ereignis('tot')
          } else {
            g.phase = Math.min(2, GOLEM.leben - g.hp)
            this.setze('zorn', GOLEM.zorn)
            this.ereignis('zorn')
            this.wellen.push({ x: g.x, y: g.y, t, r: 5, art: 'zorn' })
          }
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
    this.bannen()
    this.beruehrt()
    this.kristalleTakt()
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

  /** Naechste Attacke: nah eher Stampfen und Hiebe, weit eher Ansturm und Sprung, nie zweimal dieselbe */
  protected angreifen() {
    const g = this.golem
    const d = dist(g, this.kopf)
    const gewicht: Record<GolemAngriffArt, number> =
      d < 4.5 ? { stampfen: 5, kegel: 3, ansturm: 0.5, sprung: 1 } : d < 9 ? { stampfen: 1, kegel: 4, ansturm: 3, sprung: 3 } : { stampfen: 0, kegel: 1, ansturm: 4, sprung: 4 }
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
    } else if (art === 'kegel') {
      const dauer = GOLEM.kegelWarn * f
      g.angriff = { art, nr: 0, winkel: winkelVon(g, this.kopf), ab: t, schlag: t + dauer, fertig: false }
      this.setze('kegel', 1e9)
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
      g.angriff = { art, ziel: { ...this.kopf }, r: GOLEM.sprungR, von: { x: g.x, y: g.y }, duck: t, ab, halt, fall, landung: fall + GOLEM.sprungFall, fertig: false, combo: g.phase >= 2 }
      this.setze('sprung', 1e9)
    }
    this.ereignis('warnung')
  }

  /* ---------------- Attacken ---------------- */

  /** Felder im Kreis um m (Radius r) */
  kreisFelder(m: Pf, r: number): P[] {
    const out: P[] = []
    for (let y = Math.floor(m.y - r); y <= Math.ceil(m.y + r); y++)
      for (let x = Math.floor(m.x - r); x <= Math.ceil(m.x + r); x++) if (Math.hypot(x - m.x, y - m.y) <= r && this.inside({ x, y })) out.push({ x, y })
    return out
  }
  /** Felder im Kegel ab m in Richtung w */
  kegelFelder(m: Pf, w: number): P[] {
    const out: P[] = []
    const L = GOLEM.kegelLaenge
    for (let y = Math.floor(m.y - L); y <= Math.ceil(m.y + L); y++)
      for (let x = Math.floor(m.x - L); x <= Math.ceil(m.x + L); x++) {
        const d = Math.hypot(x - m.x, y - m.y)
        if (d < 1 || d > L || !this.inside({ x, y })) continue
        if (Math.abs(winkelDiff(w, Math.atan2(y - m.y, x - m.x))) <= GOLEM.kegelHalb) out.push({ x, y })
      }
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
        if (!this.inside({ x, y })) continue
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

  protected kegelTakt(dt: number) {
    const g = this.golem
    const a = g.angriff
    if (a?.art !== 'kegel') return this.laufenLos()
    this.drehen(a.winkel, dt, 6)
    if (!a.fertig && this.time >= a.schlag) {
      a.fertig = true
      this.ereignis('kegel')
      this.wellen.push({ x: g.x, y: g.y, t: this.time, r: GOLEM.kegelLaenge, art: 'kegel' })
      this.trifft(this.kegelFelder(g, a.winkel), g)
    }
    if (a.fertig && this.time >= a.schlag + GOLEM.kegelPause) {
      if (a.nr >= 2) {
        if (this.time >= a.schlag + GOLEM.kegelNach) this.laufenLos()
        return
      }
      // Naechster Hieb: wieder dorthin, wo die Schlange jetzt ist
      const t = this.time
      g.angriff = { art: 'kegel', nr: a.nr + 1, winkel: winkelVon(g, this.kopf), ab: t, schlag: t + GOLEM.kegelWarn * GOLEM.kegelFolge * this.f, fertig: false }
      this.ereignis('warnung')
    }
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
        if (this.inside(c) && !zu.has(key(c.x, c.y)) && !this.brocken.some((b) => Math.abs(b.p.x - c.x) + Math.abs(b.p.y - c.y) < 3)) p = c
      }
      if (p) this.brocken.push({ p, t: this.time, bis: this.time + GOLEM.brockenWarn + i * 180, fertig: false })
    }
    g.angriff = null
    this.setze('benommen', GOLEM.benommen)
  }

  /** Felder, die ein Brocken trifft (ein Plus) */
  brockenFelder(b: Brocken): P[] {
    return [b.p, ...DIRS.map((d) => ({ x: b.p.x + STEP[d].x, y: b.p.y + STEP[d].y }))].filter((c) => this.inside(c))
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
    if (t < a.ab) return this.drehen(winkelVon(g, this.kopf), dt, 2)
    if (g.seit < a.ab) {
      g.seit = a.ab
      this.ereignis('sprung')
    }
    // Hoch oben: der Kreis folgt der Schlange (etwas traege), dann bleibt er stehen
    if (t < a.halt) {
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
      g.winkel = winkelVon(g, this.kopf)
      this.ereignis('landung')
      this.wellen.push({ x: a.ziel.x, y: a.ziel.y, t, r: a.r, art: 'landung' })
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
    if (g.zustand === 'gebannt' || g.zustand === 'getroffen' || g.zustand === 'zorn' || g.zustand === 'tot' || g.zustand === 'erwachen') return false
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
    if (g.zustand === 'getroffen' || g.zustand === 'tot' || g.zustand === 'schlaf' || this.fliegt) return
    if (this.body.slice(0, GOLEM.trifftGlieder).some((b) => this.aufGolem(b))) this.schaden(g)
  }

  /** Durch den gebannten Golem gefahren: ein Treffer, die Sockel erloeschen */
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
    for (const s of this.sockel) s.an = false
    this.kristalle = []
    this.traegt = []
    this.brocken = []
    this.kristallAb = this.time + GOLEM.getroffen + GOLEM.zorn + GOLEM.kristallPause
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

  /** Liegt nichts mehr da: neue Kristalle (bis zu drei) fuer die dunklen Sockel, deren Kristall die Schlange noch nicht traegt */
  protected kristalleTakt() {
    if (this.kristalle.length || this.time < this.kristallAb) return
    const z = this.golem.zustand
    if (z === 'getroffen' || z === 'zorn' || z === 'tot') return
    const dunkel = this.r.shuffle(this.sockel.filter((s) => !s.an && !this.traegt.includes(s.farbe)).map((s) => s.farbe))
    if (!dunkel.length) return
    const zu = new Set<number>()
    for (const c of this.golemFelder()) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) zu.add(key(c.x + dx, c.y + dy))
    for (const s of this.sockel) zu.add(key(s.p.x, s.p.y))
    for (const b of this.body) zu.add(key(b.x, b.y))
    const h = this.kopf
    const cand: P[] = []
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const c = { x, y }
        if (!this.inside(c) || zu.has(key(x, y))) continue
        // Nicht direkt an der Wand, nicht im Bannkreis, nicht gleich vor dem Kopf
        if (DIRS.some((d) => !this.inside({ x: x + STEP[d].x, y: y + STEP[d].y }))) continue
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
