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
 * Der Golem hat drei Leben, die Schlange keins extra: trifft eine Attacke den Kopf, ist es vorbei (der Koerper darf in der
 * roten Flaeche liegen). Berge und Tore sind wie immer toedlich.
 *
 * Der Kampf selbst steckt in golemkampf.ts (er laeuft genauso im freien Spiel auf Level 60), hier nur die Raeume der Mission.
 */
import { EntBossGame } from './entboss'
import { KaefigBossGame } from './kaefigboss'
import { key } from './game'
import { GOLEM, Golemkampf, RAUM_H, type GolemAngriffArt, type Pf, type Raum } from './golemkampf'
import { MissionGame } from './mission'
import type { MissionDef } from './missionen'
import type { P } from './types'

export * from './golemkampf'

export class BossGame extends MissionGame {
  readonly kampf: Golemkampf

  constructor(m: MissionDef, quer = false) {
    super(m, quer)
    const k = this.karte
    // Raeume: je RAUM_H Zeilen, Raum 0 ganz unten (quer: je RAUM_H Spalten, Raum 0 ganz links)
    const n = Math.max(1, Math.round((quer ? k.w : k.h) / RAUM_H))
    const raeume: Raum[] = Array.from({ length: n }, (_, nr) => {
      // a0 = erste Zeile (quer: Spalte) des Raums
      const a0 = quer ? RAUM_H * nr : k.h - RAUM_H * (nr + 1)
      const imBand = (p: P) => (quer ? p.x : p.y) >= a0 && (quer ? p.x : p.y) < a0 + RAUM_H
      const mitte = quer ? { x: a0 + RAUM_H / 2, y: Math.floor(k.h / 2) } : { x: Math.floor(k.w / 2), y: a0 + RAUM_H / 2 }
      const kreis = k.kreise.find(imBand) ?? mitte
      const golem = k.golems.find(imBand) ?? (quer ? { x: a0 + RAUM_H - 6, y: mitte.y } : { x: mitte.x, y: a0 + 5 })
      // Tor nach oben (quer: nach rechts): liegt auf den beiden Randzeilen zwischen diesem und dem naechsten Raum
      const tor = quer ? k.tore.filter((p) => p.x === a0 + RAUM_H - 1 || p.x === a0 + RAUM_H) : k.tore.filter((p) => p.y === a0 || p.y === a0 - 1)
      return {
        nr,
        ...(quer ? { x0: a0, x1: a0 + RAUM_H - 1, y0: -1, y1: k.h } : { x0: -1, x1: k.w, y0: a0, y1: a0 + RAUM_H - 1 }),
        kreis: { p: { ...kreis }, r: GOLEM.bannR },
        sockel: k.sockel.filter((s) => imBand(s.p)).sort((a, b) => a.i - b.i).map((s) => ({ p: { ...s.p }, farbe: s.i, an: false, t: -1e9 })),
        golem: { ...golem },
        plaetze: k.plaetze.filter(imBand).map((p) => ({ ...p })),
        tor: tor.length ? { cells: tor.map((p) => ({ ...p })), offen: false, t: -1e9 } : null,
      }
    })
    const spiel = this
    this.kampf = new Golemkampf(
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
        // Wo ein kleiner Golem steht, tritt der grosse nicht hin
        frei: (c) => !spiel.minigolems.some((g) => g.p.x === c.x && g.p.y === c.y),
        emit: (e) => spiel.emit(e),
        verloren: () => spiel.die('steingolem'),
        besiegt: () => spiel.geschafft(),
      },
      raeume,
      { sperre: k.sperre.map((p) => key(p.x, p.y)), quer },
    )
    this.kampf.kristallAb = 700
  }

  /* Der Kampf (fuer Darstellung und Tests wie bisher direkt am Spiel) */
  get golem() {
    return this.kampf.golem
  }
  get kristalle() {
    return this.kampf.kristalle
  }
  get traegt() {
    return this.kampf.traegt
  }
  set traegt(v: number[]) {
    this.kampf.traegt = v
  }
  get raeume() {
    return this.kampf.raeume
  }
  get raumNr() {
    return this.kampf.raumNr
  }
  set raumNr(v: number) {
    this.kampf.raumNr = v
  }
  get leben() {
    return this.kampf.leben
  }
  set leben(v: number) {
    this.kampf.leben = v
  }
  get brocken() {
    return this.kampf.brocken
  }
  get wellen() {
    return this.kampf.wellen
  }
  get aktuell() {
    return this.kampf.aktuell
  }
  get sockel() {
    return this.kampf.sockel
  }
  get kreis() {
    return this.kampf.kreis
  }
  get kreisAktiv() {
    return this.kampf.kreisAktiv
  }
  get verwundbar() {
    return this.kampf.verwundbar
  }
  get fliegt() {
    return this.kampf.fliegt
  }
  imRaum(c: P, r = this.raumNr) {
    return this.kampf.imRaum(c, r)
  }
  torZu(c: P) {
    return this.kampf.torZu(c)
  }
  golemFelder(x?: number, y?: number) {
    return this.kampf.golemFelder(x, y)
  }
  kreisFelder(m: Pf, r: number) {
    return this.kampf.kreisFelder(m, r)
  }
  streifenFelder(a: Pf, b: Pf) {
    return this.kampf.streifenFelder(a, b)
  }
  brockenFelder(b: Parameters<Golemkampf['brockenFelder']>[0]) {
    return this.kampf.brockenFelder(b)
  }
  starte(art: GolemAngriffArt, warn = 1) {
    this.kampf.starte(art, warn)
  }
  schaden(p?: Pf) {
    return this.kampf.schaden(p)
  }
  kameraZiel(kopf: Pf): Pf {
    return this.kampf.kameraZiel(kopf)
  }
  /** Die Kamera folgt dem Kopf, bleibt aber im Raum (Felder, einschliesslich) */
  kameraBox(kopf: Pf) {
    const r = this.kampf.kameraRaum(kopf)
    return { x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1 }
  }

  /** Geschlossene Tore sind wie Wand */
  override gefahr(n: P, rest: P[] = this.body) {
    if (this.kampf?.torZu(n)) return 'steintor' as const
    return super.gefahr(n, rest)
  }

  /** Boss-Level: es gibt keine Aepfel, gezaehlt werden die Treffer am Golem */
  override get uebrig() {
    return this.kampf?.golem.hp ?? GOLEM.leben
  }

  override update(dt: number) {
    const vorher = this.time
    super.update(dt)
    this.kampf.update(this.time - vorher)
  }

  /** Von der normalen Welt nur die kleinen Steingolems (in Raum 2 und 3) */
  protected override umweltTakt() {
    this.minigolemTakt()
  }

  /** Kleine Golems bleiben in ihrem Raum (nie aufs Tor) und gehen dem grossen aus dem Weg */
  protected override golemFrei(c: P, wand: Set<number>) {
    if (!super.golemFrei(c, wand)) return false
    if (this.karte.tore.some((t) => t.x === c.x && t.y === c.y)) return false
    const g = this.kampf?.golem
    return !g || Math.abs(c.x - Math.round(g.x)) > 2 || Math.abs(c.y - Math.round(g.y)) > 2
  }

  /** Kopf auf einem Kristall: aufheben. Auf einem Sockel: passenden Kristall einsetzen. Durch den gebannten Golem: Treffer */
  protected override einsammeln(n: P) {
    super.einsammeln(n)
    this.kampf?.einsammeln(n)
  }
}

/** Das passende Spiel zur Mission: Boss-Level mit Golem oder Ent, sonst die normale Mission */
export const missionSpiel = (m: MissionDef, quer = false): MissionGame =>
  m.dungeonBoss ? new KaefigBossGame(m, quer) : m.art === 'boss' ? (m.boss === 'ent' ? new EntBossGame(m, quer) : new BossGame(m, quer)) : new MissionGame(m, quer)
