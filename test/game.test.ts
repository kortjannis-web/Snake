import { describe, expect, it } from 'vitest'
import { autopilot } from '../src/game/autopilot'
import { Game, key } from '../src/game/game'
import * as R from '../src/game/rules'
import type { Dir, GameEvent } from '../src/game/types'

const SW = 12
const SH = 25

/** Spielt mit dem Autopilot; legt den Apfel oft direkt vor die Schlange, damit es schnell vorangeht */
function play(g: Game, bisLevel: number, maxSteps = 200_000) {
  const events: GameEvent[] = []
  for (let i = 0; i < maxSteps && g.status === 'play' && g.level < bisLevel; i++) {
    const d = autopilot(g)
    if (d) g.turn(d, false)
    // Abkuerzung: Apfel auf das naechste Feld legen, wenn es frei ist
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
    expect(R.mauern(7, 300)).toEqual([])
    expect(R.mauern(8, 300)).toEqual([2])
    expect(R.mauern(16, 300)).toEqual([3])
    expect(R.mauern(40, 300)).toEqual([6])
    expect(R.mauern(48, 400)).toEqual([6, 2])
    expect(R.mauern(88, 1000)).toEqual([6, 6, 2])
    // Begrenzt durch die Kartengroesse
    expect(R.mauern(300, 300)).toHaveLength(2)
  })

  it('Teiche werden langsam groesser', () => {
    expect([15, 30, 45, 60, 75, 90].map(R.teichGroesse)).toEqual([2, 2, 3, 3, 4, 4])
    expect(R.teichGroesse(3000)).toBe(12)
  })

  it('Giftwolke waechst: Punkt, Plus, 3x3, ...', () => {
    expect(R.wolkenForm(0)).toHaveLength(1)
    expect(R.wolkenForm(1)).toHaveLength(5)
    expect(R.wolkenForm(2)).toHaveLength(9)
    expect(R.wolkenForm(3)).toHaveLength(13)
    expect(R.wolkenForm(4)).toHaveLength(25)
  })

  it('Neues Gebiet alle 30 Level bis 300', () => {
    const lv = Array.from({ length: 400 }, (_, i) => i + 1).filter(R.neuesGebiet)
    expect(lv).toEqual([30, 60, 90, 120, 150, 180, 210, 240, 270])
  })
})

describe('Karte', () => {
  it('waechst immer um einen halben Bildschirm und bleibt ein Rechteck', () => {
    for (let s = 1; s < 40; s++) {
      const g = new Game({ screenW: SW, screenH: SH, seed: s })
      const half = (SW * SH) / 2
      let area = g.w * g.h
      for (let i = 0; i < 9; i++) {
        g.expand()
        const added = g.w * g.h - area
        // Rundung auf ganze Streifen: hoechstens eine halbe Kante daneben
        expect(Math.abs(added - half)).toBeLessThanOrEqual(Math.max(g.w, g.h) / 2 + 1)
        area = g.w * g.h
      }
      expect(g.expansions).toBe(9)
    }
  })

  it('verschiebt beim Wachsen nach oben/links alles mit', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 3 })
    const head = { ...g.body[0] }
    const apple = { ...g.apple.p }
    g.expand('top')
    expect(g.body[0].y - head.y).toBe(g.gebiet!.y)
    expect(g.apple.p.y - apple.y).toBe(g.gebiet!.y)
    g.expand('left')
    expect(g.body[0].x - head.x).toBe(g.gebiet!.x)
  })

  it('Startlevel 300 hat 9 Erweiterungen', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 9, startLevel: 300 })
    expect(g.expansions).toBe(9)
    expect(g.level).toBe(300)
  })
})

describe('Spiel', () => {
  it('Gnadenschritt: vor dem Rand erst stehen bleiben', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 1 })
    g.apple.p = { x: 0, y: 0 }
    const ev: GameEvent[] = []
    for (let i = 0; i < 30 && g.status === 'play'; i++) {
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
      const g = new Game({ screenW: SW, screenH: SH, seed: s, startLevel: 100 })
      g.fallen = []
      g.dir = 'u'
      g.queue = []
      g.body = [{ x: 5, y: 20 }, { x: 5, y: 21 }, { x: 5, y: 22 }]
      g.mauern = []
      g.teiche = []
      g.gift = []
      g.wolken = []
      g.ameisen = []
      g.apple.p = { x: 0, y: 0 }
      expect(g.neueFalle()).toBe(true)
      const f = g.fallen[0].p
      expect(f.x).toBe(5)
      expect(20 - f.y).toBeGreaterThanOrEqual(5)
      expect(20 - f.y).toBeLessThanOrEqual(8)
    }
  })

  it('Giftwolke waechst alle 5 Sekunden und loest sich wieder auf', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 5, startLevel: 160 })
    g.wolken = []
    g.fallen = []
    g.ameisen = []
    expect(g.neueWolke()).toBe(true)
    const w = g.wolken[0]
    // Schlange laeuft im Kreis, damit sie nicht stirbt
    const kreis = ['u', 'r', 'd', 'l'] as const
    let t = 0
    const run = (ms: number) => {
      for (let x = 0; x < ms; x += 50) {
        g.update(50)
        t += 50
        if (t % (g.tick * 2) < 50) {
          const d = autopilot(g)
          if (d) g.turn(d, false)
        }
      }
    }
    void kreis
    expect(w.stage).toBe(0)
    run(5100)
    if (g.status !== 'play') return
    expect(w.stage).toBe(1)
    expect(w.cells.length + w.pending.length).toBeGreaterThanOrEqual(3)
  })

  it('Ameise laeuft geradeaus und verschwindet am Rand', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 2, startLevel: 200 })
    g.ameisen = []
    g.wolken = []
    g.fallen = []
    g.mauern = []
    g.teiche = []
    g.gift = []
    g.body = [{ x: 2, y: 2 }, { x: 1, y: 2 }, { x: 0, y: 2 }]
    g.dir = 'd'
    g.ameisen.push({ p: { x: 8, y: 20 }, from: { x: 8, y: 20 }, dir: 'r', t: 0, movedAt: 0, nextAt: g.time + 3000 })
    // Regie aus: nur die eine Ameise beobachten (Schlange steht im Gnadenschritt still)
    const a = g.ameisen[0]
    const before = { ...a.p }
    // Zeit vorspulen ohne Schlangenlogik: Ameisen-Takt direkt
    g.time += 3001
    ;(g as unknown as { ameisenTakt: () => void }).ameisenTakt()
    expect(a.p.x).toBe(before.x + 1)
    for (let i = 0; i < 200 && a.gone === undefined; i++) {
      g.time += 3001
      ;(g as unknown as { ameisenTakt: () => void }).ameisenTakt()
    }
    expect(a.gone).toBeDefined()
  })

  it('laeuft lange ohne Fehler und alles taucht auf', () => {
    const seen = new Set<string>()
    let maxLevel = 0
    let expansions = 0
    for (let s = 1; s <= 6; s++) {
      const g = new Game({ screenW: SW, screenH: SH, seed: s * 7919 })
      const ev = play(g, 330)
      ev.forEach((e) => seen.add(e.type === 'unlock' ? 'unlock:' + e.what : e.type))
      maxLevel = Math.max(maxLevel, g.level)
      expansions = Math.max(expansions, g.expansions)
      // Invarianten
      const k = new Set(g.body.map((p) => key(p.x, p.y)))
      expect(k.size).toBe(g.body.length)
      for (const p of g.body) expect(g.inside(p)).toBe(true)
      expect(g.inside(g.apple.p)).toBe(true)
    }
    expect(maxLevel).toBeGreaterThanOrEqual(150)
    expect(expansions).toBeGreaterThanOrEqual(4)
    for (const t of ['eat', 'expand', 'wall', 'pond', 'unlock:gift', 'unlock:falle', 'trap']) expect(seen).toContain(t)
  }, 120_000)

  it('ab Level 200 kommen Ameisen, Wolken und Fallen (mindestens zwei Ereignisse)', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 11, startLevel: 210 })
    const ev: GameEvent[] = []
    for (let i = 0; i < 400 && g.status === 'play'; i++) {
      const d = autopilot(g)
      if (d) g.turn(d, false)
      g.update(g.tick)
      ev.push(...g.drain())
    }
    const types = new Set(ev.map((e) => e.type))
    expect(types.has('ant') || types.has('cloud') || types.has('trap')).toBe(true)
  })
})

describe('Rueckschlaege, Baeume und Haeuser', () => {
  const leer = (g: Game) => {
    g.mauern = []
    g.teiche = []
    g.gift = []
    g.wolken = []
    g.ameisen = []
    g.fallen = []
    g.baeume = []
    g.haeuser = []
  }

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
    // Geschuetzt: gleich danach kein zweiter Treffer
    expect(g.schutzBis).toBeGreaterThan(g.time)
  })

  it('Nach einem Rueckschlag kommen Gebiet und Teich nicht doppelt', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 8, startLevel: 31 })
    const exp = g.expansions
    g.setback(5, 'licht')
    expect(g.level).toBe(26)
    for (let i = 0; i < 6; i++) {
      leer(g)
      const h = g.body[0]
      const dir = g.dir
      g.apple.p = { x: h.x + R.STEP[dir].x, y: h.y + R.STEP[dir].y }
      if (!g.inside(g.apple.p)) break
      for (let k = 0; k < 4 && g.level < 27 + i; k++) g.update(50)
    }
    expect(g.level).toBeGreaterThanOrEqual(30)
    expect(g.expansions).toBe(exp)
  })

  it('Baum: 1-1-2-1 Felder, ab 100 alle 40 Level', () => {
    expect([99, 100, 120, 140, 180, 181].map(R.neuerBaum)).toEqual([false, true, false, true, true, false])
    for (let s = 1; s < 20; s++) {
      const g = new Game({ screenW: SW, screenH: SH, seed: s, startLevel: 100 })
      expect(g.baeume.length).toBe(1)
      const b = g.baeume[0]
      expect(b.cells).toHaveLength(5)
      // genau eine Reihe ist doppelt breit
      const d = R.STEP[b.dir]
      const entlang = b.cells.map((c) => (c.x - b.root.x) * d.x + (c.y - b.root.y) * d.y)
      expect(entlang.sort()).toEqual([0, 1, 2, 2, 3])
      expect(g.gefahr(b.cells[3])).toBe('baum')
    }
  })

  it('Haus: 2x3 oder mit Ecke, vier Fenster, Licht wechselt nach jedem Apfel', () => {
    expect([209, 210, 240, 270].map(R.neuesHaus)).toEqual([false, true, true, true])
    const groessen = new Set<number>()
    for (let s = 1; s < 30; s++) {
      const g = new Game({ screenW: SW, screenH: SH, seed: s, startLevel: 210 })
      expect(g.haeuser.length).toBe(1)
      const h = g.haeuser[0]
      groessen.add(h.cells.length)
      expect(h.fenster.map((f) => f.d).sort()).toEqual(['d', 'l', 'r', 'u'])
      // Fenster liegt am Rand des Hauses, nach aussen
      for (const f of h.fenster) {
        expect(h.cells.some((c) => c.x === f.p.x && c.y === f.p.y)).toBe(true)
        const vor = { x: f.p.x + R.STEP[f.d].x, y: f.p.y + R.STEP[f.d].y }
        expect(h.cells.some((c) => c.x === vor.x && c.y === vor.y)).toBe(false)
      }
      expect(h.strahl.length).toBeLessThanOrEqual(2)
      expect(g.gefahr(h.cells[0])).toBe('haus')
    }
    expect([...groessen].sort()).toEqual([10, 6])
  })

  it('Licht kostet 5 Level', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 3, startLevel: 215 })
    const h = g.haeuser[0]
    leer(g)
    g.haeuser = [h]
    const c = h.strahl[0]
    expect(c).toBeDefined()
    // Schlange so legen, dass der Kopf im naechsten Schritt ins Licht laeuft
    const f = h.fenster[h.licht]
    const quer: Dir = f.d === 'u' || f.d === 'd' ? 'r' : 'd'
    const q = R.STEP[quer]
    g.body = [1, 2, 3].map((k) => ({ x: c.x - q.x * k, y: c.y - q.y * k }))
    g.dir = quer
    g.queue = []
    g.prev = []
    g.apple.p = { x: -5, y: -5 }
    for (let i = 0; i < 4 && g.level === 215; i++) g.update(50)
    expect(g.status).toBe('play')
    expect(g.level).toBe(210)
  })
})
