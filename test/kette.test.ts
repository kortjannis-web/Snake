import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RaumLogik, type Kanal } from '../server/raum'
import { autopilot } from '../src/game/autopilot'
import type { MehrGame } from '../src/game/mehr'
import { MehrClient } from '../src/multi/client'
import { PROTOKOLL } from '../src/multi/protokoll'

/** Verbindung App <-> Server im Speicher: was die App schickt, landet sofort beim Raum und umgekehrt */
let raum: RaumLogik
class Leitung {
  static OPEN = 1
  readyState = 1
  bufferedAmount = 0
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: ((e: { code: number }) => void) | null = null
  gesendet: string[] = []
  private kanal: Kanal
  constructor(url: string) {
    const q = new URL(url.replace(/^ws/, 'http')).searchParams
    this.kanal = { send: (s) => queueMicrotask(() => this.onmessage?.({ data: s })), close: () => {} }
    queueMicrotask(() => {
      raum.beitreten(this.kanal, { id: q.get('id')!, name: q.get('name')!, skin: 'klassik', v: Number(q.get('v')) })
      this.onopen?.()
    })
  }
  send(s: string) {
    this.gesendet.push(s)
    raum.nachricht(this.kanal, s)
  }
  close() {}
}

const warten = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

describe('Ganze Kette: Rechner -> Server -> Zuschauer (kompakt, mit Jitter-Puffer)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['performance', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] })
    vi.stubGlobal('WebSocket', Leitung)
    raum = new RaumLogik('ABCDE', () => performance.now(), () => 0.25)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('der Zuschauer hat am Ende genau die Schlangen des Rechners', async () => {
    const rechner = new MehrClient('ws://x', () => ({ id: 'a', name: 'Anna', skin: 'klassik' }), () => {})
    const zuschauer = new MehrClient('ws://x', () => ({ id: 'b', name: 'Ben', skin: 'klassik' }), () => {})
    rechner.verbinden('ABCDE')
    await warten()
    zuschauer.verbinden('ABCDE')
    await warten()
    rechner.senden({ t: 'einstellung', klassisch: false })
    zuschauer.bereit(true)
    await warten()
    rechner.starten()
    await warten()
    expect(rechner.istRechner).toBe(true)
    expect(PROTOKOLL).toBe(3)
    // 3 s Countdown, dann 20 s spielen: beide Schlangen fahren mit Autopilot
    for (let t = 0; t < 23_000; t += 16) {
      vi.advanceTimersByTime(16)
      const g = rechner.game as MehrGame
      if (rechner.laeuft && g.status === 'play')
        for (let i = 0; i < 2; i++) {
          g.wechsel(i)
          if (!g.queue.length) {
            const d = autopilot(g)
            if (d) g.lenke(i, d)
          }
        }
      rechner.frame(16)
      await warten()
      zuschauer.frame(16)
    }
    // Rechner haelt an, der Zuschauer spielt seinen Puffer zu Ende
    for (let t = 0; t < 600; t += 16) {
      vi.advanceTimersByTime(16)
      await warten()
      zuschauer.frame(16)
    }
    const server = raum.zustand.schlangen as { body: unknown; prev: unknown; aepfel: number; leben: number }[]
    const z = zuschauer.game as MehrGame
    z.sichern()
    const bytes = (rechner as unknown as { ws: Leitung }).ws.gesendet.filter((s) => s.startsWith('{"t":"z"')).reduce((a, s) => a + s.length, 0)
    expect(bytes).toBeGreaterThan(0)
    const gegessen = server.reduce((a, s) => a + s.aepfel, 0)
    expect(gegessen).toBeGreaterThan(0)
    const r = rechner.game as MehrGame
    r.sichern()
    z.schlangen.forEach((s, i) => {
      expect(r.schlangen[i].body).toEqual(server[i].body)
      expect(s.body).toEqual(server[i].body)
      expect(s.prev).toEqual(server[i].prev)
      expect(s.aepfel).toBe(server[i].aepfel)
      expect(s.leben).toBe(server[i].leben)
    })
  }, 60_000)
})
