import { describe, expect, it } from 'vitest'
import { Jitterpuffer, WARTE_MAX, WARTE_MIN } from '../src/multi/puffer'

/** Zufall mit festem Startwert, damit der Test immer dasselbe misst */
function zufall(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}
const streuung = (xs: number[]) => {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length)
}

/** Alle 50 ms ein Stand; Weg 40 ms plus `jitter` ms Zufall; `versatz` = Uhr des Absenders geht anders */
function strom(jitter: number, n = 400, versatz = 0, luecke?: { ab: number; bis: number }) {
  const z = zufall(7)
  const p = new Jitterpuffer()
  const aus: { senden: number; empfang: number; plan: number }[] = []
  let letzter = 0
  for (let i = 0; i < n; i++) {
    const senden = 10_000 + i * 50 + versatz
    let empfang = 10_000 + i * 50 + 40 + z() * jitter
    // TCP liefert der Reihe nach: nichts kommt vor dem Vorigen
    empfang = Math.max(empfang, letzter)
    if (luecke && i * 50 >= luecke.ab && i * 50 < luecke.bis) empfang = Math.max(empfang, 10_000 + luecke.bis + 40)
    letzter = empfang
    aus.push({ senden, empfang, plan: p.plane(senden, empfang) })
  }
  return { aus, p }
}

describe('Jitterpuffer', () => {
  it('macht aus unregelmaessiger Ankunft einen gleichmaessigen Takt', () => {
    const { aus } = strom(80)
    const rest = aus.slice(100)
    const ankunft = rest.slice(1).map((x, i) => x.empfang - rest[i].empfang)
    const abspiel = rest.slice(1).map((x, i) => x.plan - rest[i].plan)
    expect(streuung(abspiel)).toBeLessThan(streuung(ankunft) * 0.5)
    // Fast alle Staende kommen vor ihrer Abspielzeit an (sonst haette der Puffer nichts gebracht)
    expect(rest.filter((x) => x.plan >= x.empfang).length / rest.length).toBeGreaterThan(0.9)
  })

  it('bleibt bei ruhigem Netz klein, bei unruhigem waechst die Wartezeit', () => {
    const ruhig = strom(2).p
    const wild = strom(150).p
    expect(ruhig.warte).toBeLessThan(WARTE_MIN + 25)
    expect(wild.warte).toBeGreaterThan(ruhig.warte + 40)
    expect(wild.warte).toBeLessThanOrEqual(WARTE_MAX)
  })

  it('die Uhr des Absenders ist egal (anderer Nullpunkt, auch riesig)', () => {
    const a = strom(40, 300, 0).aus.map((x) => x.plan - x.empfang)
    const b = strom(40, 300, 7_654_321).aus.map((x) => x.plan - x.empfang)
    a.forEach((v, i) => expect(b[i]).toBeCloseTo(v, 3))
  })

  it('nach einem Funkloch kommt alles auf einmal: nichts springt zurueck, nichts wartet ewig', () => {
    const { aus } = strom(10, 400, 0, { ab: 8000, bis: 9000 })
    for (let i = 1; i < aus.length; i++) expect(aus[i].plan).toBeGreaterThanOrEqual(aus[i - 1].plan)
    for (const x of aus) expect(x.plan - x.empfang).toBeLessThanOrEqual(WARTE_MAX * 2)
    // Eine Sekunde nach dem Loch ist der Rueckstand wieder weg
    const spaet = aus.filter((x) => x.empfang > 10_000 + 11_000)
    for (const x of spaet) expect(x.plan - x.empfang).toBeLessThan(WARTE_MAX + 20)
  })

  it('zuruecksetzen vergisst die Messung (anderer Rechner)', () => {
    const { p } = strom(100)
    expect(p.jitter).toBeGreaterThan(0)
    p.zuruecksetzen()
    expect(p.jitter).toBe(0)
    // 1. Stand: Empfangszeit + Grundwartezeit (noch keine Messung)
    expect(p.plane(5, 100)).toBe(100 + WARTE_MIN + 40)
  })
})
