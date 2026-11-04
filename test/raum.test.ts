import { describe, expect, it } from 'vitest'
import { RaumLogik, type Kanal } from '../server/raum'
import { MehrGame } from '../src/game/mehr'
import { anwenden, zustand } from '../src/game/zustand'
import { COUNTDOWN, PROTOKOLL, SIM_MS, STAND_SCHRITTE, VERZUG_MS, type VomServer } from '../src/multi/protokoll'
import { spielBauen } from '../src/multi/sim'

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
  /** Beitreten; wer nicht Gastgeber ist, tippt gleich "Bereit" (ausser bereit = false) */
  const rein = (id: string, v = PROTOKOLL, bereit = true) => {
    const k = new Fake()
    const ok = r.beitreten(k, { id, name: `Name ${id}`, skin: 'klassik', v })
    if (ok && bereit && r.gastgeber !== id) r.nachricht(k, JSON.stringify({ t: 'bereit', bereit: true }))
    return { k, ok }
  }
  return { r, uhr, rein }
}
const sag = (r: RaumLogik, k: Kanal, m: object) => r.nachricht(k, JSON.stringify(m))
/** Zeit laufen lassen (der Durable Object ruft takt() alle paar ms), bis das Spiel vorbei ist */
const bisEnde = (r: RaumLogik, uhr: (ms: number) => number) => {
  for (let i = 0; i < 5000 && r.phase === 'spiel'; i++) {
    uhr(100)
    r.takt()
  }
}

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
    const { r, uhr, rein } = raum()
    const a = rein('a')
    const b = rein('b')
    sag(r, a.k, { t: 'start' })
    uhr(COUNTDOWN + VERZUG_MS + 1000)
    r.takt()
    sag(r, a.k, { t: 'dir', d: 'u', n: r.schritt + 30, i: 1 })
    r.verlassen(b.k)
    expect(rein('neu').ok).toBe(false)
    const b2 = rein('b')
    expect(b2.ok).toBe(true)
    expect(b2.k.letzte('start')?.info.modus).toBe('vs')
    // Ganzer Stand des Servers und die Wischer, die noch nicht gerechnet sind
    expect(b2.k.letzte('voll')?.n).toBe(r.schritt)
    expect(b2.k.letzte('voll')?.z.time).toBe(r.schritt * SIM_MS)
    expect(b2.k.letzte('dir')).toMatchObject({ wer: 0, d: 'u', n: r.schritt + 30 })
  })
})

describe('Raum: Lobby', () => {
  it('Start erst, wenn alle bereit sind; Modus- oder Einstellungswechsel setzt Bereit zurueck', () => {
    const { r, rein } = raum()
    const a = rein('a')
    const b = rein('b', PROTOKOLL, false)
    sag(r, a.k, { t: 'start' })
    expect(r.phase).toBe('lobby')
    expect(a.k.letzte('fehler')?.text).toMatch(/Noch nicht bereit/)
    expect(b.k.letzte('raum')?.spieler.map((s) => s.bereit)).toEqual([true, false])
    sag(r, b.k, { t: 'bereit', bereit: true })
    expect(a.k.letzte('raum')?.spieler[1].bereit).toBe(true)
    sag(r, a.k, { t: 'einstellung', tempo: 'schnell', klassisch: true })
    expect(b.k.letzte('raum')?.spieler[1].bereit).toBe(false)
    expect(b.k.letzte('raum')?.tempo).toBe('schnell')
    expect(b.k.letzte('raum')?.klassisch).toBe(true)
    // Nur der Gastgeber stellt ein
    sag(r, b.k, { t: 'einstellung', tempo: 'langsam' })
    expect(r.tempo).toBe('schnell')
    sag(r, b.k, { t: 'bereit', bereit: true })
    sag(r, a.k, { t: 'start' })
    expect(r.phase).toBe('spiel')
    expect(b.k.letzte('start')?.info).toMatchObject({ tempo: 'schnell', klassisch: true })
  })
})

describe('Raum: Spiel auf einem Feld', () => {
  it('nur der Gastgeber startet, mit mindestens 2 Spielern; alle bekommen den ganzen Stand', () => {
    const { r, rein } = raum()
    const a = rein('a')
    sag(r, a.k, { t: 'start' })
    expect(r.phase).toBe('lobby')
    expect(a.k.letzte('fehler')?.text).toMatch(/mindestens 2/)
    const b = rein('b')
    sag(r, b.k, { t: 'start' })
    expect(r.phase).toBe('lobby')
    sag(r, a.k, { t: 'modus', modus: 'koop' })
    // Neuer Modus: Bob muss neu zusagen
    sag(r, b.k, { t: 'bereit', bereit: true })
    sag(r, a.k, { t: 'start' })
    const s = b.k.letzte('start')!
    expect(s.info.modus).toBe('koop')
    expect(s.info.spieler.map((p) => p.id)).toEqual(['a', 'b'])
    expect(s.info.los - s.jetzt).toBe(COUNTDOWN)
    expect(b.k.letzte('voll')?.n).toBe(0)
    expect(a.k.letzte('voll')?.z).toEqual(JSON.parse(JSON.stringify(zustand(spielBauen(s.info), true))))
  })

  it('der Server rechnet das Spiel hinter der Echtzeit, in festen Schritten', () => {
    const { r, uhr, rein } = raum()
    const a = rein('a')
    const b = rein('b')
    sag(r, a.k, { t: 'start' })
    // Countdown und Verzug: noch nichts gerechnet
    uhr(COUNTDOWN + VERZUG_MS - 1)
    r.takt()
    expect(r.schritt).toBe(0)
    uhr(1 + 10 * SIM_MS)
    r.takt()
    expect(r.schritt).toBe(10)
    expect(r.spiel?.time).toBe(10 * SIM_MS)
    const z = b.k.letzte('z')!
    expect(z.n).toBe(10)
    expect(z.d.time).toBe(10 * SIM_MS)
    // Weniger als STAND_SCHRITTE spaeter: kein neuer Stand
    const vorher = b.k.alle('z').length
    uhr(SIM_MS * (STAND_SCHRITTE - 1))
    r.takt()
    expect(b.k.alle('z').length).toBe(vorher)
    uhr(SIM_MS)
    r.takt()
    expect(b.k.alle('z').length).toBe(vorher + 1)
  })

  it('Wischer gelten im Schritt, in dem gewischt wurde (zu spaete im naechsten offenen) und gehen sofort an alle', () => {
    const { r, uhr, rein } = raum()
    const a = rein('a')
    const b = rein('b')
    sag(r, a.k, { t: 'start' })
    uhr(COUNTDOWN + VERZUG_MS + 20 * SIM_MS)
    r.takt()
    expect(r.schritt).toBe(20)
    sag(r, b.k, { t: 'dir', d: 'u', n: 25, i: 7 })
    expect(a.k.letzte('dir')).toEqual({ t: 'dir', wer: 1, d: 'u', n: 25, i: 7, q: 1 })
    expect(b.k.letzte('dir')).toEqual({ t: 'dir', wer: 1, d: 'u', n: 25, i: 7, q: 1 })
    // Zu spaet (Schritt 12 ist schon gerechnet): gilt im naechsten offenen
    sag(r, a.k, { t: 'dir', d: 'd', n: 12, i: 1 })
    expect(a.k.letzte('dir')).toMatchObject({ wer: 0, n: 20, q: 2 })
    // Unsinn wird ignoriert
    sag(r, a.k, { t: 'dir', d: 'x', n: 21, i: 2 })
    expect(r.eingaben).toHaveLength(2)
    // Gerechnet wie auf einem Handy: Wischer vor dem Schritt
    const nach = spielBauen(r.start!)
    for (let k = 0; k < 30; k++) {
      if (k === 20) nach.lenke(0, 'd')
      if (k === 25) nach.lenke(1, 'u')
      nach.update(SIM_MS)
    }
    uhr(10 * SIM_MS)
    r.takt()
    expect(r.schritt).toBe(30)
    expect(r.eingaben).toHaveLength(0)
    expect(JSON.stringify(zustand(r.spiel!, true))).toBe(JSON.stringify(zustand(nach, true)))
  })

  it('aus dem ersten Stand und allen Aenderungen ergibt sich genau das Spiel des Servers', () => {
    const { r, uhr, rein } = raum()
    const a = rein('a')
    const b = rein('b')
    const c = rein('c')
    sag(r, a.k, { t: 'modus', modus: 'jagd' })
    for (const p of [b, c]) sag(r, p.k, { t: 'bereit', bereit: true })
    sag(r, a.k, { t: 'start' })
    const spiegel = spielBauen(a.k.letzte('start')!.info) as MehrGame
    anwenden(spiegel, a.k.letzte('voll')!.z)
    let gelesen = a.k.bekommen.length
    const dirs = ['u', 'l', 'd', 'r'] as const
    for (let i = 0; i < 1500 && r.phase === 'spiel'; i++) {
      uhr(37)
      if (i % 9 === 0) sag(r, [a, b, c][i % 3].k, { t: 'dir', d: dirs[(i / 9) % 4], n: r.schritt + 3, i })
      r.takt()
      for (const m of a.k.bekommen.slice(gelesen)) if (m.t === 'z') anwenden(spiegel, JSON.parse(JSON.stringify(m.d)))
      gelesen = a.k.bekommen.length
    }
    expect(r.schritt).toBeGreaterThan(2000)
    // Noch einen Stand abwarten: dann ist der Spiegel auf dem Stand des Servers
    uhr(STAND_SCHRITTE * SIM_MS)
    r.takt()
    for (const m of a.k.bekommen.slice(gelesen)) if (m.t === 'z') anwenden(spiegel, JSON.parse(JSON.stringify(m.d)))
    expect(a.k.letzte('z')?.n).toBe(r.schritt)
    const x = zustand(spiegel, true)
    const y = zustand(r.spiel!, true)
    const anders = Object.keys(y).filter((k) => JSON.stringify(x[k]) !== JSON.stringify(y[k]))
    expect(anders).toEqual([])
  })

  it('Ende kommt vom Server, Nochmal fuehrt zurueck in die Lobby', () => {
    const { r, uhr, rein } = raum()
    const a = rein('a')
    const b = rein('b')
    sag(r, a.k, { t: 'start' })
    // Ein Handy kann das Ende nicht mehr bestimmen
    sag(r, a.k, { t: 'ende', ergebnis: { sieger: 1, reihenfolge: [1, 0] } })
    expect(r.phase).toBe('spiel')
    // Beide fahren geradeaus gegen die Wand (1 Leben)
    bisEnde(r, uhr)
    expect(r.phase).toBe('ende')
    expect(b.k.letzte('ende')?.ergebnis.reihenfolge).toHaveLength(2)
    sag(r, a.k, { t: 'nochmal' })
    expect(r.phase).toBe('lobby')
    expect(b.k.letzte('raum')?.phase).toBe('lobby')
  })

  it('Leben: Standard 1, der Gastgeber kann 3 einstellen, sie kommen im Start mit', () => {
    const { r, rein } = raum()
    const a = rein('a')
    const b = rein('b')
    expect(b.k.letzte('raum')?.leben).toBe(1)
    sag(r, b.k, { t: 'einstellung', leben: 3 })
    expect(r.leben).toBe(1)
    sag(r, a.k, { t: 'einstellung', leben: 3 })
    expect(b.k.letzte('raum')?.leben).toBe(3)
    sag(r, b.k, { t: 'bereit', bereit: true })
    sag(r, a.k, { t: 'start' })
    expect(b.k.letzte('start')?.info.leben).toBe(3)
  })

  it('Revanche: erst wenn alle wollen, dann Lobby mit allen bereit', () => {
    const { r, uhr, rein } = raum()
    const a = rein('a')
    const b = rein('b')
    const c = rein('c')
    for (const p of [b, c]) sag(r, p.k, { t: 'bereit', bereit: true })
    sag(r, a.k, { t: 'start' })
    bisEnde(r, uhr)
    // In der Lobby (oder im Spiel) gibt es keine Revanche-Stimmen
    sag(r, b.k, { t: 'revanche' })
    sag(r, c.k, { t: 'revanche' })
    expect(r.phase).toBe('ende')
    expect(a.k.letzte('raum')?.spieler.map((s) => s.revanche)).toEqual([false, true, true])
    // Zuruecknehmen
    sag(r, c.k, { t: 'revanche', revanche: false })
    expect(a.k.letzte('raum')?.spieler[2].revanche).toBe(false)
    sag(r, c.k, { t: 'revanche' })
    expect(r.phase).toBe('ende')
    sag(r, a.k, { t: 'revanche' })
    expect(r.phase).toBe('lobby')
    const raum2 = b.k.letzte('raum')
    expect(raum2?.spieler.every((s) => s.bereit && !s.revanche)).toBe(true)
    // Die Gastgeberin kann sofort wieder starten
    sag(r, a.k, { t: 'start' })
    expect(r.phase).toBe('spiel')
  })

  it('Revanche: geht ein Spieler, reicht die Zusage der Uebrigen', () => {
    const { r, uhr, rein } = raum()
    const a = rein('a')
    const b = rein('b')
    const c = rein('c')
    for (const p of [b, c]) sag(r, p.k, { t: 'bereit', bereit: true })
    sag(r, a.k, { t: 'start' })
    bisEnde(r, uhr)
    sag(r, a.k, { t: 'revanche' })
    sag(r, b.k, { t: 'revanche' })
    expect(r.phase).toBe('ende')
    r.verlassen(c.k)
    expect(r.phase).toBe('lobby')
    expect(r.plaetze).toHaveLength(2)
  })
})

describe('Raum: Wettrennen', () => {
  function rennen() {
    const x = raum()
    const a = x.rein('a')
    const b = x.rein('b')
    const c = x.rein('c')
    sag(x.r, a.k, { t: 'modus', modus: 'rennen' })
    for (const p of [b, c]) sag(x.r, p.k, { t: 'bereit', bereit: true })
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

  it('wer zu weit zurueckliegt, ist raus (bei 3 Spielern 6 Aepfel); der Letzte gewinnt', () => {
    const { r, a, b, c } = rennen()
    sag(r, a.k, pos(5))
    expect(a.k.alle('raus')).toEqual([])
    sag(r, a.k, pos(6))
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
