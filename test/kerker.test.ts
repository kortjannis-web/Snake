import { describe, expect, it } from 'vitest'
import { Game, key, KERKER } from '../src/game/game'
import { MEISTER } from '../src/game/meisterkampf'
import type { P } from '../src/game/types'

const SW = 12
const SH = 23
type Innen = { eat(n: P): void; einsammeln(n: P): void; expand(): void }
const innen = (g: Game) => g as unknown as Innen
const lauf = (g: Game, ms: number) => {
  for (let t = 0; t < ms; t += 50) g.update(50)
}
/** Bis zum Level essen (Gebietswahl gleich zufaellig erledigen) */
function bis(g: Game, level: number) {
  while (g.level < level) {
    innen(g).eat({ ...g.apple.p })
    if (g.wahl > 0) {
      innen(g).expand()
      g.wahl = 0
    }
  }
}
const kopfAuf = (g: Game, p: P) => {
  g.body = [{ ...p }, { x: p.x, y: p.y + 1 }, { x: p.x, y: p.y + 2 }]
  g.prev = g.body.map((b) => ({ ...b }))
}

describe('Kerker und Kaefigmeister im freien Spiel (Wiese)', () => {
  it('auf Level 145, 147 und 149 graebt sich je ein Kerker in die Erde (Gang und grosser Raum), aus jedem kommt ein Kaefigkopf', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 21, welt: 'wiese', startLevel: 140 })
    expect(g.kerker).toHaveLength(0)
    const anzahl: Record<number, number> = {}
    while (g.level < 149) {
      bis(g, g.level + 1)
      anzahl[g.level] = g.kerker.length
    }
    expect([144, 145, 146, 147, 148, 149].map((l) => anzahl[l])).toEqual([0, 1, 1, 2, 2, 3])
    expect(g.kaefige).toHaveLength(3)
    for (const k of g.kerker) {
      // Gang und Raum gehoeren zur Karte, alles ist vom Mund aus erreichbar, der Raum ist gross
      expect(k.cells.length).toBe(KERKER.gang * KERKER.lang + KERKER.raumB * KERKER.raumT)
      for (const c of k.cells) expect(g.inside(c)).toBe(true)
      for (const c of k.mund) expect(g.inside(c)).toBe(true)
      expect(k.raum.x1 - k.raum.x0 + 1).toBeGreaterThanOrEqual(KERKER.raumT)
      expect(g.inside(k.raum.mitte)).toBe(true)
      // Rundherum Erde (ausser am Mund und dem Gang)
      const eigen = new Set(k.cells.map((c) => key(c.x, c.y)))
      let rand = 0
      for (let y = k.raum.y0 - 1; y <= k.raum.y1 + 1; y++)
        for (let x = k.raum.x0 - 1; x <= k.raum.x1 + 1; x++) if (!eigen.has(key(x, y)) && !g.inside({ x, y })) rand++
      expect(rand).toBeGreaterThan(40)
    }
    // Kerker ueberlappen sich nicht
    const alle = g.kerker.flatMap((k) => k.cells.map((c) => key(c.x, c.y)))
    expect(new Set(alle).size).toBe(alle.length)
  })

  it('Level 150: der Kaefigmeister erscheint in einem der drei Kerker-Raeume, kein Apfel; zwei Flammen je Leben, drei Leben', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 21, welt: 'wiese', startLevel: 149 })
    bis(g, 150)
    g.tick = 1e12
    lauf(g, 100)
    const k = g.freiMeister!
    expect(k).toBeTruthy()
    expect(k.raeume).toHaveLength(3)
    expect(k.flammenJeLeben).toBe(2)
    expect(g.inside(g.apple.p)).toBe(false)
    for (let leben = 3; leben > 0; leben--) {
      // Weg von allen Raeumen: er erscheint
      kopfAuf(g, { ...g.kerker[0].mund[0] })
      g.kaefige = []
      const fern = g.kerker.map((x) => x.mund[0]).find((m) => k.raeume.every((r) => !(m.x >= r.x0 - MEISTER.sicht && m.x <= r.x1 + MEISTER.sicht && m.y >= r.y0 - MEISTER.sicht && m.y <= r.y1 + MEISTER.sicht)))
      if (fern) kopfAuf(g, fern)
      else {
        // Ausserhalb der Kerker auf der Karte
        for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.inside({ x, y }) && k.raeume.every((r) => x < r.x0 - 10 || x > r.x1 + 10 || y < r.y0 - 10 || y > r.y1 + 10)) {
          kopfAuf(g, { x, y })
          y = g.h
          break
        }
      }
      lauf(g, MEISTER.erscheinen + 200)
      expect(k.meister.zustand, `Leben ${leben}`).toBe('wartet')
      const r = k.raeume[k.meister.raum]
      kopfAuf(g, { x: r.x0, y: r.y0 + 1 })
      lauf(g, 100)
      expect(k.meister.zustand).toBe('kampf')
      for (let i = 0; i < 2; i++) {
        k.meister.next = 1e12
        expect(k.flammen.length).toBeGreaterThan(0)
        innen(g).einsammeln(k.flammen[0].p)
        lauf(g, MEISTER.flug + 100)
      }
      if (leben > 1) {
        expect(k.meister.leben).toBe(leben - 1)
        lauf(g, MEISTER.getroffen + 100)
      }
    }
    // Besiegt: naechstes Level, Belohnung, die Kaefigkoepfe sind weg, der Apfel ist wieder da
    expect(g.freiMeister).toBeNull()
    expect(g.level).toBe(151)
    expect(g.kaefige).toHaveLength(0)
    expect(g.inside(g.apple.p)).toBe(true)
    const kerkerFelder = new Set(g.kerker.flatMap((x) => x.cells.map((c) => key(c.x, c.y))))
    expect(kerkerFelder.has(key(g.apple.p.x, g.apple.p.y))).toBe(false)
    // Noch im Kerker: er bleibt offen. Draussen: alle drei schliessen sich
    lauf(g, 200)
    expect(g.kerker).toHaveLength(3)
    const draussen = (() => {
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.inside({ x, y }) && !kerkerFelder.has(key(x, y)) && g.inside({ x, y: y + 1 }) && g.inside({ x, y: y + 2 }) && !kerkerFelder.has(key(x, y + 2))) return { x, y }
      return null
    })()!
    kopfAuf(g, draussen)
    lauf(g, 100)
    expect(g.kerker).toHaveLength(0)
    for (const kk of kerkerFelder) expect(g.inside({ x: (kk % 4096) - 1, y: Math.floor(kk / 4096) - 1 })).toBe(false)
  })

  it('die drei Kerker finden bei jeder Karte Platz', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = new Game({ screenW: SW, screenH: SH, seed, welt: 'wiese', startLevel: 149 })
      expect(g.kerker.length, `seed ${seed}`).toBe(3)
    }
  })

  it('Kaefigkoepfe im freien Spiel: hineinfahren ist vorbei, in anderen Welten gibt es keine Kerker', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 21, welt: 'wiese', startLevel: 146 })
    expect(g.kerker.length).toBeGreaterThan(0)
    const z = g.kaefige[0]
    expect(g.gefahr(z.p)).toBe('kaefig')
    expect(g.hindernisse().has(key(z.p.x, z.p.y))).toBe(true)
    const w = new Game({ screenW: SW, screenH: SH, seed: 21, welt: 'winter', startLevel: 150 })
    expect(w.kerker).toHaveLength(0)
  })
})
