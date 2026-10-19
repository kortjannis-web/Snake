import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { kontoZugang, sha256 } from '../src/konto'

describe('Account aus dem Namen', () => {
  it('sha256 stimmt mit Node ueberein (kurz, lang, Umlaute)', () => {
    for (const t of ['', 'abc', 'Jannis', 'Ömer ß €', 'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(64), 'x'.repeat(1000)])
      expect(sha256(t)).toBe(createHash('sha256').update(t).digest('hex'))
  })
  it('derselbe Name gibt dieselben Zugangsdaten, auch mit anderer Schreibweise', () => {
    const a = kontoZugang('Jannis')
    expect(kontoZugang('  jannis ')).toEqual(a)
    expect(kontoZugang('JANNIS')).toEqual(a)
    expect(kontoZugang('Jannis2').email).not.toBe(a.email)
    expect(kontoZugang('Jannis').password).not.toBe(a.email)
  })
  it('E-Mail ist gueltig geformt, Passwort lang genug', () => {
    const z = kontoZugang('Lea-Marie')
    expect(z.email).toMatch(/^snake-[0-9a-f]{24}@[a-z0-9.-]+\.[a-z]+$/)
    expect(z.password.length).toBeGreaterThanOrEqual(32)
  })
})
