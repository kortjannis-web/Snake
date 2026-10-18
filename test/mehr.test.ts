import { describe, expect, it } from 'vitest'
import { abstandGrenze, DUELL, ENG_PRO_KOPF, GEBIET_TAKT, startBloecke, JAGD_MS, JAGD_STRAFE, JAGD_ZURUECK, KLASSISCH, LEBEN, MehrGame, ROYALE_START, ROYALE_TAKT, ZURUECK_MS, type MehrOpts, type Modus } from '../src/game/mehr'
import type { Dir, GameEvent, P } from '../src/game/types'
import { Abgleich, anwenden, zustand } from '../src/game/zustand'

const SPIELER = [
  { id: 'a', name: 'Anna', skin: 'klassik' },
  { id: 'b', name: 'Bob', skin: 'ozean' },
  { id: 'c', name: 'Cem', skin: 'sonne' },
  { id: 'd', name: 'Dana', skin: 'pink' },
]
const opts = (modus: Modus, n = 2, seed = 7): MehrOpts => ({ screenW: 12, screenH: 23, seed, modus, spieler: SPIELER.slice(0, n), cfg: { gnade: 0 } })
type Intern = { laden: (i: number) => void }

/** Alles Bewegliche und Gebaute entfernen */
const leer = (g: MehrGame) => {
  g.mauern = []
  g.teiche = []
  g.gift = []
  g.wolken = []
  g.froesche = []
  g.fallen = []
  g.baeume = []
  g.haeuser = []
  g.tuerme = []
  g.gegner = []
  g.ameisen = []
  g.lava = []
  g.eis = []
  g.funde = []
  g.powers = []
}

/** Schlange i an eine Stelle setzen */
function setze(g: MehrGame, i: number, body: P[], dir: Dir) {
  g.sichern()
  const s = g.schlangen[i]
  s.body = body.map((p) => ({ ...p }))
  s.prev = body.map((p) => ({ ...p }))
  s.dir = dir
  s.prevDir = dir
  s.queue = []
  ;(g as unknown as Intern).laden(g.aktiv)
}

/** Einen Takt weiter (alle Schlangen machen einen Schritt). update() rechnet hoechstens 100 ms am Stueck */
function takt(g: MehrGame, n = 1) {
  const ev: GameEvent[] = []
  for (let i = 0; i < n; i++) {
    let rest = g.tick
    while (rest > 0) {
      leer(g)
      const dt = Math.min(50, rest)
      g.update(dt)
      rest -= dt
      ev.push(...g.drain())
    }
  }
  return ev
}

/** Apfel direkt vor Schlange i legen */
function apfelVor(g: MehrGame, i: number) {
  g.sichern()
  const s = g.schlangen[i]
  const h = s.body[0]
  const d = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] }[s.queue[0] ?? s.dir]
  g.apple.p = { x: h.x + d[0], y: h.y + d[1] }
}

describe('Mehrspieler: Start', () => {
  it('setzt jede Schlange in eine eigene Reihe, keine ueberlappt', () => {
    for (const n of [2, 3, 4]) {
      const g = new MehrGame(opts('vs', n))
      g.sichern()
      const felder = g.schlangen.flatMap((s) => s.body.map((p) => `${p.x},${p.y}`))
      expect(new Set(felder).size).toBe(n * 3)
      for (const s of g.schlangen) expect(s.body.every((p) => g.inside(p))).toBe(true)
      expect(g.schlangen.every((s) => s.leben === LEBEN)).toBe(true)
    }
  })
  it('alle Schlangen laufen gleichzeitig', () => {
    const g = new MehrGame(opts('vs'))
    g.sichern()
    const vorher = g.schlangen.map((s) => ({ ...s.body[0] }))
    takt(g)
    g.sichern()
    expect(g.schlangen[0].body[0].x).toBe(vorher[0].x + 1)
    expect(g.schlangen[1].body[0].x).toBe(vorher[1].x - 1)
  })
})

describe('Einstellungen', () => {
  it('gleicher Platz pro Kopf: ein Block je Spieler, die Zone doppelt so viel, kompakt angebaut', () => {
    const felder = (m: Modus, n: number) => new MehrGame(opts(m, n)).mask.reduce((a, b) => a + b, 0)
    expect(felder('vs', 3)).toBe(felder('vs', 2) * 1.5)
    expect(felder('vs', 4)).toBe(felder('vs', 2) * 2)
    expect(felder('royale', 2)).toBe(felder('vs', 4))
    expect(felder('royale', 4)).toBe(felder('vs', 2) * 4)
    expect([2, 3, 4].map((n) => startBloecke('koop', n))).toEqual([2, 3, 4])
    // 4 Bloecke ergeben ein Rechteck aus 2 x 2, keine lange Schlange; auch 6 und 8 bleiben kompakt
    const g = new MehrGame(opts('vs', 4))
    expect(g.w * g.h).toBe(felder('vs', 4))
    expect([g.w, g.h]).toEqual([26, 24])
    const z3 = new MehrGame(opts('royale', 3))
    expect([z3.w, z3.h]).toEqual([26, 36])
    const z4 = new MehrGame(opts('royale', 4))
    expect(Math.max(z4.w, z4.h)).toBeLessThanOrEqual(39)
    // Jede Schlange hat zum Start Platz vor sich
    for (const n of [2, 3, 4])
      for (const m of ['vs', 'koop', 'jagd', 'royale'] as Modus[]) {
        const k = new MehrGame(opts(m, n))
        for (const s of k.schlangen) {
          const d = { r: [1, 0], l: [-1, 0], u: [0, -1], d: [0, 1] }[s.dir]!
          expect(k.inside({ x: s.body[0].x + 3 * d[0], y: s.body[0].y + 3 * d[1] })).toBe(true)
        }
      }
  })
  it('wird es eng, kommt sofort ein Block extra', () => {
    const g = new MehrGame(opts('vs'))
    expect(g.freiProKopf()).toBeGreaterThan(ENG_PRO_KOPF)
    // Lange Schlangen fuellen die Karte
    const reihe = (y0: number) => {
      const out: { x: number; y: number }[] = []
      for (let r = 0; r < 12; r++) for (let c = 0; c < g.w; c++) out.push({ x: r % 2 ? g.w - 1 - c : c, y: y0 + r })
      return out.filter((p) => g.inside(p))
    }
    setze(g, 0, reihe(0).slice(0, 120), 'r')
    setze(g, 1, reihe(12).slice(0, 120), 'r')
    expect(g.freiProKopf()).toBeLessThan(ENG_PRO_KOPF)
    g.zuege = 1
    g.wahl = 0
    ;(g as unknown as { eat: (p: { x: number; y: number }) => void }).eat(g.apple.p)
    expect(g.wahl).toBe(1)
  })
  it('Klassisch: auch nach vielen Aepfeln keine Mauern, Tiere oder Power-ups', () => {
    const g = new MehrGame({ ...opts('koop'), cfg: { gnade: 0, ...KLASSISCH } })
    for (let a = 0; a < 120; a++) {
      setze(g, 0, [{ x: 2, y: 3 }, { x: 1, y: 3 }, { x: 0, y: 3 }], 'r')
      setze(g, 1, [{ x: 10, y: 20 }, { x: 11, y: 20 }, { x: 12, y: 20 }], 'l')
      apfelVor(g, a % 2)
      g.update(50)
      g.update(50)
      g.update(60)
      g.drain()
    }
    expect(g.level).toBeGreaterThan(40)
    expect(g.mauern.length + g.teiche.length + g.gegner.length + g.froesche.length + g.powers.length + g.baeume.length + g.lava.length).toBe(0)
  })
})

describe('Gegeneinander', () => {
  it('in eine andere Schlange fahren kostet ein Leben, nach 5 s kommt man als Geist zurueck', () => {
    const g = new MehrGame(opts('vs'))
    setze(g, 1, [{ x: 6, y: 8 }, { x: 6, y: 9 }, { x: 6, y: 10 }, { x: 6, y: 11 }], 'u')
    setze(g, 0, [{ x: 5, y: 10 }, { x: 4, y: 10 }, { x: 3, y: 10 }], 'r')
    const ev = takt(g)
    expect(ev.some((e) => e.type === 'die' && e.cause === 'spieler' && e.wer === 0)).toBe(true)
    expect(g.schlangen[0].tot).toBe(true)
    expect(g.schlangen[0].leben).toBe(LEBEN - 1)
    expect(g.status).toBe('play')
    // Die andere laeuft weiter
    expect(g.schlangen[1].tot).toBe(false)
    const bis = g.schlangen[0].zurueckBei
    let zurueck = false
    for (let i = 0; i < 60 && !zurueck; i++) zurueck = takt(g).some((e) => e.type === 'zurueck' && e.wer === 0)
    expect(zurueck).toBe(true)
    expect(g.time).toBeGreaterThanOrEqual(bis)
    expect(bis - g.schlangen[0].deathAt).toBe(ZURUECK_MS)
    g.wechsel(0)
    expect(g.body.length).toBe(3)
    expect(g.geist()).toBe(true)
  })

  it('Kopf an Kopf: beide verlieren ein Leben', () => {
    const g = new MehrGame(opts('vs'))
    setze(g, 0, [{ x: 4, y: 10 }, { x: 3, y: 10 }, { x: 2, y: 10 }], 'r')
    setze(g, 1, [{ x: 6, y: 10 }, { x: 7, y: 10 }, { x: 8, y: 10 }], 'l')
    takt(g, 2)
    expect(g.schlangen[0].leben).toBe(LEBEN - 1)
    expect(g.schlangen[1].leben).toBe(LEBEN - 1)
  })

  it('ohne Leben ist man raus, der Letzte gewinnt', () => {
    const g = new MehrGame(opts('vs'))
    for (let tod = 0; tod < LEBEN; tod++) {
      g.wechsel(0)
      // Zwischen den Toden wieder da (sonst stirbt eine tote Schlange nicht noch einmal)
      g.schlangen[0].tot = false
      ;(g as unknown as { die: (c: string) => void }).die('mauer')
    }
    expect(g.schlangen[0].raus).toBe(true)
    expect(g.schlangen[0].grund).toBe('leben')
    expect(g.status).toBe('over')
    expect(g.ergebnis?.sieger).toBe(1)
    expect(g.ergebnis?.reihenfolge[0]).toBe(1)
  })

  it('wer 5 Aepfel hinter dem Fuehrenden liegt, verliert (die Grenze waechst mit)', () => {
    expect(abstandGrenze(0)).toBe(5)
    expect(abstandGrenze(19)).toBe(5)
    expect(abstandGrenze(20)).toBe(6)
    expect(abstandGrenze(45)).toBe(7)
    // Mehr Spieler, mehr Luft
    expect(abstandGrenze(0, 3)).toBe(6)
    expect(abstandGrenze(0, 4)).toBe(7)
    expect(abstandGrenze(20, 4)).toBe(8)
    const g = new MehrGame(opts('vs'))
    setze(g, 0, [{ x: 2, y: 3 }, { x: 1, y: 3 }, { x: 0, y: 3 }], 'r')
    setze(g, 1, [{ x: 10, y: 20 }, { x: 11, y: 20 }, { x: 12, y: 20 }], 'u')
    let ev: GameEvent[] = []
    for (let a = 0; a < 5 && g.status === 'play'; a++) {
      setze(g, 0, [{ x: 2, y: 3 }, { x: 1, y: 3 }, { x: 0, y: 3 }], 'r')
      setze(g, 1, [{ x: 10, y: 20 }, { x: 11, y: 20 }, { x: 12, y: 20 }], 'u')
      apfelVor(g, 0)
      ev = ev.concat(takt(g))
    }
    expect(g.schlangen[0].aepfel).toBe(5)
    expect(g.schlangen[1].raus).toBe(true)
    expect(g.schlangen[1].grund).toBe('abstand')
    expect(ev.some((e) => e.type === 'raus' && e.wer === 1 && e.grund === 'abstand')).toBe(true)
    expect(g.ergebnis?.sieger).toBe(0)
  })

  it('der Level folgt dem Fuehrenden, jede Schlange waechst nach ihren eigenen Aepfeln', () => {
    const g = new MehrGame(opts('vs'))
    setze(g, 0, [{ x: 2, y: 3 }, { x: 1, y: 3 }, { x: 0, y: 3 }], 'r')
    setze(g, 1, [{ x: 10, y: 20 }, { x: 11, y: 20 }, { x: 12, y: 20 }], 'u')
    apfelVor(g, 0)
    takt(g)
    expect(g.level).toBe(2)
    apfelVor(g, 1)
    takt(g)
    // Der Zweite hat aufgeholt, aber nicht ueberholt: Level bleibt
    expect(g.level).toBe(2)
    expect(g.schlangen.map((s) => s.aepfel)).toEqual([1, 1])
  })

  it('alle 10 Aepfel (egal wie viele Spieler) darf abwechselnd einer erweitern, nur er sieht die Wand', () => {
    expect(GEBIET_TAKT).toBe(10)
    const g = new MehrGame(opts('vs'))
    const wahlen: number[] = []
    for (let a = 0; a < 20; a++) {
      const i = a % 2
      setze(g, 0, [{ x: 2, y: 3 }, { x: 1, y: 3 }, { x: 0, y: 3 }], 'r')
      setze(g, 1, [{ x: 10, y: 20 }, { x: 11, y: 20 }, { x: 12, y: 20 }], 'l')
      apfelVor(g, i)
      for (const e of takt(g)) if (e.type === 'wahl' && e.offen === 1) wahlen.push(e.wer ?? -1)
      if (g.wahl > 0) g.wahl = 0
    }
    expect(wahlen).toEqual([0, 1])
  })

  it('nur der Waehlende baut mit der leuchtenden Wand an, die anderen prallen ab', () => {
    const g = new MehrGame(opts('vs'))
    g.wahl = 1
    g.wahlBis = g.time + 30_000
    g.wahlSpieler = 1
    const bloecke = g.blocks.length
    // Spieler 0 faehrt gegen die rechte Wand: ist nicht seine Wahl
    setze(g, 0, [{ x: g.w - 1, y: 3 }, { x: g.w - 2, y: 3 }, { x: g.w - 3, y: 3 }], 'r')
    setze(g, 1, [{ x: g.w - 1, y: 18 }, { x: g.w - 2, y: 18 }, { x: g.w - 3, y: 18 }], 'r')
    takt(g)
    expect(g.schlangen[0].tot).toBe(true)
    expect(g.schlangen[1].tot).toBe(false)
    expect(g.blocks.length).toBe(bloecke + 1)
    expect(g.wahl).toBe(0)
  })

  it('wird links angebaut, rutschen alle Schlangen mit', () => {
    const g = new MehrGame(opts('vs'))
    g.sichern()
    const vorher = g.schlangen.map((s) => s.body.map((p) => ({ ...p })))
    g.expand({ p: { x: -1, y: 0 }, d: 'l' })
    g.sichern()
    g.schlangen.forEach((s, i) => s.body.forEach((p, j) => expect(p.x).toBe(vorher[i][j].x + g.bw)))
  })
})

describe('Verzoegerung ausgleichen', () => {
  it('kommt der Wischer ein Feld zu spaet, biegt die Schlange trotzdem am gewuenschten Feld ab', () => {
    const g = new MehrGame(opts('vs'))
    setze(g, 0, [{ x: 5, y: 10 }, { x: 4, y: 10 }, { x: 3, y: 10 }], 'r')
    setze(g, 1, [{ x: 10, y: 20 }, { x: 11, y: 20 }, { x: 12, y: 20 }], 'l')
    takt(g)
    g.sichern()
    // Auf dem Geraet von Spieler 0 war der Kopf noch bei (5,10), beim Rechner ist er schon bei (6,10)
    expect(g.schlangen[0].body[0]).toEqual({ x: 6, y: 10 })
    g.lenkeBei(0, 'u', { x: 5, y: 10 }, g.expansions)
    g.sichern()
    expect(g.schlangen[0].body[0]).toEqual({ x: 5, y: 9 })
    expect(g.schlangen[0].body[1]).toEqual({ x: 5, y: 10 })
    expect(g.schlangen[0].dir).toBe('u')
  })
  it('stimmt das Feld nicht (andere Karte oder zu alt), wird normal gelenkt', () => {
    const g = new MehrGame(opts('vs'))
    setze(g, 0, [{ x: 5, y: 10 }, { x: 4, y: 10 }, { x: 3, y: 10 }], 'r')
    takt(g)
    // Erst nach dem ersten Drittel des Schritts (davor greift die Sofort-Wende aus dem Einzelspiel)
    leer(g)
    g.update(g.tick * 0.5)
    g.lenkeBei(0, 'u', { x: 5, y: 10 }, g.expansions + 1)
    g.sichern()
    expect(g.schlangen[0].body[0]).toEqual({ x: 6, y: 10 })
    expect(g.schlangen[0].queue).toEqual(['u'])
  })
})

describe('Koop', () => {
  it('man faehrt durch den anderen hindurch', () => {
    const g = new MehrGame(opts('koop'))
    setze(g, 1, [{ x: 6, y: 8 }, { x: 6, y: 9 }, { x: 6, y: 10 }, { x: 6, y: 11 }], 'u')
    setze(g, 0, [{ x: 5, y: 10 }, { x: 4, y: 10 }, { x: 3, y: 10 }], 'r')
    takt(g, 2)
    expect(g.schlangen[0].tot).toBe(false)
    expect(g.schlangen[1].tot).toBe(false)
  })

  it('Aepfel zaehlen gemeinsam', () => {
    const g = new MehrGame(opts('koop'))
    setze(g, 0, [{ x: 2, y: 3 }, { x: 1, y: 3 }, { x: 0, y: 3 }], 'r')
    setze(g, 1, [{ x: 10, y: 20 }, { x: 11, y: 20 }, { x: 12, y: 20 }], 'l')
    apfelVor(g, 0)
    takt(g)
    apfelVor(g, 1)
    takt(g)
    expect(g.level).toBe(3)
  })

  it('3 gemeinsame Leben: danach ist das Spiel fuer alle vorbei', () => {
    const g = new MehrGame(opts('koop'))
    const sterben = (i: number) => {
      g.wechsel(i)
      ;(g as unknown as { die: (c: string) => void }).die('mauer')
    }
    sterben(0)
    expect(g.pool).toBe(2)
    sterben(1)
    expect(g.pool).toBe(1)
    expect(g.status).toBe('play')
    for (let i = 0; i < 60 && g.schlangen.some((s) => s.tot); i++) takt(g)
    expect(g.schlangen.every((s) => !s.tot)).toBe(true)
    expect(g.pool).toBe(1)
    sterben(0)
    expect(g.pool).toBe(0)
    expect(g.status).toBe('over')
  })
})

describe('Apfeljagd', () => {
  it('ein Tod kostet 3 Aepfel statt eines Lebens, nach 3 s geht es weiter', () => {
    const g = new MehrGame(opts('jagd'))
    g.schlangen[0].aepfel = 5
    g.wechsel(0)
    ;(g as unknown as { die: (c: string) => void }).die('mauer')
    expect(g.schlangen[0].aepfel).toBe(5 - JAGD_STRAFE)
    expect(g.schlangen[0].leben).toBe(LEBEN)
    expect(g.schlangen[0].zurueckBei - g.time).toBe(JAGD_ZURUECK)
    g.schlangen[0].tot = false
    ;(g as unknown as { die: (c: string) => void }).die('mauer')
    expect(g.schlangen[0].aepfel).toBe(0)
    expect(g.schlangen[0].raus).toBe(false)
  })
  it('nach 3 Minuten gewinnt, wer die meisten Aepfel hat', () => {
    const g = new MehrGame(opts('jagd'))
    g.schlangen[1].aepfel = 4
    g.schlangen[0].aepfel = 2
    g.time = JAGD_MS - 10
    takt(g)
    expect(g.status).toBe('over')
    expect(g.ergebnis?.sieger).toBe(1)
  })
  it('Gleichstand nach 3 Minuten: Unentschieden', () => {
    const g = new MehrGame(opts('jagd'))
    g.time = JAGD_MS - 10
    takt(g)
    expect(g.ergebnis?.sieger).toBeNull()
  })
})

describe('Schrumpfende Karte', () => {
  it('die Zone rueckt Ring fuer Ring vor, nie unter das Minimum, Apfel nie in der Zone', () => {
    const g = new MehrGame(opts('royale'))
    expect(g.blocks.length).toBe(4)
    expect(g.zone().zellen.length).toBe(0)
    g.time = ROYALE_START
    takt(g)
    expect(g.zoneStufe).toBe(1)
    const ring = g.zone().zellen
    expect(ring.length).toBe(2 * (g.w + g.h) - 4)
    expect(g.inZone({ x: 0, y: 0 })).toBe(true)
    expect(g.inZone({ x: 1, y: 1 })).toBe(false)
    expect(g.inZone(g.apple.p)).toBe(false)
    for (let i = 0; i < 40; i++) {
      g.time = g.zoneNaechste
      takt(g)
    }
    const frei = g.mask.reduce((a, b) => a + b, 0) - g.zone().zellen.length
    expect(frei).toBeGreaterThanOrEqual(16)
    expect(g.zoneStufe).toBeLessThan(12)
    expect(ROYALE_TAKT).toBeGreaterThan(0)
  })
  it('wer in die Zone faehrt, verliert ein Leben', () => {
    const g = new MehrGame(opts('royale'))
    g.time = ROYALE_START
    takt(g)
    setze(g, 0, [{ x: 2, y: 5 }, { x: 3, y: 5 }, { x: 4, y: 5 }], 'l')
    setze(g, 1, [{ x: 12, y: 12 }, { x: 13, y: 12 }, { x: 14, y: 12 }], 'u')
    const ev = takt(g, 2)
    expect(ev.some((e) => e.type === 'die' && e.cause === 'zone' && e.wer === 0)).toBe(true)
  })
})

describe('Duell-Power-ups', () => {
  it('Schere kuerzt im Gegeneinander die naechste fremde Schlange', () => {
    const g = new MehrGame({ ...opts('vs', 3), cfg: { gnade: 0, ...DUELL } })
    const lang = Array.from({ length: 10 }, (_, k) => ({ x: 14 - k, y: 12 }))
    setze(g, 1, lang, 'r')
    setze(g, 2, Array.from({ length: 10 }, (_, k) => ({ x: 14 - k, y: 20 })), 'r')
    g.schlangen[1].aepfel = 8
    setze(g, 0, [{ x: 8, y: 9 }, { x: 7, y: 9 }, { x: 6, y: 9 }], 'r')
    g.wechsel(0)
    g.drain()
    g.powerAn('schere')
    const ev = g.drain()
    g.sichern()
    expect(g.schlangen[0].body.length).toBe(3)
    expect(g.schlangen[1].body.length).toBeLessThan(10)
    expect(g.schlangen[2].body.length).toBe(10)
    expect(ev.some((e) => e.type === 'duell' && e.art === 'schere' && e.von === 0 && e.an === 1)).toBe(true)
  })
  it('Zeitlupe bremst alle anderen, nicht einen selbst', () => {
    const g = new MehrGame(opts('vs', 3))
    g.wechsel(0)
    g.powerAn('zeitlupe')
    g.sichern()
    expect(g.schlangen[0].effekt.zeitlupeBis).toBe(0)
    expect(g.schlangen[1].effekt.zeitlupeBis).toBeGreaterThan(g.time)
    expect(g.schlangen[2].effekt.zeitlupeBis).toBeGreaterThan(g.time)
  })
  it('im Koop wirken Power-ups wie im Einzelspiel', () => {
    const g = new MehrGame(opts('koop'))
    g.wechsel(0)
    g.powerAn('zeitlupe')
    g.sichern()
    expect(g.schlangen[0].effekt.zeitlupeBis).toBeGreaterThan(g.time)
    expect(g.schlangen[1].effekt.zeitlupeBis).toBe(0)
  })
})

describe('Wettrennen', () => {
  it('ein Gebiet, das ein anderer gewaehlt hat, landet an derselben Weltstelle', () => {
    const a = new MehrGame({ ...opts('rennen', 1), spieler: [SPIELER[0]] })
    const b = new MehrGame({ ...opts('rennen', 1), spieler: [SPIELER[1]] })
    const ev: GameEvent[] = []
    a.expand({ p: { x: -1, y: 0 }, d: 'l' })
    ev.push(...a.drain())
    const e = ev.find((x) => x.type === 'expand')
    expect(e && e.type === 'expand' && e.block).toBeTruthy()
    if (!e || e.type !== 'expand' || !e.block || !e.d) return
    b.gebietVonAussen(1, a.blockWelt(e.block), e.d)
    const welt = (g: MehrGame) => g.blocks.map((p) => g.blockWelt(p)).map((p) => `${p.x},${p.y}`).sort()
    expect(welt(b)).toEqual(welt(a))
    expect(b.expansions).toBe(1)
    // Zweimal dasselbe Gebiet: nichts passiert
    b.gebietVonAussen(1, a.blockWelt(e.block), e.d)
    expect(b.blocks.length).toBe(a.blocks.length)
  })

  it('wer dran ist, bekommt beim passenden Level die leuchtende Wand', () => {
    const g = new MehrGame({ ...opts('rennen', 1), spieler: [SPIELER[0]] })
    const schwelle = MehrGame.schwelle(g.cfg, 1)
    expect(schwelle).toBe(20)
    g.rennenWaehler = true
    g.level = schwelle
    g.pruefeRennenGebiet()
    expect(g.wahl).toBe(1)
    expect(g.wahlSpieler).toBe(0)
  })
})

describe('Spielstand', () => {
  it('ein anderes Geraet rechnet mit dem gespeicherten Stand genau gleich weiter', () => {
    const g = new MehrGame(opts('vs', 3, 11))
    const lenk: Dir[] = ['u', 'r', 'd', 'l']
    for (let i = 0; i < 40; i++) {
      if (i % 7 === 0) g.lenke(i % 3, lenk[i % 4])
      g.update(37)
    }
    const z = JSON.parse(JSON.stringify(zustand(g, true)))
    const h = new MehrGame(opts('vs', 3, 11))
    anwenden(h, z)
    for (let i = 0; i < 300; i++) {
      if (i % 9 === 0) {
        g.lenke(i % 3, lenk[i % 4])
        h.lenke(i % 3, lenk[i % 4])
      }
      g.update(37)
      h.update(37)
    }
    g.sichern()
    h.sichern()
    expect(JSON.stringify(h.schlangen)).toBe(JSON.stringify(g.schlangen))
    expect(h.apple).toEqual(g.apple)
    expect(h.mauern).toEqual(g.mauern)
    expect(h.level).toBe(g.level)
  })

  it('verschickt nur, was sich geaendert hat', () => {
    const g = new MehrGame(opts('vs'))
    const a = new Abgleich()
    const erst = a.aenderungen(zustand(g))
    expect(Object.keys(erst ?? {})).toContain('schlangen')
    expect(a.aenderungen(zustand(g))).toBeNull()
    takt(g)
    const dann = a.aenderungen(zustand(g)) ?? {}
    expect(Object.keys(dann)).toContain('time')
    expect(Object.keys(dann)).toContain('schlangen')
    expect(Object.keys(dann)).not.toContain('blocks')
  })
})
