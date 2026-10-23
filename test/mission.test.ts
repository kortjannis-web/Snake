import { describe, expect, it } from 'vitest'
import { key } from '../src/game/game'
import { MissionGame } from '../src/game/mission'
import { MISSION_BLOCK, spielbar, WIESE_MISSIONEN } from '../src/game/missionen'
import { DIRS, STEP } from '../src/game/rules'
import type { Dir, P } from '../src/game/types'

const m1 = WIESE_MISSIONEN[0]

/** Naechster Schritt auf kuerzestem Weg zum naechsten Apfel (Hindernisse, Gift und der eigene Koerper gesperrt) */
function weg(g: MissionGame): Dir | null {
  const zu = g.hindernisse()
  for (const a of g.aepfel) zu.delete(key(a.p.x, a.p.y))
  for (const gf of g.gift) zu.add(key(gf.p.x, gf.p.y))
  for (const b of g.body.slice(0, -1)) zu.add(key(b.x, b.y))
  const ziel = new Set(g.aepfel.map((a) => key(a.p.x, a.p.y)))
  const h = g.body[0]
  const von = new Map<number, { p: P; erst: Dir | null }>([[key(h.x, h.y), { p: h, erst: null }]])
  const schlange: P[] = [h]
  while (schlange.length) {
    const c = schlange.shift()!
    const info = von.get(key(c.x, c.y))!
    for (const d of DIRS) {
      const n = { x: c.x + STEP[d].x, y: c.y + STEP[d].y }
      const k = key(n.x, n.y)
      if (von.has(k) || !g.inside(n) || zu.has(k)) continue
      const erst = info.erst ?? d
      if (ziel.has(k)) return erst
      von.set(k, { p: n, erst })
      schlange.push(n)
    }
  }
  return null
}

describe('Kampagne', () => {
  it('Wiese: 10 Missionen, 5 Schatz, 10 Boss, nur Mission 1 spielbar, Belohnung 6', () => {
    expect(WIESE_MISSIONEN).toHaveLength(10)
    expect(WIESE_MISSIONEN[4].art).toBe('schatz')
    expect(WIESE_MISSIONEN[9].art).toBe('boss')
    expect(WIESE_MISSIONEN.filter(spielbar).map((m) => m.nr)).toEqual([1])
    expect(WIESE_MISSIONEN.every((m) => m.lohn === 6)).toBe(true)
  })

  it('Mission 1: Karte aus ganzen Bloecken, Start auf der Wiese, alles an seinem Platz', () => {
    const g = new MissionGame(m1)
    expect(g.bw).toBe(MISSION_BLOCK.w)
    expect(g.bh).toBe(MISSION_BLOCK.h)
    expect(g.w).toBe(26)
    expect(g.h).toBe(48)
    expect(g.body).toHaveLength(3)
    for (const b of g.body) expect(g.inside(b)).toBe(true)
    expect(g.dir).toBe('u')
    expect(g.ziel).toBe(10)
    expect(g.aepfel).toHaveLength(10)
    expect(g.gift).toHaveLength(3)
    expect(g.froesche).toHaveLength(5)
    expect(g.teiche).toHaveLength(3)
    expect(g.mauern).toHaveLength(3)
    expect(g.powers).toHaveLength(0)
    // Berge gehoeren nicht zur Karte
    expect(g.inside({ x: 0, y: 0 })).toBe(false)
    expect(g.aepfel.some((a) => a === g.apple)).toBe(true)
  })

  it('Mission 1 ist immer gleich', () => {
    const bild = (g: MissionGame) => JSON.stringify({ a: g.aepfel.map((a) => a.p), b: g.body, f: g.froesche.map((f) => [f.p, f.dir]), m: g.mauern.map((m) => m.cells), t: g.teiche.map((t) => t.cells) })
    expect(bild(new MissionGame(m1))).toBe(bild(new MissionGame(m1)))
  })

  it('jedes Wiesenfeld und jeder Apfel ist vom Start aus erreichbar', () => {
    const g = new MissionGame(m1)
    const zu = g.hindernisse()
    for (const a of g.aepfel) zu.delete(key(a.p.x, a.p.y))
    for (const f of g.froesche) zu.delete(key(f.p.x, f.p.y))
    const seen = new Set([key(g.body[0].x, g.body[0].y)])
    const q: P[] = [g.body[0]]
    while (q.length) {
      const c = q.shift()!
      for (const d of DIRS) {
        const n = { x: c.x + STEP[d].x, y: c.y + STEP[d].y }
        const k = key(n.x, n.y)
        if (seen.has(k) || !g.inside(n) || zu.has(k)) continue
        seen.add(k)
        q.push(n)
      }
    }
    for (const a of g.aepfel) expect(seen.has(key(a.p.x, a.p.y))).toBe(true)
    let frei = 0
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.inside({ x, y }) && !zu.has(key(x, y))) frei++
    expect(seen.size).toBe(frei)
  })

  it('alle 10 Aepfel geholt = geschafft, dabei kommt nichts dazu', () => {
    const g = new MissionGame(m1)
    // Ohne Froesche (die huepfen nach Zufall), damit der Test sicher durchlaeuft
    g.froesche = []
    let schritte = 0
    while (g.status === 'play' && schritte++ < 4000) {
      const d = weg(g)
      if (d && !g.queue.length) g.turn(d, false)
      g.update(g.tick)
      expect(g.mauern).toHaveLength(3)
      expect(g.powers).toHaveLength(0)
    }
    expect(g.cause).toBe('ziel')
    expect(g.gegessen).toBe(10)
    expect(g.aepfel).toHaveLength(0)
  })

  it('der letzte Apfel ist der einzige, der noch liegt', () => {
    const g = new MissionGame(m1)
    g.aepfel = g.aepfel.slice(0, 1)
    g.neuerApfel()
    expect(g.uebrig).toBe(1)
    expect(g.apple).toBe(g.aepfel[0])
  })

  it('Froesche huepfen nicht in die Berge', () => {
    const g = new MissionGame(m1)
    g.body = [{ x: 12, y: 43 }, { x: 12, y: 44 }, { x: 12, y: 45 }]
    for (let i = 0; i < 4000; i++) {
      g.time += 50
      ;(g as unknown as { froschTakt(): void }).froschTakt()
    }
    expect(g.froesche.filter((f) => f.gone === undefined)).toHaveLength(5)
    for (const f of g.froesche) expect(g.inside(f.p)).toBe(true)
  })
})
