import { describe, expect, it } from 'vitest'
import { autopilot } from '../src/game/autopilot'
import { Game } from '../src/game/game'
import * as R from '../src/game/rules'

const SW = 12
const SH = 23
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
const winter = (cfg: Partial<R.Config> = {}, seed = 3) => {
  const g = new Game({ screenW: SW, screenH: SH, seed, welt: 'winter', cfg })
  leer(g)
  return g
}
/** Apfel direkt vor den Kopf und einen Schritt gehen */
function essen(g: Game) {
  const h = g.body[0]
  const s = R.STEP[g.dir]
  g.apple = { p: { x: h.x + s.x, y: h.y + s.y }, t: g.time }
  const vorher = g.gegessen
  for (let i = 0; i < 10 && g.gegessen === vorher && g.status === 'play'; i++) g.update(100)
}

describe('Winterwald', () => {
  it('Eis und Giftäpfel tauschen ihre Häufigkeit', () => {
    const g = winter()
    expect(g.cfg.eisAb).toBe(R.DEFAULTS.giftAb)
    expect(g.cfg.giftAb).toBe(R.DEFAULTS.eisAb)
    expect(g.cfg.eisAlle).toBeLessThan(R.DEFAULTS.eisAlle)
    const aus = winter({ eisTauschAn: 0 })
    expect(aus.cfg.eisAb).toBe(R.DEFAULTS.eisAb)
  })

  it('Eiszapfen: 2 × 2 in der Nähe, Schatten erst, dann fällt er; Kopf getroffen = vorbei', () => {
    const g = winter()
    expect(g.eiszapfen()).toBe(true)
    const e = g.einschlaege[0]
    expect(e.cells.length).toBe(4)
    const h = g.body[0]
    const d = Math.min(...e.cells.map((c) => Math.abs(c.x - h.x) + Math.abs(c.y - h.y)))
    expect(d).toBeGreaterThanOrEqual(3)
    expect(d).toBeLessThanOrEqual(8)
    for (const c of e.cells) expect(g.aufSchlange(c)).toBe(false)
    // Schlange direkt unter den Zapfen setzen: beim Einschlag vorbei
    const z = winter({}, 4)
    z.eiszapfen()
    const f = z.einschlaege[0]
    z.body = [{ ...f.cells[0] }, { x: f.cells[0].x - 1, y: f.cells[0].y }, { x: f.cells[0].x - 2, y: f.cells[0].y }]
    z.prev = z.body.map((p) => ({ ...p }))
    z.time = f.bis
    ;(z as unknown as { einschlaegeTakt(): void }).einschlaegeTakt()
    expect(z.status).toBe('over')
    expect(z.cause).toBe('eiszapfen')
  })

  it('der Eisblock liegt bis zum nächsten Apfel und ist ein Hindernis', () => {
    const g = winter()
    g.eiszapfen()
    const e = g.einschlaege[0]
    g.time = e.bis
    ;(g as unknown as { einschlaegeTakt(): void }).einschlaegeTakt()
    expect(e.gefallen).toBe(true)
    expect(g.gefahr(e.cells[0])).toBe('eiszapfen')
    essen(g)
    expect(g.einschlaege.filter((x) => x.gefallen).length).toBe(0)
  })

  it('Eis bricht beim dritten Hineinfahren', () => {
    const g = winter()
    const h = g.body[0]
    // Eisfeld zwei Felder vor dem Kopf
    g.eis = [{ cells: [{ x: h.x + 2, y: h.y }], t: 0, tritte: 2 }]
    expect(g.gefahr({ x: h.x + 2, y: h.y })).toBe('eisbruch')
    g.eis[0].tritte = 1
    expect(g.gefahr({ x: h.x + 2, y: h.y })).toBeNull()
    const aus = winter({ eisRisseAn: 0 })
    aus.eis = [{ cells: [{ x: h.x + 2, y: h.y }], t: 0, tritte: 5 }]
    expect(aus.gefahr({ x: h.x + 2, y: h.y })).toBeNull()
  })

  it('Schneesturm kündigt sich an, dann ist die Sicht weg', () => {
    const g = winter()
    g.schneesturm()
    const s = g.sichtsperre!
    expect(s.ab - s.t).toBe(R.DEFAULTS.schneesturmWarnung * 1000)
    expect(s.bis - s.ab).toBe(R.DEFAULTS.schneesturmDauer * 1000)
  })

  it('Tiere: Robbe, Schneemann, Eisbär und Yeti erscheinen mit Abstand und laufen nie in die Schlange', () => {
    for (const art of ['robbe', 'schneemann', 'eisbaer', 'yeti'] as const) {
      const g = winter({}, 7)
      expect(g.wesenNeu(art)).toBe(true)
      const w = g.wesen[0]
      expect(Math.abs(w.p.x - g.body[0].x) + Math.abs(w.p.y - g.body[0].y)).toBeGreaterThanOrEqual(6)
      for (let i = 0; i < 300 && g.status === 'play'; i++) {
        const d = autopilot(g)
        if (d) g.turn(d)
        g.update(50)
        for (const o of g.wesen) expect(g.body.some((p) => p.x === o.p.x && p.y === o.p.y)).toBe(false)
      }
    }
  })

  it('der Eisbär haut zu, wenn er neben dem Kopf steht (kostet Level), dann ist er satt', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 3, welt: 'winter', startLevel: 30 })
    leer(g)
    const h = g.body[0]
    g.wesenNeu('eisbaer')
    const b = g.wesen[0]
    b.p = { x: h.x, y: h.y + 1 }
    b.next = g.time
    const vorher = g.level
    ;(g as unknown as { wesenTakt(): void }).wesenTakt()
    expect(g.level).toBe(vorher - R.DEFAULTS.eisbaerZurueck)
    expect(b.sattBis).toBeGreaterThan(g.time)
  })

  it('Ereignisse würfeln nach dem Apfel, aus = kommt nie', () => {
    const an = winter({ eiszapfenChance: 100, schneesturmChance: 0, yetiChance: 0, polarnachtChance: 0 })
    essen(an)
    expect(an.einschlaege.length).toBe(1)
    const aus = winter({ eiszapfenAn: 0, eiszapfenChance: 100, schneesturmChance: 0, yetiChance: 0, polarnachtChance: 0 })
    essen(aus)
    expect(aus.einschlaege.length).toBe(0)
  })

  it('lange Runden mit Autopilot und allen Ereignissen laufen ohne Fehler', () => {
    let aepfel = 0
    let wesen = 0
    for (let seed = 1; seed <= 6; seed++) {
      const g = new Game({ screenW: SW, screenH: SH, seed, welt: 'winter', startLevel: 30, cfg: { eiszapfenChance: 30, yetiChance: 10, robbeChance: 30, schneemannChance: 30, eisbaerChance: 20, eisbaerAb: 1 } })
      for (let i = 0; i < 4000 && g.status === 'play'; i++) {
        const d = autopilot(g)
        if (d) g.turn(d)
        g.update(16)
        wesen = Math.max(wesen, g.wesen.length)
      }
      aepfel += g.gegessen
    }
    expect(aepfel).toBeGreaterThan(10)
    expect(wesen).toBeGreaterThan(0)
  })
})
