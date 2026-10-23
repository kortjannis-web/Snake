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
const welt = (id: string, cfg: Partial<R.Config> = {}, seed = 3, startLevel = 1) => {
  const g = new Game({ screenW: SW, screenH: SH, seed, welt: id, cfg, startLevel })
  leer(g)
  return g
}
const takt = (g: Game, name: string) => (g as unknown as Record<string, () => void>)[name].call(g)
const nachApfel = (g: Game) => takt(g, 'weltNachApfel')

describe('Zauberwald', () => {
  it('Spiegelfluch: nach dem Schimmer ist die Steuerung vertauscht', () => {
    const g = welt('zauberwald')
    g.spiegelfluch()
    expect(g.spiegelt()).toBe(false)
    g.time = g.spiegel!.ab
    expect(g.spiegelt()).toBe(true)
    g.turn('u')
    expect(g.queue[0] ?? g.dir).toBe('d')
  })

  it('Ranken wachsen vom Rand Feld für Feld und verwelken nach ein paar Äpfeln', () => {
    const g = welt('zauberwald')
    expect(g.rankeWachsen()).toBe(true)
    const r = g.ranken[0]
    expect(r.grown).toBe(1)
    expect(g.gefahr(r.cells[0])).toBe('ranke')
    g.time = r.next
    takt(g, 'zauberTakt')
    expect(r.grown).toBe(2)
    for (let i = 0; i < R.DEFAULTS.rankenAepfel; i++) nachApfel(g)
    expect(g.ranken.length).toBe(0)
  })

  it('wandernder Baum rückt mit jedem Apfel ein Feld weiter', () => {
    const g = welt('zauberwald', { wanderbaumChance: 0, spiegelChance: 0, rankenChance: 0, sporenChance: 0, irrlichtChance: 0 })
    expect(g.wanderbaumSetzen()).toBe(true)
    const b = g.wanderbaeume[0]
    const vorher = { ...b.p }
    nachApfel(g)
    expect(Math.abs(b.p.x - vorher.x) + Math.abs(b.p.y - vorher.y)).toBe(1)
    expect(g.gefahr(b.p)).toBe('wanderbaum')
  })

  it('Sporen machen schneller, Regenbogen bringt Äpfel', () => {
    const g = welt('zauberwald', {}, 3, 20)
    g.sporenwolke()
    const c = g.sporen[0].cells[4]
    const takt0 = g.takt
    ;(g as unknown as { zauberBetreten(n: { x: number; y: number }): void }).zauberBetreten(c)
    expect(g.takt).toBeLessThan(takt0)
    g.regenbogen.push({ p: { x: 1, y: 1 }, t: g.time })
    const v = g.verdient
    ;(g as unknown as { zauberBetreten(n: { x: number; y: number }): void }).zauberBetreten({ x: 1, y: 1 })
    expect(g.verdient).toBeGreaterThan(v)
  })

  it('Pilzringe beamen die ganze Schlange, wenn dort Platz ist', () => {
    const g = welt('zauberwald')
    expect(g.pilzringeSetzen()).toBe(true)
    const pr = g.pilzringe!
    g.body = [{ ...pr.a }]
    g.prev = [{ ...pr.a }]
    takt(g, 'zauberTakt')
    expect(g.body[0]).toEqual(pr.b)
    // Kein Hin und Her: auf dem Zielring passiert nichts mehr
    takt(g, 'zauberTakt')
    expect(g.body[0]).toEqual(pr.b)
  })

  it('Fee klaut den Apfel, wenn du nah dran bist; Irrlicht ist tödlich', () => {
    const g = welt('zauberwald')
    g.wesenNeu('fee')
    const f = g.wesen[0]
    const h = g.body[0]
    g.apple = { p: { x: h.x + 2, y: h.y }, t: 0 }
    f.p = { x: h.x + 3, y: h.y }
    f.next = g.time
    takt(g, 'wesenTakt')
    expect(g.apple.p).not.toEqual({ x: h.x + 2, y: h.y })
    const i = welt('zauberwald')
    i.wesenNeu('irrlicht')
    expect(i.gefahr(i.wesen[0].p)).toBe('irrlicht')
  })
})

describe('Gruselwald', () => {
  it('Zombiehände: erst wackelt es, dann greifen sie kurz zu', () => {
    const g = welt('gruselwald')
    expect(g.zombiehaende()).toBe(true)
    const e = g.einschlaege[0]
    expect(g.gefahr(e.cells[0])).toBeNull()
    g.time = e.bis
    takt(g, 'einschlaegeTakt')
    expect(g.gefahr(e.cells[0])).toBe('zombiehand')
    g.time = e.weg!
    takt(g, 'einschlaegeTakt')
    expect(g.einschlaege.length).toBe(0)
  })

  it('Vollmond: alle 25 Level jagt der Werwolf, danach ist er weg', () => {
    const g = welt('gruselwald', { zombiehandChance: 0, grabChance: 0, kraehenschwarmChance: 0 }, 3, 25)
    nachApfel(g)
    expect(g.vollmond).not.toBeNull()
    expect(g.wesen.some((w) => w.art === 'werwolf')).toBe(true)
    g.time = g.vollmond!.bis
    takt(g, 'zauberTakt')
    expect(g.wesen.some((w) => w.art === 'werwolf')).toBe(false)
  })

  it('Gespenst fliegt durch alles und kostet Level; Krähe klaut Power-ups', () => {
    const g = welt('gruselwald', {}, 3, 30)
    g.wesenNeu('gespenst')
    const sp = g.wesen[0]
    sp.p = { x: g.body[0].x, y: g.body[0].y + 1 }
    sp.next = g.time
    const vorher = g.level
    takt(g, 'wesenTakt')
    expect(g.level).toBe(vorher - R.DEFAULTS.gespenstZurueck)
    expect(g.gefahr(sp.p)).toBeNull()
    const k = welt('gruselwald')
    k.wesenNeu('kraehe')
    const kr = k.wesen[0]
    k.powers = [{ p: { ...kr.p }, t: 0, until: 1e9, art: 'schild' }]
    kr.next = k.time
    takt(k, 'wesenTakt')
    expect(k.powers.length).toBe(0)
  })

  it('lange Runden in beiden Wäldern mit allen Ereignissen laufen ohne Fehler', () => {
    for (const id of ['zauberwald', 'gruselwald']) {
      let aepfel = 0
      for (let seed = 1; seed <= 5; seed++) {
        const g = new Game({ screenW: SW, screenH: SH, seed, welt: id, startLevel: 30, cfg: { rankenChance: 30, wanderbaumChance: 30, sporenChance: 30, zombiehandChance: 30, grabChance: 20, einhornAb: 1, feeAb: 1, entAb: 1, gespenstAb: 1, spinneAb: 1, kraeheAb: 1, einhornChance: 30, entChance: 30, gespenstChance: 30, spinneChance: 30 } })
        for (let i = 0; i < 3000 && g.status === 'play'; i++) {
          const d = autopilot(g)
          if (d) g.turn(d)
          g.update(16)
        }
        aepfel += g.gegessen
      }
      expect(aepfel, id).toBeGreaterThan(8)
    }
  })
})
