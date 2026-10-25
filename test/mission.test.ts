import { describe, expect, it } from 'vitest'
import { key } from '../src/game/game'
import { MissionGame } from '../src/game/mission'
import { MISSION_BLOCK, MISSION_LOHN, missionSkinVorgemerkt, spielbar, WIESE_MISSIONEN } from '../src/game/missionen'
import { DIRS, STEP } from '../src/game/rules'
import type { Dir, P } from '../src/game/types'

const m1 = WIESE_MISSIONEN[0]

/** Naechster Schritt auf kuerzestem Weg zum naechsten Apfel (Hindernisse, Gift, Eis und der eigene Koerper gesperrt) */
function weg(g: MissionGame): Dir | null {
  const zu = g.hindernisse()
  for (const a of g.aepfel) zu.delete(key(a.p.x, a.p.y))
  for (const gf of g.gift) zu.add(key(gf.p.x, gf.p.y))
  for (const e of g.eis) for (const c of e.cells) zu.add(key(c.x, c.y))
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
  it('Wiese: 10 Missionen, 5 Schatz, 10 Boss, alle spielbar, Belohnung steigt, Skin beim Boss', () => {
    expect(WIESE_MISSIONEN).toHaveLength(10)
    expect(WIESE_MISSIONEN[4].art).toBe('schatz')
    expect(WIESE_MISSIONEN[9].art).toBe('boss')
    expect(WIESE_MISSIONEN.filter(spielbar).map((m) => m.nr)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(WIESE_MISSIONEN.map((m) => m.lohn)).toEqual(MISSION_LOHN)
    expect(WIESE_MISSIONEN[0].lohn).toBe(6)
    // Nur der Boss bringt einen Skin; der zweite ist fuer Mission 20 vorgemerkt
    expect(WIESE_MISSIONEN.filter((m) => m.skin).map((m) => m.nr)).toEqual([10])
    expect(missionSkinVorgemerkt('schatzhueter')).toBe(true)
    expect(missionSkinVorgemerkt('steingolem')).toBe(false)
  })

  it('jede Karte: gleich breite Zeilen, ganze Bloecke, Berg rundherum', () => {
    for (const m of WIESE_MISSIONEN) {
      const k = m.karte!
      const g = new MissionGame(m)
      for (const z of k) expect(z.length, m.id).toBe(k[0].length)
      expect(k[0].length % g.bw, m.id).toBe(0)
      expect(k.length % g.bh, m.id).toBe(0)
      expect(g.w).toBe(k[0].length)
      expect(g.h).toBe(k.length)
      for (let x = 0; x < g.w; x++) expect(g.inside({ x, y: 0 }) || g.inside({ x, y: g.h - 1 }), m.id).toBe(false)
      for (let y = 0; y < g.h; y++) expect(g.inside({ x: 0, y }) || g.inside({ x: g.w - 1, y }), m.id).toBe(false)
      for (const b of g.body) expect(g.inside(b), m.id).toBe(true)
    }
  })

  it('Missionen 1 bis 7: keine Gasse schmaler als 3 Felder (erst ab 8 wird es eng)', () => {
    for (const m of WIESE_MISSIONEN.slice(0, 7)) {
      const g = new MissionGame(m)
      const zu = g.hindernisse()
      // Aepfel, Froesche und Gegner bleiben nicht, wo sie sind: zaehlen nicht als Wand
      for (const a of g.aepfel) zu.delete(key(a.p.x, a.p.y))
      for (const f of g.froesche) zu.delete(key(f.p.x, f.p.y))
      for (const e of g.gegner) for (const b of e.body) zu.delete(key(b.x, b.y))
      const frei = (x: number, y: number) => g.inside({ x, y }) && !zu.has(key(x, y))
      // Ein Pass ist eng, wenn man waagrecht und senkrecht nur 1 oder 2 Felder Platz hat und beidseits weiterkommt
      let eng = 0
      for (let y = 0; y < g.h; y++)
        for (let x = 0; x < g.w; x++) {
          if (!frei(x, y)) continue
          const quer = (frei(x - 1, y) ? 1 : 0) + (frei(x + 1, y) ? 1 : 0)
          const laengs = (frei(x, y - 1) ? 1 : 0) + (frei(x, y + 1) ? 1 : 0)
          if (quer === 0 && laengs === 2) eng++
          if (laengs === 0 && quer === 2) eng++
        }
      expect(eng, m.id).toBe(0)
    }
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

  it('Missionen 2 bis 9 lassen sich schaffen (ohne Froesche und Gegner)', () => {
    for (const m of WIESE_MISSIONEN.slice(1, 9)) {
      const g = new MissionGame(m)
      g.froesche = []
      g.gegner = []
      let schritte = 0
      while (g.status === 'play' && schritte++ < 9000) {
        const d = weg(g)
        if (d && !g.queue.length) g.turn(d, false)
        g.update(g.tick)
      }
      expect(g.cause, m.id).toBe('ziel')
      expect(g.gegessen, m.id).toBe(g.ziel)
    }
  })

  it('Schatz-Level: Edelsteine liegen da und zaehlen fuer die Belohnung', () => {
    const g = new MissionGame(WIESE_MISSIONEN[4])
    expect(g.funde).toHaveLength(7)
    const f = g.funde[0]
    g.body = [{ x: f.p.x, y: f.p.y + 1 }, { x: f.p.x, y: f.p.y + 2 }, { x: f.p.x, y: f.p.y + 3 }]
    g.prev = g.body.map((p) => ({ ...p }))
    g.dir = 'u'
    for (let i = 0; i < 3; i++) g.update(60)
    expect(g.funde).toHaveLength(6)
    expect(g.schatz).toBeGreaterThan(0)
  })

  it('Missionen 7 bis 9 haben Gegner-Schlangen und Eis, spaete Missionen werden je Apfel schneller', () => {
    expect(new MissionGame(WIESE_MISSIONEN[6]).gegner).toHaveLength(1)
    expect(new MissionGame(WIESE_MISSIONEN[7]).gegner).toHaveLength(2)
    expect(new MissionGame(WIESE_MISSIONEN[8]).gegner).toHaveLength(3)
    expect(new MissionGame(WIESE_MISSIONEN[6]).eis.length).toBeGreaterThan(0)
    expect(new MissionGame(WIESE_MISSIONEN[8]).cfg.tempoProLevel).toBeGreaterThan(new MissionGame(WIESE_MISSIONEN[0]).cfg.tempoProLevel)
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
