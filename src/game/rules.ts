/**
 * Alle Stellschrauben des Endlos-Modus. Die Zahlen stehen in `Config` und
 * lassen sich in den Master-Einstellungen aendern (SCHEMA beschreibt jede
 * Zahl fuer die Oberflaeche). Level = gegessene Aepfel + 1.
 */
import type { Dir, P } from './types'

export const STEP: Record<Dir, P> = { u: { x: 0, y: -1 }, d: { x: 0, y: 1 }, l: { x: -1, y: 0 }, r: { x: 1, y: 0 } }
export const OPP: Record<Dir, Dir> = { u: 'd', d: 'u', l: 'r', r: 'l' }
export const DIRS: Dir[] = ['u', 'd', 'l', 'r']
/** Im Uhrzeigersinn weiter */
export const CW: Record<Dir, Dir> = { u: 'r', r: 'd', d: 'l', l: 'u' }

/** Takt je Feld (ms) nach Tempo-Einstellung */
export const TEMPO = { langsam: 185, normal: 154, schnell: 128 } as const
export type Tempo = keyof typeof TEMPO

export const DEFAULTS = {
  // Karte
  gebietAlle: 20,
  gebietBis: 300,
  // Tempo und Wachsen
  tempoProLevel: 0.12,
  tempoMin: 68,
  wachsenJedes: 50,
  wachsenJedesZweite: 300,
  gnade: 1.3,
  schutz: 2.2,
  // Mauern
  mauerAb: 8,
  mauerSchritt: 8,
  mauerMax: 6,
  mauerFelder: 130,
  // Teiche
  teichAb: 15,
  teichAlle: 15,
  teichMaxGroesse: 12,
  teichFelder: 220,
  // Giftaepfel
  giftAb: 50,
  giftAlle: 60,
  giftMax: 4,
  // Fallen
  falleAb: 100,
  falleMin: 4,
  falleMax: 5,
  falleDauer: 25,
  falleAbstandMin: 5,
  falleAbstandMax: 8,
  // Baeume
  baumAb: 100,
  baumAlle: 40,
  baumFelder: 150,
  // Giftwolken
  wolkeAb: 150,
  wolkeMin: 5,
  wolkeMax: 7,
  wolkeTakt: 5,
  wolkeStufeStart: 2,
  wolkeStufeMax: 5,
  wolkeZurueck: 10,
  // Froesche
  froschAb: 200,
  froschMin: 2,
  froschMax: 3,
  froschSprung: 3,
  froschWende: 20,
  froschAnzahl: 6,
  // Haeuser
  hausAb: 210,
  hausAlle: 30,
  hausFelder: 250,
  lichtWeite: 2,
  lichtZurueck: 5,
  // Jaegertuerme
  turmAb: 315,
  turmAlle: 40,
  turmFelder: 300,
  kegelLaenge: 6,
  kegelZurueck: 10,
  // Power-ups und Muenzen
  powerAb: 10,
  powerChance: 18,
  powerDauer: 15,
  effektDauer: 8,
  geistDauer: 6,
  schereProzent: 30,
  apfelMuenzen: 1,
  muenzeChance: 25,
  muenzeWert: 3,
  muenzFaktorAlle: 50,
  // Ereignisse
  ereignis1Ab: 150,
  ereignis2Ab: 200,
  ereignis3Ab: 300,
  haeufigerAb: 250,
}
export type Config = typeof DEFAULTS
export type ConfigKey = keyof Config

/** Beschreibung jeder Zahl fuer die Master-Einstellungen */
export const SCHEMA: { gruppe: string; felder: { key: ConfigKey; label: string; min: number; max: number; step?: number; einheit?: string }[] }[] = [
  {
    gruppe: 'Karte',
    felder: [
      { key: 'gebietAlle', label: 'Neuer Kartenblock alle', min: 1, max: 500, einheit: 'Level' },
      { key: 'gebietBis', label: 'Karte wächst bis Level', min: 0, max: 10000 },
    ],
  },
  {
    gruppe: 'Schlange',
    felder: [
      { key: 'tempoProLevel', label: 'Schneller je Level', min: 0, max: 2, step: 0.01, einheit: '%' },
      { key: 'tempoMin', label: 'Höchstens so schnell (Takt)', min: 20, max: 100, einheit: '%' },
      { key: 'wachsenJedes', label: 'Wächst mit jedem Apfel bis Level', min: 0, max: 10000 },
      { key: 'wachsenJedesZweite', label: 'Danach mit jedem zweiten bis Level', min: 0, max: 10000 },
      { key: 'gnade', label: 'Gnadenschritt', min: 1, max: 5, step: 0.1, einheit: 'Takte' },
      { key: 'schutz', label: 'Schutz nach Rückschlag', min: 0, max: 10, step: 0.1, einheit: 's' },
    ],
  },
  {
    gruppe: 'Mauern',
    felder: [
      { key: 'mauerAb', label: 'Ab Level', min: 1, max: 10000 },
      { key: 'mauerSchritt', label: 'Ein Feld länger alle', min: 1, max: 500, einheit: 'Level' },
      { key: 'mauerMax', label: 'Längste Mauer', min: 2, max: 20, einheit: 'Felder' },
      { key: 'mauerFelder', label: 'Höchstens eine Mauer je', min: 20, max: 5000, einheit: 'Felder' },
    ],
  },
  {
    gruppe: 'Teiche',
    felder: [
      { key: 'teichAb', label: 'Ab Level', min: 1, max: 10000 },
      { key: 'teichAlle', label: 'Neuer Teich alle', min: 1, max: 500, einheit: 'Level' },
      { key: 'teichMaxGroesse', label: 'Größter Teich', min: 2, max: 40, einheit: 'Felder' },
      { key: 'teichFelder', label: 'Höchstens ein Teich je', min: 20, max: 5000, einheit: 'Felder' },
    ],
  },
  {
    gruppe: 'Giftäpfel',
    felder: [
      { key: 'giftAb', label: 'Ab Level', min: 1, max: 10000 },
      { key: 'giftAlle', label: 'Einer mehr alle', min: 1, max: 1000, einheit: 'Level' },
      { key: 'giftMax', label: 'Höchstens', min: 0, max: 20, einheit: 'Stück' },
    ],
  },
  {
    gruppe: 'Bärenfallen',
    felder: [
      { key: 'falleAb', label: 'Ab Level', min: 1, max: 10000 },
      { key: 'falleMin', label: 'Abstand mindestens', min: 1, max: 100, einheit: 'Level' },
      { key: 'falleMax', label: 'Abstand höchstens', min: 1, max: 100, einheit: 'Level' },
      { key: 'falleDauer', label: 'Liegt', min: 3, max: 300, einheit: 's' },
      { key: 'falleAbstandMin', label: 'Vor dem Kopf mindestens', min: 2, max: 30, einheit: 'Felder' },
      { key: 'falleAbstandMax', label: 'Vor dem Kopf höchstens', min: 2, max: 30, einheit: 'Felder' },
    ],
  },
  {
    gruppe: 'Bäume',
    felder: [
      { key: 'baumAb', label: 'Ab Level', min: 1, max: 10000 },
      { key: 'baumAlle', label: 'Neuer Baum alle', min: 1, max: 500, einheit: 'Level' },
      { key: 'baumFelder', label: 'Höchstens ein Baum je', min: 20, max: 5000, einheit: 'Felder' },
    ],
  },
  {
    gruppe: 'Giftwolken',
    felder: [
      { key: 'wolkeAb', label: 'Ab Level', min: 1, max: 10000 },
      { key: 'wolkeMin', label: 'Abstand mindestens', min: 1, max: 100, einheit: 'Level' },
      { key: 'wolkeMax', label: 'Abstand höchstens', min: 1, max: 100, einheit: 'Level' },
      { key: 'wolkeTakt', label: 'Wächst alle', min: 1, max: 60, step: 0.5, einheit: 's' },
      { key: 'wolkeStufeStart', label: 'Größte Stufe am Anfang (1 Kreuz, 2 Quadrat …)', min: 1, max: 8 },
      { key: 'wolkeStufeMax', label: 'Größte Stufe insgesamt (+1 je 50 Level)', min: 1, max: 8 },
      { key: 'wolkeZurueck', label: 'Treffer kostet', min: 0, max: 100, einheit: 'Level' },
    ],
  },
  {
    gruppe: 'Frösche',
    felder: [
      { key: 'froschAb', label: 'Ab Level', min: 1, max: 10000 },
      { key: 'froschMin', label: 'Neuer Frosch alle mindestens', min: 1, max: 100, einheit: 'Level' },
      { key: 'froschMax', label: 'Neuer Frosch alle höchstens', min: 1, max: 100, einheit: 'Level' },
      { key: 'froschSprung', label: 'Hüpft alle', min: 1, max: 20, step: 0.1, einheit: 's' },
      { key: 'froschWende', label: 'Chance auf Richtungswechsel', min: 0, max: 100, einheit: '%' },
      { key: 'froschAnzahl', label: 'Höchstens gleichzeitig', min: 0, max: 40, einheit: 'Frösche' },
    ],
  },
  {
    gruppe: 'Häuser',
    felder: [
      { key: 'hausAb', label: 'Ab Level', min: 1, max: 10000 },
      { key: 'hausAlle', label: 'Neues Haus alle', min: 1, max: 500, einheit: 'Level' },
      { key: 'hausFelder', label: 'Höchstens ein Haus je', min: 30, max: 5000, einheit: 'Felder' },
      { key: 'lichtWeite', label: 'Licht reicht', min: 1, max: 10, einheit: 'Felder' },
      { key: 'lichtZurueck', label: 'Licht kostet', min: 0, max: 100, einheit: 'Level' },
    ],
  },
  {
    gruppe: 'Jägertürme',
    felder: [
      { key: 'turmAb', label: 'Ab Level', min: 1, max: 10000 },
      { key: 'turmAlle', label: 'Neuer Turm alle', min: 1, max: 500, einheit: 'Level' },
      { key: 'turmFelder', label: 'Höchstens ein Turm je', min: 30, max: 5000, einheit: 'Felder' },
      { key: 'kegelLaenge', label: 'Lichtkegel lang', min: 1, max: 20, einheit: 'Felder' },
      { key: 'kegelZurueck', label: 'Kegel kostet', min: 0, max: 100, einheit: 'Level' },
    ],
  },
  {
    gruppe: 'Power-ups und Münzen',
    felder: [
      { key: 'powerAb', label: 'Power-ups ab Level', min: 1, max: 10000 },
      { key: 'powerChance', label: 'Chance je Apfel auf ein Power-up', min: 0, max: 100, einheit: '%' },
      { key: 'powerDauer', label: 'Power-up liegt', min: 3, max: 120, einheit: 's' },
      { key: 'effektDauer', label: 'Zeitlupe und Magnet halten', min: 1, max: 60, einheit: 's' },
      { key: 'geistDauer', label: 'Geist hält', min: 1, max: 60, einheit: 's' },
      { key: 'schereProzent', label: 'Schere kürzt um', min: 5, max: 90, einheit: '%' },
      { key: 'apfelMuenzen', label: 'Münzen je Apfel', min: 0, max: 100 },
      { key: 'muenzeChance', label: 'Chance je Apfel auf eine Goldmünze', min: 0, max: 100, einheit: '%' },
      { key: 'muenzeWert', label: 'Goldmünze ist wert', min: 1, max: 1000, einheit: 'Münzen' },
      { key: 'muenzFaktorAlle', label: 'Münzen zählen einmal mehr alle', min: 1, max: 10000, einheit: 'Level' },
    ],
  },
  {
    gruppe: 'Ereignisse (Fallen, Wolken, Frösche)',
    felder: [
      { key: 'ereignis1Ab', label: 'Mindestens 1 unterwegs ab Level', min: 1, max: 10000 },
      { key: 'ereignis2Ab', label: 'Mindestens 2 unterwegs ab Level', min: 1, max: 10000 },
      { key: 'ereignis3Ab', label: 'Mindestens 3 unterwegs ab Level', min: 1, max: 10000 },
      { key: 'haeufigerAb', label: 'Alle Abstände 1 Level kürzer ab Level', min: 1, max: 10000 },
    ],
  },
]

/* ---------------- Ableitungen ---------------- */

export const takt = (c: Config, tempo: Tempo, level: number) =>
  TEMPO[tempo] * Math.max(c.tempoMin / 100, 1 - ((level - 1) * c.tempoProLevel) / 100)

/** Neuer Kartenblock bei diesem Level? */
export const neuesGebiet = (c: Config, level: number) => c.gebietAlle > 0 && level % c.gebietAlle === 0 && level < c.gebietBis

/** Waechst die Schlange bei diesem Level? */
export const waechst = (c: Config, level: number) =>
  level <= c.wachsenJedes ? true : level <= c.wachsenJedesZweite ? level % 2 === 0 : level % 3 === 0

/** Mauerlaengen: eine Mauer waechst von 2 bis zur Hoechstlaenge, dann kommt eine neue mit 2 dazu */
export const mauern = (c: Config, level: number, felder: number): number[] => {
  if (level < c.mauerAb) return []
  const idx = Math.floor((level - c.mauerAb) / c.mauerSchritt)
  const stufen = Math.max(1, c.mauerMax - 1)
  const volle = Math.floor(idx / stufen)
  const out = Array.from({ length: Math.min(volle, 200) }, () => c.mauerMax)
  out.push(Math.min(c.mauerMax, 2 + (idx % stufen)))
  return out.slice(0, Math.max(1, Math.floor(felder / c.mauerFelder)))
}
/** Chance auf einen Knick je Mauerlaenge */
export const knick = (len: number) => [0, 0, 0, 0.2, 0.4, 0.6, 0.75][len] ?? 0.75

export const neuerTeich = (c: Config, level: number) => level >= c.teichAb && (level - c.teichAb) % c.teichAlle === 0
/** 2, 2, 3, 3, 4 ... */
export const teichGroesse = (c: Config, level: number) =>
  Math.min(c.teichMaxGroesse, 2 + Math.floor(Math.floor((level - c.teichAb) / c.teichAlle) / 2))
export const teichMax = (c: Config, felder: number) => Math.max(2, Math.floor(felder / c.teichFelder))

export const giftAnzahl = (c: Config, level: number) =>
  level < c.giftAb ? 0 : Math.min(c.giftMax, 1 + Math.floor((level - c.giftAb) / c.giftAlle))

export const neuerBaum = (c: Config, level: number) => level >= c.baumAb && (level - c.baumAb) % c.baumAlle === 0
export const baumMax = (c: Config, felder: number) => Math.max(1, Math.floor(felder / c.baumFelder))
/** Liegende Tanne 1-1-2-1: Felder entlang der Achse (a) und quer dazu (q) */
export const BAUM_FORM: { a: number; q: number }[] = [
  { a: 0, q: 0 },
  { a: 1, q: 0 },
  { a: 2, q: 0 },
  { a: 2, q: 1 },
  { a: 3, q: 0 },
]

export const neuesHaus = (c: Config, level: number) => level >= c.hausAb && (level - c.hausAb) % c.hausAlle === 0
export const hausMax = (c: Config, felder: number) => Math.max(1, Math.floor(felder / c.hausFelder))
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

export const neuerTurm = (c: Config, level: number) => level >= c.turmAb && (level - c.turmAb) % c.turmAlle === 0
export const turmMax = (c: Config, felder: number) => Math.max(1, Math.floor(felder / c.turmFelder))

/** Abstand bis zum naechsten Ereignis dieser Art (ab `haeufigerAb` je 1 Level kuerzer) */
export const pause = (c: Config, art: 'falle' | 'wolke' | 'frosch', level: number): [number, number] => {
  const [a, b] = art === 'falle' ? [c.falleMin, c.falleMax] : art === 'wolke' ? [c.wolkeMin, c.wolkeMax] : [c.froschMin, c.froschMax]
  const k = level >= c.haeufigerAb ? 1 : 0
  const lo = Math.max(1, Math.min(a, b) - k)
  return [lo, Math.max(lo, Math.max(a, b) - k)]
}
export const ab = (c: Config, art: 'falle' | 'wolke' | 'frosch') => (art === 'falle' ? c.falleAb : art === 'wolke' ? c.wolkeAb : c.froschAb)
export const mindestEreignisse = (c: Config, level: number) =>
  level >= c.ereignis3Ab ? 3 : level >= c.ereignis2Ab ? 2 : level >= c.ereignis1Ab ? 1 : 0

/** Groesste Wolkenstufe: Startwert, alle 50 Level eine mehr */
export const wolkeMaxStufe = (c: Config, level: number) =>
  Math.min(c.wolkeStufeMax, c.wolkeStufeStart + Math.max(0, Math.floor((level - c.wolkeAb) / 50)))
export const WOLKE_WARNUNG = 1000
export const WOLKE_VERWEILEN = 5000
export const WOLKE_AUFLOESEN = 1200
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

/** Frosch: Sprung dauert so lange, 1 s vorher macht er sich bereit, 0,25 s nach der Landung dreht er ggf. */
/** Muenzen zaehlen mehrfach: bis Level 49 einfach, ab 50 doppelt, ab 100 dreifach ... */
export const muenzFaktor = (c: Config, level: number) => 1 + Math.floor(level / Math.max(1, c.muenzFaktorAlle))

/** So lange liegt eine Goldmuenze (ms), hoechstens so viele gleichzeitig */
export const MUENZE_DAUER = 12_000
export const MUENZE_MAX = 3
export const POWER_ARTEN = ['schild', 'zeitlupe', 'magnet', 'geist', 'schere'] as const
/** Zeitlupe: Takt so viel langsamer */
export const ZEITLUPE = 1.55
/** Magnet: alle so viele ms ruecken Apfel und Muenzen ein Feld naeher */
export const MAGNET_TAKT = 260

export const FROSCH_FLUG = 380
export const FROSCH_ANLAUF = 1000
export const FROSCH_DREHEN = 250

/** Wann wird was zum ersten Mal vorgestellt */
export const unlocks = (c: Config) =>
  [
    { what: 'mauer', level: c.mauerAb },
    { what: 'teich', level: c.teichAb },
    { what: 'gift', level: c.giftAb },
    { what: 'falle', level: c.falleAb },
    { what: 'baum', level: c.baumAb },
    { what: 'wolke', level: c.wolkeAb },
    { what: 'frosch', level: c.froschAb },
    { what: 'haus', level: c.hausAb },
    { what: 'turm', level: c.turmAb },
  ] as const
