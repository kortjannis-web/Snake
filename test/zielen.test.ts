import { describe, expect, it } from 'vitest'
import { Game } from '../src/game/game'
import * as R from '../src/game/rules'
import type { Dir, P, Wesen } from '../src/game/types'

/** Leere Karte, die Schlange faehrt ein Feld je 200 ms */
function spiel(welt: 'wiese' | 'winter' = 'wiese') {
  const g = new Game({ screenW: 12, screenH: 23, seed: 5, welt, cfg: { ...R.DEFAULTS } })
  g.allesWeg()
  g.tick = 200
  return g
}
const legeSchlange = (g: Game, kopf: P, dir: Dir) => {
  const h = R.STEP[R.OPP[dir]]
  g.body = [0, 1, 2].map((i) => ({ x: kopf.x + h.x * i, y: kopf.y + h.y * i }))
  g.prev = g.body.map((b) => ({ ...b }))
  g.dir = dir
  g.queue = []
  g.last = g.time
}

describe('Zielen in die Laufbahn (seit 1.55.2)', () => {
  it('die Vorhersage folgt der Richtung (erst den gedrueckten) und endet am Rand', () => {
    const g = spiel()
    const m = { x: Math.floor(g.w / 2), y: Math.floor(g.h / 2) }
    legeSchlange(g, m, 'u')
    // Naechster Schritt in 200 ms, danach alle 200 ms
    expect(g.kopfBahn(100)).toHaveLength(0)
    expect(g.kopfVorhersage(600)).toEqual({ x: m.x, y: m.y - 3 })
    g.queue = ['r']
    expect(g.kopfVorhersage(600)).toEqual({ x: m.x + 3, y: m.y })
    expect(g.kopfRichtung()).toBe('r')
    // Viel spaeter: bleibt vor dem Rand stehen
    const weit = g.kopfVorhersage(60_000)
    expect(g.inside(weit)).toBe(true)
    expect(g.inside({ x: weit.x + 1, y: weit.y })).toBe(false)
  })

  it('fair: in einem Gang ohne Abzweig zielt nichts vor die Schlange (dort koennte sie nicht ausweichen)', () => {
    const g = spiel()
    const m = { x: Math.floor(g.w / 2), y: Math.floor(g.h / 2) + 4 }
    legeSchlange(g, m, 'u')
    // Gang: Mauern links und rechts neben den Feldern m.y bis m.y - 3
    const cells: P[] = []
    for (let y = m.y - 3; y <= m.y; y++) cells.push({ x: m.x - 1, y }, { x: m.x + 1, y })
    g.mauern = [{ cells, grown: cells.length, t: cells.map(() => -1e9), next: 0 }]
    // 4 Schritte: bis dahin gibt es keinen Abzweig, also zielt es auf den Kopf (den verlaesst sie ja)
    expect(g.kopfBahn(800)).toHaveLength(4)
    expect(g.kopfVorhersage(800)).toEqual(m)
    // 5 Schritte: am Ende des Gangs kann sie abbiegen, dahinter darf es zielen
    expect(g.kopfVorhersage(1000)).toEqual({ x: m.x, y: m.y - 5 })
  })

  it('Mini-Ent-Bomben landen in der Laufbahn: auf dem Ziel oder 2 Felder rechts oder links daneben', () => {
    const g = spiel()
    const m = { x: Math.floor(g.w / 2), y: Math.floor(g.h / 2) + 3 }
    legeSchlange(g, m, 'u')
    const ziel = g.kopfVorhersage(1000)
    const arten = new Set<string>()
    for (let i = 0; i < 60; i++) {
      const p = (g as unknown as { bahnZiel(ms: number): P }).bahnZiel(1000)
      if (p.x === ziel.x && p.y === ziel.y) arten.add('bahn')
      else if (p.y === ziel.y && p.x === ziel.x + 2) arten.add('rechts')
      else if (p.y === ziel.y && p.x === ziel.x - 2) arten.add('links')
      else throw new Error(`daneben: ${JSON.stringify(p)}`)
    }
    expect([...arten].sort()).toEqual(['bahn', 'links', 'rechts'])
  })

  it('der Schneemann wirft dorthin, wo Ball und Kopf zusammen ankommen, nicht dorthin, wo der Kopf jetzt ist', () => {
    const g = spiel('winter')
    const s = { x: Math.floor(g.w / 2), y: Math.floor(g.h / 2) + 4 }
    const w = { art: 'schneemann', p: { ...s }, from: { ...s }, dir: 'u' } as unknown as Wesen
    const ziel = (g as unknown as { schneemannZiel(w: Wesen): Dir | null }).schneemannZiel.bind(g)
    // Faehrt 5 Reihen ueber ihm nach rechts und kreuzt seine Spalte nach 4 Schritten (800 ms), so lange braucht der Ball
    legeSchlange(g, { x: s.x - 4, y: s.y - 5 }, 'r')
    expect(ziel(w)).toBe('u')
    // Kreuzt die Spalte zu frueh (der Ball kaeme zu spaet): kein Wurf
    legeSchlange(g, { x: s.x - 1, y: s.y - 5 }, 'r')
    expect(ziel(w)).toBeNull()
    // Faehrt direkt auf ihn zu: wirft
    legeSchlange(g, { x: s.x, y: s.y - 6 }, 'd')
    expect(ziel(w)).toBe('u')
  })
})
