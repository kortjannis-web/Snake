/**
 * Boss der Dungeons (Mission 30): der Kaefigmeister im Labyrinth mit sechs Raeumen. Man muss ihn suchen, in seinem Raum
 * fuenf Flammen holen (jede fliegt auf ihn), dann verschwindet er und erscheint in einem zufaelligen Raum wieder, dreimal.
 * Ist er besiegt, geht oben die Tuer auf, hindurch = geschafft. Der Kampf selbst steckt in meisterkampf.ts (er laeuft
 * genauso im freien Spiel auf Level meisterAb), hier nur das Labyrinth der Mission.
 */
import { key } from './game'
import { MeisterRaum, Meisterkampf, MEISTER, type MeisterAngriffArt } from './meisterkampf'
import { MissionGame } from './mission'
import type { MissionDef } from './missionen'
import type { P } from './types'

export * from './meisterkampf'

export class KaefigBossGame extends MissionGame {
  readonly kampf: Meisterkampf

  constructor(m: MissionDef, quer = false) {
    super(m, quer)
    const halb = quer ? { x: 4, y: 5 } : { x: 5, y: 4 }
    const raeume: MeisterRaum[] = this.karte.raeume.map((c, nr) => ({ nr, mitte: { ...c }, x0: c.x - halb.x, y0: c.y - halb.y, x1: c.x + halb.x, y1: c.y + halb.y }))
    const spiel = this
    this.kampf = new Meisterkampf(
      {
        get time() {
          return spiel.time
        },
        get body() {
          return spiel.body
        },
        get dir() {
          return spiel.dir
        },
        get r() {
          return spiel.r
        },
        get status() {
          return spiel.status
        },
        inside: (c) => spiel.inside(c),
        sperre: () => spiel.sichtSperre(),
        belegt: () => spiel.hindernisse(),
        aufSchlange: (c) => spiel.aufSchlange(c),
        geist: () => spiel.geist(),
        emit: (e) => spiel.emit(e),
        verloren: () => spiel.die('kaefigmeister'),
        besiegt: () => spiel.meisterBesiegt(),
      },
      raeume,
      { flammen: MEISTER.flammen, leben: MEISTER.leben },
    )
    // Augen am Boden: meist an den Waenden und in Ecken, nicht am Start, nicht an der Tuer und nicht in der Raummitte
    const start = this.body[0]
    const zu = this.hindernisse()
    const felder: P[] = []
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.inside({ x, y }) && !zu.has(key(x, y)) && this.dungeonSet.has(key(x, y))) felder.push({ x, y })
    const cheb = (a: P, b: P) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
    this.augen = this.augenVerteilen(felder, (c) => cheb(c, start) <= 5 || this.tuer.some((t) => cheb(t, c) <= 2) || raeume.some((r) => cheb(r.mitte, c) <= 1))
  }

  /* Der Kampf (fuer Darstellung und Tests direkt am Spiel) */
  get meister() {
    return this.kampf.meister
  }
  get raeume() {
    return this.kampf.raeume
  }
  get flammen() {
    return this.kampf.flammen
  }
  get fluege() {
    return this.kampf.fluege
  }
  get da() {
    return this.kampf.da
  }
  imRaum(p: P, nr?: number) {
    return this.kampf.imRaum(p, nr)
  }
  raumInSicht(nr: number) {
    return this.kampf.raumInSicht(nr)
  }
  starte(art: MeisterAngriffArt) {
    this.kampf.starte(art)
  }
  strahl(p: P, winkel: number, breite: number) {
    return this.kampf.strahl(p, winkel, breite)
  }

  /** Boss-Level: gezaehlt werden seine Leben */
  override get uebrig() {
    return this.kampf?.meister.leben ?? MEISTER.leben
  }

  override update(dt: number) {
    super.update(dt)
    this.kampf.update()
  }

  /** Er ist im Weg (hineinfahren = vorbei) */
  override gefahr(n: P, rest: P[] = this.body) {
    if (this.kampf?.istHier(n) && !this.geist()) return 'kaefigmeister' as const
    return super.gefahr(n, rest)
  }

  override hindernisse(mitGegnern = true) {
    const s = super.hindernisse(mitGegnern)
    this.kampf?.belegtVon((p) => s.add(key(p.x, p.y)))
    return s
  }

  /** Kopf auf einer Flamme: sie fliegt auf ihn zu */
  protected override einsammeln(n: P) {
    super.einsammeln(n)
    this.kampf?.einsammeln(n)
  }

  /** Besiegt: die Tuer geht auf, der Pfeil zeigt dorthin */
  protected meisterBesiegt() {
    this.tuerAuf = this.time
    const m = this.tuer[Math.floor(this.tuer.length / 2)]
    if (m) this.emit({ type: 'tuerAuf', p: { ...m } })
    this.zielWaehlen()
  }
}
