import { describe, expect, it } from 'vitest'
import { spielstandZusammen, zusammenfuehren } from '../src/cloud'

describe('Spielstand in der Cloud zusammenfuehren', () => {
  it('Aepfel: Cloud plus was hier seit dem letzten Abgleich dazukam oder ausgegeben wurde', () => {
    // Basis 100. Hier +30 verdient, auf dem anderen Handy 50 ausgegeben
    expect(zusammenfuehren(100, 130, 50)).toBe(80)
    // nie unter 0
    expect(zusammenfuehren(100, 0, 20)).toBe(0)
  })

  it('erster Abgleich auf einem Geraet: das Groessere, nichts doppelt', () => {
    expect(zusammenfuehren(undefined, 40, 300)).toBe(300)
    expect(zusammenfuehren(undefined, 500, 300)).toBe(500)
  })

  it('Bestwerte werden nie aufaddiert', () => {
    const r = spielstandZusammen({ stats: { best: 10 } }, { stats: { best: 40 } }, { stats: { best: 25 } })
    expect(r.stats!.best).toBe(40)
    const w = spielstandZusammen({ stats: { weltBest: { wueste: 5 } } }, { stats: { weltBest: { wueste: 9 } } }, { stats: { weltBest: { wueste: 12, eis: 3 } } })
    expect(w.stats!.weltBest).toEqual({ wueste: 12, eis: 3 })
  })

  it('Skins, Welten und Erfolge: beide zusammen', () => {
    const r = spielstandZusammen(
      { wallet: { skins: ['klassik'] }, stats: { erfolge: [] } },
      { wallet: { skins: ['klassik', 'gold'] }, stats: { erfolge: ['a'] } },
      { wallet: { skins: ['klassik', 'rosa'] }, stats: { erfolge: ['b'] } },
    )
    expect(r.wallet!.skins).toEqual(['klassik', 'rosa', 'gold'])
    expect(r.stats!.erfolge).toEqual(['b', 'a'])
  })

  it('Auswahl: hier geaendert gilt, sonst die Cloud; das Aussehen wird nicht Farbe fuer Farbe gemischt', () => {
    const basis = { wallet: { skin: 'klassik', look: { farben: ['gruen'], anzahl: 1 } } }
    const hier = spielstandZusammen(basis, { wallet: { skin: 'gold', look: { farben: ['gelb', 'rot'], anzahl: 2 } } }, { wallet: { skin: 'klassik', look: { farben: ['blau'], anzahl: 1 } } })
    expect(hier.wallet!.skin).toBe('gold')
    expect(hier.wallet!.look).toEqual({ farben: ['gelb', 'rot'], anzahl: 2 })
    const dort = spielstandZusammen(basis, basis, { wallet: { skin: 'rosa', look: { farben: ['blau'], anzahl: 1 } } })
    expect(dort.wallet!.skin).toBe('rosa')
    expect(dort.wallet!.look).toEqual({ farben: ['blau'], anzahl: 1 })
  })

  it('neues Geraet ohne eigenen Fortschritt bekommt alles aus der Cloud', () => {
    const cloud = { wallet: { aepfel: 900, skins: ['klassik', 'gold'], skin: 'gold' }, stats: { best: 77, games: 120 } }
    const r = spielstandZusammen(null, { wallet: { aepfel: 0, skins: ['klassik'], skin: 'klassik' }, stats: { best: 0, games: 0 } }, cloud)
    expect(r).toEqual(cloud)
  })

  it('Tagesbestwert: gleicher Tag das Bessere, sonst der neuere Tag', () => {
    expect(spielstandZusammen(null, { stats: { heute: { datum: '2026-10-25', best: 4 } } }, { stats: { heute: { datum: '2026-10-25', best: 9 } } }).stats!.heute).toEqual({ datum: '2026-10-25', best: 9 })
    expect(spielstandZusammen(null, { stats: { heute: { datum: '2026-10-26', best: 2 } } }, { stats: { heute: { datum: '2026-10-25', best: 9 } } }).stats!.heute).toEqual({ datum: '2026-10-26', best: 2 })
  })
})
