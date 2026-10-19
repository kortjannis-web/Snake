import { describe, expect, it } from 'vitest'
import { Game } from '../src/game/game'
import { DEFAULTS } from '../src/game/rules'
import { band, eckenFelder, schwierigkeit, tagesLevel, wochentag } from '../src/game/tageslevel'
import { MEHR_BILD } from '../src/multi/protokoll'

describe('Tageslevel', () => {
  it('Wochentag: Montag 0 bis Sonntag 6', () => {
    expect(wochentag('2026-10-19')).toBe(0)
    expect(wochentag('2026-10-25')).toBe(6)
  })

  it('3 bis 10 Bloecke zusammenhaengend, 3 bis 20 Aepfel, Laenge 3 bis 14, Schwierigkeit im Band des Wochentags', () => {
    for (let wt = 0; wt < 7; wt++)
      for (let s = 1; s <= 40; s++) {
        const t = tagesLevel(s * 7919 + wt, wt)
        expect(t.bloecke.length).toBeGreaterThanOrEqual(3)
        expect(t.bloecke.length).toBeLessThanOrEqual(10)
        expect(t.ziel).toBeGreaterThanOrEqual(3)
        expect(t.ziel).toBeLessThanOrEqual(20)
        expect(t.laenge).toBeGreaterThanOrEqual(3)
        expect(t.laenge).toBeLessThanOrEqual(14)
        // zusammenhaengend
        const set = new Set(t.bloecke.map((b) => `${b.x},${b.y}`))
        const offen = [t.bloecke[0]]
        const gesehen = new Set([`${t.bloecke[0].x},${t.bloecke[0].y}`])
        while (offen.length) {
          const b = offen.pop()!
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const k = `${b.x + dx},${b.y + dy}`
            if (set.has(k) && !gesehen.has(k)) {
              gesehen.add(k)
              offen.push({ x: b.x + dx, y: b.y + dy })
            }
          }
        }
        expect(gesehen.size).toBe(t.bloecke.length)
        const [lo, hi] = band(wt)
        const w = schwierigkeit(t)
        expect(w).toBeGreaterThanOrEqual(lo - 4)
        expect(w).toBeLessThanOrEqual(hi + 4)
      }
  })

  it('gleiches Datum = gleiches Level', () => {
    expect(tagesLevel(12345, 3)).toEqual(tagesLevel(12345, 3))
  })

  it('Spiel startet mit der Schlange auf der Karte, Ecken abgeschnitten oder ausgebuchtet', () => {
    for (let s = 1; s <= 25; s++) {
      const t = tagesLevel(s * 104729, s % 7)
      const probe = new Game({ screenW: MEHR_BILD.w, screenH: MEHR_BILD.h })
      const felder = (art: 'ab' | 'dazu') => t.ecken.filter((e) => e.art === art).flatMap((e) => eckenFelder(e, probe.bw, probe.bh))
      const g = new Game({
        screenW: MEHR_BILD.w,
        screenH: MEHR_BILD.h,
        cfg: { ...DEFAULTS, falleDauer: 1_000_000 },
        seed: s,
        sandbox: { breite: 0, hoehe: 0, laenge: t.laenge, objekte: t.objekte, weiter: false, bloecke: t.bloecke, aus: felder('ab'), dazu: felder('dazu') },
      })
      for (const p of g.body) expect(g.inside(p)).toBe(true)
      expect(g.inside(g.apple.p)).toBe(true)
      for (const c of felder('ab')) expect(g.inside(c)).toBe(false)
      for (const c of felder('dazu')) expect(g.inside(c)).toBe(true)
    }
  })
})
