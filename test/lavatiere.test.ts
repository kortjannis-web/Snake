import { describe, expect, it } from 'vitest'
import { autopilot } from '../src/game/autopilot'
import { Game } from '../src/game/game'
import * as R from '../src/game/rules'
import type { P } from '../src/game/types'

const STEP = R.STEP
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
  const g = new Game({ screenW: SW, screenH: SH, seed, welt: id, cfg, startLevel, vulkan: id === 'vulkan', wueste: id === 'wueste' })
  leer(g)
  return g
}
const takt = (g: Game, name: string) => (g as unknown as Record<string, () => void>)[name].call(g)
const nachApfel = (g: Game) => takt(g, 'weltNachApfel')
const kopfAuf = (g: Game, p: P) => {
  g.body = [{ ...p }]
  g.prev = [{ ...p }]
}

describe('Vulkan: Ereignisse', () => {
  it('Abbruchkante: erst Risse am Abgrund, dann bricht das Stück weg, mit dem nächsten Apfel ist es wieder fest', () => {
    const g = welt('vulkan')
    expect(g.abbruch()).toBe(true)
    const e = g.einschlaege[0]
    expect(e.cells.length).toBeGreaterThanOrEqual(2)
    for (const c of e.cells) expect(g.gefahr(c)).toBeNull()
    g.time = e.bis
    takt(g, 'einschlaegeTakt')
    for (const c of e.cells) expect(g.gefahr(c)).toBe('abbruch')
    nachApfel(g)
    expect(g.einschlaege.some((o) => o === e)).toBe(false)
  })

  it('Ausbruch: Lavabomben kommen aus dem Abgrund, landen nie auf der Schlange und brennen kurz', () => {
    const g = welt('vulkan')
    expect(g.ausbruch()).toBe(true)
    const bomben = g.einschlaege.filter((e) => e.art === 'lavabombe')
    expect(bomben.length).toBeGreaterThanOrEqual(1)
    for (const b of bomben) {
      expect(b.von && g.inside(b.von)).toBe(false)
      expect(g.aufSchlange(b.cells[0])).toBe(false)
    }
    const b = bomben[0]
    g.time = b.bis
    takt(g, 'einschlaegeTakt')
    expect(g.gefahr(b.cells[0])).toBe('lavabombe')
    g.time = b.weg! + 1
    takt(g, 'einschlaegeTakt')
    expect(g.einschlaege.includes(b)).toBe(false)
  })

  it('Feuerregen: 4 bis 7 Meteore, nie auf der Schlange', () => {
    const g = welt('vulkan', {}, 5, 30)
    expect(g.feuerregen()).toBe(true)
    const m = g.einschlaege.filter((e) => e.art === 'meteor')
    expect(m.length).toBeGreaterThanOrEqual(1)
    expect(m.length).toBeLessThanOrEqual(R.DEFAULTS.feuerregenMax)
    for (const e of m) expect(g.aufSchlange(e.cells[0])).toBe(false)
  })

  it('Lavastrom fließt vom Abgrund Feld für Feld, ist tödlich und erkaltet nach ein paar Äpfeln', () => {
    const g = welt('vulkan', { abbruchChance: 0, ausbruchChance: 0, lavastromChance: 0, magmawurmChance: 0, feuerregenChance: 0 })
    expect(g.lavastromStarten()).toBe(true)
    const l = g.lavastroeme[0]
    expect(l.cells.length).toBeGreaterThanOrEqual(3)
    expect(DirsAbgrund(g, l.cells[0])).toBe(true)
    expect(g.gefahr(l.cells[0])).toBe('lavastrom')
    expect(g.gefahr(l.cells[1])).toBeNull()
    g.time = l.next
    takt(g, 'vulkanTakt')
    expect(l.grown).toBe(2)
    for (let i = 0; i < R.DEFAULTS.lavastromAepfel; i++) nachApfel(g)
    expect(l.kalt).toBeGreaterThan(0)
    expect(g.gefahr(l.cells[0])).toBeNull()
    g.time += 5000
    takt(g, 'vulkanTakt')
    expect(g.lavastroeme.length).toBe(0)
  })

  it('Magmawurm: der Sandwurm im Vulkan, wer erwischt wird, wurde vom Magmawurm verschlungen', () => {
    const g = welt('vulkan')
    expect(g.sandwurmStarten()).toBe(true)
    const s = g.sandwurm!
    g.time = s.los + 10 * R.WUESTE.wurmTakt
    const f = g.sandwurmFelder().find((c) => g.inside(c))!
    kopfAuf(g, f)
    takt(g, 'sandwurmTakt')
    expect(g.status).toBe('over')
    expect(g.cause).toBe('magmawurm')
  })
})

/** Liegt neben dem Feld der Abgrund? */
function DirsAbgrund(g: Game, p: P) {
  return Object.values(STEP).some((d) => !g.inside({ x: p.x + d.x, y: p.y + d.y }))
}

describe('Vulkan: Tiere und Dinge', () => {
  it('Lavafisch springt von Abgrund zu Abgrund, nur der Kopf wird erwischt', () => {
    const g = welt('vulkan', {}, 3, 20)
    expect(g.lavafischNeu()).toBe(true)
    const f = g.lavafische[0]
    expect(g.inside(f.von)).toBe(false)
    expect(g.inside(f.nach)).toBe(false)
    for (const c of f.cells) expect(g.inside(c)).toBe(true)
    kopfAuf(g, f.cells[1])
    g.time = f.los + 2 * f.takt
    takt(g, 'lavafischeTakt')
    expect(g.cause).toBe('lavafisch')
  })

  it('Lavabrücke: über den Krater fahren geht, nach zwei Überquerungen bricht sie', () => {
    let g: Game | null = null
    for (let seed = 1; seed <= 12 && !g; seed++) {
      const t = welt('vulkan', {}, seed, 20)
      if (t.brueckeBauen()) g = t
    }
    expect(g).not.toBeNull()
    const b = g!.bruecken[0]
    for (const c of b.cells) {
      expect(g!.inside(c)).toBe(false)
      expect(g!.gefahr(c)).toBeNull()
    }
    const be = (von: P, n: P) => (g as unknown as { vulkanBetreten(a: P, b: P): void }).vulkanBetreten(von, n)
    be({ x: -50, y: -50 }, b.cells[0])
    be({ x: -50, y: -50 }, b.cells[0])
    takt(g!, 'vulkanTakt')
    expect(g!.bruecken.length).toBe(0)
    expect(g!.gefahr(b.cells[0])).toBe('abgrund')
  })

  it('Obsidian: nur von der leuchtenden Seite einsammelbar, bringt viele Äpfel', () => {
    const g = welt('vulkan', {}, 3, 40)
    expect(g.obsidianSetzen()).toBe(true)
    const o = g.obsidiane[0]
    const st = STEP[o.offen]
    kopfAuf(g, { x: o.p.x - st.x, y: o.p.y - st.y })
    expect(g.gefahr(o.p)).toBe('obsidian')
    kopfAuf(g, { x: o.p.x + st.x, y: o.p.y + st.y })
    expect(g.gefahr(o.p)).toBeNull()
    const v = g.verdient
    ;(g as unknown as { vulkanBetreten(a: P, b: P): void }).vulkanBetreten(g.body[0], o.p)
    expect(g.verdient - v).toBe(g.cfg.apfelWert * g.apfelStufe() * R.DEFAULTS.obsidianWert)
    expect(g.obsidiane.length).toBe(0)
  })

  it('Glutgolem hinterlässt eine glühende Spur, die kurz tödlich ist', () => {
    const g = welt('vulkan', {}, 3, 50)
    expect(g.wesenNeu('glutgolem')).toBe(true)
    const w = g.wesen[0]
    const vorher = { ...w.p }
    w.next = g.time
    takt(g, 'wesenTakt')
    expect(w.p).not.toEqual(vorher)
    expect(g.gefahr(vorher)).toBe('glut')
    g.time += R.DEFAULTS.glutDauer * 1000
    takt(g, 'vulkanTakt')
    expect(g.gefahr(vorher)).toBeNull()
  })
})

describe('Wiese', () => {
  it('Bienenstock: wer zu nah kommt, wird vom Schwarm verfolgt und verliert Level', () => {
    const g = welt('wiese', {}, 3, 30)
    expect(g.bienenstockSetzen()).toBe(true)
    const h = g.body[0]
    g.stoecke[0].p = { x: h.x + 2, y: h.y + 1 }
    takt(g, 'tiereTakt')
    const b = g.wesen.find((w) => w.art === 'bienen')!
    expect(b).toBeTruthy()
    b.p = { x: h.x, y: h.y + 1 }
    b.next = g.time
    const vorher = g.level
    takt(g, 'wesenTakt')
    expect(g.level).toBe(vorher - R.DEFAULTS.bienenZurueck)
    expect(g.gefahr(g.stoecke[0].p)).toBe('bienenstock')
  })

  it('Igel rollt sich ein, wenn der Kopf nah ist, und lässt sich dann nicht fressen', () => {
    const g = welt('wiese', {}, 3, 20)
    expect(g.wesenNeu('igel')).toBe(true)
    const w = g.wesen[0]
    const h = g.body[0]
    w.p = { x: h.x + 2, y: h.y }
    takt(g, 'tiereTakt')
    expect(w.kugelBis).toBeGreaterThan(g.time)
    expect(g.gefahr(w.p)).toBe('igel')
  })

  it('Maulwurfshügel kommt nie unter der Schlange hoch, danach blockiert er kurz', () => {
    const g = welt('wiese', {}, 3, 20)
    expect(g.maulwurfshuegel()).toBe(true)
    const e = g.einschlaege[0]
    const alt = g.body.map((p) => ({ ...p }))
    kopfAuf(g, e.cells[0])
    g.time = e.bis
    takt(g, 'einschlaegeTakt')
    expect(e.gefallen).toBe(false)
    g.body = alt
    g.prev = alt.map((p) => ({ ...p }))
    g.time = e.bis
    takt(g, 'einschlaegeTakt')
    expect(e.gefallen).toBe(true)
    expect(g.gefahr(e.cells[0])).toBe('huegel')
    expect(g.status).toBe('play')
  })
})

describe('Wüste: Tiere', () => {
  it('Geier stößt vor dem Kopf herab', () => {
    const g = welt('wueste', {}, 3, 30)
    expect(g.geier()).toBe(true)
    const e = g.einschlaege[0]
    kopfAuf(g, e.cells[0])
    g.time = e.bis
    takt(g, 'einschlaegeTakt')
    expect(g.cause).toBe('geier')
  })

  it('Kamelkarawane zieht quer durch, der Kopf wird überrannt', () => {
    const g = welt('wueste', {}, 3, 30)
    expect(g.karawane()).toBe(true)
    const d = g.durchzuege[0]
    g.time = d.los + 4 * d.takt
    const f = g.durchzugFelder(d)[0]
    kopfAuf(g, f)
    takt(g, 'bergwerkTakt')
    expect(g.cause).toBe('karawane')
  })

  it('Klapperschlange rasselt erst und beißt, wenn der Kopf daneben ist', () => {
    const g = welt('wueste', {}, 3, 40)
    expect(g.wesenNeu('klapperschlange')).toBe(true)
    const w = g.wesen[0]
    const h = g.body[0]
    g.events = []
    w.p = { x: h.x + 3, y: h.y }
    takt(g, 'tiereTakt')
    expect(g.events.map((e) => e.type)).toContain('rassel')
    const vorher = g.level
    w.p = { x: h.x + 1, y: h.y }
    takt(g, 'tiereTakt')
    expect(g.level).toBe(vorher - R.DEFAULTS.klapperZurueck)
  })

  it('Geier und Karawane kommen nur ab ihrem Level', () => {
    const g = welt('wueste', { geierChance: 100, karawaneChance: 100, flutChance: 0, sturmChance: 0, wurmChance: 0 }, 3, 2)
    nachApfel(g)
    expect(g.einschlaege.some((e) => e.art === 'geier')).toBe(false)
    expect(g.durchzuege.length).toBe(0)
  })
})

describe('Lange Runden', () => {
  it('Vulkan, Wiese und Wüste mit allen Tieren und Ereignissen laufen ohne Fehler', () => {
    const viel: Partial<R.Config> = {
      abbruchChance: 25, ausbruchChance: 25, lavastromChance: 25, magmawurmChance: 10, feuerregenChance: 25,
      lavafischAb: 1, lavafischChance: 40, glutgolemAb: 1, glutgolemChance: 30, brueckeAb: 1, brueckeChance: 40, obsidianAb: 1, obsidianChance: 40,
      bienenstockAb: 1, bienenstockChance: 40, igelAb: 1, igelChance: 40, huegelAb: 1, huegelChance: 40,
      geierAb: 1, geierChance: 25, karawaneAb: 1, karawaneChance: 15, klapperAb: 1, klapperChance: 40,
    }
    for (const id of ['vulkan', 'wiese', 'wueste']) {
      let aepfel = 0
      for (let seed = 1; seed <= 5; seed++) {
        const g = new Game({ screenW: SW, screenH: SH, seed, welt: id, vulkan: id === 'vulkan', wueste: id === 'wueste', startLevel: 30, cfg: viel })
        for (let i = 0; i < 3000 && g.status === 'play'; i++) {
          const d = autopilot(g)
          if (d) g.turn(d)
          g.update(16)
        }
        aepfel += g.gegessen
      }
      expect(aepfel, id).toBeGreaterThan(5)
    }
  })
})
