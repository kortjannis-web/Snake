import { describe, expect, it } from 'vitest'
import { autopilot } from '../src/game/autopilot'
import { DUELL, MehrGame } from '../src/game/mehr'
import type { Dir } from '../src/game/types'
import { Abgleich, anwenden, zustand } from '../src/game/zustand'
import { runden, schub, SchlangenAbgleich, zusammenfuehren, type Zustand } from '../src/multi/kompakt'
import { MEHR_BILD } from '../src/multi/protokoll'

const spieler = [0, 1, 2, 3].map((i) => ({ id: 'id' + i, name: 'Spieler' + i, skin: 'klassik' }))
const spiel = (n: number, seed = 7) => new MehrGame({ screenW: MEHR_BILD.w, screenH: MEHR_BILD.h, seed, modus: 'vs', spieler: spieler.slice(0, n), tempo: 'normal', cfg: DUELL } as never)
/** Wie im Netz: verschicken (gerundet) und wieder lesen */
const netz = (d: object) => JSON.parse(JSON.stringify(d, runden))
/** Zum Vergleichen: auch den Sollwert runden wie im Netz */
const soll = (z: Zustand) => netz(z.schlangen as object)

/** Rechner spielt (Autopilot fuer alle), Empfaenger fuehrt die kompakten Aenderungen zusammen */
function laufen(n: number, frames: number, seed = 7, pruefen?: (rechner: MehrGame, empf: Zustand) => void) {
  const g = spiel(n, seed)
  const ab = new Abgleich()
  const basis: Zustand = {}
  zusammenfuehren(basis, netz(ab.aenderungen(zustand(g, true))!))
  let bytes = 0
  let voll = 0
  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < n; i++) {
      g.wechsel(i)
      if (g.status === 'play' && !g.queue.length) {
        const d = autopilot(g)
        if (d) g.lenke(i, d)
      }
    }
    g.update(16.7)
    g.drain()
    if (f % 3) continue
    const z = zustand(g, false)
    const d = ab.aenderungen(z)
    voll += JSON.stringify({ schlangen: z.schlangen }, runden).length
    if (!d) continue
    bytes += JSON.stringify(d, runden).length
    zusammenfuehren(basis, netz(d))
    pruefen?.(g, basis)
  }
  return { g, basis, bytes, voll }
}

describe('Kompakte Schlangen', () => {
  it('Schub: ein Schritt, Wachsen, Kuerzen, sonst nichts', () => {
    const alt = [{ x: 3, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 0 }]
    expect(schub(alt, [{ x: 4, y: 0 }, { x: 3, y: 0 }, { x: 2, y: 0 }])).toEqual({ $k: [{ x: 4, y: 0 }], $n: 3 })
    expect(schub(alt, [{ x: 4, y: 0 }, ...alt])).toEqual({ $k: [{ x: 4, y: 0 }], $n: 4 })
    expect(schub(alt, alt.slice(0, 1))).toEqual({ $k: [], $n: 1 })
    expect(schub(alt, [{ x: 9, y: 9 }, { x: 8, y: 8 }, { x: 7, y: 7 }, { x: 6, y: 6 }, { x: 5, y: 5 }, { x: 4, y: 4 }])).toBeNull()
  })

  it('der Empfaenger hat nach jedem Stand genau die Schlangen des Rechners (2 und 4 Spieler, mehrere Startwerte)', () => {
    for (const [n, seed] of [[2, 7], [4, 99], [3, 1234]]) {
      let geprueft = 0
      laufen(n, 1800, seed, (g, basis) => {
        expect(basis.schlangen).toEqual(soll(zustand(g, false)))
        geprueft++
      })
      expect(geprueft).toBeGreaterThan(400)
    }
  }, 120_000)

  it('spart bei 4 Spielern mindestens 80 % der Schlangen-Bytes', () => {
    const { bytes, voll } = laufen(4, 2400)
    expect(bytes).toBeLessThan(voll * 0.2)
  }, 60_000)

  it('angewendet ist der Spiegel unabhaengig: Veraenderungen im Spiel des Empfaengers wirken nicht zurueck', () => {
    const g = spiel(2)
    const ab = new SchlangenAbgleich()
    const basis: Zustand = {}
    const z0 = zustand(g, true)
    const aus = zusammenfuehren(basis, netz({ schlangen: ab.aenderungen(z0.schlangen as never)!.schlangen }))
    const empf = spiel(2)
    anwenden(empf, aus)
    empf.wechsel(0)
    empf.dir = (empf.dir === 'u' ? 'l' : 'u') as Dir
    empf.sichern()
    expect((basis.schlangen as { dir: Dir }[])[0].dir).toBe((z0.schlangen as { dir: Dir }[])[0].dir)
  })

  it('kaputte Nachrichten (vom Netz, ungeprueft) werfen nicht und aendern nichts Fremdes', () => {
    const basis: Zustand = { schlangen: [{ body: [{ x: 1, y: 1 }] }] }
    for (const sd of [5, [5], [[0]], [[-1, {}]], [[0, null]], [['__proto__', { a: 1 }]], [[0, { body: { $k: 'x', $n: 2 } }]], [[0, { __proto__: { boese: 1 } }]]])
      expect(() => zusammenfuehren(basis, { sd } as Zustand)).not.toThrow()
    expect(({} as Record<string, unknown>).boese).toBeUndefined()
    expect(Array.isArray(basis.schlangen)).toBe(true)
  })
})
