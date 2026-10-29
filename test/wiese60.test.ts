import { describe, expect, it } from 'vitest'
import { Game, key } from '../src/game/game'
import { GOLEM } from '../src/game/golemkampf'
import { DEFAULTS, TANNE_FORM } from '../src/game/rules'
import type { Minigolem, P } from '../src/game/types'

const SW = 12
const SH = 23

type Innen = {
  neuerBaum(stehend?: boolean, gross?: boolean): boolean
  baumKippen(b: Game['baeume'][number]): boolean
  minigolemSetzen(p: P, d: 'u' | 'd' | 'l' | 'r'): void
  minigolemTakt(): void
  golemBummelt(g: Minigolem, wand: Set<number>): void
  eat(n: P): void
  einsammeln(n: P): void
  expand(): void
}
const innen = (g: Game) => g as unknown as Innen

/** Leere Wiese ohne Hindernisse (nur die Schlange), Schlange steht still */
function wiese(startLevel = 1, seed = 7) {
  const g = new Game({ screenW: SW, screenH: SH, seed, welt: 'wiese', startLevel, cfg: { ...DEFAULTS } })
  g.allesWeg()
  g.tick = 1e12
  return g
}
const setzeSchlange = (g: Game, kopf: P, dir: 'u' | 'd' | 'l' | 'r' = 'u') => {
  const hinten = { u: { x: 0, y: 1 }, d: { x: 0, y: -1 }, l: { x: 1, y: 0 }, r: { x: -1, y: 0 } }[dir]
  g.body = [0, 1, 2].map((i) => ({ x: kopf.x + hinten.x * i, y: kopf.y + hinten.y * i }))
  g.prev = g.body.map((p) => ({ ...p }))
  g.dir = dir
}
const lauf = (g: Game, ms: number) => {
  for (let t = 0; t < ms; t += 20) g.update(20)
}

describe('Grosse Tannen', () => {
  it('stehen auf 3 x 3 Feldern und liegen danach 7 Felder lang (6 weit gefallen)', () => {
    const g = wiese()
    setzeSchlange(g, { x: 1, y: g.h - 3 })
    expect(innen(g).neuerBaum(true, true)).toBe(true)
    const b = g.baeume[0]
    expect(b.gross).toBe(true)
    expect(b.cells).toHaveLength(9)
    for (const c of b.cells) expect(Math.max(Math.abs(c.x - b.root.x), Math.abs(c.y - b.root.y))).toBeLessThanOrEqual(1)
    // Kippen: wenn Platz ist, liegt sie danach 11 Felder (1-1-1-3-3-1-1), die Spitze 6 Felder vom Stamm
    g.baeume = []
    const root = { x: Math.floor(g.w / 2), y: 2 }
    g.baeume.push({ cells: [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => ({ x: root.x + dx, y: root.y + dy }))), root, dir: 'd', t: 0, kippBei: 0, fallT: -1e9, gelandet: true, gross: true })
    expect(innen(g).baumKippen(g.baeume[0])).toBe(true)
    const l = g.baeume[0]
    expect(l.cells).toHaveLength(TANNE_FORM.length)
    expect(Math.max(...l.cells.map((c) => Math.abs(c.x - root.x) + Math.abs(c.y - root.y)))).toBe(6)
  })

  it('kommen in der Wiese ab Level 60 (beim Aufbau liegen sie schon), in anderen Welten nicht', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 3, welt: 'wiese', startLevel: 100 })
    expect(g.baeume.some((b) => b.gross)).toBe(true)
    const w = new Game({ screenW: SW, screenH: SH, seed: 3, welt: 'winter', startLevel: 100 })
    expect(w.baeume.some((b) => b.gross)).toBe(false)
  })
})

describe('Kleine Steingolems', () => {
  it('bummeln: 10 % stehen bleiben, sonst etwa 70 % geradeaus und je 15 % rechts und links', () => {
    const g = wiese()
    setzeSchlange(g, { x: 1, y: g.h - 3 })
    const zaehl = { stehen: 0, gerade: 0, rechts: 0, links: 0 }
    const rechts = { u: 'r', r: 'd', d: 'l', l: 'u' } as const
    for (let i = 0; i < 4000; i++) {
      // Immer mitten auf der grossen leeren Karte, damit nichts im Weg ist
      g.minigolems = []
      innen(g).minigolemSetzen({ x: Math.floor(g.w / 2), y: Math.floor(g.h / 2) - 4 }, 'u')
      const m = g.minigolems[0]
      const vor = m.dir
      innen(g).golemBummelt(m, new Set<number>())
      if (m.stehtBis > g.time) zaehl.stehen++
      else if (m.dir === vor) zaehl.gerade++
      else if (m.dir === rechts[vor]) zaehl.rechts++
      else zaehl.links++
    }
    expect(zaehl.stehen / 4000).toBeGreaterThan(0.07)
    expect(zaehl.stehen / 4000).toBeLessThan(0.13)
    const lauf = 4000 - zaehl.stehen
    expect(zaehl.gerade / lauf).toBeGreaterThan(0.65)
    expect(zaehl.gerade / lauf).toBeLessThan(0.75)
    expect(zaehl.rechts / lauf).toBeGreaterThan(0.11)
    expect(zaehl.links / lauf).toBeGreaterThan(0.11)
  })

  it('sieht den Kopf im Kegel nach vorn (nicht hinter sich), jagt ihn und schlaegt rundum zu: Kopf getroffen = vorbei', () => {
    const g = wiese()
    const mitte = { x: Math.floor(g.w / 2), y: Math.floor(g.h / 2) }
    innen(g).minigolemSetzen(mitte, 'u')
    const m = g.minigolems[0]
    m.next = 1e12
    // Hinter ihm: sieht nichts
    setzeSchlange(g, { x: mitte.x, y: mitte.y + 4 }, 'd')
    lauf(g, 200)
    expect(m.jagt).toBe(-1)
    // Vor ihm (4 Felder): sieht den Kopf
    setzeSchlange(g, { x: mitte.x + 1, y: mitte.y - 4 }, 'r')
    lauf(g, 60)
    expect(m.jagt).toBeGreaterThanOrEqual(0)
    // Schraeg 2 Felder weg: seit 1.49 ausser Reichweite (rundum nur noch 1 Feld)
    setzeSchlange(g, { x: mitte.x + 2, y: mitte.y - 2 }, 'r')
    lauf(g, 300)
    expect(m.angriff).toBeNull()
    // Direkt daneben (schraeg): holt rundum aus (eine halbe Sekunde, 3 x 3), dann trifft er den Kopf
    setzeSchlange(g, { x: mitte.x + 1, y: mitte.y - 1 }, 'r')
    lauf(g, 300)
    expect(m.angriff?.cells).toHaveLength(8)
    expect(m.angriff?.art).toBe('rund')
    expect(m.angriff!.schlag - m.angriff!.ab).toBe(DEFAULTS.minigolemLaden * 1000)
    lauf(g, 600)
    expect(g.status).toBe('over')
    expect(g.cause).toBe('minigolem')
  })

  it('nur der Kopf zaehlt: liegt nur der Koerper in der Flaeche, passiert nichts. Geradeaus trifft er 4 Felder weit', () => {
    const g = wiese()
    const mitte = { x: Math.floor(g.w / 2), y: Math.floor(g.h / 2) }
    innen(g).minigolemSetzen(mitte, 'u')
    const m = g.minigolems[0]
    m.next = 1e12
    m.jagt = 0
    // Kopf 4 Felder geradeaus vor ihm: Fernschlag in einer Linie
    setzeSchlange(g, { x: mitte.x, y: mitte.y - 4 }, 'u')
    lauf(g, 300)
    expect(m.angriff?.art).toBe('linie')
    expect(m.angriff!.cells).toHaveLength(4)
    expect(m.angriff!.cells.every((c) => c.x === mitte.x)).toBe(true)
    // Der Kopf geht weg, der Koerper bleibt in der Linie liegen: nichts passiert
    g.body = [{ x: mitte.x + 1, y: mitte.y - 3 }, { x: mitte.x, y: mitte.y - 3 }, { x: mitte.x, y: mitte.y - 2 }]
    g.prev = g.body.map((p) => ({ ...p }))
    lauf(g, 600)
    expect(m.angriff).toBeNull()
    expect(g.status).toBe('play')
  })

  it('verliert den Kopf aus den Augen, wenn eine Mauer dazwischen ist', () => {
    const g = wiese()
    const mitte = { x: Math.floor(g.w / 2), y: Math.floor(g.h / 2) }
    innen(g).minigolemSetzen(mitte, 'u')
    const m = g.minigolems[0]
    m.next = 1e12
    setzeSchlange(g, { x: mitte.x, y: mitte.y - 5 }, 'r')
    g.mauern = [{ cells: [{ x: mitte.x - 1, y: mitte.y - 3 }, { x: mitte.x, y: mitte.y - 3 }, { x: mitte.x + 1, y: mitte.y - 3 }], grown: 3, t: [0, 0, 0], next: 0 }]
    lauf(g, 200)
    expect(m.jagt).toBe(-1)
    g.mauern = []
    lauf(g, 60)
    expect(m.jagt).toBeGreaterThanOrEqual(0)
  })

  it('auf der Jagd behaelt er den Kopf, egal wie weit, nur ein Hindernis dazwischen bricht die Sicht ab', () => {
    const g = wiese()
    // Unten auf der Karte, Blick nach oben
    const unten = { x: Math.floor(g.w / 2), y: g.h - 2 }
    innen(g).minigolemSetzen(unten, 'u')
    const m = g.minigolems[0]
    m.next = 1e12
    m.ruheBis = 1e12
    setzeSchlange(g, { x: unten.x, y: unten.y - DEFAULTS.minigolemSicht }, 'r')
    lauf(g, 60)
    expect(m.jagt).toBeGreaterThanOrEqual(0)
    // Ganz oben, weit ausserhalb der Sichtweite, aber freie Sicht: jagt weiter
    setzeSchlange(g, { x: unten.x + 1, y: 2 }, 'r')
    expect(unten.y - 2).toBeGreaterThan(DEFAULTS.minigolemSicht + 2)
    lauf(g, 60)
    expect(g.status).toBe('play')
    expect(m.jagt).toBeGreaterThanOrEqual(0)
    // Eine Mauer dazwischen: verliert ihn
    g.mauern = [{ cells: [-1, 0, 1].map((dx) => ({ x: unten.x + dx, y: unten.y - 3 })), grown: 3, t: [0, 0, 0], next: 0 }]
    lauf(g, 60)
    expect(m.jagt).toBe(-1)
  })

  it('kuendigen den Boss an: auf Level 50, 53, 56 und 58 je einer, sind ein Hindernis, nach dem Boss sind sie weg', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 11, welt: 'wiese', startLevel: 49 })
    expect(g.minigolems).toHaveLength(0)
    const anzahl: Record<number, number> = {}
    while (g.level < 60) {
      innen(g).eat({ ...g.apple.p })
      g.wahl = 0
      anzahl[g.level] = g.minigolems.length
    }
    expect([50, 52, 53, 55, 56, 57, 58, 59].map((l) => anzahl[l])).toEqual([1, 1, 2, 2, 3, 3, 4, 4])
    const m = g.minigolems[0]
    expect(g.hindernisse().has(key(m.p.x, m.p.y))).toBe(true)
    expect(g.gefahr(m.p)).toBe('minigolem')
    // Boss auf Level 60 besiegt: die kleinen Golems zerfallen, danach kommen keine mehr
    g.tick = 1e12
    lauf(g, 40)
    const k = g.freiBoss!
    expect(k).toBeTruthy()
    k.golem.hp = 0
    k.golem.zustand = 'tot'
    k.golem.bis = g.time
    lauf(g, 40)
    expect(g.freiBoss).toBeNull()
    expect(g.minigolems).toHaveLength(0)
    for (let i = 0; i < 40; i++) {
      innen(g).eat({ ...g.apple.p })
      g.wahl = 0
    }
    expect(g.minigolems).toHaveLength(0)
  })

  it('mit Startlevel mitten in den Vorboten (Kreativ) stehen schon so viele da, wie bis dahin gekommen waeren', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 11, welt: 'wiese', startLevel: 56 })
    expect(g.minigolems).toHaveLength(3)
    const h = new Game({ screenW: SW, screenH: SH, seed: 11, welt: 'wiese', startLevel: 70 })
    expect(h.minigolems).toHaveLength(0)
    const w = new Game({ screenW: SW, screenH: SH, seed: 11, welt: 'winter', startLevel: 56 })
    expect(w.minigolems).toHaveLength(0)
  })
})

describe('Boss im freien Spiel (Wiese, Level 60)', () => {
  it('kommt auf Level 60: Bannkreis mit 4 Sockeln, kein Apfel; besiegt bringt Aepfel und der Apfel ist wieder da', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 5, welt: 'wiese', startLevel: 59 })
    innen(g).eat({ ...g.apple.p })
    expect(g.level).toBe(60)
    // Erst die Gebietswahl, dann der Boss
    if (g.wahl > 0) {
      innen(g).expand()
      g.wahl = 0
    }
    g.tick = 1e12
    lauf(g, 40)
    const k = g.freiBoss!
    expect(k).toBeTruthy()
    expect(k.sockel).toHaveLength(4)
    expect(k.golemLeben).toBe(1)
    expect(g.inside(g.apple.p)).toBe(false)
    // Alle Sockel einsetzen: Kristall aufheben und auf den Sockel fahren
    lauf(g, GOLEM.erwachen + 200)
    for (const s of k.sockel) {
      k.traegt = [s.farbe]
      innen(g).einsammeln(s.p)
    }
    expect(k.kreisAktiv).toBe(true)
    // Der Golem tritt in den Kreis: gebannt, der Kopf faehrt hindurch
    g.schutzBis = 1e12
    k.golem.kreisPause = 0
    k.golem.x = k.kreis.p.x
    k.golem.y = k.kreis.p.y
    k.golem.zustand = 'laufen'
    k.golem.bis = g.time + 1e9
    lauf(g, 40)
    expect(k.golem.zustand).toBe('gebannt')
    const vorher = g.verdient
    innen(g).einsammeln({ x: Math.round(k.golem.x), y: Math.round(k.golem.y) })
    expect(k.golem.hp).toBe(0)
    lauf(g, GOLEM.getroffen + GOLEM.tot + 200)
    expect(g.freiBoss).toBeNull()
    expect(g.verdient - vorher).toBe(DEFAULTS.bossLohn * DEFAULTS.apfelWert * g.apfelStufe())
    expect(g.inside(g.apple.p)).toBe(true)
  })

  it('ohne Herzen ist es vorbei, in anderen Welten und im Mehrspieler gibt es ihn nicht', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 5, welt: 'wiese', startLevel: 59 })
    innen(g).eat({ ...g.apple.p })
    if (g.wahl > 0) {
      innen(g).expand()
      g.wahl = 0
    }
    g.tick = 1e12
    lauf(g, 40)
    const k = g.freiBoss!
    for (let i = 0; i < GOLEM.herzen; i++) {
      g.schutzBis = 0
      k.schaden()
    }
    expect(g.cause).toBe('steingolem')
    const w = new Game({ screenW: SW, screenH: SH, seed: 5, welt: 'wueste', wueste: true, startLevel: 59 })
    innen(w).eat({ ...w.apple.p })
    w.wahl = 0
    lauf(w, 100)
    expect(w.freiBoss).toBeNull()
  })

  it('Admin zum Testen: Kreativ mit Startlevel 60 bringt den Boss gleich (ohne Tod fuellen sich die Herzen auf)', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 5, welt: 'wiese', startLevel: 60, kreativ: { tod: 'anhalten', rueckschlag: false, durchSelbst: false, wachsen: true, laenge: 3 } })
    g.tick = 1e12
    lauf(g, 3000)
    const k = g.freiBoss!
    expect(k).toBeTruthy()
    for (let i = 0; i < GOLEM.herzen; i++) {
      g.schutzBis = 0
      k.schaden()
    }
    expect(g.status).toBe('play')
    expect(k.leben).toBe(GOLEM.herzen)
    // Mit hoeherem Startlevel kommt er nicht mehr
    const h = new Game({ screenW: SW, screenH: SH, seed: 5, welt: 'wiese', startLevel: 61 })
    h.tick = 1e12
    lauf(h, 3000)
    expect(h.freiBoss).toBeNull()
  })
})
