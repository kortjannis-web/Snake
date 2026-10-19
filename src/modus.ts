/**
 * Spielmodi und Apfel-Belohnung. Abenteuer: genau 25 % langsamer und 25 % weniger Aepfel. Normal: wie es ist.
 * Speedrun: 25 % schneller mit Zeitlimit je Apfel, 25 % mehr Aepfel, ab den orangen Aepfeln 50 % mehr.
 * Es zaehlen nur volle Aepfel: was darunter liegt, wird zwischengespeichert (in Hundertsteln) und bei den
 * naechsten Aepfeln dazugerechnet, so geht nie etwas verloren.
 */
export type SpielModus = 'abenteuer' | 'normal' | 'speedrun'
export const SPIEL_MODI: SpielModus[] = ['abenteuer', 'normal', 'speedrun']
export const SPIELMODUS_NAME: Record<SpielModus, string> = { abenteuer: 'Abenteuer', normal: 'Normal', speedrun: 'Speedrun' }

/** Wie schnell die Schlange im Vergleich zu Normal ist (in Prozent): Abenteuer 75 %, Speedrun 125 % */
export const MODUS_TEMPO: Record<SpielModus, number> = { abenteuer: 75, normal: 100, speedrun: 125 }

/**
 * Wie viel Prozent des Werts ein Modus auszahlt. `faktor` ist der Apfelfaktor des Levels (1 = rot,
 * ab 2 = orange und hoeher): Der Speedrun gibt ab Orange 150 % statt 125 %.
 */
export function modusProzent(modus: SpielModus, faktor: number): number {
  if (modus === 'abenteuer') return 75
  if (modus === 'speedrun') return faktor >= 2 ? 150 : 125
  return 100
}

/**
 * Gutschrift mit Zwischenspeicher. `rest` sind die noch nicht vollen Hundertstel-Aepfel von frueher.
 * Gibt die vollen Aepfel zurueck, die jetzt gutgeschrieben werden, und den neuen Rest (0 bis 99).
 */
export function gutschrift(wert: number, prozent: number, rest: number): { ganz: number; rest: number } {
  const summe = Math.max(0, Math.round(rest)) + Math.round(wert * prozent)
  const ganz = Math.floor(summe / 100)
  return { ganz, rest: summe - ganz * 100 }
}
