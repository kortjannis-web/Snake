/**
 * Der Kampf gegen den Ent, unabhaengig davon, wo er stattfindet: auf der Waldlichtung der Mission 20 (EntBossGame,
 * drei Phasen) oder einmal auf einer Lichtung im freien Spiel (Wiese, Level 100, eine Phase, ein Treffer).
 * Der Ent steht verwurzelt am oberen Rand der Lichtung und dreht sich nur, er ist ein Fernkaempfer. Jede Attacke wird
 * rot angekuendigt:
 * - Wurzelbruch: ganze Zeilen oder Spalten, dann schiessen Wurzeln hindurch (spaeter mehrere, auch als Kreuz)
 * - Wurzelstoss: ein Streifen (3 breit) von ihm zum Kopf, die Wurzeln wachsen bis zum Rand
 * - Dornenfaecher: 5 bis 7 Strahlen faecherfoermig von ihm aus, dazwischen Luecken
 * - Eichelmoerser: Schatten an 3 Stellen nahe der Schlange (eine dort, wo sie hinfaehrt), dann schlagen Eicheln ein (Plus)
 * - Rankenwand (ab Phase 2): fuer ein paar Sekunden teilen Rankenreihen die Lichtung (wie Wand, mit einer Luecke)
 * - Setzlinge (ab Phase 2): kleine Baumwesen kommen langsam auf den Kopf zu
 * - Laubsturm (ab Phase 2): Wind treibt Blaetter uebers Bild und loescht ein brennendes Feuer
 * Lagerfeuer: in der Mitte glueht eine Glutschale. Wer hindurchfaehrt, traegt eine Flamme und zuendet damit einen
 * Holzstapel an (er brennt 15 s).
 * - Phase 1: brennen alle Stapel gleichzeitig, faengt seine Rinde Feuer und der Herzknoten liegt frei: durch ihn fahren = Treffer
 * - ab Phase 2: schiesst er eine Wurzel durch ein brennendes Feuer, faengt sie Feuer, die Flamme laeuft zu ihm zurueck: Treffer.
 *   Man stellt sich also so hin, dass ein Feuer zwischen einem selbst und ihm liegt (das Feuer haelt die Wurzel auch auf)
 * Ab Phase 2 wandert er zwischen alten Baumstuempfen, ab Phase 3 waechst die Lichtung von aussen zu.
 * Die Schlange hat drei Herzen, nur der Kopf zaehlt. Jeder Treffer am Ent gibt eins zurueck.
 * Was der Kampf vom Spiel braucht, kommt wie beim Golem ueber den `KampfWirt`.
 */
import type { KampfWirt, Pf } from './golemkampf'
import { DIRS, STEP } from './rules'
import type { EntEreignis, P } from './types'

export type EntZustand = 'schlaf' | 'erwachen' | 'bereit' | 'brennt' | 'getroffen' | 'abtauchen' | 'auftauchen' | 'zorn' | 'tot'
export type EntAngriffArt = 'wurzelbruch' | 'wurzelstoss' | 'dornen' | 'eicheln' | 'ranken' | 'setzlinge' | 'sturm'

/** Alle Zeiten in ms, Tempo in Feldern je Sekunde. Je Phase: dichtere Linien, kuerzere Warnungen */
export const ENT = {
  leben: 3,
  herzen: 3,
  /** Nach einem Treffer am Spieler so lange geschuetzt */
  schutz: 1900,
  warnFaktor: [1, 0.85, 0.72],
  erwachen: 2600,
  /** Pause nach einer Attacke, bis die naechste angekuendigt wird */
  pause: [1500, 1200, 950],
  /** Wurzelbruch: so viele Linien je Phase */
  linien: [1, 2, 3],
  linienWarn: 1350,
  wurzelTempo: 34,
  /** So lange bleibt jedes Feld einer Wurzel gefaehrlich, nachdem sie es erreicht hat */
  wurzelBleibt: 650,
  stossWarn: 1150,
  stossTempo: 24,
  dornen: [5, 6, 7],
  dornenWarn: 1250,
  dornenTempo: 18,
  dornenBleibt: 260,
  /** Oeffnung des Faechers (Bogenmass) */
  faecher: [1.7, 1.95, 2.2],
  eicheln: [3, 3, 4],
  eichelWarn: 1150,
  rankenWarn: 1000,
  rankenWachsen: 800,
  rankenDauer: 4200,
  rankenReihen: [0, 1, 2],
  setzlinge: [0, 2, 3],
  setzlingTakt: 720,
  setzlingLebt: 12000,
  sturmWarn: 900,
  sturmDauer: 4200,
  /** So lange brennt ein Holzstapel */
  feuerBrennt: 15000,
  /** Rueckfeuer: so schnell laeuft die Flamme die Wurzel zurueck (Felder je Sekunde) */
  rueckTempo: 22,
  /** Phase 1: so lange ist der Herzknoten frei */
  brennt: [7000, 6000, 5200],
  getroffen: 1300,
  zorn: 1700,
  abtauchen: 900,
  auftauchen: 900,
  /** Ab Phase 2: nach so vielen Attacken wandert er zum naechsten Stumpf */
  wandernNach: 2,
  /** Phase 3: so oft waechst die Lichtung ein Feld weiter zu (hoechstens zuwachsenMax), Vorwarnung */
  zuwachsen: 5200,
  zuwachsenWarn: 1400,
  zuwachsenMax: 3,
  tot: 3600,
} as const

/** Linie, die von ihrem Ursprung aus waechst: Wurzel, Dorn oder Ranke. `d` = Abstand jedes Feldes zum Ursprung */
export type EntLinie = {
  art: 'wurzel' | 'dorn' | 'ranke'
  cells: P[]
  d: number[]
  /** Ursprung (fuer die Darstellung und das Rueckfeuer) */
  von: Pf
  /** Warnung ab, waechst ab */
  ab: number
  los: number
  tempo: number
  /** So lange bleibt ein Feld gefaehrlich (Ranke: bis `weg`) */
  bleibt: number
  /** An einem brennenden Feuer gestoppt: so weit kommt sie (Abstand), Feuer dort */
  stop: number
  feuer: P | null
  /** Ranke: zieht sich ab hier zurueck */
  weg: number
}
/** Eichel des Moersers: Schatten bis `bis`, dann Einschlag (Plus) */
export type Eichel = { p: P; t: number; bis: number; fertig: boolean }
export type Setzling = { p: P; from: P; t: number; schrittT: number; next: number; bis: number; weg: number }
/** Laubsturm: Wind ab `los` bis `bis`, `richtung` +1 nach rechts, -1 nach links */
export type Sturm = { ab: number; los: number; bis: number; richtung: 1 | -1; geloescht: boolean }
/** Holzstapel: `ab` = ab welcher Phase er dazugehoert, brennt bis `bis` */
export type Feuer = { p: P; ab: number; an: boolean; bis: number; t: number; ausT: number }
/** Flamme, die eine brennende Wurzel zum Ent zuruecklaeuft: Pfad von der Feuerstelle zu ihm */
export type Rueckfeuer = { pfad: Pf[]; t: number; ankunft: number }
/** Wo die Lichtung zuwaechst: gruene Sprosse (Warnung) bis `bis`, dann Dickicht */
export type Spross = { p: P; t: number; bis: number }

export type Ent = {
  x: number
  y: number
  /** Blickrichtung (Bogenmass, 0 = rechts) */
  winkel: number
  zustand: EntZustand
  seit: number
  bis: number
  /** 0, 1, 2 */
  phase: number
  hp: number
  letzter: EntAngriffArt | null
  /** Attacken seit dem letzten Wandern */
  angriffe: number
  /** Auf welchem Stumpf er steht */
  platz: number
  trefferT: number
}

/** Die Lichtung: welche Felder dazugehoeren, Glutschale, Holzstapel, Stuempfe (der erste: dort steht der Ent am Anfang) */
export type Lichtung = {
  felder: P[]
  schale: P
  feuer: { p: P; ab: number }[]
  stuempfe: P[]
}

const dist = (a: Pf, b: Pf) => Math.hypot(a.x - b.x, a.y - b.y)
const winkelVon = (a: Pf, b: Pf) => Math.atan2(b.y - a.y, b.x - a.x)
const same = (a: P, b: P) => a.x === b.x && a.y === b.y
const manhattan = (a: P, b: P) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
/** Wie key in game.ts */
const key = (x: number, y: number) => (y + 1) * 4096 + (x + 1)
const winkelDiff = (a: number, b: number) => {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

export class Entkampf {
  ent: Ent
  /** Herzen der Schlange */
  leben: number = ENT.herzen
  /** So viele Treffer braucht der Ent (Mission 3, frei 1) */
  readonly entLeben: number
  /** Traegt die Schlange eine Flamme aus der Glutschale? (seit wann) */
  traegt = false
  flammeT = -1e9
  schale: P
  feuer: Feuer[]
  stuempfe: P[]
  linien: EntLinie[] = []
  eicheln: Eichel[] = []
  setzlinge: Setzling[] = []
  sturm: Sturm | null = null
  rueckfeuer: Rueckfeuer | null = null
  /** Phase 3: so tief ist die Lichtung von aussen zugewachsen, naechstes Wachsen ab */
  zuwachs = 0
  zuwachsNext = Infinity
  sprosse: Spross[] = []
  /** Felder der Lichtung als Schluessel, ihr Abstand zum Rand (1 = ganz aussen), zugewachsene Felder */
  protected felder: Set<number>
  protected tiefe = new Map<number, number>()
  dickicht = new Set<number>()
  /** Grenzen der Lichtung (fuer die Kamera und die Linien) */
  readonly box: { x0: number; y0: number; x1: number; y1: number }
  protected readonly wirt!: KampfWirt

  constructor(wirt: KampfWirt, l: Lichtung, o: { leben?: number } = {}) {
    Object.defineProperty(this, 'wirt', { value: wirt, enumerable: false })
    this.entLeben = o.leben ?? ENT.leben
    this.felder = new Set(l.felder.map((p) => key(p.x, p.y)))
    this.schale = { ...l.schale }
    this.feuer = l.feuer.map((f) => ({ p: { ...f.p }, ab: f.ab, an: false, bis: 0, t: -1e9, ausT: -1e9 }))
    this.stuempfe = l.stuempfe.map((p) => ({ ...p }))
    const xs = l.felder.map((p) => p.x)
    const ys = l.felder.map((p) => p.y)
    this.box = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }
    this.tiefeRechnen(l.felder)
    const s = this.stuempfe[0]
    this.ent = { x: s.x, y: s.y, winkel: 0, zustand: 'schlaf', seit: 0, bis: 0, phase: 0, hp: this.entLeben, letzter: null, angriffe: 0, platz: 0, trefferT: -1e9 }
    this.ent.winkel = winkelVon(s, this.mitte)
  }

  get time() {
    return this.wirt.time
  }
  get body() {
    return this.wirt.body
  }
  get status() {
    return this.wirt.status
  }
  get schutzBis() {
    return this.wirt.schutzBis
  }
  set schutzBis(v: number) {
    this.wirt.schutzBis = v
  }
  protected get r() {
    return this.wirt.r
  }
  protected get kopf(): P {
    return this.body[0]
  }
  /** Mitte der Lichtung */
  get mitte(): Pf {
    return { x: (this.box.x0 + this.box.x1) / 2, y: (this.box.y0 + this.box.y1) / 2 }
  }
  protected get f() {
    return ENT.warnFaktor[this.ent.phase] ?? 1
  }
  /** Holzstapel, die in dieser Phase dazugehoeren */
  get aktiveFeuer() {
    return this.feuer.filter((f) => f.ab <= this.ent.phase)
  }
  /** Phase 1: liegt der Herzknoten frei (Rinde brennt)? */
  get verwundbar() {
    return this.ent.zustand === 'brennt'
  }
  /** Unter der Erde (wandert): trifft niemanden, wird nicht getroffen */
  get versunken() {
    return this.ent.zustand === 'abtauchen' || this.ent.zustand === 'auftauchen'
  }
  /** Wie weit er gerade aus dem Boden ragt (0 = ganz versunken, 1 = steht), fuer die Darstellung */
  hoehe() {
    const e = this.ent
    if (e.zustand === 'abtauchen') return Math.max(0, 1 - (this.time - e.seit) / ENT.abtauchen)
    if (e.zustand === 'auftauchen') return Math.min(1, (this.time - e.seit) / ENT.auftauchen)
    return 1
  }

  /** Gehoert das Feld zur Lichtung (und ist frei, nicht zugewachsen)? */
  imLichtung(c: P) {
    const k = key(c.x, c.y)
    return this.felder.has(k) && !this.dickicht.has(k) && this.wirt.inside(c) && this.wirt.frei(c)
  }
  /** Ist hier gerade eine Wand (Rankenwand, Dickicht, ein alter Stumpf, auf dem der Ent nicht steht)? */
  istWand(c: P) {
    if (this.dickicht.has(key(c.x, c.y))) return true
    if (this.stuempfe.some((s, i) => i !== this.ent.platz && same(s, c))) return true
    const t = this.time
    for (const l of this.linien) {
      if (l.art !== 'ranke' || t < l.los || t >= l.weg) continue
      const n = ((t - l.los) / 1000) * l.tempo
      for (let i = 0; i < l.cells.length; i++) if (l.d[i] <= n && same(l.cells[i], c)) return true
    }
    return false
  }
  /** Direkt vor dem Kopf (das Feld, auf das er gleich faehrt, oder daneben): dort waechst keine Wand */
  protected vorDemKopf(c: P) {
    const h = this.kopf
    const d = STEP[this.wirt.dir]
    return manhattan(c, h) <= 1 || same(c, { x: h.x + d.x * 2, y: h.y + d.y * 2 })
  }

  /** Die 3 x 3 Felder des Stamms */
  entFelder(x = this.ent.x, y = this.ent.y): P[] {
    const out: P[] = []
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) out.push({ x: x + dx, y: y + dy })
    return out
  }
  aufEnt(c: P) {
    return Math.abs(c.x - this.ent.x) <= 1 && Math.abs(c.y - this.ent.y) <= 1
  }
  /** Randfelder der Lichtung (fuer die Darstellung: dort wachsen Farne) */
  randFelder(): P[] {
    const out: P[] = []
    for (const [k, d] of this.tiefe) if (d === 1 && !this.dickicht.has(k)) out.push({ x: (k % 4096) - 1, y: Math.floor(k / 4096) - 1 })
    return out
  }
  /** Mitte der Lichtung fuer die Kamera */
  kameraZiel(): Pf {
    return { x: (this.box.x0 + this.box.x1 + 1) / 2, y: (this.box.y0 + this.box.y1 + 1) / 2 }
  }

  /** Abstand jedes Feldes zum Rand der Lichtung (fuer das Zuwachsen von aussen) */
  protected tiefeRechnen(felder: P[]) {
    let rand: P[] = felder.filter((c) => DIRS.some((d) => !this.felder.has(key(c.x + STEP[d].x, c.y + STEP[d].y))))
    rand.forEach((c) => this.tiefe.set(key(c.x, c.y), 1))
    for (let t = 2; rand.length && t < 50; t++) {
      const neu: P[] = []
      for (const c of rand)
        for (const d of DIRS) {
          const n = { x: c.x + STEP[d].x, y: c.y + STEP[d].y }
          const k = key(n.x, n.y)
          if (!this.felder.has(k) || this.tiefe.has(k)) continue
          this.tiefe.set(k, t)
          neu.push(n)
        }
      rand = neu
    }
  }

  /** Die Karte ist gewachsen und hat sich verschoben (freies Spiel): alles um dx, dy mitnehmen */
  verschieben(dx: number, dy: number) {
    const mv = (p: Pf) => {
      p.x += dx
      p.y += dy
    }
    const umKey = (s: Set<number>) => new Set([...s].map((k) => k + dy * 4096 + dx))
    mv(this.ent)
    mv(this.schale)
    this.feuer.forEach((f) => mv(f.p))
    this.stuempfe.forEach(mv)
    for (const l of this.linien) {
      l.cells.forEach(mv)
      mv(l.von)
      if (l.feuer) mv(l.feuer)
    }
    this.eicheln.forEach((e) => mv(e.p))
    this.setzlinge.forEach((s) => {
      mv(s.p)
      mv(s.from)
    })
    this.rueckfeuer?.pfad.forEach(mv)
    this.sprosse.forEach((s) => mv(s.p))
    this.felder = umKey(this.felder)
    this.dickicht = umKey(this.dickicht)
    this.tiefe = new Map([...this.tiefe].map(([k, v]) => [k + dy * 4096 + dx, v]))
    const b = this.box as { x0: number; y0: number; x1: number; y1: number }
    b.x0 += dx
    b.x1 += dx
    b.y0 += dy
    b.y1 += dy
  }

  /* ================= Ablauf ================= */

  protected setze(z: EntZustand, dauer: number) {
    const e = this.ent
    e.zustand = z
    e.seit = this.time
    e.bis = this.time + dauer
  }

  protected ereignis(was: EntEreignis, p: Pf = this.ent) {
    this.wirt.emit({ type: 'ent', was, p: { x: Math.round(p.x), y: Math.round(p.y) } })
  }

  /** Ein Bild weiter (d = vergangene Spielzeit in ms) */
  update(d: number) {
    if (this.status !== 'play' || d <= 0) return
    const e = this.ent
    const t = this.time
    if (e.zustand === 'schlaf') {
      this.setze('erwachen', ENT.erwachen)
      this.ereignis('erwachen')
    }
    // Er dreht sich nur (bleibt verwurzelt): immer zum Kopf
    if (!this.versunken && e.zustand !== 'tot') this.drehen(winkelVon(e, this.kopf), d)
    switch (e.zustand) {
      case 'erwachen':
      case 'zorn':
        if (t >= e.bis) this.weiter()
        break
      case 'bereit':
        if (t >= e.bis) this.weiter()
        break
      case 'brennt':
        if (t >= e.bis) {
          // Die Rinde ist ausgebrannt, ohne dass er getroffen wurde
          this.ereignis('zorn')
          this.setze('zorn', ENT.zorn * 0.6)
        }
        break
      case 'getroffen':
        if (t >= e.bis) {
          if (e.hp <= 0) {
            this.setze('tot', ENT.tot)
            this.ereignis('tot')
          } else {
            e.phase = Math.min(2, this.entLeben - e.hp)
            // Neue Phase: gleich nach dem Gebruell wandert er zum ersten Mal
            e.angriffe = ENT.wandernNach
            this.setze('zorn', ENT.zorn)
            this.ereignis('zorn')
            if (e.phase >= 2 && this.zuwachsNext === Infinity) this.zuwachsNext = t + ENT.zorn + 1500
          }
        }
        break
      case 'abtauchen':
        if (t >= e.bis) this.umziehen()
        break
      case 'auftauchen':
        if (t >= e.bis) this.setze('bereit', ENT.pause[e.phase] * 0.5)
        break
      case 'tot':
        if (t >= e.bis) this.wirt.besiegt()
        return
    }
    this.feuerTakt()
    this.linienTakt()
    this.eichelnTakt()
    this.setzlingeTakt()
    this.sturmTakt()
    this.rueckfeuerTakt()
    this.zuwachsTakt()
    this.beruehrt()
  }

  protected drehen(ziel: number, dt: number) {
    const e = this.ent
    const dw = winkelDiff(e.winkel, ziel)
    const max = (2.4 * dt) / 1000
    e.winkel += Math.max(-max, Math.min(max, dw))
  }

  /** Naechste Attacke, ab Phase 2 nach ein paar Attacken erst zum naechsten Stumpf */
  protected weiter() {
    const e = this.ent
    if (e.phase >= 1 && e.angriffe >= ENT.wandernNach && this.stuempfe.length > 1) {
      e.angriffe = 0
      this.setze('abtauchen', ENT.abtauchen)
      this.ereignis('abtauchen')
      return
    }
    this.angreifen()
  }

  /** Unter der Erde zu einem anderen Stumpf (nicht dorthin, wo der Kopf gerade ist) */
  protected umziehen() {
    const e = this.ent
    const h = this.kopf
    const frei = this.stuempfe
      .map((p, i) => ({ p, i }))
      .filter(({ p, i }) => i !== e.platz && !this.entFelder(p.x, p.y).some((c) => this.body.slice(0, 4).some((b) => manhattan(b, c) <= 1)) && dist(p, h) > 3.5)
    const ziel = frei.length ? this.r.pick(frei) : { p: this.stuempfe[e.platz], i: e.platz }
    e.platz = ziel.i
    e.x = ziel.p.x
    e.y = ziel.p.y
    e.winkel = winkelVon(e, h)
    this.setze('auftauchen', ENT.auftauchen)
    this.ereignis('auftauchen')
  }

  protected angreifen() {
    const e = this.ent
    const ph = e.phase
    const frei = this.entLeben === 1
    const brennt = this.feuer.some((f) => f.an)
    const gewicht: Record<EntAngriffArt, number> = {
      wurzelbruch: ph === 0 ? 3 : 2,
      wurzelstoss: ph === 0 ? 1.5 : 3,
      dornen: 2,
      eicheln: 2,
      ranken: !frei && ph >= 1 ? 1.2 : 0,
      setzlinge: !frei && ph >= 1 && this.setzlinge.length < 2 ? 1 : 0,
      sturm: !frei && ph >= 1 && brennt && !this.sturm ? 0.8 : 0,
    }
    if (e.letzter) gewicht[e.letzter] = 0
    const arten = (Object.keys(gewicht) as EntAngriffArt[]).filter((a) => gewicht[a] > 0)
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

  /** Attacke ankuendigen (die Linien, Schatten und Ranken warnen selbst, bis es losgeht) */
  starte(art: EntAngriffArt, warn = 1) {
    const e = this.ent
    const t = this.time
    const f = this.f * warn
    e.letzter = art
    e.angriffe++
    let dauer = 0
    if (art === 'wurzelbruch') {
      dauer = ENT.linienWarn * f
      this.wurzelbruch(t + dauer)
    } else if (art === 'wurzelstoss') {
      dauer = ENT.stossWarn * f
      this.wurzelstoss(t + dauer)
    } else if (art === 'dornen') {
      dauer = ENT.dornenWarn * f
      this.dornen(t + dauer)
    } else if (art === 'eicheln') {
      dauer = ENT.eichelWarn * f
      this.moerser(t + dauer)
    } else if (art === 'ranken') {
      dauer = ENT.rankenWarn * f
      this.ranken(t + dauer)
    } else if (art === 'setzlinge') {
      dauer = 600
      this.setzlingeSetzen()
    } else {
      dauer = ENT.sturmWarn * f
      this.sturm = { ab: t, los: t + dauer, bis: t + dauer + ENT.sturmDauer, richtung: this.r.next() < 0.5 ? 1 : -1, geloescht: false }
    }
    this.setze('bereit', dauer + ENT.pause[e.phase])
    this.ereignis(art === 'sturm' ? 'sturm' : art === 'setzlinge' ? 'setzling' : 'warnung')
  }

  /* ---------------- Linien ---------------- */

  /** Linie aus Feldern (nach Abstand zum Ursprung geordnet) */
  protected linie(art: EntLinie['art'], felder: P[], von: Pf, los: number, tempo: number, bleibt: number, dOf: (c: P) => number): EntLinie | null {
    const cells = felder.filter((c) => this.imLichtung(c) && !this.aufEnt(c)).sort((a, b) => dOf(a) - dOf(b))
    if (!cells.length) return null
    const l: EntLinie = { art, cells, d: cells.map(dOf), von: { ...von }, ab: this.time, los, tempo, bleibt, stop: Infinity, feuer: null, weg: Infinity }
    this.linien.push(l)
    return l
  }

  /** Ganze Zeilen oder Spalten (eine durch den Kopf, weitere mit Abstand; ab Phase 3 auch als Kreuz durch den Kopf).
   *  Die Wurzeln kommen von der Seite des Ents */
  protected wurzelbruch(los: number) {
    const e = this.ent
    const h = this.kopf
    const n = ENT.linien[e.phase] ?? 1
    const b = this.box
    const reihen: { quer: boolean; i: number }[] = []
    const kreuz = e.phase >= 2 && this.r.next() < 0.5
    if (kreuz) reihen.push({ quer: true, i: h.y }, { quer: false, i: h.x })
    else reihen.push({ quer: this.r.next() < 0.5, i: 0 })
    if (!kreuz) reihen[0].i = reihen[0].quer ? h.y : h.x
    for (let v = 0; reihen.length < n && v < 30; v++) {
      const quer = this.r.next() < 0.5
      const i = quer ? this.r.int(b.y0, b.y1) : this.r.int(b.x0, b.x1)
      if (reihen.some((o) => o.quer === quer && Math.abs(o.i - i) < 3)) continue
      reihen.push({ quer, i })
    }
    for (const r of reihen) {
      const felder: P[] = []
      if (r.quer) for (let x = b.x0; x <= b.x1; x++) felder.push({ x, y: r.i })
      else for (let y = b.y0; y <= b.y1; y++) felder.push({ x: r.i, y })
      // Von der Seite, auf der der Ent steht
      const vonVorn = r.quer ? e.x <= (b.x0 + b.x1) / 2 : e.y <= (b.y0 + b.y1) / 2
      const von = r.quer ? { x: vonVorn ? b.x0 - 1 : b.x1 + 1, y: r.i } : { x: r.i, y: vonVorn ? b.y0 - 1 : b.y1 + 1 }
      this.linie('wurzel', felder, von, los, ENT.wurzelTempo, ENT.wurzelBleibt, (c) => Math.abs(c.x - von.x) + Math.abs(c.y - von.y))
    }
  }

  /** Felder eines Strahls vom Ent aus (Breite: so viele Felder zur Seite) bis zum Rand der Lichtung */
  protected strahl(winkel: number, breite: number): { felder: P[]; dOf: (c: P) => number } {
    const e = this.ent
    const dx = Math.cos(winkel)
    const dy = Math.sin(winkel)
    const b = this.box
    const felder: P[] = []
    for (let y = b.y0; y <= b.y1; y++)
      for (let x = b.x0; x <= b.x1; x++) {
        const vor = (x - e.x) * dx + (y - e.y) * dy
        if (vor < 1.2) continue
        const seit = Math.abs((x - e.x) * dy - (y - e.y) * dx)
        if (seit <= breite + 0.5) felder.push({ x, y })
      }
    return { felder, dOf: (c) => (c.x - e.x) * dx + (c.y - e.y) * dy }
  }

  /** Wurzelstoss: 3 breit von ihm zum Kopf */
  protected wurzelstoss(los: number) {
    const e = this.ent
    const s = this.strahl(winkelVon(e, this.kopf), 1)
    this.linie('wurzel', s.felder, e, los, ENT.stossTempo, ENT.wurzelBleibt, s.dOf)
  }

  /** Dornenfaecher: 5 bis 7 Strahlen, der Faecher zeigt auf den Kopf (mal liegt er in einer Luecke, mal nicht) */
  protected dornen(los: number) {
    const e = this.ent
    const n = ENT.dornen[e.phase] ?? 5
    const auf = ENT.faecher[e.phase] ?? 1.7
    const schritt = auf / (n - 1)
    const mitte = winkelVon(e, this.kopf) + (this.r.next() < 0.5 ? schritt / 2 : 0) * (this.r.next() < 0.5 ? 1 : -1)
    for (let i = 0; i < n; i++) {
      const w = mitte + (i - (n - 1) / 2) * schritt
      const s = this.strahl(w, 0)
      this.linie('dorn', s.felder, e, los, ENT.dornenTempo, ENT.dornenBleibt, s.dOf)
    }
  }

  /** Rankenwand: 1 bis 2 Reihen quer durch die Lichtung mit einer Luecke (3 Felder), nie auf der Schlange */
  protected ranken(los: number) {
    const e = this.ent
    const h = this.kopf
    const n = Math.max(1, ENT.rankenReihen[e.phase] ?? 1)
    const b = this.box
    // Quer zur Achse zwischen Ent und Kopf, damit der Weg zum Feuer laenger wird
    const quer = Math.abs(h.y - e.y) >= Math.abs(h.x - e.x)
    const belegt = new Set(this.body.map((c) => key(c.x, c.y)))
    const gewaehlt: number[] = []
    for (let v = 0; gewaehlt.length < n && v < 40; v++) {
      const i = quer ? this.r.int(b.y0 + 2, b.y1 - 2) : this.r.int(b.x0 + 2, b.x1 - 2)
      if (gewaehlt.some((o) => Math.abs(o - i) < 4)) continue
      if (Math.abs(i - (quer ? h.y : h.x)) < 3) continue
      if (Math.abs(i - (quer ? e.y : e.x)) < 3) continue
      gewaehlt.push(i)
    }
    for (const i of gewaehlt) {
      const alle: P[] = []
      if (quer) for (let x = b.x0; x <= b.x1; x++) alle.push({ x, y: i })
      else for (let y = b.y0; y <= b.y1; y++) alle.push({ x: i, y })
      const frei = alle.filter((c) => this.imLichtung(c))
      if (frei.length < 6) continue
      // Luecke: 3 Felder an einer zufaelligen Stelle
      const l0 = this.r.int(1, frei.length - 4)
      const luecke = new Set(frei.slice(l0, l0 + 3).map((c) => key(c.x, c.y)))
      const zu = (c: P) =>
        luecke.has(key(c.x, c.y)) ||
        belegt.has(key(c.x, c.y)) ||
        same(c, this.schale) ||
        this.feuer.some((f) => manhattan(f.p, c) <= 0) ||
        this.stuempfe.some((s) => Math.abs(s.x - c.x) <= 1 && Math.abs(s.y - c.y) <= 1)
      // Waechst von beiden Seiten zur Mitte
      const m = (frei.length - 1) / 2
      const felder = frei.filter((c) => !zu(c))
      const idx = new Map(frei.map((c, j) => [key(c.x, c.y), j]))
      const l = this.linie('ranke', felder, this.mitte, los, (m + 1) / (ENT.rankenWachsen / 1000), 0, (c) => m - Math.abs((idx.get(key(c.x, c.y)) ?? 0) - m))
      if (l) l.weg = los + ENT.rankenWachsen + ENT.rankenDauer
    }
  }

  /** Wurzeln, Dornen und Ranken wachsen; brennende Feuer halten sie auf (Wurzeln fangen dort Feuer) */
  protected linienTakt() {
    const t = this.time
    const h = this.kopf
    for (const l of this.linien) {
      if (t < l.los) continue
      const n = ((t - l.los) / 1000) * l.tempo
      // Erreicht sie ein brennendes Feuer? Dort ist Schluss
      if (l.art !== 'ranke' && l.stop === Infinity) {
        for (let i = 0; i < l.cells.length && l.d[i] <= n; i++) {
          const fe = this.feuer.find((f) => f.an && same(f.p, l.cells[i]))
          if (!fe) continue
          l.stop = l.d[i]
          l.feuer = { ...fe.p }
          if (l.art === 'wurzel') this.wurzelBrennt(l, i)
          break
        }
      }
      if (l.art === 'ranke') {
        // Waechst eine Ranke auf die Schlange (oder direkt vor den Kopf): dieses Feld bleibt frei
        for (let i = 0; i < l.cells.length; i++) {
          if (l.d[i] > n || t >= l.weg) break
          if ((this.body.some((b) => same(b, l.cells[i])) || this.vorDemKopf(l.cells[i])) && t < l.los + (l.d[i] / l.tempo) * 1000 + 150) {
            l.cells.splice(i, 1)
            l.d.splice(i, 1)
            i--
          }
        }
        continue
      }
      // Gefaehrlich ist, was die Linie gerade erreicht hat (und noch nicht wieder vergangen ist)
      for (let i = 0; i < l.cells.length; i++) {
        const di = l.d[i]
        if (di > n || di > l.stop) continue
        const an = l.los + (di / l.tempo) * 1000
        if (t >= an + l.bleibt) continue
        if (same(l.cells[i], h)) this.schaden(l.cells[i])
      }
    }
    // Fertige Linien weg
    this.linien = this.linien.filter((l) => {
      if (l.art === 'ranke') return t < l.weg + ENT.rankenWachsen
      const ende = Math.min(l.stop, l.d[l.d.length - 1] ?? 0)
      return t < l.los + (ende / l.tempo) * 1000 + l.bleibt + 500
    })
  }

  /** Eine Wurzel faengt an einem brennenden Feuer Feuer: ab Phase 2 laeuft die Flamme zu ihm zurueck (Treffer), wenn das
   *  Feuer zwischen ihm und der Schlange liegt (naeher am Ursprung der Wurzel als der Kopf). Sonst haelt es sie nur auf */
  protected wurzelBrennt(l: EntLinie, i: number) {
    this.ereignis('rueckfeuer', l.cells[i])
    if (this.ent.phase < 1 || this.rueckfeuer || this.ent.zustand === 'getroffen' || this.ent.zustand === 'tot') return
    if (dist(l.von, l.cells[i]) >= dist(l.von, this.kopf)) return
    // Pfad: die Wurzel entlang zurueck zum Ursprung, dann zum Ent
    const pfad: Pf[] = [{ ...l.cells[i] }]
    for (let j = i - 1; j >= 0; j--) if (l.d[j] < l.d[i]) pfad.push({ ...l.cells[j] })
    pfad.push({ ...l.von }, { x: this.ent.x, y: this.ent.y })
    let lang = 0
    for (let j = 1; j < pfad.length; j++) lang += dist(pfad[j - 1], pfad[j])
    this.rueckfeuer = { pfad, t: this.time, ankunft: this.time + (lang / ENT.rueckTempo) * 1000 + 250 }
  }

  protected rueckfeuerTakt() {
    const r = this.rueckfeuer
    if (!r || this.time < r.ankunft) return
    this.rueckfeuer = null
    const z = this.ent.zustand
    if (z === 'getroffen' || z === 'tot' || z === 'schlaf') return
    // Ist er inzwischen woanders hin gewandert, erwischt ihn die Flamme trotzdem (sie folgt den Wurzeln unter der Erde)
    this.treffer()
  }

  /* ---------------- Eicheln, Setzlinge, Sturm ---------------- */

  /** Schatten nahe der Schlange, einer dort, wo sie hinfaehrt */
  protected moerser(bis: number) {
    const n = ENT.eicheln[this.ent.phase] ?? 3
    const h = this.kopf
    const d = STEP[this.wirt.dir]
    for (let i = 0; i < n; i++) {
      let p: P | null = null
      for (let v = 0; v < 24 && !p; v++) {
        const c = i === 0 && v === 0 ? { x: h.x + d.x * 4, y: h.y + d.y * 4 } : { x: h.x + this.r.int(-5, 5), y: h.y + this.r.int(-5, 5) }
        if (this.imLichtung(c) && !this.aufEnt(c) && !this.eicheln.some((e) => !e.fertig && manhattan(e.p, c) < 3)) p = c
      }
      if (p) this.eicheln.push({ p, t: this.time, bis: bis + i * 160, fertig: false })
    }
  }

  /** Felder, die eine Eichel trifft (ein Plus) */
  eichelFelder(e: Eichel): P[] {
    return [e.p, ...DIRS.map((d) => ({ x: e.p.x + STEP[d].x, y: e.p.y + STEP[d].y }))].filter((c) => this.imLichtung(c))
  }

  protected eichelnTakt() {
    for (const e of this.eicheln) {
      if (e.fertig || this.time < e.bis) continue
      e.fertig = true
      this.ereignis('einschlag', e.p)
      if (this.eichelFelder(e).some((c) => same(c, this.kopf))) this.schaden(e.p)
    }
    this.eicheln = this.eicheln.filter((e) => !e.fertig || this.time - e.bis < 900)
  }

  protected setzlingeSetzen() {
    const e = this.ent
    const n = ENT.setzlinge[e.phase] ?? 0
    const h = this.kopf
    const cand: P[] = []
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const c = { x: e.x + dx, y: e.y + dy }
        if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) continue
        if (!this.imLichtung(c) || this.istWand(c) || this.body.some((b) => same(b, c)) || manhattan(c, h) < 4) continue
        if (this.feuer.some((f) => same(f.p, c)) || same(c, this.schale)) continue
        cand.push(c)
      }
    for (let i = 0; i < n && cand.length; i++) {
      const p = cand.splice(this.r.int(0, cand.length - 1), 1)[0]
      if (this.setzlinge.some((s) => manhattan(s.p, p) < 2)) continue
      this.setzlinge.push({ p: { ...p }, from: { ...p }, t: this.time, schrittT: -1e9, next: this.time + 900, bis: this.time + ENT.setzlingLebt, weg: -1 })
    }
  }

  /** Setzlinge tappen langsam auf den Kopf zu, laufen sie in ein brennendes Feuer, verbrennen sie */
  protected setzlingeTakt() {
    const t = this.time
    const h = this.kopf
    for (const s of this.setzlinge) {
      if (s.weg >= 0) continue
      if (t >= s.bis) {
        s.weg = t
        continue
      }
      if (same(s.p, h)) {
        this.schaden(s.p)
        s.weg = t
        continue
      }
      if (t < s.next) continue
      s.next = t + ENT.setzlingTakt
      const reihe = [...DIRS]
        .map((d) => ({ x: s.p.x + STEP[d].x, y: s.p.y + STEP[d].y }))
        .filter((c) => this.imLichtung(c) && !this.aufEnt(c) && !this.istWand(c) && !this.setzlinge.some((o) => o !== s && o.weg < 0 && same(o.p, c)) && !this.body.slice(1).some((b) => same(b, c)))
        .sort((a, b) => manhattan(a, h) - manhattan(b, h))
      const n = reihe[0]
      if (!n || manhattan(n, h) > manhattan(s.p, h)) continue
      s.from = { ...s.p }
      s.p = n
      s.schrittT = t
      if (this.feuer.some((f) => f.an && same(f.p, n))) {
        s.weg = t
        this.ereignis('aus', n)
      } else if (same(n, h)) {
        this.schaden(n)
        s.weg = t
      }
    }
    this.setzlinge = this.setzlinge.filter((s) => s.weg < 0 || t - s.weg < 700)
  }

  /** Laubsturm: sobald der Wind kommt, loescht er ein brennendes Feuer */
  protected sturmTakt() {
    const s = this.sturm
    if (!s) return
    const t = this.time
    if (!s.geloescht && t >= s.los) {
      s.geloescht = true
      const an = this.feuer.filter((f) => f.an)
      if (an.length) {
        const f = this.r.pick(an)
        f.an = false
        f.ausT = t
        this.ereignis('aus', f.p)
      }
    }
    if (t >= s.bis) this.sturm = null
  }

  /* ---------------- Lagerfeuer ---------------- */

  /** Feuer brennen ab. Phase 1: brennen alle gleichzeitig, faengt die Rinde Feuer */
  protected feuerTakt() {
    const t = this.time
    for (const f of this.feuer)
      if (f.an && t >= f.bis) {
        f.an = false
        f.ausT = t
        this.ereignis('aus', f.p)
      }
    const e = this.ent
    if (e.phase !== 0 || (e.zustand !== 'bereit' && e.zustand !== 'erwachen')) return
    const akt = this.aktiveFeuer
    if (!akt.length || !akt.every((f) => f.an)) return
    // Die Flammen springen auf ihn ueber, die Stapel sind aufgebraucht
    for (const f of akt) {
      f.an = false
      f.ausT = t
    }
    // Was noch nicht losgegangen ist, faellt weg: er hat jetzt anderes zu tun
    this.linien = this.linien.filter((l) => t >= l.los)
    this.eicheln = this.eicheln.filter((x) => t >= x.bis)
    this.setze('brennt', ENT.brennt[e.phase])
    this.ereignis('brennt')
  }

  /* ---------------- Treffer ---------------- */

  /** Die Schlange wird getroffen: ein Herz weniger, kurz geschuetzt; ohne Herzen vorbei */
  schaden(p: Pf = this.kopf) {
    if (this.time < this.schutzBis || this.status !== 'play') return false
    this.leben--
    this.schutzBis = this.time + ENT.schutz
    this.wirt.emit({ type: 'bossSchaden', leben: this.leben, p: { x: Math.round(p.x), y: Math.round(p.y) } })
    if (this.leben <= 0) this.wirt.verloren()
    return true
  }

  /** Kopf am Stamm: brennt die Rinde (Herzknoten frei), ist es ein Treffer, sonst kostet es ein Herz */
  protected beruehrt() {
    const z = this.ent.zustand
    if (this.versunken || z === 'tot' || z === 'getroffen' || z === 'schlaf') return
    if (!this.aufEnt(this.kopf)) return
    if (this.verwundbar) this.treffer()
    else this.schaden(this.ent)
  }

  /** Treffer am Ent: ein Herz zurueck, alles Laufende verschwindet, die Feuer gehen aus */
  protected treffer() {
    const e = this.ent
    if (e.zustand === 'getroffen' || e.zustand === 'tot') return
    e.hp--
    e.trefferT = this.time
    e.angriffe = 0
    this.schutzBis = Math.max(this.schutzBis, this.time + 1500)
    this.setze('getroffen', ENT.getroffen)
    this.ereignis('treffer')
    this.leben = Math.min(ENT.herzen, this.leben + 1)
    this.linien = []
    this.eicheln = []
    this.setzlinge.forEach((s) => s.weg < 0 && (s.weg = this.time))
    this.sturm = null
    this.rueckfeuer = null
    for (const f of this.feuer)
      if (f.an) {
        f.an = false
        f.ausT = this.time
      }
  }

  /** Kopf auf der Glutschale: Flamme aufnehmen. Auf einem Holzstapel mit Flamme: anzuenden. Am brennenden Ent: Treffer */
  einsammeln(n: P) {
    const t = this.time
    if (same(n, this.schale) && !this.traegt) {
      this.traegt = true
      this.flammeT = t
      this.ereignis('flamme', n)
    }
    const f = this.aktiveFeuer.find((o) => same(o.p, n))
    if (f && this.traegt) {
      this.traegt = false
      if (!f.an) f.t = t
      f.an = true
      f.bis = t + ENT.feuerBrennt
      this.ereignis('feuer', n)
    }
    if (this.verwundbar && this.aufEnt(n)) this.treffer()
  }

  /* ---------------- Phase 3: die Lichtung waechst zu ---------------- */

  /** Geschuetzt: Glutschale, Holzstapel, Stuempfe (mit Rand), der Ent */
  protected geschuetzt(c: P) {
    if (manhattan(c, this.schale) <= 1) return true
    if (this.feuer.some((f) => manhattan(f.p, c) <= 1)) return true
    if (this.stuempfe.some((s) => Math.abs(s.x - c.x) <= 2 && Math.abs(s.y - c.y) <= 2)) return true
    return false
  }

  protected zuwachsTakt() {
    const t = this.time
    // Sprosse werden zu Dickicht (liegt die Schlange darauf oder ist der Kopf direkt davor, wartet der Spross noch)
    for (const s of this.sprosse) {
      if (t < s.bis) continue
      if (this.body.some((b) => same(b, s.p)) || this.vorDemKopf(s.p)) {
        s.bis = t + 400
        continue
      }
      this.dickicht.add(key(s.p.x, s.p.y))
      s.bis = Infinity
    }
    this.sprosse = this.sprosse.filter((s) => s.bis !== Infinity)
    if (t < this.zuwachsNext || this.zuwachs >= ENT.zuwachsenMax) return
    const z = this.ent.zustand
    if (z === 'tot' || z === 'getroffen') return
    this.zuwachs++
    this.zuwachsNext = t + ENT.zuwachsen
    for (const [k, d] of this.tiefe) {
      if (d !== this.zuwachs || this.dickicht.has(k)) continue
      const c = { x: (k % 4096) - 1, y: Math.floor(k / 4096) - 1 }
      if (this.geschuetzt(c) || !this.wirt.inside(c)) continue
      this.sprosse.push({ p: c, t, bis: t + ENT.zuwachsenWarn + this.r.int(0, 500) })
    }
    this.ereignis('zuwachsen', this.mitte)
  }
}
