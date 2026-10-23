import { describe, expect, it } from 'vitest'
import { ACCS, hatSkin, lohnVon, MUSTER, skinVon, SPUREN, WELT_LOHN, baueSkin } from '../src/render/skins'
import { naechsteWelt, WELTEN, weltFrei, weltFreiAlt, weltVon } from '../src/render/welten'

describe('Welten: Reihenfolge und Freischaltung', () => {
  it('Wiese, dann Wüste, Winter, Bergwerk, Zauberwald, Gruselwald, Vulkan', () => {
    expect(WELTEN.map((w) => w.id)).toEqual(['wiese', 'wueste', 'winter', 'bergwerk', 'zauberwald', 'gruselwald', 'vulkan'])
    expect(naechsteWelt(weltVon('wiese'))?.id).toBe('wueste')
    expect(naechsteWelt(weltVon('gruselwald'))?.id).toBe('vulkan')
    expect(naechsteWelt(weltVon('vulkan'))).toBeNull()
  })
  it('die Wiese ist immer frei, alles andere nur, wenn freigeschaltet', () => {
    expect(weltFrei(weltVon('wiese'), [])).toBe(true)
    expect(weltFrei(weltVon('wueste'), [])).toBe(false)
    expect(weltFrei(weltVon('wueste'), ['wueste'])).toBe(true)
  })
  it('alte Spielstände behalten, was nach der alten Regel frei war', () => {
    expect(WELTEN.filter((w) => weltFreiAlt(w, 130)).map((w) => w.id).sort()).toEqual(['bergwerk', 'wiese', 'winter', 'wueste'])
  })
})

describe('Welten: Belohnungen', () => {
  it('jede Welt: Skin bei 100, Accessoire bei 150, epischer Skin und Spur bei 200 (der Vulkan hat noch keine)', () => {
    expect(WELT_LOHN.some((x) => x.welt === 'vulkan')).toBe(false)
    for (const w of WELTEN.filter((w) => w.id !== 'vulkan')) {
      const l = WELT_LOHN.filter((x) => x.welt === w.id)
      expect(l.map((x) => x.level)).toEqual([100, 150, 200, 200])
      expect(MUSTER.some((m) => m.id === l[0].id)).toBe(true)
      expect(ACCS.some((a) => a.id === l[1].id)).toBe(true)
      const episch = MUSTER.find((m) => m.id === l[2].id)
      expect(episch?.glimmer).toBeTruthy()
      expect(SPUREN.some((s) => s.id === l[3].id)).toBe(true)
    }
  })
  it('kann man nicht kaufen und nicht umsonst haben, nur erspielen', () => {
    for (const l of WELT_LOHN) {
      expect(hatSkin(['klassik'], l.id)).toBe(false)
      expect(hatSkin(['klassik', l.id], l.id)).toBe(true)
      expect(lohnVon(l.id)?.welt).toBe(l.welt)
    }
    // Normale Gratis-Sachen bleiben gratis
    expect(hatSkin([], 'klassik')).toBe(true)
  })
  it('Nummern sind eindeutig, Aussehen mit Belohnungen geht als Text hin und zurück', () => {
    for (const liste of [MUSTER, ACCS, SPUREN]) expect(new Set(liste.map((x) => x.nr)).size).toBe(liste.length)
    const s = baueSkin({ muster: 'pharao', acc: ['nemes'], spur: 'spur-goldsand' })
    const z = skinVon(s.code)
    expect(z.muster?.id).toBe('pharao')
    expect(z.acc.map((a) => a.id)).toEqual(['nemes'])
    expect(z.spur?.id).toBe('spur-goldsand')
    expect(s.code.length).toBeLessThanOrEqual(32)
  })
})
