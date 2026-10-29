/**
 * Kampagne: eine feste Mission (Karte aus missionen.ts). Baut auf dem Endlos-Spiel auf, aber:
 * - die Karte ist von Hand gebaut: Berge (nicht Karte) trennen die Taeler, alles liegt immer an derselben Stelle
 * - alle Aepfel liegen von Anfang an da (Reihenfolge egal), der zuletzt uebrige leuchtet; alle gegessen = geschafft
 * - nichts kommt dazu: keine Mauern nach jedem Apfel, keine Power-ups, keine Ereignisse
 * - Froesche bleiben im Tal (sie huepfen nicht ueber den Rand in die Berge)
 * - Edelsteine (Schatz-Level) zaehlen mit: beim ersten Abschluss gibt es ihren Wert in Aepfeln dazu
 * - ab Mission 5: Baeume kippen, wenn die Schlange nah ist (nach 1 bis 8 Sekunden), in Haeusern wechselt das Licht alle
 *   paar Sekunden (nie auf die Schlange), Ameisen; ab Mission 6 kleine Steingolems (bis Mission 10), ab Mission 11 Giftwolken
 *   aus Quellen, Lava, die sich ausbreitet, grosse Tannen, ab 16 Leuchttuerme, die sich drehen, und Mini-Ents
 * - es gibt kein Level, das zurueckfallen koennte: Fensterlicht, Lichtkegel, Giftwolke, Ameisenbiss und Bienen = verloren
 *
 * `apple` ist immer der naechste Apfel zum Kopf (dorthin zeigt der Pfeil am Bildrand), `aepfel` sind alle, die noch liegen.
 */
import { BLOCK_PLUS, Game, key, WESEN_TAKT } from './game'
import { MISSION_BILD, type MissionDef } from './missionen'
import { CW, DEFAULTS, DIRS, erzWert, FROSCH_ANLAUF, OPP, STEP, type ErzArt } from './rules'
import type { Cause, Dir, Haus, Kaefig, P, Turm } from './types'

/** So lange (ms) leuchtet ein Fenster, dann wechselt das Licht */
export const LICHT_TAKT = 4000
/** So oft (ms) dreht sich ein Leuchtturm eine Vierteldrehung weiter */
export const TURM_TAKT = 3200
/** So lange (ms) vor jeder Drehung zeigt ein Leuchtturm schwach, wohin sein Licht gleich faellt */
export const TURM_WARNUNG = 700
/** So oft (ms) breitet sich jeder Lavasee um ein Feld aus (dazu wie im freien Spiel jeden 2. Apfel) */
export const LAVA_TAKT = 6000
/** Pause (ms), bis aus einer Quelle die naechste Giftwolke steigt */
export const QUELLE_PAUSE = 4500
/** Stehende Baeume kippen, wenn der Kopf so nah ist (Felder, auch schraeg), nach 1 bis 8 Sekunden */
export const BAUM_NAH = 5
export const BAUM_TIMER: [number, number] = [1000, 8000]

/** Kaefigkoepfe (ab Mission 22): ein Feld alle takt ms (dazu bis stolpern ms, sie torkeln), sehen sicht Felder nach vorn,
 *  holen laden ms aus, der Strahl reicht weite Felder und brennt strahl ms, danach ruhe ms Pause */
export const KAEFIG = { takt: 820, stolpern: 380, sicht: 7, laden: 800, strahl: 380, weite: 9, ruhe: 2000, wand: [2, 4] as const }

const manhattan = (a: P, b: P) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
const cheb = (a: P, b: P) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

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
  /** Boss: Sockel 1 bis 6 (i = Kristallfarbe), Mitten der Bannkreise, Starts des Golems (je Raum einer),
   *  Felder der Steintore zwischen den Raeumen, feste Plaetze fuer Kristalle */
  sockel: { p: P; i: number }[]
  kreise: P[]
  golems: P[]
  tore: P[]
  plaetze: P[]
  /** Wiese, auf die der Golem nicht tritt (Durchgaenge zu den Kammern) */
  sperre: P[]
  /** Ameisen, Stamm stehender Baeume und grosser Tannen, Haeuser und Leuchttuerme (je Gruppe), Lavaseen,
   *  Quellen der Giftwolken, kleine Steingolems, Bienenstoecke, Igel */
  ameisen: P[]
  baeume: P[]
  tannen: P[]
  haeuser: P[][]
  tuerme: P[][]
  lava: P[][]
  quellen: P[]
  minigolems: P[]
  stoecke: P[]
  igel: P[]
  /** Mini-Ents (ab Mission 16) */
  minients: P[]
  /** Ent-Boss (Mission 20): Start des Ents, alte Baumstuempfe, Holzstapel (ab = ab welcher Phase), Glutschale */
  ent: P | null
  stuempfe: P[]
  holz: { p: P; ab: number }[]
  schale: P | null
  /** Dungeon (ab Mission 21): Steinboden (Felder der Karte, nur anders gezeichnet), Felder der grossen Tuer, Siegel, Kaefigkoepfe */
  dungeon: P[]
  tuer: P[]
  siegel: P[]
  kaefige: P[]
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
    kreise: [],
    golems: [],
    tore: [],
    plaetze: [],
    sperre: [],
    ameisen: [],
    baeume: [],
    tannen: [],
    haeuser: [],
    tuerme: [],
    lava: [],
    quellen: [],
    minigolems: [],
    stoecke: [],
    igel: [],
    minients: [],
    ent: null,
    stuempfe: [],
    holz: [],
    schale: null,
    dungeon: [],
    tuer: [],
    siegel: [],
    kaefige: [],
  }
  const mauer: P[] = []
  const teich: P[] = []
  const eis: P[] = []
  const haus: P[] = []
  const turm: P[] = []
  const lava: P[] = []
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
          k.kreise.push(p)
          break
        case 'B':
          k.golems.push(p)
          break
        case 'T':
          k.tore.push(p)
          break
        case 'k':
          k.plaetze.push(p)
          break
        case 'x':
          k.sperre.push(p)
          break
        case 'a':
          k.ameisen.push(p)
          break
        case 'Y':
          k.baeume.push(p)
          break
        case 'Z':
          k.tannen.push(p)
          break
        case 'H':
          haus.push(p)
          break
        case 'J':
          turm.push(p)
          break
        case 'L':
          lava.push(p)
          break
        case 'C':
          k.quellen.push(p)
          break
        case 'M':
          k.minigolems.push(p)
          break
        case 'b':
          k.stoecke.push(p)
          break
        case 'I':
          k.igel.push(p)
          break
        case 'N':
          k.minients.push(p)
          break
        case 'Q':
          k.ent = p
          break
        case 'U':
          k.stuempfe.push(p)
          break
        case 'P':
          k.holz.push({ p, ab: 0 })
          break
        case 'V':
          k.holz.push({ p, ab: 1 })
          break
        case 'K':
          k.schale = p
          break
        case ',':
          k.dungeon.push(p)
          break
        case 'D':
          k.tuer.push(p)
          k.dungeon.push(p)
          break
        case '@':
          k.siegel.push(p)
          k.dungeon.push(p)
          break
        case 'z':
          k.kaefige.push(p)
          break
        default:
          if (z[x] >= '1' && z[x] <= '6') k.sockel.push({ p, i: Number(z[x]) - 1 })
      }
    }
  })
  // Zeichen auf der Karte (Apfel, Gift, Lava ...) liegen auf dem Boden, der ihnen am naechsten ist: Wiese oder Dungeon
  if (k.dungeon.length) {
    const art = new Map<number, boolean>()
    const q: P[] = []
    const boden = new Set(k.dungeon.map((d) => key(d.x, d.y)))
    zeilen.forEach((z, y) => {
      for (let x = 0; x < z.length; x++)
        if (z[x] === '.' || boden.has(key(x, y))) {
          art.set(key(x, y), z[x] !== '.')
          q.push({ x, y })
        }
    })
    for (let i = 0; i < q.length; i++) {
      const c = q[i]
      const a = art.get(key(c.x, c.y))!
      for (const d of DIRS) {
        const n = { x: c.x + STEP[d].x, y: c.y + STEP[d].y }
        const ch = zeilen[n.y]?.[n.x]
        if (!ch || ch === '#' || art.has(key(n.x, n.y))) continue
        art.set(key(n.x, n.y), a)
        q.push(n)
        if (a) k.dungeon.push(n)
      }
    }
  }
  k.mauern = gruppen(mauer)
  k.teiche = gruppen(teich)
  k.eis = gruppen(eis)
  k.haeuser = gruppen(haus)
  k.tuerme = gruppen(turm)
  k.lava = gruppen(lava)
  return k
}

/** Querformat (PC): die Karte um 90 Grad im Uhrzeigersinn gedreht, aus unten wird links und aus oben rechts.
 *  Man spielt dann von links nach rechts, das Bild ist breit statt hoch und die Felder werden groesser */
export function querKarte(zeilen: readonly string[]): string[] {
  const h = zeilen.length
  const w = zeilen[0]?.length ?? 0
  return Array.from({ length: w }, (_, y) => Array.from({ length: h }, (_, x) => zeilen[h - 1 - x][y]).join(''))
}
/** Richtung nach der Drehung im Uhrzeigersinn */
export const QUER_DIR: Record<Dir, Dir> = { u: 'r', r: 'd', d: 'l', l: 'u' }

/** Zwischenspeicher: jede Karte wird nur einmal gelesen (sie aendert sich nie), hochkant und quer getrennt */
const gelesen = new Map<string, MissionKarte>()
export function karteVon(m: MissionDef, quer = false): MissionKarte {
  const id = quer ? `${m.id}:quer` : m.id
  let k = gelesen.get(id)
  if (!k) {
    const zeilen = m.karte ?? []
    k = leseKarte(quer ? querKarte(zeilen) : zeilen)
    gelesen.set(id, k)
  }
  return k
}

/** Blockgroesse der Missionen (haengt nur am festen Bild, wie im Spiel: hochkant halb so hoch, quer halb so breit) */
const blockVon = (bild: { w: number; h: number }) =>
  bild.h >= bild.w
    ? { w: bild.w + BLOCK_PLUS, h: Math.max(4, Math.floor(bild.h / 2)) + BLOCK_PLUS }
    : { w: Math.max(4, Math.floor(bild.w / 2)) + BLOCK_PLUS, h: bild.h + BLOCK_PLUS }

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
  /** Quer gedreht (Querformat, PC): man spielt von links nach rechts */
  readonly quer: boolean
  /** Bild, nach dem die Feldgroesse bemessen wird: in allen Missionen gleich (auch im Boss-Level mit groesseren Bloecken) */
  readonly sicht: { w: number; h: number }
  /** Naechster Lichtwechsel je Haus, naechste Drehung je Leuchtturm (Spielzeit) */
  lichtNext: number[] = []
  protected turmNext: number[] = []
  /** Je Leuchtturm: wohin sein Licht nach der naechsten Drehung faellt (kurz vorher angekuendigt, sonst null) */
  turmVorschau: (P[] | null)[] = []
  protected lavaNext = LAVA_TAKT
  /** Quellen der Giftwolken: naechste Wolke ab (Infinity = eine steigt gerade) */
  quellen: { p: P; next: number }[] = []
  /** Dungeon-Boden (Schluessel, nur fuer die Darstellung) */
  readonly dungeonSet: Set<number>
  /** Siegel, die noch liegen (Mission 27: statt Aepfeln), wie viele es sind */
  siegel: MissionApfel[] = []
  readonly siegelZiel: number
  /** Die grosse Tuer: zu, bis alle Siegel geholt sind (dann ab tuerAuf offen, hindurch = geschafft) */
  readonly tuer: P[]
  protected readonly tuerSet: Set<number>
  tuerAuf = -1
  /** Kaefigkoepfe */
  kaefige: Kaefig[] = []

  constructor(m: MissionDef, quer = false) {
    const k = karteVon(m, quer)
    const hoch = m.bild ?? MISSION_BILD
    const bild = quer ? { w: hoch.h, h: hoch.w } : hoch
    const b = blockVon(bild)
    const bloecke: P[] = []
    for (let by = 0; by * b.h < k.h; by++) for (let bx = 0; bx * b.w < k.w; bx++) bloecke.push({ x: bx, y: by })
    super({
      screenW: bild.w,
      screenH: bild.h,
      tempo: 'normal',
      // Immer die Standardregeln: die Mission spielt sich auf jedem Geraet gleich (spaete Missionen werden je Apfel schneller)
      cfg: { ...DEFAULTS, ...(m.tempoProApfel !== undefined ? { tempoProLevel: m.tempoProApfel } : {}), ...(m.turm ? { kegelLaenge: m.turm.laenge } : {}) },
      seed: m.seed ?? 1,
      startLevel: 1,
      sandbox: { breite: 0, hoehe: 0, laenge: m.laenge ?? 3, objekte: {}, weiter: false, bloecke, aus: k.berge },
    })
    this.mission = m
    this.quer = quer
    this.sicht = quer ? { w: MISSION_BILD.h, h: MISSION_BILD.w } : { ...MISSION_BILD }
    this.karte = k
    this.ziel = k.aepfel.length + k.siegel.length
    this.siegelZiel = k.siegel.length
    this.bergSet = new Set(k.berge.map((p) => key(p.x, p.y)))
    this.dungeonSet = new Set(k.dungeon.map((p) => key(p.x, p.y)))
    this.tuer = k.tuer.map((p) => ({ ...p }))
    this.tuerSet = new Set(k.tuer.map((p) => key(p.x, p.y)))

    // Schlange: Kopf auf S, der Koerper liegt entgegen der Startrichtung dahinter
    const dir: Dir = quer ? QUER_DIR[m.richtung ?? 'u'] : (m.richtung ?? 'u')
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
    this.dingeSetzen(k)
    // Alle Aepfel liegen von Anfang an da und ploppen beim Start auf
    this.aepfel = k.aepfel.map((p) => ({ p: { ...p }, t: 0 }))
    this.siegel = k.siegel.map((p) => ({ p: { ...p }, t: 0 }))
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

  /** So oft (ms) dreht sich ein Leuchtturm weiter (Mission 18 schneller) */
  get turmTakt() {
    return this.mission.turm?.takt ?? TURM_TAKT
  }

  /** Noch zu holen (Aepfel und Siegel) */
  get uebrig() {
    return this.aepfel.length + (this.siegel?.length ?? 0)
  }

  /** Ist die grosse Tuer (noch) zu? */
  tuerZu(p: P) {
    return this.tuerAuf < 0 && !!this.tuerSet?.has(key(p.x, p.y))
  }

  /** Der naechste Apfel (oder das naechste Siegel) zum Kopf wird `apple` (fuer den Pfeil am Rand und das Leuchten des
   *  letzten). Sind alle Siegel geholt, zeigt der Pfeil zur offenen Tuer */
  protected zielWaehlen() {
    const h = this.body[0]
    let best: MissionApfel | null = null
    let bd = Infinity
    const tuer = this.tuerAuf >= 0 && !this.aepfel.length && !this.siegel?.length ? this.tuer.map((p) => ({ p, t: this.tuerAuf })) : []
    for (const a of [...this.aepfel, ...(this.siegel ?? []), ...tuer]) {
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
    if (this.status === 'play') this.missionTakt()
    if (this.status === 'play') this.zielWaehlen()
  }

  /** Ein anderer liegender Apfel (oder ein Siegel) unter dem Kopf: den essen (der gewaehlte wird schon vom Schritt
   *  gegessen). Durch die offene Tuer: geschafft */
  protected override einsammeln(n: P) {
    super.einsammeln(n)
    if (this.tuerAuf >= 0 && this.tuerSet.has(key(n.x, n.y))) {
      this.geschafft()
      return
    }
    const a = [...this.aepfel, ...this.siegel].find((o) => o !== this.apple && o.p.x === n.x && o.p.y === n.y)
    if (a) {
      this.apple = a
      this.eat({ ...n })
    }
  }

  protected override eat(n: P) {
    if (this.status !== 'play') return
    const hier = (a: MissionApfel) => a.p.x === n.x && a.p.y === n.y
    const siegel = this.siegel.some(hier)
    this.aepfel = this.aepfel.filter((a) => !hier(a))
    this.siegel = this.siegel.filter((a) => !hier(a))
    super.eat(n)
    if (siegel) this.emit({ type: 'siegel', p: { ...n }, rest: this.siegel.length })
    if (this.aepfel.length || this.siegel.length) return
    // Alle Siegel geholt: die Tuer leuchtet orange und geht auf, hindurch ist die Mission geschafft
    if (this.tuer.length && this.tuerAuf < 0) {
      this.tuerAuf = this.time
      const m = this.tuer[Math.floor(this.tuer.length / 2)]
      this.emit({ type: 'tuerAuf', p: { ...m } })
      this.zielWaehlen()
      return
    }
    this.geschafft()
  }

  /** Geschlossene Tuer und Kaefigkoepfe sind wie Wand */
  override gefahr(n: P, rest: P[] = this.body) {
    if (this.inside(n) && !this.geist()) {
      if (this.tuerZu(n)) return 'dungeontuer' as const
      if (this.kaefige?.some((z) => z.p.x === n.x && z.p.y === n.y)) return 'kaefig' as const
    }
    return super.gefahr(n, rest)
  }

  /** Aepfel und Siegel zaehlen als belegt (Froesche springen nicht darauf), die geschlossene Tuer und Kaefigkoepfe als Wand */
  override hindernisse(mitGegnern = true) {
    const s = super.hindernisse(mitGegnern)
    for (const a of [...(this.aepfel ?? []), ...(this.siegel ?? [])]) s.add(key(a.p.x, a.p.y))
    if (this.tuerAuf < 0) for (const p of this.tuer ?? []) s.add(key(p.x, p.y))
    for (const z of this.kaefige ?? []) s.add(key(z.p.x, z.p.y))
    return s
  }

  /** Schliesst etwas ab? Hier zaehlen die Aepfel und Siegel als Wiese: auch sie muessen erreichbar bleiben (Baeume, Lava) */
  protected override keinAbschluss(cells: P[], wand: Set<number>) {
    const ziele = [...(this.aepfel ?? []), ...(this.siegel ?? [])]
    if (!ziele.length) return super.keinAbschluss(cells, wand)
    const w = new Set(wand)
    for (const a of ziele) w.delete(key(a.p.x, a.p.y))
    return super.keinAbschluss(cells, w)
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

  /* ================= Neues ab Mission 5 ================= */

  /** Ameisen, Baeume, Haeuser, Leuchttuerme, Lava, Giftwolken-Quellen, Steingolems, Mini-Ents, Bienenstoecke und Igel von der Karte */
  protected dingeSetzen(k: MissionKarte) {
    const r = this.r
    // Wohin am meisten Platz ist (fest, damit es jedes Mal gleich ist)
    const weitesteRichtung = (p: P) => {
      const frei = (d: Dir) => {
        let n = 0
        while (n < 6 && this.inside({ x: p.x + STEP[d].x * (n + 1), y: p.y + STEP[d].y * (n + 1) })) n++
        return n
      }
      return [...DIRS].sort((a, b) => frei(b) - frei(a))[0]
    }
    this.ameisen = k.ameisen.map((p, i) => ({ p: { ...p }, from: { ...p }, heim: { ...p }, dir: DIRS[i % 4], t: 0, schrittT: -1e9, next: this.cfg.ameiseTakt * 1000, alarm: -1, sattBis: 0 }))
    // Baeume stehen und warten, bis die Schlange in die Naehe kommt
    const baum = (root: P, gross: boolean) => {
      const form = gross ? [-1, 0, 1].flatMap((y) => [-1, 0, 1].map((x) => ({ x, y }))) : [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]
      return { cells: form.map((o) => ({ x: root.x + o.x, y: root.y + o.y })), root: { ...root }, dir: 'u' as Dir, t: 0, kippBei: Infinity, fallT: -1e9, gelandet: true, wartet: true, ...(gross ? { gross } : {}) }
    }
    this.baeume = [...k.baeume.map((p) => baum(p, false)), ...k.tannen.map((p) => baum(p, true))]
    // Haeuser: je Seite ein Fenster, das Licht wechselt alle paar Sekunden
    this.haeuser = k.haeuser.map((cells) => {
      const drin = new Set(cells.map((c) => key(c.x, c.y)))
      const fenster = DIRS.map((d) => {
        const rand = cells.filter((c) => !drin.has(key(c.x + STEP[d].x, c.y + STEP[d].y)))
        return { p: { ...r.pick(rand) }, d }
      })
      return { cells: cells.map((c) => ({ ...c })), t: 0, fenster, licht: -1, lichtT: 0, strahl: [], kamin: r.int(0, cells.length - 1), klein: cells.length <= 4 } as Haus
    })
    for (const h of this.haeuser) this.lichtFuer(h, true)
    this.lichtNext = this.haeuser.map((_, i) => LICHT_TAKT + i * 900)
    // Leuchttuerme (2 x 2): schauen am Anfang dorthin, wo ihr Kegel am weitesten von der Schlange weg ist
    this.tuerme = k.tuerme.map((cells) => {
      const c = { x: Math.min(...cells.map((p) => p.x)), y: Math.min(...cells.map((p) => p.y)) }
      const t: Turm = { c, cells: cells.map((p) => ({ ...p })), dir: 'u', t: 0, kegel: [], kegelT: 0, altDir: 'u' }
      let best = -1
      for (const d of DIRS) {
        t.dir = d
        this.kegel(t)
        const ab = t.kegel.length ? Math.min(...t.kegel.map((p) => manhattan(p, this.body[0]))) : 99
        if (ab > best) {
          best = ab
          t.altDir = d
        }
      }
      t.dir = t.altDir
      this.kegel(t)
      return t
    })
    this.turmNext = this.tuerme.map((_, i) => this.turmTakt + i * 1100)
    // Lavaseen breiten sich aus (um lavaMehr Felder)
    const mehr = this.mission.lavaMehr ?? 10
    this.lava = k.lava.map((cells) => ({ cells: cells.map((c) => ({ ...c })), t: cells.map(() => -1e9), ziel: cells.length + mehr }))
    this.quellen = k.quellen.map((p, i) => ({ p: { ...p }, next: 2500 + i * 2600 }))
    for (const p of k.minigolems) this.minigolemSetzen(p, weitesteRichtung(p))
    this.stoecke = k.stoecke.map((p) => ({ p: { ...p }, t: 0, bis: Infinity, ruhe: 0 }))
    for (const p of k.minients) this.minientSetzen(p)
    this.wesen = k.igel.map((p) => ({ art: 'igel' as const, p: { ...p }, from: { ...p }, dir: weitesteRichtung(p), t: 0, schrittT: 0, next: WESEN_TAKT.igel, heim: { ...p }, sattBis: 0, wurfNext: 0 }))
    this.kaefige = k.kaefige.map((p, i) => {
      const d = weitesteRichtung(p)
      return { p: { ...p }, from: { ...p }, dir: d, altDir: d, drehT: -1e9, t: 0, schrittT: -1e9, next: 1200 + i * 450, jagt: -1, wandRest: 0, wandWeg: null, angriff: null, strahl: [], strahlT: -1e9, ruheBis: 0 }
    })
  }

  /** Kein Level, das zurueckfallen koennte: was im freien Spiel Level kostet (Licht, Kegel, Wolke, Ameise, Bienen), ist hier vorbei */
  override setback(_n: number, grund: Parameters<Game['setback']>[1]) {
    const cause: Cause = grund === 'wolke' || grund === 'licht' || grund === 'kegel' || grund === 'ameise' || grund === 'bienen' ? grund : 'gegner'
    this.die(cause)
  }

  /** Nach einem Apfel kommt nichts dazu und nichts wechselt (Licht und Tuerme laufen nach der Zeit), nur das Ziel */
  protected override layout() {
    this.neuerApfel()
  }

  /** Fensterlicht: nie auf die Schlange, nicht nah vor den Kopf (auch nicht in seine Bahn). Passt kein anderes Fenster,
   *  bleibt das alte an (wenn es noch frei ist), sonst bleibt das Haus dunkel */
  protected override lichtFuer(h: Haus, erstes = false) {
    const head = this.body[0]
    const bau = this.bauSet()
    const weite = this.cfg.lichtWeite
    const frei = (s: P[]) => s.length >= weite && !s.some((p) => this.aufSchlange(p))
    for (const i of this.r.shuffle([0, 1, 2, 3].filter((i) => erstes || i !== h.licht))) {
      const s = this.strahlVon(h, i, bau)
      if (!frei(s) || s.some((p) => manhattan(p, head) <= 3 || this.imWeg(p, 5))) continue
      h.licht = i
      h.strahl = s
      h.lichtT = this.time
      return
    }
    const alt = h.licht >= 0 ? this.strahlVon(h, h.licht, bau) : []
    if (h.licht >= 0 && frei(alt)) {
      h.strahl = alt
      return
    }
    h.licht = -1
    h.strahl = []
    h.lichtT = this.time
  }

  /** Leuchtturm-Kegel (2 breit): endet nur an Bauten und am Rand. Er faellt auch ueber die Schlange, aber nur der Kopf
   *  nimmt Schaden (der Koerper liegt einfach im Licht). Dreht er sich auf den Kopf, ist es vorbei; dafuer zeigt er
   *  TURM_WARNUNG ms vorher, wohin er sich dreht */
  protected override kegel(t: Turm) {
    t.kegel = this.kegelFelder(t, t.dir)
    t.kegelT = this.time
  }

  protected kegelFelder(t: Turm, dir: Dir): P[] {
    const d = STEP[dir]
    const drin = new Set(t.cells.map((c) => key(c.x, c.y)))
    const vorn = t.cells.filter((c) => !drin.has(key(c.x + d.x, c.y + d.y)))
    const bau = this.bauSet()
    const out: P[] = []
    for (const s of vorn)
      for (let i = 1; i <= this.cfg.kegelLaenge; i++) {
        const c = { x: s.x + d.x * i, y: s.y + d.y * i }
        if (!this.inside(c) || bau.has(key(c.x, c.y))) break
        out.push(c)
      }
    return out
  }

  /** Stehende Baeume wachen auf, wenn der Kopf nah ist: dann kippen sie nach 1 bis 8 Sekunden */
  protected override baeumeTakt() {
    const h = this.body[0]
    for (const b of this.baeume) {
      if (!b.wartet || cheb(b.root, h) > BAUM_NAH) continue
      b.wartet = false
      b.kippBei = this.time + this.r.int(BAUM_TIMER[0], BAUM_TIMER[1])
    }
    super.baeumeTakt()
  }

  /** Zeitgesteuert: Lichtwechsel, Leuchttuerme drehen, Lava breitet sich aus, Giftwolken steigen aus den Quellen */
  protected missionTakt() {
    const t = this.time
    this.haeuser.forEach((h, i) => {
      if (t < this.lichtNext[i]) return
      this.lichtNext[i] = t + LICHT_TAKT
      const vorher = h.licht
      this.lichtFuer(h)
      if (h.licht !== vorher) this.emit({ type: 'light' })
    })
    this.tuerme.forEach((tu, i) => {
      // Kurz vorher ankuendigen, wohin das Licht gleich faellt
      if (t >= this.turmNext[i] - TURM_WARNUNG && !this.turmVorschau[i]) this.turmVorschau[i] = this.kegelFelder(tu, CW[tu.dir])
      if (t < this.turmNext[i]) return
      this.turmNext[i] = t + this.turmTakt
      this.turmVorschau[i] = null
      tu.altDir = tu.dir
      tu.dir = CW[tu.dir]
      this.kegel(tu)
      // Dreht er sich auf den Kopf: Treffer (nur der Kopf zaehlt)
      if (this.imKegel(this.body[0])) this.treffer(this.body[0])
    })
    if (this.lava.length && t >= this.lavaNext) {
      this.lavaNext = t + LAVA_TAKT
      this.lavaWachsen()
    }
    const h = this.body[0]
    for (const q of this.quellen) {
      const aktiv = this.wolken.some((w) => w.c.x === q.p.x && w.c.y === q.p.y)
      if (aktiv) continue
      if (q.next === Infinity) q.next = t + QUELLE_PAUSE
      if (t < q.next) continue
      // Nicht direkt neben dem Kopf aufsteigen
      if (cheb(q.p, h) <= 2 || this.aufSchlange(q.p)) {
        q.next = t + 800
        continue
      }
      q.next = Infinity
      this.wolken.push({ c: { ...q.p }, t, stage: 0, maxStage: this.mission.wolkeStufe ?? 2, nextAt: t + this.cfg.wolkeTakt * 1000, until: Infinity, cells: [{ ...q.p }], pending: [], bornAt: [t] })
      this.emit({ type: 'cloud' })
    }
    this.kaefigTakt()
  }

  /* ================= Kaefigkoepfe (ab Mission 22) ================= */

  /** Sieht der Kaefigkopf das Feld? Kegel nach vorn wie beim kleinen Steingolem (1 bis KAEFIG.sicht Felder, je weiter, desto breiter) */
  imKaefigBlick(z: Kaefig, c: P) {
    const d = STEP[z.dir]
    const vor = (c.x - z.p.x) * d.x + (c.y - z.p.y) * d.y
    const quer = Math.abs((c.x - z.p.x) * d.y - (c.y - z.p.y) * d.x)
    return vor >= 1 && vor <= KAEFIG.sicht && quer <= Math.ceil(vor / 2)
  }

  /** Strahl von z aus in Richtung d (eine der acht Richtungen der Dame): bis zur Wand, hoechstens KAEFIG.weite Felder */
  kaefigStrahl(z: Kaefig, d: P, sperre = this.sichtSperre()): P[] {
    const out: P[] = []
    for (let i = 1; i <= KAEFIG.weite; i++) {
      const c = { x: z.p.x + d.x * i, y: z.p.y + d.y * i }
      if (!this.inside(c) || sperre.has(key(c.x, c.y)) || this.tuerZu(c)) break
      out.push(c)
    }
    return out
  }

  /** Wohin er zielt: die Richtung der Dame, die am naechsten zum Kopf zeigt (liegt der Kopf nicht genau darauf, kann er vorbeischiessen) */
  protected kaefigZiel(z: Kaefig, h: P): P {
    const a = Math.round(Math.atan2(h.y - z.p.y, h.x - z.p.x) / (Math.PI / 4)) * (Math.PI / 4)
    return { x: Math.round(Math.cos(a)), y: Math.round(Math.sin(a)) }
  }

  protected kaefigDrehen(z: Kaefig, d: Dir) {
    if (d === z.dir) return
    z.altDir = z.dir
    z.dir = d
    z.drehT = this.time
  }

  /** Kaefigkoepfe schlendern geradeaus, biegen an Waenden ab, bleiben stehen, wenn sie den Kopf sehen, und werfen Strahlen */
  protected kaefigTakt() {
    if (!this.kaefige.length) return
    const t = this.time
    const h = this.body[0]
    let sperre: Set<number> | null = null
    let wand: Set<number> | null = null
    for (const z of this.kaefige) {
      // Der Strahl brennt kurz: nur der Kopf zaehlt
      if (z.strahl.length && t - z.strahlT < KAEFIG.strahl) {
        if (z.strahl.some((c) => c.x === h.x && c.y === h.y) && !this.geist()) {
          this.die('kaefigstrahl')
          return
        }
      } else if (z.strahl.length) z.strahl = []
      // Holt aus: steht still, dann geht der Strahl los
      if (z.angriff) {
        if (t < z.angriff.los) continue
        sperre ??= this.sichtSperre()
        z.strahl = this.kaefigStrahl(z, z.angriff.d, sperre)
        z.strahlT = t
        z.angriff = null
        z.ruheBis = t + KAEFIG.ruhe
        this.emit({ type: 'kaefig', was: 'strahl', p: { ...z.p } })
        if (z.strahl.some((c) => c.x === h.x && c.y === h.y) && !this.geist()) {
          this.die('kaefigstrahl')
          return
        }
        continue
      }
      sperre ??= this.sichtSperre()
      // Sehen: erst im Kegel nach vorn; hat er den Kopf, behaelt er ihn, solange er in Sichtweite ist und nichts dazwischen
      const nah = Math.max(Math.abs(h.x - z.p.x), Math.abs(h.y - z.p.y)) <= KAEFIG.sicht
      const sieht = (z.jagt >= 0 ? nah : this.imKaefigBlick(z, h)) && this.sichtFrei(z.p, h, sperre)
      if (sieht && z.jagt < 0) {
        z.jagt = t
        this.emit({ type: 'kaefig', was: 'sieht', p: { ...z.p } })
      } else if (!sieht && z.jagt >= 0) {
        z.jagt = -1
        z.next = Math.max(z.next, t + 400)
      }
      if (z.jagt >= 0) {
        // Bleibt stehen und schaut zum Kopf, ab und zu ein Strahl
        const dx = h.x - z.p.x
        const dy = h.y - z.p.y
        this.kaefigDrehen(z, Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : dy > 0 ? 'd' : 'u')
        if (t >= z.ruheBis && t - z.jagt >= 450) {
          const d = this.kaefigZiel(z, h)
          z.angriff = { d, cells: this.kaefigStrahl(z, d, sperre), ab: t, los: t + KAEFIG.laden }
          this.emit({ type: 'kaefig', was: 'laden', p: { ...z.p } })
        }
        continue
      }
      if (t < z.next) continue
      wand ??= this.hindernisse()
      this.kaefigSchritt(z, wand)
    }
  }

  /** Ein Schritt geradeaus. Vor einer Wand (oder einem Hindernis) biegt er ab und geht nach 2 bis 4 Feldern von ihr weg */
  protected kaefigSchritt(z: Kaefig, wand: Set<number>) {
    const t = this.time
    const frei = (d: Dir) => {
      const c = { x: z.p.x + STEP[d].x, y: z.p.y + STEP[d].y }
      return this.inside(c) && !wand.has(key(c.x, c.y)) && !this.aufSchlange(c) && cheb(c, this.body[0]) > 1
    }
    z.next = t + KAEFIG.takt + this.r.int(0, KAEFIG.stolpern)
    // An der Wand entlang: nach ein paar Feldern wieder weg von ihr
    if (z.wandWeg && --z.wandRest <= 0) {
      if (frei(z.wandWeg)) this.kaefigDrehen(z, z.wandWeg)
      z.wandWeg = null
    }
    if (!frei(z.dir)) {
      const seiten = this.r.shuffle([CW[z.dir], OPP[CW[z.dir]]]).filter(frei)
      if (seiten.length) {
        const weg = OPP[z.dir]
        this.kaefigDrehen(z, seiten[0])
        z.wandWeg = weg
        z.wandRest = this.r.int(KAEFIG.wand[0], KAEFIG.wand[1])
      } else if (frei(OPP[z.dir])) {
        this.kaefigDrehen(z, OPP[z.dir])
        z.wandWeg = null
      } else return
    }
    const n = { x: z.p.x + STEP[z.dir].x, y: z.p.y + STEP[z.dir].y }
    wand.delete(key(z.p.x, z.p.y))
    wand.add(key(n.x, n.y))
    z.from = { ...z.p }
    z.p = n
    z.schrittT = t
  }
}
