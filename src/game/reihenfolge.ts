/**
 * Zufaellige Reihenfolge der Gefahren: Die Level, an denen etwas Neues kommt, bleiben (5, 15, 30, 40, 60 ...),
 * aber welche Gefahr dort kommt, wird je Runde neu ausgelost. So weiss man nie, ob als Naechstes Wasser,
 * ein Haus oder Giftaepfel kommen.
 *
 * Damit es fair bleibt:
 * - Jede Gefahr hat eine Schwere (1 leicht bis 6 schwer). Ein Platz darf nur Gefahren bekommen, die zu seiner
 *   Position passen: die ersten Plaetze nur leichte, schwere (Gegner, Wolken, Ameisen, Tuerme) erst spaeter.
 * - Mauern, Wasser, Froesche und Giftaepfel sind etwas wahrscheinlicher (hoeheres Gewicht), kommen also eher frueh.
 * - Was an einer Gefahr haengt, wandert mit: grosse Haeuser 50 Level nach den Huetten, lila Gegner 50 Level
 *   nach den roten.
 */
import type { Config } from './rules'

type Gefahr = { key: 'mauerAb' | 'teichAb' | 'froschAb' | 'giftAb' | 'baumAb' | 'falleAb' | 'hausAb' | 'gegnerAb' | 'wolkeAb' | 'eisAb' | 'ameiseAb' | 'turmAb'; schwere: number; gewicht: number }

export const GEFAHREN: Gefahr[] = [
  { key: 'mauerAb', schwere: 1, gewicht: 4 },
  { key: 'teichAb', schwere: 1, gewicht: 3 },
  { key: 'froschAb', schwere: 2, gewicht: 3 },
  { key: 'giftAb', schwere: 2, gewicht: 3 },
  { key: 'baumAb', schwere: 3, gewicht: 1 },
  { key: 'falleAb', schwere: 3, gewicht: 1.5 },
  { key: 'hausAb', schwere: 4, gewicht: 1 },
  { key: 'eisAb', schwere: 4, gewicht: 1 },
  { key: 'gegnerAb', schwere: 5, gewicht: 1 },
  { key: 'wolkeAb', schwere: 5, gewicht: 1 },
  { key: 'ameiseAb', schwere: 5, gewicht: 1 },
  { key: 'turmAb', schwere: 6, gewicht: 1 },
]

/** Hoechste Schwere, die Platz i (0 = erster) bekommen darf */
export const schwereBis = (i: number) => 2 + i / 2

/**
 * Neue Reihenfolge auslosen. Gibt eine Kopie der Einstellungen mit getauschten Start-Leveln zurueck.
 * `zufall` liefert Zahlen von 0 bis unter 1.
 */
export function zufallsReihenfolge(c: Config, zufall: () => number = Math.random): Config {
  const out: Config = { ...c }
  // Die Plaetze sind die Start-Level aus den Einstellungen (auch, wenn sie im Master geaendert wurden)
  const plaetze = GEFAHREN.map((g) => c[g.key]).sort((a, b) => a - b)
  const offen = [...GEFAHREN]
  plaetze.forEach((level, i) => {
    let kandidaten = offen.filter((g) => g.schwere <= schwereBis(i))
    // Notfall: nur noch Schwere uebrig, dann die leichteste
    if (!kandidaten.length) {
      const min = Math.min(...offen.map((g) => g.schwere))
      kandidaten = offen.filter((g) => g.schwere === min)
    }
    const summe = kandidaten.reduce((s, g) => s + g.gewicht, 0)
    let z = zufall() * summe
    let wahl = kandidaten[kandidaten.length - 1]
    for (const g of kandidaten) {
      z -= g.gewicht
      if (z < 0) {
        wahl = g
        break
      }
    }
    offen.splice(offen.indexOf(wahl), 1)
    out[wahl.key] = level
  })
  // Abhaengige Stufen wandern mit (gleicher Abstand wie vorher)
  out.hausGrossAb = out.hausAb + (c.hausGrossAb - c.hausAb)
  out.lilaAb = out.gegnerAb + (c.lilaAb - c.gegnerAb)
  return out
}
