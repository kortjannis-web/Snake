import { describe, expect, it } from 'vitest'
import { autopilot } from '../src/game/autopilot'
import { Game, RAND_TIEFE } from '../src/game/game'

const SW = 12
const SH = 23

/** Teil der Bloecke, der verschuettet ist */
const anteil = (g: Game) => 1 - g.mask.reduce((a, v) => a + v, 0) / (g.blocks.length * g.bw * g.bh + g.extra.length)

/** Haengt die Karte zusammen? */
function zusammen(g: Game) {
  const alle: number[] = []
  for (let i = 0; i < g.mask.length; i++) if (g.mask[i]) alle.push(i)
  const gesehen = new Set([alle[0]])
  const q = [alle[0]]
  while (q.length) {
    const i = q.pop()!
    const x = i % g.w
    for (const j of [x > 0 ? i - 1 : -1, x < g.w - 1 ? i + 1 : -1, i - g.w, i + g.w])
      if (j >= 0 && j < g.mask.length && g.mask[j] && !gesehen.has(j)) {
        gesehen.add(j)
        q.push(j)
      }
  }
  return gesehen.size === alle.length
}

describe('Zufallswelt (Endlos)', () => {
  it('verschuettet etwa 3 % an den Aussenkanten, je Block verschieden, die Karte haengt zusammen, Schlange und Apfel liegen frei', () => {
    let summe = 0
    for (let s = 1; s <= 30; s++) {
      const g = new Game({ screenW: SW, screenH: SH, seed: s, zufallsWelt: true })
      const a = anteil(g)
      summe += a
      expect(a).toBeLessThan(0.07)
      expect(zusammen(g)).toBe(true)
      for (const p of g.body) expect(g.inside(p)).toBe(true)
      expect(g.inside(g.apple.p)).toBe(true)
      // Verschuettet wird nur am Rand: jedes Feld liegt hoechstens RAND_TIEFE - 1 von einer Blockkante entfernt
      for (const c of g.aus) {
        const ix = c.x % g.bw
        const iy = c.y % g.bh
        expect(Math.min(ix, iy, g.bw - 1 - ix, g.bh - 1 - iy)).toBeLessThan(RAND_TIEFE)
      }
    }
    expect(summe / 30).toBeGreaterThan(0.015)
    expect(summe / 30).toBeLessThan(0.045)
  })

  it('jede Runde liegt die Welt woanders (Erde, Erze, Lava), mit Seed immer gleich', () => {
    const lagen = new Set<string>()
    for (let s = 1; s <= 10; s++) {
      const g = new Game({ screenW: SW, screenH: SH, seed: s, zufallsWelt: true })
      expect(Math.abs(g.ursprung.x % g.bw)).toBe(0)
      expect(Math.abs(g.ursprung.y % g.bh)).toBe(0)
      lagen.add(`${g.ursprung.x},${g.ursprung.y}`)
      const h = new Game({ screenW: SW, screenH: SH, seed: s, zufallsWelt: true })
      expect(h.ursprung).toEqual(g.ursprung)
      expect(h.aus).toEqual(g.aus)
      // In den Startbloecken steckt keine Lava (Weltkoordinaten)
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) expect(g.lavaImStein(x - g.ursprung.x, y - g.ursprung.y)).toBe(false)
    }
    expect(lagen.size).toBeGreaterThan(5)
    // Ohne Zufallswelt (Tageslevel, Mehrspieler, Tests) bleibt alles wie bisher
    const fest = new Game({ screenW: SW, screenH: SH, seed: 3 })
    expect(fest.ursprung).toEqual({ x: 0, y: 0 })
    expect(fest.aus).toEqual([])
  })

  it('beim Anbauen wird die Nahtstelle frei, der neue Block bekommt eigene Raender', () => {
    for (let s = 1; s <= 20; s++) {
      const g = new Game({ screenW: SW, screenH: SH, seed: s, zufallsWelt: true })
      g.expand({ p: { x: 1, y: 0 }, d: 'r' })
      expect(zusammen(g)).toBe(true)
      // Rechte Kante von Block (0,0) ist jetzt Naht: dort nichts mehr verschuettet
      for (const c of g.aus) if (c.x < g.bw && c.y < g.bh) expect(g.bw - 1 - c.x).toBeGreaterThanOrEqual(RAND_TIEFE)
      // Auch im neuen Block nichts an der Naht
      for (const c of g.aus) if (c.x >= g.bw && c.y < g.bh) expect(c.x - g.bw).toBeGreaterThanOrEqual(RAND_TIEFE)
      for (const p of g.body) expect(g.inside(p)).toBe(true)
    }
  })

  it('bleibt ueber viele Level zusammenhaengend und spielbar', () => {
    for (let s = 1; s <= 3; s++) {
      const g = new Game({ screenW: SW, screenH: SH, seed: s, startLevel: 250, zufallsWelt: true })
      expect(zusammen(g)).toBe(true)
      expect(anteil(g)).toBeLessThan(0.06)
      for (const c of g.aus) expect(g.inside(c)).toBe(false)
      // Ein Stueck spielen: die Karte waechst weiter und bleibt zusammen
      for (let t = 0; t < 1500 && g.status === 'play'; t++) {
        const d = autopilot(g)
        if (d && !g.queue.length) g.turn(d, false)
        g.update(g.tick)
        g.drain()
      }
      expect(zusammen(g)).toBe(true)
    }
  }, 30_000)
})
