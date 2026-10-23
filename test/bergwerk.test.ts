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
const berg = (cfg: Partial<R.Config> = {}, seed = 3, startLevel = 1) => {
  const g = new Game({ screenW: SW, screenH: SH, seed, welt: 'bergwerk', cfg, startLevel })
  leer(g)
  return g
}
const takt = (g: Game, name: string) => (g as unknown as Record<string, () => void>)[name].call(g)

describe('Bergwerk', () => {
  it('von Anfang an ein Schienennetz; Lücken im Stein werden zu befahrbaren Stollen', () => {
    const g = berg()
    expect(g.schienen.length).toBe(2)
    for (const s of g.schienen) expect(g.schieneFelder(s)).not.toBeNull()
    // Mit wachsender Karte kommen Stollen durch den Stein dazu, die gehören zur Karte
    let stollen = 0
    for (let seed = 1; seed <= 15; seed++) {
      const h = new Game({ screenW: SW, screenH: SH, seed, welt: 'bergwerk', startLevel: 200, cfg: { schienenNeu: 100 } })
      stollen += h.stollen.length
      for (const c of h.stollen) expect(h.inside(c)).toBe(true)
      for (const s of h.schienen) {
        const f = h.schieneFelder(s)
        if (f) for (const c of f.cells) expect(h.inside(c)).toBe(true)
      }
    }
    expect(stollen).toBeGreaterThan(0)
  })

  it('Steinschlag: 2 bis 4 einzelne Felder in der Nähe, nie auf der Schlange; trifft auch den Schwanz tödlich', () => {
    const g = berg()
    expect(g.steinschlag()).toBe(true)
    const steine = g.einschlaege.filter((e) => e.art === 'stein')
    expect(steine.length).toBeGreaterThanOrEqual(2)
    expect(steine.length).toBeLessThanOrEqual(4)
    for (const e of steine) expect(g.aufSchlange(e.cells[0])).toBe(false)
    // Stein auf den Schwanz
    const t = berg({}, 5)
    t.steinschlag()
    const e = t.einschlaege[0]
    t.body = [{ x: e.cells[0].x + 2, y: e.cells[0].y }, { x: e.cells[0].x + 1, y: e.cells[0].y }, { ...e.cells[0] }]
    t.time = e.bis
    takt(t, 'einschlaegeTakt')
    expect(t.status).toBe('over')
    expect(t.cause).toBe('stein')
  })

  it('Lore: Glocke, dann fährt sie die Schiene entlang; Kopf getroffen = vorbei', () => {
    const g = berg()
    expect(g.loreStarten()).toBe(true)
    const d = g.durchzuege[0]
    expect(d.art).toBe('lore')
    expect(g.durchzugKopf(d)).toBeNull()
    // Kopf mitten auf die Schiene
    const f = g.schieneFelder({ achse: d.achse, linie: d.linie })!
    const mitte = f.cells[Math.floor(f.cells.length / 2)]
    g.body = [{ ...mitte }]
    // Zeit vorspulen, bis die Lore da ist
    for (let i = 0; i < 2000 && g.status === 'play' && g.durchzuege.length; i++) {
      g.time += 10
      takt(g, 'bergwerkTakt')
    }
    expect(g.cause).toBe('lore')
  })

  it('TNT: der Funke läuft, am Fass explodiert es; austreten stoppt es', () => {
    const g = berg()
    expect(g.tntLegen()).toBe(true)
    const z = g.zuendschnuere[0]
    expect(z.weg.length).toBe(5)
    expect(g.gefahr(z.fass)).toBe('tnt')
    g.time = z.t + z.takt * 5
    takt(g, 'bergwerkTakt')
    expect(g.zuendschnuere.length).toBe(0)
    expect(g.einschlaege.some((e) => e.art === 'explosion')).toBe(true)
    // Austreten: Kopf auf den Funken
    const a = berg({}, 6)
    a.tntLegen()
    const za = a.zuendschnuere[0]
    ;(a as unknown as { bergwerkBetreten(n: { x: number; y: number }): void }).bergwerkBetreten(za.weg[0])
    expect(a.zuendschnuere.length).toBe(0)
  })

  it('Erdbeben: der Spalt reißt erst nach der Warnung auf und schließt sich mit dem nächsten Apfel', () => {
    const g = berg()
    expect(g.erdbeben()).toBe(true)
    const sp = g.spalten[0]
    expect(g.gefahr(sp.cells[0])).toBeNull()
    g.time = sp.ab
    expect(g.gefahr(sp.cells[0])).toBe('spalt')
    ;(g as unknown as { weltNachApfel(): void }).weltNachApfel()
    expect(g.spalten.length).toBe(0)
  })

  it('Fledermausschwarm kostet Level, wenn er den Kopf erwischt', () => {
    const g = berg({}, 3, 30)
    expect(g.fledermaeuse()).toBe(true)
    const d = g.durchzuege[0]
    const k = d.achse === 'x' ? { x: Math.round((d.von + d.bis) / 2), y: d.linie } : { x: d.linie, y: Math.round((d.von + d.bis) / 2) }
    g.body = [{ ...k }, { x: k.x, y: k.y }]
    const vorher = g.level
    for (let i = 0; i < 2000 && g.durchzuege.length; i++) {
      g.time += 10
      takt(g, 'bergwerkTakt')
    }
    expect(g.level).toBe(vorher - R.DEFAULTS.fledermausZurueck)
  })

  it('Netz bremst; Zwerg legt Erz ab; Golem haut zu', () => {
    const g = berg({}, 3, 30)
    expect(g.netzSpannen()).toBe(true)
    const n = g.netze[0]
    ;(g as unknown as { bergwerkBetreten(n: { x: number; y: number }): void }).bergwerkBetreten(n.p)
    expect(g.bremseBis).toBeGreaterThan(g.time)
    expect(g.wesenNeu('zwerg')).toBe(true)
    const z = g.wesen[0]
    const funde = g.funde.length
    g.time = z.wurfNext
    takt(g, 'wesenTakt')
    expect(g.funde.length).toBe(funde + 1)
    g.wesen = []
    g.wesenNeu('golem')
    const go = g.wesen[0]
    go.p = { x: g.body[0].x, y: g.body[0].y + 1 }
    go.next = g.time
    const vorher = g.level
    takt(g, 'wesenTakt')
    expect(g.level).toBe(vorher - R.DEFAULTS.golemZurueck)
  })

  it('lange Runden mit Autopilot und allen Ereignissen laufen ohne Fehler', () => {
    let aepfel = 0
    for (let seed = 1; seed <= 6; seed++) {
      const g = new Game({ screenW: SW, screenH: SH, seed, welt: 'bergwerk', startLevel: 40, cfg: { loreChance: 30, tntChance: 20, erdbebenChance: 20, fledermausChance: 20, zwergAb: 1, golemAb: 1, zwergChance: 30, golemChance: 20, netzChance: 40 } })
      for (let i = 0; i < 4000 && g.status === 'play'; i++) {
        const d = autopilot(g)
        if (d) g.turn(d)
        g.update(16)
      }
      aepfel += g.gegessen
    }
    expect(aepfel).toBeGreaterThan(10)
  })
})
