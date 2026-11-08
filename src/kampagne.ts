/**
 * Kampagne: Fortschritt (geschaffte Missionen, wie weit die Schlange auf der Karte reicht).
 * Liegt auf dem Geraet und seit 1.55.3 zusaetzlich je Account in der Cloud (src/cloud.ts, Tabelle `kampagne`).
 * Der Stand kann nur wachsen: Zusammenfuehren heisst immer Missionen vereinigen und je Welt das Hoehere nehmen.
 */
import type { MissionDef } from './game/missionen'

const KEY = 'snake-kampagne'

export type KampagnenStand = {
  /** Geschaffte Missionen (Ids). Die Belohnung gibt es nur beim ersten Mal */
  geschafft: string[]
  /** Je Welt: bis zu welcher Mission die Schlange auf der Karte gewachsen ist (0 = nur der Kopf vor Mission 1) */
  erreicht: Record<string, number>
}

const istObjekt = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** Aus beliebigen (gespeicherten oder geladenen) Daten einen gueltigen Stand machen; Unbrauchbares faellt weg */
export function kampagneSauber(v: unknown): KampagnenStand {
  const o = istObjekt(v) ? v : {}
  const geschafft = Array.isArray(o.geschafft) ? [...new Set(o.geschafft.filter((x): x is string => typeof x === 'string' && x.length > 0))] : []
  const erreicht: Record<string, number> = {}
  if (istObjekt(o.erreicht)) for (const [w, n] of Object.entries(o.erreicht)) if (typeof n === 'number' && Number.isFinite(n) && n > 0) erreicht[w] = Math.floor(n)
  return { geschafft, erreicht }
}

/** Zwei Staende zusammen: alle Missionen beider, je Welt das Hoehere. Nie geht etwas verloren (getestet in test/kampagne-cloud.test.ts) */
export function kampagneZusammen(a: KampagnenStand, b: KampagnenStand): KampagnenStand {
  const geschafft = [...new Set([...a.geschafft, ...b.geschafft])]
  const erreicht: Record<string, number> = { ...a.erreicht }
  for (const [w, n] of Object.entries(b.erreicht)) erreicht[w] = Math.max(erreicht[w] ?? 0, n)
  return { geschafft, erreicht }
}

/** Was `jetzt` mehr hat als `vorher` (fuer Fortschritt, der waehrend eines Abgleichs dazukam) */
export function kampagneSeit(vorher: KampagnenStand, jetzt: KampagnenStand): KampagnenStand {
  const erreicht: Record<string, number> = {}
  for (const [w, n] of Object.entries(jetzt.erreicht)) if (n > (vorher.erreicht[w] ?? 0)) erreicht[w] = n
  return { geschafft: jetzt.geschafft.filter((id) => !vorher.geschafft.includes(id)), erreicht }
}

/** Gleicher Inhalt (Reihenfolge egal)? */
export function kampagneGleich(a: KampagnenStand, b: KampagnenStand): boolean {
  const ga = new Set(a.geschafft)
  if (ga.size !== new Set(b.geschafft).size || b.geschafft.some((id) => !ga.has(id))) return false
  const wa = Object.keys(a.erreicht)
  return wa.length === Object.keys(b.erreicht).length && wa.every((w) => a.erreicht[w] === b.erreicht[w])
}

/** Hat der Stand ueberhaupt Fortschritt? */
export const kampagneLeer = (k: KampagnenStand) => k.geschafft.length === 0 && Object.values(k.erreicht).every((n) => !n)

function lesen(): KampagnenStand {
  try {
    const raw = localStorage.getItem(KEY)
    return kampagneSauber(raw ? JSON.parse(raw) : {})
  } catch {
    return { geschafft: [], erreicht: {} }
  }
}

export const kampagne: KampagnenStand = lesen()

/** Wird nach jedem eigenen Fortschritt aufgerufen (Abgleich mit der Cloud, src/cloud.ts) */
export const beiKampagne = new Set<() => void>()

function schreiben() {
  try {
    localStorage.setItem(KEY, JSON.stringify(kampagne))
  } catch {
    /* Speicher blockiert: egal */
  }
}

export function kampagneSpeichern() {
  schreiben()
  beiKampagne.forEach((f) => f())
}

/** Stand aus der Cloud uebernehmen (ohne erneut einen Abgleich auszuloesen) */
export function kampagneUebernehmen(neu: KampagnenStand) {
  kampagne.geschafft = [...neu.geschafft]
  kampagne.erreicht = { ...neu.erreicht }
  schreiben()
}

export const geschafft = (m: MissionDef) => kampagne.geschafft.includes(m.id)
export const erreicht = (welt: string) => kampagne.erreicht[welt] ?? 0

/** Offen = die erste Mission oder die davor ist geschafft */
export const offen = (m: MissionDef, liste: MissionDef[]) => m.nr === 1 || geschafft(liste[m.nr - 2])

/** Mission geschafft: gibt die Belohnung zurueck (0, wenn sie schon einmal geschafft war) */
export function missionGeschafft(m: MissionDef): number {
  if (geschafft(m)) return 0
  kampagne.geschafft.push(m.id)
  kampagneSpeichern()
  return m.lohn
}

/** Die Schlange ist auf der Karte bis zu dieser Mission gewachsen */
export function setzeErreicht(welt: string, nr: number) {
  if (erreicht(welt) >= nr) return
  kampagne.erreicht[welt] = nr
  kampagneSpeichern()
}
