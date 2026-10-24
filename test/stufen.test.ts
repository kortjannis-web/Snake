import { describe, expect, it } from 'vitest'
import { autopilot } from '../src/game/autopilot'
import { ERDMANN_GUCKEN, Game, STICH_WARNUNG } from '../src/game/game'
import * as R from '../src/game/rules'
import type { P, WesenArt } from '../src/game/types'

const SW = 12
const SH = 23
const C = R.DEFAULTS
const leer = (g: Game) => {
  g.mauern = []
  g.teiche = []
  g.gift = []
  g.froesche = []
  g.fallen = []
  g.baeume = []
  g.haeuser = []
  g.tuerme = []
  g.gegner = []
  g.ameisen = []
  g.wesen = []
}
const welt = (id: string, cfg: Partial<R.Config> = {}, seed = 3, startLevel = 1) => {
  const g = new Game({ screenW: SW, screenH: SH, seed, welt: id, cfg, startLevel, vulkan: id === 'vulkan', wueste: id === 'wueste' })
  leer(g)
  return g
}
const takt = (g: Game, name: string) => (g as unknown as Record<string, () => void>)[name].call(g)

describe('Stufen', () => {
  it('Wiese: Wasser und Frösche häufig, alles andere mittel', () => {
    const w = R.mitStufen(C, 'wiese')
    expect(w.teichAlle).toBe(C.haeufigAlle)
    expect(w.froschMax).toBeLessThanOrEqual(4)
    expect(w.baumAlle).toBe(C.mittelAlle)
    expect(w.hausAlle).toBe(C.mittelAlle)
    expect(w.eisAlle).toBe(C.mittelAlle)
    // Feste Zeiten
    expect(w.turmAb).toBe(50)
    expect(w.lilaAb).toBe(75)
  })

  it('Neues kommt selten: Mauern ab 5, dann etwa alle 15 Level eins, nie kurz hintereinander', () => {
    for (const welt of R.WELT_IDS) {
      const w = R.mitStufen(C, welt) as Record<string, number>
      const reihe = R.neuReihenfolge(C, welt)
      // Alles ausser den Jaegertuermen (feste Zeit) ist in der Reihe
      expect(reihe.length, welt).toBe(Object.keys(R.WELT_STUFEN[welt]).length - 1)
      expect(w.mauerAb).toBe(5)
      const ab = reihe.map((a) => w[`${a}Ab`])
      expect(ab[0], welt).toBe(C.stufenAb)
      // Zusammen mit den festen Zeiten (Mauern, Jaegertuerme, lila Gegner) mindestens 10 Level Abstand
      const alle = [...ab, w.mauerAb, w.turmAb, w.lilaAb].sort((a, b) => a - b)
      for (let i = 1; i < alle.length; i++) expect(alle[i] - alle[i - 1], `${welt} ${alle[i]}`).toBeGreaterThanOrEqual(10)
      for (let i = 1; i < ab.length; i++) expect(ab[i] - ab[i - 1], `${welt} ${reihe[i]}`).toBeGreaterThanOrEqual(C.neuAlle)
      // Bis Level 50 hoechstens zwei Dinge aus der Reihe
      expect(ab.filter((l) => l <= 50).length, welt).toBeLessThanOrEqual(2)
    }
  })

  it('Plätze nahe einer festen Zeit rücken dahinter', () => {
    expect(R.neuLevels({ ...C, stufenAb: 15, neuAlle: 15 }, 6, [5, 50, 75])).toEqual([15, 30, 65, 90, 105, 120])
    expect(R.neuLevels({ ...C, stufenAb: 5, neuAlle: 15 }, 2, [5])).toEqual([20, 35])
    expect(R.neuLevels({ ...C, stufenAb: 10, neuAlle: 10 }, 3, [])).toEqual([10, 20, 30])
  })

  it('erst das Häufige, dann das Mittlere, dann das Seltene', () => {
    const r = R.neuReihenfolge(C, 'wiese')
    expect(r.slice(0, 2)).toEqual(['teich', 'frosch'])
    const selten = R.neuReihenfolge({ ...C, stufe_wiese_teich: 1, stufe_wiese_igel: 0 }, 'wiese')
    expect(selten[selten.length - 1]).toBe('teich')
    expect(selten).not.toContain('igel')
    // Die Tiere der Welt sind über die Reihe verteilt, nicht alle am Ende
    const w = R.neuReihenfolge(C, 'winter')
    expect(w.indexOf('robbe')).toBeLessThan(w.length / 2)
  })

  it('Wüste: Palmen, Springmäuse und Feuerameisen häufig, Wasser mittel', () => {
    const w = R.mitStufen(C, 'wueste')
    expect(w.baumAlle).toBe(C.haeufigAlle)
    expect(w.teichAlle).toBe(C.mittelAlle)
    expect(R.pause(w, 'frosch', 10)).toEqual([2, 4])
    expect(R.pause(w, 'ameise', 10)).toEqual([2, 4])
    expect(R.pause(w, 'falle', 10)).toEqual([6, 10])
    expect(w.skorpionChance).toBeCloseTo(12.5)
  })

  it('andere Welten: nur die Mauern sind häufig', () => {
    for (const id of ['winter', 'bergwerk', 'zauberwald', 'gruselwald', 'vulkan']) {
      const w = R.mitStufen(C, id)
      expect(w.teichAlle, id).toBe(C.mittelAlle)
      expect(R.pause(w, 'frosch', 10), id).toEqual([6, 10])
    }
  })

  it('Stufe aus schaltet ab, selten kommt seltener, Ausdrückliches bleibt', () => {
    const aus = R.mitStufen({ ...C, stufe_wiese_teich: 0, stufe_wiese_igel: 0, stufe_wiese_baum: 1 }, 'wiese')
    expect(aus.teichAb).toBeGreaterThan(1e6)
    expect(aus.igelAn).toBe(0)
    expect(aus.baumAlle).toBe(C.seltenAlle)
    const eigen = R.mitStufen({ ...C, froschAb: 2 }, 'wiese')
    expect(eigen.froschAb).toBe(2)
    const g = new Game({ screenW: SW, screenH: SH, seed: 1, cfg: { stufe_wiese_teich: 0 }, welt: 'wiese', startLevel: 60 })
    expect(g.teiche.length).toBe(0)
  })

  it('Gefahren sind je Welt klar abgestuft (von häufig nach selten, keine gleich oft)', () => {
    for (const [w, liste] of Object.entries(R.WELT_GEFAHREN)) {
      const chancen = liste.map((k) => C[`${k}Chance` as R.ConfigKey])
      for (let i = 1; i < chancen.length; i++) expect(chancen[i], `${w} ${liste[i]}`).toBeLessThan(chancen[i - 1])
    }
  })

  it('Master-Einstellungen: Stufen-Felder für jede Welt, keine abgeleiteten Zahlen einzeln', () => {
    const keys = R.SCHEMA.flatMap((g) => g.felder.map((f) => f.key))
    for (const w of R.WELT_IDS) for (const a of Object.keys(R.WELT_STUFEN[w])) expect(keys).toContain(R.stufeKey(w, a))
    for (const k of keys) {
      expect(R.ABGELEITET.has(k), k).toBe(false)
      expect(k in C, k).toBe(true)
    }
  })
})

describe('Kreativ: was kommen kann', () => {
  it('jede Welt listet Mauern, Power-ups, ihre Dinge und Gefahren', () => {
    for (const w of R.WELT_IDS) {
      const keys = R.kreativDinge(w).map((d) => d.key)
      expect(keys, w).toContain('mauer')
      expect(keys, w).toContain('power')
      for (const a of Object.keys(R.WELT_STUFEN[w])) expect(keys, w).toContain(a)
      for (const k of R.WELT_GEFAHREN[w]) expect(keys, w).toContain(k)
      expect(new Set(keys).size, w).toBe(keys.length)
    }
  })

  it('Abgeschaltetes kommt nie', () => {
    const aus = R.kreativAus('bergwerk', ['mauer', 'power', 'teich', 'zwerg', 'steinschlag', 'lila', 'turm'])
    const c = R.mitStufen({ ...C, ...aus }, 'bergwerk')
    expect(c.mauerAb).toBeGreaterThan(1e6)
    expect(c.powerAb).toBeGreaterThan(1e6)
    expect(c.teichAb).toBeGreaterThan(1e6)
    expect(c.zwergAn).toBe(0)
    expect(c.steinschlagAn).toBe(0)
    expect(c.lilaAb).toBeGreaterThan(1e6)
    expect(c.turmAb).toBeGreaterThan(1e6)
    // Der Rest rueckt in der Reihe nach vorn
    expect(c.froschAb).toBe(C.stufenAb)
    const g = new Game({ screenW: SW, screenH: SH, seed: 2, welt: 'bergwerk', cfg: aus, startLevel: 120 })
    expect(g.mauern.length).toBe(0)
    expect(g.teiche.length).toBe(0)
    expect(g.tuerme.length).toBe(0)
  })
})

describe('Kreativ: jede Schaltfläche löst das Richtige aus', () => {
  const WESEN = new Set<string>(['yeti', 'robbe', 'schneemann', 'eisbaer', 'zwerg', 'golem', 'irrlicht', 'einhorn', 'fee', 'ent', 'gespenst', 'riesenspinne', 'kraehe', 'glutgolem', 'igel', 'klapperschlange', 'riesenskorpion', 'sandkrabbe'])
  it('Tiere erscheinen als sie selbst (kein anderes Ereignis)', () => {
    for (const id of ['wiese', 'wueste', 'winter', 'bergwerk', 'zauberwald', 'gruselwald', 'vulkan']) {
      for (const was of welt(id).weltAuswahl()) {
        if (!WESEN.has(was)) continue
        let ok = false
        for (let seed = 1; seed <= 6 && !ok; seed++) {
          const g = welt(id, {}, seed, 30)
          if (g.weltAusloesen(was)) {
            expect(g.wesen.some((w) => w.art === (was as WesenArt)), `${id} ${was}`).toBe(true)
            expect(g.einschlaege.length, `${id} ${was}`).toBe(0)
            ok = true
          }
        }
        expect(ok, `${id} ${was}`).toBe(true)
      }
    }
  })
})

describe('Wüste: neue Tiere', () => {
  it('Riesenskorpion hebt den Schwanz und sticht, wenn der Kopf in Stichweite bleibt', () => {
    const g = welt('wueste', {}, 3, 30)
    expect(g.wesenNeu('riesenskorpion')).toBe(true)
    const w = g.wesen[0]
    const h = g.body[0]
    w.p = { x: h.x + 2, y: h.y }
    takt(g, 'tiereTakt')
    expect(w.stichAb).toBeGreaterThan(g.time)
    const vorher = g.level
    g.time = w.stichAb! + 1
    takt(g, 'tiereTakt')
    expect(g.level).toBe(vorher - C.skorpionZurueck)
    // Weg aus der Stichweite: kein Stich
    const g2 = welt('wueste', {}, 3, 30)
    g2.wesenNeu('riesenskorpion')
    const w2 = g2.wesen[0]
    w2.p = { x: g2.body[0].x + 2, y: g2.body[0].y }
    takt(g2, 'tiereTakt')
    w2.p = { x: g2.body[0].x + 3, y: g2.body[0].y + 3 }
    g2.time += STICH_WARNUNG + 1
    const v2 = g2.level
    takt(g2, 'tiereTakt')
    expect(g2.level).toBe(v2)
  })

  it('Sandkrabbe läuft nur am Strand', () => {
    const g = welt('wueste', {}, 3, 30)
    expect(g.wesenNeu('sandkrabbe')).toBe(true)
    const w = g.wesen[0]
    const amRand = (p: P) => Object.values(R.STEP).some((d) => !g.inside({ x: p.x + d.x, y: p.y + d.y }))
    for (let i = 0; i < 30; i++) {
      w.next = g.time
      takt(g, 'wesenTakt')
      expect(amRand(w.p)).toBe(true)
    }
    expect(g.gefahr(w.p)).toBe('sandkrabbe')
  })

  it('Erdmännchen: tauchen auf und blockieren, aber nie unter der Schlange', () => {
    const g = welt('wueste', {}, 3, 30)
    expect(g.koloniesetzen()).toBe(true)
    const k = g.kolonien[0]
    expect(k.loecher.length).toBeGreaterThanOrEqual(3)
    k.phase = k.loecher.map(() => 0)
    g.time = k.t + ERDMANN_GUCKEN + 10
    expect(g.gefahr(k.loecher[0])).toBe('erdmaennchen')
    g.time = k.t + 10
    expect(g.gefahr(k.loecher[0])).toBeNull()
  })

  it('Mumie steigt aus dem Sarkophag und kostet Level', () => {
    const g = welt('wueste', {}, 3, 30)
    expect(g.sarkophagSetzen()).toBe(true)
    const s = g.sarkophage[0]
    expect(g.gefahr(s.p)).toBe('sarkophag')
    g.time = s.auf
    takt(g, 'tiereTakt')
    const m = g.wesen.find((w) => w.art === 'mumie')!
    expect(m).toBeTruthy()
    const h = g.body[0]
    m.p = { x: h.x + 1, y: h.y }
    m.next = g.time
    const vorher = g.level
    takt(g, 'wesenTakt')
    expect(g.level).toBe(vorher - C.mumieZurueck)
  })

  it('Fata Morgana: die falsche Kaktusfeige ist tödlich und verschwindet wieder', () => {
    const g = welt('wueste', {}, 3, 30)
    expect(g.fataSetzen()).toBe(true)
    const f = g.fatas[0]
    expect(g.gefahr(f.p)).toBe('fata')
    expect(g.gefahr(f.cells.find((c) => c.x !== f.p.x || c.y !== f.p.y)!)).toBeNull()
    g.time = f.bis
    takt(g, 'tiereTakt')
    expect(g.fatas.length).toBe(0)
  })

  it('lange Runden in der Wüste mit allen Tieren laufen ohne Fehler', () => {
    let aepfel = 0
    for (let seed = 1; seed <= 4; seed++) {
      const g = new Game({ screenW: SW, screenH: SH, seed, welt: 'wueste', wueste: true, startLevel: 20, cfg: { skorpionChance: 40, krabbeChance: 40, erdmaennchenChance: 40, mumieChance: 40, fataChance: 40 } })
      for (let i = 0; i < 3000 && g.status === 'play'; i++) {
        const d = autopilot(g)
        if (d) g.turn(d)
        g.update(16)
      }
      aepfel += g.gegessen
    }
    expect(aepfel).toBeGreaterThan(3)
  })
})
