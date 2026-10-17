import { describe, expect, it } from 'vitest'
import { autopilot } from '../src/game/autopilot'
import { Game, key } from '../src/game/game'
import { zeitleiste } from '../src/game/zeitleiste'
import * as R from '../src/game/rules'
import type { Dir, GameEvent, Kreativ } from '../src/game/types'

const SW = 12
const SH = 23
const C = R.DEFAULTS
const KREATIV: Kreativ = { tod: 'an', rueckschlag: true, durchSelbst: false, wachsen: true, laenge: 3 }

/** Alles Bewegliche und Gebaute entfernen, damit ein Test nur eine Sache prueft */
const leer = (g: Game) => {
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
}
const felderAufKarte = (g: Game) => g.mask.reduce((a, b) => a + b, 0)

/** Spielt mit dem Autopilot; legt den Apfel oft direkt vor die Schlange, damit es schnell vorangeht */
function play(g: Game, bisLevel: number, maxSteps = 200_000) {
  const events: GameEvent[] = []
  for (let i = 0; i < maxSteps && g.status === 'play' && g.level < bisLevel; i++) {
    const d = autopilot(g)
    if (d && !g.queue.length) g.turn(d, false)
    if (i % 3 === 0) {
      const dir = g.queue[0] ?? g.dir
      const h = g.body[0]
      const n = { x: h.x + R.STEP[dir].x, y: h.y + R.STEP[dir].y }
      if (g.inside(n) && g.gefahr(n, g.body.slice(0, -1)) === null && !g.hindernisse().has(key(n.x, n.y))) g.apple.p = n
    }
    g.update(g.tick)
    events.push(...g.drain())
  }
  return events
}

describe('Regeln', () => {
  it('Mauern wachsen von 2 bis 6, dann kommt eine neue', () => {
    expect(R.mauern(C, 7, 300)).toEqual([])
    expect(R.mauern(C, 8, 300)).toEqual([2])
    expect(R.mauern(C, 16, 300)).toEqual([3])
    expect(R.mauern(C, 40, 300)).toEqual([6])
    expect(R.mauern(C, 48, 400)).toEqual([6, 2])
    expect(R.mauern(C, 88, 1000)).toEqual([6, 6, 2])
    expect(R.mauern(C, 300, 300)).toHaveLength(2)
  })

  it('Teiche werden langsam groesser', () => {
    expect([15, 30, 45, 60, 75, 90].map((l) => R.teichGroesse(C, l))).toEqual([2, 2, 3, 3, 4, 4])
    expect(R.teichGroesse(C, 3000)).toBe(12)
  })

  it('Giftwolke waechst: Punkt, Plus, 3x3, ...', () => {
    expect([0, 1, 2, 3, 4].map((s) => R.wolkenForm(s).length)).toEqual([1, 5, 9, 13, 25])
  })

  it('Neues Gebiet alle 20 Level bis 300, dann alle 30, ab 500 alle 50', () => {
    const lv = Array.from({ length: 700 }, (_, i) => i + 1).filter((l) => R.neuesGebiet(C, l))
    expect(lv).toEqual([20, 40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300, 330, 360, 390, 420, 450, 480, 500, 550, 600, 650, 700])
    const c30 = { ...C, gebietAlle: 30 }
    expect(Array.from({ length: 299 }, (_, i) => i + 1).filter((l) => R.neuesGebiet(c30, l))).toHaveLength(9)
    expect(R.gebietFortschritt(C, 310)).toEqual({ rest: 20, abschnitt: 30 })
  })
})

describe('Karte aus Bloecken', () => {
  it('Start: zwei Bloecke = ein Bildschirm, jeder Block ein halber Bildschirm', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 1 })
    expect(g.blocks).toHaveLength(2)
    expect(g.bw).toBe(12)
    expect(g.bh).toBe(11)
    expect(felderAufKarte(g)).toBe(2 * 12 * 11)
  })

  it('jeder neue Block ist gleich gross, liegt im Raster und grenzt an die Karte', () => {
    let nichtRechteckig = 0
    for (let s = 1; s < 40; s++) {
      const g = new Game({ screenW: SW, screenH: SH, seed: s })
      for (let i = 0; i < 10; i++) {
        const vorher = felderAufKarte(g)
        g.expand()
        expect(felderAufKarte(g) - vorher).toBe(g.bw * g.bh)
        const neu = g.blocks[g.blocks.length - 1]
        const nachbarn = g.blocks.filter((b) => Math.abs(b.x - neu.x) + Math.abs(b.y - neu.y) === 1)
        expect(nachbarn.length).toBeGreaterThan(0)
      }
      if (felderAufKarte(g) < g.w * g.h) nichtRechteckig++
    }
    // Wie Minecraft-Bloecke: meistens keine Rechteck-Karte
    expect(nichtRechteckig).toBeGreaterThan(20)
  })

  it('verschiebt beim Anbau oben/links alles mit', () => {
    for (let s = 1; s < 30; s++) {
      const g = new Game({ screenW: SW, screenH: SH, seed: s })
      const head = { ...g.body[0] }
      const apple = { ...g.apple.p }
      g.expand()
      const dx = g.body[0].x - head.x
      const dy = g.body[0].y - head.y
      expect(g.apple.p.x - apple.x).toBe(dx)
      expect(g.apple.p.y - apple.y).toBe(dy)
      expect([0, g.bw]).toContain(dx)
      expect([0, g.bh]).toContain(dy)
      expect(g.inside(g.body[0])).toBe(true)
    }
  })

  it('Startlevel 300: 15 neue Bloecke, Welt wird mit aufgebaut', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 9, startLevel: 300 })
    expect(g.expansions).toBe(15)
    expect(g.blocks).toHaveLength(17)
    expect(g.level).toBe(300)
    expect(g.teiche.length).toBeGreaterThan(0)
    expect(g.baeume.length).toBeGreaterThan(0)
    expect(g.haeuser.length).toBeGreaterThan(0)
    // Die Schlange waechst nach dem Start auf ihre Laenge
    expect(g.wachsRest).toBeGreaterThan(100)
  })
})

describe('Spiel', () => {
  it('Gegen den Rand: sofort vorbei, kein Gnadenschritt', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 1 })
    g.apple.p = { x: 0, y: 0 }
    const ev: GameEvent[] = []
    for (let i = 0; i < 60 && g.status === 'play'; i++) {
      g.update(g.tick)
      ev.push(...g.drain())
    }
    expect(ev.some((e) => e.type === 'halt')).toBe(false)
    expect(g.status).toBe('over')
    expect(g.cause).toBe('rand')
  })

  it('Gegen eine Mauer: sofort vorbei, kein Gnadenschritt', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 1, cfg: { powerChance: 0 } })
    leer(g)
    g.apple.p = { x: 0, y: 0 }
    const h = g.body[0]
    g.mauern.push({ cells: [{ x: h.x + 1, y: h.y }], grown: 1, t: [0], next: 0 })
    const ev: GameEvent[] = []
    for (let i = 0; i < 3 && g.status === 'play'; i++) {
      g.update(g.tick)
      ev.push(...g.drain())
    }
    expect(ev.some((e) => e.type === 'halt')).toBe(false)
    expect(g.cause).toBe('mauer')
  })

  it('Giftapfel essen beendet das Spiel', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 1 })
    const h = g.body[0]
    g.gift.push({ p: { x: h.x + 1, y: h.y }, t: 0, ecke: 0 })
    for (let i = 0; i < 10 && g.status === 'play'; i++) g.update(50)
    expect(g.status).toBe('over')
    expect(g.cause).toBe('gift')
  })

  it('Falle liegt 5 bis 8 Felder vor dem Kopf in Laufrichtung', () => {
    for (let s = 1; s < 30; s++) {
      const g = new Game({ screenW: SW, screenH: SH, seed: s })
      leer(g)
      g.dir = 'u'
      g.queue = []
      g.body = [{ x: 5, y: 20 }, { x: 5, y: 21 }, { x: 5, y: 21 }]
      g.apple.p = { x: 0, y: 0 }
      expect(g.neueFalle()).toBe(true)
      const f = g.fallen[0].p
      expect(f.x).toBe(5)
      expect(20 - f.y).toBeGreaterThanOrEqual(5)
      expect(20 - f.y).toBeLessThanOrEqual(8)
    }
  })

  it('laeuft lange ohne Fehler und alles taucht auf', () => {
    const seen = new Set<string>()
    let maxLevel = 0
    for (let s = 1; s <= 6; s++) {
      const g = new Game({ screenW: SW, screenH: SH, seed: s * 7919 })
      const ev = play(g, 340)
      ev.forEach((e) => seen.add(e.type === 'unlock' ? 'unlock:' + e.what : e.type))
      maxLevel = Math.max(maxLevel, g.level)
      // Geist (auch nach einem Schild) darf durch die eigene Schlange gleiten
      const geist = ev.some((e) => e.type === 'schild' || (e.type === 'power' && e.art === 'geist'))
      const k = new Set(g.body.map((p) => key(p.x, p.y)))
      if (!geist) expect(k.size).toBe(g.body.length)
      for (const p of g.body) expect(g.inside(p)).toBe(true)
      expect(g.inside(g.apple.p)).toBe(true)
    }
    expect(maxLevel).toBeGreaterThanOrEqual(150)
    for (const t of ['eat', 'expand', 'wall', 'pond', 'tree', 'unlock:gift', 'unlock:falle', 'trap']) expect(seen).toContain(t)
  }, 180_000)
})

describe('Rueckschlaege', () => {
  it('Giftwolke kostet 10 Level und ist nicht toedlich', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 4, startLevel: 160 })
    leer(g)
    g.body = [{ x: 5, y: 10 }, { x: 4, y: 10 }, { x: 3, y: 10 }, { x: 2, y: 10 }]
    g.dir = 'r'
    g.queue = []
    g.apple.p = { x: 0, y: 0 }
    g.wolken.push({ c: { x: 6, y: 10 }, t: 0, stage: 0, maxStage: 2, nextAt: 1e9, until: Infinity, cells: [{ x: 6, y: 10 }], pending: [], bornAt: [0] })
    const ev: GameEvent[] = []
    for (let i = 0; i < 4; i++) {
      g.update(50)
      ev.push(...g.drain())
    }
    expect(g.status).toBe('play')
    expect(g.level).toBe(150)
    expect(g.maxLevel).toBe(160)
    expect(ev.some((e) => e.type === 'setback' && e.grund === 'wolke')).toBe(true)
    expect(g.schutzBis).toBeGreaterThan(g.time)
  })

  it('Nach einem Rueckschlag kommt kein Block doppelt', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 8, startLevel: 22 })
    const exp = g.expansions
    g.setback(5, 'licht')
    expect(g.level).toBe(17)
    g.springeZu(25)
    expect(g.expansions).toBe(exp)
  })
})

describe('Baeume, Haeuser, Tuerme', () => {
  it('Baum: 1-1-2-1 Felder, ab 100 alle 40 Level', () => {
    expect([99, 100, 120, 140, 180, 181].map((l) => R.neuerBaum(C, l))).toEqual([false, true, false, true, true, false])
    for (let s = 1; s < 20; s++) {
      const g = new Game({ screenW: SW, screenH: SH, seed: s, startLevel: 100 })
      expect(g.baeume.length).toBe(1)
      const b = g.baeume[0]
      expect(b.cells).toHaveLength(5)
      const d = R.STEP[b.dir]
      const entlang = b.cells.map((c) => (c.x - b.root.x) * d.x + (c.y - b.root.y) * d.y)
      expect(entlang.sort()).toEqual([0, 1, 2, 2, 3])
      expect(g.gefahr(b.cells[3])).toBe('baum')
    }
  })

  it('Erst kleine Huetten (2x2, Licht 1 Feld), ab 210 grosse Haeuser', () => {
    expect([129, 130, 160, 190, 200, 220].map((l) => R.neuesHaus(C, l))).toEqual([false, true, true, true, false, true])
    for (let s = 1; s < 15; s++) {
      const g = new Game({ screenW: SW, screenH: SH, seed: s, startLevel: 130 })
      expect(g.haeuser).toHaveLength(1)
      const h = g.haeuser[0]
      expect(h.klein).toBe(true)
      expect(h.cells).toHaveLength(4)
      expect(h.strahl.length).toBeLessThanOrEqual(C.lichtWeite - 1)
    }
  })

  it('Haus: 2x3 oder mit Ecke, vier Fenster, Licht nie auf der Schlange', () => {
    const groessen = new Set<number>()
    for (let s = 1; s < 30; s++) {
      const g = new Game({ screenW: SW, screenH: SH, seed: s, startLevel: 240 })
      expect(g.haeuser.length).toBeGreaterThanOrEqual(1)
      const h = g.haeuser.find((x) => !x.klein)!
      groessen.add(h.cells.length)
      expect(h.fenster.map((f) => f.d).sort()).toEqual(['d', 'l', 'r', 'u'])
      for (const f of h.fenster) {
        expect(h.cells.some((c) => c.x === f.p.x && c.y === f.p.y)).toBe(true)
        const vor = { x: f.p.x + R.STEP[f.d].x, y: f.p.y + R.STEP[f.d].y }
        expect(h.cells.some((c) => c.x === vor.x && c.y === vor.y)).toBe(false)
      }
      expect(h.strahl.length).toBeLessThanOrEqual(2)
      for (const p of h.strahl) expect(g.aufSchlange(p)).toBe(false)
      expect(g.gefahr(h.cells[0])).toBe('haus')
    }
    expect([...groessen].sort()).toEqual([10, 6])
  })

  it('Haus bleibt dunkel, wenn vor jedem Fenster die Schlange liegt', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 3, startLevel: 215 })
    const h = g.haeuser[0]
    leer(g)
    g.haeuser = [h]
    // Schlange auf das erste Feld vor jedes Fenster legen (Kopf irgendwo daneben)
    g.body = h.fenster.map((f) => ({ x: f.p.x + R.STEP[f.d].x, y: f.p.y + R.STEP[f.d].y })).filter((p) => g.inside(p))
    ;(g as unknown as { lichtFuer: (h: unknown) => void }).lichtFuer(h)
    expect(h.licht).toBe(-1)
    expect(h.strahl).toEqual([])
  })

  it('Licht kostet 5 Level', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 3, startLevel: 215 })
    const h = g.haeuser.find((x) => x.strahl.length)!
    leer(g)
    g.haeuser = [h]
    const c = h.strahl[0]
    const f = h.fenster[h.licht]
    const quer: Dir = f.d === 'u' || f.d === 'd' ? 'r' : 'd'
    const q = R.STEP[quer]
    g.body = [1, 2, 3].map((k) => ({ x: c.x - q.x * k, y: c.y - q.y * k }))
    g.dir = quer
    g.queue = []
    g.prev = []
    g.apple.p = { x: -5, y: -5 }
    for (let i = 0; i < 4 && g.level === 215; i++) g.update(50)
    expect(g.level).toBe(210)
  })

  it('Jaegerturm: 2x2, Kegel 2 breit und hoechstens 6 lang, dreht im Uhrzeigersinn, endet vor der Schlange', () => {
    for (let s = 1; s < 15; s++) {
      const g = new Game({ screenW: SW, screenH: SH, seed: s, startLevel: 315 })
      expect(g.tuerme.length).toBeGreaterThanOrEqual(1)
      const t = g.tuerme[0]
      expect(t.cells).toHaveLength(4)
      expect(t.kegel.length).toBeLessThanOrEqual(12)
      for (const p of t.kegel) expect(g.aufSchlange(p)).toBe(false)
      expect(g.gefahr(t.cells[0])).toBe('turm')
      const vorher = t.dir
      ;(g as unknown as { tuermeDrehen: () => void }).tuermeDrehen()
      expect(t.dir).toBe(R.CW[vorher])
    }
  })
})

describe('Froesche', () => {
  const mitFrosch = (seed: number, wende = 0) => {
    const g = new Game({ screenW: SW, screenH: SH, seed, cfg: { froschWende: wende } })
    leer(g)
    g.body = [{ x: 2, y: 2 }, { x: 1, y: 2 }, { x: 0, y: 2 }]
    g.dir = 'd'
    g.apple.p = { x: 11, y: 0 }
    g.froesche.push({ p: { x: 3, y: 15 }, from: { x: 3, y: 15 }, dir: 'r', altDir: 'r', drehT: -1e9, t: 0, flugAb: -1e9, hopAt: 3000 })
    return g
  }
  const takt = (g: Game, ms: number) => {
    g.time += ms
    ;(g as unknown as { froschTakt: () => void }).froschTakt()
  }

  it('huepft ein Feld in Blickrichtung und verschwindet am Rand', () => {
    const g = mitFrosch(2)
    const f = g.froesche[0]
    takt(g, 3001)
    expect(f.p).toEqual({ x: 4, y: 15 })
    for (let i = 0; i < 20 && f.gone === undefined; i++) takt(g, 3001)
    expect(f.gone).toBeDefined()
  })

  it('wechselt nach der Landung manchmal die Richtung (0,25 s spaeter)', () => {
    const g = mitFrosch(5, 100)
    const f = g.froesche[0]
    takt(g, 3001)
    expect(f.neuDir).toBeDefined()
    expect(f.dir).toBe('r')
    takt(g, R.FROSCH_FLUG + R.FROSCH_DREHEN + 5)
    expect(f.dir).not.toBe('r')
  })

  it('springt nie in die Schlange', () => {
    const g = mitFrosch(7)
    const f = g.froesche[0]
    g.body = [{ x: 4, y: 15 }, { x: 4, y: 16 }, { x: 4, y: 17 }]
    takt(g, 3001)
    expect(f.p).toEqual({ x: 3, y: 15 })
    expect(f.dir).not.toBe('r')
  })
})

describe('Kreativ-Modus', () => {
  it('Anhalten: vor dem Rand stehen bleiben, nie sterben', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 1, kreativ: { ...KREATIV, tod: 'anhalten' } })
    for (let i = 0; i < 200; i++) g.update(50)
    expect(g.status).toBe('play')
    expect(g.halt).toBe(true)
  })

  it('Geist: durch Mauern, aber nicht ueber den Kartenrand', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 1, kreativ: { ...KREATIV, tod: 'geist' } })
    leer(g)
    const h = g.body[0]
    g.mauern.push({ cells: [{ x: h.x + 1, y: h.y }], grown: 1, t: [0], next: 0 })
    g.apple.p = { x: 0, y: 0 }
    for (let i = 0; i < 8; i++) g.update(50)
    expect(g.status).toBe('play')
    expect(g.body[0].x).toBeGreaterThan(h.x + 1)
  })

  it('Feste Laenge und durch die eigene Schlange', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 1, startLevel: 60, kreativ: { ...KREATIV, wachsen: false, laenge: 8, durchSelbst: true, tod: 'anhalten' } })
    for (let i = 0; i < 100; i++) {
      if (i % 5 === 0) g.turn((['u', 'r', 'd', 'l'] as Dir[])[(i / 5) % 4], false)
      g.update(60)
    }
    expect(g.body.length).toBe(8)
    expect(g.status).toBe('play')
  })

  it('Springen auf hoeheren Level baut die Welt mit', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 3, kreativ: { ...KREATIV } })
    g.springeZu(220)
    expect(g.level).toBe(220)
    expect(g.expansions).toBe(11)
    expect(g.haeuser.length).toBeGreaterThanOrEqual(1)
    g.springeZu(100)
    expect(g.level).toBe(100)
    expect(g.expansions).toBe(11)
  })
})

describe('Aepfel als Waehrung und Power-ups', () => {
  const frisch = (seed = 1, startLevel = 1) => {
    const g = new Game({ screenW: SW, screenH: SH, seed, startLevel, cfg: { powerChance: 0 } })
    leer(g)
    g.powers = []
    g.apple.p = { x: 0, y: 0 }
    return g
  }
  const schritte = (g: Game, n: number) => {
    const ev: GameEvent[] = []
    for (let i = 0; i < n * 4; i++) {
      g.update(g.takt / 4 + 1)
      ev.push(...g.drain())
    }
    return ev
  }
  const vorDenKopf = (g: Game) => {
    const h = g.body[0]
    g.apple.p = { x: h.x + R.STEP[g.dir].x, y: h.y + R.STEP[g.dir].y }
  }

  it('Jeder Apfel kommt in den Vorrat', () => {
    const g = frisch()
    vorDenKopf(g)
    const ev = schritte(g, 1)
    expect(ev.find((e) => e.type === 'geld')).toMatchObject({ wert: 1, quelle: 'apfel' })
    expect(g.verdient).toBe(1)
  })

  it('Aepfel zaehlen ab Level 50 doppelt, ab 100 dreifach, die Farbe zeigt den Wert', () => {
    expect([1, 49, 50, 99, 100, 150, 260].map((l) => R.apfelFaktor(C, l))).toEqual([1, 1, 2, 2, 3, 4, 6])
    const g = frisch(2, 100)
    expect(g.apfelStufe()).toBe(3)
    vorDenKopf(g)
    const ev = schritte(g, 1)
    expect(ev.find((e) => e.type === 'geld')).toMatchObject({ wert: 3 })
    expect(ev.find((e) => e.type === 'eat')).toMatchObject({ stufe: 3 })
  })

  it('Beim Erreichen von Level 50 werden die Aepfel orange (x2)', () => {
    const g = frisch(3, 49)
    vorDenKopf(g)
    const ev = schritte(g, 1)
    expect(ev.find((e) => e.type === 'geld')).toMatchObject({ wert: 1 })
    expect(ev.find((e) => e.type === 'faktor')).toMatchObject({ faktor: 2 })
    expect(g.apfelStufe()).toBe(2)
  })

  it('Keine Muenzen mehr', () => {
    expect('muenzen' in new Game({ screenW: SW, screenH: SH, seed: 1 })).toBe(false)
  })

  it('Schild faengt einen Aufprall ab', () => {
    const g = frisch()
    const h = g.body[0]
    g.mauern.push({ cells: [{ x: h.x + 1, y: h.y }], grown: 1, t: [0], next: 0 })
    g.powerAn('schild')
    const ev = schritte(g, 3)
    expect(g.status).toBe('play')
    expect(g.effekt.schild).toBe(0)
    expect(ev.some((e) => e.type === 'schild')).toBe(true)
  })

  it('Schild haelt nicht ewig', () => {
    const g = frisch()
    g.powerAn('schild')
    g.powerAn('schild')
    expect(g.effekt.schild).toBe(2)
    g.time += C.schildDauer * 1000 - 100
    g.last = g.time
    g.update(16)
    expect(g.effekt.schild).toBe(2)
    g.time += 200
    g.last = g.time
    const ev: GameEvent[] = []
    g.update(16)
    ev.push(...g.drain())
    expect(g.effekt.schild).toBe(0)
    expect(ev.some((e) => e.type === 'powerEnde' && e.art === 'schild')).toBe(true)
  })

  it('Zeitlupe macht den Takt laenger', () => {
    const g = frisch()
    const vorher = g.takt
    g.powerAn('zeitlupe')
    // 30 % langsamer: Takt / 0,7
    expect(g.takt).toBeCloseTo(vorher / 0.7)
    expect(g.effekt.zeitlupeBis - g.time).toBe(30_000)
  })

  it('Geist laeuft durch Mauern', () => {
    const g = frisch()
    const h = g.body[0]
    g.mauern.push({ cells: [{ x: h.x + 1, y: h.y }], grown: 1, t: [0], next: 0 })
    g.powerAn('geist')
    schritte(g, 2)
    expect(g.status).toBe('play')
    expect(g.body[0].x).toBeGreaterThan(h.x + 1)
  })

  it('Schere nimmt 5 Glieder, aber nur bis zum naechsten Apfel', () => {
    const g = frisch()
    g.dir = 'r'
    g.body = Array.from({ length: 12 }, (_, i) => ({ x: 11 - i, y: 5 }))
    g.prev = g.body.map((p) => ({ ...p }))
    g.wachsRest = 0
    g.dir = 'd'
    const schwanz = g.body.slice(7).map((p) => ({ ...p }))
    g.powerAn('schere')
    expect(g.body.length).toBe(7)
    expect(g.effekt.schere).toBe(5)
    // Die abgeschnittenen Glieder fallen sichtbar ab
    expect(g.abgeschnitten.at(-1)?.cells).toEqual(schwanz)
    // Naechster Apfel: die 5 wachsen wieder nach (plus das normale Wachsen)
    vorDenKopf(g)
    const ev = schritte(g, 1)
    expect(ev.some((e) => e.type === 'powerEnde' && e.art === 'schere')).toBe(true)
    expect(g.effekt.schere).toBe(0)
    schritte(g, 10)
    expect(g.body.length).toBe(13)
  })

  it('Schere laesst mindestens 3 Glieder', () => {
    const g = frisch()
    g.body = g.body.slice(0, 3).concat([{ ...g.body[2] }, { ...g.body[2] }])
    g.powerAn('schere')
    expect(g.body.length).toBe(3)
    expect(g.effekt.schere).toBe(2)
  })
})

describe('Kein Gnadenschritt', () => {
  it('gibt es nicht mehr in den Regeln', () => {
    expect('gnade' in C).toBe(false)
  })
})

describe('Gegner-Schlangen', () => {
  /** Leere Karte (Level 1: rechteckig 12 x 22), nichts los. Gegner laufen auf jedem Level, wenn sie da sind */
  const welt = (seed = 1, startLevel = 1) => {
    const g = new Game({ screenW: SW, screenH: SH, seed, startLevel, cfg: { powerChance: 0 } })
    leer(g)
    g.powers = []
    g.wachsRest = 0
    g.apple.p = { x: 0, y: 0 }
    return g
  }
  const gegner = (body: { x: number; y: number }[], dir: Dir = 'r', art: 'rot' | 'lila' = 'rot') => ({
    art,
    body,
    prev: body.map((p) => ({ ...p })),
    dir,
    t: -1e9,
    last: -1e9,
    wachsAt: 1e12,
    wachsRest: 0,
    wuchsT: -1e9,
    eng: 0,
    angst: 0,
  })
  const schritt = (g: Game) => (g as unknown as { gegnerTakt: () => void }).gegnerTakt()

  it('erst ab Level 60, dann hoechstens 1, 2, 3', () => {
    expect([59, 60, 159, 160, 260, 900].map((l) => R.gegnerMax(C, l))).toEqual([0, 1, 1, 2, 3, 3])
    const g = new Game({ screenW: SW, screenH: SH, seed: 1, startLevel: 50 })
    expect(g.neuerGegner()).toBe(false)
  })

  it('erscheint rot, 3 bis 4 lang, weit weg vom Kopf, zusammenhaengend', () => {
    const laengen = new Set<number>()
    for (let s = 1; s < 25; s++) {
      const g = welt(s, 100)
      expect(g.neuerGegner()).toBe(true)
      expect(g.gegner[0].art).toBe('rot')
      const e = g.gegner[0]
      laengen.add(e.body.length)
      for (let i = 1; i < e.body.length; i++) expect(Math.abs(e.body[i].x - e.body[i - 1].x) + Math.abs(e.body[i].y - e.body[i - 1].y)).toBe(1)
      for (const p of e.body) {
        expect(g.inside(p)).toBe(true)
        expect(g.aufSchlange(p)).toBe(false)
      }
      const h = g.body[0]
      expect(Math.abs(e.body[0].x - h.x) + Math.abs(e.body[0].y - h.y)).toBeGreaterThanOrEqual(6)
      // Zweiter auf Level 100 nicht erlaubt
      expect(g.neuerGegner()).toBe(false)
    }
    expect([...laengen].sort()).toEqual([3, 4])
  })

  it('ist halb so schnell wie die Schlange', () => {
    const g = welt(2, 120)
    g.neuerGegner()
    const e = g.gegner[0]
    e.last = g.time
    let schritte = 0
    const kopf = () => `${e.body[0].x},${e.body[0].y}`
    let vorher = kopf()
    for (let i = 0; i < 40; i++) {
      g.time += g.tick
      schritt(g)
      if (kopf() !== vorher) schritte++
      vorher = kopf()
    }
    expect(schritte).toBe(20)
  })

  it('weicht der Schlange aus', () => {
    let weg = 0
    for (let s = 1; s <= 20; s++) {
      const g = welt(s)
      // Schlange kommt von links auf den Gegner zu
      g.body = [{ x: 3, y: 11 }, { x: 2, y: 11 }, { x: 1, y: 11 }]
      g.dir = 'r'
      g.gegner = [gegner([{ x: 7, y: 11 }, { x: 7, y: 12 }, { x: 7, y: 13 }], 'u')]
      const dist = () => Math.abs(g.gegner[0].body[0].x - g.body[0].x) + Math.abs(g.gegner[0].body[0].y - g.body[0].y)
      const vorher = dist()
      for (let i = 0; i < 3; i++) {
        g.time += g.gegnerSchrittzeit
        schritt(g)
      }
      if (dist() > vorher) weg++
      expect(g.gegner).toHaveLength(1)
    }
    expect(weg).toBeGreaterThanOrEqual(18)
  })

  it('laeuft nie in die Schlange, Hindernisse oder ueber den Rand', () => {
    for (let s = 1; s <= 8; s++) {
      const g = new Game({ screenW: SW, screenH: SH, seed: s * 31, startLevel: 160 })
      g.wachsRest = 0
      for (let i = 0; i < 3; i++) g.neuerGegner()
      expect(g.gegner.length).toBeGreaterThan(0)
      for (let i = 0; i < 400 && g.status === 'play'; i++) {
        const d = autopilot(g)
        if (d && !g.queue.length) g.turn(d, false)
        g.update(g.tick)
        g.drain()
        const wand = g.hindernisse(false)
        // Wolkenfelder, die noch auf einen Gegner warten, zaehlen nicht (die Wolke waechst erst, wenn er weg ist)
        for (const w of g.wolken) for (const p of w.pending) wand.delete(key(p.x, p.y))
        for (const e of g.gegner) {
          for (const p of e.body) {
            expect(g.inside(p)).toBe(true)
            expect(wand.has(key(p.x, p.y))).toBe(false)
          }
          expect(g.aufSchlange(e.body[0])).toBe(false)
          expect(new Set(e.body.map((p) => key(p.x, p.y))).size).toBe(e.body.length)
        }
      }
    }
  }, 30_000)

  it('stirbt eingekesselt und bringt Aepfel', () => {
    const g = welt(4)
    // Gegner in einer Ecke, die Schlange kesselt ihn ein
    g.gegner = [gegner([{ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 }], 'd')]
    g.body = [{ x: 0, y: 2 }, { x: 1, y: 2 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 0 }, { x: 3, y: 0 }]
    g.dir = 'l'
    g.time += g.gegnerSchrittzeit
    schritt(g)
    const ev = g.drain()
    expect(g.gegner).toHaveLength(0)
    expect(g.gegnerWeg).toHaveLength(1)
    expect(g.besiegt).toBe(1)
    const stufe = g.apfelStufe()
    expect(ev.find((e) => e.type === 'gegnerWeg')).toMatchObject({ laenge: 3, wert: 3 * stufe })
    expect(ev.find((e) => e.type === 'geld')).toMatchObject({ quelle: 'gegner', wert: 3 * stufe })
  })

  it('versucht sich zu befreien, solange es einen Ausweg gibt', () => {
    const g = welt(5)
    // Gang nach rechts offen: nicht sterben, sondern hinaus
    g.gegner = [gegner([{ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 }], 'd')]
    g.body = [{ x: 0, y: 4 }, { x: 1, y: 4 }, { x: 1, y: 3 }, { x: 1, y: 2 }]
    g.dir = 'l'
    for (let i = 0; i < 4; i++) {
      g.time += g.gegnerSchrittzeit
      schritt(g)
    }
    expect(g.gegner).toHaveLength(1)
    expect(g.gegner[0].body[0].x).toBeGreaterThan(1)
  })

  it('wird mit der Zeit laenger, hoechstens bis zur Hoechstlaenge', () => {
    const g = welt(6, 120)
    g.neuerGegner()
    const e = g.gegner[0]
    const start = e.body.length
    e.wachsAt = g.time
    e.last = g.time
    g.time += g.gegnerSchrittzeit
    schritt(g)
    g.time += g.gegnerSchrittzeit
    schritt(g)
    expect(e.body.length).toBe(start + 1)
    for (let i = 0; i < 400; i++) {
      g.time += 1000
      g.body = [{ x: 0, y: 0 }]
      schritt(g)
      if (!g.gegner.length) break
    }
    if (g.gegner.length) expect(e.body.length).toBeLessThanOrEqual(C.gegnerMaxLaenge)
  })

  it('Hineinfahren ist sofort toedlich', () => {
    const g = welt(7)
    g.body = [{ x: 3, y: 11 }, { x: 2, y: 11 }, { x: 1, y: 11 }]
    g.dir = 'r'
    g.prev = []
    g.gegner = [gegner([{ x: 4, y: 11 }, { x: 4, y: 12 }, { x: 4, y: 13 }], 'u')]
    g.gegner[0].last = 1e12
    expect(g.gefahr({ x: 4, y: 11 })).toBe('gegner')
    const ev: GameEvent[] = []
    for (let i = 0; i < 20 && g.status === 'play'; i++) {
      g.update(50)
      ev.push(...g.drain())
    }
    expect(ev.some((e) => e.type === 'halt')).toBe(false)
    expect(g.cause).toBe('gegner')
  })

  it('Lila: ab Level 120 manchmal, 5 lang, 20 % schneller', () => {
    expect(R.gegnerTakte(C, 'lila')).toBeCloseTo(R.GEGNER_TEMPO / 1.2)
    let lila = 0
    let rot = 0
    for (let s = 1; s <= 60; s++) {
      const g = welt(s, 130)
      g.neuerGegner()
      if (g.gegner[0]?.art === 'lila') {
        lila++
        expect(g.gegner[0].body).toHaveLength(5)
      } else rot++
    }
    // 25 %: seltener als rot
    expect(lila).toBeGreaterThan(5)
    expect(lila).toBeLessThan(rot)
    // Vor Level 120 nie lila
    for (let s = 1; s <= 20; s++) {
      const g = welt(s, 100)
      g.neuerGegner()
      expect(g.gegner[0].art).toBe('rot')
    }
  })

  it('Lila macht in derselben Zeit 20 % mehr Schritte', () => {
    const g = welt(9, 130)
    g.gegner = [gegner([{ x: 5, y: 3 }, { x: 4, y: 3 }, { x: 3, y: 3 }, { x: 2, y: 3 }, { x: 1, y: 3 }], 'r', 'lila')]
    g.body = [{ x: 6, y: 20 }, { x: 5, y: 20 }, { x: 4, y: 20 }]
    const e = g.gegner[0]
    e.last = g.time
    let schritte = 0
    for (let i = 0; i < 60; i++) {
      g.time += g.tick
      const vor = `${e.body[0].x},${e.body[0].y}`
      schritt(g)
      if (`${e.body[0].x},${e.body[0].y}` !== vor) schritte++
    }
    expect(schritte).toBe(36)
  })

  it('kommen im Spiel ab Level 60 ab und zu', () => {
    let gesehen = 0
    for (let s = 1; s <= 4; s++) {
      const g = new Game({ screenW: SW, screenH: SH, seed: s * 101, startLevel: 60 })
      const ev = play(g, 90)
      if (ev.some((e) => e.type === 'gegner')) gesehen++
      expect(ev.some((e) => e.type === 'unlock' && e.what === 'gegner')).toBe(false)
    }
    expect(gesehen).toBeGreaterThanOrEqual(3)
  }, 60_000)
})

describe('Lava', () => {
  const welt = (seed = 1) => {
    const g = new Game({ screenW: SW, screenH: SH, seed, cfg: { powerChance: 0 } })
    leer(g)
    g.apple.p = { x: 0, y: 0 }
    return g
  }

  it('ab Level 270 alle 30 Level ein See', () => {
    expect([269, 270, 299, 300, 330].map((l) => R.neueLava(C, l))).toEqual([false, true, false, true, true])
    const g = new Game({ screenW: SW, screenH: SH, seed: 3, startLevel: 270 })
    expect(g.lava.length).toBe(1)
  })

  it('beginnt mit einem Feld, waechst zusammenhaengend, hoert zwischen 6 und 15 auf, nie in die Schlange', () => {
    const zielGroessen = new Set<number>()
    for (let s = 1; s <= 25; s++) {
      const g = welt(s)
      expect(g.neuerLavaSee()).toBe(true)
      const l = g.lava[0]
      expect(l.cells).toHaveLength(1)
      expect(l.ziel).toBeGreaterThanOrEqual(6)
      expect(l.ziel).toBeLessThanOrEqual(15)
      zielGroessen.add(l.ziel)
      for (let i = 0; i < 40; i++) (g as unknown as { lavaWachsen: () => void }).lavaWachsen()
      expect(l.cells.length).toBeLessThanOrEqual(l.ziel)
      const set = new Set(l.cells.map((p) => key(p.x, p.y)))
      expect(set.size).toBe(l.cells.length)
      for (const p of l.cells) {
        expect(g.aufSchlange(p)).toBe(false)
        if (l.cells.length > 1) expect(R.DIRS.some((d) => set.has(key(p.x + R.STEP[d].x, p.y + R.STEP[d].y)))).toBe(true)
      }
      expect(g.gefahr(l.cells[0])).toBe('lava')
    }
    expect(zielGroessen.size).toBeGreaterThan(4)
  })

  it('breitet sich jeden 2. Apfel um ein Feld aus', () => {
    const g = welt(4)
    g.neuerLavaSee()
    const l = g.lava[0]
    l.ziel = 15
    const groessen: number[] = []
    for (let i = 0; i < 4; i++) {
      const h = g.body[0]
      const d = R.STEP[g.dir]
      g.apple.p = { x: h.x + d.x, y: h.y + d.y }
      if (!g.inside(g.apple.p) || g.gefahr(g.apple.p) !== null) {
        g.dir = 'd'
        g.apple.p = { x: h.x, y: h.y + 1 }
      }
      for (let k = 0; k < 4 && g.apples === i; k++) g.update(g.tick / 4 + 1)
      groessen.push(l.cells.length)
    }
    // Level 2, 4 ... (jeder 2. Apfel)
    expect(groessen).toEqual([2, 2, 3, 3])
  })
})

describe('Ameisen', () => {
  const welt = (seed = 1) => {
    const g = new Game({ screenW: SW, screenH: SH, seed, startLevel: 1, cfg: { powerChance: 0 } })
    leer(g)
    g.apple.p = { x: 0, y: 0 }
    return g
  }
  const ameise = (g: Game, p: { x: number; y: number }) => {
    g.ameisen.push({ p: { ...p }, from: { ...p }, heim: { ...p }, dir: 'r', t: 0, schrittT: -1e9, next: 0, alarm: -1, sattBis: 0 })
    return g.ameisen[g.ameisen.length - 1]
  }
  const takt = (g: Game) => {
    g.time += g.cfg.ameiseTakt * 1000 + 1
    ;(g as unknown as { ameisenTakt: () => void }).ameisenTakt()
  }

  it('chillt, solange die Schlange weiter weg ist', () => {
    const g = welt()
    g.body = [{ x: 2, y: 2 }, { x: 1, y: 2 }, { x: 0, y: 2 }]
    const a = ameise(g, { x: 8, y: 12 })
    for (let i = 0; i < 10; i++) takt(g)
    expect(a.p).toEqual({ x: 8, y: 12 })
    expect(a.alarm).toBe(-1)
  })

  it('im 2-Felder-Umkreis: erst bemerken, dann langsam hin, bis man raus ist, dann heim', () => {
    const g = welt()
    g.body = [{ x: 6, y: 10 }, { x: 5, y: 10 }, { x: 4, y: 10 }]
    const a = ameise(g, { x: 8, y: 12 })
    takt(g)
    expect(a.alarm).toBeGreaterThanOrEqual(0)
    expect(a.p).toEqual({ x: 8, y: 12 })
    takt(g)
    expect(Math.abs(a.p.x - 6) + Math.abs(a.p.y - 10)).toBe(3)
    // Schlange weit weg: Ameise geht zurueck nach Hause
    g.body = [{ x: 2, y: 2 }, { x: 1, y: 2 }, { x: 0, y: 2 }]
    for (let i = 0; i < 5; i++) takt(g)
    expect(a.p).toEqual({ x: 8, y: 12 })
    expect(a.alarm).toBe(-1)
  })

  it('beisst, wenn sie daneben ist: Level zurueck, danach satt', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 2, startLevel: 30, cfg: { powerChance: 0 } })
    leer(g)
    g.body = [{ x: 6, y: 10 }, { x: 5, y: 10 }, { x: 4, y: 10 }]
    const a = ameise(g, { x: 6, y: 11 })
    a.alarm = 0
    takt(g)
    const ev = g.drain()
    expect(g.level).toBe(30 - C.ameiseZurueck)
    expect(ev.some((e) => e.type === 'setback' && e.grund === 'ameise')).toBe(true)
    expect(a.sattBis).toBeGreaterThan(g.time)
  })

  it('der Kopf zertritt sie', () => {
    const g = welt()
    const h = g.body[0]
    ameise(g, { x: h.x + 1, y: h.y })
    const ev: GameEvent[] = []
    for (let i = 0; i < 4; i++) {
      g.update(g.tick / 2 + 1)
      ev.push(...g.drain())
    }
    expect(g.status).toBe('play')
    expect(g.ameisen).toHaveLength(0)
    expect(ev.some((e) => e.type === 'ameiseWeg')).toBe(true)
  })

  it('erscheinen ab Level 240 mit Abstand zur Schlange', () => {
    for (let s = 1; s <= 10; s++) {
      const g = new Game({ screenW: SW, screenH: SH, seed: s, startLevel: 240 })
      leer(g)
      expect(g.neueAmeise()).toBe(true)
      const a = g.ameisen[0]
      for (const b of g.body) expect(Math.max(Math.abs(b.x - a.p.x), Math.abs(b.y - a.p.y))).toBeGreaterThan(C.ameiseRadius)
    }
  })
})

describe('Sandbox', () => {
  it('eigene Kartengroesse, Laenge und Objekte, Welt bleibt so', () => {
    const g = new Game({
      screenW: SW,
      screenH: SH,
      seed: 5,
      startLevel: 150,
      kreativ: { ...KREATIV },
      sandbox: { breite: 3, hoehe: 2, laenge: 10, weiter: false, objekte: { mauer: 3, gegner: 2, lila: 1, ameise: 2, lava: 1, baum: 1 } },
    })
    expect(g.blocks).toHaveLength(6)
    expect(g.w).toBe(3 * g.bw)
    expect(g.h).toBe(2 * g.bh)
    expect(g.level).toBe(150)
    expect(g.body.length + g.wachsRest).toBe(10)
    expect(g.mauern).toHaveLength(3)
    expect(g.gegner.filter((e) => e.art === 'rot')).toHaveLength(2)
    expect(g.gegner.filter((e) => e.art === 'lila')).toHaveLength(1)
    expect(g.ameisen).toHaveLength(2)
    expect(g.lava).toHaveLength(1)
    expect(g.baeume).toHaveLength(1)
    expect(g.statisch).toBe(true)
    // Ein Apfel: Mauern bleiben, keine neuen Bloecke
    const mauern = JSON.stringify(g.mauern.map((m) => m.cells))
    g.springeZu(170)
    expect(JSON.stringify(g.mauern.map((m) => m.cells))).toBe(mauern)
    expect(g.blocks).toHaveLength(6)
  })

  it('normal weiter: ab dem Startlevel wie im echten Spiel', () => {
    const g = new Game({
      screenW: SW,
      screenH: SH,
      seed: 6,
      startLevel: 19,
      kreativ: { ...KREATIV },
      sandbox: { breite: 1, hoehe: 1, laenge: 3, weiter: true, objekte: {} },
    })
    expect(g.blocks).toHaveLength(1)
    g.springeZu(20)
    expect(g.blocks).toHaveLength(2)
  })

  it('jedes Objekt laesst sich einzeln dazutun', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 7, kreativ: { ...KREATIV }, sandbox: { breite: 3, hoehe: 3, laenge: 3, weiter: false, objekte: {} } })
    for (const art of ['mauer', 'teich', 'gift', 'baum', 'haus', 'turm', 'falle', 'wolke', 'frosch', 'gegner', 'lila', 'ameise', 'lava'] as const) expect(g.objektDazu(art)).toBe(true)
    g.allesWeg()
    expect(g.hindernisse().size).toBe(0)
  })
})

describe('Zeitleiste', () => {
  it('zeigt alles mit dem richtigen Level und folgt den Einstellungen', () => {
    const z = zeitleiste(C, 400)
    const bei = (l: number) => z.find((e) => e.level === l)?.teile.map((t) => t.text).join(' | ') ?? ''
    expect(bei(1)).toContain('Start')
    expect(bei(8)).toContain('Mauern beginnen')
    expect(bei(20)).toContain('Neues Gebiet')
    expect(bei(50)).toContain('×2')
    expect(bei(60)).toContain('Gegner')
    expect(bei(120)).toContain('Lila')
    expect(bei(130)).toContain('Hütte')
    expect(bei(240)).toContain('Ameisen')
    expect(bei(270)).toContain('Lavasee')
    expect(bei(315)).toContain('Jägerturm')
    // Umgestellt: Gegner ab 40
    expect(zeitleiste({ ...C, gegnerAb: 40 }, 100).find((e) => e.level === 40)?.teile.some((t) => t.text.includes('Gegner'))).toBe(true)
  })
})

/** Genau ein Schritt (update ist auf 100 ms je Aufruf begrenzt) */
const einSchritt = (g: Game) => {
  g.update(g.takt / 2 + 1)
  g.update(g.takt / 2 + 1)
}

describe('Neue Power-ups', () => {
  const welt = (seed = 1, startLevel = 1) => {
    const g = new Game({ screenW: SW, screenH: SH, seed, startLevel, cfg: { powerChance: 0 } })
    leer(g)
    g.powers = []
    g.wachsRest = 0
    g.apple.p = { x: 0, y: 0 }
    return g
  }
  const schritte = (g: Game, n: number) => {
    const ev: GameEvent[] = []
    for (let i = 0; i < n * 4 && g.status === 'play'; i++) {
      g.update(g.takt / 4 + 1)
      ev.push(...g.drain())
    }
    return ev
  }
  const gerade = (g: Game, y = 10) => {
    g.body = [{ x: 4, y }, { x: 3, y }, { x: 2, y }]
    g.prev = []
    g.dir = 'r'
    g.queue = []
  }

  it('Fuettern: Frosch und Gegner fressen statt sterben, bringt Aepfel', () => {
    const g = welt()
    gerade(g)
    g.froesche.push({ p: { x: 5, y: 10 }, from: { x: 5, y: 10 }, dir: 'u', altDir: 'u', drehT: -1e9, t: 0, flugAb: -1e9, hopAt: 1e12 })
    g.gegner.push({ art: 'rot', body: [{ x: 7, y: 10 }, { x: 7, y: 11 }, { x: 7, y: 12 }], prev: [], dir: 'u', t: 0, last: 1e12, wachsAt: 1e12, wachsRest: 0, wuchsT: 0, eng: 0, angst: 0 })
    g.powerAn('fuettern')
    const ev = schritte(g, 4)
    expect(g.status).toBe('play')
    expect(g.froesche).toHaveLength(0)
    expect(g.gegner).toHaveLength(0)
    const gef = ev.filter((e) => e.type === 'gefressen')
    expect(gef.map((e) => (e as { was: string }).was)).toEqual(['frosch', 'gegner'])
    expect(g.verdient).toBe(2 + 3)
  })

  it('Ohne Fuettern ist der Frosch toedlich', () => {
    const g = welt()
    gerade(g)
    g.froesche.push({ p: { x: 5, y: 10 }, from: { x: 5, y: 10 }, dir: 'u', altDir: 'u', drehT: -1e9, t: 0, flugAb: -1e9, hopAt: 1e12 })
    schritte(g, 4)
    expect(g.cause).toBe('frosch')
  })

  it('Goldener Apfel: unbesiegbar, ueber sich selbst, Mauern weg', () => {
    const g = welt()
    gerade(g)
    g.mauern.push({ cells: [{ x: 5, y: 10 }, { x: 6, y: 10 }], grown: 2, t: [0, 0], next: 0 })
    g.powerAn('gold')
    expect(g.unbesiegbar()).toBe(true)
    schritte(g, 3)
    expect(g.status).toBe('play')
    expect(g.mauern).toHaveLength(0)
    // Ueber sich selbst: Kreis fahren
    g.body = Array.from({ length: 10 }, (_, i) => ({ x: 8 - i, y: 5 }))
    g.prev = []
    g.dir = 'd'
    g.queue = []
    for (const d of ['l', 'u'] as Dir[]) {
      schritte(g, 1)
      g.turn(d, false)
    }
    schritte(g, 2)
    expect(g.status).toBe('play')
  })

  it('Magnet: Apfel und Power-ups im Umkreis von 2 kommen sofort', () => {
    const g = welt()
    gerade(g)
    g.apple.p = { x: 6, y: 12 }
    g.powers.push({ p: { x: 3, y: 8 }, t: 0, until: 1e9, art: 'schild' })
    g.powerAn('magnet')
    const ev = schritte(g, 1)
    expect(ev.some((e) => e.type === 'eat')).toBe(true)
    expect(g.effekt.schild).toBe(1)
    expect(g.powers).toHaveLength(0)
  })

  it('Magnet holt nichts, was weiter weg ist', () => {
    const g = welt()
    gerade(g)
    g.apple.p = { x: 11, y: 20 }
    g.powerAn('magnet')
    const ev = schritte(g, 1)
    expect(ev.some((e) => e.type === 'eat')).toBe(false)
  })

  it('Maulwurf: graben, zurueckkommen legt Gang und Eingeschlossenes frei', () => {
    const g = welt(3, 100)
    // Karte 12 breit (Level 100: mehrere Bloecke, wir nehmen den Rand ganz rechts)
    const vorher = g.felder()
    const y = Math.floor(g.h / 2)
    let x = g.w - 1
    while (!g.inside({ x, y })) x--
    g.body = [{ x, y }, { x: x - 1, y }, { x: x - 2, y }]
    g.prev = []
    g.dir = 'r'
    g.queue = []
    g.powerAn('maulwurf')
    // 3 raus, 2 runter, 3 zurueck: Rechteck 3 x 1 eingeschlossen
    const wege: Dir[] = ['r', 'r', 'r', 'd', 'd', 'l', 'l', 'l']
    for (const d of wege) {
      if (d !== g.dir) g.turn(d, false)
      einSchritt(g)
    }
    g.drain()
    expect(g.status).toBe('play')
    expect(g.tunnel).toHaveLength(0)
    // Gang (6 Felder: 3 raus, 2 runter, 1 zurueck vor dem Rand) + eingeschlossene 2 x 1
    expect(g.felder()).toBeGreaterThan(vorher + 6)
  })

  it('Maulwurf vorbei, noch in der Erde: Spielende', () => {
    const g = welt(3)
    const y = 5
    g.body = [{ x: g.w - 1, y }, { x: g.w - 2, y }, { x: g.w - 3, y }]
    g.prev = []
    g.dir = 'r'
    g.queue = []
    g.powerAn('maulwurf')
    for (let i = 0; i < 3; i++) einSchritt(g)
    expect(g.inside(g.body[0])).toBe(false)
    g.effekt.maulwurfBis = g.time
    g.update(10)
    expect(g.status).toBe('over')
    expect(g.cause).toBe('erde')
  })

  it('Maulwurf erst ab Level 100, Fuettern nur mit Tieren', () => {
    const g = welt(4, 50)
    const arten = new Set<string>()
    for (let i = 0; i < 400; i++) arten.add((g as unknown as { powerWahl: () => string }).powerWahl())
    expect(arten.has('maulwurf')).toBe(false)
    expect(arten.has('fuettern')).toBe(false)
    expect(arten.has('gold')).toBe(true)
    const h = new Game({ screenW: SW, screenH: SH, seed: 4, startLevel: 120 })
    h.neuerFrosch(true)
    const arten2 = new Set<string>()
    for (let i = 0; i < 400; i++) arten2.add((h as unknown as { powerWahl: () => string }).powerWahl())
    expect(arten2.has('maulwurf')).toBe(true)
    expect(arten2.has('fuettern')).toBe(true)
  })
})

describe('Erde und Erze', () => {
  it('fester Zufall: dasselbe Weltfeld hat immer dasselbe', () => {
    for (let i = 0; i < 50; i++) expect(R.erdeBei(C, i * 7, -i * 3)).toBe(R.erdeBei(C, i * 7, -i * 3))
    let gold = 0
    let dia = 0
    for (let x = 0; x < 200; x++)
      for (let y = 0; y < 100; y++) {
        const e = R.erdeBei(C, x, y)
        if (e === 'gold') gold++
        if (e === 'dia') dia++
      }
    // 9 bzw. 1,2 je 1000 Felder
    expect(gold / 20).toBeGreaterThan(5)
    expect(gold / 20).toBeLessThan(13)
    expect(dia / 20).toBeGreaterThan(0.3)
    expect(dia / 20).toBeLessThan(3)
  })

  it('Erz einsammeln: Gold 3 x, Diamant 6 x der aktuelle Apfel', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 1, startLevel: 100, cfg: { powerChance: 0 } })
    leer(g)
    g.apple.p = { x: 0, y: 0 }
    const h = g.body[0]
    const d = R.STEP[g.dir]
    g.funde.push({ p: { x: h.x + d.x, y: h.y + d.y }, art: 'gold', t: 0 }, { p: { x: h.x + 2 * d.x, y: h.y + 2 * d.y }, art: 'dia', t: 0 })
    const ev: GameEvent[] = []
    for (let i = 0; i < 12; i++) {
      g.update(g.takt / 4 + 1)
      ev.push(...g.drain())
    }
    expect(ev.filter((e) => e.type === 'fund').map((e) => (e as { wert: number }).wert)).toEqual([9, 18])
  })

  it('Rubin 10 x, Opal 20 x, beide seltener als Diamant', () => {
    expect(R.erzWert(C, 'rubin')).toBe(10)
    expect(R.erzWert(C, 'opal')).toBe(20)
    const n = { gold: 0, dia: 0, rubin: 0, opal: 0 }
    for (let x = 0; x < 600; x++)
      for (let y = 0; y < 600; y++) {
        const e = R.erdeBei(C, x, y)
        if (e === 'gold' || e === 'dia' || e === 'rubin' || e === 'opal') n[e]++
      }
    expect(n.gold).toBeGreaterThan(n.dia)
    expect(n.dia).toBeGreaterThan(n.rubin)
    expect(n.rubin).toBeGreaterThan(n.opal)
    expect(n.opal).toBeGreaterThan(0)
  })

  it('Spitzhacke legt ein zufaelliges Erz auf die Karte, drueberfahren graebt es aus', () => {
    const arten = new Set<string>()
    for (let s = 1; s <= 60; s++) {
      const g = new Game({ screenW: SW, screenH: SH, seed: s, startLevel: 100, cfg: { powerChance: 0 } })
      leer(g)
      g.powerAn('spitzhacke')
      expect(g.funde).toHaveLength(1)
      expect(g.inside(g.funde[0].p)).toBe(true)
      expect(g.aufSchlange(g.funde[0].p)).toBe(false)
      arten.add(g.funde[0].art)
    }
    expect(arten.has('gold')).toBe(true)
    expect(arten.has('dia')).toBe(true)
  })

  it('Neuer Block legt Erze darin frei', () => {
    let funde = 0
    for (let s = 1; s <= 20; s++) {
      const g = new Game({ screenW: SW, screenH: SH, seed: s })
      g.expand()
      funde += g.funde.length
    }
    expect(funde).toBeGreaterThan(0)
  })
})

describe('Gebiet waehlen', () => {
  it('alle 20 Level leuchten die Waende; dagegenfahren baut dort den Block an', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 2, startLevel: 19, cfg: { powerChance: 0 } })
    leer(g)
    g.body = [{ x: 9, y: 5 }, { x: 8, y: 5 }, { x: 7, y: 5 }]
    g.prev = []
    g.dir = 'r'
    g.queue = []
    g.apple.p = { x: 10, y: 5 }
    const ev: GameEvent[] = []
    for (let i = 0; i < 4; i++) {
      g.update(g.takt / 2 + 1)
      ev.push(...g.drain())
    }
    expect(g.level).toBe(20)
    expect(g.wahl).toBe(1)
    expect(g.blocks).toHaveLength(2)
    expect(ev.some((e) => e.type === 'wahl')).toBe(true)
    // Weiter nach rechts gegen die leuchtende Wand
    g.apple.p = { x: 0, y: 20 }
    for (let i = 0; i < 8 && g.status === 'play'; i++) {
      g.update(g.takt / 2 + 1)
      ev.push(...g.drain())
    }
    expect(g.status).toBe('play')
    expect(g.wahl).toBe(0)
    expect(g.blocks).toHaveLength(3)
    expect(g.blocks.some((b) => b.x === 1 && b.y === 0)).toBe(true)
    expect(g.body[0].x).toBeGreaterThanOrEqual(12)
  })

  it('ohne Wahl kommt der alte Block beim naechsten Mal zufaellig', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 3, startLevel: 19 })
    g.springeZu(20)
    // Springen = Aufbau: sofort zufaellig
    expect(g.blocks).toHaveLength(3)
  })
})

describe('Eis', () => {
  it('ab Level 180 alle 30 Level, 4 bis 10 Felder', () => {
    expect([179, 180, 210, 211].map((l) => R.neuesEis(C, l))).toEqual([false, true, true, false])
    for (let s = 1; s <= 15; s++) {
      const g = new Game({ screenW: SW, screenH: SH, seed: s, startLevel: 180 })
      expect(g.eis.length).toBeGreaterThanOrEqual(1)
      const e = g.eis[0]
      expect(e.cells.length).toBeGreaterThanOrEqual(4)
      expect(e.cells.length).toBeLessThanOrEqual(10)
    }
  })

  it('auf Eis laesst sich nicht lenken', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 1, cfg: { powerChance: 0 } })
    leer(g)
    g.apple.p = { x: 0, y: 0 }
    g.body = [{ x: 3, y: 10 }, { x: 2, y: 10 }, { x: 1, y: 10 }]
    g.prev = []
    g.dir = 'r'
    g.eis.push({ cells: [{ x: 4, y: 10 }, { x: 5, y: 10 }, { x: 6, y: 10 }], t: 0 })
    einSchritt(g)
    expect(g.body[0]).toEqual({ x: 4, y: 10 })
    g.turn('d', false)
    einSchritt(g)
    einSchritt(g)
    expect(g.body[0]).toEqual({ x: 6, y: 10 })
    // Runter vom Eis: wieder lenkbar
    einSchritt(g)
    g.turn('d', false)
    einSchritt(g)
    expect(g.body[0]).toEqual({ x: 7, y: 11 })
  })
})

describe('Power-up-Garantie', () => {
  it('spaetestens nach 8 Aepfeln ohne Power-up kommt eins', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 3, startLevel: 20, cfg: { powerChance: 0 } })
    leer(g)
    g.powers = []
    let aepfel = 0
    for (let i = 0; i < 200 && !g.powers.length; i++) {
      const h = g.body[0]
      const d = R.STEP[g.dir]
      const n = { x: h.x + d.x, y: h.y + d.y }
      if (!g.inside(n) || g.gefahr(n) !== null) {
        const frei = (['u', 'd', 'l', 'r'] as Dir[]).find((dd) => {
          const m = { x: h.x + R.STEP[dd].x, y: h.y + R.STEP[dd].y }
          return dd !== R.OPP[g.dir] && g.inside(m) && g.gefahr(m) === null
        })
        if (frei) g.turn(frei, false)
        g.update(g.takt / 2 + 1)
        g.update(g.takt / 2 + 1)
        g.drain()
        continue
      }
      g.apple.p = n
      const vor = g.apples
      g.update(g.takt / 2 + 1)
      g.update(g.takt / 2 + 1)
      g.drain()
      if (g.apples > vor) aepfel++
    }
    expect(g.powers).toHaveLength(1)
    // Der Aufbau beim Start zaehlt schon als ein Apfel-Durchgang mit
    expect(aepfel).toBeLessThanOrEqual(C.powerGarantie)
    expect(aepfel).toBeGreaterThanOrEqual(C.powerGarantie - 1)
  })
})

describe('Gebiets-Wahl mit Zeitlimit', () => {
  it('nach 30 s ohne Wahl kommt der Block zufaellig', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 2, startLevel: 19, cfg: { powerChance: 0 } })
    leer(g)
    g.body = [{ x: 5, y: 15 }, { x: 4, y: 15 }, { x: 3, y: 15 }]
    g.prev = []
    g.dir = 'r'
    g.apple.p = { x: 6, y: 15 }
    for (let i = 0; i < 4; i++) g.update(g.takt / 2 + 1)
    g.drain()
    expect(g.wahl).toBe(1)
    expect(g.wahlBis - g.time).toBeGreaterThan(29_000)
    // 30 s im Kreis fahren (Kreativ-Anhalten: nicht sterben)
    g.kreativ = { tod: 'geist', rueckschlag: false, durchSelbst: true, wachsen: true, laenge: 3 }
    const ev: GameEvent[] = []
    for (let t = 0; t < 31_000 && g.wahl > 0; t += 50) {
      if (t % 600 === 0) g.turn((['u', 'r', 'd', 'l'] as Dir[])[(t / 600) % 4], false)
      g.update(50)
      ev.push(...g.drain())
    }
    expect(g.wahl).toBe(0)
    expect(g.blocks).toHaveLength(3)
    expect(ev.some((e) => e.type === 'wahlVorbei')).toBe(true)
  })
})
