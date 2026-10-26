import { describe, expect, it } from 'vitest'
import { BossGame, missionSpiel } from '../src/game/boss'
import { ENT, EntBossGame } from '../src/game/entboss'
import { Game } from '../src/game/game'
import { MissionGame } from '../src/game/mission'
import { WIESE_MISSIONEN } from '../src/game/missionen'
import { DEFAULTS, DIRS, OPP, STEP } from '../src/game/rules'
import type { Dir, P } from '../src/game/types'

type Innen = {
  einsammeln(n: P): void
  eat(n: P): void
  expand(): void
  minientSetzen(p: P): void
}
const innen = (g: Game) => g as unknown as Innen

const lauf = (g: Game, ms: number) => {
  for (let t = 0; t < ms && g.status === 'play'; t += 20) g.update(20)
}
const setzeSchlange = (g: Game, kopf: P, dir: Dir = 'u') => {
  const hinten = STEP[OPP[dir]]
  g.body = [0, 1, 2].map((i) => ({ x: kopf.x + hinten.x * i, y: kopf.y + hinten.y * i }))
  g.prev = g.body.map((p) => ({ ...p }))
  g.dir = dir
  g.queue = []
}
/** Ent-Mission, die Schlange steht still, die Mini-Ents tun nichts */
function entSpiel() {
  const g = missionSpiel(WIESE_MISSIONEN[19]) as EntBossGame
  g.tick = 1e12
  for (const e of g.minients) {
    e.wurfNext = Infinity
    e.griffPause = Infinity
  }
  return g
}
/** Ent sofort bereit, ohne dass er von selbst angreift */
const ruhigerEnt = (g: EntBossGame) => {
  const k = g.kampf
  lauf(g, 40)
  k.ent.zustand = 'bereit'
  k.ent.bis = 1e12
  return k
}

describe('Ent (Mission 20)', () => {
  it('Lichtung: Ent oben, 5 Stuempfe, Glutschale in der Mitte, 3 Holzstapel (ab Phase 2 vier), 2 Mini-Ents, Bild wie beim Golem', () => {
    const m = WIESE_MISSIONEN[19]
    const g = missionSpiel(m)
    expect(g).toBeInstanceOf(EntBossGame)
    expect(missionSpiel(WIESE_MISSIONEN[9])).toBeInstanceOf(BossGame)
    const k = (g as EntBossGame).kampf
    expect(k.stuempfe).toHaveLength(5)
    expect(k.ent.y).toBeLessThan(g.h / 4)
    expect(k.feuer).toHaveLength(4)
    expect(k.aktiveFeuer).toHaveLength(3)
    expect(Math.abs(k.schale.y - g.h / 2)).toBeLessThanOrEqual(2)
    expect(g.minients).toHaveLength(2)
    // Ganz im Bild: ein Raum 17 x 32 wie beim Golem
    expect(g.w).toBe(17)
    expect(g.h).toBe(32)
    expect(g.uebrig).toBe(ENT.leben)
    expect(k.leben).toBe(ENT.herzen)
    // Querformat: gedreht, gleich viel von allem
    const q = missionSpiel(m, true) as EntBossGame
    expect(q.w).toBe(32)
    expect(q.kampf.feuer).toHaveLength(4)
  })

  it('Glutschale gibt eine Flamme, damit brennt ein Holzstapel 15 Sekunden', () => {
    const g = entSpiel()
    const k = ruhigerEnt(g)
    const f = k.aktiveFeuer[0]
    innen(g).einsammeln(f.p)
    expect(f.an).toBe(false)
    innen(g).einsammeln(k.schale)
    expect(k.traegt).toBe(true)
    innen(g).einsammeln(f.p)
    expect(f.an).toBe(true)
    expect(k.traegt).toBe(false)
    lauf(g, ENT.feuerBrennt - 500)
    expect(f.an).toBe(true)
    lauf(g, 1000)
    expect(f.an).toBe(false)
    // Der Stapel fuer Phase 2 laesst sich in Phase 1 nicht anzuenden
    const spaet = k.feuer.find((x) => x.ab === 1)!
    innen(g).einsammeln(k.schale)
    innen(g).einsammeln(spaet.p)
    expect(spaet.an).toBe(false)
  })

  it('Phase 1: brennen alle drei Stapel, brennt seine Rinde; durch ihn hindurch = Treffer, dann Phase 2', () => {
    const g = entSpiel()
    const k = ruhigerEnt(g)
    for (const f of k.aktiveFeuer) {
      innen(g).einsammeln(k.schale)
      innen(g).einsammeln(f.p)
    }
    lauf(g, 40)
    expect(k.ent.zustand).toBe('brennt')
    expect(k.verwundbar).toBe(true)
    // Die Stapel sind aufgebraucht
    expect(k.feuer.every((f) => !f.an)).toBe(true)
    innen(g).einsammeln({ x: k.ent.x, y: k.ent.y + 1 })
    expect(k.ent.hp).toBe(ENT.leben - 1)
    expect(g.status).toBe('play')
    lauf(g, ENT.getroffen + 100)
    expect(k.ent.phase).toBe(1)
    expect(k.aktiveFeuer).toHaveLength(4)
  })

  it('Phase 1: verbrennt die Rinde, ohne dass er getroffen wird, geht es weiter', () => {
    const g = entSpiel()
    const k = ruhigerEnt(g)
    for (const f of k.aktiveFeuer) {
      innen(g).einsammeln(k.schale)
      innen(g).einsammeln(f.p)
    }
    lauf(g, 40)
    expect(k.ent.zustand).toBe('brennt')
    lauf(g, ENT.brennt[0] + 100)
    expect(k.ent.zustand).not.toBe('brennt')
    expect(k.ent.hp).toBe(ENT.leben)
  })

  it('ab Phase 2: Wurzel durch ein brennendes Feuer zwischen ihm und der Schlange = Rueckfeuer und Treffer', () => {
    const g = entSpiel()
    const k = ruhigerEnt(g)
    k.ent.phase = 1
    k.ent.hp = 2
    // Schlange direkt unter einem Feuer (vom Ent aus gesehen dahinter), Feuer brennt
    const f = k.feuer.find((x) => x.p.x === k.ent.x && x.ab <= 1 && x.p.y > k.ent.y + 3)!
    f.an = true
    f.bis = g.time + ENT.feuerBrennt
    setzeSchlange(g, { x: f.p.x, y: f.p.y + 3 }, 'r')
    g.schutzBis = 1e12
    k.starte('wurzelstoss')
    lauf(g, ENT.stossWarn + 1500)
    expect(k.ent.hp).toBe(1)
    expect(['getroffen', 'zorn', 'abtauchen', 'auftauchen', 'bereit']).toContain(k.ent.zustand)
  })

  it('ab Phase 2: liegt das Feuer hinter der Schlange, haelt es die Wurzel nur auf (kein Treffer)', () => {
    const g = entSpiel()
    const k = ruhigerEnt(g)
    k.ent.phase = 1
    k.ent.hp = 2
    const f = k.feuer.find((x) => x.p.x === k.ent.x && x.ab === 0)!
    f.an = true
    f.bis = g.time + ENT.feuerBrennt
    // Kopf zwischen Ent und Feuer
    setzeSchlange(g, { x: f.p.x, y: k.ent.y + 4 }, 'r')
    g.schutzBis = 1e12
    k.starte('wurzelstoss')
    lauf(g, ENT.stossWarn + 1500)
    expect(k.ent.hp).toBe(2)
  })

  it('der Ent hat drei Leben, die Schlange keins extra: Attacken treffen nur den Kopf, ein Treffer ist vorbei', () => {
    expect(ENT.leben).toBe(3)
    expect(ENT.herzen).toBe(1)
    // Liegt nur der Schwanz in der Linie, passiert nichts
    const g = entSpiel()
    const k = ruhigerEnt(g)
    g.body = [{ x: 3, y: 21 }, { x: 3, y: 22 }, { x: 3, y: 23 }]
    g.prev = g.body.map((p) => ({ ...p }))
    k.linien.push({ art: 'wurzel', cells: [{ x: 3, y: 23 }], d: [0], von: { x: 0, y: 23 }, ab: g.time, los: g.time, tempo: 30, bleibt: 600, stop: Infinity, feuer: null, weg: Infinity })
    lauf(g, 200)
    expect(g.status).toBe('play')
    // Wurzelbruch durch die Zeile des Kopfes: vorbei
    const h = entSpiel()
    const kh = ruhigerEnt(h)
    setzeSchlange(h, { x: 3, y: 22 }, 'u')
    kh.starte('wurzelbruch')
    lauf(h, ENT.linienWarn + 800)
    expect(h.status).toBe('over')
    expect(h.cause).toBe('entboss')
  })

  it('Dornenfaecher: 5 bis 7 Strahlen mit Luecken; Eichelmoerser: einer dort, wo die Schlange hinfaehrt', () => {
    const g = entSpiel()
    const k = ruhigerEnt(g)
    setzeSchlange(g, { x: 8, y: 22 }, 'u')
    k.starte('dornen')
    expect(k.linien.filter((l) => l.art === 'dorn')).toHaveLength(ENT.dornen[0])
    k.linien = []
    k.ent.phase = 2
    k.starte('dornen')
    expect(k.linien.filter((l) => l.art === 'dorn')).toHaveLength(ENT.dornen[2])
    k.ent.phase = 0
    k.starte('eicheln')
    expect(k.eicheln.length).toBe(ENT.eicheln[0])
    expect(k.eicheln.some((e) => e.p.x === 8 && e.p.y === 18)).toBe(true)
  })

  it('Rankenwand: wie eine Wand (mit Luecke), nie auf der Schlange, verschwindet wieder', () => {
    const g = entSpiel()
    const k = ruhigerEnt(g)
    k.ent.phase = 1
    setzeSchlange(g, { x: 8, y: 26 }, 'u')
    k.starte('ranken')
    const r = k.linien.find((l) => l.art === 'ranke')!
    expect(r).toBeTruthy()
    lauf(g, ENT.rankenWarn + ENT.rankenWachsen + 100)
    const wand = r.cells.filter((c) => k.istWand(c))
    expect(wand.length).toBeGreaterThan(5)
    for (const c of wand) expect(g.gefahr(c)).toBe('ranke')
    for (const b of g.body) expect(k.istWand(b)).toBe(false)
    lauf(g, ENT.rankenDauer + ENT.rankenWachsen + 200)
    expect(r.cells.some((c) => k.istWand(c))).toBe(false)
  })

  it('ab Phase 2 wandert er zwischen den Stuempfen; ein freier Stumpf ist wie Wand', () => {
    const g = entSpiel()
    const k = ruhigerEnt(g)
    g.schutzBis = 1e12
    k.ent.phase = 1
    k.ent.angriffe = ENT.wandernNach
    k.ent.bis = g.time
    setzeSchlange(g, { x: 8, y: 26 }, 'u')
    const von = k.ent.platz
    lauf(g, ENT.abtauchen + 100)
    expect(k.ent.zustand).toBe('auftauchen')
    expect(k.ent.platz).not.toBe(von)
    const alt = k.stuempfe[von]
    expect(k.istWand(alt)).toBe(true)
    expect(g.gefahr(alt)).toBe('ranke')
  })

  it('Phase 3: die Lichtung waechst von aussen zu (erst Sprosse, dann Dickicht), nie auf Feuer und Schale', () => {
    const g = entSpiel()
    const k = ruhigerEnt(g)
    g.schutzBis = 1e12
    k.ent.phase = 2
    k.zuwachsNext = g.time
    setzeSchlange(g, { x: 8, y: 20 }, 'u')
    lauf(g, 40)
    expect(k.sprosse.length).toBeGreaterThan(10)
    lauf(g, ENT.zuwachsenWarn + 800)
    expect(k.dickicht.size).toBeGreaterThan(10)
    // Ganz aussen ist zu, die Feuer und die Schale bleiben frei
    expect(k.istWand({ x: 1, y: 20 })).toBe(true)
    for (const f of k.feuer) expect(k.istWand(f.p)).toBe(false)
    expect(k.istWand(k.schale)).toBe(false)
  })

  it('Setzlinge tappen auf den Kopf zu und verbrennen in einem Feuer', () => {
    const g = entSpiel()
    const k = ruhigerEnt(g)
    k.ent.phase = 1
    setzeSchlange(g, { x: 8, y: 26 }, 'u')
    k.starte('setzlinge')
    expect(k.setzlinge.length).toBeGreaterThan(0)
    const s = k.setzlinge[0]
    const d0 = Math.abs(s.p.x - 8) + Math.abs(s.p.y - 26)
    lauf(g, 3000)
    expect(Math.abs(s.p.x - 8) + Math.abs(s.p.y - 26)).toBeLessThan(d0)
    const f = k.feuer[0]
    f.an = true
    f.bis = g.time + 1e6
    s.weg = -1
    s.p = { x: f.p.x, y: f.p.y - 1 }
    setzeSchlange(g, { x: f.p.x, y: f.p.y + 4 }, 'u')
    s.next = g.time
    lauf(g, 60)
    expect(s.weg).toBeGreaterThanOrEqual(0)
  })

  it('Laubsturm loescht ein brennendes Feuer', () => {
    const g = entSpiel()
    const k = ruhigerEnt(g)
    k.ent.phase = 1
    const f = k.feuer[1]
    f.an = true
    f.bis = g.time + 1e6
    k.starte('sturm')
    lauf(g, ENT.sturmWarn + 100)
    expect(f.an).toBe(false)
    lauf(g, ENT.sturmDauer)
    expect(k.sturm).toBeNull()
  })

  it('drei Treffer: er zerfaellt, die Mission ist geschafft', () => {
    const g = entSpiel()
    const k = ruhigerEnt(g)
    g.schutzBis = 1e12
    for (let i = 0; i < ENT.leben; i++) {
      k.ent.zustand = 'brennt'
      k.ent.bis = g.time + 1e6
      innen(g).einsammeln({ x: k.ent.x, y: k.ent.y })
      lauf(g, ENT.getroffen + 50)
      if (i < ENT.leben - 1) {
        k.ent.zustand = 'bereit'
        k.ent.bis = 1e12
      }
    }
    expect(k.ent.zustand).toBe('tot')
    lauf(g, ENT.tot + 100)
    expect(g.cause).toBe('ziel')
  })

  it('laeuft ohne Fehler ueber alle drei Phasen (Bot weicht aus, Herzen unendlich)', () => {
    const g = missionSpiel(WIESE_MISSIONEN[19]) as EntBossGame
    const k = g.kampf
    const arten = new Set<string>()
    for (let i = 0; i < 3 * 60 * 50 && g.status === 'play'; i++) {
      g.schutzBis = g.time + 1e6
      k.leben = 3
      // Mini-Ents ruhig: hier geht es um den Ent
      for (const e of g.minients) {
        e.wurfNext = Infinity
        e.griffPause = Infinity
      }
      const h = g.body[0]
      const ok = (d: Dir) => {
        const n = { x: h.x + STEP[d].x, y: h.y + STEP[d].y }
        return g.gefahr(n, g.body.slice(0, -1)) === null && !g.body.slice(1).some((b) => b.x === n.x && b.y === n.y)
      }
      if (!ok(g.dir) || i % 37 === 0) {
        const d = DIRS.filter((x) => x !== OPP[g.dir] && ok(x))
        if (d.length) g.turn(d[i % d.length], false)
      }
      // Jede Minute eine Phase weiter
      if (i % 3000 === 2999 && k.ent.hp > 1) {
        k.ent.zustand = 'brennt'
        k.ent.bis = g.time + 1e6
        innen(g).einsammeln({ x: k.ent.x, y: k.ent.y })
      }
      g.update(20)
      for (const e of g.drain()) if (e.type === 'ent') arten.add(e.was)
    }
    // Laeuft noch oder ist (per Rueckfeuer) sogar geschafft
    expect(g.status === 'play' || g.cause === 'ziel', String(g.cause)).toBe(true)
    expect(k.ent.phase).toBe(2)
    for (const a of ['warnung', 'einschlag', 'abtauchen', 'auftauchen', 'treffer', 'zorn', 'zuwachsen']) expect(arten.has(a), a).toBe(true)
  })
})

describe('Mini-Ents', () => {
  /** Mission 16 mit nur einem Mini-Ent und der Schlange daneben */
  function mitMiniEnt() {
    const g = new MissionGame(WIESE_MISSIONEN[15])
    g.froesche = []
    g.gegner = []
    g.ameisen = []
    g.wesen = []
    g.quellen = []
    g.tuerme = []
    g.haeuser = []
    g.baeume = []
    g.lava = []
    const e = g.minients[0]
    g.minients = [e]
    return { g, e }
  }

  it('wirft eine Blaetterbombe dorthin, wo der Kopf sein wird; platzt sie auf dem Kopf, ist die Mission verloren', () => {
    const { g, e } = mitMiniEnt()
    e.griffPause = Infinity
    e.wurfNext = 0
    setzeSchlange(g, { x: e.p.x - 3, y: e.p.y + 2 }, 'u')
    g.tick = 1e12
    // Erst bemerkt er den Kopf (Ausrufezeichen), kurz danach wirft er
    lauf(g, 40)
    expect(e.jagt).toBeGreaterThanOrEqual(0)
    expect(g.bomben).toHaveLength(0)
    lauf(g, 400)
    expect(g.bomben).toHaveLength(1)
    const b = g.bomben[0]
    // Die Schlange steht still: also genau auf den Kopf
    expect(b.p).toEqual(g.body[0])
    lauf(g, DEFAULTS.minientFlug * 1000 + 100)
    expect(g.cause).toBe('blaetterbombe')
  })

  it('bemerkt den Kopf auf 4 Felder in jede Richtung (auch hinter sich und schraeg) und behaelt ihn, bis etwas die Sicht versperrt', () => {
    const { g, e } = mitMiniEnt()
    e.griffPause = Infinity
    g.tick = 1e12
    // 5 Felder weg: bemerkt nichts
    setzeSchlange(g, { x: e.p.x + 5, y: e.p.y }, 'u')
    lauf(g, 100)
    expect(e.jagt).toBe(-1)
    // Schraeg 4 Felder (Ecke des Quadrats): bemerkt
    setzeSchlange(g, { x: e.p.x + 4, y: e.p.y + 4 }, 'u')
    lauf(g, 40)
    expect(e.jagt).toBeGreaterThanOrEqual(0)
    // Weit weg, aber freie Sicht: behaelt ihn und wirft weiter
    setzeSchlange(g, { x: e.p.x + 9, y: e.p.y }, 'u')
    e.wurfNext = 0
    lauf(g, 40)
    expect(e.jagt).toBeGreaterThanOrEqual(0)
    expect(g.bomben.length).toBeGreaterThan(0)
    // Eine Mauer dazwischen: verliert ihn
    g.mauern = [{ cells: [-1, 0, 1].map((dy) => ({ x: e.p.x + 2, y: e.p.y + dy })), grown: 3, t: [0, 0, 0], next: 0 }]
    lauf(g, 40)
    expect(e.jagt).toBe(-1)
  })

  it('packt zu, wenn der Kopf seitlich vorbeifaehrt: Wisch von ihm weg befreit, sonst nach einer halben Sekunde vorbei', () => {
    const { g, e } = mitMiniEnt()
    e.wurfNext = Infinity
    // Kopf faehrt nach oben, direkt links am Mini-Ent vorbei
    setzeSchlange(g, { x: e.p.x - 1, y: e.p.y }, 'u')
    g.tick = 1e12
    lauf(g, 40)
    expect(g.gepackt).toBeTruthy()
    expect(g.gepackt!.weg).toBe('l')
    // Falsche Richtung zaehlt nicht
    g.turn('r')
    g.turn('u')
    expect(g.gepackt).toBeTruthy()
    g.turn('l')
    expect(g.gepackt).toBeNull()
    expect(g.body[0]).toEqual({ x: e.p.x - 2, y: e.p.y })
    expect(g.status).toBe('play')
    // Noch einmal, diesmal ohne Wisch
    const h = mitMiniEnt()
    h.e.wurfNext = Infinity
    setzeSchlange(h.g, { x: h.e.p.x + 1, y: h.e.p.y }, 'd')
    h.g.tick = 1e12
    lauf(h.g, 40)
    expect(h.g.gepackt!.weg).toBe('r')
    lauf(h.g, DEFAULTS.minientGriff * 1000 + 100)
    expect(h.g.cause).toBe('minient')
  })

  it('direkt drauf zu ist er ein Hindernis (kein Griff)', () => {
    const { g, e } = mitMiniEnt()
    e.wurfNext = Infinity
    setzeSchlange(g, { x: e.p.x, y: e.p.y + 1 }, 'u')
    g.tick = 1e12
    lauf(g, 40)
    expect(g.gepackt).toBeNull()
    expect(g.gefahr(e.p)).toBe('minient')
  })

  it('auch im Ent-Kampf ist der Griff eines Mini-Ents vorbei, wenn man nicht wegwischt', () => {
    const g = missionSpiel(WIESE_MISSIONEN[19]) as EntBossGame
    g.tick = 1e12
    const k = g.kampf
    k.ent.zustand = 'bereit'
    k.ent.bis = 1e12
    const e = g.minients[0]
    e.wurfNext = Infinity
    setzeSchlange(g, { x: e.p.x + 1, y: e.p.y }, 'u')
    lauf(g, 40)
    expect(g.gepackt).toBeTruthy()
    lauf(g, DEFAULTS.minientGriff * 1000 + 100)
    expect(g.status).toBe('over')
    expect(g.cause).toBe('minient')
  })
})

describe('Mission 10: kleine Golems im Bosskampf', () => {
  it('in Raum 2 und 3 stehen kleine Golems; ihr Schlag ist auch hier vorbei', () => {
    const g = missionSpiel(WIESE_MISSIONEN[9]) as BossGame
    expect(g.minigolems).toHaveLength(3)
    // Keiner im ersten Raum (unten)
    for (const m of g.minigolems) expect(g.kampf.raumBei(m.p)).toBeGreaterThan(0)
    g.tick = 1e12
    const m = g.minigolems[0]
    setzeSchlange(g, { x: m.p.x + 1, y: m.p.y - 1 }, 'u')
    m.next = 1e12
    m.jagt = 0
    g.kampf.golem.zustand = 'wartet'
    lauf(g, 1200)
    expect(g.status).toBe('over')
    expect(g.cause).toBe('minigolem')
  })
})

describe('Ent im freien Spiel (Wiese, Level 100)', () => {
  it('Mini-Ents kuendigen ihn an: auf Level 90, 93, 96 und 98 je einer; ist er besiegt, welken sie', () => {
    const g = new Game({ screenW: 12, screenH: 23, seed: 4, welt: 'wiese', startLevel: 89 })
    expect(g.minients).toHaveLength(0)
    const anzahl: Record<number, number> = {}
    while (g.level < 100) {
      innen(g).eat({ ...g.apple.p })
      g.wahl = 0
      anzahl[g.level] = g.minients.length
    }
    expect([90, 92, 93, 95, 96, 97, 98, 99].map((l) => anzahl[l])).toEqual([1, 1, 2, 2, 3, 3, 4, 4])
    // Rundherum frei, nicht neben dem Apfel
    for (const e of g.minients) {
      for (const d of DIRS) expect(g.inside({ x: e.p.x + STEP[d].x, y: e.p.y + STEP[d].y })).toBe(true)
      expect(g.gefahr(e.p)).toBe('minient')
    }
    g.tick = 1e12
    lauf(g, 40)
    const k = g.freiEnt!
    expect(k).toBeTruthy()
    k.ent.hp = 0
    k.ent.zustand = 'tot'
    k.ent.bis = g.time
    lauf(g, 40)
    expect(g.freiEnt).toBeNull()
    expect(g.minients).toHaveLength(0)
    for (let i = 0; i < 20; i++) {
      innen(g).eat({ ...g.apple.p })
      g.wahl = 0
    }
    expect(g.minients).toHaveLength(0)
  })

  it('kommt auf Level 100: Lichtung, 3 Holzstapel, ein Treffer; besiegt bringt Aepfel und der Apfel ist wieder da', () => {
    const g = new Game({ screenW: 12, screenH: 23, seed: 5, welt: 'wiese', startLevel: 99 })
    innen(g).eat({ ...g.apple.p })
    expect(g.level).toBe(100)
    if (g.wahl > 0) {
      innen(g).expand()
      g.wahl = 0
    }
    g.tick = 1e12
    lauf(g, 40)
    const k = g.freiEnt!
    expect(k).toBeTruthy()
    expect(k.entLeben).toBe(1)
    expect(k.aktiveFeuer).toHaveLength(3)
    expect(g.inside(g.apple.p)).toBe(false)
    g.schutzBis = 1e12
    lauf(g, ENT.erwachen - 500)
    for (const f of k.aktiveFeuer) {
      innen(g).einsammeln(k.schale)
      innen(g).einsammeln(f.p)
    }
    lauf(g, 600)
    expect(k.ent.zustand).toBe('brennt')
    const vorher = g.verdient
    innen(g).einsammeln({ x: k.ent.x, y: k.ent.y })
    lauf(g, ENT.getroffen + ENT.tot + 200)
    expect(g.freiEnt).toBeNull()
    expect(g.verdient - vorher).toBe(DEFAULTS.entBossLohn * DEFAULTS.apfelWert * g.apfelStufe())
    expect(g.inside(g.apple.p)).toBe(true)
  })

  it('Kreativ mit Startlevel 100 bringt ihn gleich, ohne Tod fuellen sich die Herzen auf; in der Wueste nicht', () => {
    const g = new Game({ screenW: 12, screenH: 23, seed: 5, welt: 'wiese', startLevel: 100, kreativ: { tod: 'anhalten', rueckschlag: false, durchSelbst: false, wachsen: true, laenge: 3 } })
    g.tick = 1e12
    lauf(g, 3000)
    const k = g.freiEnt!
    expect(k).toBeTruthy()
    for (let i = 0; i < ENT.herzen; i++) {
      g.schutzBis = 0
      k.schaden()
    }
    expect(g.status).toBe('play')
    expect(k.leben).toBe(ENT.herzen)
    const w = new Game({ screenW: 12, screenH: 23, seed: 5, welt: 'wueste', wueste: true, startLevel: 100 })
    w.tick = 1e12
    lauf(w, 3000)
    expect(w.freiEnt).toBeNull()
  })
})
