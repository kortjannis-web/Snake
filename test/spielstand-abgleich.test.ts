import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Daten } from '../src/cloud'

/* Ablauf des Spielstand-Abgleichs auf einem Geraet gegen eine nachgebaute Datenbank, die wie
 * public.spielstand_abgleichen rechnet (gleiche Regeln: spielstandZusammen, getestet gegen das echte SQL in
 * test/spielstand-sql.test.ts), samt Vorgangs-Kennung gegen doppeltes Einrechnen. */

type Zeile = { daten: Daten; stand: number }
const db = new Map<string, Zeile>()
const vorgaenge = new Set<string>()
let angemeldet: string | null = null
let antwortVerlieren = false
let netzWeg = false
let zusammen: typeof import('../src/cloud').spielstandZusammen
let gleich: typeof import('../src/cloud').gleich

function serverAbgleich(uid: string, p: { p_vorgang: string | null; p_basis: Daten | null; p_lokal: Daten | null }) {
  const r = db.get(uid) ?? { daten: {}, stand: 0 }
  db.set(uid, r)
  if (p.p_vorgang && vorgaenge.has(p.p_vorgang)) return { daten: r.daten, stand: r.stand, doppelt: true }
  if (p.p_lokal) {
    const neu = zusammen(p.p_basis, p.p_lokal, r.daten)
    if (!gleich(neu, r.daten)) db.set(uid, { daten: JSON.parse(JSON.stringify(neu)), stand: r.stand + 1 })
  }
  if (p.p_vorgang) vorgaenge.add(p.p_vorgang)
  const z = db.get(uid)!
  return { daten: JSON.parse(JSON.stringify(z.daten)), stand: z.stand }
}

const sb = {
  rpc: async (name: string, p: { p_vorgang: string | null; p_basis: Daten | null; p_lokal: Daten | null }) => {
    if (name !== 'spielstand_abgleichen' || !angemeldet) return { data: null, error: { code: 'PGRST202' } }
    if (netzWeg) return { data: null, error: { message: 'Failed to fetch' } }
    const data = serverAbgleich(angemeldet, p)
    if (antwortVerlieren) {
      antwortVerlieren = false
      return { data: null, error: { message: 'Failed to fetch' } }
    }
    return { data, error: null }
  },
}

vi.mock('../src/online', () => ({
  sitzung: async () => (angemeldet ? { sb, id: angemeldet } : null),
  beiZustand: () => undefined,
}))

const speicher = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => speicher.get(k) ?? null,
  setItem: (k: string, v: string) => void speicher.set(k, v),
  removeItem: (k: string) => void speicher.delete(k),
})
vi.stubGlobal('window', { setTimeout: () => 0 })
vi.spyOn(console, 'warn').mockImplementation(() => undefined)

let C: typeof import('../src/cloud')
let S: typeof import('../src/storage')

/** Neues Geraet bzw. App neu gestartet (Module frisch aus dem Speicher geladen) */
async function appStart() {
  vi.resetModules()
  S = await import('../src/storage')
  C = await import('../src/cloud')
  zusammen = C.spielstandZusammen
  gleich = C.gleich
}
/** Etwas spielen: Aepfel verdienen, ein Spiel mehr, Rekord */
function spielen(aepfel: number, level: number) {
  S.wallet.aepfel += aepfel
  S.stats.games += 1
  S.stats.best = Math.max(S.stats.best, level)
  S.saveWallet()
  S.saveStats()
}
/** Ein anderes Geraet desselben Accounts gleicht ab (kannte `basis`, hat `lokal`) */
function anderesGeraet(uid: string, basis: Daten | null, lokal: Daten) {
  return serverAbgleich(uid, { p_vorgang: crypto.randomUUID(), p_basis: basis, p_lokal: lokal })
}
const aepfelServer = (uid: string) => db.get(uid)?.daten.wallet?.aepfel

beforeEach(() => {
  antwortVerlieren = false
  netzWeg = false
})

describe('Spielstand: Server ist die Wahrheit', () => {
  it('ohne Anmeldung: Spielen geht, nichts geht an den Server', async () => {
    speicher.clear()
    db.clear()
    await appStart()
    angemeldet = null
    spielen(40, 12)
    await C.abgleichen()
    expect(db.size).toBe(0)
    expect(S.wallet.aepfel).toBe(40)
  })

  it('Anmelden: der Stand vom Geraet wird eingerechnet (nichts doppelt), dann gilt der Server', async () => {
    db.set('A', { daten: { wallet: { aepfel: 300, skins: ['klassik', 'gold'], skin: 'gold', trophaeen: 0 }, stats: { best: 50, games: 20 } }, stand: 5 })
    angemeldet = 'A'
    await C.abgleichen()
    expect(aepfelServer('A')).toBe(300)
    expect(S.wallet.aepfel).toBe(300)
    expect(S.wallet.skins).toEqual(['klassik', 'gold'])
    expect(S.stats.best).toBe(50)
  })

  it('jede Leistung kommt dazu, ein anderes Geraet sieht sie, Aenderungen von dort kommen hier an', async () => {
    spielen(25, 60)
    await C.abgleichen()
    expect(aepfelServer('A')).toBe(325)
    expect(db.get('A')!.daten.stats!.best).toBe(60)
    // Zweites Geraet kauft einen Skin (kannte den aktuellen Stand)
    const basis = db.get('A')!.daten
    anderesGeraet('A', basis, { ...basis, wallet: { ...basis.wallet, aepfel: 225, skins: ['klassik', 'gold', 'wald'] } })
    await C.abgleichen()
    expect(S.wallet.aepfel).toBe(225)
    expect(S.wallet.skins).toContain('wald')
  })

  it('beide Geraete offline: alles zusammen, ausgegeben wird abgezogen, nie unter 0', async () => {
    const basis = db.get('A')!.daten
    netzWeg = true
    spielen(30, 61)
    await C.abgleichen()
    // Anderes Geraet gibt offline 200 aus und gleicht zuerst ab
    netzWeg = false
    anderesGeraet('A', basis, { ...basis, wallet: { ...basis.wallet, aepfel: 25 } })
    await C.abgleichen()
    expect(aepfelServer('A')).toBe(55)
    expect(S.wallet.aepfel).toBe(55)
    expect(db.get('A')!.daten.stats!.best).toBe(61)
  })

  it('Antwort geht verloren: beim naechsten Mal wird nicht doppelt gezaehlt', async () => {
    S.wallet.aepfel -= 50 // Kauf
    S.saveWallet()
    antwortVerlieren = true
    await C.abgleichen()
    expect(aepfelServer('A')).toBe(5)
    await C.abgleichen()
    expect(aepfelServer('A')).toBe(5)
    expect(S.wallet.aepfel).toBe(5)
  })

  it('App neu gestartet mit einer unbestaetigten Anfrage: wird genau einmal eingerechnet', async () => {
    spielen(100, 62)
    antwortVerlieren = true
    await C.abgleichen()
    await appStart()
    await C.abgleichen()
    expect(aepfelServer('A')).toBe(105)
    expect(S.wallet.aepfel).toBe(105)
  })

  it('Kontowechsel: der neue Account hat seinen Stand, das Ungesendete vom alten wird zurueckgelegt', async () => {
    db.set('B', { daten: { wallet: { aepfel: 9, skins: ['klassik'], skin: 'klassik', trophaeen: 0 }, stats: { best: 3, games: 1 } }, stand: 2 })
    netzWeg = true
    spielen(20, 63) // noch fuer A, aber offline
    await C.abgleichen()
    netzWeg = false
    angemeldet = 'B'
    await C.abgleichen()
    expect(S.wallet.aepfel).toBe(9)
    expect(S.wallet.skins).toEqual(['klassik'])
    expect(S.stats.best).toBe(3)
    expect(aepfelServer('A')).toBe(105)
    spielen(1, 4)
    await C.abgleichen()
    expect(aepfelServer('B')).toBe(10)
    // Zurueck zu A: das zurueckgelegte kommt dazu, B behaelt seins
    angemeldet = 'A'
    await C.abgleichen()
    expect(aepfelServer('A')).toBe(125)
    expect(S.wallet.aepfel).toBe(125)
    expect(S.stats.best).toBe(63)
    expect(aepfelServer('B')).toBe(10)
  })

  it('neuer (leerer) Account bekommt den Stand vom Geraet', async () => {
    angemeldet = 'C'
    await C.abgleichen()
    expect(aepfelServer('C')).toBe(125)
    expect(S.wallet.aepfel).toBe(125)
  })

  it('App-Daten geloescht: der Server wird nicht kleiner, das Geraet bekommt alles wieder', async () => {
    angemeldet = 'A'
    await C.abgleichen()
    const vorher = JSON.parse(JSON.stringify(db.get('A')!))
    speicher.clear()
    await appStart()
    expect(S.wallet.aepfel).toBe(0)
    await C.abgleichen()
    expect(db.get('A')!.daten).toEqual(vorher.daten)
    expect(S.wallet.aepfel).toBe(125)
    expect(S.stats.best).toBe(63)
  })

  it('Spielfuehrer gesehen und Weltchat gelesen gehoeren zum Account', async () => {
    S.fuehrerGesehen()
    localStorage.setItem('snake.welt.gesehen.v1', '77')
    await C.abgleichen()
    expect(db.get('A')!.daten.konto).toMatchObject({ fuehrer: S.FUEHRER, weltchat: 77 })
    speicher.clear()
    await appStart()
    expect(S.fuehrerNeu()).toBe(true)
    await C.abgleichen()
    expect(S.fuehrerNeu()).toBe(false)
    expect(localStorage.getItem('snake.welt.gesehen.v1')).toBe('77')
  })

  it('angefangene Aepfel bleiben auf dem Geraet', async () => {
    S.wallet.rest = 42
    S.saveWallet()
    await C.abgleichen()
    expect(db.get('A')!.daten.wallet).not.toHaveProperty('rest')
    expect(S.wallet.rest).toBe(42)
  })
})

describe('Vorgaenge ablegen', () => {
  it('ungesendeter letzter Vorgang wird fortgeschrieben, gesendeter nicht', async () => {
    const o: Record<string, import('../src/cloud').Vorgang[]> = {}
    let n = 0
    const id = () => `v${++n}`
    expect(C.vorgangAblegen(o, 'A', { uid: 'A', stand: 1, daten: { wallet: { aepfel: 1 } } }, { wallet: { aepfel: 1 } }, id)).toBe(false)
    C.vorgangAblegen(o, 'A', null, { wallet: { aepfel: 2 } }, id)
    C.vorgangAblegen(o, 'A', null, { wallet: { aepfel: 3 } }, id)
    expect(o.A).toHaveLength(1)
    expect(o.A[0].lokal.wallet!.aepfel).toBe(3)
    o.A[0].gesendet = true
    C.vorgangAblegen(o, 'A', null, { wallet: { aepfel: 4 } }, id)
    expect(o.A).toHaveLength(2)
    expect(o.A[1].basis!.wallet!.aepfel).toBe(3)
  })
})
