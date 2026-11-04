/**
 * Ende-zu-Ende ohne echtes Netz: mehrere Apps (MehrClient) und der Raum des Servers (RaumLogik), dazwischen
 * eine Leitung mit Laufzeit. Prueft, dass die eigene Schlange sofort abbiegt (wie offline), dass alle Handys
 * und der Server dasselbe Spiel ausrechnen und dass Wischer trotz Laufzeit im richtigen Schritt gelten.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MehrGame } from '../src/game/mehr'
import type { Dir } from '../src/game/types'
import { zustand } from '../src/game/zustand'
import { MehrClient } from '../src/multi/client'
import { COUNTDOWN, SIM_MS, type StartInfo } from '../src/multi/protokoll'
import { reihenfolge, spielBauen, type Eingabe } from '../src/multi/sim'
import { RaumLogik, type Kanal } from '../server/raum'

/** Laufzeit je Richtung (ms) fuer das naechste Handy, das sich verbindet */
let laufzeit = { hin: 40, zurueck: 40 }
let raum: RaumLogik

/** WebSocket der App, verbunden mit dem Raum ueber eine Leitung mit Laufzeit */
class LeitungWS {
  static OPEN = 1
  readyState = 1
  bufferedAmount = 0
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: ((e: { code: number }) => void) | null = null
  private kanal: Kanal
  private zeit = { ...laufzeit }
  constructor(url: string) {
    const q = new URL(url.replace(/^ws/, 'http')).searchParams
    this.kanal = {
      send: (s) => setTimeout(() => this.readyState === 1 && this.onmessage?.({ data: s }), this.zeit.zurueck),
      close: () => {
        this.readyState = 3
      },
    }
    setTimeout(() => {
      raum.beitreten(this.kanal, { id: q.get('id')!, name: q.get('name')!, skin: q.get('skin')!, v: Number(q.get('v')) })
      this.onopen?.()
    }, 1)
  }
  send(s: string) {
    setTimeout(() => raum.nachricht(this.kanal, s), this.zeit.hin)
  }
  close() {
    this.readyState = 3
  }
}

const SPIELER = ['a', 'b', 'c'].map((id) => ({ id, name: `Name ${id}`, skin: 'klassik' }))

function aufbauen(zeiten: { hin: number; zurueck: number }[], modus = 'jagd') {
  raum = new RaumLogik('ABCDE', () => performance.now(), () => 0.25)
  const takt = setInterval(() => raum.takt(), 25)
  const apps = zeiten.map((z, i) => {
    laufzeit = z
    const ereignisse: string[] = []
    const c = new MehrClient('ws://test', () => SPIELER[i], (e) => ereignisse.push(e.art === 'spiel' ? `spiel:${e.e.type}` : e.art))
    c.verbinden('ABCDE')
    vi.advanceTimersByTime(1000)
    return { c, ereignisse }
  })
  const gast = apps[0].c
  gast.modus(modus as never)
  vi.advanceTimersByTime(1000)
  for (const a of apps.slice(1)) a.c.bereit(true)
  vi.advanceTimersByTime(1000)
  gast.starten()
  vi.advanceTimersByTime(1000)
  expect(apps.every((a) => a.c.start)).toBe(true)
  return { apps, takt }
}

/** Zeit vergehen lassen, jede App zeichnet alle 16 ms einen Frame */
function laufen(apps: { c: MehrClient }[], ms: number, jeFrame?: (t: number) => void) {
  for (let t = 0; t < ms; t += 16) {
    vi.advanceTimersByTime(16)
    jeFrame?.(t)
    for (const a of apps) a.c.frame(16)
  }
}

/** Das Spiel, wie es nach `n` Schritten mit allen vom Server angenommenen Wischern sein muss */
function soll(info: StartInfo, eingaben: Eingabe[], n: number): MehrGame {
  const g = spielBauen(info)
  const liste = [...eingaben].sort(reihenfolge)
  let k = 0
  for (let s = 0; s < n; s++) {
    while (k < liste.length && liste[k].n <= s) g.lenke(liste[k].wer, liste[k++].d)
    g.update(SIM_MS)
    g.drain()
  }
  return g
}
/** Vergleich ohne die Spielzeit (die App zeichnet mit der Zeit zwischen zwei Schritten) */
const stand = (g: MehrGame) => {
  const z = zustand(g, true)
  delete z.time
  return JSON.stringify(z)
}

describe('Online wie offline: Server rechnet, Apps rechnen voraus', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['performance', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Date'] })
    vi.stubGlobal('WebSocket', LeitungWS)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('die eigene Schlange biegt im selben Frame ab, trotz 120 ms Laufzeit', () => {
    const { apps, takt } = aufbauen([{ hin: 30, zurueck: 30 }, { hin: 120, zurueck: 120 }])
    const b = apps[1].c
    laufen(apps, COUNTDOWN + 500)
    expect(b.laeuft).toBe(true)
    const g = b.game!
    g.wechsel(1)
    const vorher = g.dir
    const neu: Dir = vorher === 'u' || vorher === 'd' ? 'l' : 'u'
    b.lenke(neu)
    // Sofort (ohne Netz, ohne Frame): Richtung oder Warteschlange zeigt die neue Richtung
    g.wechsel(1)
    expect(g.dir === neu || g.queue.includes(neu)).toBe(true)
    // Nach der Laufzeit hin und zurueck: der Server hat den Wischer im selben Schritt angenommen, nichts wird korrigiert
    laufen(apps, 600)
    expect(b.stat.zuSpaet).toBe(0)
    expect(b.stat.korrektur).toBe(0)
    clearInterval(takt)
  })

  it('alle Apps und der Server rechnen genau dasselbe Spiel, auch mit wilden Wischern und ungleicher Laufzeit', () => {
    const { apps, takt } = aufbauen([{ hin: 15, zurueck: 25 }, { hin: 80, zurueck: 60 }, { hin: 140, zurueck: 110 }])
    let z = 7
    const zufall = () => (z = (z * 1664525 + 1013904223) % 4294967296) / 4294967296
    const dirs: Dir[] = ['u', 'd', 'l', 'r']
    laufen(apps, COUNTDOWN)
    laufen(apps, 20_000, (t) => {
      if (t % 96 === 0) {
        const a = apps[Math.floor(zufall() * apps.length)]
        a.c.lenke(dirs[Math.floor(zufall() * 4)])
      }
    })
    expect(gesammelt.length).toBeGreaterThan(100)
    // Ruhe: keine Wischer mehr, bis alles angekommen ist
    laufen(apps, 1000)
    const info = apps[0].c.start!
    for (const a of apps) expect((a.c as unknown as { eingaben: Eingabe[] }).eingaben.every((e) => e.q !== Infinity)).toBe(true)
    // Jede App ist (je nach ihrer Uhr) bei ihrem Schritt genau dort, wo das Spiel mit allen angenommenen Wischern sein muss
    for (const a of apps) {
      const h = (a.c as unknown as { schritt: number }).schritt
      expect(stand(a.c.game!)).toBe(stand(soll(info, gesammelt, h)))
    }
    // Der Server (VERZUG_MS hinter der Echtzeit) auch
    expect(stand(raum.spiel!)).toBe(stand(soll(info, gesammelt, raum.schritt)))
    // Kein Wischer kam zu spaet (Laufzeit unter VERZUG_MS)
    for (const a of apps) expect(a.c.stat.zuSpaet).toBe(0)
    clearInterval(takt)
  })

  it('ein Wischer, der zu spaet beim Server ist (riesige Laufzeit), gilt spaeter: die App korrigiert sich und bleibt gleich mit allen', () => {
    const { apps, takt } = aufbauen([{ hin: 20, zurueck: 20 }, { hin: 350, zurueck: 350 }])
    laufen(apps, COUNTDOWN + 300)
    const b = apps[1].c
    for (let i = 0; i < 6; i++) {
      b.lenke((['u', 'l', 'd', 'r'] as Dir[])[i % 4])
      laufen(apps, 300)
    }
    laufen(apps, 1500)
    expect(b.stat.zuSpaet).toBeGreaterThan(0)
    const info = b.start!
    for (const a of apps) expect(stand(a.c.game!)).toBe(stand(soll(info, gesammelt, (a.c as unknown as { schritt: number }).schritt)))
    clearInterval(takt)
  })

  it('nach 3 s im Hintergrund holt die App auf und ist wieder gleich mit allen; Toene kommen nicht doppelt', () => {
    const { apps, takt } = aufbauen([{ hin: 30, zurueck: 30 }, { hin: 50, zurueck: 50 }])
    laufen(apps, COUNTDOWN + 2000)
    // App b zeichnet 3 s lang nicht (im Hintergrund), die Nachrichten kommen trotzdem an
    laufen([apps[0]], 3000)
    laufen(apps, 1000)
    const info = apps[0].c.start!
    for (const a of apps) expect(stand(a.c.game!)).toBe(stand(soll(info, gesammelt, (a.c as unknown as { schritt: number }).schritt)))
    // Jeder gegessene Apfel genau einmal gemeldet (beim Neurechnen nicht noch einmal)
    for (const a of apps) {
      const g = a.c.game!
      g.sichern()
      const gegessen = g.schlangen.reduce((n, s) => n + s.aepfel, 0)
      expect(a.ereignisse.filter((e) => e === 'spiel:eat').length).toBe(gegessen)
    }
    clearInterval(takt)
  })
})

/** Alle Wischer, die der Server verteilt (mitgeschnitten an der Raumlogik) */
let gesammelt: Eingabe[] = []
const original = RaumLogik.prototype.nachricht
RaumLogik.prototype.nachricht = function (k: Kanal, text: string) {
  const vorher = this.eingaben.length
  original.call(this, k, text)
  if (this.eingaben.length > vorher) gesammelt.push({ ...this.eingaben[this.eingaben.length - 1] })
}
beforeEach(() => {
  gesammelt = []
})
