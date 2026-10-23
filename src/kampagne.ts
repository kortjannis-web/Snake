/** Kampagne: Fortschritt im Geraet (geschaffte Missionen, wie weit die Schlange auf der Karte reicht) */
import type { MissionDef } from './game/missionen'

const KEY = 'snake-kampagne'

export type KampagnenStand = {
  /** Geschaffte Missionen (Ids). Die Belohnung gibt es nur beim ersten Mal */
  geschafft: string[]
  /** Je Welt: bis zu welcher Mission die Schlange auf der Karte gewachsen ist (0 = nur der Kopf vor Mission 1) */
  erreicht: Record<string, number>
}

function lesen(): KampagnenStand {
  try {
    const raw = localStorage.getItem(KEY)
    const v = raw ? (JSON.parse(raw) as Partial<KampagnenStand>) : {}
    return { geschafft: Array.isArray(v.geschafft) ? v.geschafft : [], erreicht: v.erreicht && typeof v.erreicht === 'object' ? v.erreicht : {} }
  } catch {
    return { geschafft: [], erreicht: {} }
  }
}

export const kampagne: KampagnenStand = lesen()

export function kampagneSpeichern() {
  try {
    localStorage.setItem(KEY, JSON.stringify(kampagne))
  } catch {
    /* Speicher blockiert: egal */
  }
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
