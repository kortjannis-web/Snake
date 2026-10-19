/**
 * Spielstand als JSON: zum Verschicken im Mehrspieler (nur was sich geaendert hat) und zum Fortsetzen
 * auf einem anderen Geraet (wenn das rechnende Handy ausfaellt, rechnet ein anderes mit diesem Stand weiter).
 *
 * Gespeichert wird jedes Feld des Spiel-Objekts. Mengen, Byte-Felder und der Zufallsgenerator werden
 * umgewandelt; Zwischenspeicher und Felder, die sich neu berechnen lassen, bleiben weg.
 */
import type { Game } from './game'
import { SchlangenAbgleich } from '../multi/kompakt'
import { MehrGame, TAUSCH_FELDER } from './mehr'

export type Zustand = Record<string, unknown>

/** Neu berechenbar oder nur fuer dieses Geraet */
const OHNE = new Set(['events', 'mask', 'stempel', 'stempelNr', 'schlangeMenge', 'aktiv', 'rennenWaehler'])
/** Aendert sich nie (steckt schon in den Startwerten) */
const FEST = new Set(['cfg', 'tempo', 'bw', 'bh', 'modus', 'anzahl', 'kreativ', 'lavaSalz'])

function packen(v: unknown): unknown {
  if (v instanceof Set) return { $set: [...v] }
  if (v instanceof Uint8Array || v instanceof Int32Array) return undefined
  return v
}
function auspacken(v: unknown): unknown {
  if (v && typeof v === 'object' && '$set' in (v as object)) return new Set((v as { $set: unknown[] }).$set)
  return v
}

/** Ganzer Stand (mit `fest` auch die Felder, die sich nie aendern) */
export function zustand(g: Game, fest = false): Zustand {
  if (g instanceof MehrGame) g.sichern()
  const mehr = g instanceof MehrGame
  const out: Zustand = {}
  for (const [k, v] of Object.entries(g)) {
    if (OHNE.has(k) || (!fest && FEST.has(k)) || (mehr && TAUSCH_FELDER.includes(k))) continue
    if (k === 'r') {
      out.r = (v as Game['r']).stand()
      continue
    }
    const p = packen(v)
    if (p !== undefined) out[k] = p
  }
  return out
}

/** Stand (ganz oder nur geaenderte Felder) in ein Spiel-Objekt uebernehmen */
export function anwenden(g: Game, z: Zustand) {
  const f = g as unknown as Record<string, unknown>
  for (const [k, v] of Object.entries(z)) {
    if (OHNE.has(k) || FEST.has(k)) continue
    if (k === 'r') {
      g.r.setzen(v as number)
      continue
    }
    f[k] = auspacken(v)
  }
  if ('blocks' in z || 'extra' in z) (g as unknown as { baueMaske: () => void }).baueMaske()
  // Zwischenspeicher der Schlange verwerfen
  f.schlangeMenge = null
  // Die Schlange, die dieses Geraet gerade geladen hat, frisch aus `schlangen` holen
  if (g instanceof MehrGame && 'schlangen' in z) (g as unknown as { laden: (i: number) => void }).laden(Math.min(g.aktiv, g.schlangen.length - 1))
}

/** Merkt sich, was zuletzt verschickt wurde, und liefert nur die Felder, die sich geaendert haben
 *  (die Schlangen kompakt, siehe multi/kompakt.ts) */
export class Abgleich {
  private zuletzt = new Map<string, string>()
  private schlangen = new SchlangenAbgleich()

  aenderungen(z: Zustand): Zustand | null {
    const out: Zustand = {}
    let n = 0
    for (const [k, v] of Object.entries(z)) {
      if (k === 'schlangen' && Array.isArray(v)) {
        const d = this.schlangen.aenderungen(v)
        if (d) {
          Object.assign(out, d)
          n++
        }
        continue
      }
      const j = JSON.stringify(v)
      if (this.zuletzt.get(k) === j) continue
      this.zuletzt.set(k, j)
      out[k] = v
      n++
    }
    return n ? out : null
  }

  vergessen() {
    this.zuletzt.clear()
    this.schlangen.vergessen()
  }
}
