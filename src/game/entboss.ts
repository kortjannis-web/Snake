/**
 * Boss des Waldes (Mission 20): der Ent auf einer Waldlichtung (Bloecke nach BOSS_BILD, gezeigt in derselben Feldgroesse
 * wie die anderen Missionen, die Kamera folgt dem Kopf ueber die Lichtung).
 * Drei Phasen, je Phase ein Treffer (siehe entkampf.ts):
 * - Phase 1: Flamme an der Glutschale holen, die 3 Holzstapel anzuenden. Brennen alle gleichzeitig, faengt seine Rinde
 *   Feuer und der Herzknoten liegt frei: durch ihn hindurchfahren
 * - Phase 2: ein vierter Stapel kommt dazu. Schiesst er eine Wurzel durch ein brennendes Feuer, laeuft die Flamme zu ihm
 *   zurueck. Er wandert zwischen den alten Baumstuempfen, dazu Rankenwaende, Setzlinge und Laubsturm
 * - Phase 3: dichtere Linien, kuerzere Warnungen, die Lichtung waechst von aussen zu
 * Zwei Mini-Ents stehen mit auf der Lichtung (Blaetterbomben, Greifen). Der Ent hat drei Leben, die Schlange keins extra:
 * ein Treffer am Kopf ist vorbei.
 */
import { key } from './game'
import { ENT, Entkampf, type Lichtung } from './entkampf'
import { MissionGame } from './mission'
import type { MissionDef } from './missionen'
import type { P } from './types'

export * from './entkampf'

export class EntBossGame extends MissionGame {
  readonly kampf: Entkampf

  constructor(m: MissionDef, quer = false) {
    super(m, quer)
    const k = this.karte
    const felder: P[] = []
    for (let y = 0; y < k.h; y++) for (let x = 0; x < k.w; x++) if (this.inside({ x, y })) felder.push({ x, y })
    const mitte = { x: Math.floor(k.w / 2), y: Math.floor(k.h / 2) }
    const lichtung: Lichtung = {
      felder,
      schale: { ...(k.schale ?? mitte) },
      feuer: k.holz.map((h) => ({ p: { ...h.p }, ab: h.ab })),
      stuempfe: [k.ent ?? { x: mitte.x, y: 3 }, ...k.stuempfe].map((p) => ({ ...p })),
    }
    const spiel = this
    const ents = new Set(this.minients.map((e) => key(e.p.x, e.p.y)))
    this.kampf = new Entkampf(
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
        get w() {
          return spiel.w
        },
        get h() {
          return spiel.h
        },
        get schutzBis() {
          return spiel.schutzBis
        },
        set schutzBis(v: number) {
          spiel.schutzBis = v
        },
        inside: (c) => spiel.inside(c),
        frei: (c) => !ents.has(key(c.x, c.y)),
        emit: (e) => spiel.emit(e),
        verloren: () => spiel.die('entboss'),
        besiegt: () => spiel.geschafft(),
      },
      lichtung,
    )
  }

  /** Boss-Level: es gibt keine Aepfel, gezaehlt werden die Treffer am Ent */
  override get uebrig() {
    return this.kampf?.ent.hp ?? ENT.leben
  }

  kameraZiel() {
    return this.kampf.kameraZiel()
  }
  /** Die Kamera folgt dem Kopf, bleibt aber ueber der Lichtung */
  kameraBox() {
    return this.kampf.box
  }

  /** Rankenwaende und zugewachsenes Dickicht sind wie Wand */
  override gefahr(n: P, rest: P[] = this.body) {
    if (this.kampf?.istWand(n)) return 'ranke' as const
    return super.gefahr(n, rest)
  }

  override update(dt: number) {
    const vorher = this.time
    super.update(dt)
    this.kampf.update(this.time - vorher)
  }

  /** Von der normalen Welt nur die Mini-Ents */
  protected override umweltTakt() {
    this.minientTakt()
  }

  /** Waehrend man geschuetzt ist (gleich nach einem Treffer am Ent), packt kein Mini-Ent zu */
  protected override griffErlaubt() {
    return super.griffErlaubt() && this.time >= this.schutzBis
  }

  /** Kopf auf der Glutschale: Flamme. Auf einem Holzstapel: anzuenden. Am brennenden Ent: Treffer */
  protected override einsammeln(n: P) {
    super.einsammeln(n)
    this.kampf?.einsammeln(n)
  }
}
