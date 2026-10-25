/**
 * Spielstand in der Cloud (seit 1.42): Aepfel, Skins, Welten, Rekorde, Statistik und Erfolge gehoeren zum Account.
 * Wer sich mit Name und Passwort auf einem anderen Geraet anmeldet, hat dort alles wieder.
 *
 * Abgleich als Drei-Wege-Zusammenfuehrung: `basis` ist der Stand der Cloud beim letzten Abgleich auf diesem Geraet.
 * - Zaehler (Aepfel, Spiele, Spielzeit ...): Cloud + was hier seit dem letzten Abgleich dazukam (oder ausgegeben wurde)
 * - Bestwerte (Rekord, laengste Schlange ...): das Groessere
 * - Listen (Skins, Welten, Erfolge): beide zusammen
 * - Auswahl (Skin, Aussehen, Welt): was hier zuletzt geaendert wurde, sonst die Cloud
 * So geht nichts verloren, auch wenn zwei Geraete offline gespielt haben.
 */
import { beiSpielstand, saveStats, saveWallet, stats, wallet } from './storage'
import { beiZustand, sitzung } from './online'

type Wert = unknown
type Daten = { wallet?: Record<string, Wert>; stats?: Record<string, Wert> }

/** Bestwerte: nie kleiner werden, nie aufaddieren */
const BESTWERTE = new Set(['best', 'longest', 'maxGebiete', 'verdient', 'weltBest'])
/** Auswahl als Ganzes (nicht Feld fuer Feld mischen, sonst entstehen Farben, die niemand gewaehlt hat) */
const AUSWAHL = new Set(['look'])

const istObjekt = (v: Wert): v is Record<string, Wert> => !!v && typeof v === 'object' && !Array.isArray(v)

/** Drei-Wege-Zusammenfuehrung (rein, ohne Netz; getestet in test/cloud.test.ts) */
export function zusammenfuehren(basis: Wert, lokal: Wert, cloud: Wert, bestwert = false, auswahl = false): Wert {
  if (cloud === undefined) return lokal
  if (lokal === undefined) return cloud
  if (auswahl) return basis !== undefined && JSON.stringify(lokal) !== JSON.stringify(basis) ? lokal : cloud
  if (typeof lokal === 'number' && typeof cloud === 'number') {
    if (bestwert || typeof basis !== 'number') return Math.max(lokal, cloud)
    return Math.max(0, cloud + (lokal - basis))
  }
  if (Array.isArray(lokal) && Array.isArray(cloud)) return [...new Set([...cloud, ...lokal])]
  if (istObjekt(lokal) && istObjekt(cloud)) {
    const b = istObjekt(basis) ? basis : {}
    const aus: Record<string, Wert> = {}
    for (const k of new Set([...Object.keys(cloud), ...Object.keys(lokal)])) aus[k] = zusammenfuehren(b[k], lokal[k], cloud[k], bestwert || BESTWERTE.has(k), AUSWAHL.has(k))
    return aus
  }
  // Auswahl und Text: hier geaendert? Dann gilt das, sonst die Cloud
  return basis !== undefined && JSON.stringify(lokal) !== JSON.stringify(basis) ? lokal : cloud
}

/** Tagesbestwert nur fuer denselben Tag zusammenfuehren (sonst gilt der neuere Tag) */
function heuteRichten(aus: Record<string, Wert>, lokal: Record<string, Wert>, cloud: Record<string, Wert>) {
  const l = lokal.heute as { datum: string; best: number } | undefined
  const c = cloud.heute as { datum: string; best: number } | undefined
  if (!l || !c) return
  aus.heute = l.datum === c.datum ? { datum: l.datum, best: Math.max(l.best, c.best) } : l.datum > c.datum ? l : c
}

export function spielstandZusammen(basis: Daten | null, lokal: Daten, cloud: Daten | null): Daten {
  if (!cloud) return lokal
  const w = zusammenfuehren(basis?.wallet, lokal.wallet, cloud.wallet) as Record<string, Wert>
  const s = zusammenfuehren(basis?.stats, lokal.stats, cloud.stats) as Record<string, Wert>
  if (lokal.stats && cloud.stats) heuteRichten(s, lokal.stats, cloud.stats)
  // Angefangene Aepfel (Hundertstel) gehoeren zu diesem Geraet
  if (w && lokal.wallet && 'rest' in lokal.wallet) w.rest = lokal.wallet.rest
  return { wallet: w, stats: s }
}

const BKEY = 'snake.cloud.v1'
/** Letzter Abgleich auf diesem Geraet: fuer welchen Account, welcher Stand, welche Daten */
type Basis = { uid: string; stand: number; daten: Daten }
function liesBasis(): Basis | null {
  try {
    return JSON.parse(localStorage.getItem(BKEY) ?? 'null') as Basis | null
  } catch {
    return null
  }
}
function schreibBasis(b: Basis) {
  try {
    localStorage.setItem(BKEY, JSON.stringify(b))
  } catch {
    /* Speicher blockiert: beim naechsten Mal als erster Abgleich */
  }
}

const kopie = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const lokaleDaten = (): Daten => kopie({ wallet: wallet as unknown as Record<string, Wert>, stats: stats as unknown as Record<string, Wert> })

const hoerer = new Set<() => void>()
/** Ruft `f` auf, sobald ein Abgleich den Spielstand auf diesem Geraet veraendert hat (Startbildschirm neu zeichnen) */
export function beiCloud(f: () => void) {
  hoerer.add(f)
}

/** Ergebnis auf dem Geraet uebernehmen, ohne erneut einen Abgleich auszuloesen */
let uebernehme = false
function anwenden(d: Daten) {
  uebernehme = true
  try {
    if (d.wallet) Object.assign(wallet, d.wallet)
    if (d.stats) Object.assign(stats, d.stats)
    saveWallet()
    saveStats()
  } finally {
    uebernehme = false
  }
  hoerer.forEach((f) => f())
}

let laeuft: Promise<void> | null = null
let nochmal = false
/**
 * Lesen, zusammenfuehren, schreiben. Schreibt nur, wenn die Cloud seitdem unveraendert ist (`stand`), sonst noch einmal.
 * Ohne Anmeldung oder Netz passiert nichts (der naechste Abgleich holt es nach).
 */
export function abgleichen(): Promise<void> {
  if (laeuft) {
    nochmal = true
    return laeuft
  }
  laeuft = (async () => {
    for (let runde = 0; runde < 4; runde++) {
      nochmal = false
      const z = await sitzung().catch(() => null)
      if (!z) return
      const { data, error } = await z.sb.from('spielstand').select('daten,stand').eq('id', z.id).maybeSingle()
      if (error) return
      const cloud = data as { daten: Daten; stand: number } | null
      const alt = liesBasis()
      const vorher = lokaleDaten()
      let neu: Daten
      if (alt && alt.uid !== z.id && cloud) neu = cloud.daten // anderer Account als zuletzt: dessen Spielstand gilt
      else neu = spielstandZusammen(alt?.uid === z.id ? alt.daten : null, vorher, cloud?.daten ?? null)
      if (JSON.stringify(neu) !== JSON.stringify(vorher)) anwenden(neu)
      const gleich = cloud && JSON.stringify(neu) === JSON.stringify(cloud.daten)
      if (gleich) {
        schreibBasis({ uid: z.id, stand: cloud.stand, daten: neu })
      } else {
        const stand = (cloud?.stand ?? 0) + 1
        const jetzt = new Date().toISOString()
        const r = cloud
          ? await z.sb.from('spielstand').update({ daten: neu, stand, updated_at: jetzt }).eq('id', z.id).eq('stand', cloud.stand).select('stand')
          : await z.sb.from('spielstand').insert({ id: z.id, daten: neu, stand, updated_at: jetzt }).select('stand')
        // Jemand war schneller (anderes Geraet) oder Fehler: noch einmal von vorn
        if (r.error || !r.data?.length) {
          if (r.error && r.error.code !== '23505') return
          continue
        }
        schreibBasis({ uid: z.id, stand, daten: neu })
      }
      if (!nochmal) return
    }
  })().finally(() => (laeuft = null))
  return laeuft
}

let timer = 0
/** Nach dem Speichern: kurz sammeln, dann abgleichen */
beiSpielstand.add(() => {
  if (uebernehme) return
  clearTimeout(timer)
  timer = window.setTimeout(() => void abgleichen(), 4000)
})
// Angemeldet (oder wieder verbunden): gleich abgleichen
beiZustand((z) => {
  if (z.ok) void abgleichen()
})
