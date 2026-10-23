import { describe, expect, it } from 'vitest'
import { autopilot } from '../src/game/autopilot'
import { BLOCK_PLUS, Game } from '../src/game/game'
import { DEFAULTS } from '../src/game/rules'

const VULKAN_PLUS = DEFAULTS.vulkanBlockPlus

const SW = 12
const SH = 23

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

describe('Vulkan', () => {
  it('Bloecke sind je Richtung 2 Felder groesser, der Bildschirm bleibt gleich', () => {
    const n = new Game({ screenW: SW, screenH: SH, seed: 1 })
    const v = new Game({ screenW: SW, screenH: SH, seed: 1, vulkan: true })
    expect(v.bw).toBe(n.bw + VULKAN_PLUS)
    expect(v.bh).toBe(n.bh + VULKAN_PLUS)
    expect(v.bw).toBe(SW + BLOCK_PLUS + VULKAN_PLUS)
    expect(v.screenW).toBe(n.screenW)
    expect(v.screenH).toBe(n.screenH)
  })

  it('etwa 10 % Krater, innen in den Bloecken, mit Abstand, die Karte haengt zusammen', () => {
    let summe = 0
    for (let s = 1; s <= 30; s++) {
      const g = new Game({ screenW: SW, screenH: SH, seed: s, vulkan: true, zufallsWelt: true })
      const a = g.krater.length / (g.blocks.length * g.bw * g.bh)
      summe += a
      expect(zusammen(g)).toBe(true)
      for (const p of [...g.body, g.apple.p]) expect(g.inside(p)).toBe(true)
      for (const c of g.krater) {
        expect(g.inside(c)).toBe(false)
        const ix = c.x % g.bw
        const iy = c.y % g.bh
        expect(Math.min(ix, iy, g.bw - 1 - ix, g.bh - 1 - iy)).toBeGreaterThanOrEqual(2)
      }
    }
    expect(summe / 30).toBeGreaterThan(0.07)
    expect(summe / 30).toBeLessThan(0.13)
  })

  it('in den Krater oder ueber den Rand fahren: in den Lava-Abgrund gestuerzt', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 4, vulkan: true, zufallsWelt: true })
    const k = g.krater[0]
    expect(g.gefahr(k)).toBe('abgrund')
    expect(g.gefahr({ x: -1, y: 3 })).toBe('abgrund')
  })

  it('neue Gebiete bekommen eigene Krater, alte bleiben, kein Maulwurf; lange Runden mit Autopilot', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 9, vulkan: true, zufallsWelt: true, startLevel: 120 })
    expect(g.blocks.length).toBeGreaterThan(4)
    expect(zusammen(g)).toBe(true)
    for (const b of g.blocks) {
      const im = g.krater.filter((c) => Math.floor(c.x / g.bw) === b.x && Math.floor(c.y / g.bh) === b.y).length
      expect(im).toBeGreaterThan(0)
    }
    expect(g.felder()).toBe(g.mask.reduce((a, v) => a + v, 0))
    for (let i = 0; i < 4000 && g.status === 'play'; i++) {
      const d = autopilot(g)
      if (d) g.turn(d)
      g.update(16)
      for (const p of g.powers) expect(p.art).not.toBe('maulwurf')
    }
    expect(zusammen(g)).toBe(true)
  })
})
