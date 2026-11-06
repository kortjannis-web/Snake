import { describe, expect, it } from 'vitest'
import { kampagnePlan } from '../src/cloud'
import { kampagneGleich, kampagneSauber, kampagneSeit, kampagneZusammen, type KampagnenStand } from '../src/kampagne'

const k = (geschafft: string[], wiese = 0): KampagnenStand => ({ geschafft, erreicht: wiese ? { wiese } : {} })
const LEER = k([])

describe('Kampagne zusammenfuehren: nur dazu, nie weg', () => {
  it('Missionen beider Seiten, je Welt das Hoehere', () => {
    const r = kampagneZusammen(k(['wiese-1', 'wiese-2'], 2), { geschafft: ['wiese-1', 'wiese-3'], erreicht: { wiese: 3, wald: 1 } })
    expect(r.geschafft.sort()).toEqual(['wiese-1', 'wiese-2', 'wiese-3'])
    expect(r.erreicht).toEqual({ wiese: 3, wald: 1 })
  })

  it('ein leerer oder kleinerer Stand nimmt nichts weg', () => {
    const viel = k(['wiese-1', 'wiese-2', 'wiese-3'], 3)
    expect(kampagneGleich(kampagneZusammen(viel, LEER), viel)).toBe(true)
    expect(kampagneGleich(kampagneZusammen(LEER, viel), viel)).toBe(true)
    expect(kampagneGleich(kampagneZusammen(viel, k(['wiese-1'], 1)), viel)).toBe(true)
  })

  it('Unbrauchbares aus Speicher oder Netz faellt weg, Gueltiges bleibt', () => {
    expect(kampagneSauber(null)).toEqual(LEER)
    expect(kampagneSauber({ geschafft: 'x', erreicht: [] })).toEqual(LEER)
    expect(kampagneSauber({ geschafft: ['wiese-1', 3, '', 'wiese-1'], erreicht: { wiese: 4, x: 'a', y: -1, z: NaN } })).toEqual(k(['wiese-1'], 4))
  })

  it('Fortschritt seit einem Stand', () => {
    expect(kampagneSeit(k(['wiese-1'], 1), k(['wiese-1', 'wiese-2'], 2))).toEqual(k(['wiese-2'], 2))
    expect(kampagneSeit(k(['wiese-1'], 1), k(['wiese-1'], 1))).toEqual(LEER)
  })
})

describe('Kampagne: wem gehoert der Stand auf dem Geraet?', () => {
  const lokal = k(['wiese-1', 'wiese-2', 'wiese-3'], 3)

  it('erster Abgleich nach dem Update: der Stand vom Geraet kommt zum angemeldeten Account', () => {
    const p = kampagnePlan({ altUid: null, uid: 'a', lokal, cloud: null, sicherung: {} })
    expect(p).toEqual({ hoch: lokal, ersetzen: false, zuruecklegen: null })
  })

  it('gleicher Account: Geraet und eigene Sicherung hoch, nichts wird ersetzt', () => {
    const p = kampagnePlan({ altUid: 'a', uid: 'a', lokal, cloud: null, sicherung: { a: k(['wiese-4'], 4) } })
    expect(p.ersetzen).toBe(false)
    expect(p.hoch.geschafft.sort()).toEqual(['wiese-1', 'wiese-2', 'wiese-3', 'wiese-4'])
    expect(p.hoch.erreicht).toEqual({ wiese: 4 })
  })

  it('anderer Account mit eigener Kampagne: seine gilt, der Stand hier wird fuer den alten zurueckgelegt', () => {
    const p = kampagnePlan({ altUid: 'a', uid: 'b', lokal, cloud: k(['wiese-1'], 1), sicherung: { a: k(['wiese-9']) } })
    expect(p.ersetzen).toBe(true)
    expect(p.hoch).toEqual(LEER)
    expect(p.zuruecklegen!.geschafft.sort()).toEqual(['wiese-1', 'wiese-2', 'wiese-3', 'wiese-9'])
  })

  it('anderer Account ohne Kampagne (neu, z. B. nach Konto loeschen): er bekommt den Stand vom Geraet', () => {
    for (const cloud of [null, LEER]) {
      const p = kampagnePlan({ altUid: 'alt', uid: 'neu', lokal, cloud, sicherung: {} })
      expect(p.ersetzen).toBe(false)
      expect(p.hoch).toEqual(lokal)
      expect(p.zuruecklegen).toEqual(lokal)
    }
  })

  it('zurueck zum alten Account: die Sicherung kommt mit hoch', () => {
    const p = kampagnePlan({ altUid: 'b', uid: 'a', lokal: k(['wiese-1'], 1), cloud: k(['wiese-1', 'wiese-2'], 2), sicherung: { a: lokal } })
    expect(p.ersetzen).toBe(true)
    expect(p.hoch).toEqual(lokal)
  })
})
