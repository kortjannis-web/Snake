import { describe, expect, it } from 'vitest'
import { autopilot } from '../src/game/autopilot'
import { Game, key } from '../src/game/game'
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

  it('Neuer Block alle 20 Level bis 300 (einstellbar)', () => {
    const lv = Array.from({ length: 400 }, (_, i) => i + 1).filter((l) => R.neuesGebiet(C, l))
    expect(lv).toEqual([20, 40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280])
    const c30 = { ...C, gebietAlle: 30 }
    expect(Array.from({ length: 400 }, (_, i) => i + 1).filter((l) => R.neuesGebiet(c30, l))).toHaveLength(9)
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

  it('Startlevel 300: 14 neue Bloecke, Welt wird mit aufgebaut', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 9, startLevel: 300 })
    expect(g.expansions).toBe(14)
    expect(g.blocks).toHaveLength(16)
    expect(g.level).toBe(300)
    expect(g.teiche.length).toBeGreaterThan(0)
    expect(g.baeume.length).toBeGreaterThan(0)
    expect(g.haeuser.length).toBeGreaterThan(0)
    // Die Schlange waechst nach dem Start auf ihre Laenge
    expect(g.wachsRest).toBeGreaterThan(100)
  })
})

describe('Spiel', () => {
  it('Gnadenschritt: vor dem Rand erst stehen bleiben', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 1 })
    g.apple.p = { x: 0, y: 0 }
    const ev: GameEvent[] = []
    for (let i = 0; i < 60 && g.status === 'play'; i++) {
      g.update(g.tick)
      ev.push(...g.drain())
    }
    expect(ev.some((e) => e.type === 'halt')).toBe(true)
    expect(g.status).toBe('over')
    expect(g.cause).toBe('rand')
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
      const k = new Set(g.body.map((p) => key(p.x, p.y)))
      expect(k.size).toBe(g.body.length)
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

  it('Haus: 2x3 oder mit Ecke, vier Fenster, Licht nie auf der Schlange', () => {
    const groessen = new Set<number>()
    for (let s = 1; s < 30; s++) {
      const g = new Game({ screenW: SW, screenH: SH, seed: s, startLevel: 210 })
      expect(g.haeuser.length).toBeGreaterThanOrEqual(1)
      const h = g.haeuser[0]
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
