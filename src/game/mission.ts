/**
 * Kampagne: eine feste Mission (Karte aus missionen.ts). Baut auf dem Endlos-Spiel auf, aber:
 * - die Karte ist von Hand gebaut: Berge (nicht Karte) trennen die Taeler, alles liegt immer an derselben Stelle
 * - alle Aepfel liegen von Anfang an da (Reihenfolge egal), der zuletzt uebrige leuchtet; alle gegessen = geschafft
 * - nichts kommt dazu: keine Mauern nach jedem Apfel, keine Power-ups, keine Ereignisse
 * - Froesche bleiben im Tal (sie huepfen nicht ueber den Rand in die Berge)
 * - Edelsteine (Schatz-Level) zaehlen mit: beim ersten Abschluss gibt es ihren Wert in Aepfeln dazu
 *
 * `apple` ist immer der naechste Apfel zum Kopf (dorthin zeigt der Pfeil am Bildrand), `aepfel` sind alle, die noch liegen.
 */
import { BLOCK_PLUS, Game, key } from './game'
import { MISSION_BILD, type MissionDef } from './missionen'
import { DEFAULTS, DIRS, erzWert, FROSCH_ANLAUF, OPP, STEP, type ErzArt } from './rules'
import type { Dir, P } from './types'

export type MissionApfel = { p: P; t: number }

/** Feste Teile einer Missionskarte, aus dem Text gelesen */
export type MissionKarte = {
  w: number
  h: number
  /** Berge (Felder ohne Karte) */
  berge: P[]
  start: P
  aepfel: P[]
  mauern: P[][]
  teiche: P[][]
  gift: P[]
  froesche: P[]
  eis: P[][]
  /** Koepfe der Gegner-Schlangen */
  gegner: P[]
  funde: { p: P; art: ErzArt }[]
  /** Boss: Sockel 1 bis 6 (Index = Kristallfarbe), Mitte des Bannkreises, Start des Golems */
  sockel: P[]
  kreis: P | null
  golem: P | null
}

/** Zusammenhaengende Gruppen (4er-Nachbarschaft) */
function gruppen(felder: P[]): P[][] {
  const offen = new Map(felder.map((p) => [key(p.x, p.y), p]))
  const out: P[][] = []
  for (const p of felder) {
    if (!offen.has(key(p.x, p.y))) continue
    const g: P[] = []
    const stapel = [p]
    offen.delete(key(p.x, p.y))
    while (stapel.length) {
      const c = stapel.pop()!
      g.push(c)
      for (const d of DIRS) {
        const k = key(c.x + STEP[d].x, c.y + STEP[d].y)
        const n = offen.get(k)
        if (!n) continue
        offen.delete(k)
        stapel.push(n)
      }
    }
    out.push(g)
  }
  return out
}

export function leseKarte(zeilen: readonly string[]): MissionKarte {
  const k: MissionKarte = {
    w: zeilen[0]?.length ?? 0,
    h: zeilen.length,
    berge: [],
    start: { x: 0, y: 0 },
    aepfel: [],
    mauern: [],
    teiche: [],
    gift: [],
    froesche: [],
    eis: [],
    gegner: [],
    funde: [],
    sockel: [],
    kreis: null,
    golem: null,
  }
  const mauer: P[] = []
  const teich: P[] = []
  const eis: P[] = []
  const sockel: { p: P; i: number }[] = []
  const ERZ: Record<string, ErzArt> = { $: 'gold', '*': 'dia', '%': 'rubin' }
  zeilen.forEach((z, y) => {
    for (let x = 0; x < z.length; x++) {
      const p = { x, y }
      switch (z[x]) {
        case '#':
          k.berge.push(p)
          break
        case 'S':
          k.start = p
          break
        case 'A':
          k.aepfel.push(p)
          break
        case 'W':
          mauer.push(p)
          break
        case '~':
          teich.push(p)
          break
        case 'G':
          k.gift.push(p)
          break
        case 'F':
          k.froesche.push(p)
          break
        case 'E':
          eis.push(p)
          break
        case 'R':
          k.gegner.push(p)
          break
        case '$':
        case '*':
        case '%':
          k.funde.push({ p, art: ERZ[z[x]] })
          break
        case 'O':
          k.kreis = p
          break
        case 'B':
          k.golem = p
          break
        default:
          if (z[x] >= '1' && z[x] <= '6') sockel.push({ p, i: Number(z[x]) - 1 })
      }
    }
  })
  k.mauern = gruppen(mauer)
  k.teiche = gruppen(teich)
  k.eis = gruppen(eis)
  k.sockel = sockel.sort((a, b) => a.i - b.i).map((s) => s.p)
  return k
}

/** Zwischenspeicher: jede Karte wird nur einmal gelesen (sie aendert sich nie) */
const gelesen = new Map<string, MissionKarte>()
export function karteVon(m: MissionDef): MissionKarte {
  let k = gelesen.get(m.id)
  if (!k) {
    k = leseKarte(m.karte ?? [])
    gelesen.set(m.id, k)
  }
  return k
}

/** Blockgroesse der Missionen (haengt nur am festen Bild, hochkant) */
const blockVon = (bild: { w: number; h: number }) => ({ w: bild.w + BLOCK_PLUS, h: Math.max(4, Math.floor(bild.h / 2)) + BLOCK_PLUS })

export class MissionGame extends Game {
  readonly mission: MissionDef
  readonly karte: MissionKarte
  /** Aepfel, die noch liegen (`apple` ist einer davon) */
  aepfel: MissionApfel[] = []
  /** So viele Aepfel hat die Mission */
  readonly ziel: number
  /** Berge als Schluessel (fuer die Darstellung) */
  readonly bergSet: Set<number>
  /** Wert der eingesammelten Edelsteine (Aepfel, gibt es beim ersten Abschluss dazu) */
  schatz = 0

  constructor(m: MissionDef) {
    const k = karteVon(m)
    const bild = m.bild ?? MISSION_BILD
    const b = blockVon(bild)
    const bloecke: P[] = []
    for (let by = 0; by * b.h < k.h; by++) for (let bx = 0; bx * b.w < k.w; bx++) bloecke.push({ x: bx, y: by })
    super({
      screenW: bild.w,
      screenH: bild.h,
      tempo: 'normal',
      // Immer die Standardregeln: die Mission spielt sich auf jedem Geraet gleich (spaete Missionen werden je Apfel schneller)
      cfg: { ...DEFAULTS, ...(m.tempoProApfel !== undefined ? { tempoProLevel: m.tempoProApfel } : {}) },
      seed: m.seed ?? 1,
      startLevel: 1,
      sandbox: { breite: 0, hoehe: 0, laenge: m.laenge ?? 3, objekte: {}, weiter: false, bloecke, aus: k.berge },
    })
    this.mission = m
    this.karte = k
    this.ziel = k.aepfel.length
    this.bergSet = new Set(k.berge.map((p) => key(p.x, p.y)))

    // Schlange: Kopf auf S, der Koerper liegt entgegen der Startrichtung dahinter
    const dir: Dir = m.richtung ?? 'u'
    const zurueck = STEP[OPP[dir]]
    const laenge = Math.max(3, m.laenge ?? 3)
    this.body = Array.from({ length: 3 }, (_, i) => ({ x: k.start.x + zurueck.x * i, y: k.start.y + zurueck.y * i }))
    this.prev = this.body.map((p) => ({ ...p }))
    this.dir = dir
    this.prevDir = dir
    this.wachsRest = laenge - 3

    this.mauern = k.mauern.map((cells) => ({ cells: cells.map((c) => ({ ...c })), grown: cells.length, t: cells.map(() => -1e9), next: 0 }))
    this.teiche = k.teiche.map((cells) => ({ cells: cells.map((c) => ({ ...c })), t: -1e9 }))
    this.gift = k.gift.map((p, i) => ({ p: { ...p }, t: -1e9, ecke: (i * 2.39) % (Math.PI * 2) }))
    this.froesche = k.froesche.map((p, i) => {
      // Blickrichtung: dorthin, wo am meisten Platz ist (fest, damit es jedes Mal gleich ist)
      const frei = (d: Dir) => {
        let n = 0
        while (n < 6 && this.inside({ x: p.x + STEP[d].x * (n + 1), y: p.y + STEP[d].y * (n + 1) })) n++
        return n
      }
      const d = [...DIRS].sort((a, b) => frei(b) - frei(a))[0]
      return { p: { ...p }, from: { ...p }, dir: d, altDir: d, drehT: -1e9, t: -1e9, flugAb: -1e9, hopAt: this.cfg.froschSprung * 1000 + i * 450 }
    })
    this.eis = k.eis.map((cells) => ({ cells: cells.map((c) => ({ ...c })), t: -1e9 }))
    this.funde = k.funde.map((f) => ({ p: { ...f.p }, art: f.art, t: 0 }))
    for (const kopf of k.gegner) this.gegnerSetzen(kopf)
    // Alle Aepfel liegen von Anfang an da und ploppen beim Start auf
    this.aepfel = k.aepfel.map((p) => ({ p: { ...p }, t: 0 }))
    this.zielWaehlen()
    this.events = []
  }

  /** Rote Gegner-Schlange mit dem Kopf auf p, 3 lang, der Koerper liegt dorthin, wo am meisten Platz ist (fest) */
  protected gegnerSetzen(p: P) {
    const zu = this.hindernisse()
    const frei = (c: P) => this.inside(c) && !zu.has(key(c.x, c.y)) && !this.body.some((b) => b.x === c.x && b.y === c.y)
    const weit = (d: Dir) => {
      let n = 0
      while (n < 6 && frei({ x: p.x + STEP[d].x * (n + 1), y: p.y + STEP[d].y * (n + 1) })) n++
      return n
    }
    const hinten = [...DIRS].sort((a, b) => weit(b) - weit(a))[0]
    const body = [0, 1, 2].map((i) => ({ x: p.x + STEP[hinten].x * i, y: p.y + STEP[hinten].y * i }))
    const t = this.time
    this.gegner.push({ art: 'rot', body, prev: body.map((c) => ({ ...c })), dir: OPP[hinten], t, last: t + 500, wachsAt: t + this.cfg.gegnerWachsen * 1000, wachsRest: 0, wuchsT: -1e9, eng: 0, angst: 0, stur: 0 })
  }

  /** Edelstein (Schatz-Level): zaehlt fuer die Belohnung, nicht als Waehrung waehrend der Mission */
  protected override fundNehmen(art: ErzArt, p: P) {
    const wert = erzWert(this.cfg, art)
    this.schatz += wert
    this.emit({ type: 'fund', art, p: { ...p }, wert })
  }

  /** Noch zu holen */
  get uebrig() {
    return this.aepfel.length
  }

  /** Der naechste Apfel zum Kopf wird `apple` (fuer den Pfeil am Rand und das Leuchten des letzten) */
  protected zielWaehlen() {
    const h = this.body[0]
    let best: MissionApfel | null = null
    let bd = Infinity
    for (const a of this.aepfel) {
      const d = Math.abs(a.p.x - h.x) + Math.abs(a.p.y - h.y)
      if (d < bd) {
        bd = d
        best = a
      }
    }
    // Alle gegessen: weit weg von der Karte (wird nicht mehr gebraucht)
    this.apple = best ?? { p: { x: -1000, y: -1000 }, t: this.time }
  }

  /** Statt einen neuen Apfel zu setzen: den naechsten der liegenden waehlen. Laeuft auch schon im Konstruktor von Game */
  override neuerApfel() {
    if (!this.aepfel) return
    this.zielWaehlen()
  }

  override update(dt: number) {
    super.update(dt)
    if (this.status === 'play') this.zielWaehlen()
  }

  /** Ein anderer liegender Apfel unter dem Kopf: den essen (der gewaehlte wird schon vom Schritt gegessen) */
  protected override einsammeln(n: P) {
    super.einsammeln(n)
    const a = this.aepfel.find((o) => o !== this.apple && o.p.x === n.x && o.p.y === n.y)
    if (a) {
      this.apple = a
      this.eat({ ...n })
    }
  }

  protected override eat(n: P) {
    this.aepfel = this.aepfel.filter((a) => a.p.x !== n.x || a.p.y !== n.y)
    super.eat(n)
    if (!this.aepfel.length) this.geschafft()
  }

  /** Aepfel zaehlen als belegt: Froesche springen nicht darauf */
  override hindernisse(mitGegnern = true) {
    const s = super.hindernisse(mitGegnern)
    for (const a of this.aepfel ?? []) s.add(key(a.p.x, a.p.y))
    return s
  }

  /** Froesche huepfen nicht ueber den Rand in die Berge: vorher in eine Richtung mit Wiese drehen */
  protected override froschTakt() {
    for (const f of this.froesche) {
      if (f.gone !== undefined || this.time < f.hopAt || f.drehAt !== undefined) continue
      if (this.inside({ x: f.p.x + STEP[f.dir].x, y: f.p.y + STEP[f.dir].y })) continue
      const d = this.r.shuffle(DIRS.filter((o) => o !== f.dir)).find((o) => this.inside({ x: f.p.x + STEP[o].x, y: f.p.y + STEP[o].y }))
      if (!d) continue
      f.altDir = f.dir
      f.dir = d
      f.drehT = this.time
      // Erst drehen, dann mit Anlauf springen
      f.hopAt = this.time + FROSCH_ANLAUF + 300
    }
    super.froschTakt()
  }
}
