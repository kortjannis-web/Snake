import { describe, expect, it } from 'vitest'
import { autopilot } from '../src/game/autopilot'
import { Game, key } from '../src/game/game'
import * as R from '../src/game/rules'
import { GEFAHREN, schwereBis, zufallsReihenfolge } from '../src/game/reihenfolge'
import type { GameEvent } from '../src/game/types'

const SW = 12
const SH = 23
const leer = (g: Game) => {
  g.mauern = []
  g.teiche = []
  g.gift = []
  g.froesche = []
  g.fallen = []
  g.baeume = []
  g.haeuser = []
  g.tuerme = []
  g.gegner = []
  g.ameisen = []
}
/** Apfel direkt vor den Kopf und einen Schritt gehen */
function essen(g: Game) {
  const h = g.body[0]
  const s = R.STEP[g.dir]
  g.apple = { p: { x: h.x + s.x, y: h.y + s.y }, t: g.time }
  const vorher = g.gegessen
  for (let i = 0; i < 10 && g.gegessen === vorher && g.status === 'play'; i++) g.update(100)
}
const drain = (g: Game) => g.drain().map((e) => e.type)

describe('Wüste: Flut', () => {
  it('Warnung, mit dem nächsten Apfel Wasser am Rand (2 Felder), mit dem Apfel danach wieder weg', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 3, wueste: true })
    leer(g)
    g.flutWarnen()
    expect(g.flut?.phase).toBe('warnung')
    const zone = g.flut!.zellen
    // Randfelder und zwei nach innen, die Mitte nicht
    expect(zone.has(key(0, 0))).toBe(true)
    expect(zone.has(key(1, 5))).toBe(true)
    expect(zone.has(key(2, 5))).toBe(false)
    expect(zone.has(key(g.w - 2, 5))).toBe(true)
    expect(zone.has(key(g.w - 3, 5))).toBe(false)
    // Waehrend der Warnung landet kein Apfel in der kuenftigen Flut
    for (let i = 0; i < 20; i++) {
      g.neuerApfel()
      expect(zone.has(key(g.apple.p.x, g.apple.p.y))).toBe(false)
    }
    essen(g)
    expect(g.flut?.phase).toBe('aktiv')
    expect(g.unterWasser({ x: 0, y: 3 })).toBe(true)
    expect(g.gefahr({ x: 1, y: 3 })).toBe('flut')
    expect(g.gefahr({ x: 5, y: 8 })).toBeNull()
    essen(g)
    expect(g.flut).toBeNull()
    expect(g.gefahr({ x: 1, y: 3 })).toBeNull()
  })

  it('in die Flut fahren beendet das Spiel', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 3, wueste: true })
    leer(g)
    g.flut = { phase: 'aktiv', t: 0, zellen: new Set([key(g.body[0].x + 1, g.body[0].y)]) }
    g.dir = 'r'
    for (let i = 0; i < 10 && g.status === 'play'; i++) g.update(g.takt + 1)
    expect(g.status).toBe('over')
    expect(g.cause).toBe('flut')
  })

  it('ohne Wüste passiert nichts', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 3 })
    const typen: string[] = []
    for (let i = 0; i < 200 && g.status === 'play'; i++) {
      essen(g)
      typen.push(...drain(g))
      leer(g)
    }
    expect(typen.some((t) => t === 'flutWarnung' || t === 'sandsturm' || t === 'sandwurmWarnung')).toBe(false)
  })

  it('in der Wüste kommen Sandsturm, Flut und Sandwurm ungefähr so oft wie eingestellt', () => {
    const zahl = { sandsturm: 0, flutWarnung: 0, sandwurmWarnung: 0 }
    let aepfel = 0
    for (let seed = 1; seed <= 40; seed++) {
      const g = new Game({ screenW: SW, screenH: SH, seed, wueste: true })
      for (let i = 0; i < 60 && g.status === 'play'; i++) {
        leer(g)
        g.flut = null
        g.sandwurm = null
        essen(g)
        for (const t of drain(g)) {
          if (t === 'eat') aepfel++
          if (t in zahl) zahl[t as keyof typeof zahl]++
        }
      }
    }
    expect(zahl.sandsturm / aepfel).toBeGreaterThan(0.06)
    expect(zahl.sandsturm / aepfel).toBeLessThan(0.14)
    expect(zahl.flutWarnung / aepfel).toBeGreaterThan(0.025)
    expect(zahl.flutWarnung / aepfel).toBeLessThan(0.08)
    expect(zahl.sandwurmWarnung / aepfel).toBeGreaterThan(0.005)
    expect(zahl.sandwurmWarnung / aepfel).toBeLessThan(0.04)
  })
})

describe('Wüste: Sandwurm', () => {
  it('brodelt 8 s, dann läuft er durch; trifft er den Kopf, ist es vorbei', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 5, wueste: true })
    leer(g)
    const h = g.body[0]
    // Senkrecht durch die Spalte vor dem Kopf; die Schlange steht (Kreativ waere anders), wir halten sie fest
    expect(g.sandwurmStarten('y', h.x + 1, 1)).toBe(true)
    expect(g.sandwurmFelder()).toEqual([])
    g.time += R.WUESTE.wurmWarnung - 10
    expect(g.sandwurmFelder()).toEqual([])
    // Kopf genau in die Spalte stellen und den Wurm durchlaufen lassen
    g.body[0] = { x: h.x + 1, y: h.y }
    const ev: GameEvent[] = []
    for (let t = 0; t < 4000 && g.status === 'play'; t += 20) {
      g.time += 20
      ;(g as unknown as { sandwurmTakt(): void }).sandwurmTakt()
      ev.push(...g.drain())
    }
    expect(ev.some((e) => e.type === 'sandwurm')).toBe(true)
    expect(g.status).toBe('over')
    expect(g.cause).toBe('sandwurm')
  })

  it('ist zwei Felder breit und lang', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 5, wueste: true })
    g.sandwurmStarten('x', 4, 1)
    // Kopf am anderen Ende der Karte: der Wurm fuellt die ganze Reihe (die Karte ist schmaler als er lang ist)
    g.time += R.WUESTE.wurmWarnung + R.WUESTE.wurmTakt * g.w + 1
    const f = g.sandwurmFelder()
    expect(new Set(f.map((p) => p.y))).toEqual(new Set([4, 5]))
    expect(f.length).toBe(Math.min(R.WUESTE.wurmLaenge, g.w) * 2)
  })

  it('den Körper beißt er ab, der Kopf lebt weiter', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 5, wueste: true })
    leer(g)
    // Schlange senkrecht legen: Kopf oben, Koerper nach unten
    const x = 5
    g.body = Array.from({ length: 8 }, (_, i) => ({ x, y: 3 + i }))
    g.prev = g.body.map((p) => ({ ...p }))
    g.sandwurmStarten('x', 8, 1)
    g.time += R.WUESTE.wurmWarnung
    for (let t = 0; t < 4000 && g.sandwurm; t += 20) {
      g.time += 20
      ;(g as unknown as { sandwurmTakt(): void }).sandwurmTakt()
    }
    expect(g.status).toBe('play')
    expect(g.body.length).toBe(5)
    expect(g.drain().some((e) => e.type === 'sandwurmBiss')).toBe(true)
  })

  it('wählt zwei Reihen in der Nähe des Kopfs, nie die des Kopfs selbst', () => {
    for (let seed = 1; seed < 30; seed++) {
      const g = new Game({ screenW: SW, screenH: SH, seed, wueste: true })
      if (!g.sandwurmStarten()) continue
      const s = g.sandwurm!
      const kopf = s.achse === 'x' ? g.body[0].y : g.body[0].x
      // Abstand zur naeheren der beiden Reihen
      const d = Math.min(Math.abs(s.linie - kopf), Math.abs(s.linie + R.WUESTE.wurmBreite - 1 - kopf))
      expect(d).toBeGreaterThanOrEqual(3)
      expect(d).toBeLessThanOrEqual(7)
    }
  })

  it('spielt lange mit Flut, Sturm und Sandwurm ohne Fehler', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 7, wueste: true })
    for (let i = 0; i < 25_000 && g.status === 'play' && g.level < 80; i++) {
      const d = autopilot(g)
      if (d && !g.queue.length) g.turn(d, false)
      g.update(g.takt + 1)
      g.drain()
    }
    expect(g.level).toBeGreaterThan(5)
  }, 30_000)
})

describe('Wüste: Wüstenfrösche', () => {
  it('in der Wüste ist ein Teil der Frösche Wüstenfrösche, die doppelt so oft springen', () => {
    let schnell = 0
    let normal = 0
    for (let seed = 1; seed <= 40; seed++) {
      const g = new Game({ screenW: SW, screenH: SH, seed, wueste: true })
      leer(g)
      if (!g.neuerFrosch(true)) continue
      const f = g.froesche[0]
      const warten = f.hopAt - g.time
      if (f.schnell) {
        schnell++
        expect(warten).toBe(Math.max(R.FROSCH_ANLAUF + 400, (R.DEFAULTS.froschSprung * 1000) / 2))
      } else {
        normal++
        expect(warten).toBe(R.DEFAULTS.froschSprung * 1000)
      }
    }
    expect(schnell).toBeGreaterThan(5)
    expect(normal).toBeGreaterThan(5)
  })
  it('außerhalb der Wüste gibt es keine', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = new Game({ screenW: SW, screenH: SH, seed })
      leer(g)
      g.neuerFrosch(true)
      expect(g.froesche.every((f) => !f.schnell)).toBe(true)
    }
  })
})

describe('Zufällige Reihenfolge der Gefahren', () => {
  const C = R.DEFAULTS
  const keys = GEFAHREN.map((g) => g.key)
  it('dieselben Level, nur anders verteilt', () => {
    for (let s = 0; s < 50; s++) {
      let z = s * 9301 + 49297
      const zufall = () => ((z = (z * 9301 + 49297) % 233280) / 233280)
      const c = zufallsReihenfolge(C, zufall)
      expect(keys.map((k) => c[k]).sort((a, b) => a - b)).toEqual(keys.map((k) => C[k]).sort((a, b) => a - b))
      // Abhaengige wandern mit
      expect(c.hausGrossAb - c.hausAb).toBe(C.hausGrossAb - C.hausAb)
      expect(c.lilaAb - c.gegnerAb).toBe(C.lilaAb - C.gegnerAb)
      // Schwere Gefahren nie auf fruehen Plaetzen
      const plaetze = keys.map((k) => C[k]).sort((a, b) => a - b)
      for (const g of GEFAHREN) expect(g.schwere).toBeLessThanOrEqual(schwereBis(plaetze.indexOf(c[g.key])) + 1e-9)
    }
  })
  it('Mauern, Wasser, Frösche und Giftäpfel kommen eher früh, es ist aber nicht immer gleich', () => {
    const erster = new Map<string, number>()
    const reihen = new Set<string>()
    for (let i = 0; i < 2000; i++) {
      const c = zufallsReihenfolge(C)
      const k = keys.find((x) => c[x] === 5)!
      erster.set(k, (erster.get(k) ?? 0) + 1)
      reihen.add(keys.map((x) => c[x]).join(','))
    }
    expect([...erster.keys()].every((k) => ['mauerAb', 'teichAb', 'froschAb', 'giftAb'].includes(k))).toBe(true)
    expect(erster.get('mauerAb')!).toBeGreaterThan(erster.get('teichAb')!)
    expect(reihen.size).toBeGreaterThan(200)
    // Tuerme kommen meist spaet
    let spaet = 0
    for (let i = 0; i < 500; i++) if (zufallsReihenfolge(C).turmAb >= 100) spaet++
    expect(spaet).toBeGreaterThan(300)
  })
})
