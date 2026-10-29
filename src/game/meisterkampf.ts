/**
 * Der Kampf gegen den Kaefigmeister, unabhaengig davon, wo er stattfindet: im Labyrinth der Mission 30 (sechs Raeume, fuenf
 * Flammen je Leben) oder im freien Spiel (Wiese, Level meisterAb: drei Kerker-Raeume, zwei Flammen je Leben).
 * - er erscheint in einem zufaelligen seiner Raeume (nur dort, wo man ihn gerade nicht sieht), man muss ihn suchen
 * - betritt man seinen Raum, erwacht er. Im Raum liegen Flammen (hoechstens zwei gleichzeitig): jede, die man holt, fliegt
 *   auf ihn zu und trifft ihn. Sind es genug, verliert er ein Leben und verschwindet
 * - danach erscheint er wieder in einem zufaelligen Raum, auch im selben, aber erst, wenn man diesen Raum nicht mehr sieht
 * - drei Leben, dann ist er besiegt
 * Angriffe (nur, solange der Kopf in seinem Raum ist, alle rot angekuendigt, nur der Kopf zaehlt):
 * - duenner Strahl: kurz geladen, ein Feld breit zum Kopf hin, bis zur Wand
 * - dicker Strahl: 1,5 s geladen, drei Felder breit
 * - Runenzauber: drei Kreise (3 x 3) am Kopf, dort, wo er hinfaehrt, und daneben, dann platzen sie
 * - Teleport: er verschwindet und taucht an einer anderen Stelle im Raum wieder auf
 * Hineinfahren ist vorbei. Was den Strahl aufhaelt (Saeulen, Regale), sagt der Wirt.
 * Was der Kampf vom Spiel braucht, kommt wie beim Golem und beim Ent ueber den `MeisterWirt`.
 */
import type { Rng } from './rng'
import type { Dir, GameEvent, P, Status } from './types'

const key = (x: number, y: number) => (y + 1) * 4096 + (x + 1)
const STEP: Record<Dir, P> = { u: { x: 0, y: -1 }, d: { x: 0, y: 1 }, l: { x: -1, y: 0 }, r: { x: 1, y: 0 } }
const DIRS: Dir[] = ['u', 'd', 'l', 'r']

/** Alle Zeiten in ms */
export const MEISTER = {
  leben: 3,
  /** Flammen je Leben, so viele liegen hoechstens gleichzeitig, so lange fliegt eine zu ihm */
  flammen: 5,
  aufFeld: 2,
  flug: 520,
  erscheinen: 900,
  erwachen: 900,
  pause: 1100,
  duennLaden: 600,
  duennBrennt: 360,
  dickLaden: 1500,
  dickBrennt: 460,
  aoeLaden: 1150,
  aoeBrennt: 320,
  teleportWeg: 450,
  teleportDa: 450,
  getroffen: 1200,
  /** Sieht man ihn zum ersten Mal (je Erscheinen), steht er kurz und lacht, den Kopf im Kaefig in den Nacken gelegt */
  lachen: 1700,
  /** So weit um seinen Raum herum sieht man ihn: erst ausserhalb erscheint er dort */
  sicht: 6,
  /** Strahlen reichen hoechstens so weit */
  weite: 24,
} as const

export type MeisterAngriffArt = 'duenn' | 'dick' | 'aoe' | 'teleport'
export type MeisterRaum = { nr: number; mitte: P; x0: number; y0: number; x1: number; y1: number }
export type MeisterAngriff = {
  art: MeisterAngriffArt
  /** Angekuendigt ab, geht los bei, vorbei bei */
  ab: number
  los: number
  bis: number
  /** Gefaehrliche Felder (Strahl oder Runenkreise), Mitten der Runenkreise, Richtung des Strahls (Bogenmass) */
  cells: P[]
  kreise: P[]
  winkel: number
  /** Teleport: wohin */
  ziel: P | null
}
export type MeisterZustand = 'weg' | 'erscheint' | 'wartet' | 'kampf' | 'getroffen' | 'tot'
export type Meister = {
  zustand: MeisterZustand
  /** Seit wann im Zustand */
  t: number
  raum: number
  p: P
  /** Vor dem letzten Teleport (Darstellung) */
  von: P
  leben: number
  /** Flammen, die ihn in diesem Leben schon getroffen haben */
  treffer: number
  /** Schaut zum Kopf (Bogenmass) */
  winkel: number
  angriff: MeisterAngriff | null
  next: number
  letzte: MeisterAngriffArt | null
  /** Letzter Flammentreffer (Aufblitzen) */
  trefferT: number
  /** Seit wann er lacht (je Erscheinen einmal, sobald man ihn sieht) */
  lachT: number
}

export type MeisterWirt = {
  readonly time: number
  readonly body: P[]
  readonly dir: Dir
  readonly r: Rng
  readonly status: Status
  inside(c: P): boolean
  /** Was Strahlen aufhaelt (Waende, Saeulen, Regale ...) */
  sperre(): Set<number>
  /** Wo nichts hin darf (Flammen, Teleport): Hindernisse */
  belegt(): Set<number>
  aufSchlange(c: P): boolean
  geist(): boolean
  emit(e: GameEvent): void
  /** Ein Angriff trifft den Kopf */
  verloren(): void
  /** Kein Leben mehr */
  besiegt(): void
}

export class Meisterkampf {
  meister: Meister
  /** Flammen im Raum, Flammen im Flug zu ihm (von wo, seit wann) */
  flammen: { p: P; t: number }[] = []
  fluege: { von: P; t: number }[] = []
  /** Flammen dieses Lebens, die schon geholt sind (auch die im Flug) */
  protected geholt = 0
  /** So viele Flammen kosten ihn ein Leben */
  readonly flammenJeLeben: number

  constructor(
    protected readonly wirt: MeisterWirt,
    readonly raeume: MeisterRaum[],
    o: { flammen?: number; leben?: number } = {},
  ) {
    this.flammenJeLeben = o.flammen ?? MEISTER.flammen
    const raum = wirt.r.int(0, Math.max(0, raeume.length - 1))
    const p = raeume[raum]?.mitte ?? { x: 0, y: 0 }
    this.meister = { zustand: 'weg', t: wirt.time, raum, p: { ...p }, von: { ...p }, leben: o.leben ?? MEISTER.leben, treffer: 0, winkel: Math.PI / 2, angriff: null, next: 0, letzte: null, trefferT: -1e9, lachT: -1e9 }
  }

  /** Ist p in Raum nr? */
  imRaum(p: P, nr = this.meister.raum) {
    const r = this.raeume[nr]
    return !!r && p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1
  }

  /** Sieht man Raum nr gerade (Kopf im Raum oder nah davor)? */
  raumInSicht(nr: number) {
    const r = this.raeume[nr]
    const h = this.wirt.body[0]
    const s = MEISTER.sicht
    return !!r && h.x >= r.x0 - s && h.x <= r.x1 + s && h.y >= r.y0 - s && h.y <= r.y1 + s
  }

  /** Ist er gerade da (sichtbar und im Weg)? Beim Teleport ist er kurz weg */
  get da() {
    const M = this.meister
    if (M.zustand !== 'erscheint' && M.zustand !== 'wartet' && M.zustand !== 'kampf') return false
    const a = M.angriff
    return !(a?.art === 'teleport' && this.wirt.time >= a.ab + MEISTER.teleportWeg && this.wirt.time < a.los)
  }

  /** Steht er hier (hineinfahren = vorbei)? */
  istHier(n: P) {
    return this.da && n.x === this.meister.p.x && n.y === this.meister.p.y
  }

  /** Felder, die belegt sind (er selbst und die Flammen) */
  belegtVon(add: (p: P) => void) {
    if (this.da) add(this.meister.p)
    for (const f of this.flammen) add(f.p)
  }

  /** Kopf auf einer Flamme: sie fliegt auf ihn zu */
  einsammeln(n: P) {
    const i = this.flammen.findIndex((f) => f.p.x === n.x && f.p.y === n.y)
    if (i < 0) return
    this.flammen.splice(i, 1)
    this.fluege.push({ von: { ...n }, t: this.wirt.time })
    this.geholt++
    this.wirt.emit({ type: 'meister', was: 'flamme', p: { ...n } })
    this.flammenNachlegen()
  }

  /** Karte verschoben (freies Spiel) */
  verschieben(dx: number, dy: number) {
    const mv = (p: P) => {
      p.x += dx
      p.y += dy
    }
    const M = this.meister
    mv(M.p)
    mv(M.von)
    if (M.angriff) {
      M.angriff.cells.forEach(mv)
      M.angriff.kreise.forEach(mv)
      if (M.angriff.ziel) mv(M.angriff.ziel)
    }
    for (const r of this.raeume) {
      mv(r.mitte)
      r.x0 += dx
      r.x1 += dx
      r.y0 += dy
      r.y1 += dy
    }
    this.flammen.forEach((f) => mv(f.p))
    this.fluege.forEach((f) => mv(f.von))
  }

  update() {
    if (this.wirt.status === 'play') this.meisterTakt()
  }

  /** Bis zu zwei Flammen im Raum, insgesamt so viele, wie ein Leben kostet */
  protected flammenNachlegen() {
    const M = this.meister
    const r = this.raeume[M.raum]
    if (!r || M.zustand !== 'kampf') return
    const h = this.wirt.body[0]
    const zu = this.wirt.belegt()
    while (this.flammen.length < MEISTER.aufFeld && this.geholt + this.flammen.length < this.flammenJeLeben) {
      const frei: P[] = []
      for (let y = r.y0; y <= r.y1; y++)
        for (let x = r.x0; x <= r.x1; x++) {
          const c = { x, y }
          if (!this.wirt.inside(c) || zu.has(key(x, y)) || this.wirt.aufSchlange(c)) continue
          if (Math.max(Math.abs(x - h.x), Math.abs(y - h.y)) < 3 || Math.max(Math.abs(x - M.p.x), Math.abs(y - M.p.y)) < 2) continue
          // Nicht in eine Ecke, aus der man nicht wieder herauskommt
          if (DIRS.filter((d) => this.wirt.inside({ x: x + STEP[d].x, y: y + STEP[d].y }) && !zu.has(key(x + STEP[d].x, y + STEP[d].y))).length < 3) continue
          frei.push(c)
        }
      if (!frei.length) return
      const p = this.wirt.r.pick(frei)
      this.flammen.push({ p, t: this.wirt.time })
      zu.add(key(p.x, p.y))
    }
  }

  protected meisterTakt() {
    const M = this.meister
    const t = this.wirt.time
    const h = this.wirt.body[0]
    // Flammen im Flug treffen ihn
    for (const f of [...this.fluege]) {
      if (t - f.t < MEISTER.flug) continue
      this.fluege.splice(this.fluege.indexOf(f), 1)
      if (M.zustand !== 'kampf') continue
      M.treffer++
      M.trefferT = t
      this.wirt.emit({ type: 'meister', was: 'trifft', p: { ...M.p } })
      if (M.treffer >= this.flammenJeLeben) {
        this.lebenWeg()
        return
      }
    }
    switch (M.zustand) {
      case 'weg':
        // Erscheint erst, wenn man seinen Raum nicht sieht
        if (this.raumInSicht(M.raum)) return
        M.zustand = 'erscheint'
        M.t = t
        M.p = { ...this.raeume[M.raum].mitte }
        M.von = { ...M.p }
        this.wirt.emit({ type: 'meister', was: 'erscheint', p: { ...M.p } })
        return
      case 'erscheint':
        if (t - M.t >= MEISTER.erscheinen) {
          M.zustand = 'wartet'
          M.t = t
        }
        return
      case 'wartet':
        // Sieht man ihn, lacht er erst einmal (steht still, der Kopf im Kaefig liegt im Nacken)
        if (M.lachT < M.t && this.raumInSicht(M.raum)) {
          M.lachT = t
          this.wirt.emit({ type: 'meister', was: 'lacht', p: { ...M.p } })
        }
        if (!this.imRaum(h)) return
        M.zustand = 'kampf'
        M.t = t
        // Waehrend er lacht, greift er noch nicht an
        M.next = Math.max(t + MEISTER.erwachen, M.lachT + MEISTER.lachen)
        this.wirt.emit({ type: 'meister', was: 'erwacht', p: { ...M.p } })
        this.flammenNachlegen()
        return
      case 'getroffen':
        if (t - M.t < MEISTER.getroffen) return
        // Neuer Raum, zufaellig (auch derselbe): dort erscheint er, sobald man ihn nicht sieht
        M.zustand = 'weg'
        M.t = t
        M.raum = this.wirt.r.int(0, this.raeume.length - 1)
        return
      case 'kampf':
        if (t < M.lachT + MEISTER.lachen) return
        if (M.angriff?.art !== 'teleport') M.winkel = Math.atan2(h.y - M.p.y, h.x - M.p.x)
        this.angriffTakt()
        return
    }
  }

  /** Genug Flammen: ein Leben weniger, er verschwindet. Kein Leben mehr: besiegt */
  protected lebenWeg() {
    const M = this.meister
    M.leben--
    M.treffer = 0
    M.angriff = null
    M.t = this.wirt.time
    this.flammen = []
    this.fluege = []
    this.geholt = 0
    this.wirt.emit({ type: 'meister', was: M.leben > 0 ? 'getroffen' : 'tot', p: { ...M.p }, leben: M.leben })
    if (M.leben > 0) {
      M.zustand = 'getroffen'
      return
    }
    M.zustand = 'tot'
    this.wirt.besiegt()
  }

  protected angriffTakt() {
    const M = this.meister
    const t = this.wirt.time
    const h = this.wirt.body[0]
    const a = M.angriff
    if (a) {
      if (a.art === 'teleport') {
        if (a.ziel && t >= a.los) {
          // Ist der Kopf inzwischen dorthin gefahren, sucht er sich jetzt eine andere Stelle (nie direkt vor den Kopf)
          if (!this.teleportOk(a.ziel)) a.ziel = this.teleportZiel()
          M.von = { ...M.p }
          if (a.ziel) M.p = { ...a.ziel }
          a.ziel = null
          this.wirt.emit({ type: 'meister', was: 'teleport', p: { ...M.p } })
        }
      } else if (t >= a.los && t < a.bis) {
        if (a.cells.some((c) => c.x === h.x && c.y === h.y) && !this.wirt.geist()) {
          this.wirt.verloren()
          return
        }
      }
      if (t >= a.bis) {
        M.angriff = null
        M.next = t + MEISTER.pause
      }
      return
    }
    // Neue Attacke nur, solange der Kopf im Raum ist
    if (t < M.next || !this.imRaum(h)) return
    this.starte(this.waehle())
  }

  /** Welche Attacke: nie zweimal dieselbe, ganz nah lieber Teleport oder Runen */
  protected waehle(): MeisterAngriffArt {
    const M = this.meister
    const h = this.wirt.body[0]
    const nah = Math.max(Math.abs(h.x - M.p.x), Math.abs(h.y - M.p.y)) <= 2
    const gewicht: [MeisterAngriffArt, number][] = [
      ['duenn', nah ? 1 : 3],
      ['dick', nah ? 0.5 : 2],
      ['aoe', 2],
      ['teleport', nah ? 3 : 1.2],
    ]
    const liste = gewicht.filter(([art]) => art !== M.letzte)
    let w = this.wirt.r.next() * liste.reduce((s, [, g]) => s + g, 0)
    for (const [art, g] of liste) {
      w -= g
      if (w <= 0) return art
    }
    return liste[0][0]
  }

  /** Attacke ankuendigen (auch von aussen, zum Testen) */
  starte(art: MeisterAngriffArt) {
    const M = this.meister
    const t = this.wirt.time
    const h = this.wirt.body[0]
    M.letzte = art
    const winkel = Math.atan2(h.y - M.p.y, h.x - M.p.x)
    const leer = { cells: [] as P[], kreise: [] as P[], winkel, ziel: null }
    if (art === 'duenn') M.angriff = { ...leer, art, ab: t, los: t + MEISTER.duennLaden, bis: t + MEISTER.duennLaden + MEISTER.duennBrennt, cells: this.strahl(M.p, winkel, 0) }
    else if (art === 'dick') M.angriff = { ...leer, art, ab: t, los: t + MEISTER.dickLaden, bis: t + MEISTER.dickLaden + MEISTER.dickBrennt, cells: this.strahl(M.p, winkel, 1) }
    else if (art === 'aoe') {
      const d = STEP[this.wirt.dir]
      const vorn = { x: h.x + d.x * 3, y: h.y + d.y * 3 }
      const seite = { x: h.x + this.wirt.r.int(-3, 3), y: h.y + this.wirt.r.int(-3, 3) }
      const kreise = [{ ...h }, vorn, seite]
      const cells: P[] = []
      const drin = new Set<number>()
      for (const k of kreise)
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const c = { x: k.x + dx, y: k.y + dy }
            if (!this.wirt.inside(c) || drin.has(key(c.x, c.y))) continue
            drin.add(key(c.x, c.y))
            cells.push(c)
          }
      M.angriff = { ...leer, art, ab: t, los: t + MEISTER.aoeLaden, bis: t + MEISTER.aoeLaden + MEISTER.aoeBrennt, cells, kreise }
    } else {
      const ziel = this.teleportZiel()
      if (!ziel) {
        M.next = t + 300
        return
      }
      M.angriff = { ...leer, art, ab: t, los: t + MEISTER.teleportWeg, bis: t + MEISTER.teleportWeg + MEISTER.teleportDa, ziel }
    }
    this.wirt.emit({ type: 'meister', was: art === 'teleport' ? 'weg' : art === 'aoe' ? 'aoe' : 'laden', p: { ...M.p } })
  }

  /** Strahl von p in Richtung winkel bis zur Wand (breite 0 = ein Feld, 1 = drei Felder) */
  strahl(p: P, winkel: number, breite: number): P[] {
    const sperre = this.wirt.sperre()
    const dx = Math.cos(winkel)
    const dy = Math.sin(winkel)
    const out: P[] = []
    const drin = new Set<number>()
    const quer = Math.abs(dx) >= Math.abs(dy) ? { x: 0, y: 1 } : { x: 1, y: 0 }
    for (let s = 0.5; s <= MEISTER.weite; s += 0.4) {
      const c = { x: Math.round(p.x + dx * s), y: Math.round(p.y + dy * s) }
      if (c.x === p.x && c.y === p.y) continue
      if (!this.wirt.inside(c) || sperre.has(key(c.x, c.y))) break
      for (let o = -breite; o <= breite; o++) {
        const q = { x: c.x + quer.x * o, y: c.y + quer.y * o }
        if (!this.wirt.inside(q) || sperre.has(key(q.x, q.y)) || drin.has(key(q.x, q.y))) continue
        drin.add(key(q.x, q.y))
        out.push(q)
      }
    }
    return out
  }

  /** Darf er hier auftauchen? Weit genug vom Kopf und nicht in seiner Bahn */
  protected teleportOk(p: P) {
    const h = this.wirt.body[0]
    if (Math.max(Math.abs(p.x - h.x), Math.abs(p.y - h.y)) < 5) return false
    const d = STEP[this.wirt.dir]
    for (let i = 1; i <= 6; i++) if (p.x === h.x + d.x * i && p.y === h.y + d.y * i) return false
    // Nie direkt neben eine Flamme (man soll sie holen koennen)
    if (this.flammen.some((f) => Math.max(Math.abs(f.p.x - p.x), Math.abs(f.p.y - p.y)) <= 1)) return false
    return !this.wirt.belegt().has(key(p.x, p.y))
  }

  /** Freies Feld im Raum, weit genug vom Kopf, mit Platz drumherum */
  protected teleportZiel(): P | null {
    const M = this.meister
    const r = this.raeume[M.raum]
    const zu = this.wirt.belegt()
    const frei: P[] = []
    for (let y = r.y0; y <= r.y1; y++)
      for (let x = r.x0; x <= r.x1; x++) {
        const c = { x, y }
        if (!this.wirt.inside(c) || zu.has(key(x, y)) || this.wirt.aufSchlange(c)) continue
        if (!this.teleportOk(c) || (x === M.p.x && y === M.p.y)) continue
        if (!DIRS.every((d) => this.wirt.inside({ x: x + STEP[d].x, y: y + STEP[d].y }))) continue
        frei.push(c)
      }
    return frei.length ? this.wirt.r.pick(frei) : null
  }
}
