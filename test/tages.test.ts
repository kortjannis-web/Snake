import { describe, expect, it } from 'vitest'
import { Game } from '../src/game/game'
import { tagBerlin, tagesSeed } from '../src/tages'

describe('Tages-Herausforderung', () => {
  it('derselbe Tag ergibt dieselbe Startwelt, ein anderer Tag eine andere', () => {
    const welt = (tag: string) => {
      const g = new Game({ screenW: 12, screenH: 23, seed: tagesSeed(tag), startLevel: 1 })
      return JSON.stringify({ a: g.apple.p, b: g.body })
    }
    expect(tagesSeed('2026-10-18')).toBe(tagesSeed('2026-10-18'))
    expect(tagesSeed('2026-10-18')).not.toBe(tagesSeed('2026-10-19'))
    expect(welt('2026-10-18')).toBe(welt('2026-10-18'))
  })
  it('Tag nach deutscher Zeit (kurz nach Mitternacht in Berlin ist schon der naechste Tag)', () => {
    expect(tagBerlin(new Date('2026-10-18T22:30:00Z'))).toBe('2026-10-19')
    expect(tagBerlin(new Date('2026-10-18T10:00:00Z'))).toBe('2026-10-18')
  })
})
