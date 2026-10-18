import { describe, expect, it } from 'vitest'
import { abstandGrenze, gebietTakt, LEBEN, MehrGame, ZURUECK_MS, type MehrOpts, type Modus } from '../src/game/mehr'
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

  it('alle 10 Aepfel (2 Spieler) darf abwechselnd einer erweitern, nur er sieht die Wand', () => {
    expect(gebietTakt('vs', 2)).toBe(10)
    expect(gebietTakt('vs', 3)).toBe(5)
    expect(gebietTakt('vs', 4)).toBe(3)
    expect(gebietTakt('koop', 2)).toBe(15)
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
