import { describe, expect, it } from 'vitest'
import { BossGame, GOLEM, missionSpiel, RAUM_H } from '../src/game/boss'
import { MissionGame } from '../src/game/mission'
import { WIESE_MISSIONEN } from '../src/game/missionen'
import type { P } from '../src/game/types'

const boss = WIESE_MISSIONEN[9]

/** Boss-Spiel, in dem die Schlange still steht (fuer genaue Tests der Attacken) */
function still(): BossGame {
  const g = new BossGame(boss)
  g.tick = 1e12
  return g
}
const lauf = (g: BossGame, ms: number) => {
  for (let t = 0; t < ms; t += 20) g.update(20)
}
const setzeSchlange = (g: BossGame, kopf: P) => {
  g.body = [kopf, { x: kopf.x, y: kopf.y + 1 }, { x: kopf.x, y: kopf.y + 2 }]
  g.prev = g.body.map((p) => ({ ...p }))
}
const sammle = (g: BossGame, p: P) => (g as unknown as { einsammeln(p: P): void }).einsammeln(p)
/** Feld im aktuellen Raum, y von dessen oberem Rand gezaehlt */
const imRaum = (g: BossGame, x: number, y: number): P => ({ x, y: g.aktuell.y0 + y })
/** Golem steht laufbereit an dieser Stelle des aktuellen Raums */
const golemBei = (g: BossGame, x: number, y: number) => {
  g.golem.x = x
  g.golem.y = g.aktuell.y0 + y
  g.golem.zustand = 'laufen'
  g.golem.bis = g.time + 1e9
}
/** Alle Sockel des Raums leuchten, der Golem steht im Kreis: gebannt */
const bannen = (g: BossGame) => {
  for (const s of g.sockel) s.an = true
  g.golem.kreisPause = 0
  g.golem.x = g.kreis.p.x
  g.golem.y = g.kreis.p.y
  g.golem.zustand = 'laufen'
  g.golem.bis = g.time + 1e9
  lauf(g, 40)
}

describe('Boss: Steingolem', () => {
  it('Mission 10 ist der Boss: drei Raeume uebereinander mit 3, 4 und 6 Sockeln, je ein Bannkreis und ein Tor dazwischen', () => {
    const g = missionSpiel(boss)
    expect(g).toBeInstanceOf(BossGame)
    expect(missionSpiel(WIESE_MISSIONEN[0])).toBeInstanceOf(MissionGame)
    const b = g as BossGame
    expect(b.w).toBe(17)
    expect(b.h).toBe(3 * RAUM_H)
    expect(b.raeume).toHaveLength(3)
    expect(b.raeume.map((r) => r.sockel.length)).toEqual([3, 4, 6])
    expect(b.raeume.map((r) => r.sockel.map((s) => s.farbe))).toEqual([[0, 1, 2], [0, 1, 2, 3], [0, 1, 2, 3, 4, 5]])
    expect(b.raeume.map((r) => !!r.tor)).toEqual([true, true, false])
    // Raum 3 hat feste Plaetze fuer Kristalle (in Kammern und Gassen)
    expect(b.raeume[2].plaetze.length).toBeGreaterThanOrEqual(6)
    // Ein Raum passt ganz ins Bild
    expect(b.screenW + 2).toBeGreaterThanOrEqual(b.w)
    expect(b.screenH + 2).toBeGreaterThanOrEqual(RAUM_H)
    expect(b.raumNr).toBe(0)
    for (const c of b.body) expect(b.imRaum(c)).toBe(true)
    for (const c of b.golemFelder()) expect(b.imRaum(c)).toBe(true)
    expect(b.leben).toBe(3)
    expect(b.golem.hp).toBe(3)
  })

  it('geschlossene Tore sind wie Wand', () => {
    const g = still()
    const tor = g.raeume[0].tor!.cells[0]
    expect(g.torZu(tor)).toBe(true)
    expect(g.gefahr(tor)).toBe('steintor')
  })

  it('der Golem erwacht und stapft auf die Schlange zu', () => {
    const g = still()
    setzeSchlange(g, imRaum(g, 8, 26))
    lauf(g, 100)
    expect(g.golem.zustand).toBe('erwachen')
    const vorher = Math.abs(g.golem.y - g.body[0].y)
    lauf(g, GOLEM.erwachen + 900)
    expect(['laufen', 'stampfen', 'ansturm', 'sprung']).toContain(g.golem.zustand)
    expect(Math.abs(g.golem.y - g.body[0].y)).toBeLessThan(vorher)
  })

  it('nur drei Attacken: Stampfen, Ansturm, Sprung', () => {
    const g = still()
    setzeSchlange(g, imRaum(g, 8, 26))
    const arten = new Set<string>()
    for (let i = 0; i < 4000 && g.status === 'play'; i++) {
      g.schutzBis = 1e12
      g.update(25)
      if (g.golem.angriff) arten.add(g.golem.angriff.art)
    }
    expect([...arten].sort()).toEqual(['ansturm', 'sprung', 'stampfen'])
  })

  it('Stampfen trifft im Kreis: ein Herz weniger, danach kurz geschuetzt', () => {
    const g = still()
    setzeSchlange(g, imRaum(g, 8, 16))
    golemBei(g, 8, 13)
    g.starte('stampfen')
    lauf(g, GOLEM.stampfenWarn - 100)
    expect(g.leben).toBe(3)
    lauf(g, 300)
    expect(g.leben).toBe(2)
    expect(g.schutzBis).toBeGreaterThan(g.time)
    // Ausserhalb des Kreises passiert nichts
    const h = still()
    setzeSchlange(h, imRaum(h, 8, 25))
    golemBei(h, 8, 13)
    h.starte('stampfen')
    lauf(h, GOLEM.stampfenWarn + 200)
    expect(h.leben).toBe(3)
  })

  it('Ansturm: rennt bis zur Wand, prallt auf, Brocken fallen', () => {
    const g = still()
    golemBei(g, 8, 6)
    setzeSchlange(g, imRaum(g, 8, 20))
    g.starte('ansturm')
    lauf(g, GOLEM.ansturmWarn + 2500)
    expect(g.leben).toBe(2)
    expect(g.golem.y).toBeGreaterThan(g.aktuell.y0 + 20)
    expect(['benommen', 'laufen']).toContain(g.golem.zustand)
    expect(g.brocken.length).toBeGreaterThan(0)
    for (const b of g.brocken) expect(g.imRaum(b.p)).toBe(true)
    // Er bleibt in seinem Raum (rennt nicht durch das Tor)
    for (const c of g.golemFelder()) expect(g.imRaum(c)).toBe(true)
  })

  it('Sprung: der Kreis folgt der Schlange, bleibt stehen, dort landet der Golem', () => {
    const g = still()
    golemBei(g, 8, 6)
    setzeSchlange(g, imRaum(g, 4, 22))
    g.starte('sprung')
    lauf(g, GOLEM.sprungDuck + GOLEM.sprungAuf + 200)
    expect(g.fliegt).toBe(true)
    lauf(g, GOLEM.sprungZielen + 200)
    const a = g.golem.angriff!
    expect(a.art).toBe('sprung')
    if (a.art === 'sprung') expect(Math.hypot(a.ziel.x - 4, a.ziel.y - (g.aktuell.y0 + 22))).toBeLessThan(1)
    // Rechtzeitig weg: kein Treffer
    setzeSchlange(g, imRaum(g, 12, 10))
    lauf(g, GOLEM.sprungHalt + GOLEM.sprungFall + 200)
    expect(g.leben).toBe(3)
    expect(g.fliegt).toBe(false)
    expect(Math.hypot(g.golem.x - 4, g.golem.y - (g.aktuell.y0 + 22))).toBeLessThan(2)
  })

  it('Raum 1: drei Kristalle zum Sockel gleicher Farbe, dann bannt der Kreis den Golem, durch ihn hindurch = Treffer', () => {
    const g = still()
    setzeSchlange(g, imRaum(g, 8, 27))
    lauf(g, 800)
    expect(g.kristalle).toHaveLength(3)
    for (const k of g.kristalle) expect(g.imRaum(k.p)).toBe(true)
    for (const k of [...g.kristalle]) sammle(g, k.p)
    expect(g.traegt).toHaveLength(3)
    // Ein falscher Sockel nimmt nichts: mit nur einem Kristall auf einen anderen Sockel
    const [erst] = g.traegt
    const falsch = g.sockel.find((s) => s.farbe !== erst)!
    g.traegt = [erst]
    sammle(g, falsch.p)
    expect(falsch.an).toBe(false)
    g.traegt = [0, 1, 2]
    for (const s of g.sockel) sammle(g, s.p)
    expect(g.kreisAktiv).toBe(true)
    // Golem in den Kreis
    g.golem.x = g.kreis.p.x
    g.golem.y = g.kreis.p.y
    g.golem.zustand = 'laufen'
    g.golem.bis = g.time + 5000
    lauf(g, 40)
    expect(g.golem.zustand).toBe('gebannt')
    expect(g.verwundbar).toBe(true)
    sammle(g, { x: Math.round(g.golem.x), y: Math.round(g.golem.y) + 1 })
    expect(g.golem.hp).toBe(2)
    expect(g.golem.zustand).toBe('getroffen')
  })

  it('nach dem Treffer: Golem springt in Raum 2, das Tor geht auf, hinter der Schlange wieder zu, dann geht es weiter', () => {
    const g = still()
    setzeSchlange(g, imRaum(g, 8, 27))
    bannen(g)
    sammle(g, { x: Math.round(g.golem.x), y: Math.round(g.golem.y) })
    lauf(g, GOLEM.getroffen + 60)
    expect(g.golem.zustand).toBe('wechsel')
    expect(g.raumNr).toBe(1)
    expect(g.sockel).toHaveLength(4)
    expect(g.raeume[0].tor!.offen).toBe(true)
    expect(g.gefahr(g.raeume[0].tor!.cells[0])).not.toBe('steintor')
    lauf(g, GOLEM.sprungDuck + GOLEM.wechselAuf + GOLEM.wechselFlug + GOLEM.sprungFall + 200)
    expect(g.golem.zustand).toBe('wartet')
    for (const c of g.golemFelder()) expect(g.imRaum(c, 1)).toBe(true)
    // Solange die Schlange nicht im Raum ist: keine Kristalle, kein Angriff
    lauf(g, 3000)
    expect(g.golem.zustand).toBe('wartet')
    expect(g.kristalle).toHaveLength(0)
    // Schlange faehrt durch das Tor in Raum 2
    setzeSchlange(g, imRaum(g, 8, 26))
    lauf(g, 40)
    expect(g.golem.zustand).toBe('zorn')
    expect(g.raeume[0].tor!.offen).toBe(false)
    expect(g.golem.phase).toBe(1)
    lauf(g, GOLEM.zorn + GOLEM.kristallPause + 200)
    expect(g.kristalle.length).toBeGreaterThan(0)
    for (const k of g.kristalle) expect(g.imRaum(k.p, 1)).toBe(true)
  })

  it('Raum 3: die Kristalle liegen an festen Plaetzen in Kammern und Gassen', () => {
    const g = still()
    g.raumNr = 2
    setzeSchlange(g, imRaum(g, 8, 16))
    golemBei(g, 8, 6)
    lauf(g, 800)
    expect(g.kristalle).toHaveLength(3)
    for (const k of g.kristalle) expect(g.aktuell.plaetze.some((p) => p.x === k.p.x && p.y === k.p.y)).toBe(true)
  })

  it('ohne aktiven Bannkreis kostet die Beruehrung ein Herz, drei Herzen weg = vorbei', () => {
    const g = still()
    g.golem.zustand = 'laufen'
    g.golem.bis = 1e9
    for (let i = 0; i < 3; i++) {
      setzeSchlange(g, { x: Math.round(g.golem.x), y: Math.round(g.golem.y) })
      g.schutzBis = 0
      lauf(g, 40)
    }
    expect(g.leben).toBe(0)
    expect(g.status).toBe('over')
    expect(g.cause).toBe('steingolem')
  })

  it('je Raum ein Treffer: nach dem dritten zerfaellt der Golem, Mission geschafft', () => {
    const g = still()
    for (let i = 0; i < 3; i++) {
      setzeSchlange(g, imRaum(g, 8, 27))
      bannen(g)
      expect(g.golem.zustand).toBe('gebannt')
      sammle(g, { x: Math.round(g.golem.x), y: Math.round(g.golem.y) })
      lauf(g, GOLEM.getroffen + 60)
      if (i < 2) {
        lauf(g, GOLEM.sprungDuck + GOLEM.wechselAuf + GOLEM.wechselFlug + GOLEM.sprungFall + 200)
        expect(g.raumNr).toBe(i + 1)
        setzeSchlange(g, imRaum(g, 8, 27))
        lauf(g, GOLEM.zorn + 100)
      }
    }
    expect(g.golem.hp).toBe(0)
    expect(g.golem.zustand).toBe('tot')
    expect(g.status).toBe('play')
    lauf(g, GOLEM.tot + 100)
    expect(g.status).toBe('over')
    expect(g.cause).toBe('ziel')
  })

  it('laeuft bei gleicher Steuerung immer gleich ab', () => {
    const ablauf = () => {
      const g = new BossGame(boss)
      const log: string[] = []
      for (let i = 0; i < 600 && g.status === 'play'; i++) {
        // Einfache Steuerung: im Kreis durch den ersten Raum
        const h = g.body[0]
        const y = h.y - g.aktuell.y0
        if (y < 6 && g.dir === 'u') g.turn('r', false)
        if (h.x > 12 && g.dir === 'r') g.turn('d', false)
        if (y > 25 && g.dir === 'd') g.turn('l', false)
        if (h.x < 4 && g.dir === 'l') g.turn('u', false)
        g.update(25)
        log.push(`${g.golem.zustand}:${g.golem.x.toFixed(2)},${g.golem.y.toFixed(2)}:${g.leben}`)
      }
      return log.join('|')
    }
    expect(ablauf()).toBe(ablauf())
  })
})

describe('Boss: ein Bot kann ihn besiegen', () => {
  it('weicht aus, bringt Kristalle, lockt den Golem in den Kreis, folgt ihm durch die Tore: drei Raeume in ein paar Minuten', async () => {
    const { botZug } = await import('./boss-bot')
    const ergebnis: string[] = []
    let siege = 0
    for (const seed of [0x5eed10, 1, 2, 3]) {
      const g = new BossGame({ ...boss, seed })
      let ms = 0
      while (g.status === 'play' && ms < 8 * 60_000) {
        const d = botZug(g)
        if (d && d !== g.dir && !g.queue.length) g.turn(d, false)
        g.update(16)
        ms += 16
        g.drain()
      }
      if (g.cause === 'ziel') siege++
      ergebnis.push(`${g.cause} ${(ms / 1000).toFixed(0)} s, ${g.leben} Herzen, Raum ${g.raumNr + 1}, Golem ${g.golem.hp}`)
    }
    console.log('Boss-Bot:', ergebnis.join(' | '))
    expect(siege).toBeGreaterThanOrEqual(3)
  })
})
