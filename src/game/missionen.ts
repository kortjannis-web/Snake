/**
 * Kampagne: feste Missionen je Welt. Jede Mission ist eine von Hand gebaute Karte, die bei jedem Spielen gleich ist.
 *
 * Karten als Text, eine Zeile je Kartenreihe (alle gleich breit, Breite und Hoehe ganze Bloecke, siehe MISSION_BLOCK):
 *   #  Berg (gehoert nicht zur Karte, dagegen = vorbei)
 *   .  Wiese
 *   S  Kopf der Schlange beim Start (der Koerper liegt entgegen der Startrichtung dahinter)
 *   A  Apfel (alle liegen von Anfang an da, der zuletzt uebrige leuchtet)
 *   W  Mauer
 *   ~  Teich
 *   G  Giftapfel
 *   F  Frosch
 */
import type { Dir } from './types'

/** Normale Mission, Schatz-Level (Bonus) oder Boss-Level */
export type MissionArt = 'normal' | 'schatz' | 'boss'

export type MissionDef = {
  /** Eindeutig ueber alle Welten, z. B. 'wiese-1' (so steht sie im Speicher) */
  id: string
  welt: 'wiese'
  nr: number
  name: string
  art: MissionArt
  /** Belohnung beim ersten Abschluss (Aepfel) */
  lohn: number
  /** Noch nicht gebaut: auf der Karte ausgegraut */
  karte?: readonly string[]
  /** Startrichtung der Schlange */
  richtung?: Dir
  /** Startlaenge (mindestens 3) */
  laenge?: number
  /** Startwert fuer den Zufall (Froesche): so laeuft die Mission jedes Mal gleich */
  seed?: number
}

/** Bildschirm, nach dem die Bloecke der Missionen bemessen sind (wie im Mehrspieler und im Tageslevel): 13 x 12 Felder je Block */
export const MISSION_BILD = { w: 12, h: 23 }
export const MISSION_BLOCK = { w: 13, h: 12 }

/**
 * Mission 1 (Wiese): vier Taeler uebereinander, getrennt von Bergruecken mit Paessen links und rechts.
 * Unten startet die Schlange und laeuft nach oben. 10 Aepfel, 3 Giftaepfel, 5 Froesche, 3 Teiche, 3 Mauern.
 */
const WIESE_1 = [
  '##########################',
  '##########.....###########',
  '#######...........########',
  '#####.......A.......######',
  '####....~~~.....##....####',
  '####...~~~~~...####...####',
  '###.....~~~....F##..A..###',
  '###..A..........#.......##',
  '##.........WWW..........##',
  '###...G................###',
  '####.......###.........###',
  '#####....######......#####',
  '######...#######..A.######',
  '#######..########..#######',
  '######...#########..######',
  '#####....#########...#####',
  '####..A...#######.....####',
  '###........####...A....###',
  '###...WW............F..###',
  '##....WW.....~~~........##',
  '##..........~~~~~..##...##',
  '###..F.......~~~..###...##',
  '###......G.......####..###',
  '####.............##...####',
  '#####....A...........#####',
  '######.....#####....######',
  '########..#######..#######',
  '#########..#####..########',
  '##########.......#########',
  '#########.........########',
  '#######.....A.......######',
  '#####.........###.....####',
  '####....~~.....#....F..###',
  '###....~~~~..........A.###',
  '###.....~~.....WWW.....###',
  '###..........G.........###',
  '####...##.............####',
  '####..####...F........####',
  '#####..##...........######',
  '######.............#######',
  '#######...A.......########',
  '########..........########',
  '########..........########',
  '#########...S....#########',
  '#########........#########',
  '##########......##########',
  '###########....###########',
  '##########################',
] as const

/** Belohnung je Mission (beim ersten Abschluss) */
export const MISSION_LOHN = 6

const NAMEN = ['Erste Schritte', 'Am Bach', 'Froschteich', 'Steinmauern', 'Schatztor', 'Giftige Wiese', 'Hügelland', 'Enge Pässe', 'Sturm im Tal', 'Der Wächter der Wiese']

/** Die 10 Missionen der Wiese. 5 ist das Schatz-Level, 10 der Boss. Bisher ist nur Mission 1 gebaut */
export const WIESE_MISSIONEN: MissionDef[] = NAMEN.map((name, i) => ({
  id: `wiese-${i + 1}`,
  welt: 'wiese',
  nr: i + 1,
  name,
  art: i === 4 ? 'schatz' : i === 9 ? 'boss' : 'normal',
  lohn: MISSION_LOHN,
  ...(i === 0 ? { karte: WIESE_1, richtung: 'u' as Dir, laenge: 3, seed: 0x5eed01 } : {}),
}))

export const missionVon = (id: string) => WIESE_MISSIONEN.find((m) => m.id === id) ?? null
/** Ist die Mission schon gebaut (spielbar)? */
export const spielbar = (m: MissionDef) => !!m.karte
