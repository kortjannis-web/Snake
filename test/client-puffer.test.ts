import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DUELL, MehrGame } from '../src/game/mehr'
import { Abgleich, zustand } from '../src/game/zustand'
import { MehrClient } from '../src/multi/client'
import { MEHR_BILD, type StartInfo, type VomServer } from '../src/multi/protokoll'

/** Nachgebautes WebSocket: merkt sich, was die App schickt, und liefert, was der Test hineinreicht */
class FakeWS {
  static OPEN = 1
  static letzter: FakeWS | null = null
  readyState = 1
  bufferedAmount = 0
  gesendet: { t: string; [k: string]: unknown }[] = []
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: ((e: { code: number }) => void) | null = null
  constructor(readonly url: string) {
    FakeWS.letzter = this
    queueMicrotask(() => this.onopen?.())
  }
  send(s: string) {
    this.gesendet.push(JSON.parse(s))
  }
  close() {
    this.readyState = 3
  }
  rein(m: VomServer) {
    this.onmessage?.({ data: JSON.stringify(m) })
  }
}

const spieler = [
  { id: 'a', name: 'Anna', skin: 'klassik' },
  { id: 'b', name: 'Ben', skin: 'klassik' },
]
const info: StartInfo = { modus: 'vs', seed: 99, spieler, rechner: 0, los: 0, tempo: 'normal', klassisch: false }
const neuesSpiel = () => new MehrGame({ screenW: MEHR_BILD.w, screenH: MEHR_BILD.h, seed: info.seed, modus: 'vs', spieler, tempo: 'normal', cfg: DUELL } as never)

async function zuschauer() {
  const ereignisse: string[] = []
  const c = new MehrClient('ws://test', () => spieler[1], (e) => ereignisse.push(e.art))
  c.verbinden('ABCDE')
  await Promise.resolve()
  const ws = FakeWS.letzter!
  ws.rein({
    t: 'raum', code: 'ABCDE', gastgeber: 'a', phase: 'spiel', modus: 'vs', tempo: 'normal', klassisch: false, ich: 1,
    spieler: spieler.map((s) => ({ ...s, online: true, bereit: true })),
  })
  ws.rein({ t: 'start', info, jetzt: 0 })
  ws.rein({ t: 'rechner', wer: 0 })
  return { c, ws, ereignisse }
}

describe('MehrClient: Jitter-Puffer fuer den gespiegelten Stand', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['performance', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] })
    vi.stubGlobal('WebSocket', FakeWS)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('zeigt Staende erst nach der Wartezeit und die Zeit springt nie zurueck', async () => {
    const { c, ws } = await zuschauer()
    const host = neuesSpiel()
    const ab = new Abgleich()
    ab.aenderungen(zustand(host, true))
    const zeiten: number[] = []
    let angekommen = 0
    // 3 s Spiel: der Rechner schickt alle 50 ms, das Netz verspaetet wild (0 bis 120 ms), aber der Reihe nach
    const pending: { an: number; m: VomServer }[] = []
    let z = 12345
    const zufall = () => (z = (z * 1664525 + 1013904223) % 4294967296) / 4294967296
    let letzteAnkunft = 0
    for (let ms = 0; ms < 3000; ms += 10) {
      if (ms % 50 === 0) {
        host.update(50)
        host.drain()
        const d = ab.aenderungen(zustand(host, false))
        const an = Math.max(letzteAnkunft, ms + 30 + zufall() * 120)
        letzteAnkunft = an
        pending.push({ an, m: { t: 'z', d: d ?? {}, s: ms + 5_000_000 } })
      }
      vi.advanceTimersByTime(10)
      while (pending.length && pending[0].an <= ms) {
        ws.rein(pending.shift()!.m)
        angekommen++
      }
      c.frame(10)
      zeiten.push(c.game!.time)
    }
    expect(angekommen).toBeGreaterThan(50)
    // Spielzeit nie zurueck (der Stand kommt knapp "vor" der gezeigten Zeit an: Zeit steht still, springt nicht)
    for (let i = 1; i < zeiten.length; i++) expect(zeiten[i]).toBeGreaterThanOrEqual(zeiten[i - 1] - 1e-6)
    // Und er laeuft dem Rechner hinterher (nicht schneller, nicht weit weg)
    expect(host.time - zeiten.at(-1)!).toBeLessThan(600)
    expect(host.time - zeiten.at(-1)!).toBeGreaterThan(-300)
  })

  it('schickt den Stand mit Sendezeit und ueberspringt ihn bei Stau (Ereignisse nie)', async () => {
    const ereignisse: string[] = []
    const c = new MehrClient('ws://test', () => spieler[0], (e) => ereignisse.push(e.art))
    c.verbinden('ABCDE')
    await Promise.resolve()
    const ws = FakeWS.letzter!
    ws.rein({ t: 'raum', code: 'ABCDE', gastgeber: 'a', phase: 'spiel', modus: 'vs', tempo: 'normal', klassisch: false, ich: 0, spieler: spieler.map((s) => ({ ...s, online: true, bereit: true })) })
    ws.rein({ t: 'start', info, jetzt: 0 })
    ws.rein({ t: 'rechner', wer: 0 })
    expect(c.istRechner).toBe(true)
    expect(ws.gesendet.find((m) => m.t === 'z')?.voll).toBe(true)
    ws.gesendet.length = 0
    vi.advanceTimersByTime(100)
    c.frame(16)
    const z1 = ws.gesendet.filter((m) => m.t === 'z')
    expect(z1.length).toBeGreaterThan(0)
    expect(typeof z1[0].s).toBe('number')
    // Stau im Browser: Staende werden uebersprungen
    ws.gesendet.length = 0
    ws.bufferedAmount = 64 * 1024
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(60)
      c.frame(16)
    }
    expect(ws.gesendet.filter((m) => m.t === 'z')).toHaveLength(0)
    expect(c.stat.uebersprungen).toBeGreaterThan(5)
    // Stau weg: alles Aufgelaufene kommt im naechsten Stand
    ws.bufferedAmount = 0
    vi.advanceTimersByTime(60)
    c.frame(16)
    const danach = ws.gesendet.filter((m) => m.t === 'z')
    expect(danach).toHaveLength(1)
    expect(Object.keys(danach[0].d as object)).toContain('time')
  })
})
