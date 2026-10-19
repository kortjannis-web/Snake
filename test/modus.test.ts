import { describe, expect, it } from 'vitest'
import { DEFAULTS, takt, TEMPO } from '../src/game/rules'
import { gutschrift, modusProzent } from '../src/modus'

/** Aepfel nacheinander mit Zwischenspeicher gutschreiben */
function sammeln(werte: number[], prozent: (i: number) => number) {
  let rest = 0
  let summe = 0
  werte.forEach((w, i) => {
    const g = gutschrift(w, prozent(i), rest)
    rest = g.rest
    summe += g.ganz
  })
  return { summe, rest }
}

describe('Spielmodi: Belohnung', () => {
  it('Prozente je Modus', () => {
    expect(modusProzent('abenteuer', 1)).toBe(75)
    expect(modusProzent('abenteuer', 5)).toBe(75)
    expect(modusProzent('normal', 1)).toBe(100)
    expect(modusProzent('speedrun', 1)).toBe(125)
    expect(modusProzent('speedrun', 2)).toBe(150)
    expect(modusProzent('speedrun', 7)).toBe(150)
  })
  it('Normal zahlt genau den Wert aus, nichts bleibt liegen', () => {
    expect(sammeln([1, 1, 2, 3, 10], () => 100)).toEqual({ summe: 17, rest: 0 })
  })
  it('Abenteuer: nur volle Aepfel, der Rest wird zwischengespeichert (4 Aepfel = 3)', () => {
    let rest = 0
    const gut = [1, 1, 1, 1].map((w) => {
      const g = gutschrift(w, 75, rest)
      rest = g.rest
      return g.ganz
    })
    expect(gut).toEqual([0, 1, 1, 1])
    expect(rest).toBe(0)
    expect(sammeln(Array(100).fill(1), () => 75)).toEqual({ summe: 75, rest: 0 })
  })
  it('Abenteuer: der Zwischenspeicher bleibt ueber Runden erhalten', () => {
    const a = gutschrift(1, 75, 0)
    expect(a).toEqual({ ganz: 0, rest: 75 })
    // naechste Runde: der Rest kommt dazu
    expect(gutschrift(1, 75, a.rest)).toEqual({ ganz: 1, rest: 50 })
  })
  it('Speedrun: +25 % bei roten, +50 % ab Orange (nur volle Aepfel)', () => {
    expect(sammeln(Array(4).fill(1), () => 125)).toEqual({ summe: 5, rest: 0 })
    expect(sammeln(Array(100).fill(1), () => 125)).toEqual({ summe: 125, rest: 0 })
    // orange Aepfel zaehlen 2: 2 * 1,5 = 3
    expect(sammeln([2, 2, 2], () => 150)).toEqual({ summe: 9, rest: 0 })
    // gelb (3): 4,5 je Apfel, zwei Aepfel = 9
    expect(sammeln([3, 3], () => 150)).toEqual({ summe: 9, rest: 0 })
    expect(gutschrift(3, 150, 0)).toEqual({ ganz: 4, rest: 50 })
  })
  it('es geht nie etwas verloren: Summe aus vollen Aepfeln und Rest ist exakt', () => {
    for (const p of [75, 100, 125, 150]) {
      const werte = Array.from({ length: 237 }, (_, i) => 1 + (i % 7))
      const { summe, rest } = sammeln(werte, () => p)
      expect(summe * 100 + rest).toBe(werte.reduce((a, b) => a + b, 0) * p)
      expect(rest).toBeGreaterThanOrEqual(0)
      expect(rest).toBeLessThan(100)
    }
  })
})

describe('Spielmodi: Tempo', () => {
  it('Abenteuer ist auf jedem Level genau 25 % langsamer (75 % der Geschwindigkeit)', () => {
    for (const level of [1, 10, 50, 150, 300, 800]) {
      const n = takt(DEFAULTS, 'normal', level)
      const a = takt(DEFAULTS, 'langsam', level)
      expect(n / a).toBeCloseTo(0.75, 10)
    }
    expect(TEMPO.langsam).toBeCloseTo(205.333, 3)
  })
  it('Speedrun bleibt 25 % schneller', () => {
    expect(TEMPO.normal / TEMPO.schnell).toBeCloseTo(1.25, 2)
  })
})
