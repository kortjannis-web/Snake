/**
 * Alle Stellschrauben des Endlos-Modus an einer Stelle.
 *
 * Level = gegessene Aepfel + 1. Jeder Apfel ist ein Level.
 */
import type { Dir, P } from './types'

export const STEP: Record<Dir, P> = { u: { x: 0, y: -1 }, d: { x: 0, y: 1 }, l: { x: -1, y: 0 }, r: { x: 1, y: 0 } }
export const OPP: Record<Dir, Dir> = { u: 'd', d: 'u', l: 'r', r: 'l' }
export const DIRS: Dir[] = ['u', 'd', 'l', 'r']

/** Takt je Feld (ms) nach Tempo-Einstellung */
export const TEMPO = { langsam: 185, normal: 154, schnell: 128 } as const
export type Tempo = keyof typeof TEMPO
/** Mit jedem Level etwas schneller, ab ca. Level 270 nicht mehr (68 % des Grundtakts) */
export const takt = (tempo: Tempo, level: number) => TEMPO[tempo] * Math.max(0.68, 1 - (level - 1) * 0.0012)

/** Alle 30 Level kommt ein halber Bildschirm Platz dazu, ab Level 300 nicht mehr */
export const GEBIET_ALLE = 30
export const GEBIET_BIS = 300
export const neuesGebiet = (level: number) => level % GEBIET_ALLE === 0 && level < GEBIET_BIS

/** Waechst die Schlange bei diesem Level? Bis 50 immer, bis 300 jedes zweite, danach jedes dritte */
export const waechst = (level: number) => (level <= 50 ? true : level <= 300 ? level % 2 === 0 : level % 3 === 0)

/* ---------------- Mauern ----------------
 * Ab Level 8 steht eine Mauer, alle 8 Level wird sie ein Feld laenger:
 * 2, 3, 4, 5, 6. Ist sie 6 lang, kommt eine neue Mauer dazu, die wieder mit
 * 2 Feldern anfaengt (Level 48), und so weiter. Nach jedem Apfel verschwinden
 * die Mauern und erscheinen woanders neu. Wie viele Mauern Platz haben,
 * haengt an der Kartengroesse (ca. eine je 130 Felder). */
export const MAUER_AB = 8
export const MAUER_SCHRITT = 8
export const MAUER_MAX = 6
export const mauern = (level: number, felder: number): number[] => {
  if (level < MAUER_AB) return []
  const idx = Math.floor((level - MAUER_AB) / MAUER_SCHRITT)
  const stufen = MAUER_MAX - 1 // 2..6
  const volle = Math.floor(idx / stufen)
  const rest = idx % stufen
  const out = Array.from({ length: volle }, () => MAUER_MAX)
  out.push(2 + rest)
  const cap = Math.max(1, Math.floor(felder / 130))
  return out.slice(0, cap)
}
/** Chance auf einen Knick je Mauerlaenge */
export const knick = (len: number) => [0, 0, 0, 0.2, 0.4, 0.6, 0.75][len] ?? 0.75

/* ---------------- Teiche ----------------
 * Alle 15 Level (ab Level 15) entsteht ein Teich und bleibt liegen. Jeder
 * zweite neue Teich ist ein Feld groesser: 2, 2, 3, 3, 4, 4 ... bis 12.
 * Sind zu viele Teiche auf der Karte, trocknet der aelteste aus. */
export const TEICH_ALLE = 15
export const neuerTeich = (level: number) => level >= TEICH_ALLE && level % TEICH_ALLE === 0
export const teichGroesse = (level: number) => Math.min(12, 2 + Math.floor((level / TEICH_ALLE - 1) / 2))
export const teichMax = (felder: number) => Math.max(2, Math.floor(felder / 220))

/* ---------------- Giftaepfel (ab Level 50) ----------------
 * Sehen aus wie Aepfel, sind an einer Ecke verschimmelt. Essen = Spielende.
 * Liegen nach jedem Apfel woanders. Anzahl steigt langsam bis 4. */
export const GIFT_AB = 50
export const giftAnzahl = (level: number) => (level < GIFT_AB ? 0 : Math.min(4, 1 + Math.floor((level - GIFT_AB) / 60)))

/* ---------------- Ereignisse ----------------
 * Fallen ab 100 (alle 4 bis 5 Level, ab 200 alle 3 bis 4), Giftwolken ab 150
 * (alle 5 bis 7, ab 250 alle 4 bis 6), Ameisen ab 200 (alle 6 bis 9, ab 250
 * alle 5 bis 7). Ab 150 ist immer mindestens ein Ereignis aktiv, ab 200
 * mindestens zwei, ab 300 drei. */
export const FALLE_AB = 100
export const WOLKE_AB = 150
export const AMEISE_AB = 200
export const fallePause = (level: number): [number, number] => (level >= 200 ? [3, 4] : [4, 5])
export const wolkePause = (level: number): [number, number] => (level >= 250 ? [4, 6] : [5, 7])
export const ameisePause = (level: number): [number, number] => (level >= 250 ? [5, 7] : [6, 9])
export const mindestEreignisse = (level: number) => (level >= 300 ? 3 : level >= 200 ? 2 : level >= 150 ? 1 : 0)

/** Falle: 5 bis 8 Felder vor dem Kopf, liegt 25 s */
export const FALLE_ABSTAND: [number, number] = [5, 8]
export const FALLE_DAUER = 25_000
/** Wolke: alle 5 s eine Stufe groesser, 1 s vorher pulsiert sie */
export const WOLKE_TAKT = 5000
export const WOLKE_WARNUNG = 1000
export const WOLKE_VERWEILEN = 5000
export const WOLKE_AUFLOESEN = 1200
export const wolkeMaxStufe = (level: number) => (level >= 300 ? 5 : level >= 250 ? 4 : level >= 200 ? 3 : 2)
/** Felder einer Wolke je Stufe: 0 Punkt, 1 Plus, 2 Quadrat 3x3, 3 Quadrat + Spitzen, 4 Quadrat 5x5 ... */
export const wolkenForm = (stage: number): P[] => {
  const m = Math.floor(stage / 2)
  const out: P[] = []
  const r = m + 1
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const cheb = Math.max(Math.abs(dx), Math.abs(dy))
      if (cheb <= m) out.push({ x: dx, y: dy })
      else if (stage % 2 === 1 && cheb === m + 1 && (dx === 0 || dy === 0)) out.push({ x: dx, y: dy })
    }
  return out
}
/** Ameise: ein Feld alle 3 s (ab Level 300 alle 2,4 s) */
export const ameiseTakt = (level: number) => (level >= 300 ? 2400 : 3000)
export const AMEISE_SCHRITT = 420

/* ---------------- Rueckschlaege ----------------
 * Giftwolke beruehren: 10 Level zurueck. Licht aus einem Hausfenster: 5 Level
 * zurueck. Danach ist die Schlange kurz geschuetzt (blinkt), damit sie
 * herauskommt. Die Schlange wird dabei so viel kuerzer, wie sie in diesen
 * Leveln gewachsen war. Karte, Baeume und Haeuser bleiben. */
export const WOLKE_ZURUECK = 10
export const LICHT_ZURUECK = 5
export const SCHUTZ = 2200

/* ---------------- Baeume (ab Level 100) ----------------
 * Liegende Tanne, 1-1-2-1 Felder. Ab Level 100 alle 40 Level ein neuer
 * (100, 140, 180 ...), bleibt fuer immer. Hoechstens einer je 150 Felder. */
export const BAUM_AB = 100
export const BAUM_ALLE = 40
export const neuerBaum = (level: number) => level >= BAUM_AB && (level - BAUM_AB) % BAUM_ALLE === 0
export const baumMax = (felder: number) => Math.max(1, Math.floor(felder / 150))
/** Felder entlang der Achse (a) und quer dazu (q), Seite der breiten Reihe = +1 */
export const BAUM_FORM: { a: number; q: number }[] = [
  { a: 0, q: 0 },
  { a: 1, q: 0 },
  { a: 2, q: 0 },
  { a: 2, q: 1 },
  { a: 3, q: 0 },
]

/* ---------------- Haeuser (ab Level 210) ----------------
 * 2x3 oder mit einer Ecke (Reihen 2, 2, 3, 3). Ab Level 210 alle 30 Level ein
 * neues (210, 240, 270 ...), bleibt stehen. Hoechstens eins je 250 Felder.
 * Vier Fenster, eins je Seite. Nach jedem Apfel leuchtet ein anderes, das
 * Licht reicht 2 Felder nach aussen. */
export const HAUS_AB = 210
export const HAUS_ALLE = 30
export const LICHT_WEITE = 2
export const neuesHaus = (level: number) => level >= HAUS_AB && (level - HAUS_AB) % HAUS_ALLE === 0
export const hausMax = (felder: number) => Math.max(1, Math.floor(felder / 250))
export const HAUS_FORMEN: P[][] = [
  // 2 breit, 3 hoch
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }],
  // mit Ecke: Reihen 2, 2, 3, 3
  [
    { x: 0, y: 0 }, { x: 1, y: 0 },
    { x: 0, y: 1 }, { x: 1, y: 1 },
    { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 },
    { x: 0, y: 3 }, { x: 1, y: 3 }, { x: 2, y: 3 },
  ],
]

/** Gnadenschritt: so lange (in Takten) bleibt die Schlange vor einem Hindernis stehen */
export const GNADE = 1.3

/** Wann wird was zum ersten Mal vorgestellt */
export const UNLOCKS = [
  { what: 'mauer', level: MAUER_AB },
  { what: 'teich', level: TEICH_ALLE },
  { what: 'gebiet', level: GEBIET_ALLE },
  { what: 'gift', level: GIFT_AB },
  { what: 'falle', level: FALLE_AB },
  { what: 'wolke', level: WOLKE_AB },
  { what: 'ameise', level: AMEISE_AB },
  { what: 'baum', level: BAUM_AB },
  { what: 'haus', level: HAUS_AB },
] as const
