/**
 * Erfolge: Geruest mit Zielen und Fortschritt. Belohnungen gibt es noch keine
 * (`belohnung` ist schon vorgesehen, wird aber nicht vergeben).
 * Zaehler stehen in stats.zaehler, manche kommen direkt aus Statistik und Geldbeutel.
 */
import { anzahlBesitz } from './render/skins'
import { stats, wallet } from './storage'

export type Erfolg = {
  id: string
  titel: string
  text: string
  /** Welcher Zaehler zaehlt */
  zaehler: string
  ziel: number
  /** Spaeter: so viele Aepfel als Belohnung (noch nicht vergeben) */
  belohnung?: number
}

export const ERFOLGE: Erfolg[] = [
  { id: 'apfel_1', titel: 'Erster Biss', text: 'Iss deinen ersten Apfel.', zaehler: 'aepfel', ziel: 1 },
  { id: 'apfel_500', titel: 'Apfelfreund', text: 'Iss insgesamt 500 Äpfel.', zaehler: 'aepfel', ziel: 500 },
  { id: 'apfel_5000', titel: 'Obstplantage', text: 'Iss insgesamt 5000 Äpfel.', zaehler: 'aepfel', ziel: 5000 },
  { id: 'level_50', titel: 'Aufgewärmt', text: 'Erreiche Level 50.', zaehler: 'level', ziel: 50 },
  { id: 'level_100', titel: 'Dreistellig', text: 'Erreiche Level 100.', zaehler: 'level', ziel: 100 },
  { id: 'level_200', titel: 'Profi', text: 'Erreiche Level 200.', zaehler: 'level', ziel: 200 },
  { id: 'level_300', titel: 'Meister', text: 'Erreiche Level 300.', zaehler: 'level', ziel: 300 },
  { id: 'level_500', titel: 'Legende', text: 'Erreiche Level 500.', zaehler: 'level', ziel: 500 },
  { id: 'spiele_10', titel: 'Dranbleiben', text: 'Spiele 10 Runden.', zaehler: 'spiele', ziel: 10 },
  { id: 'spiele_100', titel: 'Stammgast', text: 'Spiele 100 Runden.', zaehler: 'spiele', ziel: 100 },
  { id: 'gegner_1', titel: 'Eingekesselt', text: 'Besiege eine Gegner-Schlange.', zaehler: 'gegner', ziel: 1 },
  { id: 'gegner_25', titel: 'Schlangenjäger', text: 'Besiege 25 Gegner-Schlangen.', zaehler: 'gegner', ziel: 25 },
  { id: 'lila_1', titel: 'Lila Albtraum', text: 'Besiege eine lila Gegner-Schlange.', zaehler: 'lila', ziel: 1 },
  { id: 'gefressen_25', titel: 'Vielfraß', text: 'Friss mit „Füttern“ 25 Tiere oder Schlangen.', zaehler: 'gefressen', ziel: 25 },
  { id: 'ameisen_20', titel: 'Kammerjäger', text: 'Erledige 20 Ameisen.', zaehler: 'ameisen', ziel: 20 },
  { id: 'gold_10', titel: 'Goldgräber', text: 'Sammle 10 Golderze.', zaehler: 'gold', ziel: 10 },
  { id: 'dia_1', titel: 'Funkelstein', text: 'Finde einen Diamanten.', zaehler: 'dia', ziel: 1 },
  { id: 'rubin_1', titel: 'Rubinrot', text: 'Finde einen Rubin.', zaehler: 'rubin', ziel: 1 },
  { id: 'opal_1', titel: 'Schimmer', text: 'Finde einen Opal.', zaehler: 'opal', ziel: 1 },
  { id: 'gebiete_10', titel: 'Landvermesser', text: 'Wähle 10 neue Gebiete selbst.', zaehler: 'gebiete', ziel: 10 },
  { id: 'freigelegt_100', titel: 'Tunnelbauer', text: 'Lege mit dem Maulwurf 100 Felder frei.', zaehler: 'freigelegt', ziel: 100 },
  { id: 'power_50', titel: 'Sammler', text: 'Sammle 50 Power-ups.', zaehler: 'powerups', ziel: 50 },
  { id: 'skins_10', titel: 'Modebewusst', text: 'Besitze 10 Skins.', zaehler: 'skins', ziel: 10 },
  { id: 'mehr_1', titel: 'Mitspieler', text: 'Spiele ein Mehrspieler-Spiel.', zaehler: 'mehrspiele', ziel: 1 },
  { id: 'sieg_1', titel: 'Erster Sieg', text: 'Gewinne ein Mehrspieler-Spiel.', zaehler: 'siege', ziel: 1 },
  { id: 'sieg_10', titel: 'Champion', text: 'Gewinne 10 Mehrspieler-Spiele.', zaehler: 'siege', ziel: 10 },
  { id: 'sieg_50', titel: 'Unschlagbar', text: 'Gewinne 50 Mehrspieler-Spiele.', zaehler: 'siege', ziel: 50 },
  { id: 'jagd_1', titel: 'Apfeljäger', text: 'Gewinne eine Apfeljagd.', zaehler: 'jagdSiege', ziel: 1 },
  { id: 'zone_1', titel: 'Letzter in der Zone', text: 'Gewinne die schrumpfende Karte.', zaehler: 'zoneSiege', ziel: 1 },
  { id: 'koop_50', titel: 'Dream-Team', text: 'Erreicht im Koop zusammen Level 50.', zaehler: 'koopLevel', ziel: 50 },
]

/** Aktueller Stand eines Zaehlers */
export function stand(zaehler: string): number {
  if (zaehler === 'aepfel') return stats.apples
  if (zaehler === 'level') return stats.best
  if (zaehler === 'spiele') return stats.games
  if (zaehler === 'gegner') return Math.max(stats.gegner, stats.zaehler.gegner ?? 0)
  if (zaehler === 'skins') return anzahlBesitz(wallet.skins)
  return stats.zaehler[zaehler] ?? 0
}

/** Zaehler erhoehen (nur echte Runden, nicht Kreativ) */
export function zaehle(zaehler: string, n = 1) {
  stats.zaehler[zaehler] = (stats.zaehler[zaehler] ?? 0) + n
}

/** Neu erreichte Erfolge eintragen und zurueckgeben */
export function erfolgePruefen(): Erfolg[] {
  const neu = ERFOLGE.filter((e) => !stats.erfolge.includes(e.id) && stand(e.zaehler) >= e.ziel)
  for (const e of neu) stats.erfolge.push(e.id)
  return neu
}
