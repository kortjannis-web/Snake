import { beforeEach, describe, expect, it } from 'vitest'
import { Game } from '../src/game/game'
import { Aufnahme, geistKoerper, geistLaden, geistSpeichern, tagBerlin, tagesSeed } from '../src/geist'

// Einfacher Speicher wie im Browser
const speicher = new Map<string, string>()
beforeEach(() => {
  speicher.clear()
  ;(globalThis as unknown as { localStorage: Pick<Storage, 'getItem' | 'setItem'> }).localStorage = {
    getItem: (k) => speicher.get(k) ?? null,
    setItem: (k, v) => void speicher.set(k, v),
  }
})

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

describe('Eigener Geist', () => {
  function lauf(schritte: number) {
    const g = new Game({ screenW: 12, screenH: 23, seed: 3, startLevel: 1, cfg: { gnade: 0 } })
    const a = new Aufnahme()
    a.aufnehmen(g)
    for (let i = 0; i < schritte * 4 && g.status === 'play'; i++) {
      g.update(50)
      a.aufnehmen(g)
    }
    return { g, a }
  }
  it('nimmt jeden Schritt einmal auf und faehrt ihn nach', () => {
    const { a } = lauf(4)
    expect(a.p.length / 4).toBeGreaterThanOrEqual(4)
    const l = { level: 3, p: a.p }
    const k = geistKoerper(l, a.p[a.p.length - 4], { x: 0, y: 0 })
    expect(k?.body[0]).toEqual({ x: a.p[a.p.length - 3], y: a.p[a.p.length - 2] })
    expect(k?.body.length).toBe(a.p[a.p.length - 1])
    // Lange nach dem Ende ist er weg, vor dem Start auch
    expect(geistKoerper(l, a.p[a.p.length - 4] + 5000, { x: 0, y: 0 })).toBeNull()
    expect(geistKoerper(l, -1, { x: 0, y: 0 })).toBeNull()
  })
  it('verschiebt sich mit der Karte (Weltkoordinaten)', () => {
    const { a } = lauf(3)
    const l = { level: 2, p: a.p }
    const t = a.p[4]
    expect(geistKoerper(l, t, { x: 13, y: 0 })?.body[0].x).toBe((geistKoerper(l, t, { x: 0, y: 0 })?.body[0].x ?? 0) + 13)
  })
  it('nur ein besserer Lauf ersetzt den Geist; Tages-Geist gilt nur heute', () => {
    const p = [0, 1, 1, 3, 150, 2, 1, 3, 300, 3, 1, 3]
    expect(geistSpeichern('endlos', { level: 10, p })).toBe(true)
    expect(geistSpeichern('endlos', { level: 8, p })).toBe(false)
    expect(geistLaden('endlos')?.level).toBe(10)
    expect(geistSpeichern('tages', { level: 5, datum: '2026-10-18', p })).toBe(true)
    expect(geistLaden('tages', '2026-10-18')?.level).toBe(5)
    expect(geistLaden('tages', '2026-10-19')).toBeNull()
    // Neuer Tag: auch ein schlechterer Lauf wird der neue Tages-Geist
    expect(geistSpeichern('tages', { level: 2, datum: '2026-10-19', p })).toBe(true)
  })
})
