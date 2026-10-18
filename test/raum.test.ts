import { describe, expect, it } from 'vitest'
import { RaumLogik, type Kanal } from '../server/raum'
import { COUNTDOWN, PROTOKOLL, RECHNER_STILL, type VomServer } from '../src/multi/protokoll'

/** Nachgebaute Verbindung: merkt sich alles, was der Server schickt */
class Fake implements Kanal {
  bekommen: VomServer[] = []
  zu = false
  send(s: string) {
    this.bekommen.push(JSON.parse(s))
  }
  close() {
    this.zu = true
  }
  letzte<T extends VomServer['t']>(t: T) {
    return [...this.bekommen].reverse().find((m) => m.t === t) as Extract<VomServer, { t: T }> | undefined
  }
  alle<T extends VomServer['t']>(t: T) {
    return this.bekommen.filter((m) => m.t === t) as Extract<VomServer, { t: T }>[]
  }
}

function raum() {
  let jetzt = 1000
  const r = new RaumLogik('ABCDE', () => jetzt, () => 0.5)
  const uhr = (ms: number) => (jetzt += ms)
  const rein = (id: string, v = PROTOKOLL) => {
    const k = new Fake()
    const ok = r.beitreten(k, { id, name: `Name ${id}`, skin: 'klassik', v })
    return { k, ok }
  }
  return { r, uhr, rein }
}
const sag = (r: RaumLogik, k: Kanal, m: object) => r.nachricht(k, JSON.stringify(m))

describe('Raum: Beitreten', () => {
  it('wer zuerst kommt, ist Gastgeber; alle sehen die Spielerliste', () => {
    const { rein } = raum()
    const a = rein('a')
    const b = rein('b')
    expect(a.k.letzte('raum')?.gastgeber).toBe('a')
    expect(b.k.letzte('raum')?.spieler.map((s) => s.id)).toEqual(['a', 'b'])
    expect(b.k.letzte('raum')?.ich).toBe(1)
  })

  it('lehnt alte Versionen, einen vollen Raum und Nachzuegler im laufenden Spiel ab', () => {
    const { r, rein } = raum()
    const alt = rein('x', PROTOKOLL - 1)
    expect(alt.ok).toBe(false)
    expect(alt.k.zu).toBe(true)
    expect(alt.k.letzte('fehler')?.text).toMatch(/aktualisiere/)
    const a = rein('a')
    rein('b')
    rein('c')
    rein('d')
    expect(rein('e').ok).toBe(false)
    sag(r, a.k, { t: 'start' })
    expect(r.phase).toBe('spiel')
    // Neuer Spieler: nein. Wer schon dabei war (Funkloch): ja
    const neu = new RaumLogik('X', () => 0)
    expect(neu.beitreten(new Fake(), { id: 'q', name: 'Qu', skin: '', v: PROTOKOLL })).toBe(true)
  })

  it('nach einem Funkloch kommt man ins laufende Spiel zurueck und bekommt den Stand', () => {
    const { r, rein } = raum()
    const a = rein('a')
    const b = rein('b')
    sag(r, a.k, { t: 'start' })
    sag(r, a.k, { t: 'z', d: { level: 3, time: 10 }, voll: true })
    r.verlassen(b.k)
    expect(rein('neu').ok).toBe(false)
    const b2 = rein('b')
    expect(b2.ok).toBe(true)
    expect(b2.k.letzte('start')?.info.modus).toBe('vs')
    expect(b2.k.letzte('voll')?.z).toEqual({ level: 3, time: 10 })
  })
})

describe('Raum: Spiel auf einem Feld', () => {
  it('nur der Gastgeber startet, mit mindestens 2 Spielern; er rechnet', () => {
    const { r, rein } = raum()
    const a = rein('a')
    sag(r, a.k, { t: 'start' })
    expect(r.phase).toBe('lobby')
    expect(a.k.letzte('fehler')?.text).toMatch(/mindestens 2/)
    const b = rein('b')
    sag(r, b.k, { t: 'start' })
    expect(r.phase).toBe('lobby')
    sag(r, a.k, { t: 'modus', modus: 'koop' })
    sag(r, a.k, { t: 'start' })
    const s = b.k.letzte('start')!
    expect(s.info.modus).toBe('koop')
    expect(s.info.rechner).toBe(0)
    expect(s.info.spieler.map((p) => p.id)).toEqual(['a', 'b'])
    expect(s.info.los - s.jetzt).toBe(COUNTDOWN)
  })

  it('der Rechner verteilt den Stand, Wischer gehen an den Rechner', () => {
    const { r, rein } = raum()
    const a = rein('a')
    const b = rein('b')
    sag(r, a.k, { t: 'start' })
    sag(r, a.k, { t: 'z', d: { level: 1, schlangen: [1] }, voll: true })
    sag(r, a.k, { t: 'z', d: { level: 2 } })
    expect(b.k.alle('z').length).toBe(2)
    expect(r.zustand).toEqual({ level: 2, schlangen: [1] })
    // Nicht-Rechner duerfen keinen Stand schicken
    sag(r, b.k, { t: 'z', d: { level: 99 } })
    expect(r.zustand.level).toBe(2)
    sag(r, b.k, { t: 'dir', d: 'u' })
    expect(a.k.letzte('dir')).toEqual({ t: 'dir', wer: 1, d: 'u' })
  })

  it('faellt der Rechner aus, rechnet das naechste Geraet mit dem letzten Stand weiter', () => {
    const { r, rein } = raum()
    const a = rein('a')
    const b = rein('b')
    const c = rein('c')
    sag(r, a.k, { t: 'start' })
    sag(r, a.k, { t: 'z', d: { level: 5, time: 999 }, voll: true })
    r.verlassen(a.k)
    expect(r.rechner).toBe(1)
    expect(c.k.letzte('rechner')?.wer).toBe(1)
    expect(b.k.letzte('voll')?.z).toEqual({ level: 5, time: 999 })
  })

  it('schickt der Rechner zu lange nichts (App im Hintergrund), uebernimmt ein anderer', () => {
    const { r, uhr, rein } = raum()
    const a = rein('a')
    const b = rein('b')
    sag(r, a.k, { t: 'start' })
    uhr(COUNTDOWN)
    sag(r, a.k, { t: 'z', d: { level: 1 }, voll: true })
    uhr(RECHNER_STILL - 100)
    r.takt()
    expect(r.rechner).toBe(0)
    uhr(200)
    r.takt()
    expect(r.rechner).toBe(1)
    expect(b.k.letzte('voll')?.z).toEqual({ level: 1 })
    // Mit "abgabe" sofort zurueck
    sag(r, b.k, { t: 'abgabe' })
    expect(r.rechner).toBe(0)
  })

  it('Ende und Nochmal', () => {
    const { r, rein } = raum()
    const a = rein('a')
    const b = rein('b')
    sag(r, a.k, { t: 'start' })
    sag(r, a.k, { t: 'ende', ergebnis: { sieger: 1, reihenfolge: [1, 0] } })
    expect(b.k.letzte('ende')?.ergebnis.sieger).toBe(1)
    expect(r.phase).toBe('ende')
    sag(r, a.k, { t: 'nochmal' })
    expect(r.phase).toBe('lobby')
    expect(b.k.letzte('raum')?.phase).toBe('lobby')
  })
})

describe('Raum: Wettrennen', () => {
  function rennen() {
    const x = raum()
    const a = x.rein('a')
    const b = x.rein('b')
    const c = x.rein('c')
    sag(x.r, a.k, { t: 'modus', modus: 'rennen' })
    sag(x.r, a.k, { t: 'start' })
    return { ...x, a, b, c }
  }
  const pos = (aepfel: number, raus = false) => ({ t: 'pos', b: [{ x: 1, y: 2 }], d: 'r', a: aepfel, l: 3, tot: false, raus })

  it('verteilt Geister an die anderen', () => {
    const { r, a, b, c } = rennen()
    sag(r, a.k, pos(2))
    expect(b.k.letzte('geist')?.wer).toBe(0)
    expect(c.k.letzte('geist')?.a).toBe(2)
    expect(a.k.letzte('geist')).toBeUndefined()
  })

  it('wer 5 Aepfel zurueckliegt, ist raus; der Letzte gewinnt', () => {
    const { r, a, b, c } = rennen()
    sag(r, a.k, pos(5))
    expect(a.k.alle('raus').map((m) => m.wer).sort()).toEqual([1, 2])
    expect(a.k.letzte('raus')?.grund).toBe('abstand')
    expect(c.k.letzte('ende')?.ergebnis.sieger).toBe(0)
    void b
  })

  it('wer ohne Leben ist, meldet sich raus', () => {
    const { r, a, b, c } = rennen()
    sag(r, b.k, pos(1, true))
    sag(r, c.k, pos(1, true))
    expect(a.k.letzte('ende')?.ergebnis.sieger).toBe(0)
  })

  it('das Gebiet waehlt abwechselnd einer, nur der Dranseiende darf', () => {
    const { r, a, b, c } = rennen()
    expect(b.k.letzte('waehler')).toEqual({ t: 'waehler', k: 1, wer: 0 })
    sag(r, b.k, { t: 'gebiet', k: 1, b: { x: 1, y: 0 }, d: 'r' })
    expect(c.k.letzte('gebiet')).toBeUndefined()
    sag(r, a.k, { t: 'gebiet', k: 1, b: { x: 1, y: 0 }, d: 'r' })
    expect(c.k.letzte('gebiet')).toEqual({ t: 'gebiet', k: 1, b: { x: 1, y: 0 }, d: 'r', wer: 0 })
    expect(c.k.letzte('waehler')).toEqual({ t: 'waehler', k: 2, wer: 1 })
    // Ist der Waehlende raus, ist der Naechste dran
    sag(r, b.k, pos(0, true))
    expect(c.k.letzte('waehler')).toEqual({ t: 'waehler', k: 2, wer: 2 })
  })
})
